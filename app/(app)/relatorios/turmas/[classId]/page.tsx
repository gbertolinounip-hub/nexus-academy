import type { Route } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/common/brand-lockup";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ReportAutoPrint } from "@/components/reports/report-auto-print";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { requireRole } from "@/lib/auth/session";
import {
  formatPercentage,
  formatStudentStatusBadge
} from "@/lib/utils/format";
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
  const currentUser = await requireRole(["coordenador", "professor"]);
  const { classId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const origin = Array.isArray(resolvedSearchParams.from)
    ? resolvedSearchParams.from[0]
    : resolvedSearchParams.from;
  const semesterId = Array.isArray(resolvedSearchParams.semestre)
    ? resolvedSearchParams.semestre[0]
    : resolvedSearchParams.semestre;
  const shouldAutoPrint =
    (Array.isArray(resolvedSearchParams.print)
      ? resolvedSearchParams.print[0]
      : resolvedSearchParams.print) === "1";
  const { report, emptyState } = await getAuthenticatedClassFinalReport(
    currentUser,
    classId
  );
  const backHref: Route =
    origin === "audit" && semesterId
      ? (`/auditoria/semestres/${semesterId}/areas/${classId}` as Route)
      : (`/relatorios?semestre=${report?.students[0]?.semesterId ?? ""}` as Route);

  return (
    <div className="stack reports-dashboard class-final-report">
      <ReportAutoPrint enabled={shouldAutoPrint} />

      <section className="hero-card class-final-report-hero">
        <div className="report-hero-brand">
          <BrandLockup
            eyebrow={"Plataforma acad\u00eamica"}
            subtitle={"Desempenho e gest\u00e3o de est\u00e1gios"}
          />
        </div>
        <p className="eyebrow">{"Relat\u00f3rio final por turma"}</p>
        <h1>{report?.classGroup.name ?? "Turma n\u00e3o identificada"}</h1>
        <p>
          {report
            ? `${report.classGroup.code} \u00b7 ${report.classGroup.semesterCode} \u00b7 ${report.classGroup.areaName}`
            : "N\u00e3o foi poss\u00edvel consolidar o fechamento desta turma."}
        </p>
        {report ? (
          <div className="actions-row report-screen-only">
            <ReportPrintButton />
            <a
              href={`/relatorios/export/turmas/${report.classGroup.id}/csv`}
              className="button button-secondary"
            >
              Exportar CSV
            </a>
            <a
              href={`/relatorios/export/turmas/${report.classGroup.id}/excel`}
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
            description={
              "Identifica\u00e7\u00e3o acad\u00eamica e escopo de supervis\u00e3o usado na consolida\u00e7\u00e3o."
            }
            className="class-final-report-context-card"
            actions={
              <Link href={backHref} className="button button-secondary">
                {origin === "audit"
                  ? "Voltar \u00e0 auditoria"
                  : "Voltar aos relat\u00f3rios"}
              </Link>
            }
          >
            <div className="report-identity-grid class-final-report-identity-grid">
              <div className="management-student-summary-item class-final-report-identity-item">
                <span>{"C\u00f3digo"}</span>
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
                <span>{"\u00c1rea de est\u00e1gio"}</span>
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
              hint={"Alunos consolidados neste relat\u00f3rio final."}
            />
            <MetricCard
              label={"M\u00e9dia geral"}
              value={formatPercentage(report.summary.averageFinalPercentage)}
              hint={"M\u00e9dia final consolidada da turma."}
              tone="positive"
            />
            <MetricCard
              label={"Avalia\u00e7\u00f5es publicadas"}
              value={String(report.summary.totalPublishedEvaluations)}
              hint={"Lan\u00e7amentos publicados que sustentam o fechamento."}
            />
            <MetricCard
              label={"Conclus\u00e3o m\u00e9dia"}
              value={formatPercentage(report.summary.completionAverage)}
              hint={"Percentual m\u00e9dio de crit\u00e9rios com fechamento publicado."}
            />
            <MetricCard
              label={"Horas n\u00e3o justificadas"}
              value={`${report.summary.totalUnjustifiedAbsenceHours}h`}
              hint="Penalidade total consolidada na turma."
              tone="alert"
            />
            <MetricCard
              label={"Alunos em aten\u00e7\u00e3o"}
              value={String(report.summary.studentsAtRisk)}
              hint={"Casos que pedem acompanhamento mais pr\u00f3ximo."}
              tone="alert"
            />
          </div>

          <div className="split-grid">
            <SectionCard
              title="Panorama resumido"
              description={
                "Leitura r\u00e1pida para fechamento acad\u00eamico e tomada de decis\u00e3o."
              }
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
            title={"Composi\u00e7\u00e3o e situa\u00e7\u00e3o da turma"}
            description={
              "Lista de alunos com indicadores principais e acesso ao relat\u00f3rio individual."
            }
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
                      <th>{"Conclus\u00e3o"}</th>
                      <th>{"Situa\u00e7\u00e3o"}</th>
                      <th>{"A\u00e7\u00f5es"}</th>
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
                            {student.cellphone ?? "Celular n\u00e3o informado"}
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
                              ? "Ver relat\u00f3rio da \u00e1rea"
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
          title={emptyState?.title ?? "Relat\u00f3rio indispon\u00edvel"}
          description={
            emptyState?.description ??
            "N\u00e3o foi poss\u00edvel montar o relat\u00f3rio final desta turma."
          }
          actions={
            <Link href="/relatorios" className="button button-secondary">
              {"Voltar aos relat\u00f3rios"}
            </Link>
          }
        >
          <p className="empty-message">
            {
              "Quando houver turma, matr\u00edculas, lan\u00e7amentos e faltas consistentes no banco, este fechamento ser\u00e1 exibido aqui."
            }
          </p>
        </SectionCard>
      )}
    </div>
  );
}
