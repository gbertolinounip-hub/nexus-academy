import { formatPercentage } from "@/lib/utils/format";
import type { ProfessorStudentSummary } from "@/types/domain";

interface StudentTableProps {
  students: ProfessorStudentSummary[];
}

function statusLabel(status: ProfessorStudentSummary["status"]) {
  switch (status) {
    case "critico":
      return "Crítico";
    case "atencao":
      return "Atenção";
    default:
      return "Satisfatório";
  }
}

export function StudentTable({ students }: StudentTableProps) {
  return (
    <div className="table-wrap">
      <table className="table student-table">
        <thead>
          <tr>
            <th>Aluno</th>
            <th>Matrícula</th>
            <th>Contato</th>
            <th>Turma</th>
            <th>Subtotal</th>
            <th>Desconto</th>
            <th>Total</th>
            <th>Conclusão</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.enrollmentId}>
              <td className="student-table-student-cell">{student.studentName}</td>
              <td>{student.registration}</td>
              <td className="student-table-contact-cell">
                <div>{student.email}</div>
                <div className="table-helper">
                  {student.cellphone ?? "Celular não informado"}
                </div>
              </td>
              <td className="student-table-class-cell">{student.className}</td>
              <td>{formatPercentage(student.subtotalPercentage)}</td>
              <td>{formatPercentage(student.absencePenaltyPercentage)}</td>
              <td>{formatPercentage(student.finalPercentage)}</td>
              <td>{formatPercentage(student.completionRate)}</td>
              <td>
                <span className={`status-pill status-${student.status}`}>
                  {statusLabel(student.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


