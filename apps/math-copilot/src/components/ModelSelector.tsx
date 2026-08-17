"use client";
/**
 * ModelSelector — persistent AI mode picker used across all AI pages.
 *
 * Per the "Public AI Model Taxonomy, Capability Abstraction & Model Routing
 * Architecture" brief: learners pick a stable AI Mathematics Copilot™
 * capability ("Smart"/"Fast"/"Reason"/etc.), never a vendor model name. The
 * value sent to the backend is now that public mode key (e.g. "smart"), not
 * a raw provider model id — the backend's Model Capability Registry™
 * (backend/app/services/model_registry.py) resolves it to a concrete
 * deployment. Admin/developer accounts additionally see the real provider +
 * model behind each option — "provider and model identities remain
 * administratively visible" per the brief.
 *
 * Persists the chosen mode in localStorage under "math_copilot_ai_mode".
 * Renders as a compact pill/dropdown that fits inside any page's settings row.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { useAuthStore } from "@/store/auth";

export const MODELS = [
  {
    id: "smart",
    label: "Maths Copilot Smart™",
    badgeColor: "#22d3ee",
    description: "Best all-around choice — accurate, fast, great for all levels.",
    adminProvider: "OpenAI",
    adminModel: "gpt-4o",
  },
  {
    id: "fast",
    label: "Maths Copilot Fast™",
    badgeColor: "#67e8f9",
    description: "Lightweight & fast. Great for practice sets and quick answers.",
    adminProvider: "OpenAI",
    adminModel: "gpt-4o-mini",
  },
  {
    id: "reason",
    label: "Maths Copilot Reason™",
    badgeColor: "#a78bfa",
    description: "Deep mathematical reasoning and long structured explanations.",
    adminProvider: "Anthropic",
    adminModel: "claude-sonnet-4",
  },
  {
    id: "concise",
    label: "Maths Copilot Concise™",
    badgeColor: "#c4b5fd",
    description: "Quick, concise replies. Ideal for hints and practice problems.",
    adminProvider: "Anthropic",
    adminModel: "claude-haiku-4",
  },
  {
    id: "vision",
    label: "Maths Copilot Vision™",
    badgeColor: "#34d399",
    description: "Excellent for data analysis, charts, and mixed problem types.",
    adminProvider: "Google",
    adminModel: "gemini-1.5-pro",
  },
  {
    id: "speed",
    label: "Maths Copilot Speed™",
    badgeColor: "#6ee7b7",
    description: "Ultra-fast. Best when you need instant feedback.",
    adminProvider: "Google",
    adminModel: "gemini-1.5-flash",
  },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

const STORAGE_KEY = "math_copilot_ai_mode";

export function useAiMode() {
  const [aiMode, setAiModeState] = useState<string>("smart");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && MODELS.some(m => m.id === stored)) setAiModeState(stored);
  }, []);

  const setAiMode = (id: string) => {
    setAiModeState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return { model: aiMode, setModel: setAiMode };
}

// Kept as an alias so any not-yet-updated call site still works during
// transition — both names point at the same hook.
export const useModel = useAiMode;

interface ModelSelectorProps {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

export function ModelSelector({ value, onChange, compact = false }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

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
              Select AI Mode
            </p>
          </div>

          {MODELS.map(m => {
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
                </div>
                <p className="text-[10px] leading-snug" style={{ color: "#475569" }}>
                  {m.description}
                </p>
                {isAdmin && (
                  <p className="text-[9px] leading-snug mt-0.5" style={{ color: "#64748b" }}>
                    {m.adminProvider} · {m.adminModel}
                  </p>
                )}
              </button>
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
