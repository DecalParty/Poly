import { drizzle } from "drizzle-orm/better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as schema from "./schema";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "trades.db");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sqlJsDb: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDb(): any {
  if (sqlJsDb) return sqlJsDb;
  throw new Error("Database not initialized - call ensureDb() first");
}

function persist() {
  const data = getDb().export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

class CompatStatement {
  private sql: string;
  private isRaw = false;
  constructor(sql: string) {
    this.sql = sql;
  }
  raw(flag = true) {
    this.isRaw = flag;
    return this;
  }
  bind() {
    return this;
  }
  run(...params: unknown[]) {
    const db = getDb();
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    db.run(this.sql, flat as any[]);
    persist();
    return { changes: db.getRowsModified(), lastInsertRowid: 0 };
  }
  get(...params: unknown[]) {
    const db = getDb();
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const stmt = db.prepare(this.sql);
    if (flat.length > 0) stmt.bind(flat as any[]);
    if (stmt.step()) {
      if (this.isRaw) {
        const vals = stmt.get();
        stmt.free();
        return vals;
      }
      const cols = stmt.getColumnNames();
      const vals = stmt.get();
      const row: Record<string, unknown> = {};
      cols.forEach((c: string, i: number) => (row[c] = vals[i]));
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }
  all(...params: unknown[]) {
    const db = getDb();
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    const results: unknown[] = [];
    const stmt = db.prepare(this.sql);
    if (flat.length > 0) stmt.bind(flat as any[]);
    while (stmt.step()) {
      if (this.isRaw) {
        results.push(stmt.get());
      } else {
        const cols = stmt.getColumnNames();
        const vals = stmt.get();
        const row: Record<string, unknown> = {};
        cols.forEach((c: string, i: number) => (row[c] = vals[i]));
        results.push(row);
      }
    }
    stmt.free();
    return results;
  }
}

const compatDb = {
  prepare(sql: string) {
    return new CompatStatement(sql);
  },
  exec(sql: string) {
    getDb().run(sql);
    persist();
  },
  pragma(_s: string) {
    // no-op for sql.js
  },
  transaction<T>(fn: () => T): () => T {
    return () => {
      getDb().run("BEGIN");
      try {
        const result = fn();
        getDb().run("COMMIT");
        persist();
        return result;
      } catch (e) {
        getDb().run("ROLLBACK");
        throw e;
      }
    };
  },
};

let initPromise: Promise<void> | null = null;

export function ensureDb(): Promise<void> {
  if (sqlJsDb) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    if (existsSync(DB_PATH)) {
      const buffer = readFileSync(DB_PATH);
      sqlJsDb = new SQL.Database(buffer);
    } else {
      sqlJsDb = new SQL.Database();
    }

    sqlJsDb.run(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        condition_id TEXT NOT NULL,
        slug TEXT NOT NULL,
        side TEXT NOT NULL CHECK(side IN ('yes', 'no')),
        action TEXT NOT NULL CHECK(action IN ('buy', 'sell', 'resolution')),
        price REAL NOT NULL,
        amount REAL NOT NULL,
        shares REAL NOT NULL,
        pnl REAL,
        paper INTEGER NOT NULL DEFAULT 1,
        order_id TEXT,
        asset TEXT,
        sub_strategy TEXT,
        binance_price_at_entry REAL,
        slippage REAL,
        taker_fee REAL
      )
    `);
    sqlJsDb.run(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        buy_amount REAL NOT NULL DEFAULT 0.10,
        buy_interval_seconds INTEGER NOT NULL DEFAULT 5,
        entry_price_min REAL NOT NULL DEFAULT 0.90,
        entry_price_max REAL NOT NULL DEFAULT 0.95,
        stop_loss_threshold REAL NOT NULL DEFAULT 0.50,
        max_minutes_remaining INTEGER NOT NULL DEFAULT 8,
        max_position_size REAL NOT NULL DEFAULT 5.00,
        paper_trading INTEGER NOT NULL DEFAULT 1,
        total_bankroll REAL NOT NULL DEFAULT 50,
        max_total_exposure REAL NOT NULL DEFAULT 30,
        reserve_amount REAL NOT NULL DEFAULT 20,
        per_window_max REAL NOT NULL DEFAULT 8,
        max_simultaneous_positions INTEGER NOT NULL DEFAULT 3,
        daily_loss_limit REAL NOT NULL DEFAULT 10,
        consecutive_loss_limit INTEGER NOT NULL DEFAULT 5,
        enabled_assets TEXT NOT NULL DEFAULT '["BTC"]',
        momentum_min_price_change REAL NOT NULL DEFAULT 0.001,
        momentum_entry_min REAL NOT NULL DEFAULT 0.60,
        momentum_entry_max REAL NOT NULL DEFAULT 0.93,
        momentum_time_min INTEGER NOT NULL DEFAULT 120,
        momentum_time_max INTEGER NOT NULL DEFAULT 480,
        momentum_enabled INTEGER NOT NULL DEFAULT 1,
        high_conf_entry_min REAL NOT NULL DEFAULT 0.90,
        high_conf_entry_max REAL NOT NULL DEFAULT 0.95,
        high_conf_time_min INTEGER NOT NULL DEFAULT 30,
        high_conf_time_max INTEGER NOT NULL DEFAULT 480,
        high_conf_enabled INTEGER NOT NULL DEFAULT 1,
        high_conf_buy_amount REAL NOT NULL DEFAULT 0.10,
        high_conf_buy_interval INTEGER NOT NULL DEFAULT 5,
        high_conf_stop_loss REAL NOT NULL DEFAULT 0.79,
        max_combined_cost REAL NOT NULL DEFAULT 0.97,
        arbitrage_enabled INTEGER NOT NULL DEFAULT 1,
        bet_amount REAL NOT NULL DEFAULT 2.00
      )
    `);
    sqlJsDb.run(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT PRIMARY KEY,
        total_trades INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pnl REAL NOT NULL DEFAULT 0,
        fees_spent REAL NOT NULL DEFAULT 0,
        arbitrage_trades INTEGER NOT NULL DEFAULT 0,
        momentum_trades INTEGER NOT NULL DEFAULT 0,
        high_conf_trades INTEGER NOT NULL DEFAULT 0,
        circuit_breaker_triggered INTEGER NOT NULL DEFAULT 0
      )
    `);
    sqlJsDb.run(`
      CREATE TABLE IF NOT EXISTS market_performance (
        asset TEXT NOT NULL,
        date TEXT NOT NULL,
        trades INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        pnl REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (asset, date)
      )
    `);

    const addColIfMissing = (table: string, col: string, type: string) => {
      try {
        sqlJsDb.run(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
      } catch {
        // Column already exists
      }
    };
    addColIfMissing("trades", "asset", "TEXT");
    addColIfMissing("trades", "sub_strategy", "TEXT");
    addColIfMissing("trades", "binance_price_at_entry", "REAL");
    addColIfMissing("trades", "slippage", "REAL");
    addColIfMissing("trades", "taker_fee", "REAL");

    addColIfMissing("settings", "total_bankroll", "REAL NOT NULL DEFAULT 50");
    addColIfMissing("settings", "max_total_exposure", "REAL NOT NULL DEFAULT 30");
    addColIfMissing("settings", "reserve_amount", "REAL NOT NULL DEFAULT 20");
    addColIfMissing("settings", "per_window_max", "REAL NOT NULL DEFAULT 8");
    addColIfMissing("settings", "max_simultaneous_positions", "INTEGER NOT NULL DEFAULT 3");
    addColIfMissing("settings", "daily_loss_limit", "REAL NOT NULL DEFAULT 10");
    addColIfMissing("settings", "consecutive_loss_limit", "INTEGER NOT NULL DEFAULT 5");
    addColIfMissing("settings", "enabled_assets", "TEXT NOT NULL DEFAULT '[\"BTC\"]'");
    addColIfMissing("settings", "momentum_min_price_change", "REAL NOT NULL DEFAULT 0.001");
    addColIfMissing("settings", "momentum_entry_min", "REAL NOT NULL DEFAULT 0.60");
    addColIfMissing("settings", "momentum_entry_max", "REAL NOT NULL DEFAULT 0.93");
    addColIfMissing("settings", "momentum_time_min", "INTEGER NOT NULL DEFAULT 120");
    addColIfMissing("settings", "momentum_time_max", "INTEGER NOT NULL DEFAULT 480");
    addColIfMissing("settings", "momentum_enabled", "INTEGER NOT NULL DEFAULT 1");
    addColIfMissing("settings", "high_conf_entry_min", "REAL NOT NULL DEFAULT 0.88");
    addColIfMissing("settings", "high_conf_entry_max", "REAL NOT NULL DEFAULT 0.96");
    addColIfMissing("settings", "high_conf_time_min", "INTEGER NOT NULL DEFAULT 60");
    addColIfMissing("settings", "high_conf_time_max", "INTEGER NOT NULL DEFAULT 300");
    addColIfMissing("settings", "high_conf_enabled", "INTEGER NOT NULL DEFAULT 1");
    addColIfMissing("settings", "high_conf_buy_amount", "REAL NOT NULL DEFAULT 0.10");
    addColIfMissing("settings", "high_conf_buy_interval", "INTEGER NOT NULL DEFAULT 5");
    addColIfMissing("settings", "high_conf_stop_loss", "REAL NOT NULL DEFAULT 0.79");
    addColIfMissing("settings", "max_combined_cost", "REAL NOT NULL DEFAULT 0.97");
    addColIfMissing("settings", "arbitrage_enabled", "INTEGER NOT NULL DEFAULT 1");
    addColIfMissing("settings", "bet_amount", "REAL NOT NULL DEFAULT 2.00");

    sqlJsDb.run("INSERT OR IGNORE INTO settings (id) VALUES (1)");
    persist();
  })();
  return initPromise;
}

export const db = drizzle(compatDb as any, { schema });

/** Raw sql.js compatible DB for hand-written queries (prepare/all/get/run) */
export const rawDb = compatDb;

export { schema };
