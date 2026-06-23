import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ProgressBars } from "@/components/dashboard/progress-bars";
import { CriteriaTable } from "@/components/tables/criteria-table";
import { requireRole } from "@/lib/auth/session";
import { getAuthenticatedStudentEvaluationDetailPageData } from "@/services/dashboard";
import {
  formatDate,
  formatGradeOutOfTen,
  formatLaunchType,
  formatPercentage
} from "@/lib/utils/format";

export default async function StudentHistoricalEvaluationPage(props: {
  params: Promise<{
    avaliacaoId: string;
  }>;
}) {
  const currentUser = await requireRole(["aluno"]);
  const params = await props.params;
  const { pageData } = await getAuthenticatedStudentEvaluationDetailPageData(
    currentUser,
    params.avaliacaoId
  );

  if (!pageData) {
    notFound();
  }

  const backHref = `/aluno?matricula=${encodeURIComponent(
    pageData.area.enrollmentId
  )}` as Route;

  return (
    <div className="stack student-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Histórico de avaliações</p>
        <h1>{`${formatLaunchType(pageData.evaluation.launchType)} em ${formatDate(
          pageData.evaluation.publishedAt
        )}`}</h1>
        <p>
          {pageData.area.areaName}
          {pageData.area.blockName ? ` · ${pageData.area.blockName}` : ""}
          {" · "}Semestre {pageData.dashboard.semester.code}
        </p>
        <div className="actions-row">
          <Link href={backHref} className="button button-secondary">
            Voltar para visão geral
          </Link>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Subtotal"
          value={formatPercentage(pageData.dashboard.subtotalPercentage)}
          hint="Soma ponderada dos critérios considerando o estado desta avaliação histórica."
          tone="positive"
        />
        <MetricCard
          label="Desconto por ausência"
          value={formatPercentage(pageData.dashboard.absencePenaltyPercentage)}
          hint="Ausências não justificadas acumuladas até a data deste lançamento."
          tone="alert"
        />
        <MetricCard
          label="Total"
          value={formatPercentage(pageData.dashboard.finalPercentage)}
          hint={`Equivalente a ${formatGradeOutOfTen(
            pageData.dashboard.finalGradeOutOfTen
          )} / 10.`}
          tone="positive"
        />
        <MetricCard
          label="Conclusão"
          value={formatPercentage(pageData.dashboard.completionRate)}
          hint="Cobertura dos critérios já avaliados até este lançamento."
        />
      </div>

      <div className="split-grid">
        <SectionCard
          title="Resumo da avaliação"
          description="Metadados do lançamento histórico selecionado."
        >
          <ul className="detail-list">
            <li className="detail-item">
              <span>Data do lançamento</span>
              <span>{formatDate(pageData.evaluation.publishedAt)}</span>
            </li>
            <li className="detail-item">
              <span>Tipo</span>
              <span>{formatLaunchType(pageData.evaluation.launchType)}</span>
            </li>
            <li className="detail-item">
              <span>Professor/supervisor</span>
              <span>{pageData.evaluation.professorName ?? "Não identificado"}</span>
            </li>
            <li className="detail-item">
              <span>Turma</span>
              <span>{pageData.area.className}</span>
            </li>
            <li className="detail-item">
              <span>Área</span>
              <span>{pageData.area.areaName}</span>
            </li>
            <li className="detail-item">
              <span>Referência</span>
              <span>{pageData.evaluation.reference}</span>
            </li>
          </ul>
        </SectionCard>

        <SectionCard
          title="Evolução por bloco"
          description="Pontuação acumulada por grupo de avaliação até este lançamento."
        >
          <ProgressBars
            items={pageData.dashboard.groups.map((group) => ({
              label: group.name,
              current: group.earnedPercentage,
              max: group.weightPercentage
            }))}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Detalhamento por subitem"
        description="Critérios, pontuações e justificativas correspondentes ao estado desta avaliação histórica."
      >
        <CriteriaTable groups={pageData.dashboard.groups} collapsibleFeedback />
      </SectionCard>

      {pageData.dashboard.finalObservations ? (
        <SectionCard
          title="Observações finais"
          description="Devolutiva registrada neste lançamento histórico."
        >
          <div className="management-block-card">
            <p style={{ whiteSpace: "pre-line", margin: 0 }}>
              {pageData.dashboard.finalObservations}
            </p>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
