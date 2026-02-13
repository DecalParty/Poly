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

// Rolling price buffer for spike detection (last 30 seconds, sampled every 500ms)
const SPIKE_BUFFER_MAX_AGE_MS = 30_000;
const priceBuffer: { price: number; ts: number }[] = [];

const BITBO_WS_URL = "wss://api.bitbo.io";

function getWindowStart(): number {
  return Math.floor(Date.now() / 1000 / 900) * 900;
}

function handlePrice(price: number) {
  if (price <= 0) return;
  lastPrice = price;
  lastUpdate = Date.now();

  // Record price for spike detection (sample every ~500ms for fast delta tracking)
  const now = Date.now();
  if (priceBuffer.length === 0 || now - priceBuffer[priceBuffer.length - 1].ts >= 500) {
    priceBuffer.push({ price, ts: now });
    // Trim old entries
    while (priceBuffer.length > 0 && now - priceBuffer[0].ts > SPIKE_BUFFER_MAX_AGE_MS) {
      priceBuffer.shift();
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
 * BTC dollar change over the last N milliseconds.
 * Positive = price rising, negative = falling.
 * Returns 0 if not enough data.
 *
 * Used for spike detection: if BTC moved >$X in last 3-5 seconds,
 * Polymarket hasn't caught up yet -> buy opportunity.
 */
export function getBtcDelta(lookbackMs: number = 5000): number {
  if (priceBuffer.length < 2) return 0;
  const now = Date.now();
  const cutoff = now - lookbackMs;

  // Find the oldest price within the lookback window
  let oldest: { price: number; ts: number } | null = null;
  for (const entry of priceBuffer) {
    if (entry.ts >= cutoff) {
      oldest = entry;
      break;
    }
  }

  if (!oldest || oldest.price <= 0) return 0;
  return lastPrice - oldest.price;
}

/** Kept for backward compat - returns % change. */
export function getBtcVelocity(lookbackMs: number = 60_000): number {
  if (lastPrice <= 0) return 0;
  const delta = getBtcDelta(lookbackMs);
  return delta / lastPrice;
}
