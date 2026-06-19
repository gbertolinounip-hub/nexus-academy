import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { CourseManagerForm } from "@/components/forms/course-manager-form";
import { CourseManagerRegistrationForm } from "@/components/forms/course-manager-registration-form";
import { toggleCourseManagerStatusAction } from "@/app/(app)/master/gestores-curso/actions";
import { requireRole } from "@/lib/auth/session";
import { getCourseManagerManagementPageData } from "@/services/course-manager-management";

function renderBooleanPill(value: boolean, activeLabel = "Ativo", inactiveLabel = "Inativo") {
  return (
    <span className={`status-pill ${value ? "status-ativo" : "status-inativo"}`}>
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

export default async function MasterCourseManagersPage() {
  await requireRole(["coordenador_master"]);
  const pageData = await getCourseManagerManagementPageData();

  return (
    <div className="stack master-dashboard master-course-managers-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Gestores de curso</p>
        <h1>Gestão institucional de Gestores de curso</h1>
        <p>
          Cadastre novos Gestores do curso ou atribua o contexto institucional a
          usuários já existentes, sem promover acesso global do Nexus Admin.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Vínculos de Gestor"
          value={String(pageData.summary.totalManagers)}
          hint="Total de vínculos de Gestor do curso cadastrados."
        />
        <MetricCard
          label="Gestores ativos"
          value={String(pageData.summary.totalActiveManagers)}
          hint="Vínculos ativos para atuação institucional por curso."
          tone="positive"
        />
        <MetricCard
          label="Gestores inativos"
          value={String(pageData.summary.totalInactiveManagers)}
          hint="Vínculos preservados sem exclusão."
          tone={pageData.summary.totalInactiveManagers > 0 ? "alert" : "positive"}
        />
        <MetricCard
          label="Instituições cobertas"
          value={String(pageData.summary.totalInstitutionsCovered)}
          hint="IES com pelo menos um Gestor de curso vinculado."
        />
        <MetricCard
          label="Cursos cobertos"
          value={String(pageData.summary.totalCoursesCovered)}
          hint="Cursos com gestão institucional já atribuída."
        />
        <MetricCard
          label="Usuários disponíveis"
          value={String(pageData.summary.totalAvailableUsers)}
          hint="Usuários ativos elegíveis para receber o contexto."
        />
      </div>

      <SectionCard
        title="Cadastrar novo Gestor do curso"
        description="Crie um novo usuário com perfil legado seguro de coordenador e já vincule o contexto técnico de Gestor do curso para a instituição e o curso selecionados."
      >
        <div className="management-block-card">
          <CourseManagerRegistrationForm
            institutions={pageData.institutions}
            courses={pageData.courses}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Atribuir usuário existente como Gestor do curso"
        description="Crie ou reative o contexto institucional de Gestor do curso para um usuário existente, sem alterar perfil legado, unidade ou contexto padrão."
      >
        <div className="management-block-card">
          <CourseManagerForm
            institutions={pageData.institutions}
            courses={pageData.courses}
            users={pageData.users}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Gestores de curso vinculados"
        description="Visão administrativa dos contextos de Gestor do curso por instituição e curso."
      >
        {pageData.entries.length ? (
          <div className="table-wrap master-contexts-table-wrap">
            <table className="table master-course-manager-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Instituição</th>
                  <th>Curso</th>
                  <th>Escopo</th>
                  <th>Principal</th>
                  <th>Status</th>
                  <th>Criado em</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {pageData.entries.map((entry) => (
                  <tr key={entry.contextId}>
                    <td>
                      <strong>{entry.userName}</strong>
                      <div className="table-helper">{entry.userEmail}</div>
                      {!entry.userActive ? (
                        <div className="table-helper">Usuário legado inativo</div>
                      ) : null}
                      {entry.isDefaultContext ? (
                        <div className="table-helper">Contexto padrão atual</div>
                      ) : null}
                    </td>
                    <td>
                      {entry.institutionName ?? (
                        <span className="badge badge-muted">Sem instituição</span>
                      )}
                    </td>
                    <td>
                      <strong>
                        {entry.courseCode ? `${entry.courseCode} - ` : ""}
                        {entry.courseName ?? "Curso não identificado"}
                      </strong>
                    </td>
                    <td>
                      <span className="badge badge-muted">{entry.scopeLabel}</span>
                    </td>
                    <td>{renderBooleanPill(entry.principal, "Principal", "Secundario")}</td>
                    <td>{renderBooleanPill(entry.ativo)}</td>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>
                      <ConfirmActionForm
                        action={toggleCourseManagerStatusAction}
                        confirmationMessage={`Deseja ${
                          entry.ativo ? "desativar" : "ativar"
                        } o vínculo de Gestor do curso de ${entry.userName}?`}
                        fields={[
                          { name: "context_id", value: entry.contextId },
                          { name: "ativo", value: entry.ativo ? "false" : "true" }
                        ]}
                        className="button button-secondary button-small"
                      >
                        {entry.ativo ? "Desativar" : "Ativar"}
                      </ConfirmActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Ainda não há Gestores de curso vinculados na base atual.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
