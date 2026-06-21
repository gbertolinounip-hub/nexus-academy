import { SectionCard } from "@/components/common/section-card";
import { TceStudentPageClient } from "@/components/tce/tce-student-page-client";
import { requireRole } from "@/lib/auth/session";
import { loadStudentAvailableTces } from "@/services/tce";

export default async function StudentTcePage() {
  const currentUser = await requireRole(["aluno"]);
  const { pageData, emptyState } = await loadStudentAvailableTces(currentUser);

  if (!pageData || emptyState) {
    return (
      <div className="stack student-tce-page">
        <section className="hero-card">
          <p className="eyebrow">TCE do aluno</p>
          <h1>{currentUser.name}</h1>
          <p>
            Esta área reúne o Termo de Compromisso de Estágio aplicável à sua
            matrícula, com base nas configurações da coordenação.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "TCE indisponível"}
          description={
            emptyState?.description ??
            "Ainda não foi possível localizar uma configuração de TCE para o aluno autenticado."
          }
        >
          <p className="field-help">
            Assim que a coordenação cadastrar a configuração do TCE para sua área e
            semestre de estágio, esta tela exibirá o formulário e a prévia do
            documento.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack student-tce-page">
      <section className="hero-card">
        <p className="eyebrow">TCE do aluno</p>
        <h1>{pageData.student.name}</h1>
        <p>
          Confira o Termo de Compromisso de Estágio aplicável à sua área, revise os
          dados do estagiário e acompanhe a prévia HTML antes da geração final do
          documento em Word.
        </p>
      </section>

      <TceStudentPageClient pageData={pageData} />
    </div>
  );
}
