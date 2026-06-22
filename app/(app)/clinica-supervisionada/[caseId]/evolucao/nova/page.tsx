import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { getClinicalEvolutionPageData } from "@/services/clinical-supervision";
import { ClinicalEvolutionRecordScreen } from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/evolution-record-screen";

export default async function ClinicalNewEvolutionPage(props: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<{
    attendanceId?: string;
  }>;
}) {
  const currentUser = await requireRole(["aluno"]);
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getClinicalEvolutionPageData(
    currentUser,
    params.caseId,
    null,
    {
      attendanceId: searchParams.attendanceId ?? null
    }
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-evaluation-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Nova evolução</h1>
          <p>Crie um novo registro diário de evolução e conduta para este caso.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Nova evolução indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível preparar a criação de uma nova evolução neste contexto."
          }
        >
          <p className="empty-message">
            Revise o vínculo do caso e tente novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  return <ClinicalEvolutionRecordScreen pageData={pageData} />;
}
