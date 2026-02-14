"use client";

import type { CapitalState, CircuitBreakerState } from "@/types";

interface CapitalPanelProps {
  capital: CapitalState;
  circuitBreaker: CircuitBreakerState;
}

export default function CapitalPanel({ capital, circuitBreaker }: CapitalPanelProps) {
  const exposurePct = capital.maxExposure > 0 ? (capital.deployed / capital.maxExposure) * 100 : 0;

  return (
    <div className="bg-[#111318] rounded-xl border border-white/[0.04] p-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Capital</h2>
        {circuitBreaker.triggered ? (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 animate-pulse">BREAKER</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400">ARMED</span>
        )}
      </div>

      {/* P&L Hero */}
      <div className="text-center py-2 mb-2 rounded-lg bg-white/[0.015] border border-white/[0.04]">
        <p className="text-[8px] text-gray-600 mb-0.5">Today&apos;s P&amp;L</p>
        <p className={`mono text-[22px] font-bold tracking-tight leading-none ${capital.todayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {capital.todayPnl >= 0 ? "+" : ""}${capital.todayPnl.toFixed(2)}
        </p>
      </div>

      {/* Compact stats */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <StatMini label="Max" value={`$${capital.maxExposure.toFixed(0)}`} />
        <StatMini label="Deployed" value={`$${capital.deployed.toFixed(2)}`} color="text-amber-400" />
        <StatMini label="Available" value={`$${capital.available.toFixed(2)}`} color="text-emerald-400" />
      </div>

      {/* Exposure bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[8px] text-gray-600 mb-1">
          <span>Exposure</span>
          <span className="mono">{exposurePct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${
            exposurePct > 80 ? "bg-red-500/80" : exposurePct > 50 ? "bg-amber-500/60" : "bg-emerald-500/60"
          }`} style={{ width: `${Math.min(100, exposurePct)}%` }} />
        </div>
      </div>

      {/* Streaks */}
      <div className="flex items-center justify-between text-[10px] border-t border-white/[0.04] pt-2">
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Wins</span>
          <span className={`mono font-bold ${capital.winStreak > 0 ? "text-emerald-400" : "text-gray-600"}`}>{capital.winStreak}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">Losses</span>
          <span className={`mono font-bold ${capital.totalLosses > 3 ? "text-red-400" : "text-gray-600"}`}>{capital.totalLosses}</span>
        </div>
      </div>
    </div>
  );
}

function StatMini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-[7px] text-gray-600 uppercase">{label}</p>
      <p className={`mono text-[11px] font-bold ${color || "text-gray-200"}`}>{value}</p>
    </div>
  );
}
