import Link from "next/link";
import type { Route } from "next";
import type { ProfessorEvaluationListItem } from "@/services/evaluations";

interface EvaluationTableProps {
  evaluations: ProfessorEvaluationListItem[];
}

function statusLabel(status: ProfessorEvaluationListItem["status"]) {
  switch (status) {
    case "rascunho":
      return "Rascunho";
    case "publicado":
      return "Publicado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

export function EvaluationTable({ evaluations }: EvaluationTableProps) {
  return (
    <div className="table-wrap evaluation-table-wrap">
      <table className="table evaluation-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Lançamento</th>
            <th>Status</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {evaluations.map((evaluation) => (
            <tr key={evaluation.id}>
              <td className="evaluation-table-student-cell">
                <strong>{evaluation.studentName}</strong>
                <div className="table-helper">
                  {evaluation.registration} · {evaluation.className} · {evaluation.semesterCode}
                </div>
                <div className="table-helper">
                  {evaluation.versionLabel}
                  {evaluation.relationHint ? ` · ${evaluation.relationHint}` : ""}
                </div>
              </td>
              <td className="evaluation-table-launch-cell">
                <div>{evaluation.reference}</div>
                {evaluation.isLegacyRecord ? (
                  <div className="table-helper">
                    <span className="badge badge-muted">Registro legado</span>
                  </div>
                ) : null}
              </td>
              <td className="evaluation-table-status-cell">
                <span className={`status-pill status-${evaluation.status}`}>
                  {statusLabel(evaluation.status)}
                </span>
              </td>
              <td className="evaluation-table-actions-cell">
                <Link
                  href={`/avaliacoes/${evaluation.id}` as Route}
                  className="button button-secondary button-small"
                >
                  {evaluation.actionLabel}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


