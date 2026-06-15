import Link from "next/link";
import type { Route } from "next";
import {
  formatStageAreaDisplayFromLegacyLabel
} from "@/lib/utils/format";
import type { StudentDocumentDirectoryEntry } from "@/services/student-documents";

interface StudentDocumentDirectoryProps {
  entries: StudentDocumentDirectoryEntry[];
  emptyMessage: string;
  basePath: string;
  showUnitColumn?: boolean;
  tableScrollClassName?: string;
}

function renderVaccinationStatus(entry: StudentDocumentDirectoryEntry) {
  if (!entry.currentVaccination) {
    return <span className="table-helper">Sem envio</span>;
  }

  return (
    <div className="student-document-directory-status-stack">
      <span className={`status-pill status-${entry.currentVaccination.status}`}>
        {entry.currentVaccination.statusLabel}
      </span>
      <span className="table-helper">v{entry.currentVaccination.version}</span>
    </div>
  );
}

function renderTceSummary(entry: StudentDocumentDirectoryEntry) {
  if (!entry.currentTces.length) {
    return <span className="table-helper">Nenhum TCE ativo</span>;
  }

  return (
    <div className="student-document-directory-status-stack">
      <strong>{entry.currentTces.length} TCE(s)</strong>
      <span className="table-helper">
        {entry.currentTces.filter((document) => document.status === "enviado").length} pendente(s)
      </span>
    </div>
  );
}

export function StudentDocumentDirectory({
  entries,
  emptyMessage,
  basePath,
  showUnitColumn = false,
  tableScrollClassName
}: StudentDocumentDirectoryProps) {
  if (!entries.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="student-document-directory">
      <div
        className={`table-wrap student-document-directory-table-wrap ${
          tableScrollClassName ?? ""
        }`.trim()}
      >
        <table className="table student-document-directory-table">
          <thead>
            <tr>
              <th>Aluno</th>
              {showUnitColumn ? <th>Unidade</th> : null}
              <th>Areas</th>
              <th>Carteira</th>
              <th>TCEs</th>
              <th>Pendencias</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.studentId}>
                <td className="student-document-directory-cell-identity">
                  <strong>{entry.studentName}</strong>
                  <span className="table-helper">
                    {entry.registration} - {entry.email}
                  </span>
                </td>
                {showUnitColumn ? <td>{entry.unitName ?? "Nao informada"}</td> : null}
                <td>
                  {entry.areaLabels.length ? (
                    <div className="management-tag-list">
                      {entry.areaLabels.map((label) => (
                        <span key={label} className="badge">
                          {formatStageAreaDisplayFromLegacyLabel(label)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="table-helper">Sem area ativa identificada</span>
                  )}
                </td>
                <td>{renderVaccinationStatus(entry)}</td>
                <td>{renderTceSummary(entry)}</td>
                <td>
                  <div className="student-document-directory-status-stack">
                    <strong>{entry.pendingCount}</strong>
                    <span className="table-helper">
                      {entry.unreadNotificationCount} notificacao(oes) nao lida(s)
                    </span>
                  </div>
                </td>
                <td className="student-document-directory-cell-actions">
                  <div className="actions-row">
                    <Link
                      href={`${basePath}/${encodeURIComponent(entry.studentId)}` as Route}
                      className="button button-secondary button-small"
                    >
                      Ver documentos
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="student-document-directory-mobile-list">
        {entries.map((entry) => (
          <article
            key={`mobile-${entry.studentId}`}
            className="management-block-card student-document-directory-mobile-card"
          >
            <div className="management-block-header">
              <div>
                <h3>{entry.studentName}</h3>
                <p className="field-help">
                  {entry.registration} - {entry.email}
                </p>
              </div>
              <span className={`status-pill ${entry.active ? "status-ativo" : "status-inativo"}`}>
                {entry.active ? "Ativo" : "Inativo"}
              </span>
            </div>

            {showUnitColumn ? (
              <p className="field-help student-document-directory-mobile-unit">
                Unidade: <strong>{entry.unitName ?? "Nao informada"}</strong>
              </p>
            ) : null}

            <div className="management-tag-list">
              {entry.areaLabels.length ? (
                entry.areaLabels.map((label) => (
                  <span key={label} className="badge">
                    {formatStageAreaDisplayFromLegacyLabel(label)}
                  </span>
                ))
              ) : (
                <span className="table-helper">Sem area ativa identificada</span>
              )}
            </div>

            <dl className="student-document-directory-mobile-metrics">
              <div>
                <dt>Carteira</dt>
                <dd>
                  {entry.currentVaccination
                    ? entry.currentVaccination.statusLabel
                    : "Sem envio"}
                </dd>
              </div>
              <div>
                <dt>TCEs ativos</dt>
                <dd>{entry.currentTces.length}</dd>
              </div>
              <div>
                <dt>Pendencias</dt>
                <dd>{entry.pendingCount}</dd>
              </div>
            </dl>

            <div className="actions-row">
              <Link
                href={`${basePath}/${encodeURIComponent(entry.studentId)}` as Route}
                className="button button-secondary button-small"
              >
                Ver documentos
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
