import type { Route } from "next";
import { ClinicalAttendanceIndicatorsDashboard } from "@/components/clinical/clinical-attendance-indicators-dashboard";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { getClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";

export default async function ClinicalAttendanceIndicatorsPage(props: {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    areaId?: string;
    studentId?: string;
    statusEvolucao?: string;
  }>;
}) {
  const currentUser = await requireRole(["professor"]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalAttendanceIndicatorsPageData(
    currentUser,
    {
      dateFrom: searchParams.dateFrom ?? null,
      dateTo: searchParams.dateTo ?? null,
      areaId: searchParams.areaId ?? null,
      studentId: searchParams.studentId ?? null,
      statusEvolucao: searchParams.statusEvolucao ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-indicators-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Indicadores clínicos</p>
          <h1>{currentUser.name}</h1>
          <p>
            Consolidação dos atendimentos realmente realizados na sua supervisão clínica,
            com foco em presença, ausências e evolução dos alunos.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Indicadores indisponíveis"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar os indicadores clínicos neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os atendimentos do seu escopo estiverem registrados, os indicadores
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
      basePath={"/clinica-supervisionada/indicadores" as Route}
      heroEyebrow="Indicadores clínicos"
      heroTitle="Atendimentos da supervisão"
      heroDescription="Use este painel para acompanhar quantidade de atendimentos realizados, pacientes ausentes e o andamento das evoluções dos seus alunos."
      backHref={"/clinica-supervisionada" as Route}
      backLabel="Voltar à Clínica"
    />
  );
}
