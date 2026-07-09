"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { VizHint } from "@/lib/api";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then(mod => mod.default),
  { ssr: false }
);

interface Props {
  hint: VizHint;
}

function normalDist(mean: number, std: number, points = 300) {
  const xs: number[] = [];
  const ys: number[] = [];
  const lo = mean - 4 * std;
  const hi = mean + 4 * std;
  const step = (hi - lo) / (points - 1);
  for (let i = 0; i < points; i++) {
    const x = lo + i * step;
    const y =
      (1 / (std * Math.sqrt(2 * Math.PI))) *
      Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
    xs.push(x);
    ys.push(y);
  }
  return { xs, ys };
}

export function StatsChart({ hint }: Props) {
  const chartType = hint.chart_type ?? "bar";
  const data = hint.data ?? [];
  const categories = hint.categories ?? data.map((_, i) => String(i + 1));

  const traces: PlotParams["data"] = useMemo(() => {
    if (chartType === "normal_dist") {
      // data[0] = mean, data[1] = std
      const mean = data[0] ?? 0;
      const std  = data[1] ?? 1;
      const { xs, ys } = normalDist(mean, std);
      return [{
        x: xs, y: ys,
        type: "scatter" as const,
        mode: "lines" as const,
        fill: "tozeroy" as const,
        line: { color: "#22d3ee", width: 2 },
        fillcolor: "rgba(34,211,238,0.12)",
        name: `N(${mean}, ${std}²)`,
        hovertemplate: "x=%{x:.3f}<br>p=%{y:.4f}<extra></extra>",
      }];
    }

    if (chartType === "scatter") {
      // data is flat [x0,y0, x1,y1, ...]
      const xs = data.filter((_, i) => i % 2 === 0);
      const ys = data.filter((_, i) => i % 2 === 1);
      return [{
        x: xs, y: ys,
        type: "scatter" as const,
        mode: "markers" as const,
        marker: { color: "#a78bfa", size: 8, opacity: 0.8 },
        name: hint.title ?? "Data",
        hovertemplate: "(%{x:.2f}, %{y:.2f})<extra></extra>",
      }];
    }

    if (chartType === "histogram") {
      return [{
        x: data,
        type: "histogram" as const,
        marker: { color: "rgba(34,211,238,0.7)", line: { color: "#22d3ee", width: 1 } },
        name: hint.title ?? "Histogram",
      }];
    }

    // default: bar
    return [{
      x: categories,
      y: data,
      type: "bar" as const,
      marker: {
        color: data.map((_, i) =>
          `hsl(${(i * 37 + 190) % 360},70%,55%)`
        ),
        opacity: 0.85,
      },
      name: hint.title ?? "Values",
      hovertemplate: "%{x}: <b>%{y}</b><extra></extra>",
    }];
  }, [chartType, data, categories, hint.title]);

  const layout = useMemo(() => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,255,255,0.03)",
    font: { color: "#94a3b8", family: "Arial", size: 11 },
    title: hint.title
      ? { text: hint.title, font: { color: "#f1f5f9", size: 13 }, pad: { t: 4 } }
      : undefined,
    xaxis: {
      gridcolor: "rgba(255,255,255,0.06)",
      zerolinecolor: "rgba(255,255,255,0.12)",
      tickfont: { color: "#64748b", size: 10 },
    },
    yaxis: {
      gridcolor: "rgba(255,255,255,0.06)",
      zerolinecolor: "rgba(255,255,255,0.12)",
      tickfont: { color: "#64748b", size: 10 },
    },
    bargap: 0.25,
    margin: { t: hint.title ? 40 : 20, r: 20, b: 50, l: 55 },
    autosize: true,
  }), [hint.title]);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "300px" }}
        useResizeHandler
      />
    </div>
  );
}
