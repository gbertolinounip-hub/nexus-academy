import { toggleInstitutionStatusAction } from "@/app/(app)/master/instituicoes/actions";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterInstitutionBrandingForm } from "@/components/forms/master-institution-branding-form";
import {
  MasterInstitutionCreateForm,
  MasterInstitutionEditForm
} from "@/components/forms/master-institution-form";
import { requireRole } from "@/lib/auth/session";
import { getInstitutionManagementPageData } from "@/services/institution-management";

export default async function MasterInstitutionsPage() {
  await requireRole(["coordenador_master"]);
  const pageData = await getInstitutionManagementPageData();

  return (
    <div className="stack master-dashboard master-institutions-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Instituições / IES</p>
        <h1>Governança da arquitetura multi-institucional</h1>
        <p>
          Cadastre, revise e ative instituições de ensino sem alterar
          automaticamente unidades, cursos e ofertas já existentes.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituições"
          value={String(pageData.summary.totalInstitutions)}
          hint="IES cadastradas na arquitetura nova."
        />
        <MetricCard
          label="Ativas"
          value={String(pageData.summary.totalActiveInstitutions)}
          hint="Instituições prontas para operação."
          tone="positive"
        />
        <MetricCard
          label="Inativas"
          value={String(pageData.summary.totalInactiveInstitutions)}
          hint="Instituições preservadas sem cascade automático."
          tone={pageData.summary.totalInactiveInstitutions > 0 ? "alert" : "positive"}
        />
        <MetricCard
          label="Unidades vinculadas"
          value={String(pageData.summary.totalLinkedUnits)}
          hint="Unidades que já apontam para uma instituição."
        />
        <MetricCard
          label="Cursos"
          value={String(pageData.summary.totalCourses)}
          hint="Cursos cadastrados por instituição."
        />
        <MetricCard
          label="Ofertas"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas de curso por unidade."
        />
      </div>

      <SectionCard
        title="Cadastrar instituição"
        description="Crie novas IES com slug único e mantenha o cadastro administrativo sob controle do módulo master."
      >
        <div className="management-block-card">
          <MasterInstitutionCreateForm />
        </div>
      </SectionCard>

      <SectionCard
        title="Instituições cadastradas"
        description="Edite dados básicos da IES e ative ou desative o cadastro sem afetar automaticamente unidades, cursos e ofertas vinculadas."
      >
        <div className="master-course-management-stack">
          <p className="field-help">
            Desativar uma instituição nesta etapa não desativa automaticamente
            unidades, cursos ou ofertas já vinculadas.
          </p>

          {pageData.institutions.length ? (
            <div className="table-wrap master-contexts-table-wrap">
              <table className="table master-institution-management-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Sigla</th>
                    <th>Slug</th>
                    <th>CNPJ</th>
                    <th>Status</th>
                    <th>Unidades</th>
                    <th>Cursos</th>
                    <th>Ofertas</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.institutions.map((institution) => (
                    <tr key={institution.id}>
                      <td>
                        <strong>{institution.name}</strong>
                        {institution.displayName ? (
                          <div className="table-helper">
                            Exibição interna: {institution.displayName}
                          </div>
                        ) : null}
                        {!institution.isActive &&
                        (institution.unitsCount > 0 ||
                          institution.coursesCount > 0 ||
                          institution.offersCount > 0) ? (
                          <div className="table-helper">
                            Estrutura vinculada permanece cadastrada mesmo com a IES
                            inativa.
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {institution.acronym ?? (
                          <span className="badge badge-muted">Sem sigla</span>
                        )}
                      </td>
                      <td>{institution.slug}</td>
                      <td>
                        {institution.cnpj ?? (
                          <span className="badge badge-muted">Sem CNPJ</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            institution.isActive ? "status-ativo" : "status-inativo"
                          }`}
                        >
                          {institution.isActive ? "ativa" : "inativa"}
                        </span>
                      </td>
                      <td>{institution.unitsCount}</td>
                      <td>{institution.coursesCount}</td>
                      <td>{institution.offersCount}</td>
                      <td>
                        <div className="master-institution-actions">
                          <ConfirmActionForm
                            action={toggleInstitutionStatusAction}
                            confirmationMessage={`Deseja ${
                              institution.isActive ? "desativar" : "ativar"
                            } a instituição ${institution.name}?`}
                            fields={[
                              { name: "institution_id", value: institution.id },
                              { name: "ativo", value: institution.isActive ? "false" : "true" }
                            ]}
                            className="button button-secondary button-small"
                          >
                            {institution.isActive ? "Desativar" : "Ativar"}
                          </ConfirmActionForm>

                          <details className="master-unit-disclosure master-institution-inline-disclosure">
                            <summary>Editar instituição</summary>
                            <div className="management-block-card master-institution-inline-card">
                              <MasterInstitutionEditForm institution={institution} />
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">Nenhuma instituição cadastrada até o momento.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Identidade Visual da IES"
        description="Configure nome de exibição e logos da instituição para uso apenas no ambiente autenticado do Nexus Academy."
      >
        <MasterInstitutionBrandingForm institutions={pageData.institutions} />
      </SectionCard>
    </div>
  );
}
