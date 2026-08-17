"use client";
import { useCallback, useState } from "react";
import { arVrApi, getErrorMessage, type ArVrInterpretation } from "@/lib/api";

/**
 * Shared hook behind every AR/VR flagship experience's "Interpret" button —
 * one implementation instead of six reimplementations of the same
 * fetch/loading/error/panel-open state (per the Plan-review feedback this
 * was explicitly flagged to avoid).
 *
 * Each ar-lab page builds its own `result_summary` (and optional
 * `computed_values`) from state it already computes, then calls
 * `interpret()` — the hook takes care of the request, loading state, error
 * handling, and whether the panel is open.
 */
export interface InterpretParams {
  experienceKey: string;
  topic: string;
  subject?: string;
  resultSummary: string;
  computedValues?: Record<string, unknown>;
  level?: string;
  curriculum?: string;
  curriculumTrack?: string;
  modelName?: string;
}

export function useArVrInterpretation() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ArVrInterpretation | null>(null);

  const interpret = useCallback(async (params: InterpretParams) => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await arVrApi.interpret({
        experience_key: params.experienceKey,
        topic: params.topic,
        subject: params.subject,
        result_summary: params.resultSummary,
        computed_values: params.computedValues,
        level: params.level,
        curriculum: params.curriculum,
        curriculum_track: params.curriculumTrack,
        ai_mode: params.modelName,
      });
      setData(res);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, loading, error, data, interpret, close };
}
