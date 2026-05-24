import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { EvaluationForm } from "@/components/forms/evaluation-form";
import { requireRole } from "@/lib/auth/session";
import { formatEvaluationStatus } from "@/lib/utils/format";
import { getEvaluationEditorPageData } from "@/services/evaluations";

interface EvaluationEditorPageProps {
  params: Promise<{
    evaluationId: string;
  }>;
}

function pageCopy(
  status: "rascunho" | "publicado" | "cancelado" | undefined,
  isRevisionDraft: boolean
) {
  if (status === "rascunho") {
    return {
      eyebrow: isRevisionDraft ? "Rascunho de revisão" : "Rascunho em andamento",
      title: isRevisionDraft
        ? "Editar revisão incremental"
        : "Editar lançamento salvo",
      description: isRevisionDraft
        ? "O formulário abaixo recupera o rascunho de revisão incremental e permite salvar novamente ou publicar apenas os itens alterados."
        : "O formulário abaixo recupera os dados reais já gravados e permite salvar novamente como rascunho ou publicar."
    };
  }

  return {
    eyebrow: "Consulta de lançamento",
    title: "Lançamento publicado",
    description:
      "Este registro está disponível para leitura, preservando a rastreabilidade do que já foi publicado."
  };
}

export default async function EvaluationEditorPage({
  params
}: EvaluationEditorPageProps) {
  const currentUser = await requireRole(["professor"]);
  const { evaluationId } = await params;
  const { formData, emptyState } = await getEvaluationEditorPageData(
    currentUser,
    evaluationId
  );
  const copy = pageCopy(
    formData?.initialValues?.status,
    Boolean(formData?.initialValues?.evaluationOriginId)
  );

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </section>

      <SectionCard
        title="Dados do lançamento"
        description="Recuperação em tempo real de public.avaliações e public.itens_avaliados."
        actions={
          <div className="actions-row">
            <Link href={"/avaliacoes" as Route} className="button button-secondary">
              Meus lançamentos
            </Link>
            {formData?.revisionAction ? (
              <Link
                href={formData.revisionAction.href as Route}
                className="button button-secondary"
              >
                {formData.revisionAction.label}
              </Link>
            ) : null}
            <Link href="/avaliacoes/nova" className="button">
              Novo lançamento
            </Link>
          </div>
        }
      >
        {formData ? (
          <EvaluationForm
            studentOptions={formData.studentOptions}
            rubricGroups={formData.rubricGroups}
            mode={formData.mode}
            initialValues={formData.initialValues}
            readOnlyMessage={formData.readOnlyMessage}
            contextMessage={formData.contextMessage}
          />
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Lançamento indisponível"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                "Não foi possível carregar este lançamento para o professor autenticado."}
            </p>
          </div>
        )}
      </SectionCard>

      {formData?.revisionChain.length ? (
        <SectionCard
          title="Linha de versões"
          description="Sequência auditável da avaliação original e de suas revisões vinculadas."
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



