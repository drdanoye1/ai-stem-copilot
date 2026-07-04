"use client";
import Link from "next/link";

const FEATURES = [
  {
    icon: "⚡",
    title: "AI Math Solver",
    desc: "Type any problem — from basic algebra to graduate-level calculus. Get a complete, step-by-step solution with every working shown.",
  },
  {
    icon: "📐",
    title: "Beautiful LaTeX Rendering",
    desc: "Every equation is rendered beautifully using LaTeX notation, exactly as you'd see in a textbook or academic paper.",
  },
  {
    icon: "🧭",
    title: "Topic Explorer",
    desc: "Deep-dive into any mathematical concept. Get theory, worked examples, visual intuitions, and practice problems — all in one place.",
  },
  {
    icon: "🎯",
    title: "Practice Generator",
    desc: "Generate unlimited practice problems at your exact level and topic. Every problem comes with a full worked solution.",
  },
  {
    icon: "📈",
    title: "Progress Tracking",
    desc: "Track which topics you've mastered, how many problems you've solved, and where to focus next.",
  },
  {
    icon: "🤖",
    title: "Multiple AI Models",
    desc: "Choose between GPT-4o, Claude Sonnet, and more. Each model brings different strengths to mathematical reasoning.",
  },
];

const SUBJECTS = [
  { label: "Arithmetic",             emoji: "🔢" },
  { label: "Algebra",                emoji: "𝑥" },
  { label: "Geometry",               emoji: "📐" },
  { label: "Trigonometry",           emoji: "〜" },
  { label: "Pre-Calculus",           emoji: "∫" },
  { label: "Calculus",               emoji: "∂" },
  { label: "Statistics",             emoji: "📊" },
  { label: "Linear Algebra",         emoji: "⊞" },
  { label: "Differential Equations", emoji: "Δ" },
  { label: "Discrete Mathematics",   emoji: "⊂" },
];

const DEMO_PROBLEMS = [
  { subject: "Calculus",      problem: "Find d/dx [x³ · sin(x)]" },
  { subject: "Algebra",       problem: "Solve 3x² − 7x + 2 = 0" },
  { subject: "Linear Algebra", problem: "Find the eigenvalues of A = [[2,1],[1,2]]" },
  { subject: "Statistics",    problem: "Find the 95% confidence interval for μ, n=50, x̄=72, σ=8" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">∑</span>
            <span className="font-bold text-brand-700 text-lg">AI Mathematics Copilot™</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login"
              className="text-sm text-gray-600 hover:text-brand-700 font-medium transition-colors">
              Sign in
            </Link>
            <Link href="/register"
              className="text-sm bg-brand-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-700 transition-colors">
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-28 px-6">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-violet-50 -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/5 rounded-full blur-3xl -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-brand-100 mb-6">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            AI Mathematics Copilot™ — MVP Preview
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Your personal{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--brand-gradient)" }}>
              AI mathematics
            </span>{" "}
            tutor
          </h1>

          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Solve any problem step-by-step. Explore any concept in depth.
            Generate unlimited practice problems. Master mathematics at your own pace.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
            <Link href="/register"
              className="px-8 py-4 text-white font-bold rounded-xl text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
              style={{ background: "var(--brand-gradient)" }}>
              Start solving for free →
            </Link>
            <Link href="/login"
              className="px-8 py-4 text-brand-700 font-bold rounded-xl text-base border-2 border-brand-200 hover:border-brand-400 transition-colors bg-white">
              Sign in
            </Link>
          </div>

          {/* Demo problem cards */}
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {DEMO_PROBLEMS.map((d, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:border-brand-200 transition-colors">
                <div className="text-xs text-brand-600 font-semibold mb-1">{d.subject}</div>
                <div className="text-sm font-mono text-gray-700">{d.problem}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Subjects ── */}
      <section className="py-16 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm font-semibold text-gray-400 uppercase tracking-widest mb-6">
            Covers all major mathematics subjects
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {SUBJECTS.map((s) => (
              <span key={s.label}
                className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm px-3.5 py-1.5 rounded-full shadow-sm font-medium">
                <span className="text-base">{s.emoji}</span>
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything you need to master mathematics
            </h2>
            <p className="text-lg text-gray-500 max-w-xl mx-auto">
              From middle school arithmetic to graduate-level mathematics, AI Mathematics Copilot™ adapts to your level.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-brand-100 transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 text-white text-center" style={{ background: "var(--brand-gradient)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to transform how you learn mathematics?
          </h2>
          <p className="text-indigo-200 mb-8 text-lg">
            Join students, teachers, and professionals using AI Mathematics Copilot™.
          </p>
          <Link href="/register"
            className="inline-block bg-white text-brand-700 font-bold px-8 py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5">
            Get started free →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-100 py-8 px-6 text-center text-sm text-gray-400">
        <span className="font-semibold text-gray-600">AI Mathematics Copilot™</span>
        {" "}— Part of the AI STEM Copilot™ platform family.
        {" "}AI-generated content requires verification before professional use.
      </footer>
    </div>
  );
}
