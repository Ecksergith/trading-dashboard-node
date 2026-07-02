import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];

const DATABASE_URL = process.env.DATABASE_URL || '';
const usePG = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');

let db; // SQLite handle (only when usePG is false)
let pool; // PG pool (only when usePG is true)

if (usePG) {
  const pg = await import('pg');
  const { Pool } = pg;
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : false,
  });
  console.log('[DB] Using PostgreSQL');
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const DB_PATH = join(DATA_DIR, 'trading_saas.db');
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  console.log('[DB] Using SQLite (local dev)');
}

async function initSchema() {
  if (usePG) {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_states (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        risk_settings JSONB NOT NULL DEFAULT '{}',
        lot_settings JSONB NOT NULL DEFAULT '{}',
        ai_agent_settings JSONB NOT NULL DEFAULT '{}',
        pairs JSONB NOT NULL DEFAULT '[]',
        model_counters JSONB NOT NULL DEFAULT '{}',
        equity_history JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS trades (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        volume DOUBLE PRECISION NOT NULL,
        price DOUBLE PRECISION NOT NULL,
        exit_price DOUBLE PRECISION,
        ticket BIGINT,
        profit DOUBLE PRECISION NOT NULL DEFAULT 0,
        source TEXT,
        signal_source TEXT,
        reason TEXT,
        confidence DOUBLE PRECISION,
        market_context JSONB,
        strategy TEXT,
        time TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_time ON trades(time);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol);
    `);
    await pool.query("UPDATE users SET role = 'admin' WHERE email = 'admin@ukulotrade.com'");
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'active',
        last_login TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS user_states (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        risk_settings TEXT NOT NULL DEFAULT '{}',
        lot_settings TEXT NOT NULL DEFAULT '{}',
        ai_agent_settings TEXT NOT NULL DEFAULT '{}',
        pairs TEXT NOT NULL DEFAULT '[]',
        model_counters TEXT NOT NULL DEFAULT '{}',
        equity_history TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL,
        volume REAL NOT NULL,
        price REAL NOT NULL,
        exit_price REAL,
        ticket INTEGER,
        profit REAL NOT NULL DEFAULT 0,
        source TEXT,
        signal_source TEXT,
        reason TEXT,
        confidence REAL,
        market_context TEXT,
        strategy TEXT,
        time TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
      CREATE INDEX IF NOT EXISTS idx_trades_time ON trades(time);
      CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol);
      CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol);
    `);
    try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
    try { db.exec("ALTER TABLE users ADD COLUMN last_login TEXT"); } catch {}
    try { db.exec("ALTER TABLE trades ADD COLUMN reason TEXT"); } catch {}
    try { db.exec("ALTER TABLE trades ADD COLUMN confidence REAL"); } catch {}
    try { db.exec("ALTER TABLE trades ADD COLUMN market_context TEXT"); } catch {}
    try { db.exec("ALTER TABLE trades ADD COLUMN strategy TEXT"); } catch {}
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)"); } catch {}
    try { db.exec("CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON trades(user_id, symbol)"); } catch {}
    db.exec("UPDATE users SET role = 'admin' WHERE email = 'admin@ukulotrade.com'");
  }
}

await initSchema();

// ── Helpers ──────────────────────────────────────────────

function pgQ(sql, params = []) {
  return pool.query(sql, params);
}

// ── Exports ──────────────────────────────────────────────

export function generateId() {
  return crypto.randomUUID();
}

export async function getUserByEmail(email) {
  if (usePG) {
    const { rows } = await pgQ('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  }
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

export async function getUserById(id) {
  if (usePG) {
    const { rows } = await pgQ('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

export async function getAllUsers() {
  if (usePG) {
    const { rows } = await pgQ('SELECT id, email, name, role, status, last_login, created_at FROM users ORDER BY created_at DESC');
    return rows;
  }
  return db.prepare('SELECT id, email, name, role, status, last_login, created_at FROM users ORDER BY created_at DESC').all();
}

export async function getAllUsersWithStats() {
  if (usePG) {
    const { rows: users } = await pgQ('SELECT id, email, name, role, status, last_login, created_at FROM users ORDER BY created_at DESC');
    const { rows: states } = await pgQ('SELECT user_id, equity_history FROM user_states');
    const stateMap = {};
    for (const s of states) {
      const hist = Array.isArray(s.equity_history) ? s.equity_history : [];
      const last = hist[hist.length - 1];
      stateMap[s.user_id] = last ? { balance: last.balance || 0, equity: last.equity || 0 } : { balance: 0, equity: 0 };
    }
    const results = [];
    for (const u of users) {
      const trades = await getTrades(u.id, 10000);
      const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
      const bal = stateMap[u.id] || { balance: 0, equity: 0 };
      results.push({ ...u, totalTrades: trades.length, totalProfit: parseFloat(totalProfit.toFixed(2)), balance: bal.balance, equity: bal.equity });
    }
    return results;
  }
  const users = db.prepare('SELECT id, email, name, role, status, last_login, created_at FROM users ORDER BY created_at DESC').all();
  const states = db.prepare('SELECT user_id, equity_history FROM user_states').all();
  const stateMap = {};
  for (const s of states) {
    const hist = JSON.parse(s.equity_history || '[]');
    const last = hist[hist.length - 1];
    stateMap[s.user_id] = last ? { balance: last.balance || 0, equity: last.equity || 0 } : { balance: 0, equity: 0 };
  }
  return users.map(u => {
    const trades = db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY time DESC LIMIT ?').all(u.id, 10000);
    const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
    const bal = stateMap[u.id] || { balance: 0, equity: 0 };
    return { ...u, totalTrades: trades.length, totalProfit: parseFloat(totalProfit.toFixed(2)), balance: bal.balance, equity: bal.equity };
  });
}

export async function createUser({ email, passwordHash, name, role = 'user' }) {
  const id = generateId();
  if (usePG) {
    await pgQ('INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)', [id, email, passwordHash, name, role]);
    const stateId = generateId();
    await pgQ('INSERT INTO user_states (id, user_id, pairs) VALUES ($1, $2, $3)', [stateId, id, JSON.stringify(DEFAULT_PAIRS)]);
  } else {
    db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)').run(id, email, passwordHash, name, role);
    const stateId = generateId();
    db.prepare('INSERT INTO user_states (id, user_id, pairs) VALUES (?, ?, ?)').run(stateId, id, JSON.stringify(DEFAULT_PAIRS));
  }
  return getUserById(id);
}

export async function updateUser(id, fields) {
  const allowed = ['name', 'role', 'status', 'last_login'];
  if (usePG) {
    const updates = []; const values = []; let idx = 1;
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = $${idx++}`); values.push(val); }
    }
    if (updates.length === 0) return getUserById(id);
    updates.push("updated_at = NOW()"); values.push(id);
    await pgQ(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
  } else {
    const updates = []; const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); values.push(val); }
    }
    if (updates.length === 0) return getUserById(id);
    updates.push("updated_at = datetime('now')"); values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }
  return getUserById(id);
}

export async function deleteUser(id) {
  if (usePG) {
    await pgQ('DELETE FROM user_states WHERE user_id = $1', [id]);
    await pgQ('DELETE FROM trades WHERE user_id = $1', [id]);
    await pgQ('DELETE FROM users WHERE id = $1', [id]);
  } else {
    db.prepare('DELETE FROM user_states WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM trades WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }
}

export async function getUserState(userId) {
  if (usePG) {
    const { rows } = await pgQ('SELECT * FROM user_states WHERE user_id = $1', [userId]);
    const row = rows[0];
    if (!row) return null;
    return {
      ...row,
      riskSettings: row.risk_settings || {},
      lotSettings: row.lot_settings || {},
      aiAgentSettings: row.ai_agent_settings || {},
      pairs: Array.isArray(row.pairs) ? row.pairs : [],
      modelCounters: row.model_counters || {},
      equityHistory: Array.isArray(row.equity_history) ? row.equity_history : [],
    };
  }
  const row = db.prepare('SELECT * FROM user_states WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    ...row,
    riskSettings: JSON.parse(row.risk_settings || '{}'),
    lotSettings: JSON.parse(row.lot_settings || '{}'),
    aiAgentSettings: JSON.parse(row.ai_agent_settings || '{}'),
    pairs: JSON.parse(row.pairs || '[]'),
    modelCounters: JSON.parse(row.model_counters || '{}'),
    equityHistory: JSON.parse(row.equity_history || '[]'),
  };
}

export async function updateUserState(userId, fields) {
  const allowed = ['risk_settings', 'lot_settings', 'ai_agent_settings', 'pairs', 'model_counters', 'equity_history'];
  if (usePG) {
    const updates = []; const values = []; let idx = 1;
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = $${idx++}`); values.push(typeof val === 'string' ? val : JSON.stringify(val)); }
    }
    if (updates.length === 0) return getUserState(userId);
    updates.push("updated_at = NOW()"); values.push(userId);
    await pgQ(`UPDATE user_states SET ${updates.join(', ')} WHERE user_id = $${idx}`, values);
  } else {
    const updates = []; const values = [];
    for (const [key, val] of Object.entries(fields)) {
      if (allowed.includes(key)) { updates.push(`${key} = ?`); values.push(typeof val === 'string' ? val : JSON.stringify(val)); }
    }
    if (updates.length === 0) return getUserState(userId);
    updates.push("updated_at = datetime('now')"); values.push(userId);
    db.prepare(`UPDATE user_states SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
  }
  return getUserState(userId);
}

export async function createTrade(userId, trade) {
  const id = generateId();
  if (usePG) {
    await pgQ(
      `INSERT INTO trades (id, user_id, symbol, type, volume, price, exit_price, ticket, profit, source, signal_source, reason, confidence, market_context, strategy)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, userId, trade.symbol, trade.type, trade.volume, trade.price,
        trade.exitPrice || null, trade.ticket || null, trade.profit || 0,
        trade.source || null, trade.signalSource || null,
        trade.reason || null, trade.confidence || null,
        trade.marketContext ? JSON.stringify(trade.marketContext) : null,
        trade.strategy || null]
    );
  } else {
    db.prepare(
      'INSERT INTO trades (id, user_id, symbol, type, volume, price, exit_price, ticket, profit, source, signal_source, reason, confidence, market_context, strategy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, userId, trade.symbol, trade.type, trade.volume, trade.price,
      trade.exitPrice || null, trade.ticket || null, trade.profit || 0,
      trade.source || null, trade.signalSource || null,
      trade.reason || null, trade.confidence || null, trade.marketContext || null,
      trade.strategy || null);
  }
  return id;
}

export async function closeTrade(userId, ticket, exitPrice, profit) {
  if (usePG) {
    await pgQ("UPDATE trades SET exit_price = $1, profit = $2 WHERE user_id = $3 AND ticket = $4 AND exit_price IS NULL", [exitPrice, profit, userId, ticket]);
  } else {
    db.prepare("UPDATE trades SET exit_price = ?, profit = ? WHERE user_id = ? AND ticket = ? AND exit_price IS NULL").run(exitPrice, profit, userId, ticket);
  }
}

export async function getTrades(userId, limit = 500) {
  if (usePG) {
    const { rows } = await pgQ('SELECT * FROM trades WHERE user_id = $1 ORDER BY time DESC LIMIT $2', [userId, limit]);
    return rows;
  }
  return db.prepare('SELECT * FROM trades WHERE user_id = ? ORDER BY time DESC LIMIT ?').all(userId, limit);
}

export async function getClosedTrades(userId, limit = 200) {
  if (usePG) {
    const { rows } = await pgQ('SELECT * FROM trades WHERE user_id = $1 AND exit_price IS NOT NULL ORDER BY time DESC LIMIT $2', [userId, limit]);
    return rows;
  }
  return db.prepare('SELECT * FROM trades WHERE user_id = ? AND exit_price IS NOT NULL ORDER BY time DESC LIMIT ?').all(userId, limit);
}

export async function getDailyTradeCount(userId) {
  if (usePG) {
    const { rows } = await pgQ("SELECT COUNT(*) as count FROM trades WHERE user_id = $1 AND source = 'auto_trade' AND signal_source = 'LLM' AND date_trunc('day', time) = date_trunc('day', NOW())", [userId]);
    return parseInt(rows[0]?.count) || 0;
  }
  const row = db.prepare("SELECT COUNT(*) as count FROM trades WHERE user_id = ? AND source = 'auto_trade' AND signal_source = 'LLM' AND date(time) = date('now')").get(userId);
  return row?.count || 0;
}

export async function deleteDailyTrades(userId) {
  if (usePG) {
    const result = await pgQ("DELETE FROM trades WHERE user_id = $1 AND date_trunc('day', time) = date_trunc('day', NOW())", [userId]);
    return { changes: result.rowCount };
  }
  const result = db.prepare("DELETE FROM trades WHERE user_id = ? AND date(time) = date('now')").run(userId);
  return { changes: result.changes };
}

export async function updateUserPassword(id, passwordHash) {
  if (usePG) {
    await pgQ("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [passwordHash, id]);
  } else {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(passwordHash, id);
  }
  return getUserById(id);
}

export async function getUserWithStats(id) {
  const user = await getUserById(id);
  if (!user) return null;
  const trades = await getTrades(id, 10000);
  const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
  const winningTrades = trades.filter(t => t.profit > 0).length;
  return {
    ...user, password_hash: undefined,
    totalTrades: trades.length, totalProfit: parseFloat(totalProfit.toFixed(2)),
    winningTrades, winRate: trades.length ? parseFloat((winningTrades / trades.length * 100).toFixed(1)) : 0,
    lastTrade: trades[0]?.time || null,
  };
}

export async function getTradeMemory(userId, pair, limit = 10) {
  if (usePG) {
    const { rows } = await pgQ("SELECT symbol, type, price, exit_price, profit, reason, confidence, source, signal_source, time FROM trades WHERE user_id = $1 AND symbol = $2 AND exit_price IS NOT NULL ORDER BY time DESC LIMIT $3", [userId, pair, limit]);
    return rows;
  }
  return db.prepare("SELECT symbol, type, price, exit_price, profit, reason, confidence, source, signal_source, time FROM trades WHERE user_id = ? AND symbol = ? AND exit_price IS NOT NULL ORDER BY time DESC LIMIT ?").all(userId, pair, limit);
}

export async function getTradeMemoryStats(userId, pair) {
  if (usePG) {
    const q = pair
      ? "SELECT symbol, type, profit FROM trades WHERE user_id = $1 AND symbol = $2 AND exit_price IS NOT NULL"
      : "SELECT symbol, type, profit FROM trades WHERE user_id = $1 AND exit_price IS NOT NULL";
    const params = pair ? [userId, pair] : [userId];
    const { rows: trades } = await pgQ(q, params);
    return computeTradeMemoryStats(trades);
  }
  const trades = pair
    ? db.prepare("SELECT symbol, type, profit FROM trades WHERE user_id = ? AND symbol = ? AND exit_price IS NOT NULL").all(userId, pair)
    : db.prepare("SELECT symbol, type, profit FROM trades WHERE user_id = ? AND exit_price IS NOT NULL").all(userId);
  return computeTradeMemoryStats(trades);
}

function computeTradeMemoryStats(trades) {
  if (trades.length === 0) return null;
  const wins = trades.filter(t => t.profit > 0);
  const losses = trades.filter(t => t.profit <= 0);
  const totalProfit = trades.reduce((s, t) => s + t.profit, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.profit, 0) / losses.length : 0;
  const byType = {};
  for (const t of trades) {
    if (!byType[t.type]) byType[t.type] = { count: 0, wins: 0, profit: 0 };
    byType[t.type].count++;
    if (t.profit > 0) byType[t.type].wins++;
    byType[t.type].profit += t.profit;
  }
  return {
    total: trades.length,
    winRate: parseFloat((wins.length / trades.length * 100).toFixed(1)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    profitFactor: avgLoss !== 0 ? parseFloat(Math.abs(avgWin / avgLoss).toFixed(2)) : 0,
    byType,
  };
}

export async function getRecentTradeReasons(userId, pair, limit = 5) {
  if (usePG) {
    const { rows } = await pgQ("SELECT type, profit, reason, confidence, time FROM trades WHERE user_id = $1 AND symbol = $2 AND reason IS NOT NULL ORDER BY time DESC LIMIT $3", [userId, pair, limit]);
    return rows;
  }
  return db.prepare("SELECT type, profit, reason, confidence, time FROM trades WHERE user_id = ? AND symbol = ? AND reason IS NOT NULL ORDER BY time DESC LIMIT ?").all(userId, pair, limit);
}

export async function closeDb() {
  if (usePG) { await pool.end(); }
  else { db.close(); }
}

export default usePG ? pool : db;
