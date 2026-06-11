"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { setActiveContextAction } from "@/app/(app)/contexto/actions";
import { initialContextSwitchActionState } from "@/app/(app)/contexto/state";
import {
  buildContextLongLabel,
  buildContextShortLabel
} from "@/lib/auth/roles";
import type { SessionUser, SessionUserContext } from "@/types/domain";

interface ContextSwitcherProps {
  currentUser: SessionUser;
}

function buildReadonlyContext(context: SessionUserContext | null) {
  if (!context) {
    return {
      shortLabel: "Sem contexto",
      longLabel: "Nenhum contexto ativo reconhecido na sessão."
    };
  }

  return {
    shortLabel: buildContextShortLabel(context),
    longLabel: buildContextLongLabel(context)
  };
}

export function ContextSwitcher({ currentUser }: ContextSwitcherProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    setActiveContextAction,
    initialContextSwitchActionState
  );
  const safeState = state ?? initialContextSwitchActionState;
  const activeContexts = useMemo(
    () => currentUser.contextosDisponiveis.filter((context) => context.ativo),
    [currentUser.contextosDisponiveis]
  );

  useEffect(() => {
    if (safeState.status === "success") {
      router.refresh();
    }
  }, [router, safeState.status, safeState.submittedAt]);

  if (!activeContexts.length) {
    return null;
  }

  const hasMultipleContexts = activeContexts.length > 1;
  const currentContext =
    currentUser.contextoAtivo ?? (activeContexts.length === 1 ? activeContexts[0] : null);
  const currentLabels = buildReadonlyContext(currentContext);

  if (!hasMultipleContexts) {
    return (
      <div
        className="context-switcher context-switcher-readonly"
        title={currentLabels.longLabel}
      >
        <div className="context-switcher-topline">
          <strong className="context-switcher-kicker">Contexto</strong>
        </div>
        <strong className="context-switcher-current">{currentLabels.shortLabel}</strong>
      </div>
    );
  }

  return (
    <form action={formAction} className="context-switcher context-switcher-compact">
      <div className="context-switcher-topline">
        <strong className="context-switcher-kicker">Contexto</strong>
      </div>

      <details className="context-switcher-disclosure">
        <summary
          className="context-switcher-summary"
          title={currentLabels.longLabel}
        >
          <strong className="context-switcher-current">
            {currentUser.contextoAtivo ? currentLabels.shortLabel : "Selecionar contexto"}
          </strong>
          <span className="context-switcher-current-meta">{currentLabels.longLabel}</span>
        </summary>

        <div className="context-switcher-options">
          {activeContexts.map((context) => {
            const shortLabel = buildContextShortLabel(context);
            const longLabel = buildContextLongLabel(context);
            const isCurrentContext = context.id === currentUser.contextoAtivo?.id;

            return (
              <button
                key={context.id}
                type="submit"
                name="contexto_id"
                value={context.id}
                className={`context-switcher-option ${
                  isCurrentContext ? "context-switcher-option-active" : ""
                }`}
                disabled={isCurrentContext}
                title={longLabel}
              >
                <span className="context-switcher-option-short">{shortLabel}</span>
                <span className="context-switcher-option-long">{longLabel}</span>
              </button>
            );
          })}
        </div>
      </details>

      {safeState.status === "error" && safeState.message ? (
        <p className="context-switcher-feedback context-switcher-feedback-error">
          {safeState.message}
        </p>
      ) : null}
    </form>
  );
}
