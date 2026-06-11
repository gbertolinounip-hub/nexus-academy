import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  MasterInstitutionalStructureFilters,
  MasterInstitutionalUserContextFilters
} from "@/components/forms/master-institutional-context-filters";
import { requireRole } from "@/lib/auth/session";
import { getInstitutionalContextsPageData } from "@/services/institutional-contexts";

function renderBooleanPill(value: boolean, activeLabel = "Ativo", inactiveLabel = "Inativo") {
  return (
    <span className={`status-pill ${value ? "status-ativo" : "status-inativo"}`}>
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterInstitutionalContextsPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    perfil_contexto?: string | string[];
  }>;
}

export default async function MasterInstitutionalContextsPage({
  searchParams
}: MasterInstitutionalContextsPageProps) {
  const currentUser = await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const pageData = await getInstitutionalContextsPageData({
    institutionId: readSearchParam(resolvedSearchParams.instituicao),
    unitId: readSearchParam(resolvedSearchParams.unidade),
    courseId: readSearchParam(resolvedSearchParams.curso),
    contextProfile: readSearchParam(resolvedSearchParams.perfil_contexto)
  });
  const { institutionId, unitId, courseId, contextProfile } = pageData.filters;

  const filteredStructureEntries = pageData.structureEntries.filter((entry) => {
    if (institutionId && entry.institutionId !== institutionId) {
      return false;
    }

    if (unitId && entry.unitId !== unitId) {
      return false;
    }

    return true;
  });

  const filteredUserContextEntries = pageData.userContextEntries.filter((entry) => {
    if (institutionId && entry.institutionId !== institutionId) {
      return false;
    }

    if (unitId && entry.unitId !== unitId && entry.legacyUnitId !== unitId) {
      return false;
    }

    if (courseId && entry.courseId !== courseId) {
      return false;
    }

    if (contextProfile && entry.contextProfileCode !== contextProfile) {
      return false;
    }

    return true;
  });

  const filteredMasterCourseEntries = pageData.masterCourseEntries.filter((entry) => {
    if (institutionId && entry.institutionId !== institutionId) {
      return false;
    }

    if (courseId && entry.courseId !== courseId) {
      return false;
    }

    return true;
  });

  return (
    <div className="stack master-dashboard master-contexts-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Estrutura institucional</p>
        <h1>Contextos institucionais e multicurso</h1>
        <p>
          {currentUser.name}, acompanhe a camada nova de instituições, cursos, ofertas e
          contextos escopados sem mexer nos fluxos acadêmicos já operacionais.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituições"
          value={String(pageData.summary.totalInstitutions)}
          hint="Total de instituições cadastradas na arquitetura nova."
        />
        <MetricCard
          label="Unidades"
          value={String(pageData.summary.totalUnits)}
          hint="Campi e unidades hoje conhecidos pela plataforma."
        />
        <MetricCard
          label="Cursos"
          value={String(pageData.summary.totalCourses)}
          hint="Cursos vinculados às instituições contratantes."
        />
        <MetricCard
          label="Ofertas por unidade"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas ativas ou inativas de curso por campus."
        />
        <MetricCard
          label="Usuários com contexto"
          value={String(pageData.summary.totalUsersWithContext)}
          hint="Usuários já mapeados em usuarios_papeis_contexto."
          tone="positive"
        />
        <MetricCard
          label="Usuários sem contexto"
          value={String(pageData.summary.totalUsersWithoutContext)}
          hint="Cadastros ainda dependentes apenas do perfil legado."
          tone={pageData.summary.totalUsersWithoutContext > 0 ? "alert" : "positive"}
        />
        <MetricCard
          label="Múltiplos contextos"
          value={String(pageData.summary.totalUsersWithMultipleContexts)}
          hint="Usuários com mais de um contexto ativo para futura gestão."
        />
        <MetricCard
          label="Com contexto padrão"
          value={String(pageData.summary.totalUsersWithDefaultContext)}
          hint="Usuários que já têm contexto_padrao_id definido."
        />
        <MetricCard
          label="Gestores de curso"
          value={String(pageData.summary.totalMasterCourseUsers)}
          hint="Usuários com contexto de Gestor do curso já vinculados."
        />
      </div>

      <SectionCard
        title="Estrutura institucional"
        description="Visão consolidada de instituição, unidade, curso e oferta conforme a nova modelagem."
      >
        <MasterInstitutionalStructureFilters
          institutions={pageData.institutions}
          units={pageData.units}
          filters={pageData.filters}
        />

        {filteredStructureEntries.length ? (
          <div className="table-wrap master-contexts-table-wrap">
            <table className="table master-simple-table master-contexts-structure-table">
              <thead>
                <tr>
                  <th>Instituição</th>
                  <th>Unidade</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredStructureEntries.map((entry) => (
                  <tr key={`${entry.unitId}:${entry.offerId ?? "sem-oferta"}`}>
                    <td>
                      <strong>{entry.institutionName}</strong>
                    </td>
                    <td>
                      <strong>{entry.unitName}</strong>
                    </td>
                    <td>
                      {entry.courseName ?? <span className="badge badge-muted">Sem curso</span>}
                    </td>
                    <td>
                      {entry.offerName ?? <span className="badge badge-muted">Sem oferta</span>}
                    </td>
                    <td>
                      {entry.offerId ? (
                        renderBooleanPill(entry.isActive)
                      ) : (
                        <span className="badge badge-muted">{entry.statusLabel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Nenhuma estrutura institucional foi encontrada com os filtros atuais.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Contextos de usuários"
        description="Leitura administrativa dos vínculos entre perfil legado, unidade antiga e novos contextos institucionais."
      >
        <MasterInstitutionalUserContextFilters
          institutions={pageData.institutions}
          units={pageData.units}
          courses={pageData.courses}
          contextProfiles={pageData.contextProfiles}
          filters={pageData.filters}
        />

        {filteredUserContextEntries.length ? (
          <div className="table-wrap master-contexts-table-wrap master-contexts-user-table-scroll">
            <table className="table master-contexts-user-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil legado</th>
                  <th>Unidade legada</th>
                  <th>Perfil de contexto</th>
                  <th>Instituição</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Principal</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {filteredUserContextEntries.map((entry) => (
                  <tr key={entry.contextId}>
                    <td>
                      <strong>{entry.userName}</strong>
                      <div className="table-helper">{entry.userEmail}</div>
                    </td>
                    <td>
                      <strong>{entry.legacyProfileName}</strong>
                      <div className="table-helper">
                        {entry.userActive ? "Usuário ativo" : "Usuário inativo"}
                      </div>
                    </td>
                    <td>
                      {entry.legacyUnitName ?? <span className="badge badge-muted">Sem unidade</span>}
                    </td>
                    <td>
                      <strong>{entry.contextProfileName}</strong>
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
                      {entry.courseName ?? <span className="badge badge-muted">Sem curso</span>}
                    </td>
                    <td>
                      {entry.offerName ?? <span className="badge badge-muted">Sem oferta</span>}
                    </td>
                    <td>{renderBooleanPill(entry.principal, "Principal", "Secundário")}</td>
                    <td>{renderBooleanPill(entry.ativo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Nenhum contexto encontrado para os filtros atuais.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Usuários com perfil de Gestor do curso"
        description="Recorte inicial para acompanhar a gestão institucional dos cursos dentro da nova arquitetura."
      >
        {filteredMasterCourseEntries.length ? (
          <div className="table-wrap master-contexts-table-wrap">
            <table className="table master-simple-table master-contexts-master-course-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Instituição</th>
                  <th>Curso</th>
                  <th>Principal</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {filteredMasterCourseEntries.map((entry) => (
                  <tr key={`${entry.userId}:${entry.courseId ?? "sem-curso"}`}>
                    <td>
                      <strong>{entry.userName}</strong>
                      <div className="table-helper">{entry.userEmail}</div>
                    </td>
                    <td>
                      {entry.institutionName ?? (
                        <span className="badge badge-muted">Sem instituição</span>
                      )}
                    </td>
                    <td>
                      {entry.courseName ?? <span className="badge badge-muted">Sem curso</span>}
                    </td>
                    <td>{renderBooleanPill(entry.principal, "Principal", "Secundário")}</td>
                    <td>{renderBooleanPill(entry.ativo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Ainda não há usuários com contexto de Gestor do curso.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Alertas e diagnósticos"
        description="Pendências úteis para acompanhar a cobertura da migração sem bloquear a operação atual."
      >
        <div className="master-context-alert-grid">
          {pageData.alerts.map((alert) => (
            <article
              key={alert.key}
              className={`master-context-alert-card master-context-alert-card-${alert.tone}`}
            >
              <div className="master-context-alert-header">
                <div>
                  <h3>{alert.title}</h3>
                  <p>{alert.description}</p>
                </div>
                <strong>{alert.count}</strong>
              </div>

              {alert.sampleItems.length ? (
                <ul className="master-pending-list">
                  {alert.sampleItems.map((sampleItem) => (
                    <li key={`${alert.key}:${sampleItem}`}>{sampleItem}</li>
                  ))}
                </ul>
              ) : (
                <p className="empty-message">Nenhuma pendência identificada neste recorte.</p>
              )}
            </article>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
