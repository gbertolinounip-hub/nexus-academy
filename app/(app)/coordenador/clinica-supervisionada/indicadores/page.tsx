import type { Route } from "next";
import { redirect } from "next/navigation";
import { ClinicalAttendanceIndicatorsDashboard } from "@/components/clinical/clinical-attendance-indicators-dashboard";
import { SectionCard } from "@/components/common/section-card";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { getClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";

export default async function CoordinatorClinicalAttendanceIndicatorsPage(props: {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    areaId?: string;
    professorId?: string;
    studentId?: string;
    statusEvolucao?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);

  if (getActiveMasterCourseContext(currentUser)) {
    redirect("/master-curso/clinica-supervisionada/indicadores");
  }

  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalAttendanceIndicatorsPageData(
    currentUser,
    {
      dateFrom: searchParams.dateFrom ?? null,
      dateTo: searchParams.dateTo ?? null,
      areaId: searchParams.areaId ?? null,
      professorId: searchParams.professorId ?? null,
      studentId: searchParams.studentId ?? null,
      statusEvolucao: searchParams.statusEvolucao ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack coordinator-dashboard clinical-indicators-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão clínica</p>
          <h1>Indicadores clínicos</h1>
          <p>
            Visão consolidada da unidade/oferta para acompanhar volume de atendimentos,
            ausências e pendências de evolução.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Indicadores indisponíveis"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar os indicadores clínicos da coordenação neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os atendimentos da unidade estiverem registrados, os indicadores
            aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <ClinicalAttendanceIndicatorsDashboard
      branding={reportBranding}
      pageData={pageData}
      basePath={"/coordenador/clinica-supervisionada/indicadores" as Route}
      heroEyebrow="Gestão clínica"
      heroTitle="Indicadores clínicos"
      heroDescription="Acompanhe o total de atendimentos realizados, as ausências dos pacientes e a distribuição das pendências de evolução por área, professor e aluno."
      backHref={"/coordenador/clinica-supervisionada" as Route}
      backLabel="Voltar à gestão clínica"
    />
  );
}
