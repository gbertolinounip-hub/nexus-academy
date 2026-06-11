"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils/format";

interface MasterAuditTableEntry {
  id: string;
  unitName: string;
  actorName: string;
  actorProfileLabel: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  tableName: string;
  recordLabel: string;
  summary: string;
  happenedAt: string;
}

interface MasterAuditTableProps {
  entries: MasterAuditTableEntry[];
}

function actionLabel(action: MasterAuditTableEntry["action"]) {
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

export function MasterAuditTable({ entries }: MasterAuditTableProps) {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  return (
    <div className="table-wrap master-audit-table-wrap master-audit-events-table-scroll">
      <table className="table master-audit-table">
        <colgroup>
          <col className="master-audit-col-when" />
          <col className="master-audit-col-unit" />
          <col className="master-audit-col-action" />
          <col className="master-audit-col-actions" />
        </colgroup>
        <thead>
          <tr>
            <th className="master-audit-head-when">Quando</th>
            <th>Unidade</th>
            <th>Ação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id;

            return (
              <MasterAuditFragmentRow
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

function MasterAuditFragmentRow(props: {
  entry: MasterAuditTableEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { entry, isExpanded, onToggle } = props;

  return (
    <>
      <tr className={isExpanded ? "master-audit-row-expanded" : undefined}>
        <td className="master-audit-cell-when">{formatDateTime(entry.happenedAt)}</td>
        <td>
          <div className="master-audit-cell-content master-audit-cell-content-unit">
            {entry.unitName}
          </div>
        </td>
        <td>
          <span
            className={`status-pill audit-status-pill audit-status-${entry.action.toLowerCase()}`}
          >
            {actionLabel(entry.action)}
          </span>
        </td>
        <td className="master-audit-cell-actions">
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
        <tr className="master-audit-details-row">
          <td colSpan={4}>
            <div className="audit-table-details">
              <div className="audit-table-details-grid">
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Perfil</span>
                  <strong>{entry.actorProfileLabel}</strong>
                </div>
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Responsável</span>
                  <strong>{entry.actorName}</strong>
                </div>
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Tabela</span>
                  <strong>{entry.tableName}</strong>
                </div>
                <div className="audit-table-details-item">
                  <span className="audit-table-details-label">Registro</span>
                  <strong>{entry.recordLabel}</strong>
                </div>
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
