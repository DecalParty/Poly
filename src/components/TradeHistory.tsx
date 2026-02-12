"use client";

import { useState, useMemo } from "react";
import type { TradeRecord, MarketAsset, SubStrategy } from "@/types";

interface TradeHistoryProps {
  trades: TradeRecord[];
}

const PAGE_SIZE = 20;

const STRATEGY_LABELS: Record<string, string> = {
  highConfidence: "High Conf",
  arbitrage: "Arbitrage",
};

export default function TradeHistory({ trades }: TradeHistoryProps) {
  const [assetFilter, setAssetFilter] = useState<MarketAsset | "all">("all");
  const [stratFilter, setStratFilter] = useState<SubStrategy | "all">("all");
  const [resultFilter, setResultFilter] = useState<"all" | "win" | "loss">("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = trades;
    if (assetFilter !== "all") {
      result = result.filter((t) => t.asset === assetFilter);
    }
    if (stratFilter !== "all") {
      result = result.filter((t) => t.subStrategy === stratFilter);
    }
    if (resultFilter === "win") {
      result = result.filter((t) => t.pnl !== null && t.pnl > 0);
    } else if (resultFilter === "loss") {
      result = result.filter((t) => t.pnl !== null && t.pnl < 0);
    }
    return result;
  }, [trades, assetFilter, stratFilter, resultFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const runningPnl = filtered.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          Trade History
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            value={assetFilter}
            onChange={(v) => { setAssetFilter(v as any); setPage(0); }}
            options={[
              { value: "all", label: "All Assets" },
              { value: "BTC", label: "BTC" },
              { value: "ETH", label: "ETH" },
              { value: "SOL", label: "SOL" },
              { value: "XRP", label: "XRP" },
            ]}
          />
          <FilterSelect
            value={stratFilter}
            onChange={(v) => { setStratFilter(v as any); setPage(0); }}
            options={[
              { value: "all", label: "All Strategies" },
              { value: "highConfidence", label: "High Conf" },
              { value: "arbitrage", label: "Arbitrage" },
            ]}
          />
          <FilterSelect
            value={resultFilter}
            onChange={(v) => { setResultFilter(v as any); setPage(0); }}
            options={[
              { value: "all", label: "All" },
              { value: "win", label: "Wins" },
              { value: "loss", label: "Losses" },
            ]}
          />
          <span className="text-[11px] text-gray-600 mono">{filtered.length} trades</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-[13px]">
          No trades match filters
        </div>
      ) : (
        <>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-card z-10">
                <tr className="text-[10px] text-gray-600 uppercase tracking-wider">
                  <th className="text-left py-2 pr-2 font-semibold">Time</th>
                  <th className="text-left py-2 pr-2 font-semibold">Asset</th>
                  <th className="text-left py-2 pr-2 font-semibold">Strategy</th>
                  <th className="text-left py-2 pr-2 font-semibold">Action</th>
                  <th className="text-left py-2 pr-2 font-semibold">Side</th>
                  <th className="text-right py-2 pr-2 font-semibold">Price</th>
                  <th className="text-right py-2 pr-2 font-semibold">Amount</th>
                  <th className="text-right py-2 pr-2 font-semibold">Fee</th>
                  <th className="text-right py-2 font-semibold">P&L</th>
                </tr>
                <tr>
                  <th colSpan={9} className="border-b border-surface-border p-0" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((trade, i) => {
                  const time = new Date(trade.timestamp);
                  const timeStr = time.toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <tr
                      key={trade.id ?? `${page}-${i}`}
                      className={`border-b border-surface-border/40 hover:bg-surface-hover/50 transition-colors ${
                        trade.pnl !== null && trade.pnl !== 0
                          ? trade.pnl > 0 ? "bg-accent-green/[0.02]" : "bg-accent-red/[0.02]"
                          : ""
                      }`}
                    >
                      <td className="py-2 pr-2 mono text-gray-400">{timeStr}</td>
                      <td className="py-2 pr-2 text-gray-300 font-semibold">{trade.asset || "-"}</td>
                      <td className="py-2 pr-2 text-gray-400 text-[10px]">
                        {trade.subStrategy ? STRATEGY_LABELS[trade.subStrategy] || trade.subStrategy : "-"}
                      </td>
                      <td className="py-2 pr-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          trade.action === "buy"
                            ? "bg-accent-green/10 text-accent-green"
                            : trade.action === "sell"
                            ? "bg-accent-red/10 text-accent-red"
                            : trade.pnl !== null && trade.pnl >= 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}>
                          {trade.action === "resolution"
                            ? (trade.pnl !== null && trade.pnl >= 0 ? "WON" : "LOST")
                            : trade.action}
                        </span>
                      </td>
                      <td className="py-2 pr-2">
                        {trade.action === "resolution" ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500">bet {trade.side === "yes" ? "UP" : "DN"}</span>
                            <span className={`font-semibold text-[11px] ${
                              trade.price >= 0.5 ? "text-accent-green" : "text-accent-red"
                            }`}>
                              {trade.price >= 0.5 ? "UP" : "DN"} won
                            </span>
                          </div>
                        ) : (
                          <span className={`font-semibold uppercase ${trade.side === "yes" ? "text-accent-green" : "text-accent-red"}`}>
                            {trade.side === "yes" ? "UP" : "DN"}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2 text-right mono text-gray-300">
                        ${trade.price.toFixed(4)}
                      </td>
                      <td className="py-2 pr-2 text-right mono text-gray-400">
                        ${trade.amount.toFixed(4)}
                      </td>
                      <td className="py-2 pr-2 text-right mono text-gray-600">
                        {trade.takerFee !== null ? `$${trade.takerFee.toFixed(4)}` : "-"}
                      </td>
                      <td className="py-2 text-right mono">
                        {trade.pnl !== null ? (
                          <span className={trade.pnl >= 0 ? "text-accent-green" : "text-accent-red"}>
                            {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-gray-700">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer: pagination + running total */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-border">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded text-[11px] bg-surface-hover text-gray-400 disabled:opacity-30"
              >
                ? Prev
              </button>
              <span className="text-[11px] text-gray-500 mono">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded text-[11px] bg-surface-hover text-gray-400 disabled:opacity-30"
              >
                Next ?
              </button>
            </div>
            <div className="text-[11px]">
              <span className="text-gray-500">Running P&L: </span>
              <span className={`mono font-bold ${runningPnl >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                {runningPnl >= 0 ? "+" : ""}${runningPnl.toFixed(4)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[10px] px-2 py-1 rounded bg-surface-input border border-surface-border text-gray-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
