import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalInstitutionalDashboardScreen } from "@/components/clinical/clinical-institutional-dashboard";
import { requireRole } from "@/lib/auth/session";
import { getClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

export default async function ClinicalInstitutionalDashboardPage(props: {
  searchParams?: Promise<{
    q?: string;
    unit_id?: string;
    semester_id?: string;
    area_id?: string;
    professor_id?: string;
    student_id?: string;
    status?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalInstitutionalDashboardPageData(
    currentUser,
    {
      query: searchParams.q ?? null,
      unitId: searchParams.unit_id ?? null,
      semesterId: searchParams.semester_id ?? null,
      areaId: searchParams.area_id ?? null,
      professorId: searchParams.professor_id ?? null,
      studentId: searchParams.student_id ?? null,
      status: searchParams.status ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack coordinator-dashboard clinical-institutional-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão clínica</p>
          <h1>Clínica Supervisionada</h1>
          <p>
            Acompanhamento institucional da operação clínica da unidade, com foco
            em indicadores, filtros e visão consolidada dos casos.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Visão institucional indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar a gestão clínica da unidade neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os casos clínicos da unidade estiverem disponíveis, os
            relatórios e indicadores aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <ClinicalInstitutionalDashboardScreen
      pageData={pageData}
      basePath={"/coordenador/clinica-supervisionada" as Route}
      printBasePath={"/coordenador/clinica-supervisionada/impressao" as Route}
      heroEyebrow="Gestão clínica"
      heroTitle="Clínica Supervisionada"
      heroDescription={
        pageData.filterOptions.units.length > 0
          ? "Visão institucional do curso para acompanhar pacientes, casos, pendências clínicas e distribuição acadêmico-assistencial por unidade."
          : "Visão institucional da unidade para acompanhar pacientes, casos, pendências clínicas e distribuição acadêmico-assistencial."
      }
      secondaryActions={[
        {
          href: "/pacientes" as Route,
          label: "Base de pacientes"
        }
      ]}
    />
  );
}
