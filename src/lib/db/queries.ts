import { eq, desc, sql } from "drizzle-orm";
import { db, rawDb, schema } from "./index";
import type {
  TradeRecord,
  BotSettings,
  PnlDataPoint,
  MarketAsset,
  SubStrategy,
  AssetPerformance,
  StrategyPerformance,
  DailyPnlPoint,
  LadderLevel,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

// ------ Trades ------------------------------------------------------------------------------------------------------------------------------------

function mapTradeRow(r: typeof schema.trades.$inferSelect): TradeRecord {
  return {
    id: r.id,
    timestamp: r.timestamp,
    conditionId: r.conditionId,
    slug: r.slug,
    side: r.side as "yes" | "no",
    action: r.action as TradeRecord["action"],
    price: r.price,
    amount: r.amount,
    shares: r.shares,
    pnl: r.pnl,
    paper: r.paper,
    orderId: r.orderId,
    asset: (r.asset as MarketAsset) || null,
    subStrategy: (r.subStrategy as SubStrategy) || null,
    binancePriceAtEntry: r.binancePriceAtEntry ?? null,
    slippage: r.slippage ?? null,
    takerFee: r.takerFee ?? null,
  };
}

export function insertTrade(trade: Omit<TradeRecord, "id">): TradeRecord {
  const result = db
    .insert(schema.trades)
    .values({
      timestamp: trade.timestamp,
      conditionId: trade.conditionId,
      slug: trade.slug,
      side: trade.side,
      action: trade.action,
      price: trade.price,
      amount: trade.amount,
      shares: trade.shares,
      pnl: trade.pnl,
      paper: trade.paper,
      orderId: trade.orderId,
      asset: trade.asset,
      subStrategy: trade.subStrategy,
      binancePriceAtEntry: trade.binancePriceAtEntry,
      slippage: trade.slippage,
      takerFee: trade.takerFee,
    })
    .returning()
    .get();

  return mapTradeRow(result);
}

export function getRecentTrades(limit = 50, filters?: {
  asset?: MarketAsset;
  strategy?: SubStrategy;
  from?: string;
  to?: string;
}): TradeRecord[] {
  let query = `SELECT * FROM trades`;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters?.asset) {
    conditions.push("asset = ?");
    params.push(filters.asset);
  }
  if (filters?.strategy) {
    conditions.push("sub_strategy = ?");
    params.push(filters.strategy);
  }
  if (filters?.from) {
    conditions.push("timestamp >= ?");
    params.push(filters.from);
  }
  if (filters?.to) {
    conditions.push("timestamp <= ?");
    params.push(filters.to);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY id DESC LIMIT ?";
  params.push(limit);

  const stmt = rawDb.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map((r: any) => ({
    id: r.id,
    timestamp: r.timestamp,
    conditionId: r.condition_id,
    slug: r.slug,
    side: r.side as "yes" | "no",
    action: r.action as TradeRecord["action"],
    price: r.price,
    amount: r.amount,
    shares: r.shares,
    pnl: r.pnl,
    paper: !!r.paper,
    orderId: r.order_id,
    asset: r.asset as MarketAsset | null,
    subStrategy: r.sub_strategy as SubStrategy | null,
    binancePriceAtEntry: r.binance_price_at_entry ?? null,
    slippage: r.slippage ?? null,
    takerFee: r.taker_fee ?? null,
  }));
}

export function getCumulativePnl(): number {
  const result = db
    .select({ total: sql<number>`COALESCE(SUM(pnl), 0)` })
    .from(schema.trades)
    .where(eq(schema.trades.paper, false))
    .get();
  return result?.total ?? 0;
}

export function getTotalTradeCount(): number {
  const result = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.trades)
    .where(eq(schema.trades.paper, false))
    .get();
  return result?.count ?? 0;
}

export function getPnlHistory(): PnlDataPoint[] {
  const rows = db
    .select()
    .from(schema.trades)
    .orderBy(schema.trades.id)
    .all();

  let cumulative = 0;
  return rows
    .filter((r) => r.pnl !== null)
    .map((r) => {
      cumulative += r.pnl ?? 0;
      return {
        timestamp: r.timestamp,
        pnl: r.pnl ?? 0,
        cumulativePnl: cumulative,
      };
    });
}

export function getTodayPnl(): number {
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .select({ total: sql<number>`COALESCE(SUM(pnl), 0)` })
    .from(schema.trades)
    .where(sql`timestamp >= ${today}`)
    .get();
  return result?.total ?? 0;
}

export function getConsecutiveLosses(): number {
  const rows = db
    .select({ pnl: schema.trades.pnl })
    .from(schema.trades)
    .where(sql`pnl IS NOT NULL`)
    .orderBy(desc(schema.trades.id))
    .limit(20)
    .all();

  let count = 0;
  for (const row of rows) {
    if ((row.pnl ?? 0) < 0) count++;
    else break;
  }
  return count;
}

export function getTodayLossCount(): number {
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.trades)
    .where(sql`pnl IS NOT NULL AND pnl < 0 AND timestamp >= ${today}`)
    .get();
  return result?.count ?? 0;
}

export function getConsecutiveWins(): number {
  const rows = db
    .select({ pnl: schema.trades.pnl })
    .from(schema.trades)
    .where(sql`pnl IS NOT NULL`)
    .orderBy(desc(schema.trades.id))
    .limit(20)
    .all();

  let count = 0;
  for (const row of rows) {
    if ((row.pnl ?? 0) > 0) count++;
    else break;
  }
  return count;
}

// ------ Analytics ------------------------------------------------------------------------------------------------------------------------------

export function getPerformanceByAsset(days = 30): AssetPerformance[] {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const stmt = rawDb.prepare(`
    SELECT asset,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl
    FROM trades
    WHERE pnl IS NOT NULL AND asset IS NOT NULL AND timestamp >= ?
    GROUP BY asset
  `);
  const rows = stmt.all(since) as any[];
  return rows.map((r: any) => ({
    asset: r.asset as MarketAsset,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.trades > 0 ? r.wins / r.trades : 0,
    pnl: r.pnl,
  }));
}

export function getPerformanceByStrategy(): StrategyPerformance[] {
  const stmt = rawDb.prepare(`
    SELECT sub_strategy,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses,
           COALESCE(SUM(pnl), 0) as pnl,
           COALESCE(AVG(pnl), 0) as avg_pnl
    FROM trades
    WHERE pnl IS NOT NULL AND sub_strategy IS NOT NULL
    GROUP BY sub_strategy
  `);
  const rows = stmt.all() as any[];
  return rows.map((r: any) => ({
    strategy: r.sub_strategy as SubStrategy,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
    winRate: r.trades > 0 ? r.wins / r.trades : 0,
    pnl: r.pnl,
    avgPnl: r.avg_pnl,
  }));
}

export function getDailyStats(days = 30): DailyPnlPoint[] {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const stmt = rawDb.prepare(`
    SELECT DATE(timestamp) as date,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades,
           SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
           SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
    FROM trades
    WHERE pnl IS NOT NULL AND DATE(timestamp) >= ?
    GROUP BY DATE(timestamp)
    ORDER BY date
  `);
  const rows = stmt.all(since) as any[];
  return rows.map((r: any) => ({
    date: r.date,
    pnl: r.pnl,
    trades: r.trades,
    wins: r.wins,
    losses: r.losses,
  }));
}

export function getHourlyPerformance(): { hour: number; pnl: number; trades: number }[] {
  const stmt = rawDb.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) as hour,
           COALESCE(SUM(pnl), 0) as pnl,
           COUNT(*) as trades
    FROM trades
    WHERE pnl IS NOT NULL
    GROUP BY hour
    ORDER BY hour
  `);
  return stmt.all() as any[];
}

export function getAverageSlippage(): number {
  const result = db
    .select({ avg: sql<number>`COALESCE(AVG(slippage), 0)` })
    .from(schema.trades)
    .where(sql`slippage IS NOT NULL`)
    .get();
  return result?.avg ?? 0;
}

// ------ Settings --------------------------------------------------------------------------------------------------------------------------------

export function getSettings(): BotSettings {
  const row = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
  if (!row) {
    return { ...DEFAULT_SETTINGS };
  }

  let enabledAssets: BotSettings["enabledAssets"] = ["BTC"];
  try {
    enabledAssets = JSON.parse(row.enabledAssets || '["BTC"]');
  } catch {
    enabledAssets = ["BTC"];
  }

  let arbLadderLevels: LadderLevel[] = [
    { price: 0.48, allocation: 0.40 },
    { price: 0.46, allocation: 0.35 },
    { price: 0.44, allocation: 0.25 },
  ];
  try {
    arbLadderLevels = JSON.parse(row.arbLadderLevels || '[]');
  } catch {
    // keep defaults
  }

  return {
    paperTrading: row.paperTrading,
    totalBankroll: row.totalBankroll,
    maxTotalExposure: row.maxTotalExposure,
    perWindowMax: row.perWindowMax,
    maxSimultaneousPositions: row.maxSimultaneousPositions,
    dailyLossLimit: row.dailyLossLimit,
    lossLimit: row.consecutiveLossLimit,
    enabledAssets,
    highConfEntryMin: row.highConfEntryMin,
    highConfEntryMax: row.highConfEntryMax,
    highConfTimeMin: row.highConfTimeMin,
    highConfTimeMax: row.highConfTimeMax,
    highConfEnabled: row.highConfEnabled,
    highConfBuyAmount: row.highConfBuyAmount,
    highConfBuyInterval: row.highConfBuyInterval,
    arbEnabled: row.arbitrageEnabled,
    arbMaxPerWindow: row.arbMaxPerWindow,
    arbBudgetUp: row.arbBudgetUp ?? null,
    arbBudgetDown: row.arbBudgetDown ?? null,
    arbLadderLevels,
    arbMaxCombinedCost: row.maxCombinedCost,
    arbCancelBeforeEnd: row.arbCancelBeforeEnd,
    arbMarket: (row.arbMarket as MarketAsset) || "BTC",
    scalpEnabled: (row as any).scalpEnabled ?? true,
    scalpTradeSize: (row as any).scalpTradeSize ?? 12,
    scalpMaxPositions: (row as any).scalpMaxPositions ?? 2,
    scalpMinGap: (row as any).scalpMinGap ?? 0.03,
    scalpProfitTarget: (row as any).scalpProfitTarget ?? 0.03,
    scalpEntryMin: (row as any).scalpEntryMin ?? 0.15,
    scalpEntryMax: (row as any).scalpEntryMax ?? 0.85,
    scalpCooldownWindows: (row as any).scalpCooldownWindows ?? 1,
    scalpExitWindow: (row as any).scalpExitWindow ?? 120,
  };
}

export function updateSettings(s: Partial<BotSettings>): BotSettings {
  const setObj: Record<string, unknown> = {};

  if (s.paperTrading !== undefined) setObj.paperTrading = s.paperTrading;
  if (s.totalBankroll !== undefined) setObj.totalBankroll = s.totalBankroll;
  if (s.maxTotalExposure !== undefined) setObj.maxTotalExposure = s.maxTotalExposure;
  if (s.perWindowMax !== undefined) setObj.perWindowMax = s.perWindowMax;
  if (s.maxSimultaneousPositions !== undefined) setObj.maxSimultaneousPositions = s.maxSimultaneousPositions;
  if (s.dailyLossLimit !== undefined) setObj.dailyLossLimit = s.dailyLossLimit;
  if (s.lossLimit !== undefined) setObj.consecutiveLossLimit = s.lossLimit;
  if (s.enabledAssets !== undefined) setObj.enabledAssets = JSON.stringify(s.enabledAssets);
  if (s.highConfEntryMin !== undefined) setObj.highConfEntryMin = s.highConfEntryMin;
  if (s.highConfEntryMax !== undefined) setObj.highConfEntryMax = s.highConfEntryMax;
  if (s.highConfTimeMin !== undefined) setObj.highConfTimeMin = s.highConfTimeMin;
  if (s.highConfTimeMax !== undefined) setObj.highConfTimeMax = s.highConfTimeMax;
  if (s.highConfEnabled !== undefined) setObj.highConfEnabled = s.highConfEnabled;
  if (s.highConfBuyAmount !== undefined) setObj.highConfBuyAmount = s.highConfBuyAmount;
  if (s.highConfBuyInterval !== undefined) setObj.highConfBuyInterval = s.highConfBuyInterval;
  if (s.arbEnabled !== undefined) setObj.arbitrageEnabled = s.arbEnabled;
  if (s.arbMaxPerWindow !== undefined) setObj.arbMaxPerWindow = s.arbMaxPerWindow;
  if (s.arbBudgetUp !== undefined) setObj.arbBudgetUp = s.arbBudgetUp;
  if (s.arbBudgetDown !== undefined) setObj.arbBudgetDown = s.arbBudgetDown;
  if (s.arbLadderLevels !== undefined) setObj.arbLadderLevels = JSON.stringify(s.arbLadderLevels);
  if (s.arbMaxCombinedCost !== undefined) setObj.maxCombinedCost = s.arbMaxCombinedCost;
  if (s.arbCancelBeforeEnd !== undefined) setObj.arbCancelBeforeEnd = s.arbCancelBeforeEnd;
  if (s.arbMarket !== undefined) setObj.arbMarket = s.arbMarket;
  if (s.scalpEnabled !== undefined) setObj.scalpEnabled = s.scalpEnabled;
  if (s.scalpTradeSize !== undefined) setObj.scalpTradeSize = s.scalpTradeSize;
  if (s.scalpMaxPositions !== undefined) setObj.scalpMaxPositions = s.scalpMaxPositions;
  if (s.scalpMinGap !== undefined) setObj.scalpMinGap = s.scalpMinGap;
  if (s.scalpProfitTarget !== undefined) setObj.scalpProfitTarget = s.scalpProfitTarget;
  if (s.scalpEntryMin !== undefined) setObj.scalpEntryMin = s.scalpEntryMin;
  if (s.scalpEntryMax !== undefined) setObj.scalpEntryMax = s.scalpEntryMax;
  if (s.scalpCooldownWindows !== undefined) setObj.scalpCooldownWindows = s.scalpCooldownWindows;
  if (s.scalpExitWindow !== undefined) setObj.scalpExitWindow = s.scalpExitWindow;

  if (Object.keys(setObj).length > 0) {
    db.update(schema.settings)
      .set(setObj as any)
      .where(eq(schema.settings.id, 1))
      .run();
  }

  return getSettings();
}

/**
 * Get conditionIds from recent live buy trades for auto-claim scan on startup.
 * Since resolution trades may not exist (positions lost on restart), we check
 * buy trades and verify on-chain if tokens are still claimable.
 */
export function getRecentTradeConditionIds(hoursBack = 6): { conditionId: string; asset: string }[] {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const rows = rawDb.prepare(
    `SELECT DISTINCT condition_id, asset FROM trades
     WHERE paper = 0 AND action = 'buy' AND timestamp >= ?`
  ).all(cutoff) as { condition_id: string; asset: string }[];
  return rows.map(r => ({ conditionId: r.condition_id, asset: r.asset || "BTC" }));
}

export function resetAllStats(): void {
  rawDb.exec("DELETE FROM trades");
  rawDb.exec("DELETE FROM daily_stats");
  rawDb.exec("DELETE FROM market_performance");
}
