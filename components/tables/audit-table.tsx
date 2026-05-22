"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils/format";
import type { AuditEntry } from "@/types/domain";

interface AuditTableProps {
  entries: AuditEntry[];
}

function actionLabel(action: AuditEntry["action"]) {
  switch (action) {
    case "INSERT":
      return "Inclusão";
    case "UPDATE":
      return "Alteração";
    case "DELETE":
      return "Exclusão";
    default:
      return action;
  }
}

export function AuditTable({ entries }: AuditTableProps) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  return (
    <div className="table-wrap audit-table-wrap">
      <table className="table audit-table">
        <colgroup>
          <col className="audit-table-col-when" />
          <col className="audit-table-col-action" />
          <col className="audit-table-col-actor" />
          <col className="audit-table-col-record" />
          <col className="audit-table-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="audit-table-head-when">Quando</th>
            <th>Ação</th>
            <th>Responsável</th>
            <th>Registro</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;

            return (
              <FragmentRow
                key={entry.id}
                entry={entry}
                isExpanded={isExpanded}
                onToggle={() =>
                  setExpandedEntryId((currentValue) =>
                    currentValue === entry.id ? null : entry.id
                  )
                }
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow(props: {
  entry: AuditEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { entry, isExpanded, onToggle } = props;

  return (
    <>
      <tr className={isExpanded ? "audit-table-row-expanded" : undefined}>
        <td className="audit-table-cell-when">{formatDateTime(entry.happenedAt)}</td>
        <td className="audit-table-cell-action">
          <span className={`status-pill audit-status-pill audit-status-${entry.action.toLowerCase()}`}>
            {actionLabel(entry.action)}
          </span>
        </td>
        <td className="audit-table-cell-actor">
          <div className="audit-table-cell-content audit-table-cell-content-actor">
            {entry.actorName}
          </div>
        </td>
        <td className="audit-table-cell-record">
          <div className="audit-table-cell-content audit-table-cell-content-record">
            <div>{entry.recordLabel}</div>
            <div className="table-helper">{entry.tableName}</div>
          </div>
        </td>
        <td className="audit-table-cell-actions">
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={onToggle}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Ocultar detalhes" : "Ver detalhes"}
          </button>
        </td>
      </tr>

      {isExpanded ? (
        <tr className="audit-table-details-row">
          <td colSpan={5}>
            <div className="audit-table-details">
              <div className="audit-table-details-grid">
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Tabela</span>
                  <strong>{entry.tableName}</strong>
                </div>
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Registro</span>
                  <strong>{entry.recordLabel}</strong>
                </div>
                {entry.semesterCode ? (
                  <div className="audit-table-details-item">
                    <span className="audit-table-details-label">Semestre relacionado</span>
                    <strong>{entry.semesterCode}</strong>
                  </div>
                ) : null}
              </div>
              <div className="audit-table-details-summary">
                <span className="audit-table-details-label">Resumo completo</span>
                <p>{entry.summary}</p>
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
