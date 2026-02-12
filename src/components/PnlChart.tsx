"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import type { PnlDataPoint, DailyPnlPoint } from "@/types";

interface PnlChartProps {
  data: PnlDataPoint[];
  dailyData?: DailyPnlPoint[];
}

type TimeRange = "24h" | "7d" | "30d" | "all";

export default function PnlChart({ data, dailyData = [] }: PnlChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  const filteredData = useMemo(() => {
    if (timeRange === "all" || data.length === 0) return data;
    const now = Date.now();
    const cutoff = {
      "24h": now - 86400000,
      "7d": now - 7 * 86400000,
      "30d": now - 30 * 86400000,
    }[timeRange];
    return data.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
  }, [data, timeRange]);

  const latestPnl = filteredData.length > 0 ? filteredData[filteredData.length - 1].cumulativePnl : 0;
  const lineColor = latestPnl >= 0 ? "#22c55e" : "#ef4444";

  const formatted = filteredData.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  // Stats
  const totalPnl = data.length > 0 ? data[data.length - 1].cumulativePnl : 0;
  const totalTrades = data.length;
  const wins = data.filter((d) => d.pnl > 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgProfit = totalTrades > 0 ? totalPnl / totalTrades : 0;

  const bestDay = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.pnl)) : 0;
  const worstDay = dailyData.length > 0 ? Math.min(...dailyData.map((d) => d.pnl)) : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
          P&amp;L
        </h2>
        <div className="flex gap-1">
          {(["24h", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                timeRange === range
                  ? "bg-accent-blue/15 text-accent-blue"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
        <StatBox label="Total P&L" value={`$${totalPnl.toFixed(4)}`} color={totalPnl >= 0 ? "text-accent-green" : "text-accent-red"} />
        <StatBox label="Win Rate" value={`${winRate.toFixed(0)}%`} color={winRate >= 50 ? "text-accent-green" : "text-accent-red"} />
        <StatBox label="Trades" value={String(totalTrades)} />
        <StatBox label="Avg/Trade" value={`$${avgProfit.toFixed(4)}`} color={avgProfit >= 0 ? "text-accent-green" : "text-accent-red"} />
        <StatBox label="Best Day" value={`$${bestDay.toFixed(4)}`} color="text-accent-green" />
        <StatBox label="Worst Day" value={`$${worstDay.toFixed(4)}`} color="text-accent-red" />
      </div>

      {/* Cumulative P&L line */}
      {formatted.length < 2 ? (
        <div className="flex items-center justify-center h-[200px] text-gray-600 text-[13px]">
          Waiting for trade data...
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f232e" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#4b5060", fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: "#1f232e" }}
            />
            <YAxis
              tick={{ fill: "#4b5060", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111318",
                border: "1px solid #1f232e",
                borderRadius: "8px",
                color: "#e2e5eb",
                fontSize: 12,
                padding: "8px 12px",
              }}
              formatter={(value: number) => [`$${value.toFixed(4)}`, "P&L"]}
              labelStyle={{ color: "#6b7280", fontSize: 11 }}
            />
            <ReferenceLine y={0} stroke="#1f232e" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="cumulativePnl"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: lineColor, stroke: "#111318", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Daily P&L bars */}
      {dailyData.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide mb-2">Daily P&amp;L</p>
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={dailyData} margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f232e" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#4b5060", fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: "#1f232e" }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: "#4b5060", fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111318",
                  border: "1px solid #1f232e",
                  borderRadius: "8px",
                  color: "#e2e5eb",
                  fontSize: 11,
                  padding: "6px 10px",
                }}
                formatter={(value: number) => [`$${value.toFixed(4)}`, "P&L"]}
              />
              <ReferenceLine y={0} stroke="#1f232e" />
              <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                {dailyData.map((entry, index) => (
                  <Cell key={index} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-surface-hover rounded px-2 py-1.5">
      <p className="text-[9px] text-gray-600 mb-0.5">{label}</p>
      <p className={`mono text-[12px] font-bold ${color || "text-gray-300"}`}>{value}</p>
    </div>
  );
}
