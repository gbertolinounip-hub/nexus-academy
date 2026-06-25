import type { Route } from "next";
import { ClinicalAttendanceIndicatorsDashboard } from "@/components/clinical/clinical-attendance-indicators-dashboard";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { getClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";

export default async function MasterClinicalAttendanceIndicatorsPage(props: {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    institutionId?: string;
    courseId?: string;
    unitId?: string;
    areaId?: string;
    professorId?: string;
    studentId?: string;
    statusEvolucao?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador_master"]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalAttendanceIndicatorsPageData(
    currentUser,
    {
      dateFrom: searchParams.dateFrom ?? null,
      dateTo: searchParams.dateTo ?? null,
      institutionId: searchParams.institutionId ?? null,
      courseId: searchParams.courseId ?? null,
      unitId: searchParams.unitId ?? null,
      areaId: searchParams.areaId ?? null,
      professorId: searchParams.professorId ?? null,
      studentId: searchParams.studentId ?? null,
      statusEvolucao: searchParams.statusEvolucao ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack master-dashboard clinical-indicators-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão clínica global</p>
          <h1>Indicadores clínicos</h1>
          <p>
            Consolidação institucional multiunidade da Clínica Supervisionada com recorte
            por IES, curso, unidade, professor, aluno e área.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Indicadores indisponíveis"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar os indicadores clínicos institucionais neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os atendimentos das unidades estiverem registrados, os indicadores
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
      basePath={"/master/clinica-supervisionada/indicadores" as Route}
      heroEyebrow="Gestão clínica global"
      heroTitle="Indicadores clínicos"
      heroDescription="Use esta visão para consolidar quantidade de atendimentos realizados, ausências e andamento das evoluções clínicas em escala institucional."
      backHref={"/master/clinica-supervisionada" as Route}
      backLabel="Voltar à gestão clínica"
    />
  );
}
