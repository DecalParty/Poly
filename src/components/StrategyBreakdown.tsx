"use client";

import type { StrategyPerformance } from "@/types";

interface StrategyBreakdownProps {
  strategies: StrategyPerformance[];
}

export default function StrategyBreakdown({ strategies }: StrategyBreakdownProps) {
  const hc = strategies.find((s) => s.strategy === "highConfidence") || {
    strategy: "highConfidence" as const,
    trades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    pnl: 0,
    avgPnl: 0,
  };

  return (
    <div className="card p-4">
      <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">
        Strategy
      </h2>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-200">
            DCA Accumulator
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
              hc.pnl > 0
                ? "bg-emerald-500/10 text-emerald-400"
                : hc.pnl < 0
                ? "bg-red-500/10 text-red-400"
                : "bg-white/[0.04] text-gray-500"
            }`}
          >
            {hc.pnl >= 0 ? "+" : ""}${hc.pnl.toFixed(2)}
          </span>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Trades" value={hc.trades.toString()} />
          <Stat
            label="Win Rate"
            value={hc.trades > 0 ? `${hc.winRate.toFixed(0)}%` : "�"}
            color={
              hc.winRate >= 50
                ? "text-emerald-400"
                : hc.trades > 0
                ? "text-red-400"
                : undefined
            }
          />
          <Stat label="Wins" value={hc.wins.toString()} color="text-emerald-400" />
          <Stat
            label="Losses"
            value={hc.losses.toString()}
            color={hc.losses > 0 ? "text-red-400" : undefined}
          />
        </div>

        {/* Win rate bar */}
        {hc.trades > 0 && (
          <div>
            <div className="flex justify-between text-[10px] text-gray-600 mb-1">
              <span>Win Rate</span>
              <span className="mono">{hc.winRate.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/80 transition-all duration-700"
                style={{ width: `${Math.min(100, hc.winRate)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-black/20 rounded-lg p-2.5">
      <p className="text-[9px] text-gray-600 mb-0.5">{label}</p>
      <p className={`mono text-[15px] font-bold ${color || "text-gray-300"}`}>
        {value}
      </p>
    </div>
  );
}
