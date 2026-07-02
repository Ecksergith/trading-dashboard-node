class AIAgent {
  constructor() {
    this.marketData = [];
    this.analysisWindow = 20;
    this.minConfidence = 0.7;
    this.currentPosition = null;
    this.tradeHistory = [];
  }

  processMarketData(price, time) {
    this.marketData.push({ price, time: time || Date.now() });
    if (this.marketData.length > 100) this.marketData.shift();
    return this.analyzeMarket();
  }

  analyzeMarket() {
    if (this.marketData.length < this.analysisWindow) {
      return { action: 'wait', confidence: 0, reason: 'Dados insuficientes', indicators: {} };
    }

    const window = this.marketData.slice(-this.analysisWindow);
    const prices = window.map(d => d.price);

    const momentum = this.calculateMomentum(prices);
    const volatility = this.calculateVolatility(prices);
    const trend = this.determineTrend(prices);
    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const sma20 = this.calculateSMA(prices, 20);
    const sma10 = this.calculateSMA(prices, 10);

    const latestPrice = prices[prices.length - 1];

    const indicators = {
      momentum: Math.round(momentum * 1000) / 1000,
      volatility: Math.round(volatility * 1000) / 1000,
      rsi: Math.round(rsi * 100) / 100,
      macd: Math.round(macd.histogram * 1000) / 1000,
      sma10: Math.round(sma10 * 10000) / 10000,
      sma20: Math.round(sma20 * 10000) / 10000,
      trend,
      price: latestPrice,
    };

    const confidence = this.calculateConfidence(trend, rsi, macd, momentum, volatility, latestPrice, sma10, sma20);

    let action = 'wait';
    let reason = 'Aguardando sinais mais fortes';

    if (trend === 'alta' && confidence >= this.minConfidence) {
      action = 'buy';
      reason = `Tendência de alta com confiança ${(confidence * 100).toFixed(1)}%. RSI: ${rsi.toFixed(1)}, MACD: ${macd.histogram.toFixed(4)}`;
    } else if (trend === 'baixa' && confidence >= this.minConfidence) {
      action = 'sell';
      reason = `Tendência de baixa com confiança ${(confidence * 100).toFixed(1)}%. RSI: ${rsi.toFixed(1)}, MACD: ${macd.histogram.toFixed(4)}`;
    } else if (this.currentPosition) {
      if (this.shouldClosePosition(trend, volatility, latestPrice)) {
        action = 'close';
        reason = 'Reversão de tendência ou atingiu SL/TP dinâmico';
      }
    }

    return { action, confidence: Math.round(confidence * 1000) / 1000, reason, indicators };
  }

  calculateConfidence(trend, rsi, macd, momentum, volatility, price, sma10, sma20) {
    let score = 0;
    const trendConsistency = Math.abs(momentum) / (volatility || 0.001);
    score += Math.min(trendConsistency, 1) * 0.3;

    if (trend === 'alta' && rsi < 70) score += 0.2;
    if (trend === 'baixa' && rsi > 30) score += 0.2;

    if (trend === 'alta' && macd.histogram > 0) score += 0.2;
    if (trend === 'baixa' && macd.histogram < 0) score += 0.2;

    if (price > sma10 && sma10 > sma20 && trend === 'alta') score += 0.15;
    if (price < sma10 && sma10 < sma20 && trend === 'baixa') score += 0.15;

    if (trend === 'lateral') score *= 0.5;

    return Math.min(score, 1);
  }

  shouldClosePosition(trend, volatility, currentPrice) {
    if (!this.currentPosition) return false;
    const entryPrice = this.currentPosition.price;
    const sl = entryPrice - 2 * volatility;
    const tp = entryPrice + 3 * volatility;

    if (this.currentPosition.type === 'buy') {
      if (currentPrice <= sl || currentPrice >= tp) return true;
      if (trend === 'baixa') return true;
    } else {
      if (currentPrice >= sl || currentPrice <= tp) return true;
      if (trend === 'alta') return true;
    }
    return false;
  }

  setPosition(type, price, time) {
    this.currentPosition = { type, price, time: time || Date.now() };
  }

  closePosition(exitPrice) {
    if (this.currentPosition) {
      const profit = this.currentPosition.type === 'buy'
        ? exitPrice - this.currentPosition.price
        : this.currentPosition.price - exitPrice;
      this.tradeHistory.push({ ...this.currentPosition, exitPrice, profit, exitTime: Date.now() });
      this.currentPosition = null;
      return profit;
    }
    return 0;
  }

  calculateMomentum(prices) {
    if (prices.length < 2) return 0;
    return prices[prices.length - 1] - prices[0];
  }

  calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance);
  }

  determineTrend(prices) {
    const momentum = this.calculateMomentum(prices);
    const volatility = this.calculateVolatility(prices);
    const ratio = Math.abs(momentum) / (volatility || 0.0001);

    if (ratio > 1.5) return momentum > 0 ? 'alta' : 'baixa';
    if (ratio < 0.5) return 'lateral';
    return momentum > 0 ? 'alta' : 'baixa';
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  }

  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;

    const recentPrices = prices.slice(-signalPeriod);
    const signalLine = this.calculateEMA(recentPrices, signalPeriod);

    return {
      macd: Math.round(macdLine * 10000) / 10000,
      signal: Math.round(signalLine * 10000) / 10000,
      histogram: Math.round((macdLine - signalLine) * 10000) / 10000,
    };
  }

  calculateEMA(prices, period) {
    if (prices.length === 0) return 0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }
}

export const aiAgent = new AIAgent();
