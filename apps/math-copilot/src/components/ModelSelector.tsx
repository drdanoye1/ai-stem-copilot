"use client";
/**
 * ModelSelector — persistent AI model picker used across all AI pages.
 *
 * Persists the chosen model in localStorage under "math_copilot_model".
 * Renders as a compact pill/dropdown that fits inside any page's settings row.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";

export const MODELS = [
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    badge: "Fast",
    badgeColor: "#22d3ee",
    description: "Best all-around model — fast, accurate, great for all levels.",
  },
  {
    id: "claude-opus-4-5",
    label: "Claude Sonnet",
    provider: "Anthropic",
    badge: "Reasoned",
    badgeColor: "#a78bfa",
    description: "Strong mathematical reasoning and long explanations.",
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "Google",
    badge: "Multimodal",
    badgeColor: "#34d399",
    description: "Excellent for data, charts, and mixed problem types.",
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
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: `${current.badgeColor}20`, color: current.badgeColor }}>
          {current.badge}
        </span>
        <ChevronDown className="w-3 h-3" style={{ transform: open ? "rotate(180deg)" : "", transition: "transform 0.2s" }} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden z-50"
          style={{
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.70)",
            minWidth: "240px",
          }}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#334155" }}>
              Select AI model
            </p>
          </div>
          {MODELS.map(m => {
            const active = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); }}
                className="w-full text-left px-3 py-3 transition-all"
                style={{
                  background: active ? `${m.badgeColor}12` : "transparent",
                  borderLeft: active ? `2px solid ${m.badgeColor}` : "2px solid transparent",
                }}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-semibold" style={{ color: active ? m.badgeColor : "#f1f5f9" }}>
                    {m.label}
                  </span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${m.badgeColor}20`, color: m.badgeColor }}>
                    {m.badge}
                  </span>
                  <span className="text-[9px]" style={{ color: "#334155" }}>{m.provider}</span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: "#475569" }}>{m.description}</p>
              </button>
            );
          })}
          <div className="px-3 py-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <p className="text-[9px]" style={{ color: "#1e293b" }}>
              Selection persists across all pages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
