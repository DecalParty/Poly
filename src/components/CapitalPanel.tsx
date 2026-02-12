"use client";

import type { CapitalState, CircuitBreakerState } from "@/types";

interface CapitalPanelProps {
  capital: CapitalState;
  circuitBreaker: CircuitBreakerState;
}

export default function CapitalPanel({ capital, circuitBreaker }: CapitalPanelProps) {
  const exposurePct = capital.maxExposure > 0 ? (capital.deployed / capital.maxExposure) * 100 : 0;

  return (
    <div className="card p-5">
      <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-4">Capital</h2>

      {/* Today's P&L */}
      <div className="text-center py-3 mb-4 rounded-xl bg-white/[0.015] border border-white/[0.04]">
        <p className="text-[10px] text-gray-600 mb-1">Today&apos;s P&amp;L</p>
        <p className={`mono text-[28px] font-bold tracking-tight ${capital.todayPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {capital.todayPnl >= 0 ? "+" : ""}${capital.todayPnl.toFixed(2)}
        </p>
      </div>

      {/* Capital stats */}
      <div className="space-y-2 mb-4">
        <Row label="Bankroll"><span className="mono text-[13px] text-gray-200">${capital.totalBankroll.toFixed(2)}</span></Row>
        <Row label="Deployed"><span className="mono text-[13px] text-amber-400">${capital.deployed.toFixed(2)}</span></Row>
        <Row label="Available"><span className="mono text-[13px] text-emerald-400">${capital.available.toFixed(2)}</span></Row>
      </div>

      {/* Exposure bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
          <span>Exposure</span>
          <span className="mono">{exposurePct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${
            exposurePct > 80 ? "bg-red-500/80" : exposurePct > 50 ? "bg-amber-500/60" : "bg-emerald-500/60"
          }`} style={{ width: `${Math.min(100, exposurePct)}%` }} />
        </div>
      </div>

      {/* Circuit breaker + Streaks */}
      <div className="border-t border-white/[0.04] pt-3 space-y-2">
        <Row label="Circuit Breaker">
          {circuitBreaker.triggered ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/10 text-red-400 animate-pulse">TRIGGERED</span>
          ) : (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400">ARMED</span>
          )}
        </Row>
        {circuitBreaker.triggered && circuitBreaker.resumeAt && (
          <p className="text-[10px] text-gray-600">Resumes: {new Date(circuitBreaker.resumeAt).toLocaleTimeString()}</p>
        )}
        <Row label="Win Streak">
          <span className={`mono text-[13px] font-bold ${capital.winStreak > 0 ? "text-emerald-400" : "text-gray-600"}`}>{capital.winStreak}</span>
        </Row>
        <Row label="Losses Today">
          <span className={`mono text-[13px] font-bold ${capital.totalLosses > 3 ? "text-red-400" : "text-gray-600"}`}>{capital.totalLosses}</span>
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-gray-500">{label}</span>
      {children}
    </div>
  );
}
