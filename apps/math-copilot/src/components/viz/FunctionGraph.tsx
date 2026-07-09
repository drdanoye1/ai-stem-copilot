"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { sampleFunction } from "./mathEval";
import type { VizHint } from "@/lib/api";
import type { PlotParams } from "react-plotly.js";

// Dynamic import — avoids SSR crash, Plotly is client-only
const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then(mod => mod.default),
  { ssr: false }
);

const COLORS = [
  "#22d3ee", "#a78bfa", "#34d399", "#fbbf24",
  "#fb7185", "#818cf8", "#2dd4bf", "#fb923c",
];

interface Props {
  hint: VizHint;
}

export function FunctionGraph({ hint }: Props) {
  const [hovered, setHovered] = useState(false);

  const expressions = hint.expressions ?? ["x"];
  const xMin = hint.x_range?.[0] ?? -10;
  const xMax = hint.x_range?.[1] ??  10;
  const labels = hint.labels ?? expressions;

  const traces: PlotParams["data"] = useMemo(() => {
    return expressions.map((expr, i) => {
      const { x, y } = sampleFunction(expr, xMin, xMax, 500);
      return {
        x,
        y,
        type: "scatter" as const,
        mode: "lines" as const,
        name: labels[i] ?? expr,
        line: { color: COLORS[i % COLORS.length], width: 2.5 },
        hovertemplate: `<b>${labels[i] ?? expr}</b><br>x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>`,
      };
    });
  }, [expressions, xMin, xMax, labels]);

  const layout = useMemo(() => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(255,255,255,0.03)",
    font: { color: "#94a3b8", family: "Arial", size: 11 },
    title: hint.title
      ? { text: hint.title, font: { color: "#f1f5f9", size: 13 }, pad: { t: 4 } }
      : undefined,
    xaxis: {
      gridcolor: "rgba(255,255,255,0.06)",
      zerolinecolor: "rgba(255,255,255,0.15)",
      tickfont: { color: "#64748b", size: 10 },
      title: { text: "x", font: { color: "#64748b", size: 11 } },
    },
    yaxis: {
      gridcolor: "rgba(255,255,255,0.06)",
      zerolinecolor: "rgba(255,255,255,0.15)",
      tickfont: { color: "#64748b", size: 10 },
      autorange: true,
    },
    legend: {
      font: { color: "#94a3b8", size: 10 },
      bgcolor: "rgba(0,0,0,0)",
      bordercolor: "rgba(255,255,255,0.08)",
      borderwidth: 1,
    },
    margin: { t: hint.title ? 40 : 20, r: 20, b: 40, l: 50 },
    hovermode: "x unified" as const,
    autosize: true,
  }), [hint.title]);

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: hovered ? "1px solid rgba(34,211,238,0.25)" : "1px solid rgba(255,255,255,0.07)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: true, displaylogo: false, responsive: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"]        }}
        style={{ width: "100%", height: "320px" }}
        useResizeHandler
      />
    </div>
  );
}
