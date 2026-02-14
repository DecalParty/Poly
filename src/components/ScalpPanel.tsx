"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { ActiveMarketState, ScalpData, BotSettings, WindowOutcome } from "@/types";
import BtcPriceChart from "./BtcPriceChart";

interface ScalpPanelProps {
  activeMarkets: Record<string, ActiveMarketState>;
  scalp: ScalpData;
  settings: BotSettings;
  recentOutcomes: WindowOutcome[];
}

export default function ScalpPanel({ activeMarkets, scalp, settings, recentOutcomes }: ScalpPanelProps) {
  const [, setTick] = useState(0);
  const prevPriceRef = useRef(0);
  const [priceFlash, setPriceFlash] = useState<"" | "price-up" | "price-down">("");

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Flash price on change
  useEffect(() => {
    if (scalp.binancePrice > 0 && prevPriceRef.current > 0) {
      if (scalp.binancePrice > prevPriceRef.current) {
        setPriceFlash("price-up");
      } else if (scalp.binancePrice < prevPriceRef.current) {
        setPriceFlash("price-down");
      }
      const t = setTimeout(() => setPriceFlash(""), 600);
      return () => clearTimeout(t);
    }
  }, [scalp.binancePrice]);

  useEffect(() => {
    prevPriceRef.current = scalp.binancePrice;
  }, [scalp.binancePrice]);

  const market = activeMarkets["BTC"];
  const secsLeft = market?.secondsRemaining ?? 0;
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const pctUsed = Math.max(0, 100 - (secsLeft / 900) * 100);
  const timerUrgent = secsLeft < 120;
  const timerWarn = secsLeft < 300;

  const btcPct = (scalp.btcChangePercent * 100);
  const btcUp = btcPct > 0;
  const btcFlat = Math.abs(btcPct) < 0.05;

  const upGap = market ? scalp.fairValue.up - market.yesPrice : 0;
  const downGap = market ? scalp.fairValue.down - market.noPrice : 0;
  const upSignal = upGap >= settings.scalpMinGap && market && market.yesPrice >= settings.scalpEntryMin && market.yesPrice <= settings.scalpEntryMax;
  const downSignal = downGap >= settings.scalpMinGap && market && market.noPrice >= settings.scalpEntryMin && market.noPrice <= settings.scalpEntryMax;

  const displayOutcomes = useMemo(() => recentOutcomes.slice(0, 16), [recentOutcomes]);

  return (
    <div className="space-y-2">
      {/* === TOP ROW: BTC Price + Chart | UP/DOWN === */}
      <div className="grid grid-cols-12 gap-2">
        {/* BTC Price + Live Chart */}
        <div className="col-span-12 lg:col-span-6 bg-[#111318] rounded-xl border border-white/[0.04] overflow-hidden">
          <div className="flex items-start justify-between p-3 pb-0">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${scalp.binancePrice > 0 ? "bg-emerald-400 pulse-dot" : "bg-gray-600"}`} />
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">BTC/USD</span>
              </div>
              <div className={`mono text-[22px] font-bold text-gray-100 leading-none ${priceFlash}`} key={`p-${scalp.binancePrice}`}>
                ${scalp.binancePrice > 0 ? scalp.binancePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---"}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`mono text-[11px] font-bold ${btcFlat ? "text-gray-500" : btcUp ? "text-emerald-400" : "text-red-400"}`}>
                  {btcPct >= 0 ? "+" : "-"} {Math.abs(btcPct).toFixed(3)}%
                </span>
                <span className="text-[9px] text-gray-600">vs open</span>
                <span className="mono text-[10px] text-gray-500">
                  ${scalp.windowOpenPrice > 0 ? scalp.windowOpenPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "---"}
                </span>
              </div>
            </div>
            {/* Timer compact */}
            <div className="text-right">
              <span className="text-[8px] text-gray-600 uppercase tracking-wider">Window</span>
              <div className={`mono text-[16px] font-bold leading-none mt-0.5 ${timerUrgent ? "text-red-400" : timerWarn ? "text-amber-400" : "text-gray-200"}`}>
                {mins}:{secs.toString().padStart(2, "0")}
              </div>
              <div className="mt-1 w-16 h-[3px] bg-white/[0.04] rounded-full overflow-hidden ml-auto">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${timerUrgent ? "bg-red-400" : timerWarn ? "bg-amber-400" : "bg-blue-400"}`}
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
            </div>
          </div>
          {/* Live Chart */}
          <div className="px-1 -mt-1">
            <BtcPriceChart
              currentPrice={scalp.binancePrice}
              openPrice={scalp.windowOpenPrice}
              height={100}
            />
          </div>
        </div>

        {/* UP (Yes) Card */}
        <div className={`col-span-6 lg:col-span-3 bg-[#111318] rounded-xl p-3 border transition-all duration-300 ${
          upSignal ? "border-emerald-500/30 bg-emerald-500/[0.03] signal-buy-up" : "border-white/[0.04]"
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">UP (Yes)</span>
            {upSignal && (
              <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/15 px-1.5 py-0.5 rounded animate-pulse">BUY</span>
            )}
          </div>
          <div className="mono text-[22px] font-bold text-emerald-400 leading-none">
            ${market?.yesPrice.toFixed(2) ?? "---"}
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-600">Fair</span>
              <span className="mono text-[10px] text-gray-400">${scalp.fairValue.up.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-600">Gap</span>
              <span className={`mono text-[10px] font-semibold ${upGap >= settings.scalpMinGap ? "text-emerald-400" : "text-gray-600"}`}>
                {upGap >= 0 ? "+" : ""}{upGap.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* DOWN (No) Card */}
        <div className={`col-span-6 lg:col-span-3 bg-[#111318] rounded-xl p-3 border transition-all duration-300 ${
          downSignal ? "border-red-500/30 bg-red-500/[0.03] signal-buy-down" : "border-white/[0.04]"
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-widest">DOWN (No)</span>
            {downSignal && (
              <span className="text-[8px] font-bold text-red-400 bg-red-400/15 px-1.5 py-0.5 rounded animate-pulse">BUY</span>
            )}
          </div>
          <div className="mono text-[22px] font-bold text-red-400 leading-none">
            ${market?.noPrice.toFixed(2) ?? "---"}
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-600">Fair</span>
              <span className="mono text-[10px] text-gray-400">${scalp.fairValue.down.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-gray-600">Gap</span>
              <span className={`mono text-[10px] font-semibold ${downGap >= settings.scalpMinGap ? "text-red-400" : "text-gray-600"}`}>
                {downGap >= 0 ? "+" : ""}{downGap.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* === BOTTOM ROW: Positions + Outcomes === */}
      <div className="grid grid-cols-12 gap-2">
        {/* Active Positions / Pending */}
        <div className="col-span-12 lg:col-span-8">
          {scalp.positions.length > 0 ? (
            <div className="bg-[#111318] rounded-xl border border-white/[0.04] overflow-hidden">
              <div className="px-3 py-2 border-b border-white/[0.04] flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Positions</span>
                <span className="text-[9px] text-gray-600 mono">{scalp.positions.length} active</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {scalp.positions.map((pos) => (
                  <div key={pos.id} className="px-3 py-2 flex items-center gap-3 hover:bg-white/[0.01] transition-colors">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      pos.side === "yes" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
                    }`}>
                      {pos.side === "yes" ? "UP" : "DN"}
                    </span>
                    <div className="flex-1 grid grid-cols-5 gap-2 items-center">
                      <div>
                        <span className="text-[8px] text-gray-600 block">Entry</span>
                        <span className="mono text-[11px] text-gray-300">${pos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-600 block">Now</span>
                        <span className="mono text-[11px] text-gray-300">${pos.currentPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-600 block">Target</span>
                        <span className="mono text-[11px] text-gray-300">${pos.sellPrice.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[8px] text-gray-600 block">P&amp;L</span>
                        <span className={`mono text-[11px] font-bold ${pos.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pos.unrealizedPnl >= 0 ? "+" : ""}${pos.unrealizedPnl.toFixed(4)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="mono text-[10px] text-gray-600">{pos.shares.toFixed(1)} sh</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : scalp.pendingBuys.length > 0 ? (
            <div className="bg-[#111318] rounded-xl border border-amber-500/10 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/[0.04] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Pending</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {scalp.pendingBuys.map((buy) => (
                  <div key={buy.orderId} className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold ${buy.side === "yes" ? "text-emerald-400" : "text-red-400"}`}>
                        BUY {buy.side === "yes" ? "UP" : "DN"}
                      </span>
                      <span className="mono text-[11px] text-gray-300">${buy.price.toFixed(2)}</span>
                      <span className="mono text-[10px] text-gray-600">{buy.size.toFixed(1)} sh</span>
                    </div>
                    <span className="text-[9px] text-amber-400/60 animate-pulse">waiting</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#111318] rounded-xl border border-white/[0.04] flex items-center justify-center py-6">
              <span className="text-[11px] text-gray-600">No active positions</span>
            </div>
          )}

          {/* Show pending below positions if both exist */}
          {scalp.positions.length > 0 && scalp.pendingBuys.length > 0 && (
            <div className="bg-[#111318] rounded-xl border border-amber-500/10 overflow-hidden mt-2">
              <div className="px-3 py-1.5 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[9px] font-semibold text-gray-500 uppercase">Pending</span>
                {scalp.pendingBuys.map((buy) => (
                  <span key={buy.orderId} className={`text-[9px] font-bold ${buy.side === "yes" ? "text-emerald-400" : "text-red-400"}`}>
                    {buy.side === "yes" ? "UP" : "DN"} ${buy.price.toFixed(2)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Recent Windows */}
        <div className="col-span-12 lg:col-span-4">
          {displayOutcomes.length > 0 ? (
            <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3 h-full">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Recent Windows</div>
              <div className="flex gap-1 flex-wrap">
                {displayOutcomes.map((o) => (
                  <div key={o.slug} className={`px-1.5 py-0.5 rounded text-[9px] font-semibold transition-all ${
                    o.result === "up" ? "bg-emerald-400/10 text-emerald-400" :
                    o.result === "down" ? "bg-red-400/10 text-red-400" :
                    "bg-white/[0.04] text-gray-600 animate-pulse"
                  }`}>
                    {o.endTime} {o.result === "pending" ? "?" : o.result === "up" ? "UP" : "DN"}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3 h-full flex items-center justify-center">
              <span className="text-[10px] text-gray-600">No window history</span>
            </div>
          )}
        </div>
      </div>

      {/* Cooldown */}
      {scalp.cooldownUntil > Math.floor(Date.now() / 1000 / 900) * 900 && (
        <div className="bg-amber-500/[0.04] border border-amber-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] text-amber-400 font-medium">Cooldown active - skipping entries after loss</span>
        </div>
      )}
    </div>
  );
}
