import Link from "next/link";
import { SectionCard } from "@/components/common/section-card";
import { EvaluationTable } from "@/components/tables/evaluation-table";
import { requireRole } from "@/lib/auth/session";
import { getProfessorEvaluationListPageData } from "@/services/evaluations";

export default async function ProfessorEvaluationsPage() {
  const currentUser = await requireRole(["professor"]);
  const { listData, emptyState } = await getProfessorEvaluationListPageData(currentUser);

  return (
    <div className="stack professor-workflow-page professor-evaluations-page">
      <section className="hero-card">
        <p className="eyebrow">Meus lançamentos</p>
        <h1>{currentUser.name}</h1>
        <p>
          Faça e consulte lançamentos salvos, acompanhe registros publicados e
          continue revisões sem perder o histórico.
        </p>
      </section>

      <SectionCard
        title="Lançamentos salvos"
        description="Acompanhe os lançamentos vinculados à sua supervisão."
        actions={
          <Link href="/avaliacoes/nova" className="button">
            Novo lançamento
          </Link>
        }
      >
        {listData ? (
          listData.evaluations.length ? (
            <EvaluationTable evaluations={listData.evaluations} />
          ) : (
            <div className="form-stack">
              <p className="empty-message">
                Ainda não há lançamentos salvos por este professor.
              </p>
              <p className="empty-message">
                Use o botão acima para criar um novo rascunho ou publicar uma avaliação.
              </p>
            </div>
          )
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Listagem indisponível no momento"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                "Ainda não foi possível montar os lançamentos deste professor com os dados atuais."}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}



