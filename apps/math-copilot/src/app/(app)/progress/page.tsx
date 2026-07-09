"use client";
import { useEffect, useState, useMemo, type ReactNode } from "react";
import { mathApi, type ProgressData, type MathSession } from "@/lib/api";
import {
  Zap, BookOpen, Clock, Calculator, PenLine, GraduationCap,
  Flame, Bookmark, BookmarkCheck, LayoutGrid, History, ChevronDown, ChevronUp, Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { MathOutput } from "@/components/MathOutput";

// ── Subject colors ────────────────────────────────────────────────────────────

const SUBJECT_COLORS: Record<string, { bar: string; text: string; glow: string }> = {
  algebra:               { bar: "#22d3ee", text: "#22d3ee", glow: "rgba(34,211,238,0.20)"  },
  calculus:              { bar: "#34d399", text: "#34d399", glow: "rgba(52,211,153,0.20)"  },
  geometry:              { bar: "#a78bfa", text: "#a78bfa", glow: "rgba(167,139,250,0.20)" },
  trigonometry:          { bar: "#818cf8", text: "#818cf8", glow: "rgba(129,140,248,0.20)" },
  statistics:            { bar: "#fbbf24", text: "#fbbf24", glow: "rgba(251,191,36,0.20)"  },
  linear_algebra:        { bar: "#fb7185", text: "#fb7185", glow: "rgba(251,113,133,0.20)" },
  differential_equations:{ bar: "#2dd4bf", text: "#2dd4bf", glow: "rgba(45,212,191,0.20)"  },
  discrete_math:         { bar: "#fb923c", text: "#fb923c", glow: "rgba(251,146,60,0.20)"  },
  precalculus:           { bar: "#818cf8", text: "#818cf8", glow: "rgba(129,140,248,0.20)" },
  arithmetic:            { bar: "#4ade80", text: "#4ade80", glow: "rgba(74,222,128,0.20)"  },
};
const DEFAULT_SUBJECT_COLOR = { bar: "#94a3b8", text: "#94a3b8", glow: "rgba(148,163,184,0.15)" };

function subjectColor(s: string) {
  return SUBJECT_COLORS[s] ?? DEFAULT_SUBJECT_COLOR;
}

// ── Session type config ───────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { bg: string; border: string; color: string; label: string }> = {
  solve:    { bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.22)",  color: "#22d3ee", label: "Solve"    },
  explore:  { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.22)", color: "#a78bfa", label: "Explore"  },
  practice: { bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.22)",  color: "#34d399", label: "Practice" },
  theory:   { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.22)",  color: "#fbbf24", label: "Theory"   },
};
const TYPE_ICONS: Record<string, ReactNode> = {
  solve:    <Calculator    className="w-3 h-3" />,
  explore:  <BookOpen      className="w-3 h-3" />,
  practice: <PenLine       className="w-3 h-3" />,
  theory:   <GraduationCap className="w-3 h-3" />,
};

type Tab    = "activity" | "history" | "saved";
type Filter = "all" | "solve" | "explore" | "practice" | "theory";

// ── Small toolbar button ──────────────────────────────────────────────────────

function ToolBtn({ onClick, active, accent, children }: {
  onClick: () => void; active: boolean; accent: string; children: ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
      style={{
        background: active ? `${accent}18` : "rgba(255,255,255,0.04)",
        border:     active ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.07)",
        color:      active ? accent : "#475569",
      }}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [data,    setData]    = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>("activity");
  const [filter,  setFilter]  = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  // Track unsaved/deleted in local state so UI updates immediately
  const [unsavedIds, setUnsavedIds]   = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds]   = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    mathApi.progress()
      .then(({ data }) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const allSessions: MathSession[] = data?.all_sessions ?? [];

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allSessions.forEach(s => { counts[s.subject] = (counts[s.subject] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allSessions]);

  const maxCount = subjectCounts[0]?.[1] ?? 1;

  const sevenDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = d.toISOString().split("T")[0];
      const count = allSessions.filter(s => s.created_at.startsWith(dateStr)).length;
      const label = d.toLocaleDateString("en", { weekday: "short" });
      return { label, count, dateStr };
    });
  }, [allSessions]);

  const maxDay = Math.max(...sevenDays.map(d => d.count), 1);

  const filteredSessions = useMemo(() => {
    return allSessions
      .filter(s => !deletedIds.has(s.id))
      .filter(s => filter === "all" || s.session_type === filter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allSessions, filter, deletedIds]);

  const savedSessions = useMemo(() => {
    return allSessions
      .filter(s => s.is_saved && !unsavedIds.has(s.id) && !deletedIds.has(s.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allSessions, unsavedIds, deletedIds]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUnsave = async (id: string) => {
    try {
      await mathApi.unsaveSession(id);
      setUnsavedIds(prev => new Set([...prev, id]));
    } catch { /* silent */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await mathApi.deleteSession(id);
      setDeletedIds(prev => new Set([...prev, id]));
      setConfirmDelete(null);
    } catch { /* silent */ }
  };

  // ── Stat cards ────────────────────────────────────────────────────────────

  const stats: { icon: LucideIcon; label: string; value: string | number; color: string }[] = [
    { icon: Zap,      label: "Total Sessions", value: allSessions.length,           color: "#22d3ee" },
    { icon: Flame,    label: "Streak",          value: `${data?.streak ?? 0} days`,  color: "#f97316" },
    { icon: BookOpen, label: "Topics Covered",  value: subjectCounts.length,         color: "#a78bfa" },
    { icon: Clock,    label: "This Week",       value: sevenDays.reduce((a, d) => a + d.count, 0), color: "#34d399" },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-48 rounded-xl animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="h-4 w-72 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.25)" }}>
            <Zap className="w-4 h-4" style={{ color: "#22d3ee" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
            My Progress
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>Learning Dashboard</h1>
        <p className="mt-1.5 text-sm" style={{ color: "#475569" }}>
          Your complete activity history, saved outputs, and learning analytics.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl p-5"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <Icon className="w-5 h-5 mb-3" style={{ color }} />
            <p className="text-2xl font-bold" style={{ color: "#f1f5f9" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "#475569" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([["activity", LayoutGrid, "Activity"], ["history", History, "History"], ["saved", Bookmark, "Saved"]] as const).map(([t, Icon, lbl]) => (
          <button key={t} onClick={() => setTab(t as Tab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === t ? "rgba(34,211,238,0.10)" : "rgba(255,255,255,0.04)",
              border:     tab === t ? "1px solid rgba(34,211,238,0.30)" : "1px solid rgba(255,255,255,0.07)",
              color:      tab === t ? "#22d3ee" : "#475569",
            }}>
            <Icon className="w-4 h-4" />
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Activity tab ── */}
      {tab === "activity" && (
        <div className="space-y-6">
          {/* 7-day chart */}
          <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#475569" }}>Sessions — Last 7 Days</p>
            <div className="flex items-end gap-2 h-28">
              {sevenDays.map(({ label, count }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px]" style={{ color: "#64748b" }}>{count || ""}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500"
                    style={{
                      height: `${(count / maxDay) * 80}px`,
                      minHeight: count ? 4 : 0,
                      background: count ? "rgba(34,211,238,0.55)" : "rgba(255,255,255,0.04)",
                    }} />
                  <span className="text-[10px]" style={{ color: "#475569" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subject breakdown */}
          {subjectCounts.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "#475569" }}>By Subject</p>
              <div className="space-y-3">
                {subjectCounts.slice(0, 8).map(([subject, count]) => {
                  const c = subjectColor(subject);
                  return (
                    <div key={subject}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs capitalize" style={{ color: "#94a3b8" }}>{subject.replace(/_/g, " ")}</span>
                        <span className="text-xs font-semibold" style={{ color: c.text }}>{count}</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(count / maxCount) * 100}%`, background: c.bar, boxShadow: `0 0 6px ${c.glow}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {allSessions.length === 0 && (
            <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <Zap className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: "#475569" }}>No sessions yet. Start solving to see your progress!</p>
              <Link href="/solve" className="inline-block mt-4 text-xs px-4 py-2 rounded-xl" style={{ background: "rgba(34,211,238,0.10)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.25)" }}>
                Go to Solver →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {tab === "history" && (
        <div>
          {/* Filter bar */}
          <div className="flex flex-wrap gap-2 mb-5">
            {(["all", "solve", "explore", "practice", "theory"] as Filter[]).map(f => (
              <ToolBtn key={f} onClick={() => setFilter(f)} active={filter === f} accent="#22d3ee">
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </ToolBtn>
            ))}
          </div>

          {filteredSessions.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <History className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: "#475569" }}>No sessions found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSessions.map(s => {
                const cfg  = TYPE_CFG[s.session_type]  ?? TYPE_CFG.solve;
                const icon = TYPE_ICONS[s.session_type] ?? TYPE_ICONS.solve;
                const isOpen = expanded === s.id;
                const isSaved = s.is_saved && !unsavedIds.has(s.id);

                return (
                  <div key={s.id} className="rounded-2xl overflow-hidden transition-all"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none"
                      onClick={() => setExpanded(isOpen ? null : s.id)}>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {icon}{cfg.label}
                      </span>
                      <span className="text-xs truncate flex-1 font-medium" style={{ color: "#cbd5e1" }}>
                        {s.input_text}
                      </span>
                      <span className="text-[10px] flex-shrink-0 hidden sm:block" style={{ color: "#475569" }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </span>
                      {isSaved && <BookmarkCheck className="w-3 h-3 flex-shrink-0" style={{ color: "#34d399" }} />}
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} /> 
                               : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} />}
                    </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {/* Action bar */}
                        <div className="flex items-center gap-2 px-5 py-2.5" style={{ background: "rgba(255,255,255,0.01)" }}>
                          <button
                            onClick={() => isSaved ? handleUnsave(s.id) : null}
                            className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                            style={{ background: isSaved ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.04)", border: isSaved ? "1px solid rgba(52,211,153,0.25)" : "1px solid rgba(255,255,255,0.07)", color: isSaved ? "#34d399" : "#475569" }}>
                            {isSaved ? <BookmarkCheck className="w-3 h-3" /> : <Bookmark className="w-3 h-3" />}
                            {isSaved ? "Saved" : "Not saved"}
                          </button>
                          {confirmDelete === s.id ? (
                            <>
                              <button onClick={() => handleDelete(s.id)}
                                className="text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                                style={{ background: "rgba(251,113,133,0.15)", border: "1px solid rgba(251,113,133,0.30)", color: "#fb7185" }}>
                                Confirm delete
                              </button>
                              <button onClick={() => setConfirmDelete(null)}
                                className="text-[10px] px-2.5 py-1.5 rounded-lg"
                                style={{ color: "#475569" }}>Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDelete(s.id)}
                              className="flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg transition-all"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#475569" }}>
                              <Trash2 className="w-3 h-3" />Delete
                            </button>
                          )}
                        </div>
                        <div className="px-5 pb-5">
                          <MathOutput markdown={s.output_text} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Saved tab ── */}
      {tab === "saved" && (
        <div>
          {savedSessions.length === 0 ? (
            <div className="text-center py-16 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <Bookmark className="w-8 h-8 mx-auto mb-3 opacity-20" />
              <p className="text-sm" style={{ color: "#475569" }}>No saved outputs yet. Use the Save button on any result.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedSessions.map(s => {
                const cfg  = TYPE_CFG[s.session_type]  ?? TYPE_CFG.solve;
                const icon = TYPE_ICONS[s.session_type] ?? TYPE_ICONS.solve;
                const isOpen = expanded === s.id;

                return (
                  <div key={s.id} className="rounded-2xl overflow-hidden"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                    <div className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : s.id)}>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0"
                        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                        {icon}{cfg.label}
                      </span>
                      <span className="text-xs truncate flex-1 font-medium" style={{ color: "#cbd5e1" }}>{s.save_title || s.input_text}</span>
                      <button onClick={e => { e.stopPropagation(); handleUnsave(s.id); }}
                        className="flex-shrink-0 text-[10px] px-2 py-1 rounded-lg transition-all hover:opacity-70"
                        style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}>
                        <BookmarkCheck className="w-3 h-3" />
                      </button>
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5" style={{ color: "#475569" }} />
                               : <ChevronDown className="w-3.5 h-3.5" style={{ color: "#475569" }} />}
                    </div>
                    {isOpen && (
                      <div className="px-5 pb-5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <MathOutput markdown={s.output_text} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
