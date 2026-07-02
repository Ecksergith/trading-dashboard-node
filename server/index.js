import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

import { loadJSON, saveJSON, enforceSLTP, DEFAULT_PAIRS } from './lib/constants.js';
import { setLoggerState, pushLog } from './lib/logger.js';
import { createAiRoutes, startAutoAnalysis } from './lib/ai-routes.js';
import { mt5Bridge } from './lib/mt5-bridge.js';
import { authMiddleware, optionalAuth, verifyToken } from './lib/auth.js';
import authRoutes from './lib/auth-routes.js';
import { getUserState, updateUserState, createTrade as dbCreateTrade, closeTrade as dbCloseTrade, getTrades, getClosedTrades, getUserById, deleteDailyTrades } from './lib/db.js';
import { recordAnalysisOutcome } from './lib/llm-self-improve.js';
import { cciEngine } from './lib/cci-engine.js';
import { aiAgent } from './lib/ai-agent.js';
import { technicalIndicators } from './lib/technical-indicators.js';
import { tradingMemory } from './lib/trading-memory.js';
import { startUserAutoTrader, stopUserAutoTrader, isUserAutoTraderRunning, stopAllUserAutoTraders, updateSharedMarketData, testAutoCloseForUser } from './lib/auto-trader-manager.js';
import { multiAccountManager } from './lib/multi-account-bridge.js';
import { createMultiAccountRoutes } from './lib/multi-account-routes.js';
import { startMultiAutoTrader, stopMultiAutoTrader, isMultiAutoTraderRunning } from './lib/multi-account-trader.js';
import adminRoutes from './lib/admin-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, 'data');

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, { cors: { origin: '*' } });

app.use(cors());

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(authRoutes);

app.use(express.static(join(__dirname, '..', 'dist')));

const PORT = process.env.PORT || 5001;

const defaultRiskSettings = {
  max_loss_per_day: 100.0,
  max_positions: 10,
  max_position_size: 1.0,
  breakeven: false,
  breakeven_percent: 50.0,
  trailing_stop: false,
  trailing_pips: 10.0,
  lot_trade: false,
  auto_close_losing_trades: false,
  use_ifvg: true,
  use_one_candle_pattern: false,
  use_ote: false,
  use_mss: false,
  use_erl_irl: false,
  use_crt: false,
  auto_trading: false,
  llm_position_protection: false,
  llm_protection_interval: 60,
  trade_per_day: 10,
  min_gap_size: 0.0001,
  reversal_threshold: 0.0002,
  ifvg_stop_loss: 50,
  risk_reward_ratio: 2,
  ifvg_take_profit: 100,
  pattern_sl_tp_enabled: false,
  time_control_enabled: false,
  auto_close_orders: false,
  auto_close_time: '22:30',
  trading_days: { Segunda: true, Terca: true, Quarta: true, Quinta: true, Sexta: true, Sabado: false, Domingo: false },
  start_time: '14:30',
  end_time: '22:30',
};

const defaultLotSettings = {
  mode: 'fixed',
  fixed_lot: 0.01,
  monetary_value: 100.0,
  percentage_value: 1.0,
  min_lot: 0.01,
  max_lot: 10.0,
  use_lot_limits: false,
};

const state = {
  logs: loadJSON('system_logs.json', []),
  accountInfo: null,
  openPositions: [],
  priceData: {},
};

setLoggerState(state);

app.use(createAiRoutes(state, io));
app.use(createMultiAccountRoutes(state, io));

function saveAllState() {
  saveJSON('system_logs.json', state.logs.slice(-1000));
}

setInterval(saveAllState, 10000);

app.get('/api/state', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId);
  if (!userState) return res.json({ riskSettings: defaultRiskSettings, lotSettings: defaultLotSettings, pairs: DEFAULT_PAIRS, aiAgentSettings: {}, tradeHistory: [], equityHistory: [], priceData: state.priceData });
  res.json({ ...userState, priceData: state.priceData });
});

app.get('/api/diagnostic', authMiddleware, async (req, res) => {
  const diag = { timestamp: new Date().toISOString() };

  try {
    diag.bridgeUrl = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5000';

    try {
      const statusRes = await fetch(`${diag.bridgeUrl}/status`, { signal: AbortSignal.timeout(5000) });
      diag.bridgeStatus = statusRes.ok ? await statusRes.json() : { error: `HTTP ${statusRes.status}` };
    } catch (e) {
      diag.bridgeStatus = { error: e.message };
    }

    try {
      const posRes = await fetch(`${diag.bridgeUrl}/positions`, { signal: AbortSignal.timeout(5000) });
      diag.bridgePositions = posRes.ok ? await posRes.json() : { error: `HTTP ${posRes.status}` };
    } catch (e) {
      diag.bridgePositions = { error: e.message };
    }

    const userState = await getUserState(req.userId);
    const userPairs = userState?.pairs || DEFAULT_PAIRS;
    if (userPairs.length > 0) {
      const testPair = userPairs[0];
      try {
        const ratesUrl = `${diag.bridgeUrl}/rates?symbol=${encodeURIComponent(testPair)}&timeframe=5&count=200`;
        const ratesRes = await fetch(ratesUrl, { signal: AbortSignal.timeout(5000) });
        const ratesData = ratesRes.ok ? await ratesRes.json() : { error: `HTTP ${ratesRes.status}` };
        diag.testPair = testPair;
        diag.ratesResponse = Array.isArray(ratesData) ? { count: ratesData.length, sample: ratesData.slice(0, 2) } : ratesData;
      } catch (e) {
        diag.ratesError = e.message;
      }
    }

    diag.serverState = {
      priceDataKeys: Object.keys(state.priceData),
      priceDataCounts: {},
      pairs: userPairs,
      mt5Connected,
      accountBalance: state.accountInfo?.balance || 0,
    };
    for (const k of diag.serverState.priceDataKeys) {
      diag.serverState.priceDataCounts[k] = state.priceData[k]?.length || 0;
    }
  } catch (e) {
    diag.error = e.message;
  }

  res.json(diag);
});

app.post('/api/settings/risk', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings, lotSettings: defaultLotSettings };

  Object.assign(userState.riskSettings, req.body);
  await updateUserState(req.userId, { risk_settings: userState.riskSettings });
  io.to(`user:${req.userId}`).emit('settings-updated', { riskSettings: userState.riskSettings });

  if (req.body.auto_trading === true && !isUserAutoTraderRunning(req.userId)) {
    startUserAutoTrader(req.userId, io);
    pushLog('Auto-trader ativado via Gerenciamento');
    io.to(`user:${req.userId}`).emit('auto-trader-status', { running: true });
  } else if (req.body.auto_close_orders === true && !isUserAutoTraderRunning(req.userId)) {
    startUserAutoTrader(req.userId, io);
    pushLog('Auto-trader iniciado para auto-fechamento sexta');
    io.to(`user:${req.userId}`).emit('auto-trader-status', { running: true });
  } else if (req.body.auto_trading === false && isUserAutoTraderRunning(req.userId) && !userState.riskSettings.auto_close_orders) {
    stopUserAutoTrader(req.userId);
    pushLog('Auto-trader desativado via Gerenciamento');
    io.to(`user:${req.userId}`).emit('auto-trader-status', { running: false });
  }

  res.json({ ok: true });
});

app.post('/api/settings/lot', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings, lotSettings: defaultLotSettings };
  Object.assign(userState.lotSettings, req.body);
  await updateUserState(req.userId, { lot_settings: userState.lotSettings });
  io.to(`user:${req.userId}`).emit('settings-updated', { lotSettings: userState.lotSettings });
  res.json({ ok: true });
});

app.get('/api/pairs', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId);
  const pairs = userState?.pairs;
  res.json((pairs && pairs.length > 0) ? pairs : DEFAULT_PAIRS);
});
app.post('/api/pairs', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { pairs: [] };
  if (!userState.pairs || userState.pairs.length === 0) {
    userState.pairs = [...DEFAULT_PAIRS];
  }
  const { pair } = req.body;
  if (pair && !userState.pairs.includes(pair)) {
    userState.pairs.push(pair);
    await updateUserState(req.userId, { pairs: userState.pairs });
  }
  res.json(userState.pairs);
});
app.delete('/api/pairs/:pair', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { pairs: [] };
  userState.pairs = userState.pairs.filter(p => p !== req.params.pair);
  await updateUserState(req.userId, { pairs: userState.pairs });
  res.json(userState.pairs);
});

app.get('/api/account', authMiddleware, async (req, res) => {
  try {
    state.accountInfo = await mt5Bridge.getAccountInfo();
    res.json(state.accountInfo);
  } catch (e) {
    res.json({ error: e.message, connected: false });
  }
});

app.get('/api/positions', authMiddleware, async (req, res) => {
  try {
    state.openPositions = await mt5Bridge.getPositions();
    res.json(state.openPositions);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/trade', authMiddleware, async (req, res) => {
  try {
    const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings };
    const orderBody = { ...req.body, price: req.body.price || req.body.entry_price || 0 };
    const order = enforceSLTP(orderBody, userState.riskSettings);

    const result = await mt5Bridge.sendOrder(order);
    if (result.status === 'success') {
      await dbCreateTrade(req.userId, {
        symbol: order.symbol || order.ticker, type: order.type, volume: order.volume,
        price: result.price || 0, ticket: result.ticket, profit: 0, source: 'manual',
      });
    }
    res.json(result);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/close-position', authMiddleware, async (req, res) => {
  try {
    const result = await mt5Bridge.closePosition(req.body.ticket);
    if (result.status === 'success') {
      const pos = state.openPositions.find(p => p.ticket === req.body.ticket);
      if (pos) {
        await dbCloseTrade(req.userId, req.body.ticket, pos.price_current, pos.profit || 0);
        const tradeHistory = await getTrades(req.userId, 1000);
        const originalTrade = tradeHistory.find(t => String(t.ticket) === String(req.body.ticket));
        if (originalTrade?.signal_source === 'LLM') {
          const wasCorrect = (pos.profit || 0) > 0;
          recordAnalysisOutcome(pos.symbol, originalTrade.source || 'auto_trade', originalTrade.type, originalTrade.confidence || 0.5, wasCorrect, pos.profit || 0);
        }
      }
    }
    res.json(result);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.post('/api/close-all', authMiddleware, async (req, res) => {
  try {
    const positions = await mt5Bridge.getPositions();
    const results = [];
    const tradeHistory = await getTrades(req.userId, 1000);
    for (const pos of positions) {
      const r = await mt5Bridge.closePosition(pos.ticket);
      if (r.status === 'success') {
        await dbCloseTrade(req.userId, pos.ticket, pos.price_current, pos.profit || 0);
        const originalTrade = tradeHistory.find(t => String(t.ticket) === String(pos.ticket));
        if (originalTrade?.signal_source === 'LLM') {
          const wasCorrect = (pos.profit || 0) > 0;
          recordAnalysisOutcome(pos.symbol, originalTrade.source || 'auto_trade', originalTrade.type, originalTrade.confidence || 0.5, wasCorrect, pos.profit || 0);
        }
      }
      results.push({ ticket: pos.ticket, symbol: pos.symbol, status: r.status || 'error', message: r.message });
    }
    state.openPositions = await mt5Bridge.getPositions();
    res.json({ ok: true, closed: results.filter(r => r.status === 'success').length, total: positions.length, results });
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/closed-trades', authMiddleware, async (req, res) => {
  const limit = parseInt(req.query.limit) || 200;
  res.json(await getClosedTrades(req.userId, limit));
});

app.get('/api/symbols', authMiddleware, async (req, res) => {
  try {
    const symbols = await mt5Bridge.getSymbols();
    res.json(symbols);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/symbol-info/:symbol', authMiddleware, async (req, res) => {
  try {
    const info = await mt5Bridge.getSymbolInfo(req.params.symbol);
    res.json(info);
  } catch (e) {
    res.json({ exists: false });
  }
});

app.post('/api/modify-position', authMiddleware, async (req, res) => {
  try {
    const { ticket, sl, tp } = req.body;
    const result = await mt5Bridge.modifyPosition(ticket, sl, tp);
    res.json(result);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/market-data/:pair/:timeframe', authMiddleware, async (req, res) => {
  try {
    const data = await mt5Bridge.getRates(req.params.pair, req.params.timeframe);
    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/cci', (req, res) => res.json(cciEngine.getData()));

app.post('/api/cci/update', (req, res) => {
  const { price } = req.body;
  cciEngine.addPrice(price);
  res.json(cciEngine.getData());
});

app.get('/api/performance', authMiddleware, async (req, res) => {
  const trades = await getTrades(req.userId);
  res.json({
    initial_balance: state.accountInfo?.balance || 0,
    balance: state.accountInfo?.balance || 0,
    equity: state.accountInfo?.equity || 0,
    floating_profit: state.accountInfo?.equity - state.accountInfo?.balance || 0,
    margin_free: state.accountInfo?.margin_free || 0,
    total_profit: trades.reduce((s, t) => s + (t.profit || 0), 0),
    total_trades: trades.length,
    winning_trades: trades.filter(t => t.profit > 0).length,
    win_rate: trades.length ? (trades.filter(t => t.profit > 0).length / trades.length * 100) : 0,
  });
});

app.get('/api/trades', authMiddleware, async (req, res) => {
  res.json(await getTrades(req.userId));
});

app.post('/api/trades/reset-daily', authMiddleware, async (req, res) => {
  const removed = await deleteDailyTrades(req.userId);
  pushLog(`P/L diario resetado: ${removed.changes} trades removidos`);
  res.json({ ok: true, removed: removed.changes });
});

app.get('/api/equity-history', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId);
  res.json(userState?.equityHistory || []);
});

app.get('/api/daily-pnl', authMiddleware, async (req, res) => {
  const trades = await getTrades(req.userId);
  const daily = {};
  for (const t of trades) {
    if (!t.time) continue;
    const d = new Date(t.time).toISOString().slice(0, 10);
    if (!daily[d]) daily[d] = 0;
    daily[d] += t.profit || 0;
  }
  const result = Object.entries(daily).map(([date, pnl]) => ({ date, pnl: Math.round(pnl * 100) / 100 }));
  result.sort((a, b) => a.date.localeCompare(b.date));
  res.json(result);
});

app.post('/api/ai-agent/analyze', authMiddleware, async (req, res) => {
  try {
    const { pair, prices } = req.body;
    const result = aiAgent.analyze(prices);
    res.json(result);
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/ai-agent/status', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { aiAgentSettings: {} };
  const provider = userState.aiAgentSettings.provider || 'openrouter';
  const hasApiKey = !!userState.aiAgentSettings.apiKeys?.[provider];
  const connected = provider === 'ollama' ? true : hasApiKey;
  res.json({
    connected,
    provider,
    model: userState.aiAgentSettings.model,
    aggressiveness: userState.aiAgentSettings.aggressiveness,
  });
});

app.post('/api/ai-agent/settings', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { aiAgentSettings: {} };
  Object.assign(userState.aiAgentSettings, req.body);
  await updateUserState(req.userId, { ai_agent_settings: userState.aiAgentSettings });
  io.to(`user:${req.userId}`).emit('settings-updated', { aiAgentSettings: userState.aiAgentSettings });
  res.json({ ok: true });
});

app.get('/api/model-counters', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId);
  res.json(userState?.modelCounters || {});
});
app.post('/api/model-counters', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { modelCounters: {} };
  Object.assign(userState.modelCounters, req.body);
  await updateUserState(req.userId, { model_counters: userState.modelCounters });
  res.json(userState.modelCounters);
});

app.get('/api/logs', authMiddleware, (req, res) => res.json(state.logs.slice(-500)));

app.post('/api/logs', authMiddleware, (req, res) => {
  const { level, message } = req.body;
  pushLog(message || '', level || 'info');
  res.json({ ok: true });
});

app.get('/api/accounts/consolidated', authMiddleware, async (req, res) => {
  try {
    await multiAccountManager.refreshAll();
    res.json(multiAccountManager.getConsolidatedSummary());
  } catch (e) {
    res.json({ error: e.message });
  }
});

app.get('/api/signals', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { pairs: [] };
  const allSignals = {};
  for (const pair of userState.pairs) {
    allSignals[pair] = technicalIndicators.analyzeSignals(state.priceData[pair] || []);
  }
  res.json(allSignals);
});

app.get('/api/signals/:pair', authMiddleware, (req, res) => {
  const signals = technicalIndicators.analyzeSignals(state.priceData[req.params.pair] || []);
  res.json(signals);
});

app.post('/api/auto-trader/start', authMiddleware, async (req, res) => {
  const interval = req.body.interval || 30000;
  const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings };
  userState.riskSettings.auto_trading = true;
  await updateUserState(req.userId, { risk_settings: userState.riskSettings });
  startUserAutoTrader(req.userId, io, interval);
  pushLog(`Auto-trader iniciado (intervalo: ${interval / 1000}s)`);
  io.to(`user:${req.userId}`).emit('auto-trader-status', { running: true });
  io.to(`user:${req.userId}`).emit('settings-updated', { riskSettings: userState.riskSettings });
  res.json({ ok: true, running: true, interval });
});

app.post('/api/auto-trader/stop', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings };
  userState.riskSettings.auto_trading = false;
  await updateUserState(req.userId, { risk_settings: userState.riskSettings });
  stopUserAutoTrader(req.userId);
  pushLog('Auto-trader parado');
  io.to(`user:${req.userId}`).emit('auto-trader-status', { running: false });
  io.to(`user:${req.userId}`).emit('settings-updated', { riskSettings: userState.riskSettings });
  res.json({ ok: true, running: false });
});

app.get('/api/auto-trader/status', authMiddleware, async (req, res) => {
  const userState = await getUserState(req.userId) || { riskSettings: defaultRiskSettings };
  res.json({ running: isUserAutoTraderRunning(req.userId), auto_trading: userState.riskSettings.auto_trading });
});

app.post('/api/auto-close/test', authMiddleware, async (req, res) => {
  try {
    await testAutoCloseForUser(req.userId, io);
    res.json({ ok: true, message: 'Auto-close executado' });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/api/user', authMiddleware, async (req, res) => {
  const user = await getUserById(req.userId);
  if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

app.use(adminRoutes);

app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    res.sendFile(join(__dirname, '..', 'dist', 'index.html'));
  }
});

io.on('connection', (socket) => {
  const token = socket.handshake.auth?.token;
  const payload = verifyToken(token);
  if (!payload) {
    console.log('Socket auth failed:', socket.id);
    socket.disconnect();
    return;
  }
  const userId = payload.userId;
  socket.userId = userId;
  socket.join(`user:${userId}`);
  console.log(`Client connected: ${socket.id} (user: ${userId})`);

  (async () => {
    try {
      const userState = await getUserState(userId) || {
        riskSettings: defaultRiskSettings, lotSettings: defaultLotSettings,
        pairs: DEFAULT_PAIRS, aiAgentSettings: {}, modelCounters: {}, equityHistory: [],
      };
      const userPairs = userState.pairs?.length ? userState.pairs : DEFAULT_PAIRS;
      const dbUser = await getUserById(userId);
      socket.emit('initial-state', {
        riskSettings: userState.riskSettings,
        lotSettings: userState.lotSettings,
        pairs: userPairs,
        aiAgentSettings: userState.aiAgentSettings,
        tradeHistory: await getTrades(userId, 500),
        equityHistory: userState.equityHistory,
        priceData: state.priceData,
        logs: state.logs.slice(-500),
        autoTraderRunning: isUserAutoTraderRunning(userId),
        role: dbUser?.role || 'user',
      });

      if (userState.riskSettings.auto_trading || userState.riskSettings.auto_close_orders) {
        setTimeout(() => startUserAutoTrader(userId, io), 6000);
      }
    } catch (e) {
      console.log('Socket connection init error:', e.message);
    }
  })();

  socket.on('request-update', async () => {
    try {
      state.accountInfo = await mt5Bridge.getAccountInfo();
      state.openPositions = await mt5Bridge.getPositions();

      const userState = await getUserState(userId);
      const fetchPairs = userState?.pairs?.length ? userState.pairs : DEFAULT_PAIRS;
      for (const pair of fetchPairs) {
        if (!state.priceData[pair] || !state.priceData[pair].length) {
          try {
            const rates = await mt5Bridge.getRates(pair, 'M5');
            if (rates?.length) state.priceData[pair] = rates;
          } catch {}
        }
      }

      socket.emit('market-update', {
        account: state.accountInfo,
        positions: state.openPositions,
        priceData: state.priceData,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.log('request-update error:', e.message);
      socket.emit('market-update', { error: e.message });
    }
  });

  socket.on('settings-update', async (data) => {
    const userState = await getUserState(userId) || { riskSettings: defaultRiskSettings, lotSettings: defaultLotSettings };
    if (data.riskSettings) Object.assign(userState.riskSettings, data.riskSettings);
    if (data.lotSettings) Object.assign(userState.lotSettings, data.lotSettings);
    await updateUserState(userId, { risk_settings: userState.riskSettings, lot_settings: userState.lotSettings });
  });

  socket.on('auto-trader-start', (data) => {
    const interval = data?.interval || 30000;
    startUserAutoTrader(userId, io, interval);
    socket.emit('auto-trader-status', { running: true });
  });

  socket.on('auto-trader-stop', () => {
    stopUserAutoTrader(userId);
    socket.emit('auto-trader-status', { running: false });
  });

  socket.on('multi-auto-trader-start', (data) => {
    const interval = data?.interval || 30000;
    startMultiAutoTrader(state, io, interval);
    socket.emit('multi-auto-trader-status', { running: true });
  });

  socket.on('multi-auto-trader-stop', () => {
    stopMultiAutoTrader();
    socket.emit('multi-auto-trader-status', { running: false });
  });

  socket.on('request-accounts-update', async () => {
    try {
      await multiAccountManager.refreshAll();
      socket.emit('accounts-update', multiAccountManager.getAll());
      socket.emit('accounts-summary', multiAccountManager.getConsolidatedSummary());
    } catch {}
  });

  socket.on('disconnect', () => {
    const remaining = [...io.sockets.sockets.values()].filter(s => s.userId === userId);
    if (remaining.length === 0) {
      stopUserAutoTrader(userId);
      console.log(`Auto-trader parado para user ${userId} (todos sockets desconectados)`);
    }
    console.log('Client disconnected:', socket.id);
  });
});

let marketUpdateInterval;
let mt5Connected = false;
let _updateCount = 0;
async function startMarketUpdates() {
  console.log('[MarketUpdates] Starting market update loop...');
  pushLog(`Market updates iniciados | Bridge: ${process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5000'}`);

  let lastMt5Status = null;

  marketUpdateInterval = setInterval(async () => {
    _updateCount++;
    try {
      state.accountInfo = await mt5Bridge.getAccountInfo();
      state.openPositions = await mt5Bridge.getPositions();

      mt5Connected = state.accountInfo?.connected || false;

      if (lastMt5Status !== mt5Connected) {
        pushLog(mt5Connected ? 'MT5 conectado' : 'MT5 desconectado', mt5Connected ? 'info' : 'warning');
        lastMt5Status = mt5Connected;
      }

      if (_updateCount <= 3 || _updateCount % 12 === 0) {
        console.log(`[MarketUpdate #${_updateCount}] MT5: ${mt5Connected ? 'ON' : 'OFF'} | Balance: ${state.accountInfo?.balance || 0} | Positions: ${state.openPositions?.length || 0}`);
        pushLog(`Market update #${_updateCount}: MT5 ${mt5Connected ? 'ON' : 'OFF'} | Balance: $${(state.accountInfo?.balance || 0).toFixed(2)} | Posicoes: ${state.openPositions?.length || 0}`);
      }

      const allPairs = new Set();
      for (const [, s] of io.sockets.sockets) {
        if (s.userId) {
          const uState = await getUserState(s.userId);
          if (uState?.pairs?.length) uState.pairs.forEach(p => allPairs.add(p));
        }
      }
      if (allPairs.size === 0) {
        DEFAULT_PAIRS.forEach(p => allPairs.add(p));
      }

      if (mt5Connected) {
        for (const pair of allPairs) {
          try {
            const rates = await mt5Bridge.getRates(pair, 'M5');
            if (rates && rates.length) {
              state.priceData[pair] = rates;
              if (_updateCount <= 3) {
                console.log(`[MarketUpdate] ${pair}: ${rates.length} candles | last close: ${rates[rates.length - 1]?.close}`);
              }
            } else {
              if (_updateCount <= 5) {
                console.log(`[MarketUpdate] ${pair}: EMPTY rates (returned ${JSON.stringify(rates)?.slice(0, 100)})`);
              }
            }
          } catch (e) {
            console.log(`[MarketUpdate] ${pair} error: ${e.message}`);
          }
        }
      } else {
        if (_updateCount <= 3) {
          console.log(`[MarketUpdate] MT5 disconnected - skipping rate fetch`);
        }
      }

      updateSharedMarketData({ priceData: state.priceData, accountInfo: state.accountInfo, openPositions: state.openPositions });

      if (state.accountInfo && state.accountInfo.balance) {
        const equityPoint = {
          time: Date.now(),
          equity: state.accountInfo.equity || state.accountInfo.balance,
          balance: state.accountInfo.balance,
        };

        const connectedUserIds = new Set();
        for (const [, s] of io.sockets.sockets) {
          if (s.userId) connectedUserIds.add(s.userId);
        }

        for (const uid of connectedUserIds) {
          const uState = await getUserState(uid) || { equityHistory: [] };
          const hist = [...(uState.equityHistory || []), equityPoint];
          await updateUserState(uid, { equity_history: hist.slice(-10000) });
        }
      }
      for (const [, s] of io.sockets.sockets) {
        if (s.userId) {
          s.emit('market-update', {
            account: state.accountInfo,
            positions: state.openPositions,
            priceData: state.priceData,
            timestamp: Date.now(),
          });
        }
      }

      try {
        await multiAccountManager.refreshAll();
        io.emit('accounts-update', multiAccountManager.getAll());
      } catch {}
    } catch (e) {
      console.log(`[MarketUpdate #${_updateCount}] Error: ${e.message}`);
    }
  }, 5000);

  try {
    state.accountInfo = await mt5Bridge.getAccountInfo();
    mt5Connected = state.accountInfo?.connected || false;
    console.log(`[MarketUpdates] Initial MT5 status: ${mt5Connected ? 'CONNECTED' : 'DISCONNECTED'} | Balance: ${state.accountInfo?.balance || 0}`);
    if (mt5Connected) {
      state.openPositions = await mt5Bridge.getPositions();
      console.log(`[MarketUpdates] Initial positions: ${state.openPositions?.length || 0}`);
      updateSharedMarketData({ priceData: state.priceData, accountInfo: state.accountInfo, openPositions: state.openPositions });
    }
  } catch (e) {
    console.log('[MarketUpdates] Initial fetch error:', e.message);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Trading Dashboard Server running on port ${PORT}`);
  pushLog(`Servidor iniciado na porta ${PORT}`);
  startMarketUpdates();
  startAutoAnalysis(state, io, 60000);
});

process.on('SIGINT', () => { saveAllState(); process.exit(0); });
process.on('SIGTERM', () => { saveAllState(); process.exit(0); });
process.on('exit', () => { saveAllState(); });
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection:', reason?.message || reason);
  pushLog(`Unhandled Rejection: ${reason?.message || reason}`, 'error');
});
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err.message);
  pushLog(`Uncaught Exception: ${err.message}`, 'error');
});
