"use client";
/**
 * usePlan — resolves the current user's plan tier.
 *
 * Precedence (highest → lowest):
 *  1. user.role === "admin"  →  always Pro
 *  2. user.plan === "pro"    →  Pro (when backend sends a plan field)
 *  3. localStorage key       →  developer/QA override (see below)
 *  4. URL param ?plan=pro    →  per-request override (useful in review links)
 *  5. default                →  "free"
 *
 * ─── How an admin bypasses payment for testing ────────────────────────────
 *
 * Option A — localStorage (persists across refreshes, cleared on logout):
 *   Open DevTools console and run:
 *     localStorage.setItem("plan_override", "pro")
 *   To revert:
 *     localStorage.removeItem("plan_override")
 *
 * Option B — URL param (single page-load, no persistence):
 *   Append ?plan=pro to any URL, e.g.:
 *     http://localhost:3000/projects?plan=pro
 *
 * Option C — Admin role (permanent, no action needed):
 *   Any account with role "admin" is automatically treated as Pro.
 *   Set in DB: UPDATE users SET role = 'admin' WHERE email = '...';
 *   Or via the admin panel once it's built.
 *
 * ─── Adding backend plan support ──────────────────────────────────────────
 * When you add a `plan` field to the User model, update useAuthStore so that
 * user.plan is populated from the /auth/me response. This hook reads it
 * automatically — no changes needed here.
 */

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";

export type PlanTier = "free" | "pro" | "enterprise";

export function usePlan(): { tier: PlanTier; isPro: boolean; isAdmin: boolean } {
  const { user } = useAuthStore();
  const [localOverride, setLocalOverride] = useState<string | null>(null);
  const [urlOverride, setUrlOverride] = useState<string | null>(null);

  // Read localStorage on mount (client-only)
  useEffect(() => {
    try {
      setLocalOverride(localStorage.getItem("plan_override"));
    } catch { /* SSR / incognito */ }
  }, []);

  // Read URL param on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setUrlOverride(params.get("plan"));
    }
  }, []);

  // Known admin emails — belt-and-suspenders check alongside role field.
  // The backend already forces role="admin" for these addresses, so this
  // only matters if the token is stale and hasn't been refreshed yet.
  const ADMIN_EMAILS = ["admin@aimathcopilot.com"];
  const isAdmin = user?.role === "admin" || ADMIN_EMAILS.includes(user?.email?.toLowerCase() ?? "");

  // Resolve tier
  let tier: PlanTier = "free";

  if (isAdmin) {
    tier = "pro"; // admins always get Pro
  } else if ((user as any)?.plan === "pro" || (user as any)?.plan === "enterprise") {
    tier = (user as any).plan as PlanTier;
  } else if (localOverride === "pro" || localOverride === "enterprise") {
    tier = localOverride as PlanTier;
  } else if (urlOverride === "pro" || urlOverride === "enterprise") {
    tier = urlOverride as PlanTier;
  }

  return {
    tier,
    isPro: tier === "pro" || tier === "enterprise",
    isAdmin,
  };
}
