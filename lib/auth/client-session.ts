"use client";

import type { Route } from "next";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const WARNING_BEFORE_TIMEOUT_MS = 2 * 60 * 1000;
export const MAX_SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export const SESSION_GUARD_STORAGE_KEYS = {
  userId: "nexus.sessionGuard.userId",
  sessionId: "nexus.sessionGuard.sessionId",
  sessionStartedAt: "nexus.sessionGuard.sessionStartedAt",
  lastActivityAt: "nexus.sessionGuard.lastActivityAt",
  event: "nexus.sessionGuard.event"
} as const;

export const SESSION_GUARD_BROADCAST_CHANNEL = "nexus-session-guard";

export type SessionGuardLogoutReason =
  | "inactivity"
  | "max-duration"
  | "manual"
  | "synchronized";

export interface SessionGuardStorageEvent {
  type: "activity" | "logout";
  userId: string;
  sessionId: string;
  at: number;
  reason?: SessionGuardLogoutReason;
}

export function createSessionGuardSessionId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clearSessionGuardStorage(options?: { preserveEvent?: boolean }) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEYS.userId);
    window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEYS.sessionId);
    window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEYS.sessionStartedAt);
    window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEYS.lastActivityAt);

    if (!options?.preserveEvent) {
      window.localStorage.removeItem(SESSION_GUARD_STORAGE_KEYS.event);
    }
  } catch {
    // Ignora indisponibilidade de storage no navegador.
  }
}

export function writeSessionGuardEvent(event: SessionGuardStorageEvent) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      SESSION_GUARD_STORAGE_KEYS.event,
      JSON.stringify(event)
    );
  } catch {
    // Mantém o logout funcionando mesmo sem storage disponível.
  }
}

export function parseSessionGuardEvent(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(value) as Partial<SessionGuardStorageEvent>;

    if (
      (parsedValue.type === "activity" || parsedValue.type === "logout") &&
      typeof parsedValue.userId === "string" &&
      typeof parsedValue.sessionId === "string" &&
      typeof parsedValue.at === "number"
    ) {
      return parsedValue as SessionGuardStorageEvent;
    }
  } catch {
    return null;
  }

  return null;
}

export async function signOutClientSession(
  router: Pick<AppRouterInstance, "replace" | "refresh">,
  options?: {
    redirectTo?: Route;
    preserveEvent?: boolean;
  }
) {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  clearSessionGuardStorage({ preserveEvent: options?.preserveEvent });
  router.replace((options?.redirectTo ?? "/login") as Route);
  router.refresh();
}
