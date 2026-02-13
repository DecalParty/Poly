import WebSocket from "ws";
import { logger } from "../logger";

// -- Bitbo.io BTC Real-time Price Feed ----------------------------------------
// Connects directly to Bitbo's WebSocket at wss://api.bitbo.io
// Bitbo's price consistently leads Polymarket by 1-2 seconds.
// The price is in market.p on each message.

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastPrice = 0;
let lastUpdate = 0;
let windowOpenPrice = 0;
let windowOpenTs = 0;
let running = false;

// Rolling price buffers:
// - Fast buffer: last 60s, sampled every 500ms (for recent delta / unreflected moves)
// - Trend buffer: last 90 minutes, sampled every 10s (for 30min/1hr trend)
const FAST_BUFFER_MAX_AGE_MS = 60_000;
const fastBuffer: { price: number; ts: number }[] = [];

const TREND_BUFFER_MAX_AGE_MS = 90 * 60_000; // 90 min
const trendBuffer: { price: number; ts: number }[] = [];

const BITBO_WS_URL = "wss://api.bitbo.io";

function getWindowStart(): number {
  return Math.floor(Date.now() / 1000 / 900) * 900;
}

function handlePrice(price: number) {
  if (price <= 0) return;
  lastPrice = price;
  lastUpdate = Date.now();

  // Fast buffer: sample every 500ms for recent delta
  const now = Date.now();
  if (fastBuffer.length === 0 || now - fastBuffer[fastBuffer.length - 1].ts >= 500) {
    fastBuffer.push({ price, ts: now });
    while (fastBuffer.length > 0 && now - fastBuffer[0].ts > FAST_BUFFER_MAX_AGE_MS) {
      fastBuffer.shift();
    }
  }

  // Trend buffer: sample every 10s for longer-term trend
  if (trendBuffer.length === 0 || now - trendBuffer[trendBuffer.length - 1].ts >= 10_000) {
    trendBuffer.push({ price, ts: now });
    while (trendBuffer.length > 0 && now - trendBuffer[0].ts > TREND_BUFFER_MAX_AGE_MS) {
      trendBuffer.shift();
    }
  }

  // Snapshot window-open price at the start of each 15-min window
  const currentWindowStart = getWindowStart();
  if (currentWindowStart !== windowOpenTs) {
    windowOpenPrice = price;
    windowOpenTs = currentWindowStart;
    logger.info(`[BitboWS] New window ${currentWindowStart}: open price $${price.toFixed(2)}`);
  }
}

function connect() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  try {
    ws = new WebSocket(BITBO_WS_URL, {
      headers: { "Origin": "https://bitbo.io" },
    });
  } catch (err) {
    logger.error(`[BitboWS] Failed to create WebSocket: ${err}`);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    logger.info("[BitboWS] Connected to Bitbo price stream");
  });

  ws.on("message", (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());

      // Bitbo sends { market: { p: 68822.91 } } on each tick
      if (msg.market && typeof msg.market.p === "number") {
        handlePrice(msg.market.p);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    logger.warn("[BitboWS] Disconnected");
    if (running) scheduleReconnect();
  });

  ws.on("error", (err) => {
    logger.error(`[BitboWS] Error: ${err.message}`);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (running) connect();
  }, 3000);
}

export function startBinanceWs() {
  if (running) return;
  running = true;
  connect();
}

export function stopBinanceWs() {
  running = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
}

/** Current BTC price from Bitbo (0 if not yet received). */
export function getBinancePrice(): number {
  return lastPrice;
}

/** Timestamp of last Bitbo update (ms). */
export function getBinanceLastUpdate(): number {
  return lastUpdate;
}

/** BTC price at the start of the current 15-min window. */
export function getWindowOpenPrice(): number {
  // If we haven't snapshotted this window yet, use current price
  const currentWindowStart = getWindowStart();
  if (windowOpenTs !== currentWindowStart && lastPrice > 0) {
    windowOpenPrice = lastPrice;
    windowOpenTs = currentWindowStart;
  }
  return windowOpenPrice;
}

/**
 * BTC % change from window open.
 * Positive = up, negative = down.
 * Returns 0 if no data available.
 */
export function getBtcWindowChange(): number {
  const open = getWindowOpenPrice();
  if (open <= 0 || lastPrice <= 0) return 0;
  return (lastPrice - open) / open;
}

/** Returns true if Bitbo WS is connected and data is fresh (<10s old). */
export function isBinanceFresh(): boolean {
  return lastUpdate > 0 && Date.now() - lastUpdate < 10_000;
}

/**
 * BTC dollar change over the last N milliseconds (from fast buffer).
 * Used for detecting recent moves Polymarket hasn't priced in yet.
 */
export function getBtcDelta(lookbackMs: number = 10_000): number {
  if (fastBuffer.length < 2) return 0;
  const cutoff = Date.now() - lookbackMs;

  let oldest: { price: number; ts: number } | null = null;
  for (const entry of fastBuffer) {
    if (entry.ts >= cutoff) {
      oldest = entry;
      break;
    }
  }

  if (!oldest || oldest.price <= 0) return 0;
  return lastPrice - oldest.price;
}

/**
 * BTC trend over longer periods (from trend buffer).
 * Returns { delta: dollar change, pctChange: % change, direction: 1|-1|0, strength: 0-1 }
 *
 * Strength measures consistency: if price moved in one direction the whole time,
 * strength ? 1. If it bounced around and ended flat, strength ? 0.
 */
export function getBtcTrend(lookbackMs: number = 30 * 60_000): {
  delta: number;
  pctChange: number;
  direction: number;
  strength: number;
} {
  const noTrend = { delta: 0, pctChange: 0, direction: 0, strength: 0 };
  if (trendBuffer.length < 3) return noTrend;

  const cutoff = Date.now() - lookbackMs;
  let oldest: { price: number; ts: number } | null = null;
  for (const entry of trendBuffer) {
    if (entry.ts >= cutoff) {
      oldest = entry;
      break;
    }
  }
  if (!oldest || oldest.price <= 0) return noTrend;

  const delta = lastPrice - oldest.price;
  const pctChange = delta / oldest.price;
  const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;

  // Strength: measure how consistently price moved in the final direction.
  // Count how many trend samples are "on the right side" of the midpoint.
  const midPrice = (oldest.price + lastPrice) / 2;
  let onSide = 0;
  let total = 0;
  for (const entry of trendBuffer) {
    if (entry.ts < cutoff) continue;
    total++;
    if (direction > 0 && entry.price >= midPrice) onSide++;
    else if (direction < 0 && entry.price <= midPrice) onSide++;
    else if (direction === 0) onSide++;
  }
  const strength = total > 0 ? onSide / total : 0;

  return { delta, pctChange, direction, strength };
}

/** Kept for backward compat - returns % change. */
export function getBtcVelocity(lookbackMs: number = 60_000): number {
  if (lastPrice <= 0) return 0;
  const delta = getBtcDelta(lookbackMs);
  return delta / lastPrice;
}
