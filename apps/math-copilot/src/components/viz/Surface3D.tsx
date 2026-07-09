"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { sampleSurface } from "./mathEval";
import type { VizHint } from "@/lib/api";
import type { PlotParams } from "react-plotly.js";

const Plot = dynamic<PlotParams>(
  () => import("react-plotly.js").then(mod => mod.default),
  { ssr: false }
);

interface Props {
  hint: VizHint;
}

export function Surface3D({ hint }: Props) {
  const expr   = hint.expression ?? hint.expressions?.[0] ?? "sin(sqrt(x*x+y*y))";
  const xMin = hint.x_range?.[0] ?? -5;
  const xMax = hint.x_range?.[1] ??  5;
  const yMin = hint.y_range?.[0] ?? -5;
  const yMax = hint.y_range?.[1] ??  5;

  const surface = useMemo(
    () => sampleSurface(expr, [xMin, xMax], [yMin, yMax], 60),
    [expr, xMin, xMax, yMin, yMax]
  );

  const traces: PlotParams["data"] = useMemo(() => [{
    x: surface.x,
    y: surface.y,
    z: surface.z,
    type: "surface" as const,
    colorscale: "Viridis",
    showscale: false,
    opacity: 0.9,
    hovertemplate: "x=%{x:.2f}<br>y=%{y:.2f}<br>z=%{z:.3f}<extra></extra>",
  }], [surface]);

  const layout = useMemo(() => ({
    paper_bgcolor: "rgba(0,0,0,0)",
    font: { color: "#94a3b8", family: "Arial", size: 10 },
    title: hint.title
      ? { text: hint.title, font: { color: "#f1f5f9", size: 13 }, pad: { t: 4 } }
      : undefined,
    scene: {
      bgcolor: "rgba(0,0,0,0)",
      xaxis: { gridcolor: "rgba(255,255,255,0.08)", zerolinecolor: "rgba(255,255,255,0.1)",
               tickfont: { color: "#475569", size: 9 }, title: { text: "x", font: { color: "#64748b" } } },
      yaxis: { gridcolor: "rgba(255,255,255,0.08)", zerolinecolor: "rgba(255,255,255,0.1)",
               tickfont: { color: "#475569", size: 9 }, title: { text: "y", font: { color: "#64748b" } } },
      zaxis: { gridcolor: "rgba(255,255,255,0.08)", zerolinecolor: "rgba(255,255,255,0.1)",
               tickfont: { color: "#475569", size: 9 }, title: { text: "z", font: { color: "#64748b" } } },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
    },
    margin: { t: hint.title ? 40 : 20, r: 10, b: 10, l: 10 },
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
        style={{ width: "100%", height: "380px" }}
      />
    </div>
  );
}
