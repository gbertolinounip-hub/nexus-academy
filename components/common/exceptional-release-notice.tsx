"use client";

import type { ExceptionalReleaseVisualNotice } from "@/types/domain";

interface ExceptionalReleaseNoticeProps {
  notice: ExceptionalReleaseVisualNotice;
  compact?: boolean;
  className?: string;
}

function joinClassNames(...classNames: Array<string | undefined | false | null>) {
  return classNames.filter(Boolean).join(" ");
}

export function ExceptionalReleaseNotice({
  notice,
  compact = false,
  className
}: ExceptionalReleaseNoticeProps) {
  return (
    <section
      className={joinClassNames(
        "exceptional-release-active-notice",
        compact && "exceptional-release-active-notice-compact",
        className
      )}
      aria-label="Liberação excepcional ativa"
    >
      <div className="exceptional-release-active-notice-icon" aria-hidden="true">
        !
      </div>
      <div className="exceptional-release-active-notice-copy">
        <div className="exceptional-release-active-notice-meta">
          <span className="exceptional-release-active-notice-tag">{notice.title}</span>
          <span className="exceptional-release-active-notice-expiry">
            Válida até {new Intl.DateTimeFormat("pt-BR", {
              timeZone: "America/Sao_Paulo",
              dateStyle: "short",
              timeStyle: "short"
            }).format(new Date(notice.expiresAt))}
          </span>
        </div>
        <p>{notice.message}</p>
        {notice.reason ? (
          <p className="exceptional-release-active-notice-reason">
            Motivo autorizado: {notice.reason}
          </p>
        ) : null}
      </div>
    </section>
  );
}
