import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const DATA_DIR = join(__dirname, '..', 'data');

export function loadJSON(filename, fallback = {}) {
  const path = join(DATA_DIR, filename);
  if (existsSync(path)) {
    try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return fallback; }
  }
  return fallback;
}

export function saveJSON(filename, data) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

export const DEFAULT_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];

export const MODEL_MAP = {
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'llama-3.1-405b': 'openrouter/free',
  'mistral-large': 'mistralai/mistral-large-latest',
  'gemini-pro': 'google/gemini-pro-1.5',
  'deepseek-chat': 'deepseek/deepseek-chat',
  'qwen-72b': 'openrouter/free',
};

export function resolveModelId(model) {
  return MODEL_MAP[model] || model;
}

export function getSymbolType(pair) {
  const p = (pair || '').toUpperCase();
  if (p.includes('VOLATILITY') || p.includes(' synth') || /^R_\d+/.test(p)) return 'synthetic';
  if (/^(BTC|ETH|SOL|XRP|DOGE|ADA|DOT|LINK|AVAX|MATIC|UNI|LTC|BCH|ATOM|NEAR|FTM|APE|OP|ARB)/i.test(p)) return 'crypto';
  if (/^(XAU|XAG|XPT|XPD)/.test(p)) return 'metal';
  if (p.includes('JPY')) return 'forex_jpy';
  return 'forex';
}

export function getSLDivisor(pair, aggressiveness) {
  const type = getSymbolType(pair);
  if (type === 'metal') return 100;
  if (type === 'forex' || type === 'forex_jpy') return 10000;
  const mode = (aggressiveness || '').toLowerCase();
  if (mode === 'conservador') return 1000;
  if (mode === 'agressivo') return 4000;
  return 2000;
}

export function getPipDivisor(pair) {
  const type = getSymbolType(pair);
  if (type === 'metal') return 100;
  if (type === 'synthetic') return 100;
  if (type === 'crypto') return 100;
  if (type === 'forex_jpy') return 100;
  return 10000;
}

export function getDecimals(pair) {
  const type = getSymbolType(pair);
  if (type === 'metal') return 2;
  if (type === 'synthetic') return 2;
  if (type === 'crypto') return 2;
  return 5;
}

export function formatPrice(pair, price) {
  const decimals = getDecimals(pair);
  return price.toFixed(decimals);
}

export function calculateLotSize(lotSettings, accountInfo, pair, slPips = 50, entryPrice = 0) {
  const { mode, fixed_lot, monetary_value, percentage_value, min_lot, max_lot, use_lot_limits } = lotSettings;
  let lot = fixed_lot || 0.01;

  const type = getSymbolType(pair);

  if (mode === 'monetary') {
    const tickValue = type === 'synthetic' ? 1 : type === 'crypto' ? 1 : 10;
    const tickSize = getPipDivisor(pair) === 100 ? 0.01 : 0.0001;
    lot = monetary_value / (tickValue * tickSize) || fixed_lot;
  } else   if (mode === 'percentage') {
    const balance = accountInfo?.balance || 1000;
    const riskAmount = balance * (percentage_value / 100);
    const contractSize = type === 'metal' ? 100 : type === 'synthetic' ? 1 : type === 'crypto' ? 1 : 100000;
    const slDistance = type === 'metal'
      ? slPips / getPipDivisor(pair)
      : (entryPrice > 0 ? entryPrice * (slPips / getSLDivisor(pair)) : slPips / getPipDivisor(pair));
    lot = riskAmount / (slDistance * contractSize) || fixed_lot;
  }

  lot = parseFloat(lot.toFixed(2));

  if (use_lot_limits) {
    lot = Math.max(min_lot || 0.01, Math.min(max_lot || 10.0, lot));
  }

  return Math.max(0.01, lot);
}

export function normalizeVolume(lot, symInfo) {
  if (!symInfo?.exists) return Math.max(0.01, parseFloat(lot.toFixed(2)));
  const step = parseFloat(symInfo.volume_step) || 0.01;
  const minVol = parseFloat(symInfo.volume_min) || 0.01;
  const maxVol = parseFloat(symInfo.volume_max) || 100;
  if (step <= 0) return Math.max(minVol, Math.min(maxVol, lot));
  const steps = Math.round(lot / step);
  let result = steps * step;
  result = Math.max(minVol, Math.min(maxVol, result));
  return parseFloat(result.toFixed(8));
}

export function enforceSLTP(orderBody, riskSettings) {
  const order = { ...orderBody };
  if (!order.stop_loss || order.stop_loss <= 0) {
    order.stop_loss = riskSettings.ifvg_stop_loss || 50;
  }
  if (!order.take_profit || order.take_profit <= 0) {
    const sl = typeof order.stop_loss === 'number' && order.stop_loss < 1000 ? order.stop_loss : (riskSettings.ifvg_stop_loss || 50);
    order.take_profit = riskSettings.ifvg_take_profit || (sl * (riskSettings.risk_reward_ratio || 2));
  }

  if (order.stop_loss > 0 && order.stop_loss < 1000 && order.take_profit > 0 && order.take_profit < 1000) {
    const pair = order.symbol || '';
    const pipDivisor = getPipDivisor(pair);
    const decimals = getDecimals(pair);
    const price = order.price || order.entry_price || 0;
    if (price > 0) {
      const slDist = order.stop_loss / pipDivisor;
      const tpDist = order.take_profit / pipDivisor;
      order.stop_loss = order.type === 'buy'
        ? +(price - slDist).toFixed(decimals)
        : +(price + slDist).toFixed(decimals);
      order.take_profit = order.type === 'buy'
        ? +(price + tpDist).toFixed(decimals)
        : +(price - tpDist).toFixed(decimals);
    }
  }

  return order;
}
