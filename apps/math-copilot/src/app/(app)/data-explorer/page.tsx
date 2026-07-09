"use client";
import { useState, useCallback, useEffect } from "react";
import {
  Database, Download, TrendingUp, BarChart2, Send,
  ChevronDown, Lightbulb, Activity, Globe, Landmark, CloudSun, Lock, Satellite, HeartPulse,
} from "lucide-react";
import {
  dataApi,
  type DataPoint as RealDataPoint,
  type DataResult as FetchDataResponse,
} from "@/lib/api";

// Local types not in api.ts
interface AnalyzeDataResponse { analysis: string; math_connection?: string; key_insight?: string; insights?: string[]; summary?: string; }
interface SourceIndicator { id: string; label: string; unit?: string; }
interface DataSource { id: string; key?: string; label: string; icon?: string; description?: string; proOnly?: boolean; available?: boolean; key_env?: string; indicators: SourceIndicator[]; countries?: Array<{code: string; name: string}>; cities?: Array<{id: string; name: string}>; }

const ACCENT = "#06b6d4";

const MODELS = [
  { key: "gpt-4o",          label: "GPT-4o" },
  { key: "gpt-4o-mini",     label: "GPT-4o Mini" },
  { key: "claude-sonnet-4", label: "Claude Sonnet" },
  { key: "claude-haiku-4",  label: "Claude Haiku" },
];

const SUBJECTS = [
  { key: "statistics",   label: "Statistics" },
  { key: "algebra",      label: "Algebra" },
  { key: "calculus",     label: "Calculus" },
  { key: "data_science", label: "Data Science" },
];

const SOURCE_ICONS: Record<string, React.ElementType> = {
  world_bank: Globe,
  imf:        Landmark,
  open_meteo: CloudSun,
  nasa_power: Satellite,
  who:        HeartPulse,
};

const SOURCE_COLORS: Record<string, string> = {
  world_bank: "#06b6d4",
  imf:        "#f59e0b",  // IMF amber (same slot as FRED was)
  open_meteo: "#34d399",
  nasa_power: "#f97316",
  who:        "#e879f9",
};

// ── SVG Line Chart ─────────────────────────────────────────────────────────────

function DataChart({
  data,
  regression,
  accent,
}: {
  data: RealDataPoint[];
  regression: Record<string, number>;
  accent: string;
}) {
  if (!data.length) return null;
  const W = 640, H = 200;
  const PAD = { left: 58, right: 18, top: 16, bottom: 36 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const values = data.map(d => d.value);
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const vRange = vMax - vMin || 1;

  const toX = (i: number) => PAD.left + (i / Math.max(data.length - 1, 1)) * cw;
  const toY = (v: number) => PAD.top + ch - ((v - vMin) / vRange) * ch;
  const clampY = (y: number) => Math.max(PAD.top, Math.min(PAD.top + ch, y));

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`)
    .join(" ");

  const slope = regression.slope ?? 0;
  const intercept = regression.intercept ?? 0;
  const rY0 = slope * 0 + intercept;
  const rY1 = slope * (data.length - 1) + intercept;

  const yTicks = Array.from({ length: 5 }, (_, i) => vMin + (vRange / 4) * i);
  const step = Math.max(1, Math.ceil(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ fontFamily: "sans-serif" }}>
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={toY(v)} x2={W - PAD.right} y2={toY(v)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={PAD.left - 5} y={toY(v) + 3.5} textAnchor="end" fill="#334155" fontSize="9">
            {Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1)}
          </text>
        </g>
      ))}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ch} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + ch} x2={W - PAD.right} y2={PAD.top + ch} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {data.filter((_, i) => i % step === 0 || i === data.length - 1).map((d, idx) => {
        const originalIndex = data.indexOf(d);
        return (
          <text key={idx} x={toX(originalIndex)} y={PAD.top + ch + 14} textAnchor="middle" fill="#334155" fontSize="9">
            {d.label}
          </text>
        );
      })}
      {/* Area */}
      <path
        d={`${linePath} L${toX(data.length - 1)},${PAD.top + ch} L${toX(0)},${PAD.top + ch} Z`}
        fill={`${accent}10`} stroke="none"
      />
      {/* Regression */}
      <line
        x1={toX(0)} y1={clampY(toY(rY0))}
        x2={toX(data.length - 1)} y2={clampY(toY(rY1))}
        stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.55"
      />
      {/* Line */}
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      {/* Points */}
      {data.map((d, i) => (
        <circle key={i} cx={toX(i)} cy={toY(d.value)} r="2.5" fill={accent} />
      ))}
    </svg>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, unit }: { label: string; value: number; unit?: string }) {
  const display = Math.abs(value) >= 10000
    ? value.toExponential(2)
    : value.toFixed(Math.abs(value) < 10 ? 3 : 2);
  return (
    <div className="rounded-xl p-3.5 flex flex-col gap-1"
      style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#334155" }}>{label}</span>
      <span className="text-lg font-bold" style={{ color: "#f1f5f9" }}>{display}</span>
      <span className="text-[10px]" style={{ color: "#475569" }}>{unit}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DataExplorerPage() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [activeSource, setActiveSource] = useState("world_bank");
  const [indicator, setIndicator] = useState("");
  const [country, setCountry] = useState("US");       // World Bank alpha-2
  const [whoCountry, setWhoCountry] = useState("USA"); // WHO alpha-3
  const [city, setCity] = useState("new_york");
  const [years, setYears] = useState(20);
  const [subject, setSubject] = useState("statistics");
  const [modelName, setModelName] = useState("gpt-4o");

  const [dataset, setDataset] = useState<FetchDataResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeDataResponse | null>(null);
  const [question, setQuestion] = useState("");

  const [fetchLoading, setFetchLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Static source catalog (no backend catalog endpoint needed)
  useEffect(() => {
    const CATALOG: DataSource[] = [
      { id: "world_bank", label: "World Bank", available: true, description: "World Bank Open Data — macro-economic indicators for 200+ countries", indicators: [
        { id: "NY.GDP.MKTP.CD", label: "GDP (current US$)", unit: "USD" },
        { id: "SP.POP.TOTL",    label: "Population",        unit: "people" },
        { id: "FP.CPI.TOTL.ZG", label: "Inflation (CPI %)",unit: "%" },
        { id: "SL.UEM.TOTL.ZS", label: "Unemployment (%)", unit: "%" },
        { id: "SE.XPD.TOTL.GD.ZS", label: "Education Spend (% GDP)", unit: "%" },
      ], countries: [
        { code: "US", name: "United States" }, { code: "GB", name: "United Kingdom" },
        { code: "DE", name: "Germany" }, { code: "FR", name: "France" },
        { code: "CN", name: "China" }, { code: "JP", name: "Japan" },
        { code: "IN", name: "India" }, { code: "BR", name: "Brazil" },
        { code: "CA", name: "Canada" }, { code: "AU", name: "Australia" },
      ]},
      { id: "imf", label: "IMF", available: true, description: "IMF World Economic Outlook — global macro forecasts and statistics", indicators: [
        { id: "NGDP_RPCH", label: "Real GDP Growth (%)", unit: "%" },
        { id: "PCPIPCH",   label: "Inflation (%)",       unit: "%" },
        { id: "LUR",       label: "Unemployment (%)",    unit: "%" },
        { id: "BCA_NGDPD", label: "Current Account (% GDP)", unit: "%" },
      ], countries: [
        { code: "USA", name: "United States" }, { code: "GBR", name: "United Kingdom" },
        { code: "DEU", name: "Germany" }, { code: "FRA", name: "France" },
        { code: "CHN", name: "China" }, { code: "JPN", name: "Japan" },
        { code: "IND", name: "India" }, { code: "BRA", name: "Brazil" },
      ]},
      { id: "open_meteo", label: "Open-Meteo", available: true, description: "Open-Meteo — free open-source weather API with historical climate data", indicators: [
        { id: "temperature_2m_mean", label: "Mean Temperature (°C)", unit: "°C" },
        { id: "precipitation_sum",   label: "Precipitation (mm)",   unit: "mm" },
        { id: "windspeed_10m_max",   label: "Max Wind Speed (km/h)", unit: "km/h" },
      ], cities: [
        { id: "new_york", name: "New York" }, { id: "london", name: "London" },
        { id: "paris", name: "Paris" }, { id: "tokyo", name: "Tokyo" },
        { id: "sydney", name: "Sydney" }, { id: "dubai", name: "Dubai" },
      ]},
      { id: "nasa_power", label: "NASA POWER", available: true, description: "NASA POWER — satellite-derived meteorological and solar energy data", indicators: [
        { id: "T2M",   label: "Temperature 2m (°C)", unit: "°C" },
        { id: "PRECTOT", label: "Precipitation (mm/day)", unit: "mm/day" },
        { id: "ALLSKY_SFC_SW_DWN", label: "Solar Irradiance", unit: "W/m²" },
      ], cities: [
        { id: "new_york", name: "New York" }, { id: "london", name: "London" },
        { id: "paris", name: "Paris" }, { id: "tokyo", name: "Tokyo" },
        { id: "sydney", name: "Sydney" }, { id: "dubai", name: "Dubai" },
      ]},
      { id: "who", label: "WHO", available: true, description: "WHO Global Health Observatory — global health statistics and indicators", indicators: [
        { id: "MDG_0000000001", label: "Under-5 Mortality (per 1000)", unit: "/1000" },
        { id: "WHOSIS_000001",  label: "Life Expectancy (years)",       unit: "years" },
        { id: "SA_0000001544",  label: "Alcohol Consumption (L/year)", unit: "L/yr" },
      ], countries: [
        { code: "USA", name: "United States" }, { code: "GBR", name: "United Kingdom" },
        { code: "DEU", name: "Germany" }, { code: "FRA", name: "France" },
        { code: "CHN", name: "China" }, { code: "JPN", name: "Japan" },
        { code: "IND", name: "India" }, { code: "BRA", name: "Brazil" },
      ]},
    ];
    setSources(CATALOG);
    const wb = CATALOG.find(s => s.id === "world_bank");
    if (wb?.indicators?.[0]) setIndicator(wb.indicators[0].id);
  }, []);

  // Reset indicator when source changes
  const switchSource = (sourceId: string) => {
    setActiveSource(sourceId);
    setDataset(null);
    setAnalysis(null);
    setFetchError(null);
    const src = sources.find(s => s.id === sourceId);
    if (src?.indicators?.[0]) setIndicator(src.indicators[0].id);
  };

  const currentSource = sources.find(s => s.id === activeSource);
  const accent = SOURCE_COLORS[activeSource] ?? ACCENT;

  const loadData = useCallback(async () => {
    if (!indicator) return;
    setFetchError(null);
    setDataset(null);
    setAnalysis(null);
    setFetchLoading(true);
    try {
      const { data } = await dataApi.fetch({
        source: activeSource,
        indicator,
        country: (activeSource === "who" || activeSource === "imf") ? whoCountry : country,
        city,
        years,
      });
      setDataset(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Failed to fetch data. Please try again.";
      setFetchError(msg);
    } finally {
      setFetchLoading(false);
    }
  }, [activeSource, indicator, country, whoCountry, city, years]);

  const runAnalysis = useCallback(async () => {
    if (!dataset || !question.trim()) return;
    setAnalyzeError(null);
    setAnalysis(null);
    setAnalyzeLoading(true);
    try {
      const { data } = await dataApi.analyze({
        source: dataset.source,
        indicator_name: dataset.indicator_name,
        location: dataset.location,
        unit: dataset.unit,
        data: dataset.data,
        question: question.trim(),
        subject,
        model_name: modelName,
      });
      setAnalysis(data);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        || "Analysis failed. Please try again.";
      setAnalyzeError(msg);
    } finally {
      setAnalyzeLoading(false);
    }
  }, [dataset, question, subject, modelName]);

  const r2 = dataset?.regression?.r_squared ?? 0;
  const r2Color = r2 >= 0.8 ? "#34d399" : r2 >= 0.5 ? "#fbbf24" : "#f87171";

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}28` }}>
            <Database className="w-4 h-4" style={{ color: ACCENT }} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
            Real Data Mathematics
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2" style={{ color: "#f1f5f9" }}>
          Data Explorer™
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
          Load live datasets from five global sources, compute descriptive statistics and linear regression,
          then ask the AI to explain the mathematics behind the trends.
        </p>
      </div>

      {/* Source tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {sources.map(src => {
          const Icon = SOURCE_ICONS[src.id] ?? Database;
          const color = SOURCE_COLORS[src.id] ?? ACCENT;
          const active = activeSource === src.id;
          return (
            <button
              key={src.id}
              onClick={() => src.available && switchSource(src.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all relative"
              style={{
                background: active ? `${color}18` : "var(--bg-surface)",
                border: `1px solid ${active ? `${color}40` : "rgba(255,255,255,0.06)"}`,
                color: active ? color : src.available ? "#64748b" : "#334155",
                cursor: src.available ? "pointer" : "not-allowed",
                opacity: src.available ? 1 : 0.55,
              }}>
              <Icon className="w-3.5 h-3.5" />
              {src.label}
              {!src.available && (
                <span className="flex items-center gap-0.5 text-[9px] ml-1 px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#475569", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Lock className="w-2 h-2" />KEY
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Source description + key hint */}
      {currentSource && (
        <div className="rounded-xl px-4 py-3 mb-5 text-xs leading-relaxed"
          style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
          <span style={{ color: accent }}>{currentSource.label}</span>
          <span style={{ color: "#475569" }}> — {currentSource.description}</span>
          {!currentSource.available && currentSource.key_env && (
            <span style={{ color: "#f87171" }}>
              {" "}Requires <code className="font-mono">{currentSource.key_env}</code> in Railway environment variables.
              Free key at <a href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>fred.stlouisfed.org</a>
            </span>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: "#334155" }}>
          Dataset Selection
        </p>

        <div className="grid sm:grid-cols-3 gap-4 mb-4">
          {/* Indicator/Series/Variable */}
          <div className="sm:col-span-1">
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
              {activeSource === "imf" ? "Indicator" : activeSource === "open_meteo" ? "Variable" : activeSource === "nasa_power" ? "Parameter" : activeSource === "who" ? "Health Indicator" : "Indicator"}
            </label>
            <div className="relative">
              <select value={indicator} onChange={e => setIndicator(e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-xs appearance-none outline-none pr-7"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                {(currentSource?.indicators ?? []).map(ind => (
                  <option key={ind.id} value={ind.id}>{ind.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
            </div>
          </div>

          {/* Country (World Bank / WHO) or City (Open-Meteo / NASA) or blank (FRED) */}
          {activeSource === "world_bank" && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
                Country
              </label>
              <div className="relative">
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs appearance-none outline-none pr-7"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                  {(currentSource?.countries ?? []).map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
              </div>
            </div>
          )}

          {activeSource === "who" && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
                Country
              </label>
              <div className="relative">
                <select value={whoCountry} onChange={e => setWhoCountry(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs appearance-none outline-none pr-7"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                  {(currentSource?.countries ?? []).map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
              </div>
            </div>
          )}

          {(activeSource === "open_meteo" || activeSource === "nasa_power") && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
                City
              </label>
              <div className="relative">
                <select value={city} onChange={e => setCity(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs appearance-none outline-none pr-7"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                  {(currentSource?.cities ?? []).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
              </div>
            </div>
          )}

          {activeSource === "imf" && (
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
                Country
              </label>
              <div className="relative">
                <select value={whoCountry} onChange={e => setWhoCountry(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-xs appearance-none outline-none pr-7"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                  {(currentSource?.countries ?? []).map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
              </div>
            </div>
          )}

          {/* Years */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
              Years of data — {years}
            </label>
            <input type="range" min={5} max={activeSource === "open_meteo" ? 30 : activeSource === "nasa_power" ? 40 : 40} step={5}
              value={years} onChange={e => setYears(Number(e.target.value))}
              className="w-full mt-1.5" style={{ accentColor: accent }} />
          </div>
        </div>

        {fetchError && (
          <div className="rounded-xl px-4 py-2.5 mb-4 text-xs"
            style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
            {fetchError}
          </div>
        )}

        <button
          onClick={loadData}
          disabled={fetchLoading || !currentSource?.available}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}35`,
            color: accent,
            cursor: fetchLoading || !currentSource?.available ? "not-allowed" : "pointer",
            opacity: fetchLoading || !currentSource?.available ? 0.6 : 1,
          }}>
          {fetchLoading
            ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            : <Download className="w-4 h-4" />}
          {fetchLoading ? "Loading data…" : "Load Dataset"}
        </button>
      </div>

      {/* Results */}
      {dataset && (
        <>
          {/* Chart */}
          <div className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{dataset.indicator_name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#475569" }}>
                  {dataset.location} · {dataset.unit} · {dataset.data.length} annual data points
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <span className="flex items-center gap-1" style={{ color: accent }}>
                  <span className="inline-block w-8 h-0.5 rounded" style={{ background: accent }} />Actual
                </span>
                <span className="flex items-center gap-1" style={{ color: "#22d3ee" }}>
                  <span className="inline-block w-8" style={{ borderTop: "1.5px dashed #22d3ee" }} />Trend
                </span>
              </div>
            </div>
            <DataChart data={dataset.data} regression={dataset.regression} accent={accent} />
          </div>

          {/* Stats + Regression */}
          <div className="grid sm:grid-cols-2 gap-5 mb-5">
            {/* Stats */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4" style={{ color: accent }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
                  Descriptive Statistics
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <StatCard label="Mean"   value={dataset.stats.mean}   unit={dataset.unit} />
                <StatCard label="Median" value={dataset.stats.median} unit={dataset.unit} />
                <StatCard label="Std Dev" value={dataset.stats.std}   unit={dataset.unit} />
                <StatCard label="Min"    value={dataset.stats.min}    unit={dataset.unit} />
                <StatCard label="Max"    value={dataset.stats.max}    unit={dataset.unit} />
                <StatCard label="Count"  value={dataset.stats.count}  unit="years" />
              </div>
            </div>

            {/* Regression */}
            <div className="rounded-2xl p-5"
              style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4" style={{ color: "#22d3ee" }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#22d3ee" }}>
                  Linear Regression
                </p>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.12)" }}>
                  <p className="text-[10px] mb-1" style={{ color: "#334155" }}>Regression Equation</p>
                  <p className="text-sm font-mono font-semibold" style={{ color: "#22d3ee" }}>
                    y = {dataset.regression.slope.toFixed(4)}x + {dataset.regression.intercept.toFixed(3)}
                  </p>
                </div>
                <div className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold" style={{ color: "#475569" }}>R² (Goodness of Fit)</p>
                    <p className="text-sm font-bold" style={{ color: r2Color }}>{(r2 * 100).toFixed(1)}%</p>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-1.5 rounded-full transition-all duration-700"
                      style={{ width: `${r2 * 100}%`, background: r2Color }} />
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: "#334155" }}>
                    {r2 >= 0.8 ? "Strong fit — linear model explains the trend well"
                      : r2 >= 0.5 ? "Moderate fit — some linear trend present"
                      : "Weak fit — relationship may be non-linear"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[10px]" style={{ color: "#334155" }}>Slope</p>
                    <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{dataset.regression.slope.toFixed(4)}</p>
                    <p className="text-[10px]" style={{ color: "#475569" }}>per year</p>
                  </div>
                  <div className="rounded-xl p-3 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[10px]" style={{ color: "#334155" }}>Intercept</p>
                    <p className="text-sm font-semibold" style={{ color: "#f1f5f9" }}>{dataset.regression.intercept.toFixed(3)}</p>
                    <p className="text-[10px]" style={{ color: "#475569" }}>at t = 0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Analysis */}
          <div className="rounded-2xl p-6"
            style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4" style={{ color: "#a855f7" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a855f7" }}>
                AI Mathematical Analysis
              </p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>
                  Ask a math question about this data
                </label>
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder={`e.g. What does the slope mean for ${(dataset.indicator_name ?? '').toLowerCase()}? Is the trend accelerating?`}
                  rows={2}
                  className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${question ? "#a855f780" : "rgba(255,255,255,0.10)"}`,
                    color: "#f1f5f9",
                  }}
                />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>Subject</label>
                  <div className="relative">
                    <select value={subject} onChange={e => setSubject(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-xs appearance-none outline-none pr-7"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                      {SUBJECTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#475569" }}>Model</label>
                  <div className="relative">
                    <select value={modelName} onChange={e => setModelName(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-xs appearance-none outline-none pr-7"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", color: "#f1f5f9" }}>
                      {MODELS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#475569" }} />
                  </div>
                </div>
              </div>
            </div>

            {analyzeError && (
              <div className="rounded-xl px-4 py-2.5 mb-3 text-xs"
                style={{ background: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.25)", color: "#f87171" }}>
                {analyzeError}
              </div>
            )}

            <button onClick={runAnalysis} disabled={!question.trim() || analyzeLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mb-5"
              style={{
                background: question.trim() ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${question.trim() ? "rgba(168,85,247,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: question.trim() ? "#a855f7" : "#334155",
                cursor: question.trim() && !analyzeLoading ? "pointer" : "not-allowed",
                opacity: analyzeLoading ? 0.7 : 1,
              }}>
              {analyzeLoading
                ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              {analyzeLoading ? "Analysing…" : "Analyse with AI"}
            </button>

            {analysis && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="rounded-xl p-4" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.15)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#a855f7" }}>Analysis</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>{analysis.analysis}</p>
                </div>
                <div className="rounded-xl p-4" style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)" }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#22d3ee" }}>Math Connection</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>{analysis.math_connection}</p>
                </div>
                <div className="rounded-xl p-4 flex gap-3" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
                  <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
                  <p className="text-sm leading-relaxed" style={{ color: "#e2e8f0" }}>{analysis.key_insight}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state */}
      {!dataset && !fetchLoading && (
        <div className="rounded-2xl p-12 text-center relative overflow-hidden"
          style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse 60% 50% at 50% 0%, ${accent}09 0%, transparent 70%)` }} />
          <Database className="w-12 h-12 mx-auto mb-4" style={{ color: `${accent}50` }} />
          <h3 className="font-bold text-base mb-2" style={{ color: "#f1f5f9" }}>Select a dataset to begin</h3>
          <p className="text-sm max-w-sm mx-auto" style={{ color: "#475569" }}>
            Choose a data source, indicator, location, and time range — then click Load Dataset.
          </p>
        </div>
      )}
    </div>
  );
}
