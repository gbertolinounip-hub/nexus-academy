import { SectionCard } from "@/components/common/section-card";
import { AbsenceForm } from "@/components/forms/absence-form";
import { AbsenceTable } from "@/components/tables/absence-table";
import { requireRole } from "@/lib/auth/session";
import { getProfessorAbsenceManagementPageData } from "@/services/absences";

export default async function AbsencesPage() {
  const currentUser = await requireRole(["professor"]);
  const { pageData, emptyState } = await getProfessorAbsenceManagementPageData(
    currentUser
  );

  return (
    <div className="stack professor-workflow-page professor-absences-page">
      <section className="hero-card">
        <p className="eyebrow">Faltas do estágio</p>
        <h1>Registro de faltas</h1>
        <p>
          Registre faltas justificadas e não justificadas dos alunos vinculados
          à sua supervisão. As faltas não justificadas impactam
          automaticamente a composição da nota.
        </p>
      </section>

      <SectionCard
        title="Registrar falta"
        description="Cada hora não justificada reduz 1 ponto percentual da média semestral."
      >
        {pageData ? (
          <AbsenceForm studentOptions={pageData.studentOptions} mode={pageData.mode} />
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Formulário indisponível"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                `O usuário ${currentUser.name} ainda não possui dados suficientes para registrar faltas.`}
            </p>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Faltas registradas"
        description="Acompanhe as faltas registradas na sua supervisão."
      >
        {pageData ? (
          pageData.absences.length ? (
            <AbsenceTable absences={pageData.absences} />
          ) : (
            <p className="empty-message">
              Ainda não há faltas registradas para os alunos vinculados a este
              professor.
            </p>
          )
        ) : (
          <p className="empty-message">
            A listagem de faltas ficará disponível assim que houver dados acadêmicos.
          </p>
        )}
      </SectionCard>
    </div>
  );
}



