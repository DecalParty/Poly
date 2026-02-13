"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  BotState,
  SSEEvent,
  TradeRecord,
  PnlDataPoint,
  DailyPnlPoint,
  AlertItem,
  StrategyPerformance,
  ActiveMarketState,
  WindowOutcome,
  ArbWindowState,
  ArbStats,
  ScalpData,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

const DEFAULT_STATE: BotState = {
  status: "stopped",
  connection: "disconnected",
  lastAction: "Idle",
  lastActionTime: null,
  currentMarket: null,
  currentPosition: null,
  settings: { ...DEFAULT_SETTINGS },
  cumulativePnl: 0,
  totalTrades: 0,
  activeMarkets: {},
  positions: {},
  capital: {
    totalBankroll: 50,
    deployed: 0,
    available: 30,
    maxExposure: 30,
    todayPnl: 0,
    winStreak: 0,
    totalLosses: 0,
  },
  circuitBreaker: {
    triggered: false,
    reason: null,
    resumeAt: null,
    dailyPnl: 0,
    totalLosses: 0,
  },
  clobReady: false,
  alerts: [],
  arbState: null,
  walletBalance: null,
  walletAddress: null,
  arbStats: {
    windowsPlayed: 0,
    bothSidesFilled: 0,
    oneSideFilled: 0,
    neitherFilled: 0,
    totalPnl: 0,
    avgProfitPerWindow: 0,
  },
  scalp: {
    binancePrice: 0,
    windowOpenPrice: 0,
    btcChangePercent: 0,
    fairValue: { up: 0.5, down: 0.5 },
    positions: [],
    pendingBuys: [],
    cooldownUntil: 0,
  },
};

export function useBotState() {
  const [state, setState] = useState<BotState>(DEFAULT_STATE);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [pnlHistory, setPnlHistory] = useState<PnlDataPoint[]>([]);
  const [dailyPnl, setDailyPnl] = useState<DailyPnlPoint[]>([]);
  const [strategyPerf, setStrategyPerf] = useState<StrategyPerformance[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [recentOutcomes, setRecentOutcomes] = useState<WindowOutcome[]>([]);
  const [scalpData, setScalpData] = useState<ScalpData | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        fetch("/api/bot/status"),
        fetch("/api/trades"),
      ]);
      const statusData = await statusRes.json();
      const tradesData = await tradesRes.json();

      if (statusData.success) {
        setState(statusData.data);
        if (statusData.data.alerts) setAlerts(statusData.data.alerts);
      }
      if (tradesData.success) {
        setTrades(tradesData.data.trades);
        setPnlHistory(tradesData.data.pnlHistory);
      }

      // Fetch stats
      try {
        const statsRes = await fetch("/api/stats");
        const statsData = await statsRes.json();
        if (statsData.success) {
          if (statsData.data.daily) setDailyPnl(statsData.data.daily);
          if (statsData.data.strategies) setStrategyPerf(statsData.data.strategies);
        }
      } catch {
        // Stats endpoint may not exist yet
      }

      // Fetch recent window outcomes
      try {
        const outcomesRes = await fetch("/api/outcomes");
        const outcomesData = await outcomesRes.json();
        if (outcomesData.success && Array.isArray(outcomesData.data)) {
          setRecentOutcomes(outcomesData.data);
        }
      } catch {
        // Outcomes endpoint may not be ready yet
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
    }
  }, []);

  // Connect to SSE stream
  useEffect(() => {
    fetchInitialData();

    const connect = () => {
      const es = new EventSource("/api/stream");
      eventSourceRef.current = es;

      es.onopen = () => setSseConnected(true);

      es.onmessage = (e) => {
        try {
          const event: SSEEvent = JSON.parse(e.data);

          switch (event.type) {
            case "state":
              setState(event.data as BotState);
              break;
            case "price": {
              const pricePayload = event.data as {
                markets: Record<string, ActiveMarketState>;
                recentOutcomes?: WindowOutcome[];
                scalp?: ScalpData;
              };
              setState((prev) => ({
                ...prev,
                activeMarkets: pricePayload.markets
                  ? { ...prev.activeMarkets, ...pricePayload.markets }
                  : prev.activeMarkets,
              }));
              if (pricePayload.scalp) {
                setScalpData(pricePayload.scalp);
              }
              if (pricePayload.recentOutcomes) {
                setRecentOutcomes((prev) => {
                  // Only update if data actually changed to avoid unnecessary re-renders
                  if (prev.length !== pricePayload.recentOutcomes!.length) return pricePayload.recentOutcomes!;
                  for (let i = 0; i < prev.length; i++) {
                    if (prev[i].slug !== pricePayload.recentOutcomes![i].slug ||
                        prev[i].result !== pricePayload.recentOutcomes![i].result) {
                      return pricePayload.recentOutcomes!;
                    }
                  }
                  return prev;
                });
              }
              break;
            }
            case "trade":
              setTrades((prev) => [event.data as TradeRecord, ...prev].slice(0, 200));
              fetch("/api/trades")
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) setPnlHistory(d.data.pnlHistory);
                });
              fetch("/api/stats")
                .then((r) => r.json())
                .then((d) => {
                  if (d.success) {
                    if (d.data.daily) setDailyPnl(d.data.daily);
                    if (d.data.strategies) setStrategyPerf(d.data.strategies);
                  }
                })
                .catch(() => {});
              break;
            case "alert":
              setAlerts((prev) => [event.data as AlertItem, ...prev].slice(0, 100));
              break;
            case "log":
              setLogs((prev) =>
                [`[${new Date().toLocaleTimeString()}] ${(event.data as any).message}`, ...prev].slice(0, 100)
              );
              break;
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      eventSourceRef.current?.close();
    };
  }, [fetchInitialData]);

  // Bot control actions
  const startBot = useCallback(async () => {
    const res = await fetch("/api/bot/start", { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    // Immediately refresh state so UI updates without waiting for SSE
    await fetchInitialData();
  }, [fetchInitialData]);

  const stopBot = useCallback(async () => {
    const res = await fetch("/api/bot/stop", { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    await fetchInitialData();
  }, [fetchInitialData]);

  const updateSettings = useCallback(async (settings: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (data.success) {
      setState((prev) => ({ ...prev, settings: data.data }));
    }
    return data;
  }, []);

  const resetCircuitBreaker = useCallback(async () => {
    const res = await fetch("/api/bot/circuit-breaker/reset", { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    await fetchInitialData();
  }, [fetchInitialData]);

  const resetStats = useCallback(async () => {
    const res = await fetch("/api/stats", { method: "DELETE" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    setTrades([]);
    setPnlHistory([]);
    setDailyPnl([]);
    setStrategyPerf([]);
    await fetchInitialData();
  }, [fetchInitialData]);

  return {
    state,
    trades,
    pnlHistory,
    dailyPnl,
    strategyPerf,
    alerts,
    logs,
    recentOutcomes,
    scalpData,
    sseConnected,
    startBot,
    stopBot,
    updateSettings,
    resetCircuitBreaker,
    resetStats,
  };
}
