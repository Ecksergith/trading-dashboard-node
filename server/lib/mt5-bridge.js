const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://127.0.0.1:5000';

let _lastLogTime = 0;

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    if (!res.ok) {
      const now = Date.now();
      if (now - _lastLogTime > 10000) {
        console.log(`[MT5Bridge] HTTP ${res.status} ${url.split('?')[0]}: ${JSON.stringify(json)}`);
        _lastLogTime = now;
      }
    }
    return json;
  } catch (e) {
    const now = Date.now();
    if (now - _lastLogTime > 10000) {
      console.log(`[MT5Bridge] Fetch error ${url.split('?')[0]}: ${e.message}`);
      _lastLogTime = now;
    }
    return null;
  }
}

export const mt5Bridge = {
  async getAccountInfo() {
    const data = await safeFetch(`${MT5_BRIDGE_URL}/status`);
    if (data?.connected) {
      return {
        connected: true,
        login: data.login || '-',
        server: data.server || '-',
        balance: data.balance || 0,
        equity: data.equity || 0,
        margin_free: data.margin_free || 0,
        leverage: data.leverage || 0,
        company: data.company || '-',
        currency: data.currency || '-',
        profit: data.profit || 0,
        name: data.name || '',
        latency: data.latency || 'N/A',
      };
    }
    return {
      connected: false,
      server: 'Desconectado',
      login: '-',
      balance: 0,
      equity: 0,
      margin_free: 0,
      leverage: 0,
      company: '-',
      currency: '-',
      profit: 0,
    };
  },

  async getPositions() {
    const data = await safeFetch(`${MT5_BRIDGE_URL}/positions`);
    return data?.value || data || [];
  },

  async sendOrder(order) {
    const result = await safeFetch(`${MT5_BRIDGE_URL}/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    return result || { error: 'Bridge unreachable' };
  },

  async getRates(pair, timeframe = 'M5') {
    const tfMap = {
      M1: 1, M5: 5, M15: 15, M30: 30,
      H1: 16385, H4: 16388, D1: 16408, W1: 32769, MN1: 49153,
    };
    const tf = tfMap[timeframe] || 5;
    const data = await safeFetch(`${MT5_BRIDGE_URL}/rates?symbol=${encodeURIComponent(pair)}&timeframe=${tf}&count=200`);
    return Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : Array.isArray(data?.rates) ? data.rates : [];
  },

  async getCurrentTick(pair) {
    try {
      const data = await safeFetch(`${MT5_BRIDGE_URL}/symbol_info_tick?symbol=${encodeURIComponent(pair)}`);
      return data || null;
    } catch {
      return null;
    }
  },

  async getSymbolInfo(symbol) {
    return await safeFetch(`${MT5_BRIDGE_URL}/symbol_info?symbol=${encodeURIComponent(symbol)}`);
  },

  async getSymbols() {
    const data = await safeFetch(`${MT5_BRIDGE_URL}/symbols`);
    return data || [];
  },

  async closePosition(ticket) {
    return await safeFetch(`${MT5_BRIDGE_URL}/close_position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket }),
    }) || { error: 'Bridge unreachable' };
  },

  async modifyPosition(ticket, sl, tp) {
    return await safeFetch(`${MT5_BRIDGE_URL}/modify_position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticket, sl: Number(sl) || 0, tp: Number(tp) || 0 }),
    }) || { error: 'Bridge unreachable' };
  },
};
