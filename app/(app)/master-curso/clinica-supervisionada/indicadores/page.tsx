import type { Route } from "next";
import Link from "next/link";
import { ClinicalAttendanceIndicatorsDashboard } from "@/components/clinical/clinical-attendance-indicators-dashboard";
import { SectionCard } from "@/components/common/section-card";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";

export default async function MasterCourseClinicalAttendanceIndicatorsPage(props: {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    unitId?: string;
    areaId?: string;
    professorId?: string;
    studentId?: string;
    statusEvolucao?: string;
  }>;
}) {
  const currentUser = await requireAuthenticatedUser();
  const activeContext = getActiveMasterCourseContext(currentUser);

  if (!activeContext) {
    return (
      <div className="stack master-dashboard clinical-indicators-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão do curso</p>
          <h1>Indicadores clínicos indisponíveis</h1>
          <p>
            Esta visão exige um contexto ativo de Gestor do curso para consolidar os
            atendimentos clínicos em múltiplas unidades.
          </p>
          <div className="actions-row">
            <Link href={"/master-curso" as Route} className="button button-secondary">
              Voltar para gestão do curso
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalAttendanceIndicatorsPageData(
    currentUser,
    {
      dateFrom: searchParams.dateFrom ?? null,
      dateTo: searchParams.dateTo ?? null,
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
          <p className="eyebrow">Gestão do curso</p>
          <h1>Indicadores clínicos</h1>
          <p>
            Visão consolidada do curso para acompanhar atendimentos realizados por
            unidade, professor, aluno e área de estágio.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Indicadores indisponíveis"}
          description={
            emptyState?.description ??
            "Não foi possível consolidar os indicadores clínicos do curso neste contexto."
          }
        >
          <p className="empty-message">
            Assim que os atendimentos do curso estiverem registrados nas unidades visíveis,
            os indicadores aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <ClinicalAttendanceIndicatorsDashboard
      pageData={pageData}
      basePath={"/master-curso/clinica-supervisionada/indicadores" as Route}
      heroEyebrow="Gestão do curso"
      heroTitle="Indicadores clínicos"
      heroDescription="Visão consolidada do curso nas unidades permitidas, com foco em quantidade de atendimentos realizados, ausências e pendências de evolução."
      backHref={"/master-curso" as Route}
      backLabel="Voltar para gestão do curso"
    />
  );
}
