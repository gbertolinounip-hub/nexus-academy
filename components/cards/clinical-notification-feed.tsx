import Link from "next/link";
import type { Route } from "next";
import { markClinicalNotificationAsReadAction } from "@/app/(app)/clinica-supervisionada/notifications-actions";
import { formatDateTime } from "@/lib/utils/format";
import type { ClinicalNotificationSummary } from "@/types/domain";

interface ClinicalNotificationFeedProps {
  notifications: ClinicalNotificationSummary[];
  emptyMessage?: string;
  showReadAction?: boolean;
  showOpenAction?: boolean;
}

function resolveNotificationHref(notification: ClinicalNotificationSummary): Route {
  if (notification.recordType === "plano_tratamento") {
    return `/clinica-supervisionada/${notification.caseId}/plano-tratamento` as Route;
  }

  if (notification.recordType === "evolucao") {
    return notification.recordId
      ? (`/clinica-supervisionada/${notification.caseId}/evolucao/${notification.recordId}` as Route)
      : (`/clinica-supervisionada/${notification.caseId}/evolucao` as Route);
  }

  return `/clinica-supervisionada/${notification.caseId}/avaliacao` as Route;
}

export function ClinicalNotificationFeed({
  notifications,
  emptyMessage = "Ainda não há notificações clínicas recentes para este perfil.",
  showReadAction = true,
  showOpenAction = true
}: ClinicalNotificationFeedProps) {
  if (!notifications.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="clinical-notification-feed">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={
            notification.read
              ? "clinical-notification-item"
              : "clinical-notification-item clinical-notification-item-unread"
          }
        >
          <div className="clinical-notification-copy">
            <div className="clinical-notification-title-row">
              <strong>{notification.title}</strong>
              <span className="clinical-notification-chip">
                {notification.actionLabel}
              </span>
            </div>
            <p>{notification.message}</p>
            <div className="clinical-notification-meta">
              <span>{notification.patientName}</span>
              <span>{formatDateTime(notification.createdAt)}</span>
            </div>
          </div>

          {showOpenAction || (showReadAction && !notification.read) ? (
            <div className="clinical-notification-actions">
              {showOpenAction ? (
                <Link
                  href={resolveNotificationHref(notification)}
                  className="button button-secondary button-small"
                >
                  Abrir registro
                </Link>
              ) : null}

              {showReadAction && !notification.read ? (
                <form action={markClinicalNotificationAsReadAction}>
                  <input type="hidden" name="notification_id" value={notification.id} />
                  <input type="hidden" name="case_id" value={notification.caseId} />
                  <button type="submit" className="button button-ghost button-small">
                    Marcar como lida
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
