import { SectionCard } from "@/components/common/section-card";
import type { ClinicalAttendanceIndicatorsBreakdownRow } from "@/services/clinical-indicators";

interface ClinicalAttendanceBreakdownTableProps {
  title: string;
  description: string;
  rows: ClinicalAttendanceIndicatorsBreakdownRow[];
  emptyMessage: string;
}

export function ClinicalAttendanceBreakdownTable({
  title,
  description,
  rows,
  emptyMessage
}: ClinicalAttendanceBreakdownTableProps) {
  return (
    <SectionCard
      title={title}
      description={description}
      className="clinical-indicators-breakdown-card"
    >
      <div className="table-wrap clinical-indicators-breakdown-table-wrap">
        <table className="table clinical-indicators-breakdown-table">
          <thead>
            <tr>
              <th>Recorte</th>
              <th>Atendimentos</th>
              <th>Ausências</th>
              <th>Pendências</th>
              <th>Enviadas</th>
              <th>Ajustes</th>
              <th>Aprovadas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="clinical-indicators-breakdown-identity">
                    <strong>{row.label}</strong>
                    {row.sublabel ? <div className="table-helper">{row.sublabel}</div> : null}
                  </td>
                  <td>{row.attendancesPerformed}</td>
                  <td>{row.absentPatients}</td>
                  <td>{row.openEvolutions}</td>
                  <td>{row.sentForReview}</td>
                  <td>{row.adjustmentRequests}</td>
                  <td>{row.approvedEvolutions}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>{emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
