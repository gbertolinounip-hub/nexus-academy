import Link from "next/link";
import type { Route } from "next";
import { ClinicalAttendanceStatusForm } from "@/components/forms/clinical-attendance-status-form";
import {
  formatClinicalAttendanceEvolutionStatus,
  formatClinicalAttendancePresenceStatus,
  formatDate
} from "@/lib/utils/format";
import type { ClinicalAttendanceSummary } from "@/types/domain";

interface ClinicalDailyAttendanceTableProps {
  items: ClinicalAttendanceSummary[];
}

export function ClinicalDailyAttendanceTable({
  items
}: ClinicalDailyAttendanceTableProps) {
  if (!items.length) {
    return (
      <p className="empty-message">
        Nenhum atendimento previsto foi encontrado para os filtros selecionados.
      </p>
    );
  }

  return (
    <div className="table-wrap clinical-attendance-table-wrap">
      <table className="table clinical-attendance-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Caso</th>
            <th>Aluno responsável</th>
            <th>Professor</th>
            <th>Área</th>
            <th>Horário previsto</th>
            <th>Status do paciente</th>
            <th>Status da evolução</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.caseItem.id}:${item.appointmentDate}:${item.scheduleId ?? "legacy"}`}>
              <td className="clinical-attendance-table-patient-cell">
                <strong>{item.caseItem.patient.name}</strong>
                <div className="table-helper">
                  {item.caseItem.patient.identifier} • {formatDate(item.appointmentDate)}
                </div>
              </td>
              <td>
                <strong>{item.caseItem.className}</strong>
                <div className="table-helper">
                  <Link
                    href={`/clinica-supervisionada/${item.caseItem.id}` as Route}
                    className="link-subtle"
                  >
                    Abrir caso
                  </Link>
                </div>
              </td>
              <td>
                <strong>{item.caseItem.studentName}</strong>
                <div className="table-helper">{item.caseItem.registration}</div>
              </td>
              <td>{item.caseItem.professorName}</td>
              <td>
                <div>{item.caseItem.areaName}</div>
                <div className="table-helper">{item.caseItem.semesterCode}</div>
              </td>
              <td>{item.appointmentTime}</td>
              <td className="clinical-attendance-table-status-cell">
                {item.presenceStatus ? (
                  <span className={`status-pill status-${item.presenceStatus}`}>
                    {formatClinicalAttendancePresenceStatus(item.presenceStatus)}
                  </span>
                ) : (
                  <span className="table-helper">Aguardando marcação</span>
                )}
              </td>
              <td className="clinical-attendance-table-status-cell">
                {item.evolutionStatus ? (
                  <div className="clinical-attendance-status-stack">
                    <span className={`status-pill status-${item.evolutionStatus}`}>
                      {formatClinicalAttendanceEvolutionStatus(item.evolutionStatus)}
                    </span>
                    {item.evolutionRecordId ? (
                      <Link
                        href={
                          `/clinica-supervisionada/${item.caseItem.id}/evolucao/${item.evolutionRecordId}` as Route
                        }
                        className="link-subtle"
                      >
                        Abrir evolução
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <span className="table-helper">Sem pendência ainda</span>
                )}
              </td>
              <td className="clinical-attendance-table-actions-cell">
                <ClinicalAttendanceStatusForm item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
