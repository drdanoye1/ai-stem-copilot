"use client";
import { useEffect, useState } from "react";
import { mathApi } from "@/lib/api";
import { Users, Search, Calendar, BookOpen, TrendingUp, Clock, Star } from "lucide-react";

const ACCENT = "#10b981";

const LEVEL_LABELS: Record<string, string> = {
  pre_k:        "Pre-K / Kindergarten",
  middle_school: "Middle School",
  high_school:   "High School",
  ap_ib:         "AP / IB",
  university:    "University",
  graduate:      "Graduate",
  professional:  "Professional",
};

const SUBJECT_COLORS: Record<string, string> = {
  arithmetic:   "#22d3ee",
  algebra:      "#818cf8",
  geometry:     "#a78bfa",
  trigonometry: "#34d399",
  calculus:     "#f59e0b",
  statistics:   "#f97316",
  default:      "#64748b",
};

type Summary = Awaited<ReturnType<typeof mathApi.parentSummary>>["data"];

export default function ParentDashboardPage() {
  const [email, setEmail]         = useState("");
  const [query, setQuery]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [error, setError]         = useState("");

  const load = async (targetEmail?: string) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await mathApi.parentSummary(targetEmail);
      setSummary(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not load learner data.");
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load(query.trim() || undefined);
  };

  const maxDaily = summary ? Math.max(...summary.daily_activity.map(d => d.sessions), 1) : 1;

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: ACCENT }}>
          Parent & Teacher Portal
        </p>
        <div className="flex items-center gap-3 mb-1">
          <Users className="w-6 h-6" style={{ color: ACCENT }} />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
            Learner Overview
          </h1>
        </div>
        <p className="text-sm" style={{ color: "#475569" }}>
          Monitor your child's or student's mathematics activity, progress, and engagement.
        </p>
      </div>

      {/* Learner lookup (for teachers / admins) */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#475569" }} />
          <input
            type="email"
            placeholder="Enter learner's email to view their progress…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#f1f5f9",
            }}
          />
        </div>
        <button type="submit" disabled={loading}
          className="px-5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
          style={{ background: `${ACCENT}20`, border: `1px solid ${ACCENT}40`, color: ACCENT }}>
          {loading ? "Loading…" : "View"}
        </button>
        {query && (
          <button type="button" onClick={() => { setQuery(""); load(); }}
            className="px-4 py-3 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
            My data
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.20)", color: "#f87171" }}>
          {error}
        </div>
      )}

      {loading && !summary && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl h-24 animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      )}

      {summary && (
        <>
          {/* Learner identity */}
          <div className="rounded-2xl p-5 mb-6"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${ACCENT}25` }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 text-white"
                style={{ background: "linear-gradient(135deg,#06b6d4,#818cf8)" }}>
                {(summary.learner_name[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-bold text-base" style={{ color: "#f1f5f9" }}>{summary.learner_name}</p>
                <p className="text-xs" style={{ color: "#475569" }}>{summary.learner_email}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30`, color: ACCENT }}>
                    {LEVEL_LABELS[summary.learner_level] ?? summary.learner_level}
                  </span>
                  {summary.member_since && (
                    <span className="text-[10px]" style={{ color: "#334155" }}>
                      Member since {new Date(summary.member_since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { icon: BookOpen,   label: "Total Sessions",    value: summary.total_sessions.toString(),      color: "#22d3ee" },
              { icon: TrendingUp, label: "This Week",         value: summary.sessions_this_week.toString(),  color: ACCENT },
              { icon: Star,       label: "Subjects Explored", value: summary.subject_breakdown.length.toString(), color: "#fbbf24" },
              { icon: Clock,      label: "Avg / Week",        value: `~${Math.round(summary.total_sessions / Math.max(1, Math.ceil((Date.now() - new Date(summary.member_since || Date.now()).getTime()) / 6.048e8)))}`, color: "#a78bfa" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="rounded-2xl p-5 text-center"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                  style={{ background: `${color}15` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div className="text-2xl font-bold mb-0.5" style={{ color }}>{value}</div>
                <div className="text-[10px]" style={{ color: "#334155" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Daily activity chart */}
          <div className="rounded-2xl p-5 mb-6"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4" style={{ color: ACCENT }} />
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
                Activity — last 14 days
              </p>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {summary.daily_activity.map((d, i) => {
                const pct = d.sessions === 0 ? 4 : Math.max(8, (d.sessions / maxDaily) * 100);
                const today = i === summary.daily_activity.length - 1;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${d.sessions} session${d.sessions !== 1 ? "s" : ""}`}>
                    <div className="w-full rounded-t-sm transition-all"
                      style={{
                        height: `${pct}%`,
                        background: d.sessions > 0
                          ? (today ? ACCENT : `${ACCENT}55`)
                          : "rgba(255,255,255,0.06)",
                        minHeight: "4px",
                      }} />
                    {i % 3 === 0 && (
                      <span className="text-[8px] leading-none" style={{ color: "#1e293b" }}>
                        {d.date.split(" ")[1]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject breakdown */}
          {summary.subject_breakdown.length > 0 && (
            <div className="rounded-2xl p-5 mb-6"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>
                Subjects practiced
              </p>
              <div className="space-y-3">
                {summary.subject_breakdown.map(s => {
                  const maxCnt = summary.subject_breakdown[0].count;
                  const pct = Math.round((s.count / maxCnt) * 100);
                  const color = SUBJECT_COLORS[s.subject] ?? SUBJECT_COLORS.default;
                  return (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize" style={{ color: "#94a3b8" }}>{s.subject.replace(/_/g, " ")}</span>
                        <span style={{ color: "#475569" }}>{s.count} session{s.count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent sessions */}
          {summary.recent_sessions.length > 0 && (
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>
                Recent activity
              </p>
              <div className="space-y-2.5">
                {summary.recent_sessions.slice(0, 10).map(s => (
                  <div key={s.id} className="flex items-center gap-3 text-xs">
                    <span className="text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b" }}>
                      {s.session_type}
                    </span>
                    <span className="flex-1 truncate" style={{ color: "#94a3b8" }}>
                      {s.input_text?.slice(0, 60) || "—"}
                    </span>
                    <span className="flex-shrink-0" style={{ color: "#334155" }}>
                      {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
