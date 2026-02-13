import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

// Trade history table -- every buy, sell, and resolution event
export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  timestamp: text("timestamp").notNull(),
  conditionId: text("condition_id").notNull(),
  slug: text("slug").notNull(),
  side: text("side", { enum: ["yes", "no"] }).notNull(),
  action: text("action", { enum: ["buy", "sell", "resolution"] }).notNull(),
  price: real("price").notNull(),
  amount: real("amount").notNull(),
  shares: real("shares").notNull(),
  pnl: real("pnl"),
  paper: integer("paper", { mode: "boolean" }).notNull().default(true),
  orderId: text("order_id"),
  asset: text("asset"),
  subStrategy: text("sub_strategy"),
  binancePriceAtEntry: real("binance_price_at_entry"),
  slippage: real("slippage"),
  takerFee: real("taker_fee"),
});

// Bot settings (single row, upserted)
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().default(1),
  buyAmount: real("buy_amount").notNull().default(0.10),
  buyIntervalSeconds: integer("buy_interval_seconds").notNull().default(5),
  entryPriceMin: real("entry_price_min").notNull().default(0.90),
  entryPriceMax: real("entry_price_max").notNull().default(0.95),
  stopLossThreshold: real("stop_loss_threshold").notNull().default(0.50),
  maxMinutesRemaining: integer("max_minutes_remaining").notNull().default(8),
  maxPositionSize: real("max_position_size").notNull().default(5.00),
  paperTrading: integer("paper_trading", { mode: "boolean" }).notNull().default(true),
  // Capital & risk
  totalBankroll: real("total_bankroll").notNull().default(50),
  maxTotalExposure: real("max_total_exposure").notNull().default(30),
  reserveAmount: real("reserve_amount").notNull().default(20),
  perWindowMax: real("per_window_max").notNull().default(8),
  maxSimultaneousPositions: integer("max_simultaneous_positions").notNull().default(3),
  dailyLossLimit: real("daily_loss_limit").notNull().default(10),
  consecutiveLossLimit: integer("consecutive_loss_limit").notNull().default(5),
  // Enabled assets (JSON array)
  enabledAssets: text("enabled_assets").notNull().default('["BTC"]'),
  // Momentum strategy
  momentumMinPriceChange: real("momentum_min_price_change").notNull().default(0.001),
  momentumEntryMin: real("momentum_entry_min").notNull().default(0.60),
  momentumEntryMax: real("momentum_entry_max").notNull().default(0.93),
  momentumTimeMin: integer("momentum_time_min").notNull().default(120),
  momentumTimeMax: integer("momentum_time_max").notNull().default(480),
  momentumEnabled: integer("momentum_enabled", { mode: "boolean" }).notNull().default(true),
  // High confidence strategy
  highConfEntryMin: real("high_conf_entry_min").notNull().default(0.88),
  highConfEntryMax: real("high_conf_entry_max").notNull().default(0.96),
  highConfTimeMin: integer("high_conf_time_min").notNull().default(60),
  highConfTimeMax: integer("high_conf_time_max").notNull().default(480),
  highConfEnabled: integer("high_conf_enabled", { mode: "boolean" }).notNull().default(true),
  highConfBuyAmount: real("high_conf_buy_amount").notNull().default(0.10),
  highConfBuyInterval: integer("high_conf_buy_interval").notNull().default(5),
  highConfStopLoss: real("high_conf_stop_loss").notNull().default(0.79),
  // Arbitrage strategy
  arbitrageEnabled: integer("arbitrage_enabled", { mode: "boolean" }).notNull().default(true),
  arbMaxPerWindow: real("arb_max_per_window").notNull().default(10),
  arbBudgetUp: real("arb_budget_up"),
  arbBudgetDown: real("arb_budget_down"),
  arbLadderLevels: text("arb_ladder_levels").notNull().default('[{"price":0.48,"allocation":0.40},{"price":0.46,"allocation":0.35},{"price":0.44,"allocation":0.25}]'),
  maxCombinedCost: real("max_combined_cost").notNull().default(0.97),
  arbCancelBeforeEnd: integer("arb_cancel_before_end").notNull().default(120),
  arbMarket: text("arb_market").notNull().default("BTC"),
  // Scalp strategy
  scalpEnabled: integer("scalp_enabled", { mode: "boolean" }).notNull().default(true),
  scalpTradeSize: real("scalp_trade_size").notNull().default(12),
  scalpMaxPositions: integer("scalp_max_positions").notNull().default(2),
  scalpMinGap: real("scalp_min_gap").notNull().default(0.08),
  scalpProfitTarget: real("scalp_profit_target").notNull().default(0.07),
  scalpEntryMin: real("scalp_entry_min").notNull().default(0.40),
  scalpEntryMax: real("scalp_entry_max").notNull().default(0.70),
  scalpCooldownWindows: integer("scalp_cooldown_windows").notNull().default(1),
  scalpExitWindow: integer("scalp_exit_window").notNull().default(120),
  // Bet sizing
  betAmount: real("bet_amount").notNull().default(2.00),
});

// Daily stats table
export const dailyStats = sqliteTable("daily_stats", {
  date: text("date").primaryKey(),
  totalTrades: integer("total_trades").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  pnl: real("pnl").notNull().default(0),
  feesSpent: real("fees_spent").notNull().default(0),
  arbitrageTrades: integer("arbitrage_trades").notNull().default(0),
  momentumTrades: integer("momentum_trades").notNull().default(0),
  highConfTrades: integer("high_conf_trades").notNull().default(0),
  circuitBreakerTriggered: integer("circuit_breaker_triggered").notNull().default(0),
});

// Market performance table
export const marketPerformance = sqliteTable("market_performance", {
  asset: text("asset").notNull(),
  date: text("date").notNull(),
  trades: integer("trades").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  pnl: real("pnl").notNull().default(0),
}, (table) => ({
  pk: primaryKey({ columns: [table.asset, table.date] }),
}));
