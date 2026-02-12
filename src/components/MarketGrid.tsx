"use client";

import { useState, useEffect, useRef } from "react";
import type { ActiveMarketState, WindowPosition, MarketAsset, WindowOutcome } from "@/types";
import { ASSET_COLORS } from "@/types";

interface MarketGridProps {
  activeMarkets: Record<string, ActiveMarketState>;
  positions: Record<string, WindowPosition>;
  enabledAssets: MarketAsset[];
  recentOutcomes: WindowOutcome[];
}

export default function MarketGrid({ activeMarkets, positions, enabledAssets, recentOutcomes }: MarketGridProps) {
  const assets: MarketAsset[] = enabledAssets.length > 0 ? enabledAssets : ["BTC"];
  const [, setTick] = useState(0);
  const lastServerTimes = useRef<Record<string, { secondsRemaining: number; receivedAt: number }>>({});

  useEffect(() => {
    const now = Date.now();
    for (const asset of assets) {
      const market = activeMarkets[asset];
      if (market) {
        const prev = lastServerTimes.current[asset];
        if (!prev || prev.secondsRemaining !== market.secondsRemaining) {
          lastServerTimes.current[asset] = { secondsRemaining: market.secondsRemaining, receivedAt: now };
        }
      }
    }
  }, [activeMarkets, assets]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function getLive(asset: string, serverValue: number): number {
    const ref = lastServerTimes.current[asset];
    if (!ref) return serverValue;
    const elapsed = Math.floor((Date.now() - ref.receivedAt) / 1000);
    return Math.max(0, ref.secondsRemaining - elapsed);
  }

  return (
    <div className="card p-5">
      <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">Markets</h2>

      {assets.map((asset) => {
        const market = activeMarkets[asset];
        const posKey = market ? `${asset}-${market.conditionId}` : "";
        const position = posKey ? positions[posKey] : undefined;
        const color = ASSET_COLORS[asset];
        const live = market ? getLive(asset, market.secondsRemaining) : 0;
        const mm = market ? Math.floor(live / 60) : 0;
        const ss = market ? live % 60 : 0;

        return (
          <div key={asset} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Active Window Card */}
            <ActiveWindowCard
              asset={asset}
              market={market}
              position={position}
              color={color}
              mm={mm}
              ss={ss}
              live={live}
            />

            {/* Window History */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                  <rect x="1" y="1" width="6" height="6" rx="1" />
                  <rect x="9" y="1" width="6" height="6" rx="1" />
                  <rect x="1" y="9" width="6" height="6" rx="1" />
                  <rect x="9" y="9" width="6" height="6" rx="1" />
                </svg>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Recent Windows</p>
                {recentOutcomes.length > 0 && (
                  <span className="ml-auto text-[9px] text-gray-700 mono">{recentOutcomes.filter(o => o.result === 'up').length}W - {recentOutcomes.filter(o => o.result === 'down').length}L</span>
                )}
              </div>
              {recentOutcomes.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[12px] text-gray-700">
                  Loading history...
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2">
                  {recentOutcomes.map((outcome) => (
                    <OutcomePill key={outcome.slug} outcome={outcome} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActiveWindowCard({
  asset, market, position, color, mm, ss, live,
}: {
  asset: MarketAsset;
  market: ActiveMarketState | undefined;
  position: WindowPosition | undefined;
  color: string;
  mm: number;
  ss: number;
  live: number;
}) {
  const hasPosition = !!position;
  const timerColor = !market
    ? "text-gray-700"
    : live < 120
    ? "text-red-400"
    : live < 300
    ? "text-amber-400"
    : "text-gray-100";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: color, color }} />
          <span className="text-[16px] font-bold text-gray-50">{asset}</span>
        </div>
        {hasPosition ? (
          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
            POSITION
          </span>
        ) : market ? (
          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider bg-white/[0.04] text-gray-500 border border-white/[0.06]">
            WATCHING
          </span>
        ) : (
          <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold tracking-wider bg-white/[0.03] text-gray-600 border border-white/[0.04]">
            OFFLINE
          </span>
        )}
      </div>

      {/* Timer */}
      <div className="mb-4">
        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">15-min window</p>
        <div className="flex items-baseline gap-1">
          <span className={`mono text-[32px] font-bold tracking-tight leading-none ${timerColor}`}>
            {market ? `${mm}:${ss.toString().padStart(2, "0")}` : "--:--"}
          </span>
          {market && live > 0 && (
            <span className="text-[10px] text-gray-600 ml-1">remaining</span>
          )}
        </div>
        {/* Timer bar */}
        {market && (
          <div className="w-full h-1 rounded-full bg-white/[0.04] mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                live < 120 ? "bg-red-500/60" : live < 300 ? "bg-amber-500/50" : "bg-blue-500/40"
              }`}
              style={{ width: `${Math.min(100, (live / 900) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Prices */}
      {market ? (
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <PriceBox
            label="UP"
            price={market.yesPrice}
            leading={market.yesPrice > market.noPrice}
            variant="up"
          />
          <PriceBox
            label="DOWN"
            price={market.noPrice}
            leading={market.noPrice > market.yesPrice}
            variant="down"
          />
        </div>
      ) : (
        <div className="text-center text-[12px] text-gray-700 py-6 mb-4">
          Waiting for market...
        </div>
      )}

      {/* Position details */}
      {position && (
        <div className="border-t border-white/[0.04] pt-3 space-y-1.5">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-500">Position</span>
            <span className={`text-[12px] font-bold ${position.side === "yes" ? "text-emerald-400" : "text-red-400"}`}>
              {position.side === "yes" ? "UP" : "DOWN"} @ ${position.avgEntryPrice.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-500">Cost</span>
            <span className="mono text-[12px] text-gray-300">${position.costBasis.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-gray-500">P&L</span>
            <span className={`mono text-[12px] font-bold ${position.unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {position.unrealizedPnl >= 0 ? "+" : ""}${position.unrealizedPnl.toFixed(4)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PriceBox({ label, price, leading, variant }: {
  label: string;
  price: number;
  leading: boolean;
  variant: "up" | "down";
}) {
  const isUp = variant === "up";
  return (
    <div className={`rounded-xl p-3 border transition-all duration-300 ${
      leading
        ? isUp
          ? "bg-emerald-500/[0.08] border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.04)]"
          : "bg-red-500/[0.08] border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.04)]"
        : "bg-white/[0.02] border-white/[0.04]"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        {leading && (
          <span className={`text-[7px] font-bold tracking-wider ${isUp ? "text-emerald-400" : "text-red-400"}`}>
            LEADING
          </span>
        )}
      </div>
      <p className={`mono text-[18px] font-bold tracking-tight ${
        leading
          ? isUp ? "text-emerald-400" : "text-red-400"
          : "text-gray-500"
      }`}>
        ${price.toFixed(4)}
      </p>
    </div>
  );
}

function OutcomePill({ outcome }: { outcome: WindowOutcome }) {
  const isUp = outcome.result === "up";
  const isDown = outcome.result === "down";
  const isPending = outcome.result === "pending";

  return (
    <div className={`group relative rounded-xl border p-3 text-center transition-all duration-300 hover:scale-[1.03] ${
      isUp
        ? "bg-gradient-to-b from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.06)]"
        : isDown
        ? "bg-gradient-to-b from-red-500/[0.08] to-red-500/[0.02] border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.06)]"
        : "bg-gradient-to-b from-white/[0.03] to-white/[0.01] border-white/[0.06]"
    }`}>
      <p className="text-[10px] text-gray-500 mono mb-2">{outcome.endTime}</p>
      {isPending ? (
        <div className="flex items-center justify-center gap-1.5">
          <div className="flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-gray-500 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5">
          {isUp ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-emerald-400">
              <path d="M8 3v10M4 7l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-red-400">
              <path d="M8 13V3M4 9l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <span className={`text-[12px] font-bold tracking-wide ${
            isUp ? "text-emerald-400" : "text-red-400"
          }`}>
            {isUp ? "UP" : "DN"}
          </span>
        </div>
      )}
    </div>
  );
}
