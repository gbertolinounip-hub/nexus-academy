import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime, formatPercentage } from "@/lib/utils/format";
import { getAuthenticatedClosedSemesterAreaDetail } from "@/services/audit";
import { getAuthenticatedClassFinalReport } from "@/services/reports";

export default async function ClosedSemesterAreaAuditPage(props: {
  params: Promise<{
    semesterId: string;
    classId: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const { semesterId, classId } = await props.params;
  const [areaDetail, classReportResult] = await Promise.all([
    getAuthenticatedClosedSemesterAreaDetail(currentUser, semesterId, classId),
    getAuthenticatedClassFinalReport(currentUser, classId, {
      semesterId,
      includeHistoricalStudents: true
    })
  ]);
  const report = classReportResult.report;

  if (!areaDetail || !report) {
    return (
      <div className="stack audit-page">
        <section className="hero-card">
          <p className="eyebrow">Auditoria por área</p>
          <h1>Área encerrada não encontrada</h1>
          <p>
            Não foi possível localizar esta área arquivada dentro do semestre
            selecionado.
          </p>
          <div className="actions-row">
            <a
              href={semesterId ? `/auditoria?semestre=${encodeURIComponent(semesterId)}` : "/auditoria"}
              className="button button-secondary"
            >
              Voltar para auditoria
            </a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack audit-page audit-area-page">
      <section className="hero-card">
        <p className="eyebrow">Auditoria por área encerrada</p>
        <h1>{areaDetail.area.areaName}</h1>
        <p>
          {areaDetail.area.classCode} · {areaDetail.semester.code} ·{" "}
          {areaDetail.area.blockName}
        </p>
        <div className="actions-row">
          <a
            href={`/auditoria?semestre=${encodeURIComponent(areaDetail.semester.id)}`}
            className="button button-secondary"
          >
            Voltar ao semestre encerrado
          </a>
          <a
            href={`/relatorios/turmas/${areaDetail.area.classId}?from=audit&semestre=${encodeURIComponent(areaDetail.semester.id)}&print=1`}
            className="button"
          >
            Imprimir relatório final
          </a>
          <a
            href={`/relatorios/export/turmas/${areaDetail.area.classId}/excel?semestre=${encodeURIComponent(areaDetail.semester.id)}`}
            className="button button-secondary"
          >
            Exportar Excel
          </a>
        </div>
      </section>

      <SectionCard
        title="Contexto histórico da área"
        description="Dados principais da área arquivada e do encerramento do semestre."
      >
        <div className="report-identity-grid audit-area-identity-grid">
          <div className="management-student-summary-item">
            <span>Semestre</span>
            <strong>{areaDetail.semester.name}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Encerrado em</span>
            <strong>{formatDateTime(areaDetail.semester.archivedAt)}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Encerrado por</span>
            <strong>{areaDetail.semester.archivedByName}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Turma</span>
            <strong>{areaDetail.area.className}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Área</span>
            <strong>{areaDetail.area.areaName}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Responsáveis</span>
            <strong>
              {areaDetail.area.supervisorNames.length
                ? areaDetail.area.supervisorNames.join(", ")
                : "Sem supervisor definido"}
            </strong>
          </div>
        </div>
      </SectionCard>

      <div className="metrics-grid">
        <MetricCard
          label="Alunos arquivados"
          value={String(report.summary.totalStudents)}
          hint="Alunos preservados no fechamento desta área."
        />
        <MetricCard
          label="Média final"
          value={formatPercentage(report.summary.averageFinalPercentage)}
          hint="Média consolidada da área no semestre encerrado."
          tone="positive"
        />
        <MetricCard
          label="Avaliações publicadas"
          value={String(report.summary.totalPublishedEvaluations)}
          hint="Lançamentos que sustentam o fechamento acadêmico."
        />
        <MetricCard
          label="Alunos em atenção"
          value={String(report.summary.studentsAtRisk)}
          hint="Casos que mereciam acompanhamento no encerramento."
          tone="alert"
        />
      </div>

      <SectionCard
        title="Alunos arquivados da área"
        description="Consulta histórica resumida dos alunos vinculados a esta área no semestre encerrado."
      >
        {report.students.length ? (
          <div className="table-wrap audit-area-student-table-wrap">
            <table className="table report-table audit-area-student-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Contato</th>
                  <th>Total final</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((student) => (
                  <tr key={student.enrollmentId}>
                    <td className="report-table-primary-cell">
                      <div>{student.studentName}</div>
                      <div className="table-helper">RA {student.registration}</div>
                    </td>
                    <td className="report-table-text-cell">
                      <div>{student.email}</div>
                      <div className="table-helper">
                        {student.cellphone ?? "Celular não informado"}
                      </div>
                    </td>
                    <td>{formatPercentage(student.finalPercentage)}</td>
                    <td>
                      <a
                        href={`/auditoria/semestres/${encodeURIComponent(areaDetail.semester.id)}/areas/${encodeURIComponent(areaDetail.area.classId)}/alunos/${encodeURIComponent(student.studentId)}?matricula=${encodeURIComponent(student.enrollmentId)}`}
                        className="button button-secondary button-small"
                      >
                        Ver aluno
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Nenhum aluno foi encontrado para esta área arquivada.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
