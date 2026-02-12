"use client";

import type { AlertItem } from "@/types";
import { useState, useEffect, useRef } from "react";

interface AlertsFeedProps {
  alerts: AlertItem[];
  logs?: string[];
}

const SEVERITY_STYLES: Record<string, { icon: string; color: string }> = {
  info: { icon: "?", color: "text-accent-blue" },
  success: { icon: "?", color: "text-accent-green" },
  warning: { icon: "?", color: "text-accent-yellow" },
  error: { icon: "?", color: "text-accent-red" },
};

export default function AlertsFeed({ alerts, logs = [] }: AlertsFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"alerts" | "log">("alerts");

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [alerts.length, logs.length]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("alerts")}
            className={`text-[11px] font-semibold uppercase tracking-widest px-1 pb-0.5 border-b-2 transition-colors ${
              tab === "alerts" ? "text-gray-300 border-accent-blue" : "text-gray-600 border-transparent hover:text-gray-400"
            }`}
          >
            Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setTab("log")}
            className={`text-[11px] font-semibold uppercase tracking-widest px-1 pb-0.5 border-b-2 transition-colors ${
              tab === "log" ? "text-gray-300 border-accent-blue" : "text-gray-600 border-transparent hover:text-gray-400"
            }`}
          >
            Bot Log ({logs.length})
          </button>
        </div>
      </div>

      <div ref={containerRef} className="space-y-1.5 max-h-[400px] overflow-auto">
        {tab === "alerts" ? (
          alerts.length === 0 ? (
            <p className="text-[12px] text-gray-600 text-center py-6">No alerts yet</p>
          ) : (
            alerts.map((alert) => {
              const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
              const time = new Date(alert.timestamp).toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });

              return (
                <div key={alert.id} className="flex gap-2 py-1.5 border-b border-surface-border/40">
                  <span className={`text-[11px] flex-shrink-0 ${style.color}`}>{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-300 leading-relaxed break-words">
                      {alert.asset && (
                        <span className="font-semibold text-gray-200 mr-1">[{alert.asset}]</span>
                      )}
                      {alert.message}
                    </p>
                    <p className="text-[9px] text-gray-600 mono mt-0.5">{time}</p>
                  </div>
                </div>
              );
            })
          )
        ) : (
          logs.length === 0 ? (
            <p className="text-[12px] text-gray-600 text-center py-6">No log entries yet. Start the bot to see strategy decisions.</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="py-1 border-b border-surface-border/20">
                <p className="text-[11px] text-gray-400 mono leading-relaxed break-words">{log}</p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
