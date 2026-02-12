"use client";

import type { ArbWindowState, ArbStats, ArbLadderOrder } from "@/types";

interface ArbitragePanelProps {
  arbState: ArbWindowState | null;
  arbStats: ArbStats;
}

export default function ArbitragePanel({ arbState, arbStats }: ArbitragePanelProps) {
  const fillRate = arbStats.windowsPlayed > 0
    ? ((arbStats.bothSidesFilled / arbStats.windowsPlayed) * 100).toFixed(0)
    : "0";

  return (
    <div className="card p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          Arbitrage
        </h2>
        {arbState && <StatusBadge status={arbState.status} />}
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <StatChip label="Windows" value={String(arbStats.windowsPlayed)} />
        <StatChip label="Both Filled" value={String(arbStats.bothSidesFilled)} accent="emerald" sub={`${fillRate}%`} />
        <StatChip label="One Side" value={String(arbStats.oneSideFilled)} />
        <StatChip label="No Fill" value={String(arbStats.neitherFilled)} />
        <StatChip
          label="Total P&L"
          value={`${arbStats.totalPnl >= 0 ? "+" : ""}$${arbStats.totalPnl.toFixed(2)}`}
          accent={arbStats.totalPnl >= 0 ? "emerald" : "red"}
        />
        <StatChip label="Avg/Window" value={`$${arbStats.avgProfitPerWindow.toFixed(2)}`} />
      </div>

      {/* Active window or empty state */}
      {arbState ? (
        <ActiveWindow state={arbState} />
      ) : (
        <div className="flex items-center justify-center py-8 rounded-xl bg-white/[0.015] border border-dashed border-white/[0.06]">
          <div className="text-center">
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-white/[0.03] flex items-center justify-center">
              <span className="text-gray-600 text-[14px]">?</span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">No active window</p>
            <p className="text-[10px] text-gray-700 mt-0.5">Waiting for next 15m window&hellip;</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ?? Stat Chip ??????????????????????????????????????????????????????????????? */

function StatChip({ label, value, accent, sub }: {
  label: string;
  value: string;
  accent?: "emerald" | "red";
  sub?: string;
}) {
  const valueColor =
    accent === "emerald" ? "text-emerald-400"
    : accent === "red" ? "text-red-400"
    : "text-gray-200";

  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
      <p className="text-[9px] text-gray-600 uppercase tracking-wider leading-none mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`mono text-[13px] font-bold ${valueColor}`}>{value}</span>
        {sub && <span className="text-[9px] text-gray-600 mono">{sub}</span>}
      </div>
    </div>
  );
}

/* ?? Status Badge ???????????????????????????????????????????????????????????? */

function StatusBadge({ status }: { status: ArbWindowState["status"] }) {
  const config: Record<ArbWindowState["status"], { bg: string; text: string; label: string; pulse?: boolean }> = {
    placing: { bg: "bg-blue-500/10", text: "text-blue-400", label: "PLACING", pulse: true },
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "ACTIVE", pulse: true },
    cancelling: { bg: "bg-amber-500/10", text: "text-amber-400", label: "CANCELLING" },
    resolved: { bg: "bg-gray-500/10", text: "text-gray-400", label: "RESOLVED" },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide ${c.bg} ${c.text}`}>
      {c.pulse && <span className="w-1 h-1 rounded-full bg-current animate-pulse" />}
      {c.label}
    </span>
  );
}

/* ?? Active Window ??????????????????????????????????????????????????????????? */

function ActiveWindow({ state }: { state: ArbWindowState }) {
  const minutes = Math.floor(state.secondsRemaining / 60);
  const seconds = state.secondsRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;
  const windowDuration = 900;
  const elapsed = windowDuration - state.secondsRemaining;
  const progressPct = Math.min(100, (elapsed / windowDuration) * 100);

  const combinedOk = state.combinedCost > 0 && state.combinedCost < 0.97;
  const combinedWarn = state.combinedCost >= 0.97 && state.combinedCost < 1.0;

  const totalInvested = state.upSide.totalCost + state.downSide.totalCost;

  return (
    <div className="space-y-3">
      {/* Window header with timer bar */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-gray-400 mono truncate">{state.slug}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {totalInvested > 0 && (
              <span className="text-[10px] text-gray-500 mono">
                ${totalInvested.toFixed(2)} invested
              </span>
            )}
            <span className="text-[14px] mono text-gray-200 font-bold tabular-nums">{timeStr}</span>
          </div>
        </div>
        {/* Timer progress bar */}
        <div className="w-full h-1 rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              progressPct > 85 ? "bg-red-500/70" : progressPct > 60 ? "bg-amber-500/50" : "bg-blue-500/50"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Side-by-side UP / DOWN cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SideCard label="UP" side={state.upSide} color="emerald" />
        <SideCard label="DOWN" side={state.downSide} color="red" />
      </div>

      {/* Combined Cost summary */}
      <div className={`rounded-xl p-3 border ${
        combinedOk
          ? "bg-emerald-500/[0.05] border-emerald-500/20"
          : combinedWarn
          ? "bg-amber-500/[0.05] border-amber-500/20"
          : "bg-white/[0.02] border-white/[0.04]"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Combined Cost</p>
            {state.guaranteedPnl > 0 && (
              <p className="text-[11px] text-emerald-400/90 mono font-medium">
                +${state.guaranteedPnl.toFixed(2)} guaranteed
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`mono text-[18px] font-bold ${
              combinedOk ? "text-emerald-400" : combinedWarn ? "text-amber-400" : "text-gray-500"
            }`}>
              {state.combinedCost > 0 ? `$${state.combinedCost.toFixed(3)}` : "--"}
            </span>
            {combinedOk && (
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                PROFIT
              </span>
            )}
            {combinedWarn && (
              <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
                THIN
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ?? Side Card (UP / DOWN) ??????????????????????????????????????????????????? */

function SideCard({ label, side, color }: {
  label: string;
  side: { totalShares: number; totalCost: number; avgPrice: number; orders: ArbLadderOrder[] };
  color: "emerald" | "red";
}) {
  const borderColor = color === "emerald" ? "border-emerald-500/15" : "border-red-500/15";
  const accentColor = color === "emerald" ? "text-emerald-400" : "text-red-400";
  const bgAccent = color === "emerald" ? "bg-emerald-500/[0.03]" : "bg-red-500/[0.03]";
  const barColor = color === "emerald" ? "bg-emerald-500/60" : "bg-red-500/60";
  const filledOrders = side.orders.filter(o => o.status === "filled").length;
  const totalOrders = side.orders.length;

  return (
    <div className={`rounded-xl ${bgAccent} border ${borderColor} p-3`}>
      {/* Side header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${accentColor} uppercase tracking-wide`}>{label}</span>
          <span className="text-[9px] text-gray-600 mono">{filledOrders}/{totalOrders} filled</span>
        </div>
        {side.totalCost > 0 && (
          <span className="text-[10px] text-gray-400 mono font-medium">${side.totalCost.toFixed(2)}</span>
        )}
      </div>

      {/* Order ladder */}
      <div className="space-y-1.5">
        {side.orders.map((order, i) => (
          <OrderRow key={i} order={order} barColor={barColor} />
        ))}
      </div>

      {/* Fill summary */}
      {side.totalShares > 0 && (
        <div className="border-t border-white/[0.04] mt-2.5 pt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">Avg fill</span>
          <span className="text-[10px] text-gray-300 mono font-medium">
            ${side.avgPrice.toFixed(3)} &times; {side.totalShares.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ?? Order Row ??????????????????????????????????????????????????????????????? */

function OrderRow({ order, barColor }: { order: ArbLadderOrder; barColor: string }) {
  const fillPct = order.targetSize > 0 ? (order.filledSize / order.targetSize) * 100 : 0;

  const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    filled: { label: "FILLED", bg: "bg-emerald-500/15", text: "text-emerald-400" },
    partial: { label: "PARTIAL", bg: "bg-amber-500/15", text: "text-amber-400" },
    cancelled: { label: "CANCEL", bg: "bg-red-500/10", text: "text-red-400/60" },
    placed: { label: "LIVE", bg: "bg-blue-500/10", text: "text-blue-400" },
    pending: { label: "QUEUE", bg: "bg-white/[0.04]", text: "text-gray-600" },
  };
  const cfg = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="group relative">
      <div className="flex items-center gap-2 text-[11px]">
        {/* Price */}
        <span className="text-gray-300 mono font-medium w-[50px]">
          ${order.price.toFixed(2)}
        </span>

        {/* Fill progress bar */}
        <div className="flex-1 h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {/* Size */}
        <span className="text-gray-400 mono text-[10px] w-[60px] text-right">
          {order.filledSize.toFixed(1)}/{order.targetSize.toFixed(1)}
        </span>

        {/* Status badge */}
        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} w-[46px] text-center`}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}
