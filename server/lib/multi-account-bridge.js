import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const ACCOUNTS_FILE = join(DATA_DIR, 'trading_accounts.json');

const DEFAULT_ACCOUNT = {
  id: 'default',
  name: 'Conta Principal',
  bridgeUrl: 'http://127.0.0.1:5000',
  enabled: true,
  connected: false,
  accountInfo: null,
  riskSettings: {},
  lotSettings: {},
};

function loadAccounts() {
  if (existsSync(ACCOUNTS_FILE)) {
    try { return JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf8')); } catch {}
  }
  return { accounts: [{ ...DEFAULT_ACCOUNT }] };
}

function saveAccounts(data) {
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
}

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

function createBridge(bridgeUrl) {
  return {
    async getAccountInfo() {
      const data = await safeFetch(`${bridgeUrl}/status`);
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
        connected: false, server: 'Desconectado', login: '-', balance: 0,
        equity: 0, margin_free: 0, leverage: 0, company: '-', currency: '-', profit: 0,
      };
    },

    async getPositions() {
      const data = await safeFetch(`${bridgeUrl}/positions`);
      return data?.value || data || [];
    },

    async sendOrder(order) {
      return await safeFetch(`${bridgeUrl}/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      }) || { error: 'Bridge unreachable' };
    },

    async getRates(pair, timeframe = 'M5') {
      const tfMap = { M1: 1, M5: 5, M15: 15, M30: 30, H1: 16385, H4: 16388, D1: 16408, W1: 32769, MN1: 49153 };
      const tf = tfMap[timeframe] || 5;
      const data = await safeFetch(`${bridgeUrl}/rates?symbol=${encodeURIComponent(pair)}&timeframe=${tf}&count=200`);
      return data || [];
    },

    async getSymbolInfo(symbol) {
      return await safeFetch(`${bridgeUrl}/symbol_info?symbol=${encodeURIComponent(symbol)}`);
    },

    async getSymbols() {
      const data = await safeFetch(`${bridgeUrl}/symbols`);
      return data || [];
    },

    async closePosition(ticket) {
      return await safeFetch(`${bridgeUrl}/close_position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      }) || { error: 'Bridge unreachable' };
    },

    async modifyPosition(ticket, sl, tp) {
      return await safeFetch(`${bridgeUrl}/modify_position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, sl, tp }),
      }) || { error: 'Bridge unreachable' };
    },
  };
}

class MultiAccountManager {
  constructor() {
    const stored = loadAccounts();
    this.accounts = stored.accounts || [DEFAULT_ACCOUNT];
    this.bridges = new Map();
    this.accountStates = new Map();

    for (const acc of this.accounts) {
      this.bridges.set(acc.id, createBridge(acc.bridgeUrl));
      this.accountStates.set(acc.id, {
        accountInfo: null,
        openPositions: [],
        priceData: {},
        tradeHistory: [],
        equityHistory: [],
      });
    }
  }

  getAll() {
    return this.accounts.map(acc => ({
      ...acc,
      accountInfo: this.accountStates.get(acc.id)?.accountInfo || null,
      openPositions: this.accountStates.get(acc.id)?.openPositions || [],
    }));
  }

  getById(id) {
    return this.accounts.find(a => a.id === id) || null;
  }

  getBridge(id) {
    return this.bridges.get(id) || null;
  }

  getState(id) {
    return this.accountStates.get(id) || null;
  }

  add(accountData) {
    const id = accountData.id || `acc_${Date.now()}`;
    const account = {
      id,
      name: accountData.name || `Conta ${this.accounts.length + 1}`,
      bridgeUrl: accountData.bridgeUrl || 'http://127.0.0.1:5000',
      enabled: accountData.enabled !== false,
      connected: false,
      accountInfo: null,
      riskSettings: accountData.riskSettings || {},
      lotSettings: accountData.lotSettings || {},
    };
    this.accounts.push(account);
    this.bridges.set(id, createBridge(account.bridgeUrl));
    this.accountStates.set(id, {
      accountInfo: null, openPositions: [], priceData: {}, tradeHistory: [], equityHistory: [],
    });
    this._save();
    return account;
  }

  update(id, data) {
    const idx = this.accounts.findIndex(a => a.id === id);
    if (idx === -1) return null;
    const acc = this.accounts[idx];
    Object.assign(acc, data);
    if (data.bridgeUrl && data.bridgeUrl !== acc.bridgeUrl) {
      this.bridges.set(id, createBridge(data.bridgeUrl));
    }
    this._save();
    return acc;
  }

  remove(id) {
    if (id === 'default') return false;
    this.accounts = this.accounts.filter(a => a.id !== id);
    this.bridges.delete(id);
    this.accountStates.delete(id);
    this._save();
    return true;
  }

  _save() {
    saveAccounts({ accounts: this.accounts });
  }

  async refreshAll() {
    const results = [];
    for (const acc of this.accounts) {
      if (!acc.enabled) continue;
      try {
        const bridge = this.bridges.get(acc.id);
        const st = this.accountStates.get(acc.id);
        st.accountInfo = await bridge.getAccountInfo();
        st.openPositions = await bridge.getPositions();
        acc.connected = st.accountInfo?.connected || false;
        acc.accountInfo = st.accountInfo;
        results.push({ id: acc.id, connected: acc.connected });
      } catch {
        acc.connected = false;
        results.push({ id: acc.id, connected: false });
      }
    }
    return results;
  }

  getConsolidatedSummary() {
    let totalBalance = 0;
    let totalEquity = 0;
    let totalProfit = 0;
    let totalPositions = 0;
    let connectedCount = 0;
    const allTrades = [];

    for (const acc of this.accounts) {
      if (!acc.enabled) continue;
      const st = this.accountStates.get(acc.id);
      if (st?.accountInfo?.connected) {
        connectedCount++;
        totalBalance += st.accountInfo.balance || 0;
        totalEquity += st.accountInfo.equity || 0;
        totalProfit += st.accountInfo.profit || 0;
      }
      totalPositions += st?.openPositions?.length || 0;
      if (st?.tradeHistory) allTrades.push(...st.tradeHistory);
    }

    const totalTrades = allTrades.length;
    const winningTrades = allTrades.filter(t => t.profit > 0).length;
    const totalPnL = allTrades.reduce((s, t) => s + (t.profit || 0), 0);

    return {
      accounts: this.accounts.length,
      connected: connectedCount,
      totalBalance: Math.round(totalBalance * 100) / 100,
      totalEquity: Math.round(totalEquity * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalPositions,
      totalTrades,
      winningTrades,
      winRate: totalTrades > 0 ? Math.round(winningTrades / totalTrades * 1000) / 10 : 0,
      totalPnL: Math.round(totalPnL * 100) / 100,
    };
  }
}

export const multiAccountManager = new MultiAccountManager();
