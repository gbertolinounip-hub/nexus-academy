import { markStudentDocumentNotificationAsReadAction } from "@/app/(app)/documentos/actions";
import { formatDateTime } from "@/lib/utils/format";
import type { StudentDocumentNotificationSummary } from "@/types/domain";

interface StudentDocumentNotificationFeedProps {
  notifications: StudentDocumentNotificationSummary[];
  emptyMessage?: string;
}

export function StudentDocumentNotificationFeed({
  notifications,
  emptyMessage = "Ainda não há notificações recentes sobre documentos."
}: StudentDocumentNotificationFeedProps) {
  if (!notifications.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="student-document-notification-feed">
      {notifications.map((notification) => (
        <article
          key={notification.id}
          className={
            notification.read
              ? "student-document-notification-item"
              : "student-document-notification-item student-document-notification-item-unread"
          }
        >
          <div className="student-document-notification-copy">
            <div className="student-document-notification-title-row">
              <strong>{notification.title}</strong>
              <span className="student-document-notification-chip">
                {notification.actionLabel}
              </span>
            </div>
            <p>{notification.message}</p>
            <div className="student-document-notification-meta">
              <span>{notification.areaName ?? "Documento geral do aluno"}</span>
              <span>{formatDateTime(notification.createdAt)}</span>
            </div>
          </div>

          <div className="student-document-notification-actions">
            <a
              href={`#documento-${notification.documentId}`}
              className="button button-secondary button-small"
            >
              Ver documento
            </a>

            {!notification.read ? (
              <form action={markStudentDocumentNotificationAsReadAction}>
                <input type="hidden" name="notification_id" value={notification.id} />
                <button type="submit" className="button button-ghost button-small">
                  Marcar como lida
                </button>
              </form>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
