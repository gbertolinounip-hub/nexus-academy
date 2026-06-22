import Link from "next/link";
import type { Route } from "next";
import {
  formatClinicalAttendanceEvolutionStatus,
  formatDate
} from "@/lib/utils/format";
import type {
  ClinicalAttendanceEvolutionStatus,
  ClinicalPendingEvolutionSummary
} from "@/types/domain";

interface ClinicalPendingEvolutionTableProps {
  items: ClinicalPendingEvolutionSummary[];
  viewerRole: "professor" | "aluno" | "secretaria";
  emptyMessage: string;
}

function resolvePendingHref(
  item: ClinicalPendingEvolutionSummary,
  viewerRole: "professor" | "aluno" | "secretaria"
): Route | null {
  if (viewerRole === "secretaria") {
    return null;
  }

  if (viewerRole === "aluno") {
    return item.evolutionRecordId
      ? (`/clinica-supervisionada/${item.caseItem.id}/evolucao/${item.evolutionRecordId}` as Route)
      : (`/clinica-supervisionada/${item.caseItem.id}/evolucao/nova?attendanceId=${item.attendanceId}` as Route);
  }

  return item.evolutionRecordId
    ? (`/clinica-supervisionada/${item.caseItem.id}/evolucao/${item.evolutionRecordId}` as Route)
    : (`/clinica-supervisionada/${item.caseItem.id}` as Route);
}

function resolvePendingActionLabel(
  item: ClinicalPendingEvolutionSummary,
  viewerRole: "professor" | "aluno" | "secretaria"
) {
  if (viewerRole === "secretaria") {
    return null;
  }

  if (viewerRole === "aluno") {
    return item.evolutionRecordId ? "Abrir evolução" : "Registrar evolução";
  }

  return item.evolutionRecordId ? "Revisar evolução" : "Abrir caso";
}

function formatOpenDaysLabel(openDays: number) {
  if (openDays <= 0) {
    return "Atendimento de hoje";
  }

  if (openDays === 1) {
    return "Pendente há 1 dia";
  }

  return `Pendente há ${openDays} dias`;
}

function renderPendingItem(
  item: ClinicalPendingEvolutionSummary,
  viewerRole: "professor" | "aluno" | "secretaria"
) {
  const actionHref = resolvePendingHref(item, viewerRole);
  const actionLabel = resolvePendingActionLabel(item, viewerRole);

  return (
    <article key={item.attendanceId} className="clinical-pending-evolution-item">
      <div className="clinical-pending-evolution-copy">
        <div className="clinical-pending-evolution-header">
          <div>
            <strong>{item.caseItem.patient.name}</strong>
            <p>
              Atendimento em {formatDate(item.appointmentDate)} • {item.appointmentTime} •{" "}
              {item.caseItem.areaName}
            </p>
          </div>
          <span className={`status-pill status-${item.evolutionStatus}`}>
            {formatClinicalAttendanceEvolutionStatus(item.evolutionStatus)}
          </span>
        </div>

        <div className="clinical-pending-evolution-meta">
          <span>Aluno: {item.caseItem.studentName}</span>
          <span>Professor: {item.caseItem.professorName}</span>
          <span>Turma: {item.caseItem.className}</span>
          <span>{formatOpenDaysLabel(item.openDays)}</span>
        </div>

        {item.administrativeNote?.trim() ? (
          <p className="clinical-pending-evolution-note">
            <strong>Observação administrativa:</strong> {item.administrativeNote}
          </p>
        ) : null}
      </div>

      <div className="clinical-pending-evolution-actions">
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="button button-secondary button-small">
            {actionLabel}
          </Link>
        ) : (
          <span className="helper-text">Acompanhamento informativo</span>
        )}
      </div>
    </article>
  );
}

export function ClinicalPendingEvolutionTable({
  items,
  viewerRole,
  emptyMessage
}: ClinicalPendingEvolutionTableProps) {
  if (!items.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  const orderedGroups: Array<{
    status: ClinicalAttendanceEvolutionStatus;
    title: string;
    description: string;
  }> = [
    {
      status: "pendente",
      title: "Pendentes",
      description:
        "Atendimentos presentes que ainda aguardam o registro inicial da evolução."
    },
    {
      status: "enviada",
      title: "Enviadas para revisão",
      description:
        "Evoluções já enviadas pelo aluno e que ainda dependem do parecer da supervisão."
    },
    {
      status: "ajustes_solicitados",
      title: "Ajustes solicitados",
      description:
        "Evoluções devolvidas pela supervisão e que ainda precisam ser ajustadas pelo aluno."
    }
  ];

  return (
    <div className="stack">
      {orderedGroups
        .map((group) => ({
          ...group,
          items: items.filter((item) => item.evolutionStatus === group.status)
        }))
        .filter((group) => group.items.length)
        .map((group) => (
          <section key={group.status} className="stack">
            <div>
              <h3>{group.title}</h3>
              <p className="helper-text">{group.description}</p>
            </div>

            <div className="clinical-pending-evolution-list">
              {group.items.map((item) => renderPendingItem(item, viewerRole))}
            </div>
          </section>
        ))}
    </div>
  );
}
