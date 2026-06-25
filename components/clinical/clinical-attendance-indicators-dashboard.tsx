import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalAttendanceIndicatorsFilters } from "@/components/forms/clinical-attendance-indicators-filters";
import { ReportBrandLockup } from "@/components/reports/report-brand-lockup";
import { ClinicalAttendanceBreakdownTable } from "@/components/tables/clinical-attendance-breakdown-table";
import { formatDate } from "@/lib/utils/format";
import type { ClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";
import type { InstitutionalReportBranding } from "@/services/report-branding";

interface ClinicalAttendanceIndicatorsDashboardProps {
  pageData: ClinicalAttendanceIndicatorsPageData;
  basePath: Route;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  backHref: Route;
  backLabel: string;
  branding?: InstitutionalReportBranding | null;
}

function buildClinicalAttendanceIndicatorsQuery(
  filters: ClinicalAttendanceIndicatorsPageData["filters"]
) {
  const searchParams = new URLSearchParams();

  if (filters.dateFrom) {
    searchParams.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    searchParams.set("dateTo", filters.dateTo);
  }

  if (filters.institutionId) {
    searchParams.set("institutionId", filters.institutionId);
  }

  if (filters.courseId) {
    searchParams.set("courseId", filters.courseId);
  }

  if (filters.unitId) {
    searchParams.set("unitId", filters.unitId);
  }

  if (filters.areaId) {
    searchParams.set("areaId", filters.areaId);
  }

  if (filters.professorId) {
    searchParams.set("professorId", filters.professorId);
  }

  if (filters.studentId) {
    searchParams.set("studentId", filters.studentId);
  }

  if (filters.statusEvolucao !== "todos") {
    searchParams.set("statusEvolucao", filters.statusEvolucao);
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export function ClinicalAttendanceIndicatorsDashboard(
  props: ClinicalAttendanceIndicatorsDashboardProps
) {
  const { pageData } = props;
  const periodLabel = `${formatDate(pageData.filters.dateFrom)} até ${formatDate(
    pageData.filters.dateTo
  )}`;
  const query = buildClinicalAttendanceIndicatorsQuery(pageData.filters);
  const exportHref = `${props.basePath}/export${query}` as Route;
  const clearHref = (
    `${props.basePath}?dateFrom=${encodeURIComponent(
      pageData.filters.dateFrom
    )}&dateTo=${encodeURIComponent(pageData.filters.dateTo)}` as Route
  );

  return (
    <div className="stack clinical-indicators-dashboard">
      <section className="hero-card">
        <div className="report-hero-brand">
          <ReportBrandLockup
            branding={props.branding}
            fallbackEyebrow={props.heroEyebrow}
          />
        </div>
        <p className="eyebrow">{props.heroEyebrow}</p>
        <h1>{props.heroTitle}</h1>
        <p>{props.heroDescription}</p>
        <div className="actions-row">
          <Link href={props.backHref} className="button button-secondary">
            {props.backLabel}
          </Link>
          {query ? (
            <Link
              href={`${props.basePath}${query}` as Route}
              className="button button-secondary"
            >
              Atualizar recorte
            </Link>
          ) : null}
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Atendimentos realizados"
          value={String(pageData.metrics.attendancesPerformed)}
          hint={`Contagem de atendimentos com paciente presente no período ${periodLabel}.`}
          tone="positive"
        />
        <MetricCard
          label="Pacientes ausentes"
          value={String(pageData.metrics.absentPatients)}
          hint="Ocorrências marcadas como paciente ausente. Não entram como atendimento realizado."
        />
        <MetricCard
          label="Evoluções pendentes"
          value={String(pageData.metrics.openEvolutions)}
          hint="Atendimentos presentes com evolução em pendente, enviada ou ajustes solicitados."
          tone="alert"
        />
        <MetricCard
          label="Enviadas para revisão"
          value={String(pageData.metrics.sentForReview)}
          hint="Evoluções já enviadas pelo aluno e que ainda aguardam parecer da supervisão."
        />
        <MetricCard
          label="Ajustes solicitados"
          value={String(pageData.metrics.adjustmentRequests)}
          hint="Evoluções devolvidas para correção e ainda em aberto."
          tone="alert"
        />
        <MetricCard
          label="Evoluções aprovadas"
          value={String(pageData.metrics.approvedEvolutions)}
          hint="Atendimentos cuja evolução já foi concluída com aprovação."
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros do indicador"
        description="Use o período e os recortes institucionais para consolidar a quantidade de atendimentos e o andamento das evoluções clínicas."
      >
        <ClinicalAttendanceIndicatorsFilters
          actionPath={props.basePath}
          clearHref={clearHref}
          exportHref={exportHref}
          filters={pageData.filters}
          filterOptions={pageData.filterOptions}
          visibility={pageData.visibility}
        />
      </SectionCard>

      <div className="clinical-indicators-breakdown-grid">
        <ClinicalAttendanceBreakdownTable
          title="Atendimentos por área"
          description="Mostra atendimentos realizados, ausências e andamento das evoluções por área de estágio."
          rows={pageData.breakdowns.byArea}
          emptyMessage="Ainda não há atendimentos nesse recorte para consolidar por área."
        />
        <ClinicalAttendanceBreakdownTable
          title="Atendimentos por aluno"
          description="Permite acompanhar volume de atendimentos e pendências por estagiário."
          rows={pageData.breakdowns.byStudent}
          emptyMessage="Ainda não há atendimentos nesse recorte para consolidar por aluno."
        />
        <ClinicalAttendanceBreakdownTable
          title="Atendimentos por professor"
          description="Ajuda a identificar carga clínica e pendências por supervisor."
          rows={pageData.breakdowns.byProfessor}
          emptyMessage="Ainda não há atendimentos nesse recorte para consolidar por professor."
        />
        {pageData.visibility.showUnitBreakdown ? (
          <ClinicalAttendanceBreakdownTable
            title="Atendimentos por unidade"
            description="Consolida a operação clínica por campus/unidade dentro do escopo permitido."
            rows={pageData.breakdowns.byUnit}
            emptyMessage="Ainda não há atendimentos nesse recorte para consolidar por unidade."
          />
        ) : null}
        {pageData.visibility.showCourseBreakdown ? (
          <ClinicalAttendanceBreakdownTable
            title="Atendimentos por curso"
            description="Visão institucional agrupada por curso para o Master global."
            rows={pageData.breakdowns.byCourse}
            emptyMessage="Ainda não há atendimentos nesse recorte para consolidar por curso."
          />
        ) : null}
      </div>
    </div>
  );
}
