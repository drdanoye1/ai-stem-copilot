"use client";
import { useEffect, useState, useMemo } from "react";
import { mathApi, MathSession } from "@/lib/api";
import { Bookmark, Search, ChevronDown, ChevronUp, Trash2, BookOpen, Calculator, PenLine, GraduationCap, BrainCircuit, X } from "lucide-react";
import ReactMarkdown from "react-markdown";

const TYPE_ICONS: Record<string, React.ElementType> = {
  solve:    Calculator,
  explore:  BookOpen,
  practice: PenLine,
  theory:   GraduationCap,
  mentor:   BrainCircuit,
};

const TYPE_COLORS: Record<string, string> = {
  solve:    "#22d3ee",
  explore:  "#818cf8",
  practice: "#34d399",
  theory:   "#fbbf24",
  mentor:   "#a855f7",
};

const TYPE_LABELS: Record<string, string> = {
  solve:    "AI Solve",
  explore:  "Explore",
  practice: "Practice",
  theory:   "Theory",
  mentor:   "Mentor",
};

export default function SavedPage() {
  const [sessions, setSessions] = useState<MathSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await mathApi.getSaved({ limit: 100 });
      setSessions(data);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const matchType = typeFilter === "all" || s.session_type === typeFilter;
      const matchSearch =
        !search ||
        (s.saved_title || s.input_text || "").toLowerCase().includes(search.toLowerCase()) ||
        s.subject.toLowerCase().includes(search.toLowerCase());
      return matchType && matchSearch;
    });
  }, [sessions, typeFilter, search]);

  const unsave = async (id: string) => {
    setDeleting(id);
    try {
      await mathApi.unsaveSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: sessions.length };
    sessions.forEach(s => { counts[s.session_type] = (counts[s.session_type] || 0) + 1; });
    return counts;
  }, [sessions]);

  const TYPES = ["all", "solve", "explore", "practice", "theory", "mentor"];

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#22d3ee" }}>
          Library
        </p>
        <div className="flex items-center gap-3 mb-1">
          <Bookmark className="w-6 h-6" style={{ color: "#22d3ee" }} />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
            Saved Outputs
          </h1>
        </div>
        <p className="text-sm" style={{ color: "#475569" }}>
          Your bookmarked AI sessions — solutions, explorations, theory lessons, and practice sets.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#475569" }} />
          <input
            type="text"
            placeholder="Search by title, topic, or subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#f1f5f9",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5" style={{ color: "#475569" }} />
            </button>
          )}
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => {
            const color = t === "all" ? "#64748b" : TYPE_COLORS[t];
            const active = typeFilter === t;
            const count = typeCounts[t] || 0;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all capitalize"
                style={{
                  background: active ? `${color}22` : "rgba(255,255,255,0.04)",
                  border: active ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.08)",
                  color: active ? color : "#64748b",
                }}>
                {t === "all" ? "All" : TYPE_LABELS[t]} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl h-20 animate-pulse"
              style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-20" style={{ color: "#475569" }} />
          <p className="text-sm font-semibold" style={{ color: "#334155" }}>
            {sessions.length === 0 ? "No saved sessions yet" : "No results match your filter"}
          </p>
          <p className="text-xs mt-1" style={{ color: "#1e293b" }}>
            {sessions.length === 0
              ? "Bookmark any AI session using the Save button in Solve, Explore, Theory or Practice."
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const Icon = TYPE_ICONS[s.session_type] || BookOpen;
            const color = TYPE_COLORS[s.session_type] || "#64748b";
            const isOpen = expanded === s.id;
            const title = s.saved_title || s.input_text?.slice(0, 80) || "Untitled";
            const date = s.created_at
              ? new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "—";

            return (
              <div key={s.id}
                className="rounded-2xl transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: isOpen ? `1px solid ${color}33` : "1px solid rgba(255,255,255,0.07)",
                }}>
                {/* Card header */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : s.id)}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18` }}>
                    <Icon className="w-4 h-4" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "#f1f5f9" }}>
                      {title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full capitalize"
                        style={{ background: `${color}18`, color, border: `1px solid ${color}33` }}>
                        {TYPE_LABELS[s.session_type] ?? s.session_type}
                      </span>
                      <span className="text-[10px]" style={{ color: "#334155" }}>
                        {s.subject.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px]" style={{ color: "#1e293b" }}>· {date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); unsave(s.id); }}
                      disabled={deleting === s.id}
                      className="p-1.5 rounded-lg transition-all opacity-40 hover:opacity-100"
                      title="Remove bookmark"
                      style={{ color: "#f43f5e" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isOpen
                      ? <ChevronUp className="w-4 h-4" style={{ color: "#334155" }} />
                      : <ChevronDown className="w-4 h-4" style={{ color: "#334155" }} />}
                  </div>
                </button>

                {/* Expanded output */}
                {isOpen && s.output_text && (
                  <div className="px-5 pb-5 pt-1">
                    <div className="rounded-xl p-5 text-sm"
                      style={{
                        background: "rgba(0,0,0,0.2)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: "#cbd5e1",
                        lineHeight: 1.75,
                      }}>
                      <div
                        className="prose prose-invert prose-sm max-w-none"
                        style={{ color: "#cbd5e1" }}>
                        <ReactMarkdown>{s.output_text}</ReactMarkdown>
                      </div>
                    </div>
                    {s.input_text && (
                      <div className="mt-3 px-4 py-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#334155" }}>
                          Original Input
                        </p>
                        <p className="text-xs" style={{ color: "#475569" }}>{s.input_text}</p>
                      </div>
                    )}
                    {/* Token info */}
                    <div className="flex gap-4 mt-3 px-1">
                      {[
                        { label: "Model", value: s.model_name },
                        { label: "Level", value: s.level.replace(/_/g, " ") },
                        { label: "Tokens", value: `${(s.prompt_tokens + s.completion_tokens).toLocaleString()}` },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div className="text-[9px] uppercase tracking-widest" style={{ color: "#1e293b" }}>{label}</div>
                          <div className="text-[10px] font-medium" style={{ color: "#334155" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Count footer */}
      {!loading && filtered.length > 0 && (
        <p className="text-center text-xs mt-8" style={{ color: "#1e293b" }}>
          {filtered.length} saved {filtered.length === 1 ? "session" : "sessions"}
          {typeFilter !== "all" && ` in ${TYPE_LABELS[typeFilter]}`}
        </p>
      )}
    </div>
  );
}
