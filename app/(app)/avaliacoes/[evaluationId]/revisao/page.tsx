import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { SectionCard } from "@/components/common/section-card";
import { EvaluationForm } from "@/components/forms/evaluation-form";
import { requireRole } from "@/lib/auth/session";
import { formatEvaluationStatus } from "@/lib/utils/format";
import { getEvaluationReviewPageData } from "@/services/evaluations";

interface EvaluationReviewPageProps {
  params: Promise<{
    evaluationId: string;
  }>;
}

export default async function EvaluationReviewPage({
  params
}: EvaluationReviewPageProps) {
  const currentUser = await requireRole(["professor"]);
  const { evaluationId } = await params;
  const { formData, emptyState, redirectToEvaluationId } =
    await getEvaluationReviewPageData(currentUser, evaluationId);

  if (redirectToEvaluationId) {
    redirect(`/avaliacoes/${redirectToEvaluationId}`);
  }

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Reavaliação incremental</p>
        <h1>Nova revisão vinculada</h1>
        <p>
          Ajuste apenas os itens necessários desta avaliação publicada. A
          versão original permanece intacta e a nova revisão passa a compor a
          nota somente nos critérios alterados.
        </p>
      </section>

      <SectionCard
        title="Formulário de revisão"
        description="Os itens não preenchidos continuam herdados da versão publicada anterior."
        actions={
          <div className="actions-row">
            <Link
              href={`/avaliacoes/${evaluationId}` as Route}
              className="button button-secondary"
            >
              Voltar ao lançamento
            </Link>
            <Link href={"/avaliacoes" as Route} className="button button-secondary">
              Meus lançamentos
            </Link>
          </div>
        }
      >
        {formData ? (
          <EvaluationForm
            studentOptions={formData.studentOptions}
            rubricGroups={formData.rubricGroups}
            evaluationMode={formData.evaluationMode}
            evaluationModelName={formData.evaluationModelName}
            runtimeContextsByEnrollmentId={formData.runtimeContextsByEnrollmentId}
            mode={formData.mode}
            initialValues={formData.initialValues}
            readOnlyMessage={formData.readOnlyMessage}
            contextMessage={formData.contextMessage}
          />
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Revisão indisponível"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                "Não foi possível abrir a revisão incremental para este lançamento."}
            </p>
          </div>
        )}
      </SectionCard>

      {formData?.revisionChain.length ? (
        <SectionCard
          title="Linha de versões"
          description="A nova revisão será vinculada a esta cadeia acadêmica e auditável."
        >
          <div className="revision-chain">
            {formData.revisionChain.map((entry) => (
              <div
                key={entry.id}
                className={`revision-chain-item${
                  entry.isCurrent ? " revision-chain-item-current" : ""
                }`}
              >
                <div className="revision-chain-header">
                  <strong>{entry.label}</strong>
                  <div className="inline-badges">
                    {entry.isLegacyRecord ? (
                      <span className="badge badge-muted">Registro legado</span>
                    ) : null}
                    <span className={`status-pill status-${entry.status}`}>
                      {formatEvaluationStatus(entry.status)}
                    </span>
                  </div>
                </div>
                <p>{entry.reference}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}



