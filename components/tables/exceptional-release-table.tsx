import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { formatDateTime } from "@/lib/utils/format";
import type { ExceptionalReleaseListEntry } from "@/services/exceptional-releases";

interface ExceptionalReleaseTableProps {
  entries: ExceptionalReleaseListEntry[];
  emptyMessage: string;
  allowManualClose?: boolean;
  closeAction?: (formData: FormData) => void | Promise<void>;
}

export function ExceptionalReleaseTable({
  entries,
  emptyMessage,
  allowManualClose = false,
  closeAction
}: ExceptionalReleaseTableProps) {
  if (!entries.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="exceptional-release-directory">
      <div className="table-wrap exceptional-release-table-wrap">
        <table className="table exceptional-release-table">
          <colgroup>
            <col className="exceptional-release-col-type" />
            <col className="exceptional-release-col-recipient" />
            <col className="exceptional-release-col-context" />
            <col className="exceptional-release-col-validity" />
            <col className="exceptional-release-col-status" />
            <col className="exceptional-release-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Usuário liberado</th>
              <th>Contexto</th>
              <th>Vigência</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="exceptional-release-cell-type">
                  <strong>{entry.typeLabel}</strong>
                  <span className="table-helper">{entry.scopeLabel}</span>
                </td>
                <td className="exceptional-release-cell-recipient">
                  <strong>{entry.authorizedUserName}</strong>
                  <span className="table-helper">
                    {entry.authorizedUserRoleLabel} · {entry.authorizedUserEmail}
                  </span>
                </td>
                <td className="exceptional-release-cell-context">
                  <strong>
                    {entry.semesterCode} · {entry.semesterName}
                  </strong>
                  {entry.classLabel ? (
                    <span className="table-helper">Turma · {entry.classLabel}</span>
                  ) : null}
                  {entry.studentLabel ? (
                    <span className="table-helper">Aluno · {entry.studentLabel}</span>
                  ) : null}
                  <span className="table-helper">Motivo · {entry.reason}</span>
                  <span className="table-helper">
                    Autorizado por {entry.createdByName}
                  </span>
                </td>
                <td className="exceptional-release-cell-validity">
                  <strong>{formatDateTime(entry.startsAt)}</strong>
                  <span className="table-helper">
                    até {formatDateTime(entry.expiresAt)}
                  </span>
                  {entry.manuallyClosedAt ? (
                    <span className="table-helper">
                      Encerrada em {formatDateTime(entry.manuallyClosedAt)}
                    </span>
                  ) : null}
                </td>
                <td>
                  <span className={`status-pill ${entry.statusClassName}`}>
                    {entry.statusLabel}
                  </span>
                </td>
                <td className="exceptional-release-cell-actions">
                  {allowManualClose && closeAction && entry.canManualClose ? (
                    <ConfirmActionForm
                      action={closeAction}
                      confirmationMessage={`Deseja encerrar manualmente a liberação de ${entry.authorizedUserName}?`}
                      fields={[{ name: "release_id", value: entry.id }]}
                      className="button button-secondary button-small"
                    >
                      Encerrar manualmente
                    </ConfirmActionForm>
                  ) : (
                    <span className="table-helper">
                      {entry.statusKey === "expirada"
                        ? "Vigência encerrada automaticamente"
                        : entry.statusKey === "encerrada"
                          ? "Encerrada manualmente"
                          : "Sem ações disponíveis"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="exceptional-release-mobile-list">
        {entries.map((entry) => (
          <article
            key={`mobile-${entry.id}`}
            className="management-block-card exceptional-release-mobile-card"
          >
            <div className="management-block-header">
              <div>
                <h3>{entry.typeLabel}</h3>
                <p className="field-help">
                  {entry.scopeLabel} · {entry.authorizedUserName}
                </p>
              </div>
              <span className={`status-pill ${entry.statusClassName}`}>
                {entry.statusLabel}
              </span>
            </div>

            <dl className="exceptional-release-mobile-meta">
              <div>
                <dt>Semestre</dt>
                <dd>
                  {entry.semesterCode} · {entry.semesterName}
                </dd>
              </div>
              <div>
                <dt>Usuário</dt>
                <dd>{entry.authorizedUserRoleLabel}</dd>
              </div>
              {entry.classLabel ? (
                <div>
                  <dt>Turma</dt>
                  <dd>{entry.classLabel}</dd>
                </div>
              ) : null}
              {entry.studentLabel ? (
                <div>
                  <dt>Aluno</dt>
                  <dd>{entry.studentLabel}</dd>
                </div>
              ) : null}
              <div>
                <dt>Vigência</dt>
                <dd>
                  {formatDateTime(entry.startsAt)} até {formatDateTime(entry.expiresAt)}
                </dd>
              </div>
              <div>
                <dt>Autorizado por</dt>
                <dd>{entry.createdByName}</dd>
              </div>
              <div className="exceptional-release-mobile-meta-wide">
                <dt>Motivo</dt>
                <dd>{entry.reason}</dd>
              </div>
            </dl>

            <div className="actions-row exceptional-release-mobile-actions">
              {allowManualClose && closeAction && entry.canManualClose ? (
                <ConfirmActionForm
                  action={closeAction}
                  confirmationMessage={`Deseja encerrar manualmente a liberação de ${entry.authorizedUserName}?`}
                  fields={[{ name: "release_id", value: entry.id }]}
                  className="button button-secondary button-small"
                >
                  Encerrar manualmente
                </ConfirmActionForm>
              ) : (
                <span className="table-helper">
                  {entry.statusKey === "expirada"
                    ? "Vigência encerrada automaticamente"
                    : entry.statusKey === "encerrada"
                      ? "Encerrada manualmente"
                      : "Sem ações disponíveis"}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
