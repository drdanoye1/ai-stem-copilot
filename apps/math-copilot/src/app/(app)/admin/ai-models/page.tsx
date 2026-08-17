"use client";
/**
 * Admin AI Models — read-only viewer for the Model Capability Registry™.
 *
 * Per the "Public AI Model Taxonomy, Capability Abstraction & Model Routing
 * Architecture" brief: learners only ever see a public AI Mode / Image Mode
 * label (Maths Copilot Smart™, Diagram™, ...); this page is where the real
 * provider/deployment identities behind those labels stay visible to
 * administrators and developers. Data comes straight from
 * GET /admin/models (backend/app/routers/admin.py), which just returns
 * backend/app/services/model_registry.py's registry verbatim — nothing here
 * is computed or guessed client-side.
 *
 * Role-gated client-side, same pattern Sidebar.tsx already uses
 * (`user?.role === "admin"`) — non-admins see a plain access-restricted
 * card rather than the table.
 */
import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";
import { adminApi, getErrorMessage, type ModelDeployment } from "@/lib/api";
import { Loader2, ShieldAlert, BrainCircuit, Image as ImageIcon, RefreshCw } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "#34d399",
  limited: "#fbbf24",
  testing: "#a78bfa",
  disabled: "#f87171",
};

const PRIORITY_COLORS: Record<string, string> = {
  primary: "#22d3ee",
  secondary: "#67e8f9",
  fallback: "#94a3b8",
  experimental: "#c4b5fd",
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: `${color}1a`, border: `1px solid ${color}4d`, color }}
    >
      {label}
    </span>
  );
}

function DeploymentTable({ rows }: { rows: ModelDeployment[] }) {
  if (rows.length === 0) {
    return <p className="text-sm px-4 py-6" style={{ color: "#64748b" }}>No deployments in this category.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            {["Public Mode", "Public Label", "Provider", "Model Family", "Deployment ID", "Capability", "Status", "Priority", "Cost", "Latency"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#64748b" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: "#f1f5f9" }}>
                {row.public_mode ?? <span style={{ color: "#475569" }}>— internal only —</span>}
              </td>
              <td className="px-3 py-2" style={{ color: "#e2e8f0" }}>{row.public_label ?? "—"}</td>
              <td className="px-3 py-2 capitalize" style={{ color: "#94a3b8" }}>{row.provider}</td>
              <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{row.model_family}</td>
              <td className="px-3 py-2 font-mono text-xs" style={{ color: "#94a3b8" }}>{row.deployment_id}</td>
              <td className="px-3 py-2" style={{ color: "#94a3b8" }}>{row.capability_class}</td>
              <td className="px-3 py-2"><Badge label={row.status} color={STATUS_COLORS[row.status] ?? "#94a3b8"} /></td>
              <td className="px-3 py-2"><Badge label={row.priority} color={PRIORITY_COLORS[row.priority] ?? "#94a3b8"} /></td>
              <td className="px-3 py-2 capitalize" style={{ color: "#94a3b8" }}>{row.cost_class}</td>
              <td className="px-3 py-2 capitalize" style={{ color: "#94a3b8" }}>{row.latency_class}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AiModelsAdminPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [deployments, setDeployments] = useState<ModelDeployment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await adminApi.getModels();
      setDeployments(data.deployments);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
        >
          <ShieldAlert className="w-8 h-8 mx-auto mb-3" style={{ color: "#f87171" }} />
          <h1 className="text-lg font-semibold mb-1" style={{ color: "#f1f5f9" }}>Access restricted</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            The Model Capability Registry™ is only visible to platform administrators.
          </p>
        </div>
      </div>
    );
  }

  const textModels = (deployments ?? []).filter(d => d.kind === "text");
  const imageModels = (deployments ?? []).filter(d => d.kind === "image");

  return (
    <div className="flex-1 p-6 md:p-8 max-w-6xl mx-auto w-full">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: "#f1f5f9" }}>AI Models</h1>
          <p className="text-sm" style={{ color: "#64748b" }}>
            The Model Capability Registry™ — every approved backend deployment, and the public AI Mode /
            Image Mode it resolves from. Learners never see this — only the public label.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl text-xs font-semibold px-3 py-2 shrink-0"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#94a3b8" }}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {error && (
        <div
          className="rounded-2xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.30)", color: "#fca5a5" }}
        >
          {error}
        </div>
      )}

      {loading && !deployments && (
        <div className="flex items-center gap-2 text-sm py-10 justify-center" style={{ color: "#64748b" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading registry…
        </div>
      )}

      {deployments && (
        <div className="space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="w-4 h-4" style={{ color: "#22d3ee" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94a3b8" }}>
                Text / LLM Deployments
              </h2>
            </div>
            <DeploymentTable rows={textModels} />
          </section>

          <section>
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-4 h-4" style={{ color: "#f472b6" }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#94a3b8" }}>
                Image Generation Deployments
              </h2>
            </div>
            <DeploymentTable rows={imageModels} />
          </section>
        </div>
      )}
    </div>
  );
}
