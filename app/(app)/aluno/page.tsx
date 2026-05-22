import Link from "next/link";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ProgressBars } from "@/components/dashboard/progress-bars";
import { CriteriaTable } from "@/components/tables/criteria-table";
import { requireRole } from "@/lib/auth/session";
import { getAuthenticatedStudentDashboardPageData } from "@/services/dashboard";
import type { StudentDashboardData } from "@/types/domain";
import {
  formatDate,
  formatGradeOutOfTen,
  formatLaunchType,
  formatPercentage
} from "@/lib/utils/format";

function renderAreaDashboard(dashboard: StudentDashboardData) {
  const professorNames = dashboard.professors.length
    ? dashboard.professors.map((professor) => professor.name).join(", ")
    : "Professor responsável ainda não vinculado";

  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="Subtotal"
          value={formatPercentage(dashboard.subtotalPercentage)}
          hint="Soma ponderada dos critérios com base no último lançamento real de cada subitem."
          tone="positive"
        />
        <MetricCard
          label="Desconto por ausência"
          value={formatPercentage(dashboard.absencePenaltyPercentage)}
          hint="1 ponto percentual por hora não justificada."
          tone="alert"
        />
        <MetricCard
          label="Média atual"
          value={formatPercentage(dashboard.finalPercentage)}
          hint={`Equivalente a ${formatGradeOutOfTen(
            dashboard.finalGradeOutOfTen
          )} / 10.`}
          tone="positive"
        />
        <MetricCard
          label="Conclusão dos critérios"
          value={formatPercentage(dashboard.completionRate)}
          hint="Percentual de critérios que já receberam ao menos um lançamento."
        />
      </div>

      <div className="split-grid">
        <SectionCard
          title="Evolução por bloco"
          description="Pontuação acumulada por grupo de avaliação com base nos dados reais desta área."
        >
          <ProgressBars
            items={dashboard.groups.map((group) => ({
              label: group.name,
              current: group.earnedPercentage,
              max: group.weightPercentage
            }))}
          />
        </SectionCard>

        <SectionCard
          title="Linha do tempo"
          description="Evolução da média a cada lançamento publicado nesta área."
        >
          {dashboard.progress.length ? (
            <div className="timeline">
              {dashboard.progress.map((point) => (
                <article
                  key={`${point.label}-${point.publishedAt}`}
                  className="timeline-item"
                >
                  <div className="timeline-item-header">
                    <strong>
                      {`${formatLaunchType(point.launchType)} em ${formatDate(point.publishedAt)}`}
                    </strong>
                    {point.isLegacyRecord ? (
                      <span className="badge badge-muted">Registro legado</span>
                    ) : null}
                  </div>
                  <div className="timeline-metrics">
                    <span>
                      Subtotal: {formatPercentage(point.subtotalPercentage)}
                    </span>
                    <span>
                      Desconto: {formatPercentage(point.absencePenaltyPercentage)}
                    </span>
                    <span>Total: {formatPercentage(point.finalPercentage)}</span>
                    <span>
                      Conclusão: {formatPercentage(point.completionRate)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-message">
              Ainda não há lançamentos publicados para compor a linha do tempo
              desta área.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Detalhamento por subitem"
        description="Cada critério mostra a nota mais recente, a pontuação real da área e as justificativas do supervisor quando houver."
      >
        <CriteriaTable groups={dashboard.groups} />
      </SectionCard>

      <SectionCard
        title="Ausências registradas"
        description={`Responsáveis vinculados a esta área: ${professorNames}.`}
      >
        {dashboard.absences.length ? (
          <ul className="detail-list">
            {dashboard.absences.map((absence) => (
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
            Não há ausências registradas para esta área no semestre.
          </p>
        )}
      </SectionCard>
    </>
  );
}

export default async function StudentDashboardPage(props: {
  searchParams?: Promise<{
    matricula?: string;
  }>;
}) {
  const currentUser = await requireRole(["aluno"]);
  const searchParams = (await props.searchParams) ?? {};
  const requestedEnrollmentId =
    typeof searchParams.matricula === "string"
      ? searchParams.matricula.trim()
      : "";
  const { pageData, emptyState } =
    await getAuthenticatedStudentDashboardPageData(
      currentUser,
      requestedEnrollmentId || null
    );

  if (!pageData || emptyState) {
    return (
      <div className="stack student-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Dashboard do aluno</p>
          <h1>{currentUser.name}</h1>
          <p>
            Seu acesso está ativo, mas ainda não foi possível montar o painel
            com dados acadêmicos reais.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Dados acadêmicos indisponíveis"}
          description={
            emptyState?.description ??
            "Ainda não encontramos dados suficientes para exibir o dashboard."
          }
        >
          <p className="empty-message">
            Assim que suas matrículas, áreas e vínculos forem cadastrados no
            sistema, este painel passará a exibir notas, evolução e ausências.
          </p>
        </SectionCard>
      </div>
    );
  }

  const isOverview = pageData.navigation.currentView === "overview";
  const selectedAreaDashboard = pageData.selectedAreaDashboard;
  const selectedArea =
    pageData.navigation.areas.find((area) => area.isSelected) ?? null;

  return (
    <div className="stack student-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Dashboard do aluno</p>
        <h1>{pageData.student.name}</h1>
        {isOverview ? (
          <p>
            Visão consolidada do semestre {pageData.semester.code}. Escolha uma
            área na sidebar para ver seu desempenho isolado em cada estágio.
          </p>
        ) : (
          <p>
            {selectedArea?.areaName ?? selectedAreaDashboard?.classGroup.internshipArea}
            {" · "}Semestre {pageData.semester.code} · Responsável:{" "}
            {selectedAreaDashboard?.professors.length
              ? selectedAreaDashboard.professors
                  .map((professor) => professor.name)
                  .join(", ")
              : "Professor responsável ainda não vinculado"}
          </p>
        )}
      </section>

      {isOverview ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Áreas no semestre"
              value={String(pageData.overview.totalAreas)}
              hint="Quantidade de áreas de estágio vinculadas a você no semestre principal."
            />
            <MetricCard
              label="Média geral"
              value={formatPercentage(pageData.overview.averageFinalPercentage)}
              hint="Média das notas finais das áreas cadastradas neste semestre."
              tone="positive"
            />
            <MetricCard
              label="Conclusão média"
              value={formatPercentage(pageData.overview.averageCompletionRate)}
              hint="Média da cobertura de critérios entre as áreas do semestre."
            />
            <MetricCard
              label="Faltas não justificadas"
              value={`${pageData.overview.totalUnjustifiedAbsenceHours
                .toFixed(2)
                .replace(".", ",")}h`}
              hint={`Total de ${pageData.overview.totalPublishedLaunches} lançamentos publicados nas áreas do semestre.`}
              tone="alert"
            />
          </div>

          <SectionCard
            title="Áreas do semestre"
            description="Cada card resume uma área de estágio. Use o botão para abrir a visão detalhada daquela matrícula."
          >
            <div className="student-overview-grid">
              {pageData.overview.areaSummaries.map((area) => (
                <article
                  key={area.enrollmentId}
                  className="student-overview-card"
                >
                  <div className="student-overview-card-header">
                    <div>
                      <h3>{area.areaName}</h3>
                      <p>
                        {area.blockName ? `${area.blockName} · ` : ""}
                        {area.className}
                      </p>
                    </div>
                    <Link
                      href={`/aluno?matricula=${area.enrollmentId}`}
                      className="button button-secondary button-small"
                    >
                      Abrir área
                    </Link>
                  </div>

                  <div className="student-overview-card-metrics">
                    <span>Média: {formatPercentage(area.finalPercentage)}</span>
                    <span>
                      Subtotal: {formatPercentage(area.subtotalPercentage)}
                    </span>
                    <span>
                      Desconto: {formatPercentage(area.absencePenaltyPercentage)}
                    </span>
                    <span>
                      Conclusão: {formatPercentage(area.completionRate)}
                    </span>
                  </div>

                  <p className="student-overview-card-copy">
                    Supervisores:{" "}
                    {area.professorNames.length
                      ? area.professorNames.join(", ")
                      : "ainda não vinculados"}
                  </p>
                  <p className="student-overview-card-copy">
                    Lançamentos publicados: {area.publishedLaunchCount} · Horas
                    não justificadas:{" "}
                    {area.unjustifiedAbsenceHours.toFixed(2).replace(".", ",")}h
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>
        </>
      ) : selectedAreaDashboard ? (
        renderAreaDashboard(selectedAreaDashboard)
      ) : null}
    </div>
  );
}





