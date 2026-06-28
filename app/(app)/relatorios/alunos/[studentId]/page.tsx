import Link from "next/link";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ReportBrandLockup } from "@/components/reports/report-brand-lockup";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { CriteriaTable } from "@/components/tables/criteria-table";
import { requireRole } from "@/lib/auth/session";
import {
  formatDate,
  formatGradeOutOfTen,
  formatLaunchType,
  formatPercentage
} from "@/lib/utils/format";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getAuthenticatedStudentFinalReport } from "@/services/reports";

interface StudentFinalReportPageProps {
  params: Promise<{
    studentId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

function statusLabelText(status: "bem" | "atencao" | "critico") {
  switch (status) {
    case "bem":
      return "Desempenho satisfatório";
    case "atencao":
      return "Em atenção";
    case "critico":
      return "Situação crítica";
    default:
      return status;
  }
}

export default async function StudentFinalReportPage(
  props: StudentFinalReportPageProps
) {
  const currentUser = await requireRole([
    "coordenador",
    "professor",
    "coordenador_master"
  ]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const { studentId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const requestedSemesterId = readSearchParam(searchParams, "semestre");
  const requestedEnrollmentId = readSearchParam(searchParams, "matricula");
  const origin = readSearchParam(searchParams, "from");
  const sourceClassId = readSearchParam(searchParams, "turma");
  const isAuditOrigin = origin === "audit" || origin === "master-audit";
  const isMasterAuditOrigin = origin === "master-audit";
  const { report, emptyState } = await getAuthenticatedStudentFinalReport(
    currentUser,
    studentId,
    requestedSemesterId,
    requestedEnrollmentId,
    isAuditOrigin
      ? {
          includeHistoricalStudents: true
        }
      : undefined
  );
  const isProfessorAreaReport = report?.reportContext.kind === "area";
  const reportBaseHref =
    isAuditOrigin && requestedSemesterId && sourceClassId
      ? isMasterAuditOrigin
        ? `/master/auditoria/semestres/${encodeURIComponent(requestedSemesterId)}/areas/${encodeURIComponent(sourceClassId)}/alunos/${encodeURIComponent(studentId)}`
        : `/auditoria/semestres/${encodeURIComponent(requestedSemesterId)}/areas/${encodeURIComponent(sourceClassId)}/alunos/${encodeURIComponent(studentId)}`
      : `/relatorios/alunos/${encodeURIComponent(report?.student.id ?? studentId)}`;
  const backHref =
    isAuditOrigin && requestedSemesterId && sourceClassId
      ? isMasterAuditOrigin
        ? `/master/auditoria/semestres/${encodeURIComponent(requestedSemesterId)}/areas/${encodeURIComponent(sourceClassId)}`
        : `/auditoria/semestres/${encodeURIComponent(requestedSemesterId)}/areas/${encodeURIComponent(sourceClassId)}`
      : `/relatorios?semestre=${report?.selectedSemester.id ?? requestedSemesterId ?? ""}`;
  const auditQuerySuffix =
    isAuditOrigin && sourceClassId
      ? `&from=${encodeURIComponent(origin ?? "audit")}&turma=${encodeURIComponent(sourceClassId)}`
      : "";
  const exportQuerySuffix = report
    ? `?semestre=${report.selectedSemester.id}${
        report.reportContext.enrollmentId
          ? `&matricula=${report.reportContext.enrollmentId}`
          : ""
      }${auditQuerySuffix}`
    : "";

  return (
    <div className="stack reports-dashboard student-final-report">
      <section className="hero-card student-final-report-hero">
        <div className="report-hero-brand">
          <ReportBrandLockup
            branding={reportBranding}
            fallbackEyebrow="Plataforma acadêmica"
          />
        </div>
        <p className="eyebrow">
          {isProfessorAreaReport
            ? "Relatório final da área"
            : "Relatório final por aluno"}
        </p>
        <h1>{report?.student.name ?? "Aluno não identificado"}</h1>
        <p>
          {report
            ? isProfessorAreaReport
              ? `${report.reportContext.areaName} · ${report.reportContext.blockName} · ${report.reportContext.classCode}`
              : `Fechamento acadêmico de ${report.selectedSemester.code} · ${report.selectedSemester.name}.`
            : "Não foi possível carregar o recorte final deste aluno."}
        </p>
        {isProfessorAreaReport ? (
          <p className="table-helper report-screen-only">
            Este relatório está restrito à matrícula/área selecionada para este
            supervisor.
          </p>
        ) : null}
        {report ? (
          <div className="actions-row report-screen-only">
            <ReportPrintButton />
            <a
              href={`/relatorios/export/alunos/${report.student.id}/csv${exportQuerySuffix}`}
              className="button button-secondary"
            >
              {isProfessorAreaReport ? "Exportar CSV da área" : "Exportar CSV"}
            </a>
            <a
              href={`/relatorios/export/alunos/${report.student.id}/excel${exportQuerySuffix}`}
              className="button button-secondary"
            >
              {isProfessorAreaReport ? "Exportar Excel da área" : "Exportar Excel"}
            </a>
          </div>
        ) : null}
      </section>

      {report ? (
        <>
          <div className="report-screen-only">
            <SectionCard
              title="Navegação do relatório"
              description={
                isProfessorAreaReport
                  ? "Troque o semestre para consultar o histórico desta área no escopo do supervisor."
                  : "Troque o semestre para consultar o histórico consolidado deste aluno."
              }
              actions={
                <div className="actions-row">
                  <a href={backHref} className="button button-secondary">
                    {origin === "audit"
                      ? "Voltar à área arquivada"
                      : origin === "master-audit"
                        ? "Voltar à área arquivada do Master"
                        : "Voltar aos relatórios"}
                  </a>
                </div>
              }
            >
              <div className="report-chip-list">
                {report.availableSemesters.map((semester) => {
                  const active = semester.value === report.selectedSemester.id;

                  return (
                    <a
                      key={semester.value}
                      href={`${reportBaseHref}?semestre=${semester.value}${
                        semester.enrollmentId ? `&matricula=${semester.enrollmentId}` : ""
                      }${auditQuerySuffix}`}
                      className={`report-chip${active ? " report-chip-active" : ""}`}
                    >
                      {semester.label}
                    </a>
                  );
                })}
              </div>
              <p className="empty-message">{report.viewerDescription}</p>
            </SectionCard>
          </div>

          <SectionCard
            title="Identificação do aluno"
            description="Dados cadastrais permanentes e contexto semestral do estágio."
            className="student-final-report-identification-card"
          >
            <div className="report-identity-grid student-final-report-identity-grid">
              <div className="management-student-summary-item student-final-report-identity-item is-wide">
                <span>Nome completo</span>
                <strong>{report.student.name}</strong>
              </div>
              <div className="management-student-summary-item student-final-report-identity-item">
                <span>RA</span>
                <strong>{report.student.registration}</strong>
              </div>
              <div className="management-student-summary-item student-final-report-identity-item">
                <span>Semestre</span>
                <strong>{report.selectedSemester.code}</strong>
              </div>
              <div className="management-student-summary-item student-final-report-identity-item">
                <span>Celular</span>
                <strong>{report.student.cellphone ?? "Não informado"}</strong>
              </div>
              <div className="management-student-summary-item student-final-report-identity-item is-wide">
                <span>E-mail</span>
                <strong>{report.student.email}</strong>
              </div>
              <div className="management-student-summary-item student-final-report-identity-item is-full">
                <span>Áreas cursadas</span>
                <strong>
                  {report.assignments.map((assignment) => assignment.areaName).join(", ")}
                </strong>
              </div>
            </div>
          </SectionCard>

          <div className="metrics-grid student-final-report-metrics-grid">
            <MetricCard
              label="Subtotal consolidado"
              value={formatPercentage(report.summary.subtotalPercentage)}
              hint="Média das áreas cursadas antes do desconto por faltas."
              tone="positive"
            />
            <MetricCard
              label="Desconto por faltas"
              value={formatPercentage(report.summary.absencePenaltyPercentage)}
              hint="Penalidade média aplicada apenas sobre ausências não justificadas."
              tone="alert"
            />
            <MetricCard
              label="Nota final consolidada"
              value={formatPercentage(report.summary.finalPercentage)}
              hint={`Equivalente a ${formatGradeOutOfTen(
                report.summary.finalGradeOutOfTen
              )} / 10 no fechamento do semestre.`}
              tone="positive"
            />
            <MetricCard
              label="Conclusão dos critérios"
              value={formatPercentage(report.summary.completionRate)}
              hint="Percentual médio de critérios com lançamento publicado."
            />
          </div>

          <SectionCard
            title="Resumo final do semestre"
            description="Situação geral consolidada para acompanhamento acadêmico."
            className="student-final-report-summary-card"
          >
            <div className="report-summary-banner">
              <span
                className={`status-pill status-${report.summary.status} student-final-report-summary-status`}
              >
                {statusLabelText(report.summary.status)}
              </span>
              <p>{report.summary.statusSummary}</p>
            </div>
            <div className="report-assignment-grid student-final-report-assignment-grid">
              {report.assignments.map((assignment) => (
                <article
                  key={assignment.enrollmentId}
                  className="management-stage-summary"
                >
                  <strong>
                    {assignment.areaName} · {assignment.blockName}
                  </strong>
                  <span>
                    {assignment.classCode} · {assignment.className}
                  </span>
                  <span>
                    Supervisão:{" "}
                    {assignment.supervisors.length
                      ? assignment.supervisors.join(", ")
                      : "Sem supervisor identificado"}
                  </span>
                </article>
              ))}
            </div>
          </SectionCard>

          {report.areaReports.map((areaReport) => (
            <SectionCard
              key={areaReport.enrollmentId}
              title={`${areaReport.areaName} · ${areaReport.blockName}`}
              description={`${areaReport.classCode} · ${areaReport.className}`}
              className="student-final-report-area-card"
            >
              <div className="report-mini-grid student-final-report-mini-grid">
                <div className="report-mini-card">
                  <span>Supervisores</span>
                  <strong>
                    {areaReport.supervisors.length
                      ? areaReport.supervisors.map((professor) => professor.name).join(", ")
                      : "Sem supervisor identificado"}
                  </strong>
                </div>
                <div className="report-mini-card">
                  <span>Subtotal</span>
                  <strong>{formatPercentage(areaReport.subtotalPercentage)}</strong>
                </div>
                <div className="report-mini-card">
                  <span>Penalidade</span>
                  <strong>
                    {formatPercentage(areaReport.absencePenaltyPercentage)}
                  </strong>
                </div>
                <div className="report-mini-card student-final-report-highlight-card">
                  <span>Total final</span>
                  <strong>{formatPercentage(areaReport.finalPercentage)}</strong>
                </div>
                <div className="report-mini-card student-final-report-highlight-card student-final-report-highlight-card-secondary">
                  <span>Equivalente</span>
                  <strong>{formatGradeOutOfTen(areaReport.finalGradeOutOfTen)} / 10</strong>
                </div>
                <div className="report-mini-card student-final-report-highlight-card student-final-report-status-card">
                  <span>Situação da área</span>
                  <strong>{statusLabelText(areaReport.status)}</strong>
                </div>
              </div>

              <div className="split-grid student-final-report-area-split">
                <SectionCard
                  title="Lançamentos e revisões"
                  description="Histórico publicado que compõe a nota mais recente de cada item."
                  className="student-final-report-area-launches-card"
                >
                  {areaReport.launchHistory.length ? (
                    <div className="timeline">
                      {areaReport.launchHistory.map((launch) => (
                        <article key={launch.id} className="timeline-item">
                          <div className="timeline-item-header">
                            <strong>{formatLaunchType(launch.launchType)}</strong>
                            {launch.isLegacyRecord ? (
                              <span className="badge badge-muted">
                                Registro legado
                              </span>
                            ) : null}
                          </div>
                          <div className="timeline-metrics">
                            <span>Tipo: {formatLaunchType(launch.launchType)}</span>
                            <span>Itens: {launch.itemCount}</span>
                            <span>Data: {formatDate(launch.publishedAt)}</span>
                          </div>
                          {launch.notes ? (
                            <p className="table-helper">{launch.notes}</p>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-message">
                      Ainda não há lançamentos publicados nesta área.
                    </p>
                  )}
                </SectionCard>

                <SectionCard
                  title="Faltas da área"
                  description="Histórico resumido de ausências justificadas e não justificadas."
                  className="student-final-report-area-absences-card"
                >
                  {areaReport.absences.length ? (
                    <ul className="detail-list">
                      {areaReport.absences.map((absence) => (
                        <li key={absence.id} className="detail-item">
                          <span>{formatDate(absence.date)}</span>
                          <span>
                            {absence.hours}h ·{" "}
                            {absence.justified ? "Justificada" : "Não justificada"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-message">
                      Não há faltas registradas nesta área.
                    </p>
                  )}
                </SectionCard>
              </div>

              <SectionCard
                title="Detalhamento por subitem"
                description="Detalhamento final dos critérios, pontuação e justificativas da área."
                className="student-final-report-criteria-card"
              >
                <CriteriaTable groups={areaReport.groups} />
              </SectionCard>
            </SectionCard>
          ))}

          <SectionCard
            title="Ausências do semestre"
            description="Visão consolidada das ausências do recorte selecionado."
            className="student-final-report-semester-absences-card"
          >
            {report.absences.length ? (
              <ul className="detail-list">
                {report.absences.map((absence) => (
                  <li key={absence.id} className="detail-item">
                    <span>{formatDate(absence.date)}</span>
                    <span>
                      {absence.hours}h ·{" "}
                      {absence.justified ? "Justificada" : "Não justificada"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">
                Não há ausências registradas neste semestre.
              </p>
            )}
          </SectionCard>

          <div className="student-final-report-signatures report-print-only">
            <div className="student-final-report-signatures-grid">
              <div className="student-final-report-signature-item">
                <div className="student-final-report-signature-line" />
                <span className="student-final-report-signature-label">
                  Assinatura do aluno
                </span>
              </div>
              <div className="student-final-report-signature-item">
                <div className="student-final-report-signature-line" />
                <span className="student-final-report-signature-label">
                  Assinatura do professor/supervisor
                </span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <SectionCard
          title={emptyState?.title ?? "Relatório indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar o relatório final deste aluno."
          }
          actions={
            <a href={backHref} className="button button-secondary">
              {origin === "audit"
                ? "Voltar à área arquivada"
                : origin === "master-audit"
                  ? "Voltar à área arquivada do Master"
                  : "Voltar aos relatórios"}
            </a>
          }
        >
          <p className="empty-message">
            Quando houver lançamentos, faltas e vínculos consistentes no banco,
            este relatório será exibido aqui.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
