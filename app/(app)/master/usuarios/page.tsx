import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterUserProfileForm } from "@/components/forms/master-user-profile-form";
import { toggleInstitutionalUserAccessAction } from "@/app/(app)/master/actions";
import { requireRole } from "@/lib/auth/session";
import { getMasterUsersPageData } from "@/services/master";

interface MasterUsersPageProps {
  searchParams?: Promise<{
    unidade?: string | string[];
    perfil?: string | string[];
    status?: string | string[];
  }>;
}

export default async function MasterUsersPage({
  searchParams
}: MasterUsersPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterUsersPageData({
    unitId: resolvedSearchParams?.unidade,
    role: resolvedSearchParams?.perfil,
    status: resolvedSearchParams?.status
  });

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Usuários</p>
        <h1>Visão institucional de acessos</h1>
        <p>
          Liste coordenadores, professores e alunos por unidade, status e perfil,
          mantendo a governança administrativa da plataforma sem virar um fluxo
          operacional local.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Usuários listados"
          value={String(pageData.totalUsers)}
          hint="Total de usuários visíveis com os filtros atuais."
        />
        <MetricCard
          label="Usuários ativos"
          value={String(pageData.activeUsers)}
          hint="Acessos habilitados entre coordenadores, professores e alunos."
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros administrativos"
        description="Filtre por unidade, perfil e status para revisar a base institucional sem misturar esta leitura com a operação das coordenações locais."
      >
        <form method="get" className="master-filter-form master-filter-form-wide">
          <label className="field">
            <span>Unidade</span>
            <select
              className="input"
              name="unidade"
              defaultValue={pageData.filters.unitId}
            >
              <option value="">Todas as unidades</option>
              {pageData.units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Perfil</span>
            <select
              className="input"
              name="perfil"
              defaultValue={pageData.filters.role}
            >
              <option value="todos">Todos</option>
              <option value="coordenador">Coordenadores</option>
              <option value="professor">Professores</option>
              <option value="aluno">Alunos</option>
            </select>
          </label>

          <label className="field">
            <span>Status</span>
            <select
              className="input"
              name="status"
              defaultValue={pageData.filters.status}
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>

          <div className="actions-row master-filter-actions">
            <button className="button button-secondary" type="submit">
              Aplicar filtros
            </button>
            <Link href={"/master/usuarios" as Route} className="button button-secondary">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Usuários institucionais"
        description="Ative, desative e corrija dados básicos dos usuários da plataforma sem entrar no fluxo acadêmico local."
      >
        {pageData.entries.length ? (
          <div className="master-entity-grid">
            {pageData.entries.map((entry) => (
              <article
                key={entry.userId}
                className="management-block-card master-entity-card"
              >
                <div className="management-block-header">
                  <div>
                    <h3>{entry.name}</h3>
                    <p className="field-help">{entry.email}</p>
                  </div>
                  <div className="master-pill-group">
                    <span
                      className={`status-pill ${
                        entry.isActive ? "status-ativo" : "status-inativo"
                      }`}
                    >
                      {entry.isActive ? "ativo" : "inativo"}
                    </span>
                  </div>
                </div>

                <div className="report-mini-grid master-unit-mini-grid">
                  <div className="report-mini-card">
                    <span>Perfil</span>
                    <strong>{entry.roleLabel}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Unidade</span>
                    <strong>{entry.unitName}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Vínculo</span>
                    <strong>{entry.auxiliaryLabel}</strong>
                  </div>
                </div>

                <div className="actions-row">
                  {entry.unitId ? (
                    <Link
                      href={`/master/unidades/${encodeURIComponent(entry.unitId)}` as Route}
                      className="button button-secondary button-small"
                    >
                      Abrir unidade
                    </Link>
                  ) : null}
                  <ConfirmActionForm
                    action={toggleInstitutionalUserAccessAction}
                    confirmationMessage={`Deseja ${
                      entry.isActive ? "desativar" : "ativar"
                    } o acesso de ${entry.name}?`}
                    fields={[
                      { name: "user_id", value: entry.userId },
                      { name: "ativo", value: entry.isActive ? "false" : "true" }
                    ]}
                    className="button button-secondary button-small"
                  >
                    {entry.isActive ? "Desativar acesso" : "Ativar acesso"}
                  </ConfirmActionForm>
                </div>

                <details className="master-unit-disclosure">
                  <summary>Corrigir cadastro básico</summary>
                  <MasterUserProfileForm
                    initialValues={{
                      user_id: entry.userId,
                      nome_completo: entry.name
                    }}
                  />
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Nenhum usuário encontrado com os filtros atuais.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
