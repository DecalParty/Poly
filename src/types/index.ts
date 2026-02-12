// ─── Asset Types ─────────────────────────────────────────────────────────────

export type MarketAsset = "BTC" | "ETH" | "SOL" | "XRP";

export const ALL_ASSETS: MarketAsset[] = ["BTC", "ETH", "SOL", "XRP"];

export const ASSET_COLORS: Record<MarketAsset, string> = {
  BTC: "#F7931A",
  ETH: "#627EEA",
  SOL: "#9945FF",
  XRP: "#23292F",
};

// ─── Bot Settings ────────────────────────────────────────────────────────────

export type SubStrategy = "highConfidence";

export interface BotSettings {
  paperTrading: boolean;

  // Capital & risk
  totalBankroll: number;
  maxTotalExposure: number;
  perWindowMax: number;
  maxSimultaneousPositions: number;
  dailyLossLimit: number;
  lossLimit: number;

  // Enabled assets
  enabledAssets: MarketAsset[];

  // High confidence strategy (DCA accumulator)
  highConfEntryMin: number;
  highConfEntryMax: number;
  highConfTimeMin: number;
  highConfTimeMax: number;
  highConfEnabled: boolean;
  highConfBuyAmount: number;
  highConfBuyInterval: number;
}

export const DEFAULT_SETTINGS: BotSettings = {
  paperTrading: true,

  totalBankroll: 50,
  maxTotalExposure: 30,
  perWindowMax: 8,
  maxSimultaneousPositions: 3,
  dailyLossLimit: 10,
  lossLimit: 5,

  enabledAssets: ["BTC"],

  highConfEntryMin: 0.90,
  highConfEntryMax: 0.95,
  highConfTimeMin: 30,
  highConfTimeMax: 480,
  highConfEnabled: true,
  highConfBuyAmount: 0.10,
  highConfBuyInterval: 5,
};

// ─── Market Data ─────────────────────────────────────────────────────────────

export interface MarketInfo {
  conditionId: string;
  slug: string;
  question: string;
  yesTokenId: string;
  noTokenId: string;
  endDate: string;
  endTimestamp: number;
  active: boolean;
  tickSize: string;
  negRisk: boolean;
  asset?: MarketAsset;
}

export interface MarketPrices {
  yesPrice: number;
  noPrice: number;
  leadingSide: "yes" | "no";
  leadingPrice: number;
  timestamp: number;
}

export interface MarketStatus {
  market: MarketInfo | null;
  prices: MarketPrices | null;
  secondsRemaining: number;
  eligible: boolean;
  ineligibleReason?: string;
}

// ─── Price Intelligence ──────────────────────────────────────────────────────

export interface WindowOutcome {
  slug: string;
  timestamp: number;
  result: "up" | "down" | "pending";
  endTime: string;
}

export interface ActiveMarketState {
  asset: MarketAsset;
  conditionId: string;
  slug: string;
  yesTokenId: string;
  noTokenId: string;
  yesPrice: number;
  noPrice: number;
  combinedCost: number;
  secondsRemaining: number;
  market: MarketInfo;
  tickSize: string;
  negRisk: boolean;
}

// ─── Positions ───────────────────────────────────────────────────────────────

export interface Position {
  conditionId: string;
  side: "yes" | "no";
  shares: number;
  avgEntryPrice: number;
  costBasis: number;
  currentPrice: number;
  unrealizedPnl: number;
}

export interface WindowPosition {
marketId: string;
slug: string;
asset: MarketAsset;
side: "yes" | "no";
  shares: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  entryTime: string;
  hedged: boolean;
  hedgeShares?: number;
  hedgeAvgPrice?: number;
  hedgeSide?: "yes" | "no";
  costBasis: number;
  subStrategy?: SubStrategy;
  lastBuyTime?: number;
}

// ─── Trades ──────────────────────────────────────────────────────────────────

export type TradeAction = "buy" | "sell" | "resolution";

export interface TradeRecord {
  id?: number;
  timestamp: string;
  conditionId: string;
  slug: string;
  side: "yes" | "no";
  action: TradeAction;
  price: number;
  amount: number;
  shares: number;
  pnl: number | null;
  paper: boolean;
  orderId: string | null;
  asset: MarketAsset | null;
  subStrategy: SubStrategy | null;
  binancePriceAtEntry: number | null;
  slippage: number | null;
  takerFee: number | null;
}

// ─── Bot State ───────────────────────────────────────────────────────────────

export type BotStatus = "stopped" | "running" | "error" | "paused";
export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export interface CircuitBreakerState {
  triggered: boolean;
  reason: string | null;
  resumeAt: string | null;
  dailyPnl: number;
  totalLosses: number;
}

export interface CapitalState {
  totalBankroll: number;
  deployed: number;
  available: number;
  maxExposure: number;
  todayPnl: number;
  winStreak: number;
  totalLosses: number;
}

export interface BotState {
  status: BotStatus;
  connection: ConnectionStatus;
  lastAction: string;
  lastActionTime: string | null;
  currentMarket: MarketStatus | null;
  currentPosition: Position | null;
  settings: BotSettings;
  cumulativePnl: number;
  totalTrades: number;
  // Multi-market state
  activeMarkets: Record<string, ActiveMarketState>;
  positions: Record<string, WindowPosition>;
  capital: CapitalState;
  circuitBreaker: CircuitBreakerState;
  clobReady: boolean;
  alerts: AlertItem[];
}

// ─── SSE Events ──────────────────────────────────────────────────────────────

export type SSEEventType =
  | "state"
  | "market"
  | "trade"
  | "position"
  | "error"
  | "log"
  | "alert"
  | "price";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "success" | "warning" | "error";

export interface AlertItem {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  message: string;
  asset?: MarketAsset;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── P&L Chart Data ──────────────────────────────────────────────────────────

export interface PnlDataPoint {
  timestamp: string;
  pnl: number;
  cumulativePnl: number;
}

export interface DailyPnlPoint {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
}

// ─── Stats / Analytics ──────────────────────────────────────────────────────

export interface AssetPerformance {
  asset: MarketAsset;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
}

export interface StrategyPerformance {
  strategy: SubStrategy;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
}
