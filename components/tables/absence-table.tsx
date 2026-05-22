import Link from "next/link";
import type { Route } from "next";
import { formatDate } from "@/lib/utils/format";
import type { ProfessorAbsenceListItem } from "@/services/absences";

interface AbsenceTableProps {
  absences: ProfessorAbsenceListItem[];
}

export function AbsenceTable({ absences }: AbsenceTableProps) {
  return (
    <div className="table-wrap absence-table-wrap">
      <table className="table absence-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Data</th>
            <th>Horas</th>
            <th>Situação</th>
            <th>Motivo</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {absences.map((absence) => (
            <tr key={absence.id}>
              <td className="absence-table-student-cell">
                <strong>{absence.studentName}</strong>
                <div className="table-helper">
                  {absence.registration} · {absence.className} · {absence.semesterCode}
                </div>
              </td>
              <td className="absence-table-date-cell">{formatDate(absence.date)}</td>
              <td className="absence-table-hours-cell">
                {absence.hours.toFixed(2).replace(".", ",")}h
              </td>
              <td className="absence-table-status-cell">
                <span
                  className={`status-pill ${
                    absence.justified
                      ? "status-justificada"
                      : "status-nao-justificada"
                  }`}
                >
                  {absence.justified ? "Justificada" : "Não justificada"}
                </span>
              </td>
              <td className="absence-table-reason-cell">
                {absence.reason ?? "Sem motivo informado"}
              </td>
              <td className="absence-table-actions-cell">
                <Link
                  href={`/ausencias/${absence.id}` as Route}
                  className="button button-secondary button-small"
                >
                  Visualizar / editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


