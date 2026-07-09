"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Calculator, BookOpen, PenLine, TrendingUp, GraduationCap,
  BarChart3, FlaskConical, Globe, Microscope, BrainCircuit,
  Layers, ArrowRight, Sparkles, Zap, Check, Database,
  ChevronRight, Star, Scan, Mail, MessageSquare,
} from "lucide-react";

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Calculator,
    color: "#22d3ee",
    title: "AI Math Solver",
    desc: "Type any problem — from basic algebra to graduate calculus. Get a complete, step-by-step solution with every working shown.",
  },
  {
    icon: GraduationCap,
    color: "#fbbf24",
    title: "Theory Lesson Generator",
    desc: "Rigorous lessons with historical context, formal proofs, derivations, and worked examples — generated in seconds.",
  },
  {
    icon: BookOpen,
    color: "#a78bfa",
    title: "Topic Explorer",
    desc: "Deep-dive into any concept. AI explains theory, generates examples, and adapts to your curriculum and level.",
  },
  {
    icon: PenLine,
    color: "#34d399",
    title: "Practice Problems",
    desc: "Generate unlimited problems at your exact level. Every question comes with a full worked solution.",
  },
  {
    icon: BarChart3,
    color: "#22d3ee",
    title: "Visualization Engine",
    desc: "Function graphs, 3D surfaces, statistical charts, and GeoGebra geometry — auto-generated from AI responses.",
  },
  {
    icon: FlaskConical,
    color: "#34d399",
    title: "Simulation Engine",
    desc: "Interactive sliders bring differential equations and physics models to life. Adjust parameters and watch math move.",
  },
  {
    icon: Microscope,
    color: "#10b981",
    title: "Virtual Math Lab™",
    desc: "20 curated lab experiments across Mechanics, Calculus, Statistics, Waves, and Engineering — with guided objectives.",
  },
  {
    icon: BrainCircuit,
    color: "#a855f7",
    title: "AI Mentor",
    desc: "Conversational tutor that explains concepts step by step, draws SVG diagrams, and adapts to your questions.",
  },
  {
    icon: Database,
    color: "#06b6d4",
    title: "Data Explorer",
    desc: "Live economic, climate, health, and satellite data from 5 global sources — World Bank, IMF, NASA, WHO, and more.",
  },
  {
    icon: Globe,
    color: "#818cf8",
    title: "Real-World Applications",
    desc: "See how every topic applies in engineering, finance, medicine, and science — with live formula evaluation.",
  },
  {
    icon: Layers,
    color: "#f59e0b",
    title: "Digital Twin Sandbox™",
    desc: "Build living mathematical models of real-world systems. Connect live data and run what-if simulations.",
  },
  {
    icon: TrendingUp,
    color: "#f97316",
    title: "Progress Tracking",
    desc: "Track sessions, streaks, topics mastered, and time spent. See exactly where to focus next.",
  },
];

const SUBJECTS = [
  "Pre-K Counting", "Early Arithmetic", "Arithmetic", "Algebra", "Geometry",
  "Trigonometry", "Pre-Calculus", "Calculus", "Statistics", "Linear Algebra",
  "Differential Equations", "Discrete Mathematics", "Number Theory", "Probability",
];

const DEMO_PROBLEMS = [
  { subject: "Pre-K",         color: "#4ade80", problem: "Count the apples: 🍎🍎🍎 — how many?" },
  { subject: "Calculus",      color: "#22d3ee", problem: "Find d/dx [x³ · sin(x)]" },
  { subject: "Algebra",       color: "#a78bfa", problem: "Solve 3x² − 7x + 2 = 0" },
  { subject: "Linear Algebra", color: "#34d399", problem: "Eigenvalues of A = [[2,1],[1,2]]" },
  { subject: "Statistics",    color: "#fbbf24", problem: "95% CI for μ, n=50, x̄=72, σ=8" },
  { subject: "Number Theory", color: "#f43f5e", problem: "Prove there are ∞ prime numbers" },
];

const PLANS = [
  {
    label: "Free",
    price: "$0",
    accent: "#64748b",
    features: ["AI Math Solver", "Topic Explorer", "Practice Problems", "Visualization Engine", "Basic AI Mentor"],
    cta: "Start for free",
    href: "/register",
    highlight: false,
  },
  {
    label: "Pro",
    price: "$29",
    accent: "#22d3ee",
    features: ["Everything in Free", "Virtual Math Lab™ — 20 labs", "Digital Twin Sandbox™", "AR / VR Lab", "All 5 data sources", "Unlimited AI Mentor", "Export to Word / PDF"],
    cta: "Upgrade to Pro",
    href: "/register",
    highlight: true,
  },
  {
    label: "Enterprise",
    price: "Custom",
    accent: "#a78bfa",
    features: ["Everything in Pro", "Team workspace", "SSO & custom domain", "API access", "LMS integration", "24/7 SLA support"],
    cta: "Contact sales",
    href: "mailto:enterprise@aimathcopilot.com",
    highlight: false,
  },
];

const STATS = [
  { value: "7",   label: "Learner levels — Pre-K to Graduate" },
  { value: "12+", label: "Intelligence modules" },
  { value: "20+", label: "Virtual lab experiments" },
  { value: "∞",   label: "Practice problems" },
];

// ── Animated counter ───────────────────────────────────────────────────────────

function FloatingOrb({ style }: { style: React.CSSProperties }) {
  return (
    <div className="absolute rounded-full pointer-events-none" style={{ filter: "blur(80px)", ...style }} />
  );
}

// ── Contact / Feedback section ────────────────────────────────────────────────

const FORM_ENDPOINT = "https://formspree.io/f/mzdllpgw";

type FormTab = "feedback" | "sales";

function ContactSection() {
  const [tab, setTab] = useState<FormTab>("feedback");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("sending");
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  const isSales = tab === "sales";
  const accent = isSales ? "#a78bfa" : "#22d3ee";

  return (
    <section className="py-24 px-6 relative overflow-hidden" id="contact"
      style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
      <FloatingOrb style={{ width: 500, height: 400, top: "40%", right: "-10%", background: "rgba(167,139,250,0.05)" }} />
      <FloatingOrb style={{ width: 400, height: 400, top: "10%", left: "-8%", background: "rgba(34,211,238,0.04)" }} />

      <div className="max-w-5xl mx-auto relative grid md:grid-cols-2 gap-14 items-start">

        {/* Left — copy */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.20)" }}>
            <Mail className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
              Get in touch
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 leading-tight" style={{ color: "#f1f5f9" }}>
            We&apos;d love to<br />
            <span style={{
              background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>hear from you</span>
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "#475569", maxWidth: "360px" }}>
            Share ideas, report issues, or talk to us about Pro and Enterprise plans. Every message is read by the team.
          </p>

          {/* Contact options */}
          <div className="space-y-4">
            {[
              {
                icon: MessageSquare,
                color: "#22d3ee",
                label: "Send feedback",
                desc: "Suggest features, report bugs, or share what you love",
                onClick: () => setTab("feedback"),
              },
              {
                icon: Zap,
                color: "#a78bfa",
                label: "Sales & Enterprise",
                desc: "Custom pricing, team licenses, and private deployment",
                onClick: () => setTab("sales"),
              },
            ].map(({ icon: Icon, color, label, desc, onClick }) => (
              <button key={label} onClick={onClick}
                className="w-full flex items-start gap-4 p-4 rounded-2xl text-left transition-all"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = color + "44"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: color + "18", border: `1px solid ${color}30` }}>
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: "#e2e8f0" }}>{label}</p>
                  <p className="text-xs" style={{ color: "#475569" }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right — contact form */}
        <div className="rounded-2xl p-7" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Tab picker */}
          <div className="flex gap-2 mb-6">
            {(["feedback", "sales"] as FormTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? accent + "20" : "transparent",
                  border: `1px solid ${tab === t ? accent + "50" : "rgba(255,255,255,0.06)"}`,
                  color: tab === t ? accent : "#475569",
                }}>
                {t === "feedback" ? "💬 Feedback" : "⚡ Sales & Enterprise"}
              </button>
            ))}
          </div>

          {status === "sent" ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-3">🎉</div>
              <div className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>Message received!</div>
              <div className="text-xs mt-1" style={{ color: "#475569" }}>We&apos;ll get back to you soon.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSales && (
                <div>
                  <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#475569" }}>Company</label>
                  <input name="company" placeholder="Acme Corp" className="input-dark w-full text-sm py-2.5" />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#475569" }}>Name</label>
                <input name="name" required placeholder="Your name" className="input-dark w-full text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#475569" }}>Email</label>
                <input name="email" type="email" required placeholder="you@email.com" className="input-dark w-full text-sm py-2.5" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "#475569" }}>
                  {isSales ? "Tell us about your use case" : "Message"}
                </label>
                <textarea name="message" required rows={4} placeholder={isSales ? "Team size, use case, timeline…" : "Share your thoughts…"}
                  className="input-dark w-full text-sm py-2.5 resize-none" />
              </div>
              <input type="hidden" name="type" value={tab} />
              <button type="submit" disabled={status === "sending"}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                style={{ background: accent, color: "#0f172a" }}>
                {status === "sending" ? "Sending…" : isSales ? "Talk to Sales" : "Send Feedback"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Main landing page ──────────────────────────────────────────────────────────

export default function HomePage() {
  const [activeDemo, setActiveDemo] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActiveDemo(p => (p + 1) % DEMO_PROBLEMS.length), 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base, #0b0f1a)", color: "#f1f5f9" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)", boxShadow: "0 0 16px rgba(34,211,238,0.35)" }}>
            ∑
          </div>
          <span className="font-bold text-sm" style={{ color: "#f8fafc" }}>AI Mathematics Copilot™</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-xs px-4 py-2 rounded-lg font-medium" style={{ color: "#94a3b8" }}>Sign in</Link>
          <Link href="/register" className="text-xs px-4 py-2 rounded-lg font-semibold"
            style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)", color: "#0f172a" }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6 text-center relative overflow-hidden">
        <FloatingOrb style={{ width: 600, height: 600, top: "-10%", left: "50%", transform: "translateX(-50%)", background: "rgba(34,211,238,0.06)" }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-xs font-semibold"
            style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.20)", color: "#22d3ee" }}>
            <Sparkles className="w-3.5 h-3.5" /> AI-powered math learning — Pre-K through PhD
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold mb-6 leading-tight tracking-tight">
            Master <span style={{ background: "linear-gradient(135deg,#22d3ee 0%,#a78bfa 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              any math
            </span><br />at any level
          </h1>
          <p className="text-lg mb-10 max-w-xl mx-auto" style={{ color: "#64748b" }}>
            From counting apples to graduate-level topology. AI that teaches, explains, visualises, and adapts — all in one place.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/register" className="px-7 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
              style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)", color: "#0f172a" }}>
              Start learning free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing" className="px-7 py-3 rounded-xl font-semibold text-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#94a3b8" }}>
              View pricing
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto mt-20">
          {STATS.map(s => (
            <div key={s.label} className="rounded-2xl py-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-3xl font-bold mb-1" style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "#475569" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Demo carousel */}
        <div className="mt-16 max-w-lg mx-auto rounded-2xl p-5 text-left"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#334155" }}>Try an example</div>
          {DEMO_PROBLEMS.map((p, i) => (
            <div key={i} onClick={() => setActiveDemo(i)} className="cursor-pointer"
              style={{ display: i === activeDemo ? "block" : "none" }}>
              <div className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: p.color }}>{p.subject}</div>
              <div className="text-sm font-mono" style={{ color: "#e2e8f0" }}>{p.problem}</div>
            </div>
          ))}
          <div className="flex gap-1.5 mt-3">
            {DEMO_PROBLEMS.map((_, i) => (
              <button key={i} onClick={() => setActiveDemo(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === activeDemo ? "#22d3ee" : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>
      </section>

      {/* Subjects */}
      <section className="py-10 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-5xl mx-auto flex flex-wrap gap-2 justify-center">
          {SUBJECTS.map(s => (
            <span key={s} className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#64748b" }}>
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#f1f5f9" }}>Everything you need to excel</h2>
            <p className="text-sm" style={{ color: "#475569" }}>Twelve intelligence modules — all included.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className="rounded-2xl p-6"
                style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${f.color}18` }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: f.color + "15", border: `1px solid ${f.color}25` }}>
                  <f.icon className="w-4.5 h-4.5" style={{ color: f.color }} />
                </div>
                <div className="font-semibold text-sm mb-1.5" style={{ color: "#f1f5f9" }}>{f.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: "#475569" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="py-24 px-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#f1f5f9" }}>Simple, transparent pricing</h2>
            <p className="text-sm" style={{ color: "#475569" }}>Start free. Upgrade when you&apos;re ready.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {PLANS.map(p => (
              <div key={p.label} className="rounded-2xl p-6 flex flex-col"
                style={{
                  background: p.highlight ? `linear-gradient(135deg, ${p.accent}12, rgba(255,255,255,0.02))` : "rgba(255,255,255,0.025)",
                  border: `1px solid ${p.highlight ? p.accent + "35" : "rgba(255,255,255,0.07)"}`,
                }}>
                {p.highlight && (
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-3 px-2.5 py-1 rounded-full self-start"
                    style={{ background: p.accent + "20", color: p.accent, border: `1px solid ${p.accent}30` }}>
                    Most popular
                  </div>
                )}
                <div className="font-bold text-sm mb-0.5" style={{ color: p.accent }}>{p.label}</div>
                <div className="text-3xl font-bold mb-5" style={{ color: "#f1f5f9" }}>{p.price}<span className="text-sm font-normal text-slate-500">{p.price !== "Custom" ? "/mo" : ""}</span></div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: "#64748b" }}>
                      <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: p.accent }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={p.href} className="text-center py-2.5 rounded-xl text-xs font-bold"
                  style={{
                    background: p.highlight ? p.accent : "rgba(255,255,255,0.06)",
                    color: p.highlight ? "#0f172a" : "#94a3b8",
                    border: p.highlight ? "none" : "1px solid rgba(255,255,255,0.08)",
                  }}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="text-xs font-semibold" style={{ color: "#22d3ee" }}>
              See full feature comparison <ChevronRight className="inline w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <ContactSection />

      {/* Footer */}
      <footer className="py-12 px-6 text-center border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-xl flex items-center justify-center text-lg font-bold"
            style={{ background: "linear-gradient(135deg,#22d3ee,#a78bfa)", boxShadow: "0 0 16px rgba(34,211,238,0.25)" }}>
            ∑
          </div>
          <span className="text-sm font-bold" style={{ color: "#94a3b8" }}>AI Mathematics Copilot™</span>
        </div>
        <p className="text-xs" style={{ color: "#475569" }}>
          Built for learners at every level — Pre-K through PhD.
        </p>
        <div className="flex items-center justify-center gap-6 mt-6">
          <Link href="/login"    className="text-xs hover:underline" style={{ color: "#334155" }}>Sign in</Link>
          <Link href="/register" className="text-xs hover:underline" style={{ color: "#334155" }}>Register</Link>
          <Link href="/pricing"  className="text-xs hover:underline" style={{ color: "#334155" }}>Pricing</Link>
        </div>
      </footer>
    </div>
  );
}
