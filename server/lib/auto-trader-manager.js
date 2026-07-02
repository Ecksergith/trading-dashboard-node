import { mt5Bridge } from './mt5-bridge.js';
import { aiAgent } from './ai-agent.js';
import { technicalIndicators } from './technical-indicators.js';
import { tradingMemory } from './trading-memory.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStrategyPrompt, buildTradeAnalysisPrompt, buildPositionManagementPrompt, callLLM, parseLLMResponse, parsePositionManagementResponse, addToHistory } from './llm-engine.js';
import { calculateLotSize, normalizeVolume, getPipDivisor, getSLDivisor, getDecimals, formatPrice, getSymbolType, loadJSON, saveJSON, DEFAULT_PAIRS } from './constants.js';
import { createLogger, pushLog } from './logger.js';
import { getUserState, updateUserState, createTrade as dbCreateTrade, closeTrade as dbCloseTrade, getTrades, getTradeMemoryStats } from './db.js';
import { getAdaptiveThreshold, recordAnalysisOutcome, getBestStrategyForPair } from './llm-self-improve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');

const LOG_PREFIX = '[AutoTrader]';
const log = createLogger(LOG_PREFIX);

const sharedMarketData = { priceData: {}, accountInfo: null, openPositions: [] };
const userInstances = new Map();
const symbolLocks = new Map();

export function updateSharedMarketData(data) {
  if (data.priceData) sharedMarketData.priceData = data.priceData;
  if (data.accountInfo) sharedMarketData.accountInfo = data.accountInfo;
  if (data.openPositions) sharedMarketData.openPositions = data.openPositions;
}

async function withSymbolLock(symbol, fn) {
  while (symbolLocks.get(symbol)) await new Promise(r => setTimeout(r, 100));
  symbolLocks.set(symbol, true);
  try { return await fn(); } finally { symbolLocks.delete(symbol); }
}

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
  if (openPositions.length >= maxPositions) {
    log(`Limite de posicoes atingido (${openPositions.length}/${maxPositions})`);
    return false;
  }
  return true;
}

function checkDailyLossLimit(riskSettings, tradeHistory, accountInfo) {
  if (!riskSettings.max_loss_per_day_enabled) return true;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTrades = tradeHistory.filter(t => t.time >= todayStart.getTime());
  const dailyPnL = todayTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
  const balance = accountInfo?.balance || 0;
  if (riskSettings.max_loss_pct_enabled && balance > 0) {
    const maxLossDollar = balance * ((riskSettings.max_loss_per_day_pct || 5) / 100);
    if (dailyPnL < -maxLossDollar) {
      log(`Limite de perda diaria (%): $${dailyPnL.toFixed(2)} (${((dailyPnL / balance) * 100).toFixed(2)}% do saldo $${balance.toFixed(2)})`);
      return false;
    }
  } else if (!riskSettings.max_loss_pct_enabled) {
    const maxLossPerDay = riskSettings.max_loss_per_day || 100;
    if (dailyPnL < -maxLossPerDay) {
      log(`Limite de perda diaria ($): $${dailyPnL.toFixed(2)} / -$${maxLossPerDay}`);
      return false;
    }
  }
  return true;
}

function checkDailyTradeLimit(riskSettings, tradeHistory) {
  const maxTrades = riskSettings.trade_per_day || 10;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTrades = tradeHistory.filter(t => t.time >= todayStart.getTime());
  if (todayTrades.length >= maxTrades) {
    log(`Limite de operacoes diarias atingido (${todayTrades.length}/${maxTrades})`);
    return false;
  }
  return true;
}

function hasOpenPosition(openPositions, pair, type) {
  return openPositions.some(p =>
    p.symbol === pair && (p.type === type || p.type === type.toUpperCase())
  );
}

function getLatestLLMAnalysis(pair) {
  try {
    const historyPath = join(DATA_DIR, 'llm_analysis_history.json');
    if (!existsSync(historyPath)) return null;
    const history = JSON.parse(readFileSync(historyPath, 'utf8'));
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].pair === pair) return history[i];
    }
  } catch {}
  return null;
}

async function callLLMDirect(pair, priceData, accountInfo, riskSettings, openPositions, aiAgentSettings, userId) {
  const provider = aiAgentSettings.provider || 'openrouter';
  const apiKey = aiAgentSettings.apiKeys?.[provider] || '';
  const model = aiAgentSettings.model || 'openrouter/free';
  if (provider !== 'ollama' && !apiKey) return null;
  const strategy = aiAgentSettings.strategy || 'ict_smc';
  const systemPrompt = await getStrategyPrompt(strategy, riskSettings, undefined, pair, userId);
  const marketData = await buildTradeAnalysisPrompt(pair, priceData, accountInfo, riskSettings, openPositions?.length || 0, userId);
  try {
    const llmResponse = await callLLM(provider, apiKey, model, systemPrompt, marketData);
    if (!llmResponse) return null;
    const parsed = parseLLMResponse(llmResponse);
    parsed._strategy = strategy;
    return parsed;
  } catch (e) {
    log(`${pair}: Erro LLM: ${e.message}`);
    return null;
  }
}

async function processPairForUser(userId, pair, io, accountInfo, openPositions, userState) {
  const priceData = sharedMarketData.priceData[pair];
  if (!priceData || priceData.length < 30) { log(`[${userId}] ${pair}: Dados insuficientes (${priceData?.length || 0}/30 candles)`); return; }
  const closes = priceData.map(d => typeof d.close === 'number' ? d.close : (typeof d === 'number' ? d : 0)).filter(v => v > 0);
  const techSignal = technicalIndicators.analyzeSignals(priceData);
  const memoryRec = tradingMemory.getRecommendation(closes.slice(-20));
  for (const price of closes.slice(-5)) { aiAgent.processMarketData(price); }
  const aiDecision = aiAgent.analyzeMarket();
  let finalAction = 'wait';
  let finalConfidence = 0;
  let signalSource = '';
  let llmAnalysis = null;
  const adaptiveThreshold = getAdaptiveThreshold();
  const llmSettings = userState.aiAgentSettings || {};
  const provider = llmSettings.provider || 'openrouter';
  const apiKey = llmSettings.apiKeys?.[provider] || '';
  const useLLMDirect = provider && (apiKey || provider === 'ollama');
  if (useLLMDirect) {
    io.to(`user:${userId}`).emit('llm-analyzing', { pair });
    llmAnalysis = await callLLMDirect(pair, priceData, accountInfo, userState.riskSettings, openPositions, llmSettings, userId);
    if (llmAnalysis) {
      addToHistory({ time: Date.now(), pair, action: llmAnalysis.action, confidence: llmAnalysis.confidence || 0.5, reason: llmAnalysis.reason || '', entry_price: llmAnalysis.entry_price, stop_loss: llmAnalysis.stop_loss, take_profit: llmAnalysis.take_profit, status: llmAnalysis.action !== 'wait' ? 'auto_trade' : 'auto_analysis', auto: true });
      io.to(`user:${userId}`).emit('llm-analysis', { pair, analysis: llmAnalysis, time: Date.now() });
      if (llmAnalysis.action !== 'wait' && (llmAnalysis.confidence || 0) >= adaptiveThreshold) {
        finalAction = llmAnalysis.action;
        finalConfidence = llmAnalysis.confidence;
        signalSource = 'LLM';
        log(`[${userId}] ${pair}: LLM direto - ${llmAnalysis.action.toUpperCase()} (${(llmAnalysis.confidence * 100).toFixed(0)}%) [threshold: ${(adaptiveThreshold * 100).toFixed(0)}%]`);
      } else {
        log(`[${userId}] ${pair}: LLM direto - ${llmAnalysis.action.toUpperCase()} (${(llmAnalysis.confidence * 100).toFixed(0)}%) abaixo do threshold adaptativo (${(adaptiveThreshold * 100).toFixed(0)}%)`);
      }
    }
  } else {
    llmAnalysis = getLatestLLMAnalysis(pair);
    if (llmAnalysis && llmAnalysis.action !== 'wait' && (llmAnalysis.confidence || 0) >= adaptiveThreshold) {
      const analysisAge = Date.now() - (llmAnalysis.time || 0);
      if (analysisAge < 900000) {
        finalAction = llmAnalysis.action;
        finalConfidence = llmAnalysis.confidence;
        signalSource = 'LLM';
        log(`[${userId}] ${pair}: Sinal LLM historico - ${llmAnalysis.action.toUpperCase()} (${(llmAnalysis.confidence * 100).toFixed(0)}%) idade: ${(analysisAge / 60000).toFixed(1)}min`);
      }
    }
  }
  if (finalAction === 'buy' || finalAction === 'sell') {
    const tradeHistory = await getTrades(userId, 1000);
    const llmPositions = openPositions.filter(p => {
      const hist = tradeHistory.find(t => String(t.ticket) === String(p.ticket));
      return hist && hist.source === 'auto_trade' && hist.signal_source === 'LLM';
    });
    const maxLlm = userState.riskSettings.max_llm_positions || 5;
    if (llmPositions.length >= maxLlm) {
      log(`[${userId}] ${pair}: Limite LLM atingido (${llmPositions.length}/${maxLlm}), nenhuma ordem aberta`);
      return;
    }
  }
  if (finalAction === 'wait') {
    if (aiDecision.action !== 'wait' && aiDecision.confidence >= aiAgent.minConfidence) {
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
    } else {
      log(`[${userId}] ${pair}: Nenhum sinal ativo (LLM: ${llmAnalysis?.action || 'wait'}, AI: ${aiDecision.action}, Tech: ${techSignal.signal})`);
    }
  }
  if (finalAction === 'close') {
    const posToClose = openPositions.find(p => p.symbol === pair);
    if (posToClose) {
      log(`[${userId}] Fechando posicao ${pair} ticket #${posToClose.ticket} - Sinal: ${signalSource}`);
      const result = await mt5Bridge.closePosition(posToClose.ticket);
      if (result?.status === 'success') {
        const profit = posToClose.profit || 0;
        await dbCloseTrade(userId, posToClose.ticket, posToClose.price_current, profit);
        aiAgent.closePosition(posToClose.price_current);
        tradingMemory.recordPattern(closes.slice(-20), 'close', profit, pair);
        const tradeHistory = await getTrades(userId, 1000);
        const originalTrade = tradeHistory.find(t => String(t.ticket) === String(posToClose.ticket));
        if (originalTrade?.signal_source === 'LLM') {
          const wasCorrect = profit > 0;
          recordAnalysisOutcome(pair, originalTrade.source || 'auto_trade', originalTrade.type, originalTrade.confidence || 0.5, wasCorrect, profit);
          log(`[${userId}] Self-improve: ${pair} ${originalTrade.type} ${wasCorrect ? 'WIN' : 'LOSS'} $${profit.toFixed(2)} registrado`);
        }
        log(`[${userId}] Posicao fechada com lucro: ${profit.toFixed(2)}`);
        io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'close', pair, profit, source: signalSource });
        io.to(`user:${userId}`).emit('trade-history-update', await getTrades(userId, 500));
        const freshPositions = await mt5Bridge.getPositions();
        io.to(`user:${userId}`).emit('market-update', { positions: freshPositions });
      }
    }
    return;
  }
  if (finalAction === 'buy' || finalAction === 'sell') {
    if (!checkPositionLimits(userState.riskSettings, openPositions)) { log(`[${userId}] ${pair}: Bloqueado - limite de posicoes`); return; }
    const tradeHistory = await getTrades(userId, 1000);
    if (!checkDailyLossLimit(userState.riskSettings, tradeHistory, accountInfo)) { log(`[${userId}] ${pair}: Bloqueado - limite de perda diaria`); return; }
    if (!checkDailyTradeLimit(userState.riskSettings, tradeHistory)) { log(`[${userId}] ${pair}: Bloqueado - limite de operacoes diarias`); return; }
    if (userState.riskSettings.one_position_per_pair && openPositions.some(p => p.symbol === pair)) {
      log(`[${userId}] ${pair}: Bloqueado - ja existe posicao neste par`);
      return;
    }
    if (hasOpenPosition(openPositions, pair, finalAction)) {
      log(`[${userId}] ${pair}: Ja existe posicao ${finalAction}, ignorando`);
      return;
    }
    log(`[${userId}] ${pair}: Sinal ${finalAction.toUpperCase()} Confirmado | Fonte: ${signalSource} | Conf: ${(finalConfidence * 100).toFixed(0)}%`);
    const currentPrice = closes[closes.length - 1];
    let entryPrice = currentPrice;
    let slPips = userState.riskSettings.ifvg_stop_loss || 50;
    let tpPips = userState.riskSettings.ifvg_take_profit || (slPips * (userState.riskSettings.risk_reward_ratio || 2));
    if (signalSource === 'LLM' && llmAnalysis) {
      if (llmAnalysis.entry_price && llmAnalysis.entry_price > 0) entryPrice = llmAnalysis.entry_price;
      if (llmAnalysis.stop_loss && llmAnalysis.stop_loss > 0) slPips = llmAnalysis.stop_loss;
      if (llmAnalysis.take_profit && llmAnalysis.take_profit > 0) tpPips = llmAnalysis.take_profit;
      log(`[${userId}] ${pair}: Usando valores LLM - Entry: ${entryPrice} SL: ${slPips}pips TP: ${tpPips}pips`);
    }
    let volume = calculateLotSize(userState.lotSettings, accountInfo, pair, slPips, entryPrice);
    const symInfo = await mt5Bridge.getSymbolInfo(pair);
    let point = symInfo?.point || (getSymbolType(pair) === 'forex_jpy' ? 0.01 : getSymbolType(pair) === 'forex' ? 0.0001 : getSymbolType(pair) === 'metal' ? 0.01 : 0.01);
    let stopLevel = 0;
    let decimals = getDecimals(pair);
    if (symInfo?.exists) {
      point = parseFloat(symInfo.point) || point;
      stopLevel = parseInt(symInfo.trade_stop_level) || 0;
      decimals = symInfo.digits ?? decimals;
    }
    const rawVolume = volume;
    volume = normalizeVolume(volume, symInfo);
    const aggressiveness = (userState.aiAgentSettings || {}).aggressiveness;
    const symType = getSymbolType(pair);
    let slDistance, tpDistance, slPct;
    if (symType === 'metal') {
      slPct = 0;
      slDistance = Math.max(slPips / getPipDivisor(pair), stopLevel * point, point * 10);
      tpDistance = Math.max(tpPips / getPipDivisor(pair), stopLevel * point, point * 10);
    } else {
      slPct = slPips / getSLDivisor(pair, aggressiveness);
      slDistance = Math.max(entryPrice * slPct, stopLevel * point, point * 100);
      tpDistance = Math.max(entryPrice * slPct * (userState.riskSettings.risk_reward_ratio || 2), stopLevel * point, point * 100);
    }
    log(`[${userId}] ${pair}: vol=${volume} entry=${entryPrice} slPct=${(slPct*100).toFixed(2)}% slDist=${slDistance.toFixed(decimals)} tpDist=${tpDistance.toFixed(decimals)} point=${point}`);
    const slValue = finalAction === 'buy' ? +(entryPrice - slDistance).toFixed(decimals) : +(entryPrice + slDistance).toFixed(decimals);
    const tpValue = finalAction === 'buy' ? +(entryPrice + tpDistance).toFixed(decimals) : +(entryPrice - tpDistance).toFixed(decimals);
    const needsDeferredSLTP = symType === 'synthetic' || symType === 'crypto';
    const strategyLabel = llmAnalysis?._strategy || signalSource || 'unknown';
    const order = {
      symbol: pair, type: finalAction, volume,
      stop_loss: needsDeferredSLTP ? 0 : slValue,
      take_profit: needsDeferredSLTP ? 0 : tpValue,
      comment: `LLM:${strategyLabel}`,
    };
    log(`[${userId}] Executando ${finalAction.toUpperCase()} ${pair} | Volume: ${volume} | Confianca: ${(finalConfidence * 100).toFixed(1)}% | Fonte: ${signalSource}`);
    const result = await withSymbolLock(pair, () => mt5Bridge.sendOrder(order));
    if (result?.status === 'success') {
      if (needsDeferredSLTP && slValue > 0 && tpValue > 0) {
        try {
          const modResult = await mt5Bridge.modifyPosition(result.ticket, slValue, tpValue);
          if (modResult?.status === 'success') {
            log(`[${userId}] SL/TP aplicado: ${pair} #${result.ticket} | SL: ${slValue} | TP: ${tpValue}`);
          } else {
            log(`[${userId}] SL/TP via modify falhou para ${pair}: ${modResult?.message || 'erro'}. ensurePositionsHaveSLTP ira tentar no proximo ciclo.`);
          }
        } catch (e) {
          log(`[${userId}] Erro ao aplicar SL/TP para ${pair}: ${e.message}`);
        }
      }
      const marketContext = JSON.stringify({
        pair,
        price: closes[closes.length - 1],
        change: ((closes[closes.length - 1] - closes[0]) / Math.max(closes[0], 0.00001)).toFixed(4),
        signalSource,
        confidence: finalConfidence,
      });
      await dbCreateTrade(userId, { symbol: pair, type: finalAction.toUpperCase(), volume, price: result.price || 0, ticket: result.ticket, profit: 0, source: 'auto_trade', confidence: finalConfidence, signalSource, reason: llmAnalysis?.reason || '', marketContext, strategy: strategyLabel });
      aiAgent.setPosition(finalAction, result.price || 0);
      tradingMemory.recordPattern(closes.slice(-20), finalAction, 0, pair);
      log(`[${userId}] Ordem executada: ${finalAction.toUpperCase()} ${pair} @ ${result.price} | Ticket: #${result.ticket}`);
      io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: finalAction, pair, price: result.price, ticket: result.ticket, volume, source: signalSource, confidence: finalConfidence });
      io.to(`user:${userId}`).emit('trade-history-update', await getTrades(userId, 500));
      const freshPositions = await mt5Bridge.getPositions();
      io.to(`user:${userId}`).emit('market-update', { positions: freshPositions });
    } else {
      log(`[${userId}] Falha ao executar ordem ${pair}: ${result?.message || result?.error || JSON.stringify(result)}`);
    }
  }
}

async function autoCloseOrdersOnFriday(userId, io, instance) {
  const userState = await getUserState(userId);
  if (!userState?.riskSettings?.auto_close_orders) return;
  const now = new Date();
  if (now.getDay() !== 5) return;
  const todayKey = now.toISOString().slice(0, 10);
  if (instance.lastAutoCloseDate === todayKey) return;
  const closeTime = userState.riskSettings.auto_close_time || '22:30';
  const [targetH, targetM] = closeTime.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes < targetH * 60 + targetM) return;
  instance.lastAutoCloseDate = todayKey;
  const openPositions = await mt5Bridge.getPositions();
  if (!openPositions || openPositions.length === 0) { log(`[${userId}] Auto-fechamento Sexta: nenhuma posicao aberta`); return; }
  log(`[${userId}] Auto-fechamento Sexta: fechando ${openPositions.length} posicoes...`);
  for (const pos of openPositions) {
    try {
      const result = await mt5Bridge.closePosition(pos.ticket);
      if (result?.status === 'success') {
        const profit = pos.profit || 0;
        await dbCloseTrade(userId, pos.ticket, pos.price_current, profit);
        log(`[${userId}] Posicao fechada: ${pos.symbol} #${pos.ticket} P/L: $${profit.toFixed(2)}`);
        io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'close', pair: pos.symbol, ticket: pos.ticket, profit, source: 'auto_close_friday' });
      }
    } catch (err) {
      log(`[${userId}] Erro ao fechar ${pos.symbol} #${pos.ticket}: ${err.message}`);
    }
  }
  io.to(`user:${userId}`).emit('trade-history-update', await getTrades(userId, 500));
  log(`[${userId}] Auto-fechamento Sexta concluido`);
}

async function ensurePositionsHaveSLTP(userId, userState, io, existingPositions) {
  const riskSettings = userState.riskSettings || {};
  const aggressiveness = (userState.aiAgentSettings || {}).aggressiveness;
  try {
    const openPositions = existingPositions || await mt5Bridge.getPositions();
    if (!openPositions || openPositions.length === 0) return;
    for (const pos of openPositions) {
      const currentSL = pos.stop_loss ?? pos.sl ?? 0;
      const currentTP = pos.take_profit ?? pos.tp ?? 0;
      if (currentSL > 0 && currentTP > 0) continue;
      const slPips = riskSettings.ifvg_stop_loss || 50;
      const tpPips = riskSettings.ifvg_take_profit || (slPips * (riskSettings.risk_reward_ratio || 2));
      const symInfo = await mt5Bridge.getSymbolInfo(pos.symbol);
      const point = symInfo?.point || (getSymbolType(pos.symbol) === 'forex_jpy' ? 0.01 : getSymbolType(pos.symbol) === 'forex' ? 0.0001 : 0.01);
      const stopLevel = symInfo?.trade_stop_level || 0;
      const decimals = symInfo?.digits ?? getDecimals(pos.symbol);
      const openPrice = pos.open_price ?? pos.price_open ?? pos.price_current ?? 0;
      const posSymType = getSymbolType(pos.symbol);
      let slDistance, tpDistance;
      if (posSymType === 'metal') {
        slDistance = Math.max(slPips / getPipDivisor(pos.symbol), stopLevel * point, point * 10);
        tpDistance = Math.max(tpPips / getPipDivisor(pos.symbol), stopLevel * point, point * 10);
      } else {
        const slPct = slPips / getSLDivisor(pos.symbol, aggressiveness);
        slDistance = Math.max(openPrice * slPct, stopLevel * point, point * 100);
        tpDistance = Math.max(openPrice * slPct * (riskSettings.risk_reward_ratio || 2), stopLevel * point, point * 100);
      }
      let newSL = currentSL;
      let newTP = currentTP;
      if (currentSL === 0) { newSL = pos.type === 0 ? +(openPrice - slDistance).toFixed(decimals) : +(openPrice + slDistance).toFixed(decimals); }
      if (currentTP === 0) { newTP = pos.type === 0 ? +(openPrice + tpDistance).toFixed(decimals) : +(openPrice - tpDistance).toFixed(decimals); }
      if (newSL > 0 && newTP > 0) {
        const result = await mt5Bridge.modifyPosition(pos.ticket, newSL, newTP);
        if (result?.status === 'success') {
          log(`[${userId}] SL/TP aplicado: ${pos.symbol} ticket #${pos.ticket} | SL: ${newSL} | TP: ${newTP}`);
          io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'modify', pair: pos.symbol, ticket: pos.ticket, sl: newSL, tp: newTP, source: 'auto_sl_tp' });
        }
      }
    }
  } catch (err) {
    log(`[${userId}] Erro ao verificar SL/TP: ${err.message}`);
  }
}

async function protectPositionsWithLLM(userId, io, instance, openPositions) {
  const userState = await getUserState(userId);
  if (!userState?.riskSettings?.llm_position_protection) return;
  const intervalMs = (userState.riskSettings.llm_protection_interval || 60) * 1000;
  if (Date.now() - instance.lastProtectionTime < intervalMs) return;
  instance.lastProtectionTime = Date.now();
  if (!openPositions || openPositions.length === 0) return;
  const llmSettings = userState.aiAgentSettings || {};
  const provider = llmSettings.provider;
  const apiKey = llmSettings.apiKeys?.[provider];
  const model = llmSettings.model;
  if (!provider || (!apiKey && provider !== 'ollama') || !model) return;
  for (const pos of openPositions) {
    try {
      const priceData = await mt5Bridge.getRates(pos.symbol, 'M5');
      if (!priceData || priceData.length === 0) continue;
      const prompt = buildPositionManagementPrompt(pos, priceData);
      const systemPrompt = 'Voce e um gerenciador de posicoes profissional. Responda APENAS com JSON valido.';
      const llmResponse = await callLLM(provider, apiKey, model, systemPrompt, prompt);
      const parsed = parsePositionManagementResponse(llmResponse);
      if (!parsed || parsed.action === 'hold') continue;
      log(`[${userId}] LLM protecao: ${pos.symbol} ticket #${pos.ticket} → ${parsed.action} (${parsed.reason || ''})`);
      if (parsed.action === 'close') {
        if (userState.riskSettings.llm_allow_close === false) { log(`[${userId}] ${pos.symbol}: Acao fechamento bloqueada`); continue; }
        const result = await mt5Bridge.closePosition(pos.ticket);
        if (result?.status === 'success') {
          log(`[${userId}] Posicao fechada por LLM: ${pos.symbol} ticket #${pos.ticket}`);
          io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'close', pair: pos.symbol, ticket: pos.ticket, source: 'llm_protection' });
        }
      } else if (parsed.action === 'move_sl_breakeven' || parsed.action === 'move_sl_profit') {
        if (userState.riskSettings.llm_allow_breakeven === false || userState.riskSettings.llm_allow_move_sl_profit === false) { log(`[${userId}] ${pos.symbol}: Acao SL bloqueada`); continue; }
        const newSL = parsed.new_sl || (pos.open_price ?? pos.price_open);
        const result = await mt5Bridge.modifyPosition(pos.ticket, newSL, (pos.take_profit ?? pos.tp ?? 0));
        if (result?.status === 'success') {
          log(`[${userId}] SL ajustado por LLM: ${pos.symbol} ticket #${pos.ticket} → SL: ${newSL}`);
          io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'modify', pair: pos.symbol, ticket: pos.ticket, sl: newSL, source: 'llm_protection' });
        }
      } else if (parsed.action === 'partial_close') {
        if (userState.riskSettings.llm_allow_partial_close === false) { log(`[${userId}] ${pos.symbol}: Acao fechamento parcial bloqueada`); continue; }
        const closeVolume = Math.max((pos.volume / 2).toFixed(2), 0.01);
        const result = await mt5Bridge.closePosition(pos.ticket, closeVolume);
        if (result?.status === 'success') {
          log(`[${userId}] Fechamento parcial por LLM: ${pos.symbol} ticket #${pos.ticket} (${closeVolume} lots)`);
          io.to(`user:${userId}`).emit('auto-trade-log', { time: Date.now(), action: 'partial_close', pair: pos.symbol, ticket: pos.ticket, volume: closeVolume, source: 'llm_protection' });
        }
      }
    } catch (err) {
      log(`[${userId}] Erro na protecao LLM para ${pos.symbol}: ${err.message}`);
    }
  }
}

async function executeAutoTradeForUser(userId, io, instance) {
  await autoCloseOrdersOnFriday(userId, io, instance);
  const userState = await getUserState(userId);
  if (!userState) return;
  if (!isTradingAllowed(userState.riskSettings)) return;
  const accountInfo = sharedMarketData.accountInfo;
  if (!accountInfo?.connected) { log(`[${userId}] MT5 desconectado, abortando ciclo`); return; }
  const openPositions = sharedMarketData.openPositions;
  await ensurePositionsHaveSLTP(userId, userState, io, openPositions);
  await protectPositionsWithLLM(userId, io, instance, openPositions);
  const pairs = userState.pairs || DEFAULT_PAIRS;
  await Promise.allSettled(pairs.map(pair => processPairForUser(userId, pair, io, accountInfo, openPositions, userState)));
}

export function startUserAutoTrader(userId, io, intervalMs = 30000) {
  if (userInstances.has(userId)) { log(`[${userId}] Auto-trader ja esta rodando`); return; }
  log(`[${userId}] Iniciando auto-trader (intervalo: ${intervalMs / 1000}s)`);
  const instance = { intervalId: null, lastProtectionTime: 0, lastAutoCloseDate: null };
  instance.intervalId = setInterval(() => {
    executeAutoTradeForUser(userId, io, instance).catch(err => {
      log(`[${userId}] Erro no ciclo auto-trader: ${err.message}`);
    });
  }, intervalMs);
  userInstances.set(userId, instance);
  executeAutoTradeForUser(userId, io, instance).catch(err => {
    log(`[${userId}] Erro no ciclo inicial: ${err.message}`);
  });
}

export function stopUserAutoTrader(userId) {
  const instance = userInstances.get(userId);
  if (instance) {
    clearInterval(instance.intervalId);
    userInstances.delete(userId);
    log(`[${userId}] Auto-trader parado`);
  }
}

export function isUserAutoTraderRunning(userId) {
  return userInstances.has(userId);
}

export function stopAllUserAutoTraders() {
  for (const [userId, instance] of userInstances) {
    clearInterval(instance.intervalId);
    log(`[${userId}] Auto-trader parado (shutdown)`);
  }
  userInstances.clear();
}

export async function testAutoCloseForUser(userId, io) {
  const instance = userInstances.get(userId) || { lastAutoCloseDate: null };
  instance.lastAutoCloseDate = null;
  await autoCloseOrdersOnFriday(userId, io, instance);
}
