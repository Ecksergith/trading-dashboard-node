import { mt5Bridge } from './mt5-bridge.js';
import { aiAgent } from './ai-agent.js';
import { technicalIndicators } from './technical-indicators.js';
import { tradingMemory } from './trading-memory.js';
import { multiAccountManager } from './multi-account-bridge.js';
import { calculateLotSize, normalizeVolume, getPipDivisor, getSLDivisor, getDecimals, getSymbolType, DEFAULT_PAIRS } from './constants.js';
import { getStrategyPrompt, buildTradeAnalysisPrompt, callLLM, parseLLMResponse, addToHistory, loadSettings } from './llm-engine.js';
import { createLogger, pushLog } from './logger.js';

const LOG_PREFIX = '[MultiAutoTrader]';
const log = createLogger(LOG_PREFIX);

function isTradingAllowed(riskSettings) {
  if (!riskSettings.auto_trading) return false;

  if (riskSettings.time_control_enabled) {
    const now = new Date();
    const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    const dayName = dayNames[now.getDay()];
    if (riskSettings.trading_days && !riskSettings.trading_days[dayName]) return false;

    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (riskSettings.start_time && riskSettings.end_time) {
      if (currentTime < riskSettings.start_time || currentTime > riskSettings.end_time) return false;
    }
  }

  return true;
}

function checkPositionLimits(riskSettings, openPositions) {
  const maxPositions = riskSettings.max_positions || 5;
  return openPositions.length < maxPositions;
}

function checkDailyLossLimit(riskSettings, tradeHistory, accountInfo) {
  const maxLossPerDay = riskSettings.max_loss_per_day || 100;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTrades = tradeHistory.filter(t => t.time >= todayStart.getTime());
  const dailyPnL = todayTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
  return dailyPnL >= -maxLossPerDay;
}

function checkDailyTradeLimit(riskSettings, tradeHistory) {
  const maxTrades = riskSettings.trade_per_day || 10;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTrades = tradeHistory.filter(t => t.time >= todayStart.getTime());
  return todayTrades.length < maxTrades;
}

function hasOpenPosition(openPositions, pair, type) {
  return openPositions.some(p =>
    p.symbol === pair && (p.type === type || p.type === type.toUpperCase())
  );
}

async function ensurePositionsHaveSLTP(bridge, riskSettings, io, accountId) {
  try {
    const openPositions = await bridge.getPositions();
    if (!openPositions || openPositions.length === 0) return;

    for (const pos of openPositions) {
      const currentSL = pos.stop_loss ?? pos.sl ?? 0;
      const currentTP = pos.take_profit ?? pos.tp ?? 0;
      if (currentSL > 0 && currentTP > 0) continue;

      const slPips = riskSettings.ifvg_stop_loss || 50;
      const tpPips = riskSettings.ifvg_take_profit || (slPips * (riskSettings.risk_reward_ratio || 2));
      const symInfo = await bridge.getSymbolInfo(pos.symbol);
      const point = symInfo?.point || (getSymbolType(pos.symbol) === 'metal' ? 0.01 : 0.0001);
      const stopLevel = symInfo?.trade_stop_level || 0;
      const decimals = symInfo?.digits ?? getDecimals(pos.symbol);
      const openPrice = pos.price_open ?? pos.price_current ?? 0;
      const posSymType = getSymbolType(pos.symbol);
      let slDistance, tpDistance;
      if (posSymType === 'metal') {
        slDistance = Math.max(slPips / getPipDivisor(pos.symbol), stopLevel * point, point * 10);
        tpDistance = Math.max(tpPips / getPipDivisor(pos.symbol), stopLevel * point, point * 10);
      } else {
        const slPct = slPips / getSLDivisor(pos.symbol);
        slDistance = Math.max(openPrice * slPct, stopLevel * point, point * 100);
        tpDistance = Math.max(openPrice * slPct * (riskSettings.risk_reward_ratio || 2), stopLevel * point, point * 100);
      }

      let newSL = currentSL;
      let newTP = currentTP;

      if (currentSL === 0) {
        newSL = pos.type === 0
          ? +(openPrice - slDistance).toFixed(decimals)
          : +(openPrice + slDistance).toFixed(decimals);
      }
      if (currentTP === 0) {
        newTP = pos.type === 0
          ? +(pos.price_open + tpDistance).toFixed(decimals)
          : +(pos.price_open - tpDistance).toFixed(decimals);
      }

      if (newSL > 0 && newTP > 0) {
        const result = await bridge.modifyPosition(pos.ticket, newSL, newTP);
        if (result?.status === 'success') {
          log(`SL/TP aplicado: ${pos.symbol} ticket #${pos.ticket} | SL: ${newSL} | TP: ${newTP}`, accountId);
          io.emit('auto-trade-log', {
            time: Date.now(),
            action: 'modify',
            pair: pos.symbol,
            ticket: pos.ticket,
            sl: newSL,
            tp: newTP,
            source: 'auto_sl_tp',
            accountId,
          });
        }
      }
    }
  } catch (err) {
    log(`Erro ao verificar SL/TP: ${err.message}`, accountId);
  }
}

async function callLLMDirect(pair, priceData, accountInfo, riskSettings, openPositions) {
  const settings = loadSettings();
  const provider = settings.provider || 'openrouter';
  const apiKey = settings.apiKeys?.[provider] || '';
  const model = settings.model || 'openrouter/free';

  if (provider !== 'ollama' && !apiKey) return null;

  const strategy = settings.strategy || 'ict_smc';
  const systemPrompt = await getStrategyPrompt(strategy, riskSettings, undefined, pair);
  const marketData = await buildTradeAnalysisPrompt(pair, priceData, accountInfo, riskSettings, openPositions?.length || 0);

  try {
    const llmResponse = await callLLM(provider, apiKey, model, systemPrompt, marketData);
    if (!llmResponse) return null;
    return parseLLMResponse(llmResponse);
  } catch (e) {
    log(`LLM erro ${pair}: ${e.message}`);
    return null;
  }
}

async function executeAccountTrade(accountId, bridge, accountState, riskSettings, lotSettings, pairs, globalAI, io) {
  const accountInfo = await bridge.getAccountInfo();
  if (!accountInfo?.connected) {
    log('MT5 desconectado', accountId);
    return;
  }

  accountState.accountInfo = accountInfo;
  const openPositions = await bridge.getPositions();
  accountState.openPositions = openPositions;

  await ensurePositionsHaveSLTP(bridge, riskSettings, io, accountId);

  for (const pair of pairs) {
    try {
      const priceData = accountState.priceData[pair];
      if (!priceData || priceData.length < 30) continue;

      const closes = priceData.map(d => typeof d.close === 'number' ? d.close : (typeof d === 'number' ? d : 0));
      const techSignal = technicalIndicators.analyzeSignals(priceData);
      const memoryRec = tradingMemory.getRecommendation(closes.slice(-20));

      for (const price of closes.slice(-5)) {
        globalAI.processMarketData(price);
      }
      const aiDecision = globalAI.analyzeMarket();

      let finalAction = 'wait';
      let finalConfidence = 0;
      let signalSource = '';
      let llmAnalysis = null;

      const llmSettings = loadSettings();
      const useLLM = llmSettings.provider && (llmSettings.apiKeys?.[llmSettings.provider] || llmSettings.provider === 'ollama');

      if (useLLM) {
        io.emit('llm-analyzing', { pair, accountId });
        llmAnalysis = await callLLMDirect(pair, priceData, accountInfo, riskSettings, openPositions);
        if (llmAnalysis) {
          addToHistory({
            time: Date.now(),
            pair,
            action: llmAnalysis.action,
            confidence: llmAnalysis.confidence || 0.5,
            reason: llmAnalysis.reason || '',
            entry_price: llmAnalysis.entry_price,
            stop_loss: llmAnalysis.stop_loss,
            take_profit: llmAnalysis.take_profit,
            status: llmAnalysis.action !== 'wait' ? 'auto_trade' : 'auto_analysis',
            auto: true,
            accountId,
          });
          io.emit('llm-analysis', { pair, analysis: llmAnalysis, time: Date.now(), accountId });
          if (llmAnalysis.action !== 'wait' && (llmAnalysis.confidence || 0) >= 0.6) {
            finalAction = llmAnalysis.action;
            finalConfidence = llmAnalysis.confidence;
            signalSource = 'LLM';
            log(`${pair}: LLM - ${llmAnalysis.action.toUpperCase()} (${(llmAnalysis.confidence * 100).toFixed(0)}%)`, accountId);
          }
        }
      }

      if (finalAction === 'wait') {
        if (aiDecision.action !== 'wait' && aiDecision.confidence >= globalAI.minConfidence) {
          finalAction = aiDecision.action;
          finalConfidence = aiDecision.confidence;
          signalSource = 'AI Agent';
        } else if (techSignal.signal !== 'neutral' && techSignal.score >= 0.6) {
          finalAction = techSignal.signal;
          finalConfidence = techSignal.score;
          signalSource = 'Technical Indicators';
        } else if (memoryRec.action !== 'wait' && memoryRec.confidence >= 0.5) {
          finalAction = memoryRec.action;
          finalConfidence = memoryRec.confidence;
          signalSource = 'Trading Memory';
        }
      }

      if (finalAction === 'close' || (aiDecision.action === 'close' && globalAI.currentPosition)) {
        const posToClose = openPositions.find(p => p.symbol === pair);
        if (posToClose) {
          log(`Fechando ${pair} ticket #${posToClose.ticket} - ${signalSource}`, accountId);
          const result = await bridge.closePosition(posToClose.ticket);
          if (result?.status === 'success') {
            const profit = posToClose.profit || 0;
            accountState.tradeHistory.push({
              symbol: pair,
              type: posToClose.type === 0 ? 'SELL' : 'BUY',
              volume: posToClose.volume,
              price: posToClose.price_open,
              exitPrice: posToClose.price_current,
              ticket: posToClose.ticket,
              time: Date.now(),
              profit,
              source: 'auto_close',
              accountId,
            });
            globalAI.closePosition(posToClose.price_current);
            tradingMemory.recordPattern(closes.slice(-20), 'close', profit, pair);
            log(`Posicao fechada P/L: ${profit.toFixed(2)}`, accountId);
            io.emit('auto-trade-log', { time: Date.now(), action: 'close', pair, profit, source: signalSource, accountId });
          }
        }
        continue;
      }

      if (finalAction === 'buy' || finalAction === 'sell') {
        if (!checkPositionLimits(riskSettings, openPositions)) continue;
        if (!checkDailyLossLimit(riskSettings, accountState.tradeHistory, accountInfo)) continue;
        if (!checkDailyTradeLimit(riskSettings, accountState.tradeHistory)) continue;
        if (hasOpenPosition(openPositions, pair, finalAction)) continue;

        const currentPrice = closes[closes.length - 1];

        let entryPrice = currentPrice;
        let slPips = riskSettings.ifvg_stop_loss || 50;
        let tpPips = riskSettings.ifvg_take_profit || (slPips * (riskSettings.risk_reward_ratio || 2));

        if (signalSource === 'LLM' && llmAnalysis) {
          if (llmAnalysis.entry_price && llmAnalysis.entry_price > 0) entryPrice = llmAnalysis.entry_price;
          if (llmAnalysis.stop_loss && llmAnalysis.stop_loss > 0) slPips = llmAnalysis.stop_loss;
          if (llmAnalysis.take_profit && llmAnalysis.take_profit > 0) tpPips = llmAnalysis.take_profit;
          log(`${pair}: Valores LLM - Entry: ${entryPrice} SL: ${slPips}pips TP: ${tpPips}pips`, accountId);
        }

        const symInfo = await bridge.getSymbolInfo(pair);
        const volume = normalizeVolume(calculateLotSize(lotSettings, accountInfo, pair, slPips, entryPrice), symInfo);
        const point = symInfo?.point || (getSymbolType(pair) === 'metal' ? 0.01 : 0.0001);
        const stopLevel = symInfo?.trade_stop_level || 0;
        const decimals = symInfo?.digits ?? getDecimals(pair);
        const symType = getSymbolType(pair);
        let slDistance, tpDistance;
        if (symType === 'metal') {
          slDistance = Math.max(slPips / getPipDivisor(pair), stopLevel * point, point * 10);
          tpDistance = Math.max(tpPips / getPipDivisor(pair), stopLevel * point, point * 10);
        } else {
          const slPct = slPips / getSLDivisor(pair);
          slDistance = Math.max(entryPrice * slPct, stopLevel * point, point * 100);
          tpDistance = Math.max(entryPrice * slPct * (riskSettings.risk_reward_ratio || 2), stopLevel * point, point * 100);
        }

        const slValue = finalAction === 'buy'
            ? +(entryPrice - slDistance).toFixed(decimals)
            : +(entryPrice + slDistance).toFixed(decimals);
        const tpValue = finalAction === 'buy'
            ? +(entryPrice + tpDistance).toFixed(decimals)
            : +(entryPrice - tpDistance).toFixed(decimals);
        const needsDeferredSLTP = symType === 'synthetic' || symType === 'crypto';
        const order = {
          symbol: pair,
          type: finalAction,
          volume,
          stop_loss: needsDeferredSLTP ? 0 : slValue,
          take_profit: needsDeferredSLTP ? 0 : tpValue,
          comment: `LLM:${strategy}`,
        };

        log(`Executando ${finalAction.toUpperCase()} ${pair} | Vol: ${volume} | Conf: ${(finalConfidence * 100).toFixed(1)}% | ${signalSource}`, accountId);

        const result = await bridge.sendOrder(order);

        if (result?.status === 'success') {
          if (needsDeferredSLTP && slValue > 0 && tpValue > 0) {
            try {
              const modResult = await bridge.modifyPosition(result.ticket, slValue, tpValue);
              if (modResult?.status === 'success') {
                log(`SL/TP aplicado: ${pair} #${result.ticket} | SL: ${slValue} | TP: ${tpValue}`, accountId);
              } else {
                log(`SL/TP modify falhou para ${pair}: ${modResult?.message || 'erro'}`, accountId);
              }
            } catch (e) {
              log(`Erro SL/TP para ${pair}: ${e.message}`, accountId);
            }
          }
          accountState.tradeHistory.push({
            symbol: pair,
            type: finalAction.toUpperCase(),
            volume,
            price: result.price || 0,
            ticket: result.ticket,
            time: Date.now(),
            profit: 0,
            source: 'auto_trade',
            confidence: finalConfidence,
            signalSource,
            accountId,
          });

          globalAI.setPosition(finalAction, result.price || 0);
          tradingMemory.recordPattern(closes.slice(-20), finalAction, 0, pair);

          log(`Ordem executada: ${finalAction.toUpperCase()} ${pair} @ ${result.price} | #${result.ticket}`, accountId);
          io.emit('auto-trade-log', {
            time: Date.now(), action: finalAction, pair, price: result.price,
            ticket: result.ticket, volume, source: signalSource, confidence: finalConfidence, accountId,
          });
        } else {
          log(`Falha ${pair}: ${result?.message || result?.error || JSON.stringify(result)}`, accountId);
        }
      }
    } catch (err) {
      log(`Erro ${pair}: ${err.message}`, accountId);
    }
  }
}

let multiAutoTradeInterval = null;

export function startMultiAutoTrader(globalState, io, intervalMs = 30000) {
  if (multiAutoTradeInterval) {
    log('Multi auto-trader ja esta rodando');
    return;
  }

  const globalAI = aiAgent;
  const pairs = globalState.pairs || DEFAULT_PAIRS;

  log(`Iniciando multi auto-trader (intervalo: ${intervalMs / 1000}s, contas ativas)`);

  multiAutoTradeInterval = setInterval(async () => {
    for (const account of multiAccountManager.accounts) {
      if (!account.enabled) continue;

      const bridge = multiAccountManager.getBridge(account.id);
      const state = multiAccountManager.getState(account.id);
      if (!bridge || !state) continue;

      const riskSettings = { ...globalState.riskSettings, ...account.riskSettings };
      const lotSettings = { ...globalState.lotSettings, ...account.lotSettings };

      if (!isTradingAllowed(riskSettings)) continue;

      try {
        await executeAccountTrade(account.id, bridge, state, riskSettings, lotSettings, pairs, globalAI, io);
      } catch (err) {
        log(`Erro na conta ${account.id}: ${err.message}`);
      }
    }
  }, intervalMs);

  (async () => {
    for (const account of multiAccountManager.accounts) {
      if (!account.enabled) continue;
      const bridge = multiAccountManager.getBridge(account.id);
      const state = multiAccountManager.getState(account.id);
      if (!bridge || !state) continue;

      const riskSettings = { ...globalState.riskSettings, ...account.riskSettings };
      const lotSettings = { ...globalState.lotSettings, ...account.lotSettings };

      if (!isTradingAllowed(riskSettings)) continue;

      try {
        await executeAccountTrade(account.id, bridge, state, riskSettings, lotSettings, pairs, globalAI, io);
      } catch (err) {
        log(`Erro ciclo inicial ${account.id}: ${err.message}`);
      }
    }
  })();
}

export function stopMultiAutoTrader() {
  if (multiAutoTradeInterval) {
    clearInterval(multiAutoTradeInterval);
    multiAutoTradeInterval = null;
    log('Multi auto-trader parado');
  }
}

export function isMultiAutoTraderRunning() {
  return multiAutoTradeInterval !== null;
}
