"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { mathApi, type ProgressData } from "@/lib/api";
import { Calculator, BookOpen, PenLine, GraduationCap, TrendingUp, Zap, Clock, ArrowRight, BarChart3, FlaskConical, Globe, Camera, Microscope, Compass, Layers, Scan, Lock, BrainCircuit, Database } from "lucide-react";

const QUICK_ACTIONS = [
  {
    href: "/solve",
    icon: Calculator,
    label: "Solve a Problem",
    desc: "Step-by-step AI solution with LaTeX",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.15)",
    border: "rgba(34,211,238,0.20)",
  },
  {
    href: "/explore",
    icon: BookOpen,
    label: "Explore a Topic",
    desc: "Deep-dive any mathematical concept",
    accent: "#a78bfa",
    glow: "rgba(167,139,250,0.15)",
    border: "rgba(167,139,250,0.20)",
  },
  {
    href: "/practice",
    icon: PenLine,
    label: "Practice Problems",
    desc: "AI-generated exercises with solutions",
    accent: "#34d399",
    glow: "rgba(52,211,153,0.15)",
    border: "rgba(52,211,153,0.20)",
  },
  {
    href: "/theory",
    icon: GraduationCap,
    label: "Theory Lesson",
    desc: "Derivations, proofs, theorems & history",
    accent: "#fbbf24",
    glow: "rgba(251,191,36,0.15)",
    border: "rgba(251,191,36,0.20)",
  },
  {
    href: "/visualization",
    icon: BarChart3,
    label: "Visualization Gallery",
    desc: "See any topic as graphs, surfaces & more",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.12)",
    border: "rgba(34,211,238,0.18)",
  },
  {
    href: "/simulation",
    icon: FlaskConical,
    label: "Interactive Simulation",
    desc: "Adjust parameters, watch math move live",
    accent: "#34d399",
    glow: "rgba(52,211,153,0.12)",
    border: "rgba(52,211,153,0.18)",
  },
  {
    href: "/applications",
    icon: Globe,
    label: "Real-World Applications",
    desc: "Where this math lives — industries & careers",
    accent: "#818cf8",
    glow: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.18)",
  },
  {
    href: "/scenario",
    icon: Camera,
    label: "Scenario Intelligence™",
    desc: "Photorealistic problem & solution scenes",
    accent: "#f97316",
    glow: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.18)",
  },
  {
    href: "/mentor",
    icon: BrainCircuit,
    label: "AI Mentor Mode",
    desc: "Socratic dialogue — discover, don't memorise",
    accent: "#a855f7",
    glow: "rgba(168,85,247,0.12)",
    border: "rgba(168,85,247,0.18)",
  },
  {
    href: "/data-explorer",
    icon: Database,
    label: "Data Explorer™",
    desc: "Live World Bank data — stats & regression",
    accent: "#06b6d4",
    glow: "rgba(6,182,212,0.12)",
    border: "rgba(6,182,212,0.18)",
  },
];

const LEVEL_LABELS: Record<string, string> = {
  pre_k:         "Pre-K / Kindergarten",
  middle_school: "Middle School",
  high_school:   "High School",
  ap_ib:         "AP / IB Advanced",
  university:    "University",
  graduate:      "Graduate",
  professional:  "Professional / Researcher",
};

const ROLE_LABELS: Record<string, string> = {
  student:     "Student",
  teacher:     "Educator",
  parent:      "Parent",
  admin:       "Administrator",
};

const SUBJECT_TAGS: Record<string, { bg: string; color: string }> = {
  algebra:              { bg: "rgba(34,211,238,0.12)",  color: "#22d3ee" },
  calculus:             { bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  geometry:             { bg: "rgba(167,139,250,0.12)", color: "#a78bfa" },
  trigonometry:         { bg: "rgba(99,102,241,0.12)",  color: "#818cf8" },
  statistics:           { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24" },
  linear_algebra:       { bg: "rgba(251,113,133,0.12)", color: "#fb7185" },
  differential_equations:{ bg: "rgba(20,184,166,0.12)", color: "#2dd4bf" },
  discrete_math:        { bg: "rgba(251,146,60,0.12)",  color: "#fb923c" },
  precalculus:          { bg: "rgba(129,140,248,0.12)", color: "#818cf8" },
  arithmetic:           { bg: "rgba(74,222,128,0.12)",  color: "#4ade80" },
  other:                { bg: "rgba(255,255,255,0.07)",  color: "#94a3b8" },
};

function tag(subject: string) {
  return SUBJECT_TAGS[subject] || SUBJECT_TAGS.other;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    mathApi.progress().then(({ data }) => setProgress(data)).catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const firstName = user?.full_name?.split(" ")[0] || "there";

  const STATS = [
    {
      label: "Total Sessions",
      value: progress?.all_sessions?.length ?? 0,
      icon: Zap,
      accent: "#22d3ee",
      glow: "rgba(34,211,238,0.12)",
    },
    {
      label: "This Week",
      value: progress?.all_sessions?.filter(s => new Date(s.created_at) > new Date(Date.now()-7*864e5)).length ?? 0,
      icon: TrendingUp,
      accent: "#34d399",
      glow: "rgba(52,211,153,0.12)",
    },
    {
      label: "Subjects",
      value: new Set(progress?.all_sessions?.map(s => s.subject) ?? []).size,
      icon: BookOpen,
      accent: "#a78bfa",
      glow: "rgba(167,139,250,0.12)",
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#22d3ee" }}>
          {greeting()}
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#f1f5f9" }}>
          Welcome back, {firstName}
        </h1>

        {/* Dynamic profile summary line */}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Level badge */}
          <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.20)", color: "#22d3ee" }}>
            {LEVEL_LABELS[user?.level ?? ""] ?? user?.level?.replace(/_/g, " ") ?? "—"}
          </span>

          {/* Role badge */}
          {user?.role && (
            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{
                background: user.role === "admin" ? "rgba(167,139,250,0.10)" : "rgba(255,255,255,0.05)",
                border: user.role === "admin" ? "1px solid rgba(167,139,250,0.22)" : "1px solid rgba(255,255,255,0.08)",
                color:  user.role === "admin" ? "#a78bfa" : "#64748b",
              }}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          )}

          {/* Plan badge */}
          {user?.plan && user.plan !== "free" && (
            <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}>
              {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
            </span>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
        {STATS.map(({ label, value, icon: Icon, accent, glow }) => (
          <div key={label} className="rounded-2xl p-5 transition-all"
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", boxShadow: `0 0 0 0 ${glow}` }}>
            <Icon className="w-5 h-5 mb-3" style={{ color: accent }} />
            <p className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>{value}</p>
            <p className="text-xs mt-1" style={{ color: "#475569" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      {progress?.all_sessions && progress.all_sessions.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>Recent Activity</p>
            <Link href="/progress" className="text-xs font-medium flex items-center gap-1" style={{ color: "#22d3ee" }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {progress.all_sessions.slice(0, 5).map((s) => {
              const t = tag(s.subject);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                    style={{ background: t.bg, color: t.color }}>
                    {s.subject.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs truncate flex-1" style={{ color: "#94a3b8" }}>{s.input_text}</span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: "#475569" }}>
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#475569" }}>AI Tools</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc, accent, glow, border }) => (
            <Link key={href} href={href}
              className="group flex items-start gap-4 rounded-2xl p-5 transition-all duration-200"
              style={{ background: "var(--bg-surface)", border: `1px solid var(--border-subtle)` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${glow}`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: glow, border: `1px solid ${border}` }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: "#e2e8f0" }}>{label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Experiential section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "#475569" }}>Experiential Labs</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { href: "/lab",          icon: Microscope, label: "Virtual Math Lab",    desc: "Run interactive experiments",         accent: "#10b981", locked: false },
            { href: "/projects",     icon: Compass,    label: "Discovery Projects",   desc: "Guided long-form project work",       accent: "#8b5cf6", locked: true  },
            { href: "/digital-twin", icon: Layers,     label: "Digital Twin",         desc: "Real-time system simulation",         accent: "#f59e0b", locked: true  },
            { href: "/ar-lab",       icon: Scan,       label: "AR / VR Lab",          desc: "Spatial mathematics in mixed reality",accent: "#f43f5e", locked: true  },
          ].map(({ href, icon: Icon, label, desc, accent, locked }) => (
            <Link key={href} href={locked ? "#" : href}
              className="flex items-center gap-4 rounded-2xl p-5 transition-all"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", opacity: locked ? 0.7 : 1 }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
                <Icon className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>{label}</p>
                <p className="text-xs" style={{ color: "#475569" }}>{desc}</p>
              </div>
              {locked && <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#475569" }} />}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
