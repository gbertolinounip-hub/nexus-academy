import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ProgressBars } from "@/components/dashboard/progress-bars";
import { StudentOverviewAreaCards } from "@/components/dashboard/student-overview-area-cards";
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
    : "Professor responsavel ainda nao vinculado";

  return (
    <>
      <div className="metrics-grid">
        <MetricCard
          label="Subtotal"
          value={formatPercentage(dashboard.subtotalPercentage)}
          hint="Soma ponderada dos criterios com base no ultimo lancamento real de cada subitem."
          tone="positive"
        />
        <MetricCard
          label="Desconto por ausencia"
          value={formatPercentage(dashboard.absencePenaltyPercentage)}
          hint="1 ponto percentual por hora nao justificada."
          tone="alert"
        />
        <MetricCard
          label="Media atual"
          value={formatPercentage(dashboard.finalPercentage)}
          hint={`Equivalente a ${formatGradeOutOfTen(
            dashboard.finalGradeOutOfTen
          )} / 10.`}
          tone="positive"
        />
        <MetricCard
          label="Conclusao dos criterios"
          value={formatPercentage(dashboard.completionRate)}
          hint="Percentual de criterios que ja receberam ao menos um lancamento."
        />
      </div>

      <div className="split-grid">
        <SectionCard
          title="Evolucao por bloco"
          description="Pontuacao acumulada por grupo de avaliacao com base nos dados reais desta area."
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
          description="Evolucao da media a cada lancamento publicado nesta area."
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
                    <span>Subtotal: {formatPercentage(point.subtotalPercentage)}</span>
                    <span>Desconto: {formatPercentage(point.absencePenaltyPercentage)}</span>
                    <span>Total: {formatPercentage(point.finalPercentage)}</span>
                    <span>Conclusao: {formatPercentage(point.completionRate)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-message">
              Ainda nao ha lancamentos publicados para compor a linha do tempo desta area.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Detalhamento por subitem"
        description="Cada criterio mostra a nota mais recente, a pontuacao real da area e as justificativas do supervisor quando houver."
      >
        <CriteriaTable groups={dashboard.groups} collapsibleFeedback />
      </SectionCard>

      {dashboard.finalObservations ? (
        <SectionCard
          title="Observações finais"
          description="Sintese geral registrada pelo supervisor na avaliacao mais recente desta area."
        >
          <div className="management-block-card">
            <p style={{ whiteSpace: "pre-line", margin: 0 }}>{dashboard.finalObservations}</p>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Ausencias registradas"
        description={`Responsaveis vinculados a esta area: ${professorNames}.`}
      >
        {dashboard.absences.length ? (
          <ul className="detail-list">
            {dashboard.absences.map((absence) => (
              <li key={absence.id} className="detail-item">
                <span>{formatDate(absence.date)}</span>
                <span>
                  {absence.hours}h · {absence.justified ? "Justificada" : "Nao justificada"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-message">
            Nao ha ausencias registradas para esta area no semestre.
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
    typeof searchParams.matricula === "string" ? searchParams.matricula.trim() : "";
  const { pageData, emptyState } = await getAuthenticatedStudentDashboardPageData(
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
            Seu acesso esta ativo, mas ainda nao foi possivel montar o painel com dados
            academicos reais.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Dados academicos indisponiveis"}
          description={
            emptyState?.description ??
            "Ainda nao encontramos dados suficientes para exibir o dashboard."
          }
        >
          <p className="empty-message">
            Assim que suas matriculas, areas e vinculos forem cadastrados no sistema, este
            painel passara a exibir notas, evolucao e ausencias.
          </p>
        </SectionCard>
      </div>
    );
  }

  const isOverview = pageData.navigation.currentView === "overview";
  const selectedAreaDashboard = pageData.selectedAreaDashboard;
  const selectedArea = pageData.navigation.areas.find((area) => area.isSelected) ?? null;

  return (
    <div className="stack student-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Dashboard do aluno</p>
        <h1>{pageData.student.name}</h1>
        {isOverview ? (
          <p>
            Visao consolidada do semestre {pageData.semester.code}. Escolha uma area na
            sidebar para ver seu desempenho isolado em cada estagio.
          </p>
        ) : (
          <p>
            {selectedArea?.areaName ?? selectedAreaDashboard?.classGroup.internshipArea}
            {" · "}Semestre {pageData.semester.code} · Responsavel:{" "}
            {selectedAreaDashboard?.professors.length
              ? selectedAreaDashboard.professors.map((professor) => professor.name).join(", ")
              : "Professor responsavel ainda nao vinculado"}
          </p>
        )}
      </section>

      {isOverview ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Areas no semestre"
              value={String(pageData.overview.totalAreas)}
              hint="Quantidade de areas de estagio vinculadas a voce no semestre principal."
            />
            <MetricCard
              label="Media geral"
              value={formatPercentage(pageData.overview.averageFinalPercentage)}
              hint="Media das notas finais das areas cadastradas neste semestre."
              tone="positive"
            />
            <MetricCard
              label="Conclusao media"
              value={formatPercentage(pageData.overview.averageCompletionRate)}
              hint="Media da cobertura de criterios entre as areas do semestre."
            />
            <MetricCard
              label="Faltas nao justificadas"
              value={`${pageData.overview.totalUnjustifiedAbsenceHours
                .toFixed(2)
                .replace(".", ",")}h`}
              hint={`Total de ${pageData.overview.totalPublishedLaunches} lancamentos publicados nas areas do semestre.`}
              tone="alert"
            />
          </div>

          <SectionCard
            title="Areas do semestre"
            description="Cada card resume uma area de estagio. Use o botao para abrir a visao detalhada daquela matricula."
          >
            <StudentOverviewAreaCards
              currentUserId={currentUser.id}
              areas={pageData.overview.areaSummaries}
            />
          </SectionCard>
        </>
      ) : selectedAreaDashboard ? (
        renderAreaDashboard(selectedAreaDashboard)
      ) : null}
    </div>
  );
}
