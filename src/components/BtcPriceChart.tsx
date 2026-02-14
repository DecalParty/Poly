"use client";

import { useRef, useEffect, useCallback } from "react";
import { createChart, type IChartApi, type ISeriesApi, ColorType, LineStyle, AreaSeries, LineSeries } from "lightweight-charts";

interface BtcPriceChartProps {
  currentPrice: number;
  openPrice: number;
  height?: number;
}

export default function BtcPriceChart({ currentPrice, openPrice, height = 120 }: BtcPriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const openLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const dataRef = useRef<{ time: number; value: number }[]>([]);
  const lastPriceRef = useRef(0);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#4b5060",
        fontSize: 10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255,255,255,0.03)", style: LineStyle.Dotted },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 5,
        barSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: "rgba(255,255,255,0.08)", width: 1, style: LineStyle.Dashed, labelVisible: false },
        horzLine: { color: "rgba(255,255,255,0.08)", width: 1, style: LineStyle.Dashed },
      },
      handleScroll: false,
      handleScale: false,
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: "#3b82f6",
      topColor: "rgba(59,130,246,0.15)",
      bottomColor: "rgba(59,130,246,0.01)",
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    const openLine = chart.addSeries(LineSeries, {
      color: "rgba(255,255,255,0.12)",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = areaSeries;
    openLineRef.current = openLine;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    const ro = new ResizeObserver(handleResize);
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      openLineRef.current = null;
    };
  }, [height]);

  // Update data on price changes
  const updatePrice = useCallback((price: number, open: number) => {
    if (!seriesRef.current || price <= 0) return;

    const now = Math.floor(Date.now() / 1000);

    // Determine line color based on current vs open
    const isUp = price >= open;
    const lineColor = isUp ? "#22c55e" : "#ef4444";
    const topColor = isUp ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";
    const bottomColor = isUp ? "rgba(34,197,94,0.01)" : "rgba(239,68,68,0.01)";

    seriesRef.current.applyOptions({ lineColor, topColor, bottomColor });

    // Add data point
    const point = { time: now as any, value: price };
    dataRef.current.push(point);

    // Keep last 600 points (~10 minutes at 1/sec)
    if (dataRef.current.length > 600) {
      dataRef.current = dataRef.current.slice(-600);
    }

    try {
      seriesRef.current.update(point as any);
    } catch {
      // On time ordering error, reset
      seriesRef.current.setData(dataRef.current as any);
    }

    // Update open price reference line
    if (openLineRef.current && open > 0 && dataRef.current.length >= 2) {
      const first = dataRef.current[0];
      const last = dataRef.current[dataRef.current.length - 1];
      openLineRef.current.setData([
        { time: first.time as any, value: open },
        { time: last.time as any, value: open },
      ] as any);
    }

    lastPriceRef.current = price;
  }, []);

  useEffect(() => {
    updatePrice(currentPrice, openPrice);
  }, [currentPrice, openPrice, updatePrice]);

  return (
    <div ref={containerRef} className="w-full" style={{ height }} />
  );
}
