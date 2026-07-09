"use client";
import Link from "next/link";
import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";
import {
  Zap, Check, X, ArrowRight, Sparkles, Lock, Shield,
  Microscope, Layers, Scan, BrainCircuit, Database,
  BarChart3, FlaskConical, Globe, GraduationCap, Camera,
  Building2, Users, Key, Headphones,
} from "lucide-react";

// ── Plan definitions ───────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    label: "Free",
    price: 0,
    priceSuffix: "",
    badge: null,
    description: "Explore the core AI math tools — no credit card required.",
    accent: "#64748b",
    cta: "Current Plan",
    ctaDisabled: true,
    features: [
      { label: "AI Math Solver",                 ok: true  },
      { label: "Topic Explorer",                 ok: true  },
      { label: "Theory Lesson Generator",        ok: true  },
      { label: "Practice Problems",              ok: true  },
      { label: "Visualization Engine",           ok: true  },
      { label: "Simulation Engine",              ok: true  },
      { label: "Real-World Applications",        ok: true  },
      { label: "Scenario Intelligence™",         ok: true  },
      { label: "My Progress Dashboard",          ok: true  },
      { label: "World Bank Data Explorer",       ok: true  },
      { label: "AI Mentor (5 sessions/day)",     ok: true  },
      { label: "Discovery Projects (view only)", ok: true  },
      { label: "Virtual Math Lab™",              ok: false },
      { label: "Digital Twin Simulator",         ok: false },
      { label: "AR / VR Lab",                   ok: false },
      { label: "Submit & get AI project feedback", ok: false },
      { label: "All 5 data sources",             ok: false },
      { label: "Priority AI models",             ok: false },
      { label: "Unlimited AI Mentor",            ok: false },
      { label: "Export to Word / PDF",           ok: false },
    ],
  },
  {
    id: "pro",
    label: "Pro",
    price: 29,
    priceSuffix: "/month",
    badge: "Most Popular",
    description: "The complete Experiential Intelligence™ suite for serious learners.",
    accent: "#22d3ee",
    cta: "Upgrade to Pro",
    ctaDisabled: false,
    features: [
      { label: "Everything in Free",             ok: true  },
      { label: "Virtual Math Lab™ — 20 labs",   ok: true  },
      { label: "Digital Twin Simulator",         ok: true  },
      { label: "AR / VR Lab (WebXR)",            ok: true  },
      { label: "AI project feedback (rubric)",   ok: true  },
      { label: "All 5 data sources (IMF, WHO, NASA, Open-Meteo, World Bank)", ok: true },
      { label: "GPT-4o + Claude Opus 4 models", ok: true  },
      { label: "Unlimited AI Mentor sessions",   ok: true  },
      { label: "Export to Word / PDF / Markdown",ok: true  },
      { label: "Custom AI Lab builder",          ok: true  },
      { label: "Progress analytics",             ok: true  },
      { label: "Priority support",               ok: true  },
      { label: "Team workspace",                 ok: false },
      { label: "SSO & custom domain",            ok: false },
      { label: "Private data sources",           ok: false },
      { label: "API access",                     ok: false },
    ],
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: null,
    priceSuffix: "",
    badge: null,
    description: "For schools, universities, and organisations. Custom pricing.",
    accent: "#a78bfa",
    cta: "Contact Sales",
    ctaDisabled: false,
    features: [
      { label: "Everything in Pro",              ok: true  },
      { label: "Team workspace (unlimited seats)", ok: true },
      { label: "SSO (SAML / OAuth)",             ok: true  },
      { label: "Custom domain",                  ok: true  },
      { label: "Private data source integration",ok: true  },
      { label: "API access + webhooks",          ok: true  },
      { label: "Dedicated AI models",            ok: true  },
      { label: "Analytics & usage dashboard",    ok: true  },
      { label: "LMS integration (Canvas, Moodle)", ok: true },
      { label: "SLA & 24/7 support",             ok: true  },
      { label: "Custom curricula & branding",    ok: true  },
      { label: "On-premises deployment option",  ok: true  },
    ],
  },
];

// ── Feature comparison table ───────────────────────────────────────────────────

const COMPARISON_SECTIONS = [
  {
    title: "Core AI Tools",
    icon: Sparkles,
    rows: [
      { feature: "AI Math Solver",          free: true,    pro: true,     ent: true   },
      { feature: "Topic Explorer",          free: true,    pro: true,     ent: true   },
      { feature: "Theory Lesson Generator", free: true,    pro: true,     ent: true   },
      { feature: "Practice Problems",       free: true,    pro: true,     ent: true   },
      { feature: "Scenario Intelligence™",  free: true,    pro: true,     ent: true   },
    ],
  },
  {
    title: "Experiential Intelligence™",
    icon: Microscope,
    rows: [
      { feature: "Virtual Math Lab™",       free: false,   pro: "20 labs", ent: "Unlimited" },
      { feature: "Digital Twin Simulator",  free: false,   pro: true,     ent: true   },
      { feature: "AR / VR Lab (WebXR)",     free: false,   pro: true,     ent: true   },
      { feature: "Custom AI Lab Builder",   free: false,   pro: true,     ent: true   },
      { feature: "Discovery Projects",      free: "View",  pro: "Submit + AI feedback", ent: true },
    ],
  },
  {
    title: "Visualization & Data",
    icon: BarChart3,
    rows: [
      { feature: "Visualization Engine",    free: true,    pro: true,     ent: true   },
      { feature: "Simulation Engine",       free: true,    pro: true,     ent: true   },
      { feature: "Data Explorer sources",   free: "1 (World Bank)", pro: "All 5",  ent: "All 5 + custom" },
      { feature: "Real-World Applications", free: true,    pro: true,     ent: true   },
    ],
  },
  {
    title: "AI Models",
    icon: BrainCircuit,
    rows: [
      { feature: "GPT-4o Mini",             free: true,    pro: true,     ent: true   },
      { feature: "GPT-4o",                  free: "Limited", pro: true,   ent: true   },
      { feature: "Claude Sonnet 4",         free: "Limited", pro: true,   ent: true   },
      { feature: "Claude Opus 4",           free: false,   pro: true,     ent: true   },
      { feature: "AI Mentor sessions",      free: "5/day", pro: "Unlimited", ent: "Unlimited" },
    ],
  },
  {
    title: "Export & Integrations",
    icon: Globe,
    rows: [
      { feature: "Export to Markdown",      free: false,   pro: true,     ent: true   },
      { feature: "Export to Word / PDF",    free: false,   pro: true,     ent: true   },
      { feature: "API access",              free: false,   pro: false,    ent: true   },
      { feature: "LMS integration",         free: false,   pro: false,    ent: true   },
      { feature: "SSO / SAML",             free: false,   pro: false,    ent: true   },
    ],
  },
  {
    title: "Team & Enterprise",
    icon: Users,
    rows: [
      { feature: "Team workspace",          free: false,   pro: false,    ent: "Unlimited" },
      { feature: "Usage analytics",         free: false,   pro: "Basic",  ent: "Advanced" },
      { feature: "Custom branding",         free: false,   pro: false,    ent: true   },
      { feature: "On-premises deployment",  free: false,   pro: false,    ent: "Optional" },
      { feature: "SLA & dedicated support", free: false,   pro: "Priority", ent: "24/7 SLA" },
    ],
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Can I try Pro features before upgrading?", a: "Yes — admins see all Pro features unlocked. Students get a 7-day free trial of Pro when they first sign up." },
  { q: "What payment methods are accepted?", a: "All major credit cards (Visa, Mastercard, Amex) via Stripe. Annual billing gets 2 months free." },
  { q: "Can I cancel at any time?", a: "Yes, cancel anytime from your account settings. You keep Pro access until the end of your billing period." },
  { q: "Is there a student/educator discount?", a: "Yes — verified students and educators get 50% off Pro. Contact us with your institution email." },
  { q: "What's included in the Virtual Math Lab™?", a: "20 curated labs across Mechanics, Calculus, Statistics, Differential Equations, Waves, and Engineering — plus an AI Custom Lab Builder for any topic." },
  { q: "How does the Enterprise plan work?", a: "We work with your institution to configure seats, SSO, LMS integration, and custom data sources. Pricing is per-seat with volume discounts." },
];

// ── Cell render helper ─────────────────────────────────────────────────────────

function Cell({ value }: { value: boolean | string }) {
  if (value === false) {
    return <X className="w-4 h-4 mx-auto" style={{ color: "#334155" }} />;
  }
  if (value === true) {
    return <Check className="w-4 h-4 mx-auto" style={{ color: "#34d399" }} />;
  }
  return <span className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>{value}</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const { tier, isPro } = usePlan();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const annualDiscount = 0.167; // 2 months free = 16.7%

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
          style={{ background: "rgba(34,211,238,0.10)", border: "1px solid rgba(34,211,238,0.20)" }}>
          <Zap className="w-3.5 h-3.5" style={{ color: "#22d3ee" }} />
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
            Plans & Pricing
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
          Unlock the full Copilot experience
        </h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: "#64748b" }}>
          From first principles to graduate-level research — choose the plan that matches your learning goals.
        </p>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <span className="text-sm" style={{ color: annual ? "#475569" : "#f1f5f9" }}>Monthly</span>
          <button
            onClick={() => setAnnual(v => !v)}
            className="relative w-12 h-6 rounded-full transition-all"
            style={{ background: annual ? "#22d3ee" : "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <span className="absolute top-0.5 transition-all rounded-full w-5 h-5 flex items-center justify-center"
              style={{
                left: annual ? "calc(100% - 22px)" : "2px",
                background: "#f1f5f9",
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
              }}
            />
          </button>
          <span className="text-sm" style={{ color: annual ? "#f1f5f9" : "#475569" }}>
            Annual
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
              2 months free
            </span>
          </span>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {PLANS.map(plan => {
          const isCurrent = plan.id === tier || (plan.id === "free" && !isPro);
          const displayPrice = plan.price && annual ? Math.round(plan.price * (1 - annualDiscount)) : plan.price;

          return (
            <div key={plan.id}
              className="rounded-2xl p-6 flex flex-col relative"
              style={{
                background: plan.badge ? `linear-gradient(160deg, rgba(34,211,238,0.06) 0%, rgba(15,23,42,0) 60%)` : "var(--bg-surface)",
                border: plan.badge ? `1px solid rgba(34,211,238,0.30)` : "1px solid var(--border-subtle)",
                boxShadow: plan.badge ? "0 0 40px rgba(34,211,238,0.08)" : undefined,
              }}>

              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "#22d3ee", color: "#0f172a" }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: plan.accent }}>
                    {plan.label}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: `${plan.accent}18`, color: plan.accent, border: `1px solid ${plan.accent}30` }}>
                      Current
                    </span>
                  )}
                </div>

                <div className="flex items-end gap-1 mb-2">
                  {plan.price !== null ? (
                    <>
                      <span className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>
                        ${displayPrice}
                      </span>
                      {annual && plan.price && displayPrice !== plan.price && (
                        <span className="text-sm line-through mb-0.5" style={{ color: "#334155" }}>
                          ${plan.price}
                        </span>
                      )}
                      <span className="text-sm mb-0.5" style={{ color: "#475569" }}>{plan.priceSuffix}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>Custom</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "#475569" }}>{plan.description}</p>
              </div>

              {/* CTA */}
              {plan.id === "enterprise" ? (
                <a href="mailto:enterprise@aimathcopilot.com"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-all"
                  style={{
                    background: `${plan.accent}18`,
                    border: `1px solid ${plan.accent}35`,
                    color: plan.accent,
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${plan.accent}28`}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${plan.accent}18`}>
                  <Headphones className="w-4 h-4" />Contact Sales
                </a>
              ) : plan.id === "pro" ? (
                <button
                  disabled={isCurrent}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold mb-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isCurrent ? `${plan.accent}15` : `linear-gradient(135deg, #0e7490, #22d3ee)`,
                    border: `1px solid ${plan.accent}40`,
                    color: isCurrent ? plan.accent : "#0f172a",
                    fontWeight: 700,
                  }}>
                  <Zap className="w-4 h-4" />
                  {isCurrent ? "Current Plan" : "Upgrade to Pro"}
                  {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              ) : (
                <button disabled
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold mb-6 opacity-50 cursor-not-allowed"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#64748b" }}>
                  {plan.cta}
                </button>
              )}

              {/* Feature list */}
              <div className="space-y-2.5 flex-1">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    {f.ok ? (
                      <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: plan.accent }} />
                    ) : (
                      <X className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#1e293b" }} />
                    )}
                    <span className="text-xs" style={{ color: f.ok ? "#94a3b8" : "#334155" }}>
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-center mb-8" style={{ color: "#f1f5f9" }}>
          Full feature comparison
        </h2>

        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border-subtle)" }}>
          {/* Table header */}
          <div className="grid grid-cols-4 px-5 py-3.5 text-center"
            style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-left text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>Feature</div>
            {["Free", "Pro", "Enterprise"].map((h, i) => (
              <div key={h} className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: [PLANS[0].accent, PLANS[1].accent, PLANS[2].accent][i] }}>
                {h}
              </div>
            ))}
          </div>

          {COMPARISON_SECTIONS.map((section, si) => (
            <div key={section.title}>
              {/* Section header */}
              <div className="flex items-center gap-2 px-5 py-2.5"
                style={{ background: "rgba(255,255,255,0.015)", borderTop: si > 0 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
                <section.icon className="w-3.5 h-3.5" style={{ color: "#475569" }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
                  {section.title}
                </span>
              </div>

              {/* Rows */}
              {section.rows.map((row, ri) => (
                <div key={ri}
                  className="grid grid-cols-4 px-5 py-2.5 text-center items-center"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.035)" }}>
                  <div className="text-left text-xs" style={{ color: "#64748b" }}>{row.feature}</div>
                  <div><Cell value={row.free} /></div>
                  <div><Cell value={row.pro} /></div>
                  <div><Cell value={row.ent} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Experiential modules teaser */}
      <div className="grid sm:grid-cols-3 gap-4 mb-16">
        {[
          { icon: Microscope, label: "Virtual Math Lab™", desc: "20 curated simulation labs across 6 disciplines", color: "#10b981", locked: !isPro },
          { icon: Layers,     label: "Digital Twin",      desc: "Real-time urban and physical system simulators", color: "#f59e0b", locked: !isPro },
          { icon: Scan,       label: "AR / VR Lab",       desc: "WebXR geometry explorer for any headset",       color: "#f43f5e", locked: !isPro },
        ].map(item => (
          <div key={item.label} className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: "var(--bg-surface)", border: `1px solid ${item.color}25` }}>
            {item.locked && (
              <div className="absolute top-3 right-3">
                <Lock className="w-3.5 h-3.5" style={{ color: item.color, opacity: 0.6 }} />
              </div>
            )}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}>
              <item.icon className="w-5 h-5" style={{ color: item.color }} />
            </div>
            <h3 className="font-bold text-sm mb-1" style={{ color: "#f1f5f9" }}>{item.label}</h3>
            <p className="text-xs" style={{ color: "#475569" }}>{item.desc}</p>
            {item.locked ? (
              <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-semibold"
                style={{ color: item.color }}>
                <Lock className="w-2.5 h-2.5" />Pro only
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-semibold"
                style={{ color: item.color }}>
                <Check className="w-2.5 h-2.5" />Unlocked
              </span>
            )}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="mb-16">
        <h2 className="text-xl font-bold text-center mb-8" style={{ color: "#f1f5f9" }}>
          Frequently asked questions
        </h2>
        <div className="max-w-2xl mx-auto space-y-3">
          {FAQS.map((faq, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
                style={{ color: "#f1f5f9" }}>
                <span className="text-sm font-medium">{faq.q}</span>
                <span className="text-lg flex-shrink-0 ml-3"
                  style={{ color: "#475569", transform: openFaq === i ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                  +
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4">
                  <p className="text-sm" style={{ color: "#64748b" }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="rounded-2xl p-8 text-center"
        style={{
          background: "linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(15,23,42,0) 100%)",
          border: "1px solid rgba(34,211,238,0.20)",
        }}>
        <Shield className="w-8 h-8 mx-auto mb-3" style={{ color: "#22d3ee" }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: "#f1f5f9" }}>
          30-day money-back guarantee
        </h2>
        <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "#64748b" }}>
          Try Pro risk-free. If you&apos;re not completely satisfied within 30 days, we&apos;ll refund every penny — no questions asked.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: "linear-gradient(135deg, #0e7490, #22d3ee)", color: "#0f172a" }}>
            <Zap className="w-4 h-4" />Upgrade to Pro — $29/mo
          </button>
          <Link href="/dashboard"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#94a3b8" }}>
            Continue with Free
          </Link>
        </div>
      </div>

    </div>
  );
}
