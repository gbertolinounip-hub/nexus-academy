import Link from "next/link";
import type { Route } from "next";
import {
  formatClinicalCaseStatus,
  formatClinicalScheduleLabel
} from "@/lib/utils/format";
import type { ClinicalCaseSummary } from "@/types/domain";

interface ClinicalCaseCardProps {
  caseItem: ClinicalCaseSummary;
}

export function ClinicalCaseCard({ caseItem }: ClinicalCaseCardProps) {
  return (
    <article className="clinical-case-card">
      <div className="clinical-case-card-header">
        <div>
          <h3>{caseItem.patient.name}</h3>
          <p>
            {caseItem.patient.identifier} - {caseItem.areaName}
          </p>
        </div>
        <div className="clinical-case-card-badges">
          {caseItem.notificationLabel ? (
            <span
              className={`clinical-case-notification-badge clinical-case-notification-${caseItem.notificationType}`}
            >
              {caseItem.notificationLabel}
              {caseItem.notificationUnreadCount > 1
                ? ` · ${caseItem.notificationUnreadCount}`
                : ""}
            </span>
          ) : null}
          <span className={`status-pill status-${caseItem.status}`}>
            {formatClinicalCaseStatus(caseItem.status)}
          </span>
        </div>
      </div>

      <div className="clinical-case-card-body">
        <div className="clinical-case-schedule-list">
          {caseItem.schedules.map((schedule) => (
            <p key={schedule.id} className="clinical-case-card-copy">
              Atendimento:{" "}
              {formatClinicalScheduleLabel(schedule.weekday, schedule.appointmentTime)}
            </p>
          ))}
        </div>
        <p className="clinical-case-card-copy">Supervisor: {caseItem.professorName}</p>
        {caseItem.patient.companion ? (
          <p className="clinical-case-card-copy">
            Acompanhante: {caseItem.patient.companion}
          </p>
        ) : null}
        {caseItem.patient.contact ? (
          <p className="clinical-case-card-copy">Contato: {caseItem.patient.contact}</p>
        ) : null}
      </div>

      <div className="clinical-case-card-actions">
        <Link
          href={`/clinica-supervisionada/${caseItem.id}` as Route}
          className="button button-small"
        >
          Abrir caso
        </Link>
        <Link
          href={`/clinica-supervisionada/${caseItem.id}/avaliacao` as Route}
          className="button button-secondary button-small"
        >
          Avaliação
        </Link>
        <Link
          href={`/clinica-supervisionada/${caseItem.id}/plano-tratamento` as Route}
          className="button button-secondary button-small"
        >
          Plano de tratamento
        </Link>
        <Link
          href={`/clinica-supervisionada/${caseItem.id}/evolucao` as Route}
          className="button button-secondary button-small"
        >
          Evolução
        </Link>
      </div>
    </article>
  );
}
