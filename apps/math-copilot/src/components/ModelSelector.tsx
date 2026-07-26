"use client";
/**
 * ModelSelector — persistent AI model picker used across all AI pages.
 * Persists the chosen model in localStorage under "math_copilot_model".
 * Renders as a compact pill/dropdown that fits inside any page's settings row.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";

export const MODELS = [
  // ── OpenAI ──────────────────────────────────────────────────────────────
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    badge: "Smart",
    badgeColor: "#22d3ee",
    description: "Best all-around model — accurate, fast, great for all levels.",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    badge: "Fast",
    badgeColor: "#67e8f9",
    description: "Lightweight & fast. Great for practice sets and quick answers.",
  },
  // ── Anthropic ────────────────────────────────────────────────────────────
  {
    id: "claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    badge: "Reasoned",
    badgeColor: "#a78bfa",
    description: "Deep mathematical reasoning and long structured explanations.",
  },
  {
    id: "claude-haiku-4",
    label: "Claude Haiku 4",
    provider: "Anthropic",
    badge: "Concise",
    badgeColor: "#c4b5fd",
    description: "Quick, concise replies. Ideal for hints and practice problems.",
  },
  // ── Google ───────────────────────────────────────────────────────────────
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "Google",
    badge: "Multimodal",
    badgeColor: "#34d399",
    description: "Excellent for data analysis, charts, and mixed problem types.",
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "Google",
    badge: "Speed",
    badgeColor: "#6ee7b7",
    description: "Ultra-fast Gemini. Best when you need instant feedback.",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

const STORAGE_KEY = "math_copilot_model";

export function useModel() {
  const [model, setModelState] = useState<string>("gpt-4o");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && MODELS.some(m => m.id === stored)) setModelState(stored);
  }, []);

  const setModel = (id: string) => {
    setModelState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return { model, setModel };
}

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

const PROVIDER_ORDER = ["OpenAI", "Anthropic", "Google"] as const;

export function ModelSelector({ value, onChange, compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = MODELS.find(m => m.id === value) ?? MODELS[0];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-xl text-xs font-semibold transition-all"
        style={{
          background: open ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#94a3b8",
          padding: compact ? "6px 10px" : "8px 14px",
        }}
      >
        <Cpu className="w-3.5 h-3.5" style={{ color: current.badgeColor }} />
        <span style={{ color: "#f1f5f9" }}>{current.label}</span>
        <span
          className="text-[9px] px-1.5 py-0.5 rounded-full font-bold hidden sm:inline"
          style={{ background: `${current.badgeColor}20`, color: current.badgeColor }}
        >
          {current.badge}
        </span>
        <ChevronDown
          className="w-3 h-3"
          style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden z-50 w-64 max-w-[calc(100vw-2rem)]"
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.70)",
          }}
        >
          <div className="px-3 pt-3 pb-1.5">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#334155" }}>
              Select AI Model
            </p>
          </div>

          {PROVIDER_ORDER.map(provider => {
            const group = MODELS.filter(m => m.provider === provider);
            return (
              <div key={provider}>
                <div className="px-3 py-1">
                  <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "#334155" }}>
                    {provider}
                  </span>
                </div>
                {group.map(m => {
                  const active = m.id === value;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { onChange(m.id); setOpen(false); }}
                      className="w-full text-left px-3 py-2.5 transition-all"
                      style={{
                        background: active ? `${m.badgeColor}12` : "transparent",
                        borderLeft: active ? `2px solid ${m.badgeColor}` : "2px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: active ? m.badgeColor : "#f1f5f9" }}>
                          {m.label}
                        </span>
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ background: `${m.badgeColor}20`, color: m.badgeColor }}
                        >
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[10px] leading-snug" style={{ color: "#475569" }}>
                        {m.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}

          <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[9px]" style={{ color: "#1e293b" }}>
              Choice persists across all pages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
