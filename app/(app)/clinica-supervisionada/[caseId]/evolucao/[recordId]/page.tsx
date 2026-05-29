import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { getClinicalEvolutionPageData } from "@/services/clinical-supervision";
import { ClinicalEvolutionRecordScreen } from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/evolution-record-screen";

export default async function ClinicalEvolutionRecordPage(props: {
  params: Promise<{ caseId: string; recordId: string }>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const params = await props.params;
  const { pageData, emptyState } = await getClinicalEvolutionPageData(
    currentUser,
    params.caseId,
    params.recordId
  );

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page clinical-evaluation-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Evolução</h1>
          <p>Visualização de um registro diário de evolução e conduta.</p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Evolução indisponível"}
          description={
            emptyState?.description ??
            "Não foi possível carregar a evolução solicitada neste contexto."
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
