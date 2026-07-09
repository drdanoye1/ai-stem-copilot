"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { mathApi, type SimulateResponse, type SimParam } from "@/lib/api";
import { sampleWithParams } from "@/components/viz/mathEval";
import { MathOutput } from "@/components/MathOutput";
import {
  Microscope, Loader2, ChevronDown, ArrowLeft, Sparkles,
  CheckCircle2, Circle, BookOpen, Lightbulb, FlaskConical,
  ChevronRight, RefreshCw,
} from "lucide-react";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

// ── Lab catalog ───────────────────────────────────────────────────────────────

interface LabConfig {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  catColor: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  subjects: string[];
  description: string;
  scenario: string;
  objectives: string[];
  insight: string;
  topic: string; // sent to /math/simulate
}

const LABS: LabConfig[] = [
  // ── Mechanics ──
  {
    id: "pendulum", title: "Simple Pendulum", subtitle: "Period, Length & Gravity",
    category: "Mechanics", catColor: "#22d3ee", difficulty: "Beginner",
    subjects: ["Trigonometry", "Diff. Equations"],
    description: "Discover how pendulum length and gravity determine oscillation period.",
    scenario: "You're designing a grandfather clock for a space station where gravity differs from Earth. The engineer asks: how long should the pendulum be to keep 1-second beats?",
    objectives: [
      "Observe how increasing length L increases the period T",
      "Test whether changing mass affects the period",
      "Find the length that gives T = 2 s (a 'seconds pendulum')",
      "Predict T on the Moon (g ≈ 1.6 m/s²)",
    ],
    insight: "T = 2π√(L/g) — the period depends only on length and gravity, not mass or swing angle (for small angles). This is why pendulum clocks are so reliable on Earth but need recalibration on other planets.",
    topic: "Simple Pendulum: how pendulum length and gravitational acceleration affect oscillation period T",
  },
  {
    id: "projectile", title: "Projectile Motion", subtitle: "Range, Angle & Velocity",
    category: "Mechanics", catColor: "#22d3ee", difficulty: "Beginner",
    subjects: ["Calculus", "Trigonometry"],
    description: "Optimise launch angle for maximum horizontal range.",
    scenario: "You're a field artillery officer in 1742. Your cannon fires at a fixed muzzle velocity. At what angle do you aim to hit the target at maximum range?",
    objectives: [
      "Plot range vs launch angle from 0° to 90°",
      "Identify the angle that maximises range",
      "Observe symmetry: does 30° give the same range as 60°?",
      "Explore how initial velocity changes the optimal angle",
    ],
    insight: "Range = v₀²sin(2θ)/g — maximum range occurs at θ = 45°. Complementary angles (e.g. 30° and 60°) give identical range. This result from calculus (dR/dθ = 0) has been used in ballistics since the 17th century.",
    topic: "Projectile motion: horizontal range vs launch angle, adjustable initial velocity and gravity",
  },
  {
    id: "spring-mass", title: "Spring-Mass Oscillator", subtitle: "Hooke's Law & SHM",
    category: "Mechanics", catColor: "#22d3ee", difficulty: "Intermediate",
    subjects: ["Diff. Equations", "Calculus"],
    description: "Explore simple harmonic motion by adjusting mass and spring stiffness.",
    scenario: "You're a mechanical engineer designing a vibration isolator for sensitive lab equipment. You must tune the spring-mass system so its natural frequency stays far from building vibration frequencies (1–10 Hz).",
    objectives: [
      "Find how period T changes as mass m increases",
      "Find how period T changes as spring constant k increases",
      "Calculate the natural frequency f = 1/T",
      "Design a system with f < 0.5 Hz for vibration isolation",
    ],
    insight: "T = 2π√(m/k) — period increases with mass (heavier = slower) and decreases with stiffness (stiffer = faster). This governs everything from car suspensions to atomic force microscopes.",
    topic: "Spring-mass oscillator: period vs mass and spring constant k, simple harmonic motion",
  },
  {
    id: "newtons-cooling", title: "Newton's Law of Cooling", subtitle: "Temperature Decay",
    category: "Mechanics", catColor: "#22d3ee", difficulty: "Beginner",
    subjects: ["Diff. Equations", "Calculus"],
    description: "Model how objects cool towards ambient temperature exponentially.",
    scenario: "A forensic scientist uses temperature data to estimate time of death. The body was found at 28°C in a 20°C room. Normal body temperature is 37°C. When did the person die?",
    objectives: [
      "Observe the exponential temperature decay curve",
      "Find the cooling constant k for different materials",
      "Estimate the time when T = 28°C (time of death scenario)",
      "Explore how ambient temperature shifts the whole curve",
    ],
    insight: "T(t) = T_env + (T₀ − T_env)e^(−kt) — cooling is exponential and asymptotic to ambient temperature. The cooling constant k depends on the object's material and surface area.",
    topic: "Newton's Law of Cooling: temperature vs time, adjustable cooling constant and ambient temperature",
  },
  // ── Calculus ──
  {
    id: "riemann", title: "Riemann Sum Explorer", subtitle: "Approximating Integrals",
    category: "Calculus", catColor: "#fbbf24", difficulty: "Intermediate",
    subjects: ["Calculus"],
    description: "Watch rectangles approximate the area under a curve as n increases.",
    scenario: "You're a 17th-century mathematician before the formal calculus existed. You need to find the exact area under a parabola. Can you get there by adding rectangles?",
    objectives: [
      "Start with n = 5 rectangles and estimate the area",
      "Increase n to 20, 50, 100 — watch accuracy improve",
      "Compare left, right, and midpoint rules",
      "Observe that the sum converges to the exact integral",
    ],
    insight: "∫f(x)dx = lim(n→∞) Σf(xᵢ)Δx — the definite integral is the limit of Riemann sums. This is the fundamental bridge between discrete summation and continuous area.",
    topic: "Riemann sum approximation: number of rectangles n vs integration error, for f(x) = x²",
  },
  {
    id: "taylor-series", title: "Taylor Series Approximation", subtitle: "Polynomials Approaching sin(x)",
    category: "Calculus", catColor: "#fbbf24", difficulty: "Advanced",
    subjects: ["Calculus", "Algebra"],
    description: "Add polynomial terms one-by-one and watch them converge to sin(x).",
    scenario: "Before computers, engineers used polynomial approximations to compute trigonometric values. How many terms does it take to get 5-decimal accuracy near x = π?",
    objectives: [
      "Start with 1 term (x) — only accurate near 0",
      "Add term 2 (−x³/6) — better for larger x",
      "Keep adding terms and observe the convergence radius",
      "Find how many terms give < 0.001 error at x = π/2",
    ],
    insight: "sin(x) = x − x³/3! + x⁵/5! − x⁷/7! + ⋯ — every smooth function can be approximated by polynomials around a point. More terms = wider accuracy. This is the foundation of numerical computing.",
    topic: "Taylor series approximation of sin(x): polynomial order vs approximation error, convergence radius",
  },
  {
    id: "derivative-slope", title: "Derivative as Slope", subtitle: "Tangent Line Explorer",
    category: "Calculus", catColor: "#fbbf24", difficulty: "Beginner",
    subjects: ["Calculus"],
    description: "Move a point along a curve and watch the tangent line slope change.",
    scenario: "You're a physicist measuring the instantaneous velocity of a rocket at any moment during its flight. Velocity IS the slope of the position-time curve.",
    objectives: [
      "Observe how the slope changes sign at turning points",
      "Find where the derivative equals zero (maxima/minima)",
      "Note that slope is steep where the function changes fastest",
      "Connect derivative sign to increasing/decreasing behaviour",
    ],
    insight: "f′(x) = lim(h→0) [f(x+h)−f(x)]/h — the derivative is the instantaneous rate of change, geometrically the slope of the tangent line. It equals zero at local maxima and minima (Fermat's theorem).",
    topic: "Derivative as instantaneous slope: tangent line to f(x) = x³ − 3x, showing derivative at adjustable point x",
  },
  {
    id: "exponential-growth", title: "Exponential Growth & Decay", subtitle: "Growth Rate & Doubling Time",
    category: "Calculus", catColor: "#fbbf24", difficulty: "Beginner",
    subjects: ["Calculus", "Diff. Equations"],
    description: "Explore how growth rate r controls doubling time and long-run behaviour.",
    scenario: "A startup has 1,000 users and is growing at 15% monthly. A VC asks: how long until you reach 1 million users? And what happens if growth slows to 5%?",
    objectives: [
      "Observe the J-curve of exponential growth",
      "Calculate doubling time: T₂ = ln(2)/r",
      "Compare growth at r = 0.05, 0.15, 0.30",
      "Switch to decay (negative r) and observe half-life",
    ],
    insight: "N(t) = N₀e^(rt) — the doubling time T₂ = ln(2)/r ≈ 70/r% (the Rule of 70). Small differences in r create enormous long-run differences — this explains compounding interest, viral spread, and radioactive decay.",
    topic: "Exponential growth and decay: population N vs time t, adjustable growth rate r and initial value",
  },
  // ── Statistics ──
  {
    id: "normal-dist", title: "Normal Distribution", subtitle: "Mean, Std Dev & the Bell Curve",
    category: "Statistics", catColor: "#34d399", difficulty: "Beginner",
    subjects: ["Statistics"],
    description: "Explore how μ and σ shape the bell curve and the 68-95-99.7 rule.",
    scenario: "You're a quality control engineer at a factory. The diameter of bolts must be 10 mm ± 0.1 mm. If production has μ = 10 mm and σ = 0.05 mm, what fraction of bolts are defective?",
    objectives: [
      "Shift the mean μ and observe the curve translate horizontally",
      "Increase σ and observe the curve widen and flatten",
      "Note that area under the curve always equals 1 (total probability)",
      "Identify the 1σ, 2σ, 3σ ranges (68%, 95%, 99.7%)",
    ],
    insight: "f(x) = (1/σ√2π)e^(−(x−μ)²/2σ²) — the Gaussian distribution arises from the sum of many independent random variables (Central Limit Theorem). The 68-95-99.7 rule is one of the most useful empirical rules in science.",
    topic: "Normal distribution bell curve: probability density vs x, adjustable mean mu and standard deviation sigma",
  },
  {
    id: "clt", title: "Central Limit Theorem", subtitle: "Sample Size vs Distribution Shape",
    category: "Statistics", catColor: "#34d399", difficulty: "Intermediate",
    subjects: ["Statistics", "Calculus"],
    description: "Watch a non-normal population become normally distributed as sample size grows.",
    scenario: "A polling company samples voters from a highly skewed population. How large must the sample be before the sampling distribution of the mean becomes approximately normal?",
    objectives: [
      "Start with n = 1 — distribution matches the population",
      "Increase n to 5, 10, 30 — observe bell curve emerging",
      "Note the standard error σ/√n decreasing with n",
      "Find the n where the distribution looks 'normal enough'",
    ],
    insight: "As n → ∞, x̄ ~ N(μ, σ²/n) regardless of population shape. The CLT is why the normal distribution appears everywhere — it's the distribution of averages. Standard error σ/√n shrinks as √n, so quadrupling n halves the error.",
    topic: "Central Limit Theorem: sampling distribution shape vs sample size n, standard error of mean",
  },
  {
    id: "regression", title: "Linear Regression", subtitle: "Least Squares & Residuals",
    category: "Statistics", catColor: "#34d399", difficulty: "Intermediate",
    subjects: ["Statistics", "Linear Algebra"],
    description: "Fit a line to data and explore the effect of slope and intercept.",
    scenario: "A real estate analyst needs to predict house prices from floor area. How does the regression line change as outliers are added? How do you measure the quality of the fit?",
    objectives: [
      "Observe how the regression line minimises squared residuals",
      "Add an outlier and watch it pull the line",
      "Explore R² — what does 0.9 vs 0.5 look like?",
      "Predict y for an x value outside the training range",
    ],
    insight: "ŷ = β₀ + β₁x where β₁ = Cov(x,y)/Var(x) — the slope is the ratio of covariance to variance. R² = 1 − SSres/SStot measures proportion of variance explained. Extrapolation beyond the data range is unreliable.",
    topic: "Linear regression: least squares fit, residuals, R-squared, adjustable slope and intercept",
  },
  // ── Differential Equations ──
  {
    id: "sir-model", title: "SIR Epidemic Model", subtitle: "Infection, Recovery & R₀",
    category: "Diff. Equations", catColor: "#a78bfa", difficulty: "Intermediate",
    subjects: ["Diff. Equations", "Statistics"],
    description: "Simulate epidemic spread and explore the basic reproduction number R₀.",
    scenario: "You're an epidemiologist advising a government during a new outbreak. The pathogen has β = 0.3 and γ = 0.1. Will it cause a pandemic? What vaccination rate prevents it?",
    objectives: [
      "Observe the S, I, R curves as the epidemic progresses",
      "Find the threshold: epidemic occurs only if R₀ = β/γ > 1",
      "Explore herd immunity: what fraction must be vaccinated to prevent spread?",
      "Observe the 'flattening the curve' effect of reducing β",
    ],
    insight: "R₀ = β/γ — if R₀ > 1, the epidemic spreads; if R₀ < 1, it dies out. Herd immunity requires 1 − 1/R₀ of the population to be immune. Reducing β (contact rate) flattens the curve without changing R₀ immediately.",
    topic: "SIR epidemic model: susceptible, infected, recovered vs time, adjustable transmission rate beta and recovery rate gamma",
  },
  {
    id: "predator-prey", title: "Predator-Prey Model", subtitle: "Lotka-Volterra Cycles",
    category: "Diff. Equations", catColor: "#a78bfa", difficulty: "Advanced",
    subjects: ["Diff. Equations", "Calculus"],
    description: "Watch rabbit and fox populations oscillate in perpetual cycles.",
    scenario: "A wildlife park is managing rabbit and fox populations. The ecologist observes that whenever foxes peak, rabbits crash — then foxes crash too. Is this mathematically inevitable?",
    objectives: [
      "Observe the cyclical oscillation of both populations",
      "Note that predator peaks lag prey peaks",
      "Change prey growth rate — how does cycle period change?",
      "Find equilibrium: when do both populations stay constant?",
    ],
    insight: "The Lotka-Volterra cycles are perpetual oscillations with no stable equilibrium — both species influence each other's growth. Equilibrium is (γ/δ, α/β). Real ecosystems have dampening, but the model captures the core dynamic seen in real lynx-hare data.",
    topic: "Lotka-Volterra predator-prey model: population oscillations vs time, adjustable growth and predation rates",
  },
  {
    id: "logistic-growth", title: "Logistic Population Growth", subtitle: "Carrying Capacity & S-Curve",
    category: "Diff. Equations", catColor: "#a78bfa", difficulty: "Intermediate",
    subjects: ["Diff. Equations", "Calculus"],
    description: "See how resource limits turn exponential growth into an S-shaped curve.",
    scenario: "A marine biologist is modelling fish population recovery in a protected zone. The zone supports a maximum of 50,000 fish. How fast does the population recover from near-extinction?",
    objectives: [
      "Compare the S-curve to pure exponential growth",
      "Find the inflection point: where growth rate is maximum",
      "Observe that the population always converges to K (carrying capacity)",
      "Explore how changing r (intrinsic growth) affects recovery speed",
    ],
    insight: "P(t) = K/(1+((K−P₀)/P₀)e^(−rt)) — growth is fastest at P = K/2 (inflection point). The carrying capacity K is a stable equilibrium. This S-curve governs technology adoption, tumour growth, and species recovery.",
    topic: "Logistic population growth: S-curve population vs time, adjustable carrying capacity K and intrinsic growth rate r",
  },
  // ── Waves ──
  {
    id: "wave-superposition", title: "Wave Superposition", subtitle: "Interference & Beats",
    category: "Waves", catColor: "#f43f5e", difficulty: "Intermediate",
    subjects: ["Trigonometry", "Calculus"],
    description: "Add two waves and observe constructive/destructive interference and beat frequency.",
    scenario: "A piano tuner is tuning A₄ (440 Hz) against a reference fork. They hear a 'wow-wow' beat at 3 Hz. By which direction should they tune the string?",
    objectives: [
      "Set identical frequencies — observe pure constructive interference",
      "Slightly detune one wave — observe the beat frequency emerge",
      "Set frequency difference to 0 Hz — beat disappears",
      "Change relative phase to 180° — observe destructive interference",
    ],
    insight: "y = A₁sin(2πf₁t) + A₂sin(2πf₂t) — when two close frequencies combine, the result has a slowly varying envelope at the beat frequency f_beat = |f₁ − f₂|. This is the physical basis of musical tuning and amplitude modulation (AM radio).",
    topic: "Wave superposition and interference: two sinusoidal waves, adjustable frequencies and amplitudes, beat frequency",
  },
  {
    id: "damped-oscillator", title: "Damped Oscillator", subtitle: "Underdamped, Critical & Overdamped",
    category: "Waves", catColor: "#f43f5e", difficulty: "Advanced",
    subjects: ["Diff. Equations", "Calculus"],
    description: "Tune the damping coefficient and transition between oscillation regimes.",
    scenario: "An automotive engineer is calibrating shock absorbers. Underdamping causes bouncing; overdamping makes the car sluggish. Find the sweet spot: critical damping.",
    objectives: [
      "Set low damping (ζ < 1) — observe oscillating decay",
      "Increase to ζ = 1 (critical damping) — observe fastest non-oscillating return",
      "Increase further (ζ > 1) — observe sluggish overdamped return",
      "Measure how long each regime takes to settle to < 5% of initial displacement",
    ],
    insight: "x(t) = Ae^(−ζωₙt)cos(ωₙ√(1−ζ²)t+φ) — the three regimes (ζ<1, ζ=1, ζ>1) represent qualitatively different behaviours. Critical damping (ζ=1) returns to equilibrium fastest without oscillating, which is why it's preferred in door closers, car suspensions, and galvanometers.",
    topic: "Damped harmonic oscillator: amplitude vs time, adjustable damping ratio zeta (underdamped, critical, overdamped)",
  },
  // ── Engineering ──
  {
    id: "rc-circuit", title: "RC Circuit", subtitle: "Charging, Discharging & Time Constant",
    category: "Engineering", catColor: "#60a5fa", difficulty: "Intermediate",
    subjects: ["Diff. Equations", "Calculus"],
    description: "Explore how resistance R and capacitance C set the charging time constant τ.",
    scenario: "You're designing a camera flash circuit. The capacitor must charge to 90% of full voltage within 2 seconds. What R and C values do you need?",
    objectives: [
      "Observe the characteristic exponential charging curve",
      "Find the time constant τ = RC (time to reach 63.2% of V_max)",
      "Calculate time to 90%: t = 2.3τ",
      "Explore how increasing R or C slows charging",
    ],
    insight: "V(t) = V₀(1 − e^(−t/RC)) — τ = RC is the time constant. At t = τ, the capacitor is at 63.2%; at t = 5τ, it's at 99.3%. This exponential response is universal in first-order systems: also seen in thermal systems, fluid tanks, and pharmacokinetics.",
    topic: "RC circuit charging and discharging: capacitor voltage vs time, adjustable resistance R and capacitance C, time constant tau",
  },
  {
    id: "fourier-series", title: "Fourier Series Builder", subtitle: "Harmonics & Waveform Synthesis",
    category: "Engineering", catColor: "#60a5fa", difficulty: "Advanced",
    subjects: ["Calculus", "Trigonometry"],
    description: "Build a square wave from sine harmonics and see Gibbs phenomenon.",
    scenario: "An audio engineer is digitally synthesising a clarinet sound. Clarinets are rich in odd harmonics. How many harmonics does it take before the waveform sounds 'right'?",
    objectives: [
      "Start with 1 harmonic (fundamental) — smooth sine wave",
      "Add harmonics 3, 5, 7 — watch the square wave emerge",
      "Observe the Gibbs overshoot at the discontinuities",
      "Count how many harmonics are needed for <5% ripple",
    ],
    insight: "f(t) = Σ (4/nπ)sin(nωt) for odd n — any periodic signal can be decomposed into sine and cosine harmonics. This is the mathematical foundation of audio compression (MP3), signal processing, and image compression (JPEG).",
    topic: "Fourier series approximation of square wave: harmonic number N vs waveform accuracy, Gibbs phenomenon",
  },
  {
    id: "power-law", title: "Power Law Scaling", subtitle: "Linear vs Quadratic vs Cubic",
    category: "Engineering", catColor: "#60a5fa", difficulty: "Beginner",
    subjects: ["Algebra", "Calculus"],
    description: "Compare how different power laws scale and why the exponent matters so much.",
    scenario: "An engineer scales up a chemical reactor by a factor of 10. Surface area scales as r², volume as r³. This 'square-cube law' means cooling capacity falls behind heat generation. Why does every large thing overheat?",
    objectives: [
      "Compare y = x, x², x³ on the same plot",
      "Observe how quickly higher powers overtake lower powers",
      "Test log-log scale: power laws appear as straight lines",
      "Find the crossover point where x² > 10x",
    ],
    insight: "y = xⁿ — the exponent n determines qualitative behaviour. Biological metabolic rate scales as mass^(3/4) (Kleiber's law), not mass^1. The square-cube law explains why insects can't be the size of elephants, and why cities scale differently to villages.",
    topic: "Power law scaling: y = x^n for different exponents n, linear vs log-log scale comparison",
  },
];

const CATEGORIES = ["All", "Mechanics", "Calculus", "Statistics", "Diff. Equations", "Waves", "Engineering"];
const CAT_COLORS: Record<string, string> = {
  All: "#94a3b8", Mechanics: "#22d3ee", Calculus: "#fbbf24",
  Statistics: "#34d399", "Diff. Equations": "#a78bfa", Waves: "#f43f5e", Engineering: "#60a5fa",
};
const DIFF_COLORS = { Beginner: "#34d399", Intermediate: "#fbbf24", Advanced: "#f87171" };

// ── Lab Environment ───────────────────────────────────────────────────────────

function LabEnvironment({ lab, onBack }: { lab: LabConfig; onBack: () => void }) {
  const [sim, setSim] = useState<SimulateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, number>>({});
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState("");
  const [insightVisible, setInsightVisible] = useState(false);
  const accent = CAT_COLORS[lab.category] ?? "#10b981";

  const loadSim = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await mathApi.simulate({
        topic: lab.topic, subject: "general", level: "university",
        curriculum: "general", model_name: "gpt-4o",
      });
      setSim(data);
      const defaults: Record<string, number> = {};
      data.parameters?.forEach((p: SimParam) => { defaults[p.name] = p.default; });
      setParams(defaults);
    } catch {
      setError("Failed to load simulation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => { loadSim(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const plotData = useMemo(() => {
    if (!sim?.expression) return null;
    try {
      const xMin = sim.x_range?.[0] ?? -10;
      const xMax = sim.x_range?.[1] ?? 10;
      return sampleWithParams(sim.expression, xMin, xMax, params, 400);
    } catch { return null; }
  }, [sim, params]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto animate-slide-up">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-2 mb-6 text-xs transition-opacity hover:opacity-80"
        style={{ color: "#475569" }}>
        <ArrowLeft className="w-3.5 h-3.5" />Back to Lab Catalog
      </button>

      {/* Lab header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Microscope className="w-6 h-6" style={{ color: accent }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
              {lab.category}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: `${DIFF_COLORS[lab.difficulty]}18`, color: DIFF_COLORS[lab.difficulty], border: `1px solid ${DIFF_COLORS[lab.difficulty]}30` }}>
              {lab.difficulty}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: "#f1f5f9" }}>{lab.title}</h1>
          <p className="text-sm" style={{ color: "#475569" }}>{lab.subtitle}</p>
        </div>
        <button onClick={loadSim} disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#64748b" }}>
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />Reload
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: Lab Guide ── */}
        <div className="space-y-5">
          {/* Scenario */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>Scenario</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#94a3b8" }}>{lab.scenario}</p>
          </div>

          {/* Objectives */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>Lab Objectives</span>
            </div>
            <div className="space-y-2.5">
              {lab.objectives.map((obj, i) => (
                <button key={i} onClick={() => setChecked(prev => ({ ...prev, [i]: !prev[i] }))}
                  className="flex items-start gap-2.5 w-full text-left transition-opacity hover:opacity-80">
                  {checked[i]
                    ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: accent }} />
                    : <Circle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#334155" }} />}
                  <span className="text-xs leading-relaxed" style={{ color: checked[i] ? accent : "#64748b", textDecoration: checked[i] ? "line-through" : "none" }}>
                    {obj}
                  </span>
                </button>
              ))}
            </div>
            {Object.values(checked).filter(Boolean).length === lab.objectives.length && lab.objectives.length > 0 && (
              <p className="text-[10px] mt-3 font-semibold text-center" style={{ color: accent }}>
                ✦ All objectives complete!
              </p>
            )}
          </div>

          {/* Insight reveal */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}25` }}>
            <button
              onClick={() => setInsightVisible(!insightVisible)}
              className="w-full flex items-center gap-2 px-5 py-3 transition-opacity hover:opacity-80"
              style={{ background: `${accent}10` }}>
              <Lightbulb className="w-3.5 h-3.5" style={{ color: accent }} />
              <span className="text-[10px] font-semibold uppercase tracking-widest flex-1 text-left" style={{ color: accent }}>
                {insightVisible ? "Hide Insight" : "Reveal Mathematical Insight"}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${insightVisible ? "rotate-180" : ""}`} style={{ color: accent }} />
            </button>
            {insightVisible && (
              <div className="px-5 pb-4 pt-3" style={{ background: `${accent}06` }}>
                <p className="text-xs leading-relaxed font-mono" style={{ color: "#94a3b8" }}>{lab.insight}</p>
                {sim?.key_insight && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${accent}15` }}>
                    <MathOutput content={sim.key_insight} className="text-xs [&_p]:mb-0 [&_p]:text-xs" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Center + Right: Simulation ── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Simulation chart */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>
                Interactive Simulation
              </span>
              {loading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: accent }} />}
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.20)" }}>
                {error}
              </div>
            )}

            {loading && !error && (
              <div className="h-64 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
            )}

            {sim && plotData && !loading && (
              <>
                {/* Expression */}
                {sim.expression && (
                  <div className="mb-4 p-3 rounded-xl text-center text-sm font-mono"
                    style={{ background: `${accent}08`, border: `1px solid ${accent}18`, color: "#f1f5f9" }}>
                    {sim.expression}
                  </div>
                )}

                {/* Plot */}
                <div className="w-full rounded-xl overflow-hidden mb-4" style={{ background: "#0d1117" }}>
                  <Plot
                    data={[{
                      x: plotData.x, y: plotData.y, type: "scatter", mode: "lines",
                      line: { color: accent, width: 2.5 },
                      fill: "tozeroy", fillcolor: `${accent}10`,
                    }]}
                    layout={{
                      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
                      margin: { t: 10, b: 48, l: 56, r: 16 },
                      height: 260,
                      xaxis: { title: { text: "x", font: { color: "#475569", size: 11 } }, color: "#475569", gridcolor: "rgba(255,255,255,0.05)", zerolinecolor: "rgba(255,255,255,0.08)" },
                      yaxis: { title: { text: sim.y_label ?? "y", font: { color: "#475569", size: 11 } }, color: "#475569", gridcolor: "rgba(255,255,255,0.05)", zerolinecolor: "rgba(255,255,255,0.08)" },
                      font: { color: "#94a3b8", size: 11 },
                    }}
                    config={{ responsive: true, displayModeBar: false }}
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Sliders */}
                {sim.parameters && sim.parameters.length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {sim.parameters.map((p: SimParam) => (
                      <div key={p.name}>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-[11px] font-semibold" style={{ color: "#64748b" }}>
                            {p.label}
                          </label>
                          <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                            style={{ background: `${accent}14`, color: accent }}>
                            {(params[p.name] ?? p.default)?.toFixed(2)}
                          </span>
                        </div>
                        <input type="range"
                          min={p.min} max={p.max} step={p.step ?? (p.max - p.min) / 100}
                          value={params[p.name] ?? p.default ?? p.min}
                          onChange={e => setParams(prev => ({ ...prev, [p.name]: parseFloat(e.target.value) }))}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: accent }}
                        />
                        <div className="flex justify-between text-[9px] mt-0.5" style={{ color: "#334155" }}>
                          <span>{p.min}</span><span>{p.max}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Lab Notebook */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#334155" }}>Lab Notebook</span>
              <span className="text-[9px]" style={{ color: "#334155" }}>— record your observations</span>
            </div>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`e.g. When I doubled L from 1m to 2m, the period increased from ___ to ___.\nThe relationship looks like a ________ function.\nOn the Moon (g=1.6), T would be ___...`}
              className="input-dark w-full resize-none text-xs leading-relaxed font-mono"
              style={{ minHeight: "100px" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lab Catalog ───────────────────────────────────────────────────────────────

function LabCard({ lab, onLaunch }: { lab: LabConfig; onLaunch: () => void }) {
  const accent = CAT_COLORS[lab.category] ?? "#10b981";
  return (
    <div className="rounded-2xl p-5 flex flex-col transition-all duration-200 group"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = `${accent}40`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 20px ${accent}12`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}>
      {/* Category + difficulty */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
          {lab.category}
        </span>
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: `${DIFF_COLORS[lab.difficulty]}15`, color: DIFF_COLORS[lab.difficulty], border: `1px solid ${DIFF_COLORS[lab.difficulty]}28` }}>
          {lab.difficulty}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-bold text-sm mb-0.5" style={{ color: "#f1f5f9" }}>{lab.title}</h3>
      <p className="text-[11px] mb-2" style={{ color: accent }}>{lab.subtitle}</p>
      <p className="text-xs leading-relaxed flex-1 mb-4" style={{ color: "#475569" }}>{lab.description}</p>

      {/* Subject tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {lab.subjects.map(s => (
          <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(255,255,255,0.05)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)" }}>
            {s}
          </span>
        ))}
      </div>

      {/* Launch button */}
      <button onClick={onLaunch}
        className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
        style={{ background: `${accent}15`, border: `1px solid ${accent}28`, color: accent }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${accent}25`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${accent}15`; }}>
        <FlaskConical className="w-3.5 h-3.5" />
        Launch Lab
        <ChevronRight className="w-3 h-3 opacity-70 group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const [selectedCat, setSelectedCat] = useState("All");
  const [activeLab, setActiveLab] = useState<LabConfig | null>(null);
  const [customTopic, setCustomTopic] = useState("");

  const filtered = selectedCat === "All" ? LABS : LABS.filter(l => l.category === selectedCat);

  const handleCustomLab = () => {
    if (!customTopic.trim()) return;
    const custom: LabConfig = {
      id: "custom",
      title: customTopic.trim(),
      subtitle: "AI-Generated Lab",
      category: "Custom",
      catColor: "#10b981",
      difficulty: "Intermediate",
      subjects: ["Mathematics"],
      description: "A custom lab environment generated by AI for your chosen topic.",
      scenario: `Explore the mathematics of ${customTopic.trim()} through interactive simulation.`,
      objectives: [
        "Adjust the parameters and observe how the output changes",
        "Identify the key mathematical relationship",
        "Find the values that produce interesting or extreme behaviour",
        "Formulate a hypothesis and test it",
      ],
      insight: "Reveal the simulation to discover the mathematical insight.",
      topic: customTopic.trim(),
    };
    setActiveLab(custom);
  };

  if (activeLab) {
    return <LabEnvironment lab={activeLab} onBack={() => setActiveLab(null)} />;
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <Microscope className="w-4 h-4" style={{ color: "#10b981" }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#10b981" }}>
            Experiential Intelligence™
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
            style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
            Premium
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-1.5" style={{ color: "#f1f5f9" }}>
          Virtual Math Lab™
        </h1>
        <p className="text-sm" style={{ color: "#475569" }}>
          Hands-on mathematical discovery — curated lab environments with guided objectives, interactive simulations, and insight reveals.
        </p>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {CATEGORIES.map(cat => {
          const active = selectedCat === cat;
          const color = CAT_COLORS[cat];
          return (
            <button key={cat} onClick={() => setSelectedCat(cat)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold transition-all"
              style={{
                background: active ? `${color}20` : "rgba(255,255,255,0.04)",
                border: active ? `1px solid ${color}45` : "1px solid rgba(255,255,255,0.08)",
                color: active ? color : "#475569",
              }}>
              {cat}
              <span className="ml-1.5 text-[9px] opacity-60">
                {cat === "All" ? LABS.length : LABS.filter(l => l.category === cat).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lab grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
        {filtered.map(lab => (
          <LabCard key={lab.id} lab={lab} onLaunch={() => setActiveLab(lab)} />
        ))}
      </div>

      {/* AI Custom Lab Builder */}
      <div className="rounded-2xl p-6"
        style={{ background: "var(--bg-surface)", border: "1px solid rgba(16,185,129,0.18)" }}>
        <div className="flex items-center gap-2.5 mb-4">
          <Sparkles className="w-4 h-4" style={{ color: "#10b981" }} />
          <h2 className="font-bold text-sm" style={{ color: "#f1f5f9" }}>Build a Custom Lab with AI</h2>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(16,185,129,0.10)", color: "#10b981", border: "1px solid rgba(16,185,129,0.22)" }}>
            Any Topic
          </span>
        </div>
        <p className="text-xs mb-4" style={{ color: "#475569" }}>
          Don't see your topic? Describe any mathematical concept and AI will build an interactive lab for it.
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={customTopic}
            onChange={e => setCustomTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCustomLab()}
            placeholder="e.g. Bézier Curves, Mandelbrot Set, Black-Scholes Equation, Navier-Stokes Flow…"
            className="input-dark flex-1 py-2.5 text-sm"
          />
          <button
            onClick={handleCustomLab}
            disabled={!customTopic.trim()}
            className="btn-primary px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}>
            <FlaskConical className="w-4 h-4" />Build Lab
          </button>
        </div>
      </div>
    </div>
  );
}
