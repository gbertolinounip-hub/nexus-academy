import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterUserFilters } from "@/components/forms/master-user-filters";
import { MasterUserProfileForm } from "@/components/forms/master-user-profile-form";
import { toggleInstitutionalUserAccessAction } from "@/app/(app)/master/actions";
import { requireRole } from "@/lib/auth/session";
import { getMasterUsersPageData } from "@/services/master";

interface MasterUsersPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    perfil?: string | string[];
    status?: string | string[];
  }>;
}

export default async function MasterUsersPage({ searchParams }: MasterUsersPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterUsersPageData({
    institutionId: resolvedSearchParams?.instituicao,
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
          Liste coordenadores, professores e alunos por unidade, status e perfil, mantendo a
          governança administrativa da plataforma sem virar um fluxo operacional local.
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
        <MasterUserFilters
          institutions={pageData.institutions}
          units={pageData.units}
          filters={pageData.filters}
        />
      </SectionCard>

      <SectionCard
        title="Usuários institucionais"
        description="Ative, desative e corrija dados básicos dos usuários da plataforma sem entrar no fluxo acadêmico local."
      >
        {pageData.entries.length ? (
          <div className="master-scroll-shell table-scroll-md">
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
          </div>
        ) : (
          <p className="empty-message">Nenhum usuário encontrado com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
