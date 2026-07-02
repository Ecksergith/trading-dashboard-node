const CCI_PERIOD = 20;
const MAX_RECORDS = 200;

class CCIEngine {
  constructor() {
    this.prices = [];
    this.cciData = [];
  }

  addPrice(priceData) {
    if (typeof priceData === 'number') {
      priceData = { time: Date.now(), high: priceData, low: priceData, close: priceData };
    }
    this.prices.push(priceData);
    if (this.prices.length > MAX_RECORDS) this.prices.shift();
    this.recalculate();
  }

  recalculate() {
    if (this.prices.length < CCI_PERIOD) {
      this.cciData = [];
      return;
    }
    this.cciData = [];
    for (let i = CCI_PERIOD - 1; i < this.prices.length; i++) {
      const window = this.prices.slice(i - CCI_PERIOD + 1, i + 1);
      const typicalPrices = window.map(p => (p.high + p.low + p.close) / 3);
      const sma = typicalPrices.reduce((a, b) => a + b, 0) / CCI_PERIOD;
      const meanDeviation = typicalPrices.reduce((a, b) => a + Math.abs(b - sma), 0) / CCI_PERIOD;
      const tp = typicalPrices[typicalPrices.length - 1];
      const cci = meanDeviation === 0 ? 0 : (tp - sma) / (0.015 * meanDeviation);
      this.cciData.push({ time: this.prices[i].time || i, value: Math.round(cci * 100) / 100 });
    }
  }

  getData() {
    return { cci: this.cciData, period: CCI_PERIOD, count: this.cciData.length };
  }

  getLatest() {
    return this.cciData.length ? this.cciData[this.cciData.length - 1] : { value: 0 };
  }
}

export const cciEngine = new CCIEngine();
