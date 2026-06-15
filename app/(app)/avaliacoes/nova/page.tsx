import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { EvaluationForm } from "@/components/forms/evaluation-form";
import { requireRole } from "@/lib/auth/session";
import { getEvaluationFormPageData } from "@/services/evaluations";

export default async function NewEvaluationPage() {
  const currentUser = await requireRole(["professor"]);
  const { formData, emptyState } = await getEvaluationFormPageData(currentUser);

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Lançamento de avaliação</p>
        <h1>Novo lançamento do semestre</h1>
        <p>
          Registro real de avaliações parciais, revisões e fechamento, com
          gravação em public.avaliações e public.itens_avaliados.
        </p>
      </section>

      <SectionCard
        title="Rubrica de avaliação"
        description="Cada campo representa um subitem com peso específico no total do semestre."
        actions={
          <Link href={"/avaliacoes" as Route} className="button button-secondary">
            Meus lançamentos
          </Link>
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
              {emptyState?.title ?? "Formulário indisponível no momento"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                `O usuário ${currentUser.name} ainda não possui dados suficientes para lançamento.`}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}



