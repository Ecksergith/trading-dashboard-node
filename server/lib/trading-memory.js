import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { patternDB } from './pattern-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = join(__dirname, '..', 'data', 'trading_patterns.json');

class TradingMemory {
  constructor() {
    this.patterns = this.load();
    this.similarityThreshold = 0.85;
    this.minSuccessRate = 0.6;
  }

  load() {
    if (existsSync(DATA_FILE)) {
      try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')); } catch { return { groups: [] }; }
    }
    return { groups: [] };
  }

  save() {
    writeFileSync(DATA_FILE, JSON.stringify(this.patterns, null, 2));
  }

  extractFeatures(prices) {
    if (!prices || prices.length < 5) return null;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = arr => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
    };

    const momentum = prices[prices.length - 1] - prices[0];
    const volatility = std(returns);
    const trend = momentum > 0 ? 1 : momentum < 0 ? -1 : 0;

    return {
      price_mean: mean(prices),
      price_std: std(prices),
      returns_mean: mean(returns),
      returns_std: std(returns),
      momentum,
      volatility,
      trend_direction: trend,
    };
  }

  calculateSimilarity(f1, f2) {
    if (!f1 || !f2) return 0;
    const keys = ['price_mean', 'price_std', 'returns_mean', 'returns_std', 'momentum', 'volatility', 'trend_direction'];
    let totalSim = 0;
    for (const key of keys) {
      const maxVal = Math.max(Math.abs(f1[key]), Math.abs(f2[key]), 0.0001);
      totalSim += 1 - Math.abs(f1[key] - f2[key]) / maxVal;
    }
    return totalSim / keys.length;
  }

  recordPattern(prices, action, profit, pair) {
    const features = this.extractFeatures(prices);
    if (!features) return;

    let addedToGroup = false;
    for (const group of this.patterns.groups) {
      if (this.calculateSimilarity(features, group.features) > this.similarityThreshold) {
        group.trades.push({ action, profit, time: Date.now() });
        const wins = group.trades.filter(t => t.profit > 0).length;
        group.success_rate = wins / group.trades.length;
        group.features = features;
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      this.patterns.groups.push({
        features,
        trades: [{ action, profit, time: Date.now() }],
        success_rate: profit > 0 ? 1 : 0,
      });
    }
    this.save();

    console.log(`[TradingMemory] patternDB.record chamado: pair=${pair} action=${action} profit=${profit} prices_len=${prices?.length || 0}`);
    const result = patternDB.record(prices, action, profit, pair || 'UNKNOWN');
    if (result === null) {
      console.log('[TradingMemory] patternDB.record retornou null - possivel problema nos dados');
    } else {
      console.log(`[TradingMemory] patternDB.record OK: id=${result}`);
    }
  }

  getRecommendation(prices) {
    const dbResult = patternDB.recommend(prices);
    if (dbResult.action !== 'wait' && dbResult.confidence > 0.3) {
      return dbResult;
    }

    const features = this.extractFeatures(prices);
    if (!features) return { action: 'wait', confidence: 0 };

    let bestGroup = null;
    let bestSimilarity = 0;

    for (const group of this.patterns.groups) {
      const sim = this.calculateSimilarity(features, group.features);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestGroup = group;
      }
    }

    if (!bestGroup || bestSimilarity < 0.7 || bestGroup.success_rate < this.minSuccessRate) {
      return { action: 'wait', confidence: 0 };
    }

    const recentTrades = bestGroup.trades.slice(-10);
    const buyTrades = recentTrades.filter(t => t.action === 'buy');
    const sellTrades = recentTrades.filter(t => t.action === 'sell');
    const buyWins = buyTrades.filter(t => t.profit > 0).length;
    const sellWins = sellTrades.filter(t => t.profit > 0).length;

    if (buyWins > sellWins && buyTrades.length > 0) {
      return { action: 'buy', confidence: bestSimilarity * bestGroup.success_rate };
    } else if (sellWins > buyWins && sellTrades.length > 0) {
      return { action: 'sell', confidence: bestSimilarity * bestGroup.success_rate };
    }
    return { action: 'wait', confidence: 0 };
  }
}

export const tradingMemory = new TradingMemory();
