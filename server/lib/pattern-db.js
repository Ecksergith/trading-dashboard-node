import { loadJSON, saveJSON } from './constants.js';
import { createLogger } from './logger.js';

const log = createLogger('[PatternDB]');
const PATTERN_FILE = 'pattern_database.json';

const DEFAULT_DB = {
  patterns: {},
  metadata: { totalPatterns: 0, totalOccurrences: 0, lastUpdated: null },
};

class PatternDB {
  constructor() {
    this.db = loadJSON(PATTERN_FILE, DEFAULT_DB);
    this.minOccurrences = 5;
    this.similarityThreshold = 0.82;
    this.pruneInterval = 500;
    this.occurrenceCount = 0;
    const count = Object.keys(this.db.patterns).length;
    log(`Inicializado - ${count} padroes carregados de ${PATTERN_FILE}`);
  }

  save() {
    this.db.metadata.totalPatterns = Object.keys(this.db.patterns).length;
    this.db.metadata.lastUpdated = Date.now();
    try {
      saveJSON(PATTERN_FILE, this.db);
      log(`Arquivo salvo: ${PATTERN_FILE} (${this.db.metadata.totalPatterns} padroes)`);
    } catch (e) {
      log(`ERRO ao salvar ${PATTERN_FILE}: ${e.message}`);
    }
  }

  fingerprint(closes, indicators = {}) {
    if (!closes || closes.length < 5) return null;
    const n = closes.length;
    const rets = [];
    for (let i = 1; i < n; i++) {
      const prev = closes[i - 1];
      if (!prev || prev === 0) return null;
      rets.push((closes[i] - prev) / prev);
    }
    if (rets.some(r => !isFinite(r))) return null;
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = arr => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length) || 0.00001;
    };
    const m = mean(rets);
    const s = std(rets);
    if (s === 0 || !isFinite(s)) return null;
    const skew = rets.reduce((a, r) => a + ((r - m) ** 3), 0) / (rets.length * s ** 3);
    const kurtosis = rets.reduce((a, r) => a + ((r - m) ** 4), 0) / (rets.length * s ** 4) - 3;
    if (!closes[0] || closes[0] === 0) return null;
    const range = (Math.max(...closes) - Math.min(...closes)) / closes[0];
    const last3 = closes.slice(-3);
    const bodyDir = last3[2] > last3[0] ? 1 : last3[2] < last3[0] ? -1 : 0;
    const candleSizes = [];
    for (let i = 1; i < last3.length; i++) {
      const prev = last3[i - 1];
      if (prev && prev !== 0) {
        candleSizes.push(Math.abs(last3[i] - prev) / prev);
      }
    }
    const acceleration = candleSizes.length > 1 ? candleSizes[1] - candleSizes[0] : 0;
    const volBuckets = 5;
    const volHist = new Array(volBuckets).fill(0);
    for (const r of rets) {
      const idx = Math.min(Math.floor(Math.abs(r) / s * 2), volBuckets - 1);
      volHist[idx]++;
    }
    for (let i = 0; i < volHist.length; i++) {
      volHist[i] = volHist[i] / rets.length;
    }
    const safe = v => (isFinite(v) ? v : 0);
    const pattern = {
      ret_mean: parseFloat(safe(m).toFixed(8)),
      ret_std: parseFloat(safe(s).toFixed(8)),
      skewness: parseFloat(safe(skew).toFixed(4)),
      kurtosis: parseFloat(safe(kurtosis).toFixed(4)),
      range: parseFloat(safe(range).toFixed(6)),
      body_direction: bodyDir,
      acceleration: parseFloat(safe(acceleration).toFixed(8)),
      vol_shape: volHist.map(v => parseFloat(safe(v).toFixed(4))),
      rsi: indicators.rsi != null ? parseFloat((indicators.rsi / 100).toFixed(2)) : null,
      ema_cross: indicators.ema_cross || null,
      trend_strength: indicators.trend_strength != null ? parseFloat(indicators.trend_strength.toFixed(2)) : null,
    };
    return pattern;
  }

  similarity(a, b) {
    if (!a || !b) return 0;
    const scalarKeys = ['ret_mean', 'ret_std', 'skewness', 'kurtosis', 'range', 'body_direction', 'acceleration'];
    let score = 0;
    let count = 0;
    for (const k of scalarKeys) {
      if (a[k] == null || b[k] == null) continue;
      const maxV = Math.max(Math.abs(a[k]), Math.abs(b[k]), 0.000001);
      score += 1 - Math.min(Math.abs(a[k] - b[k]) / maxV, 1);
      count++;
    }
    if (a.vol_shape && b.vol_shape && a.vol_shape.length === b.vol_shape.length) {
      let vSim = 0;
      for (let i = 0; i < a.vol_shape.length; i++) {
        vSim += 1 - Math.abs(a.vol_shape[i] - b.vol_shape[i]);
      }
      score += vSim / a.vol_shape.length;
      count++;
    }
    if (a.rsi != null && b.rsi != null) {
      score += 1 - Math.abs(a.rsi - b.rsi);
      count++;
    }
    if (a.ema_cross != null && b.ema_cross != null) {
      score += a.ema_cross === b.ema_cross ? 1 : 0;
      count++;
    }
    if (a.trend_strength != null && b.trend_strength != null) {
      score += 1 - Math.abs(a.trend_strength - b.trend_strength);
      count++;
    }
    return count > 0 ? score / count : 0;
  }

  sharpeRatio(returns) {
    if (!returns || returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
    const std = Math.sqrt(variance);
    if (std === 0) return mean > 0 ? 10 : 0;
    return mean / std;
  }

  sortinoRatio(returns) {
    if (!returns || returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < 0);
    if (downsideReturns.length === 0) return mean > 0 ? 10 : 0;
    const downsideVar = downsideReturns.reduce((a, r) => a + r ** 2, 0) / downsideReturns.length;
    const downsideStd = Math.sqrt(downsideVar);
    return downsideStd === 0 ? 0 : mean / downsideStd;
  }

  calmarRatio(returns) {
    if (!returns || returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    let peak = 0;
    let maxDD = 0;
    let cumulative = 0;
    for (const r of returns) {
      cumulative += r;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD === 0 ? (mean > 0 ? 10 : 0) : mean / maxDD;
  }

  findOrCreate(fp, closes) {
    let bestId = null;
    let bestSim = 0;
    for (const [id, pattern] of Object.entries(this.db.patterns)) {
      const sim = this.similarity(fp, pattern.fingerprint);
      if (sim > bestSim) {
        bestSim = sim;
        bestId = id;
      }
    }
    if (bestSim >= this.similarityThreshold && bestId) {
      return bestId;
    }
    const id = this.generateId(fp, closes);
    this.db.patterns[id] = {
      fingerprint: fp,
      occurrences: 0,
      wins: 0,
      losses: 0,
      returns: [],
      trades: [],
      winRate: 0,
      sharpe: 0,
      sortino: 0,
      calmar: 0,
      avgReturn: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      expectancy: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      pairs: {},
    };
    return id;
  }

  generateId(fp, closes) {
    const seed = closes.slice(-5).map(c => c.toFixed(6)).join('_');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    }
    const rand = Math.random().toString(36).substring(2, 8);
    return `p_${Math.abs(hash).toString(36)}_${rand}`;
  }

  record(closes, action, profit, pair, indicators = {}) {
    try {
      if (!closes || closes.length < 5) {
        log(`record() chamado com dados insuficientes: ${closes?.length || 0} closes`);
        return null;
      }
      const fp = this.fingerprint(closes, indicators);
      if (!fp) {
        log(`fingerprint retornou null - ${closes.length} closes, primeiro=${closes[0]}, ultimo=${closes[closes.length-1]}`);
        return null;
      }
      const id = this.findOrCreate(fp, closes);
      const pattern = this.db.patterns[id];
      pattern.occurrences++;
      pattern.lastSeen = Date.now();
      const lastPrice = closes[closes.length - 1];
      const ret = (lastPrice && lastPrice > 0) ? profit / (lastPrice * 0.01) : 0;
      pattern.returns.push(isFinite(ret) ? ret : 0);
      if (pattern.returns.length > 500) pattern.returns = pattern.returns.slice(-500);
      const isWin = profit > 0;
      if (isWin) pattern.wins++;
      else pattern.losses++;
      pattern.trades.push({ action, profit, pair, time: Date.now() });
      if (pattern.trades.length > 200) pattern.trades = pattern.trades.slice(-200);
      if (!pattern.pairs[pair]) pattern.pairs[pair] = { count: 0, wins: 0 };
      pattern.pairs[pair].count++;
      if (isWin) pattern.pairs[pair].wins++;
      this.recalculate(id);
      this.occurrenceCount++;
      this.save();
      if (this.occurrenceCount % this.pruneInterval === 0) {
        this.prune();
      }
      log(`Pattern registrado: ${id} | pair=${pair} | action=${action} | profit=${profit} | total=${Object.keys(this.db.patterns).length}`);
      return id;
    } catch (e) {
      log(`ERRO ao registrar pattern: ${e.message}`);
      return null;
    }
  }

  recalculate(id) {
    const p = this.db.patterns[id];
    if (!p) return;
    p.winRate = p.occurrences > 0 ? p.wins / p.occurrences : 0;
    p.sharpe = this.sharpeRatio(p.returns);
    p.sortino = this.sortinoRatio(p.returns);
    p.calmar = this.calmarRatio(p.returns);
    p.avgReturn = p.returns.length > 0
      ? p.returns.reduce((a, b) => a + b, 0) / p.returns.length
      : 0;
    const wins = p.returns.filter(r => r > 0);
    const losses = p.returns.filter(r => r < 0);
    const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / losses.length : 0;
    p.profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (avgWin > 0 ? 10 : 0);
    p.expectancy = p.winRate * avgWin + (1 - p.winRate) * avgLoss;
    let peak = 0;
    let cum = 0;
    let maxDD = 0;
    for (const r of p.returns) {
      cum += r;
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDD) maxDD = dd;
    }
    p.maxDrawdown = maxDD;
  }

  recommend(closes, indicators = {}) {
    const fp = this.fingerprint(closes, indicators);
    if (!fp) return { action: 'wait', confidence: 0, patterns: [] };
    const candidates = [];
    for (const [id, pattern] of Object.entries(this.db.patterns)) {
      if (pattern.occurrences < this.minOccurrences) continue;
      const sim = this.similarity(fp, pattern.fingerprint);
      if (sim < 0.6) continue;
      candidates.push({ id, pattern, similarity: sim });
    }
    if (candidates.length === 0) return { action: 'wait', confidence: 0, patterns: [] };
    candidates.sort((a, b) => {
      const scoreA = a.similarity * 0.3 + a.pattern.sharpe * 0.3 + a.pattern.winRate * 0.4;
      const scoreB = b.similarity * 0.3 + b.pattern.sharpe * 0.3 + b.pattern.winRate * 0.4;
      return scoreB - scoreA;
    });
    const best = candidates[0];
    if (best.similarity < 0.7) return { action: 'wait', confidence: 0, patterns: candidates.slice(0, 3) };
    const buyTrades = best.pattern.trades.filter(t => t.action === 'buy');
    const sellTrades = best.pattern.trades.filter(t => t.action === 'sell');
    const buyWR = buyTrades.length > 0 ? buyTrades.filter(t => t.profit > 0).length / buyTrades.length : 0;
    const sellWR = sellTrades.length > 0 ? sellTrades.filter(t => t.profit > 0).length / sellTrades.length : 0;
    let action = 'wait';
    let confidence = 0;
    const sigBonus = best.pattern.occurrences >= 20 ? 0.1 : 0;
    if (buyWR > sellWR && buyWR > 0.55 && buyTrades.length >= 3) {
      action = 'buy';
      confidence = best.similarity * best.pattern.winRate * (1 + sigBonus);
    } else if (sellWR > buyWR && sellWR > 0.55 && sellTrades.length >= 3) {
      action = 'sell';
      confidence = best.similarity * best.pattern.winRate * (1 + sigBonus);
    }
    confidence = Math.min(confidence, 0.95);
    return {
      action,
      confidence: parseFloat(confidence.toFixed(3)),
      patterns: candidates.slice(0, 5).map(c => ({
        id: c.id,
        similarity: parseFloat(c.similarity.toFixed(3)),
        winRate: parseFloat((c.pattern.winRate * 100).toFixed(1)),
        sharpe: parseFloat(c.pattern.sharpe.toFixed(2)),
        sortino: parseFloat(c.pattern.sortino.toFixed(2)),
        occurrences: c.pattern.occurrences,
        profitFactor: parseFloat(c.pattern.profitFactor.toFixed(2)),
        expectancy: parseFloat(c.pattern.expectancy.toFixed(4)),
      })),
    };
  }

  prune() {
    const ids = Object.keys(this.db.patterns);
    let removed = 0;
    for (const id of ids) {
      const p = this.db.patterns[id];
      const age = Date.now() - p.lastSeen;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (age > thirtyDays && p.occurrences < this.minOccurrences) {
        delete this.db.patterns[id];
        removed++;
      }
    }
    if (removed > 0) {
      log(`Podados ${removed} padroes antigos/inutilizados`);
      this.save();
    }
  }

  getStats() {
    const patterns = Object.values(this.db.patterns);
    const active = patterns.filter(p => p.occurrences >= this.minOccurrences);
    const avgWinRate = active.length > 0
      ? active.reduce((a, p) => a + p.winRate, 0) / active.length
      : 0;
    const avgSharpe = active.length > 0
      ? active.reduce((a, p) => a + p.sharpe, 0) / active.length
      : 0;
    const sorted = [...active].sort((a, b) => b.sharpe - a.sharpe);
    const bestPattern = sorted[0] || null;
    const worstPattern = sorted[sorted.length - 1] || null;
    const patternList = patterns
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 50)
      .map(p => ({
        occurrences: p.occurrences,
        winRate: parseFloat((p.winRate * 100).toFixed(1)),
        sharpe: parseFloat(p.sharpe.toFixed(2)),
        sortino: parseFloat(p.sortino.toFixed(2)),
        profitFactor: parseFloat(p.profitFactor.toFixed(2)),
        expectancy: parseFloat(p.expectancy.toFixed(4)),
        maxDrawdown: parseFloat(p.maxDrawdown.toFixed(4)),
        wins: p.wins,
        losses: p.losses,
        pairs: Object.keys(p.pairs),
        lastSeen: p.lastSeen,
      }));
    return {
      totalPatterns: patterns.length,
      activePatterns: active.length,
      avgWinRate: parseFloat((avgWinRate * 100).toFixed(1)),
      avgSharpe: parseFloat(avgSharpe.toFixed(2)),
      lastUpdated: this.db.metadata.lastUpdated,
      bestPattern: bestPattern ? {
        winRate: parseFloat((bestPattern.winRate * 100).toFixed(1)),
        sharpe: parseFloat(bestPattern.sharpe.toFixed(2)),
        occurrences: bestPattern.occurrences,
        pairs: Object.keys(bestPattern.pairs),
      } : null,
      worstPattern: worstPattern ? {
        winRate: parseFloat((worstPattern.winRate * 100).toFixed(1)),
        sharpe: parseFloat(worstPattern.sharpe.toFixed(2)),
        occurrences: worstPattern.occurrences,
        pairs: Object.keys(worstPattern.pairs),
      } : null,
      patterns: patternList,
    };
  }

  getByPair(pair) {
    const results = [];
    for (const [id, p] of Object.entries(this.db.patterns)) {
      if (p.occurrences < this.minOccurrences) continue;
      if (p.pairs[pair] && p.pairs[pair].count >= 3) {
        results.push({
          id,
          winRate: parseFloat((p.winRate * 100).toFixed(1)),
          sharpe: parseFloat(p.sharpe.toFixed(2)),
          occurrences: p.pairs[pair].count,
          pairWinRate: parseFloat((p.pairs[pair].wins / p.pairs[pair].count * 100).toFixed(1)),
        });
      }
    }
    return results.sort((a, b) => b.sharpe - a.sharpe);
  }
}

export const patternDB = new PatternDB();
