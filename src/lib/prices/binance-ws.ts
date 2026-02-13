import WebSocket from "ws";
import { logger } from "../logger";

// -- Coinbase BTC-USD Real-time Price Feed ------------------------------------
// Connects to Coinbase WebSocket for BTC-USD ticker updates.
// Coinbase is a primary Chainlink oracle source, which is what resolves
// Polymarket BTC windows. This feed leads Polymarket by ~1-2 seconds.

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastPrice = 0;
let lastUpdate = 0;
let windowOpenPrice = 0;
let windowOpenTs = 0;
let running = false;

// Rolling price buffer for velocity tracking (last 3 minutes)
const VELOCITY_BUFFER_MAX_AGE_MS = 180_000; // 3 min
const priceBuffer: { price: number; ts: number }[] = [];

const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";

function getWindowStart(): number {
  return Math.floor(Date.now() / 1000 / 900) * 900;
}

function handlePrice(price: number) {
  if (price <= 0) return;
  lastPrice = price;
  lastUpdate = Date.now();

  // Record price for velocity tracking (sample every ~2s to avoid bloat)
  const now = Date.now();
  if (priceBuffer.length === 0 || now - priceBuffer[priceBuffer.length - 1].ts >= 2000) {
    priceBuffer.push({ price, ts: now });
    // Trim old entries
    while (priceBuffer.length > 0 && now - priceBuffer[0].ts > VELOCITY_BUFFER_MAX_AGE_MS) {
      priceBuffer.shift();
    }
  }

  // Snapshot window-open price at the start of each 15-min window
  const currentWindowStart = getWindowStart();
  if (currentWindowStart !== windowOpenTs) {
    windowOpenPrice = price;
    windowOpenTs = currentWindowStart;
    logger.info(`[CoinbaseWS] New window ${currentWindowStart}: open price $${price.toFixed(2)}`);
  }
}

function connect() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  try {
    ws = new WebSocket(COINBASE_WS_URL);
  } catch (err) {
    logger.error(`[CoinbaseWS] Failed to create WebSocket: ${err}`);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    logger.info("[CoinbaseWS] Connected to Coinbase BTC-USD stream");

    // Subscribe to the ticker channel for BTC-USD
    const subscribeMsg = JSON.stringify({
      type: "subscribe",
      product_ids: ["BTC-USD"],
      channels: ["ticker"],
    });
    ws!.send(subscribeMsg);
  });

  ws.on("message", (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());

      // Coinbase ticker message has type "ticker" with a "price" field
      if (msg.type === "ticker" && msg.product_id === "BTC-USD") {
        const price = parseFloat(msg.price);
        handlePrice(price);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    logger.warn("[CoinbaseWS] Disconnected");
    if (running) scheduleReconnect();
  });

  ws.on("error", (err) => {
    logger.error(`[CoinbaseWS] Error: ${err.message}`);
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

/** Current BTC price from Coinbase (0 if not yet received). */
export function getBinancePrice(): number {
  return lastPrice;
}

/** Timestamp of last Coinbase update (ms). */
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

/** Returns true if Coinbase WS is connected and data is fresh (<10s old). */
export function isBinanceFresh(): boolean {
  return lastUpdate > 0 && Date.now() - lastUpdate < 10_000;
}

/**
 * BTC velocity: % change over the last N seconds.
 * Positive = price rising, negative = falling.
 * Returns 0 if not enough data.
 *
 * Use to detect rapid moves - if |velocity| is high, the market
 * is moving fast and fair values are unreliable.
 */
export function getBtcVelocity(lookbackMs: number = 60_000): number {
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
  return (lastPrice - oldest.price) / oldest.price;
}
