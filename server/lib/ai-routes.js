import { Router } from 'express';
import { unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mt5Bridge } from './mt5-bridge.js';
import { calculateLotSize, normalizeVolume, getPipDivisor, getSLDivisor, getDecimals, getSymbolType, loadJSON, saveJSON, DEFAULT_PAIRS } from './constants.js';
import { getStrategyPrompt, buildTradeAnalysisPrompt, buildPositionManagementPrompt, callLLM, parseLLMResponse, parsePositionManagementResponse, addToHistory, loadSettings, buildTradeMemoryContext } from './llm-engine.js';
import { authMiddleware } from './auth.js';
import { getUserState, updateUserState, createTrade as dbCreateTrade, getTrades, getUserById, getTradeMemory, getTradeMemoryStats, getRecentTradeReasons } from './db.js';
import { getLearningStats, getStrategyPerformance, getBestStrategyForPair, analyzeClosedTrades, generateWeeklyReport, getAdaptiveThreshold } from './llm-self-improve.js';

const LLM_ANALYSIS_HISTORY_FILE = 'llm_analysis_history.json';

export function createAiRoutes(state, io) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/api/llm/status', async (req, res) => {
    const settings = loadJSON('ai_agent_settings.json', {});
    res.json({
      provider: settings.provider || 'openrouter',
      model: settings.model || 'openrouter/free',
      hasApiKey: !!settings.apiKeys?.[settings.provider],
      lastError: null,
    });
  });

  router.post('/api/llm/test', async (req, res) => {
    const { provider, apiKey } = req.body;
    try {
      if (provider === 'openrouter') {
        const response = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        res.json({ ok: response.ok, provider });
      } else if (provider === 'ollama') {
        const response = await fetch('http://localhost:11434/api/tags');
        res.json({ ok: response.ok, provider });
      } else {
        res.json({ ok: false, error: 'Provider nao suportado' });
      }
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  router.post('/api/llm/analyze', async (req, res) => {
    const { provider, apiKey, model, prompt } = req.body;
    try {
      const llmResponse = await callLLM(provider || 'openrouter', apiKey, model || 'openrouter/free', '', prompt);
      res.json({ ok: true, response: llmResponse });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  router.post('/api/llm/chain-of-thought', async (req, res) => {
    const { pair } = req.body;
    if (!pair) return res.status(400).json({ error: 'Par obrigatorio' });
    try {
      const settings = loadJSON('ai_agent_settings.json', {});
      const provider = settings.provider || 'openrouter';
      const apiKey = settings.apiKeys?.[provider] || '';
      const model = settings.model || 'openrouter/free';
      const strategy = settings.strategy || 'ict_smc';

      if (provider !== 'ollama' && !apiKey) {
        return res.json({ ok: false, error: 'API key nao configurada. Configure em Gerenciamento.' });
      }

      const priceData = state.priceData?.[pair];
      if (!priceData || priceData.length < 30) {
        return res.json({ ok: false, error: `Dados insuficientes para ${pair}. Aguardando market data...` });
      }

      const userState = await getUserState(req.userId);
      const riskSettings = userState?.riskSettings || {};
      const openPositions = state.openPositions || [];

      const systemPrompt = await getStrategyPrompt(strategy, riskSettings, undefined, pair, req.userId);
      const marketPrompt = await buildTradeAnalysisPrompt(pair, priceData, state.accountInfo, riskSettings, openPositions.length, req.userId);

      const startTime = Date.now();
      const rawResponse = await callLLM(provider, apiKey, model, systemPrompt, marketPrompt);
      const elapsed = Date.now() - startTime;

      const parsed = parseLLMResponse(rawResponse);

      addToHistory({
        time: Date.now(),
        pair,
        action: parsed.action,
        confidence: parsed.confidence,
        reason: parsed.reason,
        entry_price: parsed.entry_price,
        stop_loss: parsed.stop_loss,
        take_profit: parsed.take_profit,
        status: parsed.action !== 'wait' ? 'auto_analysis' : 'auto_analysis',
        auto: false,
        source: 'chain_of_thought',
      });

      res.json({
        ok: true,
        pair,
        strategy,
        model,
        raw: rawResponse,
        parsed,
        elapsed,
        timestamp: Date.now(),
      });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  router.get('/api/llm/languages', (req, res) => {
    res.json([
      { code: 'pt', name: 'Portugues (BR)' },
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Espanol' },
      { code: 'fr', name: 'Francais' },
      { code: 'de', name: 'Deutsch' },
      { code: 'zh', name: 'Chines (Mandarim)' },
      { code: 'ja', name: 'Japones' },
      { code: 'ko', name: 'Coreano' },
      { code: 'ar', name: 'Arabe' },
      { code: 'ru', name: 'Russo' },
    ]);
  });

  router.get('/api/llm/strategies', (req, res) => {
    res.json([
      { id: 'ict_smc', name: 'ICT/SMC', description: 'Order Blocks, FVG, Liquidez, MSS/BOS' },
      { id: 'mml_erl_irl', name: 'MML (ERL/IRL)', description: 'Market Maker Logic com ERL, IRL, CSD' },
      { id: 'fvg_strategy', name: 'FVG Strategy', description: 'Fair Value Gaps BISI/SIBI' },
      { id: 'price_action', name: 'Price Action', description: 'Padroes de candles puros' },
      { id: 'custom', name: 'Custom', description: 'Prompt personalizado' },
    ]);
  });

  router.post('/api/llm/trade-analysis', async (req, res) => {
    const { pair } = req.body;
    if (!pair) return res.json({ ok: false, error: 'Par nao informado' });

    try {
      const userState = await getUserState(req.userId) || { riskSettings: {}, lotSettings: {}, aiAgentSettings: {} };
      const settings = userState.aiAgentSettings || {};
      const riskSettings = userState.riskSettings || {};
      const provider = settings.provider || 'openrouter';
      const apiKey = settings.apiKeys?.[provider] || '';
      const model = settings.model || 'openrouter/free';

      if (provider !== 'ollama' && !apiKey) {
        return res.json({ ok: false, error: 'API Key nao configurada' });
      }

      const accountInfo = await mt5Bridge.getAccountInfo();
      const priceData = await mt5Bridge.getRates(pair, 'M5');
      if (!priceData || priceData.length === 0) {
        return res.json({ ok: false, error: 'Dados de mercado indisponiveis' });
      }

      const systemPrompt = await getStrategyPrompt(settings.strategy || 'ict_smc', riskSettings, undefined, pair, req.userId);

      const analysisInput = await buildTradeAnalysisPrompt(pair, priceData, accountInfo, riskSettings, undefined, req.userId);

      io.to(`user:${req.userId}`).emit('llm-analyzing', { pair });

      const llmResponse = await callLLM(provider, apiKey, model, systemPrompt, analysisInput);
      const analysis = parseLLMResponse(llmResponse);
      const adaptiveThreshold = getAdaptiveThreshold();

      let tradeResult = null;

      if ((analysis.action === 'buy' || analysis.action === 'sell') && analysis.confidence >= adaptiveThreshold) {
        const currentPrice = priceData[priceData.length - 1]?.close || 0;

        let slPips = analysis.stop_loss || riskSettings.ifvg_stop_loss || 50;
        let tpPips = analysis.take_profit || riskSettings.ifvg_take_profit || (slPips * (riskSettings.risk_reward_ratio || 2));

        const symInfo = await mt5Bridge.getSymbolInfo(pair);
        const volume = normalizeVolume(calculateLotSize(userState.lotSettings, accountInfo, pair, slPips, currentPrice), symInfo);
        const point = symInfo?.point || 0.0001;
        const stopLevel = symInfo?.trade_stop_level || 0;
        const decimals = symInfo?.digits ?? getDecimals(pair);
        const slPct = slPips / getSLDivisor(pair, settings.aggressiveness);
        const slDistance = Math.max(currentPrice * slPct, stopLevel * point, point * 100);
        const tpDistance = Math.max(currentPrice * slPct * (riskSettings.risk_reward_ratio || 2), stopLevel * point, point * 100);

        const slValue = analysis.action === 'buy'
            ? +(currentPrice - slDistance).toFixed(decimals)
            : +(currentPrice + slDistance).toFixed(decimals);
        const tpValue = analysis.action === 'buy'
            ? +(currentPrice + tpDistance).toFixed(decimals)
            : +(currentPrice - tpDistance).toFixed(decimals);
        const symType = getSymbolType(pair);
        const needsDeferredSLTP = symType === 'synthetic' || symType === 'crypto';
        const strategyLabel = settings.strategy || 'ict_smc';
        const order = {
          symbol: pair,
          type: analysis.action,
          volume,
          stop_loss: needsDeferredSLTP ? 0 : slValue,
          take_profit: needsDeferredSLTP ? 0 : tpValue,
          comment: `LLM:${strategyLabel}`,
        };

        tradeResult = await mt5Bridge.sendOrder(order);

        if (tradeResult?.status === 'success') {
          if (needsDeferredSLTP && slValue > 0 && tpValue > 0) {
            try {
              const modResult = await mt5Bridge.modifyPosition(tradeResult.ticket, slValue, tpValue);
              if (modResult?.status !== 'success') {
                console.log(`[AI] SL/TP modify falhou para ${pair}: ${modResult?.message || 'erro'}`);
              }
            } catch (e) {
              console.log(`[AI] Erro SL/TP para ${pair}: ${e.message}`);
            }
          }
          const marketContext = JSON.stringify({
            pair,
            price: currentPrice,
            source: 'manual_analysis',
            confidence: analysis.confidence,
          });
          await dbCreateTrade(req.userId, {
            symbol: pair,
            type: analysis.action.toUpperCase(),
            volume,
            price: tradeResult.price || 0,
            ticket: tradeResult.ticket,
            profit: 0,
            source: 'llm_analysis',
            signalSource: 'LLM',
            reason: analysis.reason || '',
            confidence: analysis.confidence,
            marketContext,
            strategy: strategyLabel,
          });

          io.to(`user:${req.userId}`).emit('trade-history-update', await getTrades(req.userId, 500));

          addToHistory({
            time: Date.now(),
            pair,
            action: analysis.action,
            confidence: analysis.confidence,
            reason: analysis.reason,
            entry_price: tradeResult.price || analysis.entry_price,
            stop_loss: analysis.stop_loss,
            take_profit: analysis.take_profit,
            volume,
            ticket: tradeResult.ticket,
            status: 'executed',
            llm_raw: llmResponse.slice(0, 1000),
          });
        }
      } else {
        addToHistory({
          time: Date.now(),
          pair,
          action: analysis.action,
          confidence: analysis.confidence,
          reason: analysis.reason,
          status: 'skipped',
          llm_raw: llmResponse.slice(0, 1000),
        });
      }

      res.json({
        ok: true,
        analysis,
        trade: tradeResult,
        llm_raw: llmResponse,
      });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  router.get('/api/llm/history', (req, res) => {
    const history = loadJSON(LLM_ANALYSIS_HISTORY_FILE, []);
    const limit = parseInt(req.query.limit) || 50;
    res.json(history.slice(-limit).reverse());
  });

  router.get('/api/llm/latest', (req, res) => {
    const history = loadJSON(LLM_ANALYSIS_HISTORY_FILE, []);
    const latestByPair = {};
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (!latestByPair[entry.pair]) {
        latestByPair[entry.pair] = entry;
      }
    }
    res.json(latestByPair);
  });

  router.get('/api/llm/trade-memory', async (req, res) => {
    const pair = req.query.pair;
    const limit = parseInt(req.query.limit) || 10;
    const memory = await getTradeMemory(req.userId, pair, limit);
    const stats = await getTradeMemoryStats(req.userId, pair || null);
    const reasons = await getRecentTradeReasons(req.userId, pair, 5);
    res.json({ memory, stats, reasons });
  });

  router.post('/api/llm/position-manage', async (req, res) => {
    const { ticket } = req.body;
    if (!ticket) return res.json({ ok: false, error: 'Ticket nao informado' });

    try {
      const settings = loadJSON('ai_agent_settings.json', {});
      const provider = settings.provider || 'openrouter';
      const apiKey = settings.apiKeys?.[provider] || '';
      const model = settings.model || 'openrouter/free';

      if (provider !== 'ollama' && !apiKey) {
        return res.json({ ok: false, error: 'API Key nao configurada' });
      }

      const positions = await mt5Bridge.getPositions();
      const position = positions.find(p => p.ticket == ticket);
      if (!position) {
        return res.json({ ok: false, error: 'Posicao nao encontrada' });
      }

      const priceData = await mt5Bridge.getRates(position.symbol, 'M5');
      if (!priceData || priceData.length === 0) {
        return res.json({ ok: false, error: 'Dados de mercado indisponiveis' });
      }

      const systemPrompt = 'Voce e um gerenciador de posicoes profissional. Responda APENAS com JSON valido.';
      const prompt = buildPositionManagementPrompt(position, priceData);
      const llmResponse = await callLLM(provider, apiKey, model, systemPrompt, prompt);
      const parsed = parsePositionManagementResponse(llmResponse);

      res.json({
        ok: true,
        action: parsed.action || 'hold',
        reason: parsed.reason || '',
        new_sl: parsed.new_sl || 0,
        position: {
          symbol: position.symbol,
          type: position.type === 0 ? 'BUY' : 'SELL',
          entry: position.price_open,
          current: position.price_current,
          profit: position.profit,
        },
        llm_raw: llmResponse,
      });
    } catch (e) {
      res.json({ ok: false, error: e.message });
    }
  });

  router.get('/api/llm/self-improve/stats', (req, res) => {
    res.json(getLearningStats());
  });

  router.get('/api/llm/self-improve/strategy-performance', (req, res) => {
    res.json(getStrategyPerformance());
  });

  router.get('/api/llm/self-improve/best-strategy/:pair', (req, res) => {
    const best = getBestStrategyForPair(req.params.pair);
    res.json({ pair: req.params.pair, bestStrategy: best });
  });

  router.get('/api/llm/self-improve/analyze', async (req, res) => {
    const analysis = await analyzeClosedTrades(req.userId);
    res.json(analysis);
  });

  router.get('/api/llm/self-improve/weekly-report', async (req, res) => {
    const report = await generateWeeklyReport(req.userId);
    res.json(report || { message: 'Nenhum trade na ultima semana' });
  });

  router.get('/api/llm/self-improve/threshold', (req, res) => {
    res.json({ threshold: getAdaptiveThreshold() });
  });

  router.post('/api/llm/self-improve/reset', (req, res) => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const DATA_DIR = join(__dirname, '..', 'data');
      const files = ['llm_learning.json', 'strategy_performance.json'];
      for (const f of files) {
        try { unlinkSync(join(DATA_DIR, f)); } catch {}
      }
      res.json({ ok: true, message: 'Aprendizado resetado com sucesso' });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  router.post('/api/llm/self-improve/record-outcome', (req, res) => {
    const { pair, strategy, action, confidence, profit } = req.body;
    if (!pair || !action) {
      return res.json({ ok: false, error: 'pair e action sao obrigatorios' });
    }
    const wasCorrect = profit > 0;
    recordAnalysisOutcome(pair, strategy || 'manual', action, confidence || 0.5, wasCorrect, profit || 0);
    res.json({ ok: true, wasCorrect });
  });

  return router;
}

let autoAnalysisInterval = null;

export function startAutoAnalysis(state, io, intervalMs = 60000) {
  if (autoAnalysisInterval) return;

  async function runAnalysis() {
    const connectedUserIds = new Set();
    for (const [, s] of io.sockets.sockets) {
      if (s.userId) connectedUserIds.add(s.userId);
    }

    for (const userId of connectedUserIds) {
      const userState = await getUserState(userId);
      if (!userState) continue;
      const riskSettings = userState.riskSettings || {};
      if (riskSettings.time_control_enabled) {
        const now = new Date();
        const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
        const dayName = dayNames[now.getDay()];
        if (riskSettings.trading_days && !riskSettings.trading_days[dayName]) continue;
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (riskSettings.start_time && riskSettings.end_time) {
          if (currentTime < riskSettings.start_time || currentTime > riskSettings.end_time) continue;
        }
      }

      for (const pair of (userState.pairs || DEFAULT_PAIRS)) {
        try {
          const priceData = await mt5Bridge.getRates(pair, 'M5');
          if (!priceData || priceData.length === 0) continue;

          const settings = userState.aiAgentSettings || {};
          const provider = settings.provider || 'openrouter';
          const apiKey = settings.apiKeys?.[provider] || '';
          const model = settings.model || 'openrouter/free';

          if (provider !== 'ollama' && !apiKey) continue;

          const accountInfo = await mt5Bridge.getAccountInfo();
          const openPositions = await mt5Bridge.getPositions();
          const strategy = settings.strategy || 'ict_smc';
          const systemPrompt = await getStrategyPrompt(strategy, riskSettings, undefined, pair, userId);
          const marketData = await buildTradeAnalysisPrompt(pair, priceData, accountInfo, riskSettings, openPositions.length, userId);

          io.to(`user:${userId}`).emit('llm-analyzing', { pair });

        let llmResponse = '';
        try {
          llmResponse = await callLLM(provider, apiKey, model, systemPrompt, marketData);
        } catch { continue; }

        if (!llmResponse) continue;

        const analysis = parseLLMResponse(llmResponse);

        addToHistory({
          time: Date.now(),
          pair,
          action: analysis.action,
          confidence: analysis.confidence || 0.5,
          reason: analysis.reason || '',
          status: 'auto_analysis',
          auto: true,
        });

        io.to(`user:${userId}`).emit('llm-analysis', { pair, analysis, time: Date.now() });
      } catch (err) {}
    }
    }
  }

  autoAnalysisInterval = setInterval(runAnalysis, intervalMs);
  runAnalysis();
}

export function stopAutoAnalysis() {
  if (autoAnalysisInterval) {
    clearInterval(autoAnalysisInterval);
    autoAnalysisInterval = null;
  }
}
