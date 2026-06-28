import type { Route } from "next";
import Link from "next/link";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ReportBrandLockup } from "@/components/reports/report-brand-lockup";
import { ReportAutoPrint } from "@/components/reports/report-auto-print";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { requireRole } from "@/lib/auth/session";
import {
  formatPercentage,
  formatStudentStatusBadge
} from "@/lib/utils/format";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getAuthenticatedClassFinalReport } from "@/services/reports";

interface ClassFinalReportPageProps {
  params: Promise<{
    classId: string;
  }>;
  searchParams?: Promise<{
    from?: string | string[];
    semestre?: string | string[];
    print?: string | string[];
  }>;
}

export default async function ClassFinalReportPage({
  params,
  searchParams
}: ClassFinalReportPageProps) {
  const currentUser = await requireRole([
    "coordenador",
    "professor",
    "coordenador_master"
  ]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const { classId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const origin = Array.isArray(resolvedSearchParams.from)
    ? resolvedSearchParams.from[0]
    : resolvedSearchParams.from;
  const isAuditOrigin = origin === "audit" || origin === "master-audit";
  const isMasterAuditOrigin = origin === "master-audit";
  const semesterId = Array.isArray(resolvedSearchParams.semestre)
    ? resolvedSearchParams.semestre[0]
    : resolvedSearchParams.semestre;
  const shouldAutoPrint =
    (Array.isArray(resolvedSearchParams.print)
      ? resolvedSearchParams.print[0]
      : resolvedSearchParams.print) === "1";
  const historicalExportQuery =
    isAuditOrigin && semesterId
      ? `?semestre=${encodeURIComponent(semesterId)}${
          origin ? `&from=${encodeURIComponent(origin)}` : ""
        }`
      : "";
  const { report, emptyState } = await getAuthenticatedClassFinalReport(
    currentUser,
    classId,
    isAuditOrigin && semesterId
      ? {
          semesterId,
          includeHistoricalStudents: true
        }
      : undefined
  );
  const backHref: Route =
    isAuditOrigin && semesterId
      ? (isMasterAuditOrigin
          ? `/master/auditoria/semestres/${semesterId}/areas/${classId}`
          : `/auditoria/semestres/${semesterId}/areas/${classId}`) as Route
      : (`/relatorios?semestre=${report?.students[0]?.semesterId ?? ""}` as Route);

  return (
    <div className="stack reports-dashboard class-final-report">
      <ReportAutoPrint enabled={shouldAutoPrint} />

      <section className="hero-card class-final-report-hero">
        <div className="report-hero-brand">
          <ReportBrandLockup
            branding={reportBranding}
            fallbackEyebrow="Plataforma acadêmica"
          />
        </div>
        <p className="eyebrow">Relatório final por turma</p>
        <h1>{report?.classGroup.name ?? "Turma não identificada"}</h1>
        <p>
          {report
            ? `${report.classGroup.code} · ${report.classGroup.semesterCode} · ${report.classGroup.areaName}`
            : "Não foi possível consolidar o fechamento desta turma."}
        </p>
        {report ? (
          <div className="actions-row report-screen-only">
            <ReportPrintButton />
            <a
              href={`/relatorios/export/turmas/${report.classGroup.id}/csv${historicalExportQuery}`}
              className="button button-secondary"
            >
              Exportar CSV
            </a>
            <a
              href={`/relatorios/export/turmas/${report.classGroup.id}/excel${historicalExportQuery}`}
              className="button button-secondary"
            >
              Exportar Excel
            </a>
          </div>
        ) : null}
      </section>

      {report ? (
        <>
          <SectionCard
            title="Contexto da turma"
            description="Identificação acadêmica e escopo de supervisão usado na consolidação."
            className="class-final-report-context-card"
            actions={
              <Link href={backHref} className="button button-secondary">
                {origin === "audit"
                  ? "Voltar à auditoria"
                  : origin === "master-audit"
                    ? "Voltar à auditoria global"
                    : "Voltar aos relatórios"}
              </Link>
            }
          >
            <div className="report-identity-grid class-final-report-identity-grid">
              <div className="management-student-summary-item class-final-report-identity-item">
                <span>Código</span>
                <strong>{report.classGroup.code}</strong>
              </div>
              <div className="management-student-summary-item class-final-report-identity-item is-wide">
                <span>Nome da turma</span>
                <strong>{report.classGroup.name}</strong>
              </div>
              <div className="management-student-summary-item class-final-report-identity-item">
                <span>Semestre</span>
                <strong>{report.classGroup.semesterCode}</strong>
              </div>
              <div className="management-student-summary-item class-final-report-identity-item is-wide">
                <span>Área de estágio</span>
                <strong>{report.classGroup.areaName}</strong>
              </div>
              <div className="management-student-summary-item class-final-report-identity-item">
                <span>Bloco</span>
                <strong>{report.classGroup.blockName}</strong>
              </div>
              <div className="management-student-summary-item class-final-report-identity-item is-full">
                <span>Escopo</span>
                <strong>{report.viewerDescription}</strong>
              </div>
            </div>
          </SectionCard>

          <div className="metrics-grid">
            <MetricCard
              label="Alunos na turma"
              value={String(report.summary.totalStudents)}
              hint="Alunos consolidados neste relatório final."
            />
            <MetricCard
              label="Média geral"
              value={formatPercentage(report.summary.averageFinalPercentage)}
              hint="Média final consolidada da turma."
              tone="positive"
            />
            <MetricCard
              label="Avaliações publicadas"
              value={String(report.summary.totalPublishedEvaluations)}
              hint="Lançamentos publicados que sustentam o fechamento."
            />
            <MetricCard
              label="Conclusão média"
              value={formatPercentage(report.summary.completionAverage)}
              hint="Percentual médio de critérios com fechamento publicado."
            />
            <MetricCard
              label="Horas não justificadas"
              value={`${report.summary.totalUnjustifiedAbsenceHours}h`}
              hint="Penalidade total consolidada na turma."
              tone="alert"
            />
            <MetricCard
              label="Alunos em atenção"
              value={String(report.summary.studentsAtRisk)}
              hint="Casos que pedem acompanhamento mais próximo."
              tone="alert"
            />
          </div>

          <div className="split-grid">
            <SectionCard
              title="Panorama resumido"
              description="Leitura rápida para fechamento acadêmico e tomada de decisão."
            >
              <p className="empty-message">{report.summary.panorama}</p>
            </SectionCard>

            <SectionCard
              title="Supervisores da turma"
              description="Professores vinculados a esta turma neste semestre."
            >
              {report.supervisors.length ? (
                <div className="report-assignment-grid">
                  {report.supervisors.map((professor) => (
                    <article key={professor.id} className="management-stage-summary">
                      <strong>{professor.name}</strong>
                      <span>{professor.email}</span>
                      <span>{professor.linkedStudents} aluno(s) vinculados</span>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-message">
                  Nenhum supervisor foi identificado para esta turma neste semestre.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Composição e situação da turma"
            description="Lista de alunos com indicadores principais e acesso ao relatório individual."
          >
            {report.students.length ? (
              <div className="table-wrap">
                <table className="table report-table report-class-table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Contato</th>
                      <th>Subtotal</th>
                      <th>Desconto</th>
                      <th>Total</th>
                      <th>Conclusão</th>
                      <th>Situação</th>
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
                        <td>{formatPercentage(student.subtotalPercentage)}</td>
                        <td>{formatPercentage(student.absencePenaltyPercentage)}</td>
                        <td>{formatPercentage(student.finalPercentage)}</td>
                        <td>{formatPercentage(student.completionRate)}</td>
                        <td>
                          <span className={`status-pill status-${student.status}`}>
                            {formatStudentStatusBadge(student.status)}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/relatorios/alunos/${student.studentId}?semestre=${student.semesterId}&matricula=${student.enrollmentId}`}
                            className="button button-secondary button-small"
                          >
                            {report.viewerRole === "professor"
                              ? "Ver relatório da área"
                              : "Ver aluno"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                Nenhum aluno com dados suficientes para esta turma.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title={emptyState?.title ?? "Relatório indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível montar o relatório final desta turma."
          }
          actions={
            <Link href={backHref} className="button button-secondary">
              {origin === "audit"
                ? "Voltar à auditoria"
                : origin === "master-audit"
                  ? "Voltar à auditoria global"
                  : "Voltar aos relatórios"}
            </Link>
          }
        >
          <p className="empty-message">
            Quando houver turma, matrículas, lançamentos e faltas consistentes no
            banco, este fechamento será exibido aqui.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
