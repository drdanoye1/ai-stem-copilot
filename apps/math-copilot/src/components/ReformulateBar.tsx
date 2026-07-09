"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { mathApi } from "@/lib/api";

interface ReformulateBarProps {
  value: string;
  subject: string;
  level: string;
  curriculum?: string;
  context: "theory" | "visualization" | "simulation" | "applications" | "solve" | "explore" | "practice" | "scenario" | "mentor";
  onSelect: (suggestion: string) => void;
  accent?: string;
}

export function ReformulateBar({
  value,
  subject,
  level,
  curriculum = "general",
  context,
  onSelect,
  accent = "#22d3ee",
}: ReformulateBarProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchedRef = useRef("");

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (input.trim().length < 4) { setSuggestions([]); return; }
      if (input === lastFetchedRef.current) return;
      lastFetchedRef.current = input;
      setLoading(true);
      try {
        const { data } = await mathApi.reformulate({
          raw_input: input.trim(),
          subject,
          level,
          curriculum,
          context,
        });
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [subject, level, curriculum, context]
  );

  // Auto-trigger with 600 ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  // Don't render until there's enough input
  if (value.trim().length < 4) return null;

  return (
    <div className="mt-3">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "#334155" }}
        >
          AI Suggestions
        </span>
        <button
          onClick={() => {
            lastFetchedRef.current = "";
            fetchSuggestions(value);
          }}
          disabled={loading}
          className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md transition-opacity hover:opacity-80 disabled:opacity-40 select-none"
          style={{
            background: `${accent}12`,
            color: accent,
            border: `1px solid ${accent}28`,
          }}
        >
          <RefreshCw className={`w-2.5 h-2.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Suggestion rows */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 rounded-xl animate-pulse"
              style={{ background: "rgba(255,255,255,0.05)", animationDelay: `${i * 80}ms` }}
            />
          ))}
        </div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSelect(s)}
              className="w-full text-left text-xs px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "#94a3b8",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = `${accent}40`;
                el.style.background = `${accent}08`;
                el.style.color = "#f1f5f9";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = "rgba(255,255,255,0.07)";
                el.style.background = "rgba(255,255,255,0.03)";
                el.style.color = "#94a3b8";
              }}
            >
              <span className="font-semibold mr-2" style={{ color: accent }}>
                {i + 1}.
              </span>
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
