import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalInstitutionalDashboardScreen } from "@/components/clinical/clinical-institutional-dashboard";
import { requireRole } from "@/lib/auth/session";
import { getClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

export default async function MasterClinicalInstitutionalDashboardPage(props: {
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
  const currentUser = await requireRole(["coordenador_master"]);
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
      <div className="stack master-dashboard clinical-institutional-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão clínica global</p>
          <h1>Clínica Supervisionada</h1>
          <p>
            Acompanhamento institucional multiunidade da operação clínica, com
            foco em indicadores globais, filtros e visão consolidada dos casos.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Visão institucional indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar a gestão clínica global neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os casos clínicos estiverem disponíveis nas unidades, os
            relatórios e indicadores aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <ClinicalInstitutionalDashboardScreen
      pageData={pageData}
      basePath={"/master/clinica-supervisionada" as Route}
      printBasePath={"/master/clinica-supervisionada/impressao" as Route}
      heroEyebrow="Gestão clínica global"
      heroTitle="Clínica Supervisionada"
      heroDescription="Visão institucional multiunidade para acompanhar pacientes, casos, pendências clínicas e distribuição acadêmico-assistencial em escala global."
      secondaryActions={[
        {
          href: "/master/unidades" as Route,
          label: "Unidades"
        }
      ]}
    />
  );
}
