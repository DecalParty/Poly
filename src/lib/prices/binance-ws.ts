import WebSocket from "ws";
import { logger } from "../logger";

// ??? Binance BTC Real-time Price Feed ????????????????????????????????????????
// Connects to Binance BTCUSDT mini ticker stream for sub-second price updates.

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastPrice = 0;
let lastUpdate = 0;
let windowOpenPrice = 0;
let windowOpenTs = 0;
let running = false;

const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@miniTicker";

function getWindowStart(): number {
  return Math.floor(Date.now() / 1000 / 900) * 900;
}

function connect() {
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }

  try {
    ws = new WebSocket(BINANCE_WS_URL);
  } catch (err) {
    logger.error(`[BinanceWS] Failed to create WebSocket: ${err}`);
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    logger.info("[BinanceWS] Connected to Binance BTCUSDT stream");
  });

  ws.on("message", (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      // miniTicker fields: c = close (last price), o = open, h = high, l = low
      const price = parseFloat(msg.c);
      if (price > 0) {
        lastPrice = price;
        lastUpdate = Date.now();

        // Snapshot window-open price at the start of each 15-min window
        const currentWindowStart = getWindowStart();
        if (currentWindowStart !== windowOpenTs) {
          windowOpenPrice = price;
          windowOpenTs = currentWindowStart;
          logger.info(`[BinanceWS] New window ${currentWindowStart}: open price $${price.toFixed(2)}`);
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("close", () => {
    logger.warn("[BinanceWS] Disconnected");
    if (running) scheduleReconnect();
  });

  ws.on("error", (err) => {
    logger.error(`[BinanceWS] Error: ${err.message}`);
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

/** Current BTC price from Binance (0 if not yet received). */
export function getBinancePrice(): number {
  return lastPrice;
}

/** Timestamp of last Binance update (ms). */
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

/** Returns true if Binance WS is connected and data is fresh (<10s old). */
export function isBinanceFresh(): boolean {
  return lastUpdate > 0 && Date.now() - lastUpdate < 10_000;
}
