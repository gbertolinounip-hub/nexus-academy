import { formatClinicalScheduleLabel, formatDate } from "@/lib/utils/format";
import type { ClinicalCaseSummary } from "@/types/domain";

interface ClinicalPrintCaseSummaryProps {
  caseItem: ClinicalCaseSummary;
  statusLabel?: string;
  statusValue?: string | null;
}

export function ClinicalPrintCaseSummary({
  caseItem,
  statusLabel,
  statusValue
}: ClinicalPrintCaseSummaryProps) {
  return (
    <div className="clinical-case-summary-grid">
      <div className="report-mini-card">
        <span>Paciente</span>
        <strong>{caseItem.patient.name}</strong>
      </div>
      <div className="report-mini-card">
        <span>Identificador</span>
        <strong>{caseItem.patient.identifier}</strong>
      </div>
      <div className="report-mini-card">
        <span>Estagiário</span>
        <strong>{caseItem.studentName}</strong>
      </div>
      <div className="report-mini-card">
        <span>Supervisor</span>
        <strong>{caseItem.professorName}</strong>
      </div>
      {statusLabel && statusValue ? (
        <div className="report-mini-card">
          <span>{statusLabel}</span>
          <strong>{statusValue}</strong>
        </div>
      ) : null}
      <div className="report-mini-card">
        <span>Área</span>
        <strong>{caseItem.areaName}</strong>
      </div>
      <div className="report-mini-card">
        <span>Semestre</span>
        <strong>{caseItem.semesterCode}</strong>
      </div>
      <div className="report-mini-card">
        <span>Início do caso</span>
        <strong>{formatDate(caseItem.startedAt)}</strong>
      </div>
      <div className="report-mini-card">
        <span>Dias e horários</span>
        <strong className="clinical-case-summary-schedule-list">
          {caseItem.schedules.map((schedule) => (
            <span key={schedule.id}>
              {formatClinicalScheduleLabel(schedule.weekday, schedule.appointmentTime)}
            </span>
          ))}
        </strong>
      </div>
      {caseItem.patient.contact ? (
        <div className="report-mini-card">
          <span>Contato</span>
          <strong>{caseItem.patient.contact}</strong>
        </div>
      ) : null}
      {caseItem.patient.companion ? (
        <div className="report-mini-card">
          <span>Acompanhante</span>
          <strong>{caseItem.patient.companion}</strong>
        </div>
      ) : null}
    </div>
  );
}
