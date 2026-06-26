"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Route } from "next";
import {
  createSessionGuardSessionId,
  INACTIVITY_TIMEOUT_MS,
  MAX_SESSION_DURATION_MS,
  parseSessionGuardEvent,
  SESSION_GUARD_BROADCAST_CHANNEL,
  SESSION_GUARD_STORAGE_KEYS,
  signOutClientSession,
  WARNING_BEFORE_TIMEOUT_MS,
  writeSessionGuardEvent,
  type SessionGuardLogoutReason,
  type SessionGuardStorageEvent
} from "@/lib/auth/client-session";

const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const LOGIN_ROUTE = "/login" as Route;

interface SessionSnapshot {
  userId: string;
  sessionId: string;
  sessionStartedAt: number;
  lastActivityAt: number;
}

interface SessionGuardProps {
  currentUserId: string;
}

interface WarningState {
  isOpen: boolean;
  reason: Exclude<SessionGuardLogoutReason, "manual" | "synchronized"> | null;
  remainingMs: number;
}

function clampPositiveNumber(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function readStorageString(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignora indisponibilidade de storage no navegador.
  }
}

function readStorageNumber(key: string) {
  const value = readStorageString(key);

  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function persistSessionSnapshot(snapshot: SessionSnapshot) {
  writeStorageValue(SESSION_GUARD_STORAGE_KEYS.userId, snapshot.userId);
  writeStorageValue(SESSION_GUARD_STORAGE_KEYS.sessionId, snapshot.sessionId);
  writeStorageValue(
    SESSION_GUARD_STORAGE_KEYS.sessionStartedAt,
    String(snapshot.sessionStartedAt)
  );
  writeStorageValue(
    SESSION_GUARD_STORAGE_KEYS.lastActivityAt,
    String(snapshot.lastActivityAt)
  );
}

function buildSessionSnapshot(currentUserId: string, now: number) {
  const storedUserId = readStorageString(SESSION_GUARD_STORAGE_KEYS.userId);
  const storedSessionId = readStorageString(SESSION_GUARD_STORAGE_KEYS.sessionId);
  const storedSessionStartedAt = readStorageNumber(
    SESSION_GUARD_STORAGE_KEYS.sessionStartedAt
  );
  const storedLastActivityAt = readStorageNumber(
    SESSION_GUARD_STORAGE_KEYS.lastActivityAt
  );
  const isSameUser = storedUserId === currentUserId;

  return {
    userId: currentUserId,
    sessionId:
      isSameUser && storedSessionId ? storedSessionId : createSessionGuardSessionId(),
    sessionStartedAt:
      isSameUser && storedSessionStartedAt
        ? clampPositiveNumber(storedSessionStartedAt, now)
        : now,
    lastActivityAt:
      isSameUser && storedLastActivityAt
        ? clampPositiveNumber(storedLastActivityAt, now)
        : now
  } satisfies SessionSnapshot;
}

function getWarningCopy(reason: WarningState["reason"]) {
  if (reason === "max-duration") {
    return "Para sua segurança, o Nexus Academy encerrará automaticamente a sessão ao atingir o tempo máximo permitido. Deseja continuar conectado até esse limite?";
  }

  return "Para sua segurança, o Nexus Academy encerrará automaticamente a sessão por inatividade. Deseja continuar conectado?";
}

export function SessionGuard({ currentUserId }: SessionGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [warningState, setWarningState] = useState<WarningState>({
    isOpen: false,
    reason: null,
    remainingMs: 0
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastRecordedActivityAtRef = useRef(0);
  const logoutInProgressRef = useRef(false);
  const initializedRef = useRef(false);
  const navigationSyncReadyRef = useRef(false);
  const maxDurationWarningDismissedRef = useRef(false);

  const currentLocationSignature = useMemo(
    () => `${pathname}?${searchParams.toString()}`,
    [pathname, searchParams]
  );

  function publishEvent(event: SessionGuardStorageEvent) {
    writeSessionGuardEvent(event);
    broadcastChannelRef.current?.postMessage(event);
  }

  function getCurrentSnapshot(now = Date.now()) {
    const snapshot = buildSessionSnapshot(currentUserId, now);
    persistSessionSnapshot(snapshot);
    return snapshot;
  }

  function markActivity(force = false) {
    if (logoutInProgressRef.current) {
      return;
    }

    const now = Date.now();

    if (!force && now - lastRecordedActivityAtRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
      return;
    }

    const snapshot = getCurrentSnapshot(now);
    const nextSnapshot = {
      ...snapshot,
      lastActivityAt: now
    };

    persistSessionSnapshot(nextSnapshot);
    publishEvent({
      type: "activity",
      at: now,
      sessionId: nextSnapshot.sessionId,
      userId: currentUserId
    });
    lastRecordedActivityAtRef.current = now;
    setWarningState((currentState) =>
      currentState.isOpen
        ? { isOpen: false, reason: null, remainingMs: 0 }
        : currentState
    );
  }

  function performLogout(
    reason: SessionGuardLogoutReason,
    options?: { broadcast?: boolean }
  ) {
    if (logoutInProgressRef.current) {
      return;
    }

    logoutInProgressRef.current = true;
    setErrorMessage(null);
    setWarningState({ isOpen: false, reason: null, remainingMs: 0 });

    const snapshot = getCurrentSnapshot();

    if (options?.broadcast !== false) {
      publishEvent({
        type: "logout",
        at: Date.now(),
        sessionId: snapshot.sessionId,
        userId: currentUserId,
        reason
      });
    }

    startTransition(async () => {
      try {
        await signOutClientSession(router, {
          redirectTo: LOGIN_ROUTE,
          preserveEvent: options?.broadcast !== false
        });
      } catch (error) {
        logoutInProgressRef.current = false;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível encerrar a sessão automaticamente."
        );
      }
    });
  }

  function evaluateSession() {
    if (logoutInProgressRef.current) {
      return;
    }

    const now = Date.now();
    const snapshot = getCurrentSnapshot(now);
    const inactivityDeadline = snapshot.lastActivityAt + INACTIVITY_TIMEOUT_MS;
    const maxDurationDeadline =
      snapshot.sessionStartedAt + MAX_SESSION_DURATION_MS;
    const inactivityRemainingMs = inactivityDeadline - now;
    const maxDurationRemainingMs = maxDurationDeadline - now;

    if (maxDurationRemainingMs <= 0) {
      performLogout("max-duration");
      return;
    }

    if (inactivityRemainingMs <= 0) {
      performLogout("inactivity");
      return;
    }

    const shouldWarnForMaxDuration =
      maxDurationRemainingMs <= WARNING_BEFORE_TIMEOUT_MS &&
      !maxDurationWarningDismissedRef.current;
    const shouldWarnForInactivity =
      inactivityRemainingMs <= WARNING_BEFORE_TIMEOUT_MS;

    if (
      shouldWarnForMaxDuration &&
      (!shouldWarnForInactivity || maxDurationRemainingMs <= inactivityRemainingMs)
    ) {
      setWarningState({
        isOpen: true,
        reason: "max-duration",
        remainingMs: maxDurationRemainingMs
      });
      return;
    }

    if (shouldWarnForInactivity) {
      setWarningState({
        isOpen: true,
        reason: "inactivity",
        remainingMs: inactivityRemainingMs
      });
      return;
    }

    setWarningState((currentState) =>
      currentState.isOpen
        ? { isOpen: false, reason: null, remainingMs: 0 }
        : currentState
    );
  }

  useEffect(() => {
    const snapshot = getCurrentSnapshot();
    lastRecordedActivityAtRef.current = snapshot.lastActivityAt;
    initializedRef.current = true;
    evaluateSession();

    const events = [
      "click",
      "keydown",
      "mousemove",
      "scroll",
      "touchstart",
      "focus"
    ] as const;
    const handleActivity = () => markActivity();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markActivity(true);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return;
      }

      if (event.key === SESSION_GUARD_STORAGE_KEYS.event) {
        const sessionEvent = parseSessionGuardEvent(event.newValue);

        if (
          sessionEvent &&
          sessionEvent.userId === currentUserId &&
          sessionEvent.type === "logout"
        ) {
          const currentSnapshot = getCurrentSnapshot();

          if (sessionEvent.sessionId === currentSnapshot.sessionId) {
            performLogout("synchronized", { broadcast: false });
            return;
          }
        }
      }

      if (
        event.key === SESSION_GUARD_STORAGE_KEYS.lastActivityAt ||
        event.key === SESSION_GUARD_STORAGE_KEYS.sessionStartedAt ||
        event.key === SESSION_GUARD_STORAGE_KEYS.userId ||
        event.key === SESSION_GUARD_STORAGE_KEYS.sessionId
      ) {
        evaluateSession();
      }
    };

    for (const eventName of events) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(SESSION_GUARD_BROADCAST_CHANNEL);
      channel.onmessage = (messageEvent: MessageEvent<SessionGuardStorageEvent>) => {
        const event = messageEvent.data;

        if (!event || event.userId !== currentUserId) {
          return;
        }

        if (event.type === "logout") {
          const currentSnapshot = getCurrentSnapshot();

          if (event.sessionId === currentSnapshot.sessionId) {
            performLogout("synchronized", { broadcast: false });
            return;
          }
        }

        if (event.type === "activity") {
          evaluateSession();
        }
      };
      broadcastChannelRef.current = channel;
    }

    const intervalId = window.setInterval(evaluateSession, 1000);

    return () => {
      window.clearInterval(intervalId);

      for (const eventName of events) {
        window.removeEventListener(eventName, handleActivity);
      }

      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }

    if (!navigationSyncReadyRef.current) {
      navigationSyncReadyRef.current = true;
      return;
    }

    if (currentLocationSignature) {
      markActivity(true);
    }
  }, [currentLocationSignature]);

  return (
    <>
      {warningState.isOpen ? (
        <div className="session-guard-backdrop" role="presentation">
          <div
            className="session-guard-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-guard-title"
          >
            <p className="session-guard-eyebrow">Segurança da sessão</p>
            <h2 id="session-guard-title">Sua sessão está prestes a expirar</h2>
            <p>{getWarningCopy(warningState.reason)}</p>
            <p className="session-guard-countdown">
              Tempo restante: {formatRemainingTime(warningState.remainingMs)}
            </p>
            {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
            <div className="session-guard-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  if (warningState.reason === "max-duration") {
                    maxDurationWarningDismissedRef.current = true;
                  }

                  markActivity(true);
                }}
                disabled={isPending}
              >
                Continuar conectado
              </button>
              <button
                type="button"
                className="button"
                onClick={() => performLogout("manual")}
                disabled={isPending}
              >
                {isPending ? "Encerrando..." : "Sair agora"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPending ? (
        <div className="session-guard-status" aria-live="assertive">
          <div className="session-guard-status-card">
            <strong>Encerrando sessão…</strong>
            <p>Redirecionando para a tela de login.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
