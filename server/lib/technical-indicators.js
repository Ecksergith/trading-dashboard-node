function calculateSMA(prices, period) {
  if (prices.length < period) return prices.reduce((a, b) => a + b, 0) / prices.length;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices, period) {
  if (prices.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

function calculateMACD(prices) {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const fast = calculateEMA(prices, 12);
  const slow = calculateEMA(prices, 26);
  const macdLine = fast - slow;
  const recentSlice = prices.slice(-9);
  const signalLine = calculateEMA(recentSlice, 9);
  return {
    macd: Math.round(macdLine * 10000) / 10000,
    signal: Math.round(signalLine * 10000) / 10000,
    histogram: Math.round((macdLine - signalLine) * 10000) / 10000,
  };
}

function calculateBollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = prices.slice(-period);
  const sma = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return {
    upper: Math.round((sma + stdDev * std) * 10000) / 10000,
    middle: Math.round(sma * 10000) / 10000,
    lower: Math.round((sma - stdDev * std) * 10000) / 10000,
  };
}

function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  if (closes.length < kPeriod) return { k: 50, d: 50 };
  const sliceHigh = highs.slice(-kPeriod);
  const sliceLow = lows.slice(-kPeriod);
  const highest = Math.max(...sliceHigh);
  const lowest = Math.min(...sliceLow);
  const currentClose = closes[closes.length - 1];
  const k = highest === lowest ? 50 : ((currentClose - lowest) / (highest - lowest)) * 100;
  return { k: Math.round(k * 100) / 100, d: Math.round(k * 100) / 100 };
}

function calculateADX(highs, lows, closes, period = 14) {
  if (closes.length < period + 1) return { adx: 25, plus_di: 0, minus_di: 0 };
  let plusDM = 0, minusDM = 0, trSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM += upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM += downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    trSum += tr;
  }
  const atr = trSum / period;
  const plusDI = atr === 0 ? 0 : (plusDM / atr) * 100;
  const minusDI = atr === 0 ? 0 : (minusDM / atr) * 100;
  const dx = plusDI + minusDI === 0 ? 0 : Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  return { adx: Math.round(dx), plus_di: Math.round(plusDI * 100) / 100, minus_di: Math.round(minusDI * 100) / 100 };
}

export const technicalIndicators = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateStochastic,
  calculateADX,

  analyzeSignals(priceData) {
    if (!priceData || priceData.length < 30) {
      return { signal: 'neutral', score: 0, indicators: {} };
    }

    const closes = priceData.map(d => typeof d.close === 'number' ? d.close : (typeof d === 'number' ? d : 0));
    const highs = priceData.map(d => typeof d.high === 'number' ? d.high : (typeof d === 'number' ? d : 0));
    const lows = priceData.map(d => typeof d.low === 'number' ? d.low : (typeof d === 'number' ? d : 0));

    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);
    const bb = calculateBollingerBands(closes);
    const stoch = calculateStochastic(highs, lows, closes);
    const adx = calculateADX(highs, lows, closes);
    const sma20 = calculateSMA(closes, 20);
    const currentPrice = closes[closes.length - 1];

    let buyScore = 0;
    let sellScore = 0;

    if (rsi < 30) buyScore += 0.2;
    if (rsi > 70) sellScore += 0.2;

    if (macd.histogram > 0 && macd.macd > macd.signal) buyScore += 0.15;
    if (macd.histogram < 0 && macd.macd < macd.signal) sellScore += 0.15;

    if (currentPrice < bb.lower) buyScore += 0.15;
    if (currentPrice > bb.upper) sellScore += 0.15;

    if (stoch.k < 20) buyScore += 0.15;
    if (stoch.k > 80) sellScore += 0.15;

    if (adx.adx > 25 && adx.plus_di > adx.minus_di) buyScore += 0.15;
    if (adx.adx > 25 && adx.minus_di > adx.plus_di) sellScore += 0.15;

    if (currentPrice > sma20) buyScore += 0.1;
    if (currentPrice < sma20) sellScore += 0.1;

    let signal = 'neutral';
    let score = 0;
    if (buyScore > 0.6 && buyScore > sellScore) { signal = 'buy'; score = buyScore; }
    else if (sellScore > 0.6 && sellScore > buyScore) { signal = 'sell'; score = sellScore; }

    return {
      signal,
      score: Math.round(score * 100) / 100,
      indicators: {
        rsi: Math.round(rsi * 100) / 100,
        macd,
        bollingerBands: bb,
        stochastic: stoch,
        adx,
        sma20: Math.round(sma20 * 10000) / 10000,
        price: currentPrice,
      },
    };
  },
};
