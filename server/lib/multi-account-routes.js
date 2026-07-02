import { Router } from 'express';
import { multiAccountManager } from './multi-account-bridge.js';
import { startMultiAutoTrader, stopMultiAutoTrader, isMultiAutoTraderRunning } from './multi-account-trader.js';
import { enforceSLTP, loadJSON } from './constants.js';
import { authMiddleware } from './auth.js';

export function createMultiAccountRoutes(state, io) {
  const router = Router();
  router.use(authMiddleware);

  router.get('/api/accounts', (req, res) => {
    const accounts = multiAccountManager.getAll();
    res.json(accounts);
  });

  router.get('/api/accounts/summary', (req, res) => {
    res.json(multiAccountManager.getConsolidatedSummary());
  });

  router.get('/api/accounts/:id', (req, res) => {
    const account = multiAccountManager.getById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Conta nao encontrada' });

    const bridgeState = multiAccountManager.getState(req.params.id);
    res.json({
      ...account,
      accountInfo: bridgeState?.accountInfo || account.accountInfo,
      openPositions: bridgeState?.openPositions || [],
    });
  });

  router.post('/api/accounts', (req, res) => {
    const account = multiAccountManager.add(req.body);
    io.emit('accounts-updated', multiAccountManager.getAll());
    res.json(account);
  });

  router.put('/api/accounts/:id', (req, res) => {
    const account = multiAccountManager.update(req.params.id, req.body);
    if (!account) return res.status(404).json({ error: 'Conta nao encontrada' });
    io.emit('accounts-updated', multiAccountManager.getAll());
    res.json(account);
  });

  router.delete('/api/accounts/:id', (req, res) => {
    const success = multiAccountManager.remove(req.params.id);
    if (!success) return res.status(400).json({ error: 'Nao e possivel remover esta conta' });
    io.emit('accounts-updated', multiAccountManager.getAll());
    res.json({ ok: true });
  });

  router.post('/api/accounts/:id/refresh', async (req, res) => {
    const account = multiAccountManager.getById(req.params.id);
    if (!account) return res.status(404).json({ error: 'Conta nao encontrada' });

    const bridge = multiAccountManager.getBridge(req.params.id);
    const accState = multiAccountManager.getState(req.params.id);

    try {
      accState.accountInfo = await bridge.getAccountInfo();
      accState.openPositions = await bridge.getPositions();
      account.connected = accState.accountInfo?.connected || false;
      account.accountInfo = accState.accountInfo;
      res.json({ ...account, openPositions: accState.openPositions });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  router.get('/api/accounts/:id/positions', async (req, res) => {
    const bridge = multiAccountManager.getBridge(req.params.id);
    if (!bridge) return res.status(404).json({ error: 'Conta nao encontrada' });

    try {
      const positions = await bridge.getPositions();
      res.json(positions);
    } catch (e) {
      res.json([]);
    }
  });

  router.get('/api/accounts/:id/market-data/:pair/:timeframe', async (req, res) => {
    const bridge = multiAccountManager.getBridge(req.params.id);
    if (!bridge) return res.status(404).json({ error: 'Conta nao encontrada' });

    try {
      const data = await bridge.getRates(req.params.pair, req.params.timeframe);
      res.json(data);
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  router.post('/api/accounts/:id/trade', async (req, res) => {
    const bridge = multiAccountManager.getBridge(req.params.id);
    if (!bridge) return res.status(404).json({ error: 'Conta nao encontrada' });

    try {
      const account = multiAccountManager.getById(req.params.id);
      const globalRisk = state.riskSettings || {};
      const accountRisk = { ...globalRisk, ...(account?.riskSettings || {}) };
      const orderBody = { ...req.body, price: req.body.price || req.body.entry_price || 0 };
      const order = enforceSLTP(orderBody, accountRisk);

      const result = await bridge.sendOrder(order);
      if (result.status === 'success') {
        const accState = multiAccountManager.getState(req.params.id);
        accState.tradeHistory.push({
          symbol: order.symbol || order.ticker,
          type: order.type,
          volume: order.volume,
          price: result.price || 0,
          ticket: result.ticket,
          time: Date.now(),
          profit: 0,
          accountId: req.params.id,
        });
      }
      res.json(result);
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  router.post('/api/accounts/:id/close-position', async (req, res) => {
    const bridge = multiAccountManager.getBridge(req.params.id);
    if (!bridge) return res.status(404).json({ error: 'Conta nao encontrada' });

    try {
      const result = await bridge.closePosition(req.body.ticket);
      if (result.status === 'success') {
        const accState = multiAccountManager.getState(req.params.id);
        const pos = (accState.openPositions || []).find(p => p.ticket === req.body.ticket);
        if (pos) {
          accState.tradeHistory.push({
            symbol: pos.symbol,
            type: pos.type === 0 ? 'SELL' : 'BUY',
            volume: pos.volume,
            price: pos.price_current,
            exitPrice: pos.price_current,
            ticket: req.body.ticket,
            time: Date.now(),
            profit: pos.profit || 0,
            accountId: req.params.id,
          });
        }
      }
      res.json(result);
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  router.get('/api/accounts/:id/trades', (req, res) => {
    const accState = multiAccountManager.getState(req.params.id);
    if (!accState) return res.json([]);
    res.json(accState.tradeHistory);
  });

  router.get('/api/accounts/:id/performance', (req, res) => {
    const accountId = req.params.id;
    const account = multiAccountManager.getById(accountId);
    const accState = multiAccountManager.getState(accountId);
    if (!account || !accState) return res.json({ error: 'Conta nao encontrada' });

    const trades = accState.tradeHistory || [];
    const ai = accState.accountInfo || {};

    const totalTrades = trades.length;
    const winTrades = trades.filter(t => t.profit > 0);
    const loseTrades = trades.filter(t => t.profit < 0);
    const breakevenTrades = trades.filter(t => t.profit === 0);
    const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
    const totalWinProfit = winTrades.reduce((s, t) => s + t.profit, 0);
    const totalLoseLoss = loseTrades.reduce((s, t) => s + t.profit, 0);
    const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const avgWin = winTrades.length > 0 ? totalWinProfit / winTrades.length : 0;
    const avgLoss = loseTrades.length > 0 ? totalLoseLoss / loseTrades.length : 0;
    const winRate = totalTrades > 0 ? (winTrades.length / totalTrades * 100) : 0;
    const profitFactor = totalLoseLoss !== 0 ? Math.abs(totalWinProfit / totalLoseLoss) : totalWinProfit > 0 ? Infinity : 0;
    const expectancy = totalTrades > 0 ? totalProfit / totalTrades : 0;
    const bestTrade = trades.length > 0 ? trades.reduce((best, t) => (t.profit > best.profit) ? t : best, trades[0]) : null;
    const worstTrade = trades.length > 0 ? trades.reduce((worst, t) => (t.profit < worst.profit) ? t : worst, trades[0]) : null;

    let maxDrawdown = 0;
    let peak = 0;
    let runningPnL = 0;
    for (const t of trades) {
      runningPnL += t.profit || 0;
      if (runningPnL > peak) peak = runningPnL;
      const dd = peak - runningPnL;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const dailyPnL = {};
    for (const t of trades) {
      if (!t.time) continue;
      const d = new Date(t.time).toISOString().slice(0, 10);
      if (!dailyPnL[d]) dailyPnL[d] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      dailyPnL[d].pnl += t.profit || 0;
      dailyPnL[d].trades++;
      if (t.profit > 0) dailyPnL[d].wins++;
      else if (t.profit < 0) dailyPnL[d].losses++;
    }

    const monthlyPnL = {};
    for (const t of trades) {
      if (!t.time) continue;
      const m = new Date(t.time).toISOString().slice(0, 7);
      if (!monthlyPnL[m]) monthlyPnL[m] = { pnl: 0, trades: 0, wins: 0, losses: 0 };
      monthlyPnL[m].pnl += t.profit || 0;
      monthlyPnL[m].trades++;
      if (t.profit > 0) monthlyPnL[m].wins++;
      else if (t.profit < 0) monthlyPnL[m].losses++;
    }

    const pairStats = {};
    for (const t of trades) {
      const sym = t.symbol || t.pair || 'UNKNOWN';
      if (!pairStats[sym]) pairStats[sym] = { trades: 0, wins: 0, pnl: 0 };
      pairStats[sym].trades++;
      if (t.profit > 0) pairStats[sym].wins++;
      pairStats[sym].pnl += t.profit || 0;
    }
    const pairStatsArr = Object.entries(pairStats).map(([pair, s]) => ({
      pair,
      trades: s.trades,
      wins: s.wins,
      losses: s.trades - s.wins,
      winRate: s.trades > 0 ? Math.round(s.wins / s.trades * 1000) / 10 : 0,
      pnl: Math.round(s.pnl * 100) / 100,
    })).sort((a, b) => b.pnl - a.pnl);

    const buyTrades = trades.filter(t => t.type === 'buy' || t.type === 'BUY');
    const sellTrades = trades.filter(t => t.type === 'sell' || t.type === 'SELL');
    const buyWinRate = buyTrades.length > 0 ? (buyTrades.filter(t => t.profit > 0).length / buyTrades.length * 100) : 0;
    const sellWinRate = sellTrades.length > 0 ? (sellTrades.filter(t => t.profit > 0).length / sellTrades.length * 100) : 0;

    const equityCurve = [];
    let cumPnL = 0;
    for (const t of trades) {
      cumPnL += t.profit || 0;
      equityCurve.push({
        time: t.time,
        equity: (ai.balance || 0) + cumPnL,
        pnl: cumPnL,
        trade: t.symbol || '',
        profit: t.profit || 0,
      });
    }

    res.json({
      accountId,
      accountName: account.name,
      balance: ai.balance || 0,
      equity: ai.equity || 0,
      summary: {
        totalTrades,
        winTrades: winTrades.length,
        loseTrades: loseTrades.length,
        breakevenTrades: breakevenTrades.length,
        winRate: Math.round(winRate * 10) / 10,
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgProfit: Math.round(avgProfit * 100) / 100,
        avgWin: Math.round(avgWin * 100) / 100,
        avgLoss: Math.round(avgLoss * 100) / 100,
        profitFactor: profitFactor === Infinity ? 'Inf' : Math.round(profitFactor * 100) / 100,
        expectancy: Math.round(expectancy * 100) / 100,
        maxDrawdown: Math.round(maxDrawdown * 100) / 100,
        bestTrade: bestTrade ? { symbol: bestTrade.symbol, profit: bestTrade.profit, time: bestTrade.time } : null,
        worstTrade: worstTrade ? { symbol: worstTrade.symbol, profit: worstTrade.profit, time: worstTrade.time } : null,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        buyWinRate: Math.round(buyWinRate * 10) / 10,
        sellWinRate: Math.round(sellWinRate * 10) / 10,
      },
      dailyPnl: Object.entries(dailyPnL).map(([date, d]) => ({
        date,
        pnl: Math.round(d.pnl * 100) / 100,
        trades: d.trades,
        wins: d.wins,
        losses: d.losses,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      monthlyPnl: Object.entries(monthlyPnL).map(([month, m]) => ({
        month,
        pnl: Math.round(m.pnl * 100) / 100,
        trades: m.trades,
        wins: m.wins,
        losses: m.losses,
      })).sort((a, b) => a.month.localeCompare(b.month)),
      pairStats: pairStatsArr,
      equityCurve,
      recentTrades: trades.slice(-50).reverse(),
    });
  });

  router.get('/api/accounts/performance/all', (req, res) => {
    const allPerf = [];
    for (const account of multiAccountManager.accounts) {
      const accState = multiAccountManager.getState(account.id);
      if (!accState) continue;
      const trades = accState.tradeHistory || [];
      const ai = accState.accountInfo || {};
      const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
      const winTrades = trades.filter(t => t.profit > 0).length;
      const totalTrades = trades.length;

      allPerf.push({
        accountId: account.id,
        accountName: account.name,
        connected: account.connected,
        balance: ai.balance || 0,
        equity: ai.equity || 0,
        totalTrades,
        winRate: totalTrades > 0 ? Math.round(winTrades / totalTrades * 1000) / 10 : 0,
        totalProfit: Math.round(totalProfit * 100) / 100,
      });
    }
    res.json(allPerf);
  });

  router.post('/api/multi-auto-trader/start', (req, res) => {
    const interval = req.body.interval || 30000;
    startMultiAutoTrader(state, io, interval);
    io.emit('multi-auto-trader-status', { running: true });
    res.json({ ok: true, running: true, interval });
  });

  router.post('/api/multi-auto-trader/stop', (req, res) => {
    stopMultiAutoTrader();
    io.emit('multi-auto-trader-status', { running: false });
    res.json({ ok: true, running: false });
  });

  router.get('/api/multi-auto-trader/status', (req, res) => {
    res.json({
      running: isMultiAutoTraderRunning(),
      accounts: multiAccountManager.accounts.filter(a => a.enabled).length,
    });
  });

  return router;
}
