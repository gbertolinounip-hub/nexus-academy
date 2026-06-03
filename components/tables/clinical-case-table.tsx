import Link from "next/link";
import type { Route } from "next";
import {
  formatClinicalCaseStatus,
  formatClinicalScheduleLabel
} from "@/lib/utils/format";
import type { ClinicalCaseSummary } from "@/types/domain";

interface ClinicalCaseTableProps {
  cases: ClinicalCaseSummary[];
  showCaseAction?: boolean;
}

export function ClinicalCaseTable({
  cases,
  showCaseAction = true
}: ClinicalCaseTableProps) {
  return (
    <div className="table-wrap clinical-case-table-wrap">
      <table className="table clinical-case-table">
        <thead>
          <tr>
            <th>Paciente</th>
            <th>Estagiário</th>
            <th>Área</th>
            <th>Atendimentos</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((caseItem) => (
            <tr key={caseItem.id}>
              <td className="clinical-case-table-patient-cell">
                <div className="clinical-case-table-patient-heading">
                  <strong>{caseItem.patient.name}</strong>
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
                </div>
                <div className="table-helper">
                  {caseItem.patient.identifier}
                  {caseItem.patient.contact ? ` - ${caseItem.patient.contact}` : ""}
                </div>
              </td>
              <td className="clinical-case-table-student-cell">
                <strong>{caseItem.studentName}</strong>
                <div className="table-helper">
                  {caseItem.registration} - {caseItem.className}
                </div>
              </td>
              <td className="clinical-case-table-area-cell">
                <div>{caseItem.areaName}</div>
                <div className="table-helper">{caseItem.semesterCode}</div>
              </td>
              <td className="clinical-case-table-schedule-cell">
                <div className="clinical-case-table-schedule-list">
                  {caseItem.schedules.map((schedule) => (
                    <div key={schedule.id} className="table-helper">
                      {formatClinicalScheduleLabel(
                        schedule.weekday,
                        schedule.appointmentTime
                      )}
                    </div>
                  ))}
                </div>
              </td>
              <td className="clinical-case-table-status-cell">
                <span className={`status-pill status-${caseItem.status}`}>
                  {formatClinicalCaseStatus(caseItem.status)}
                </span>
              </td>
              <td className="clinical-case-table-actions-cell">
                {showCaseAction ? (
                  <Link
                    href={`/clinica-supervisionada/${caseItem.id}` as Route}
                    className="button button-secondary button-small"
                  >
                    Abrir caso
                  </Link>
                ) : (
                  <span className="table-helper">
                    Visualização clínica restrita
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
