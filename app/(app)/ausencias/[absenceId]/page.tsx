import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { AbsenceForm } from "@/components/forms/absence-form";
import { requireRole } from "@/lib/auth/session";
import { getAbsenceEditorPageData } from "@/services/absences";

interface AbsenceEditorPageProps {
  params: Promise<{
    absenceId: string;
  }>;
}

export default async function AbsenceEditorPage({
  params
}: AbsenceEditorPageProps) {
  const currentUser = await requireRole(["professor"]);
  const { absenceId } = await params;
  const { formData, emptyState } = await getAbsenceEditorPageData(
    currentUser,
    absenceId
  );

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Revisão de falta</p>
        <h1>Editar falta registrada</h1>
        <p>
          Atualize uma falta já salva para um aluno vinculado. O impacto na nota
          será recalculado automaticamente a partir da situação justificada ou
          não justificada.
        </p>
      </section>

      <SectionCard
        title="Dados da falta"
        description="A alteração é registrada em auditoria e refletida nos dashboards e relatórios."
        actions={
          <Link href={"/ausencias" as Route} className="button button-secondary">
            Voltar para faltas
          </Link>
        }
      >
        {formData ? (
          <AbsenceForm
            studentOptions={formData.studentOptions}
            mode={formData.mode}
            initialValues={formData.initialValues}
          />
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Falta indisponível"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                "Não foi possível carregar esta falta para o professor autenticado."}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}




