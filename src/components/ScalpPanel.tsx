"use client";

import { useState, useEffect } from "react";
import type { ActiveMarketState, ScalpData, BotSettings, WindowOutcome } from "@/types";

interface ScalpPanelProps {
  activeMarkets: Record<string, ActiveMarketState>;
  scalp: ScalpData;
  settings: BotSettings;
  recentOutcomes: WindowOutcome[];
}

export default function ScalpPanel({ activeMarkets, scalp, settings, recentOutcomes }: ScalpPanelProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const market = activeMarkets["BTC"];
  const secsLeft = market?.secondsRemaining ?? 0;
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const pctUsed = Math.max(0, 100 - (secsLeft / 900) * 100);

  const btcPct = (scalp.btcChangePercent * 100);
  const btcUp = btcPct > 0;
  const btcFlat = Math.abs(btcPct) < 0.05;

  const upGap = market ? scalp.fairValue.up - market.yesPrice : 0;
  const downGap = market ? scalp.fairValue.down - market.noPrice : 0;
  const upSignal = upGap >= settings.scalpMinGap && market && market.yesPrice >= settings.scalpEntryMin && market.yesPrice <= settings.scalpEntryMax;
  const downSignal = downGap >= settings.scalpMinGap && market && market.noPrice >= settings.scalpEntryMin && market.noPrice <= settings.scalpEntryMax;

  return (
    <div className="space-y-3">
      {/* Price Feeds */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Binance BTC */}
        <div className="bg-[#111318] rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 mb-1">
            <div className={`w-1.5 h-1.5 rounded-full ${scalp.binancePrice > 0 ? "bg-emerald-400 pulse-dot" : "bg-gray-600"}`} />
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Binance BTC</span>
          </div>
          <div className="mono text-[18px] font-bold text-gray-100">
            ${scalp.binancePrice > 0 ? scalp.binancePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---"}
          </div>
          <div className={`mono text-[12px] font-semibold mt-0.5 ${btcFlat ? "text-gray-500" : btcUp ? "text-emerald-400" : "text-red-400"}`}>
            {btcPct >= 0 ? "+" : ""}{btcPct.toFixed(3)}%
            <span className="text-gray-600 ml-1">from open</span>
          </div>
        </div>

        {/* Window Timer */}
        <div className="bg-[#111318] rounded-xl p-3 border border-white/[0.04]">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Window</span>
          </div>
          <div className="mono text-[18px] font-bold text-gray-100">
            {mins}:{secs.toString().padStart(2, "0")}
          </div>
          <div className="mt-1.5 h-1 bg-white/[0.04] rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-1000 ${secsLeft < 120 ? "bg-red-400" : secsLeft < 300 ? "bg-amber-400" : "bg-blue-400"}`}
              style={{ width: `${pctUsed}%` }} />
          </div>
        </div>

        {/* UP Share */}
        <div className={`bg-[#111318] rounded-xl p-3 border ${upSignal ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-white/[0.04]"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">UP (Yes)</span>
            {upSignal && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">BUY</span>}
          </div>
          <div className="mono text-[18px] font-bold text-emerald-400">
            ${market?.yesPrice.toFixed(2) ?? "---"}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">Fair</span>
            <span className="mono text-[11px] text-gray-400">${scalp.fairValue.up.toFixed(2)}</span>
            <span className={`mono text-[11px] font-semibold ${upGap >= settings.scalpMinGap ? "text-emerald-400" : "text-gray-600"}`}>
              gap {upGap >= 0 ? "+" : ""}{upGap.toFixed(2)}
            </span>
          </div>
        </div>

        {/* DOWN Share */}
        <div className={`bg-[#111318] rounded-xl p-3 border ${downSignal ? "border-red-500/30 bg-red-500/[0.03]" : "border-white/[0.04]"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">DOWN (No)</span>
            {downSignal && <span className="text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">BUY</span>}
          </div>
          <div className="mono text-[18px] font-bold text-red-400">
            ${market?.noPrice.toFixed(2) ?? "---"}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-500">Fair</span>
            <span className="mono text-[11px] text-gray-400">${scalp.fairValue.down.toFixed(2)}</span>
            <span className={`mono text-[11px] font-semibold ${downGap >= settings.scalpMinGap ? "text-red-400" : "text-gray-600"}`}>
              gap {downGap >= 0 ? "+" : ""}{downGap.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Active Positions */}
      {scalp.positions.length > 0 && (
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.04]">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Active Positions</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {scalp.positions.map((pos) => (
              <div key={pos.id} className="px-4 py-3 flex items-center gap-4">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${pos.side === "yes" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                  {pos.side === "yes" ? "UP" : "DOWN"}
                </span>
                <div className="flex-1 grid grid-cols-4 gap-2">
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase">Entry</div>
                    <div className="mono text-[12px] text-gray-300">${pos.entryPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase">Current</div>
                    <div className="mono text-[12px] text-gray-300">${pos.currentPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase">Target</div>
                    <div className="mono text-[12px] text-gray-300">${pos.sellPrice.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase">P&L</div>
                    <div className={`mono text-[12px] font-semibold ${pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(4)}
                    </div>
                  </div>
                </div>
                <div className="mono text-[11px] text-gray-600">{pos.shares.toFixed(1)} shares</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Buys */}
      {scalp.pendingBuys.length > 0 && (
        <div className="bg-[#111318] rounded-xl border border-amber-500/10 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Pending Orders</span>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {scalp.pendingBuys.map((buy) => (
              <div key={buy.orderId} className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] font-bold ${buy.side === "yes" ? "text-emerald-400" : "text-red-400"}`}>
                    BUY {buy.side === "yes" ? "UP" : "DOWN"}
                  </span>
                  <span className="mono text-[12px] text-gray-300">${buy.price.toFixed(2)}</span>
                  <span className="mono text-[11px] text-gray-600">{buy.size.toFixed(1)} shares</span>
                </div>
                <span className="text-[10px] text-amber-400/60">waiting for fill</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cooldown */}
      {scalp.cooldownUntil > Math.floor(Date.now() / 1000 / 900) * 900 && (
        <div className="bg-amber-500/[0.04] border border-amber-500/10 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-[11px] text-amber-400">Cooldown active - skipping entries after loss</span>
        </div>
      )}

      {/* Recent Windows */}
      {recentOutcomes.length > 0 && (
        <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-4">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Recent Windows</div>
          <div className="flex gap-1.5 flex-wrap">
            {recentOutcomes.slice(0, 12).map((o) => (
              <div key={o.slug} className={`px-2 py-1 rounded-md text-[10px] font-medium ${
                o.result === "up" ? "bg-emerald-400/10 text-emerald-400" :
                o.result === "down" ? "bg-red-400/10 text-red-400" :
                "bg-white/[0.04] text-gray-600"
              }`}>
                {o.endTime} {o.result === "pending" ? "?" : o.result.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
