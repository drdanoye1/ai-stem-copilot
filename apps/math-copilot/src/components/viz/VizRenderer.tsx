"use client";
import dynamic from "next/dynamic";
import type { VizHint } from "@/lib/api";

// Dynamic imports keep Plotly & GeoGebra out of the initial bundle
const FunctionGraph = dynamic(
  () => import("./FunctionGraph").then(m => m.FunctionGraph),
  { ssr: false, loading: () => <VizSkeleton /> }
);
const StatsChart = dynamic(
  () => import("./StatsChart").then(m => m.StatsChart),
  { ssr: false, loading: () => <VizSkeleton /> }
);
const Surface3D = dynamic(
  () => import("./Surface3D").then(m => m.Surface3D),
  { ssr: false, loading: () => <VizSkeleton /> }
);
const GeoGebraEmbed = dynamic(
  () => import("./GeoGebraEmbed").then(m => m.GeoGebraEmbed),
  { ssr: false, loading: () => <VizSkeleton /> }
);

function VizSkeleton() {
  return (
    <div
      className="rounded-xl animate-pulse"
      style={{ height: 320, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    />
  );
}

interface Props {
  hint: VizHint | null | undefined;
  className?: string;
}

export function VizRenderer({ hint, className }: Props) {
  if (!hint || hint.type === "none") return null;

  // Guards: skip if required data is missing
  if (hint.type === "statistics_chart" && (!hint.data || hint.data.length === 0)) return null;
  if ((hint.type === "function_graph" || hint.type === "parametric" || hint.type === "number_line")
    && (!hint.expressions || hint.expressions.length === 0)) return null;
  if (hint.type === "surface_3d" && !hint.expression) return null;

  const cls = className ?? "mt-5";

  if (hint.type === "function_graph" || hint.type === "parametric" || hint.type === "number_line") {
    return <div className={cls}><FunctionGraph hint={hint} /></div>;
  }
  if (hint.type === "statistics_chart") {
    return <div className={cls}><StatsChart hint={hint} /></div>;
  }
  if (hint.type === "surface_3d") {
    return <div className={cls}><Surface3D hint={hint} /></div>;
  }
  if (hint.type === "geometry") {
    return <div className={cls}><GeoGebraEmbed hint={hint} /></div>;
  }
  return null;
}

export function VizTypeBadge({ type }: { type: string }) {
  const MAP: Record<string, { label: string; color: string }> = {
    function_graph:   { label: "Function Graph", color: "rgba(34,211,238,0.15)"  },
    parametric:       { label: "Parametric",      color: "rgba(34,211,238,0.15)"  },
    number_line:      { label: "Number Line",     color: "rgba(34,211,238,0.15)"  },
    statistics_chart: { label: "Stats Chart",     color: "rgba(167,139,250,0.15)" },
    surface_3d:       { label: "3D Surface",      color: "rgba(52,211,153,0.15)"  },
    geometry:         { label: "Geometry",        color: "rgba(251,191,36,0.15)"  },
  };
  const info = MAP[type];
  if (!info) return null;
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 99,
      background: info.color, color: "#94a3b8", letterSpacing: "0.05em",
    }}>
      {info.label}
    </span>
  );
}
