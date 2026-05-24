import Link from "next/link";
import { BrandLockup } from "@/components/common/brand-lockup";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ProgressBars } from "@/components/dashboard/progress-bars";
import { ReportPrintButton } from "@/components/reports/report-print-button";
import { requireRole } from "@/lib/auth/session";
import { formatPercentage, formatStudentStatusBadge } from "@/lib/utils/format";
import { getAuthenticatedReportsPageData } from "@/services/reports";

interface ReportsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage(props: ReportsPageProps) {
  const currentUser = await requireRole(["coordenador", "professor"]);
  const searchParams = (await props.searchParams) ?? {};
  const requestedSemesterId = readSearchParam(searchParams, "semestre");
  const { reports, emptyState } = await getAuthenticatedReportsPageData(
    currentUser,
    requestedSemesterId
  );
  const isProfessorView = reports?.viewerRole === "professor";

  const pageTitle =
    currentUser.role === "coordenador"
      ? "Relatórios finais acadêmicos"
      : "Relatórios finais sob supervisão";
  const pageDescription =
    currentUser.role === "coordenador"
      ? "Visão gerencial do fechamento do semestre, com consolidações por bloco, área, turma e aluno."
      : "Visão final das turmas e dos alunos que estão no escopo acadêmico deste supervisor.";

  return (
    <div
      className={`stack reports-dashboard${
        currentUser.role === "professor"
          ? " reports-dashboard-professor"
          : ""
      }`}
    >
      <section className="hero-card">
        <div className="report-hero-brand">
          <BrandLockup
            eyebrow="Plataforma acadêmica"
            subtitle="Desempenho e gestão de estágios"
          />
        </div>
        <p className="eyebrow">Relatórios finais</p>
        <h1>{pageTitle}</h1>
        <p>{pageDescription}</p>
        {reports ? (
          <div className="actions-row report-screen-only">
            <ReportPrintButton />
            <a
              href={`/relatorios/export/consolidado/csv?semestre=${reports.selectedSemester.id}`}
              className="button button-secondary"
            >
              Exportar CSV
            </a>
            <a
              href={`/relatorios/export/consolidado/excel?semestre=${reports.selectedSemester.id}`}
              className="button button-secondary"
            >
              Exportar Excel
            </a>
          </div>
        ) : null}
      </section>

      {reports ? (
        <>
          <SectionCard
            title="Semestre em foco"
            description={`Dados consolidados em ${reports.selectedSemester.code} · ${reports.selectedSemester.name}.`}
          >
            <div className="report-chip-list">
              {reports.semesters.map((semester) => {
                const active = semester.value === reports.selectedSemester.id;

                return (
                  <Link
                    key={semester.value}
                    href={`/relatorios?semestre=${semester.value}`}
                    className={`report-chip${active ? " report-chip-active" : ""}`}
                  >
                    {semester.label}
                  </Link>
                );
              })}
            </div>
            <p className="empty-message">{reports.viewerDescription}</p>
          </SectionCard>

          <div className="metrics-grid">
            <MetricCard
              label="Alunos em estágio"
              value={String(reports.summary.totalStudents)}
              hint="Quantidade de alunos consolidados para o semestre selecionado."
            />
            <MetricCard
              label="Turmas de estágio"
              value={String(reports.summary.totalClasses)}
              hint="Turmas reais encontradas para compor os relatórios finais."
            />
            <MetricCard
              label="Áreas de estágio"
              value={String(reports.summary.totalAreas)}
              hint="Áreas de estágio consideradas no fechamento acadêmico."
            />
            <MetricCard
              label="Supervisores em estágio"
              value={String(reports.summary.totalProfessors)}
              hint="Professores com participação nos vínculos do semestre."
            />
            <MetricCard
              label="Avaliações publicadas"
              value={String(reports.summary.totalPublishedEvaluations)}
              hint="Lançamentos publicados que compõem a nota final."
              tone="positive"
            />
            <MetricCard
              label="Horas não justificadas"
              value={`${reports.summary.totalUnjustifiedAbsenceHours}h`}
              hint="Penalidade consolidada de ausências no semestre."
              tone="alert"
            />
          </div>

          <div className="split-grid">
            <SectionCard
              title="Consolidação por bloco"
              description="Média final agregada por bloco de estágio no semestre."
            >
              {reports.blockSummaries.length ? (
                <ProgressBars
                  items={reports.blockSummaries.map((block) => ({
                    label: `${block.blockName} · ${block.studentCount} aluno(s)`,
                    current: block.averageFinalPercentage,
                    max: 100
                  }))}
                />
              ) : (
                <p className="empty-message">
                  Ainda não há dados suficientes para consolidação por bloco.
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Casos prioritários"
              description="Alunos que demandam atenção acadêmica imediata neste semestre."
            >
              {reports.priorityStudents.length ? (
                <ul className="detail-list">
                  {reports.priorityStudents.map((student) => (
                    <li
                      className="detail-item"
                      key={`${student.studentId}-${student.reportEnrollmentId ?? student.semesterId}`}
                    >
                      <span>
                        {student.studentName}
                        <span className="table-helper">
                          {student.reportContext === "area"
                            ? `${student.reportAreaName} · ${student.reportBlockName}`
                            : student.areaNames.join(", ")}
                        </span>
                      </span>
                      <span>
                        {formatPercentage(student.finalPercentage)} ·{" "}
                        <span className={`status-pill status-${student.status}`}>
                          {formatStudentStatusBadge(student.status)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-message">
                  Nenhum aluno foi sinalizado como prioritário neste semestre.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title="Médias por área"
            description="Ajuda a identificar rapidamente quais áreas estão mais sólidas e quais pedem reforço."
          >
            {reports.areaSummaries.length ? (
              <div className="table-wrap">
                <table className="table report-table report-area-table">
                  <thead>
                    <tr>
                      <th>Bloco</th>
                      <th>Área</th>
                      <th>Alunos</th>
                      <th>Média final</th>
                      <th>Avaliações</th>
                      <th>Horas não justificadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.areaSummaries.map((area) => (
                      <tr key={area.areaId}>
                        <td>{area.blockName}</td>
                        <td>{area.areaName}</td>
                        <td>{area.studentCount}</td>
                        <td>{formatPercentage(area.averageFinalPercentage)}</td>
                        <td>{area.totalPublishedEvaluations}</td>
                        <td>{area.totalUnjustifiedAbsenceHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                Ainda não há áreas com dados publicados suficientes para exibição.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Relatórios finais por turma"
            description="Leitura gerencial rápida da composição, média e risco de cada turma."
          >
            {reports.classReports.length ? (
              <div className="table-wrap">
                <table className="table report-table report-class-table">
                  <thead>
                    <tr>
                      <th>Turma</th>
                      <th>Área</th>
                      <th>Supervisores</th>
                      <th>Alunos</th>
                      <th>Média</th>
                      <th>Avaliações</th>
                      <th>Em atenção</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.classReports.map((classReport) => (
                      <tr key={classReport.classId}>
                        <td className="report-table-primary-cell">
                          <div>{classReport.classCode}</div>
                          <div className="table-helper">{classReport.className}</div>
                        </td>
                        <td className="report-table-secondary-cell">
                          <div>{classReport.areaName}</div>
                          <div className="table-helper">{classReport.blockName}</div>
                        </td>
                        <td className="report-table-text-cell">
                          {classReport.professorNames.length
                            ? classReport.professorNames.join(", ")
                            : "Sem supervisor identificado"}
                        </td>
                        <td>{classReport.studentCount}</td>
                        <td>{formatPercentage(classReport.averageFinalPercentage)}</td>
                        <td>{classReport.totalPublishedEvaluations}</td>
                        <td>{classReport.studentsAtRisk}</td>
                        <td>
                          <Link
                            href={`/relatorios/turmas/${classReport.classId}`}
                            className="button button-secondary button-small"
                          >
                            Ver turma
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                Ainda não há turmas com dados suficientes para fechamento.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={
              isProfessorView
                ? "Relatórios finais por área"
                : "Relatórios finais por aluno"
            }
            description={
              isProfessorView
                ? "Cada linha representa uma matrícula/área sob responsabilidade deste professor."
                : "Relatórios individuais prontos para acompanhamento e fechamento acadêmico."
            }
          >
            {reports.studentReports.length ? (
              <div className="table-wrap">
                <table className="table report-table report-student-table">
                  <thead>
                    <tr>
                      <th>Aluno</th>
                      <th>Semestre</th>
                      <th>Contexto</th>
                      <th>Subtotal</th>
                      <th>Desconto</th>
                      <th>Total final</th>
                      <th>Situação</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.studentReports.map((student) => (
                      <tr
                        key={`${student.studentId}-${student.reportEnrollmentId ?? student.semesterId}`}
                      >
                        <td>
                          <div>{student.studentName}</div>
                          <div className="table-helper">RA {student.registration}</div>
                        </td>
                        <td>{student.semesterCode}</td>
                        <td>
                          <div>
                            {student.reportContext === "area"
                              ? student.reportAreaName
                              : student.areaNames.join(", ")}
                          </div>
                          <div className="table-helper">
                            {student.reportContext === "area"
                              ? student.reportBlockName
                              : student.blockNames.join(", ")}
                          </div>
                        </td>
                        <td>{formatPercentage(student.subtotalPercentage)}</td>
                        <td>{formatPercentage(student.absencePenaltyPercentage)}</td>
                        <td>{formatPercentage(student.finalPercentage)}</td>
                        <td>
                          <span className={`status-pill status-${student.status}`}>
                            {formatStudentStatusBadge(student.status)}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/relatorios/alunos/${student.studentId}?semestre=${student.semesterId}${
                              student.reportEnrollmentId
                                ? `&matricula=${student.reportEnrollmentId}`
                                : ""
                            }`}
                            className="button button-secondary button-small"
                          >
                            {student.reportContext === "area"
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
                Ainda não há relatórios individuais disponíveis para este semestre.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title={emptyState?.title ?? "Relatórios indisponíveis"}
          description={
            emptyState?.description ??
            "Ainda não foi possível consolidar os relatórios finais para este usuário."
          }
        >
          <p className="empty-message">
            Assim que houver semestres, turmas, áreas e lançamentos suficientes,
            esta visão passará a consolidar os dados reais do sistema.
          </p>
        </SectionCard>
      )}
    </div>
  );
}





