"use client";
/**
 * ImageModelSelector — persistent image-generation mode picker, shared by
 * every page that generates images (Scenario, Applications, ...).
 *
 * Mirrors ModelSelector.tsx's pattern exactly: learners pick a stable AI
 * Mathematics Copilot™ capability ("Diagram™"/"Creative™"), never a vendor
 * model name (GPT-Image-1/DALL-E 3). The backend's Model Capability
 * Registry™ resolves the public image_mode key to a concrete deployment.
 * Admin/developer accounts additionally see the real provider + model.
 *
 * This component replaces two previously-inconsistent implementations:
 * scenario/page.tsx had its own local, non-persisted image model dropdown;
 * applications/page.tsx had no selector at all (hardcoded gpt-image-1).
 * Both now use this one shared component/hook.
 *
 * Persists the chosen mode in localStorage under "math_copilot_image_mode".
 */
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/auth";

export const IMAGE_MODELS = [
  {
    id: "diagram",
    label: "Diagram™",
    description: "Precise instructional diagrams and geometry illustrations.",
    adminProvider: "OpenAI",
    adminModel: "gpt-image-1",
  },
  {
    id: "creative",
    label: "Creative™",
    description: "Richer, more illustrative educational scenes.",
    adminProvider: "OpenAI",
    adminModel: "dall-e-3",
  },
] as const;

export type ImageModeId = (typeof IMAGE_MODELS)[number]["id"];

const STORAGE_KEY = "math_copilot_image_mode";

export function useImageMode() {
  const [imageMode, setImageModeState] = useState<string>("diagram");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && IMAGE_MODELS.some(m => m.id === stored)) setImageModeState(stored);
  }, []);

  const setImageMode = (id: string) => {
    setImageModeState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return { imageMode, setImageMode };
}

interface ImageModelSelectorProps {
  label?: string;
  value: string;
  onChange: (id: string) => void;
}

export function ImageModelSelector({ label = "Image Mode", value, onChange }: ImageModelSelectorProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const current = IMAGE_MODELS.find(m => m.id === value) ?? IMAGE_MODELS[0];

  return (
    <div>
      {label && (
        <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "#64748b" }}>
          {label}
        </label>
      )}
      <select
        value={current.id}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl text-sm px-3 py-2"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "#f1f5f9",
        }}
      >
        {IMAGE_MODELS.map(m => (
          <option key={m.id} value={m.id} style={{ background: "#0f172a" }}>
            {m.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] leading-snug mt-1" style={{ color: "#475569" }}>
        {current.description}
      </p>
      {isAdmin && (
        <p className="text-[9px] leading-snug mt-0.5" style={{ color: "#64748b" }}>
          {current.adminProvider} · {current.adminModel}
        </p>
      )}
    </div>
  );
}
