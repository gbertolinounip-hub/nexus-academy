import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterCoordinatorProfileForm } from "@/components/forms/master-coordinator-profile-form";
import { toggleCoordinatorAccessAction } from "@/app/(app)/master/actions";
import { requireRole } from "@/lib/auth/session";
import { getMasterCoordinatorsPageData } from "@/services/master";

interface MasterCoordinatorsPageProps {
  searchParams?: Promise<{
    unidade?: string | string[];
    status?: string | string[];
  }>;
}

export default async function MasterCoordinatorsPage({
  searchParams
}: MasterCoordinatorsPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterCoordinatorsPageData({
    unitId: resolvedSearchParams?.unidade,
    status: resolvedSearchParams?.status
  });

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Coordenadores</p>
        <h1>Gestão institucional de coordenadores</h1>
        <p>
          Liste responsáveis das unidades, filtre por campus, ajuste dados
          básicos e controle o acesso institucional sem misturar este fluxo com
          a operação acadêmica local.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Coordenadores listados"
          value={String(pageData.totalCoordinators)}
          hint="Total de vínculos de coordenação registrados nas unidades."
        />
        <MetricCard
          label="Coordenadores ativos"
          value={String(pageData.activeCoordinators)}
          hint="Acessos atualmente habilitados para coordenação local."
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description="Restrinja a visão por unidade ou status sem alterar a operação diária das coordenações locais."
      >
        <form method="get" className="master-filter-form">
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
            <Link href={"/master/coordenadores" as Route} className="button button-secondary">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Coordenadores por unidade"
        description="Cada unidade mantém seu responsável local, mas o master continua com governança institucional completa sobre o acesso."
      >
        {pageData.entries.length ? (
          <div className="master-entity-grid">
            {pageData.entries.map((entry) => (
              <article
                key={`${entry.unitId}-${entry.coordinatorId}`}
                className="management-block-card master-entity-card"
              >
                <div className="management-block-header">
                  <div>
                    <h3>{entry.name}</h3>
                    <p className="field-help">{entry.email}</p>
                  </div>
                  <div className="master-pill-group">
                    {entry.isResponsible ? (
                      <span className="status-pill status-ativo">responsável</span>
                    ) : null}
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
                    <span>Unidade</span>
                    <strong>{entry.unitName}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Cargo</span>
                    <strong>{entry.roleTitle}</strong>
                  </div>
                </div>

                <div className="actions-row">
                  <Link
                    href={`/master/unidades/${encodeURIComponent(entry.unitId)}` as Route}
                    className="button button-secondary button-small"
                  >
                    Abrir unidade
                  </Link>
                  <ConfirmActionForm
                    action={toggleCoordinatorAccessAction}
                    confirmationMessage={`Deseja ${
                      entry.isActive ? "desativar" : "ativar"
                    } o acesso de ${entry.name}?`}
                    fields={[
                      { name: "coordinator_id", value: entry.coordinatorId },
                      { name: "unit_id", value: entry.unitId },
                      { name: "ativo", value: entry.isActive ? "false" : "true" }
                    ]}
                    className="button button-secondary button-small"
                  >
                    {entry.isActive ? "Desativar acesso" : "Ativar acesso"}
                  </ConfirmActionForm>
                </div>

                <details className="master-unit-disclosure">
                  <summary>Editar coordenador</summary>
                  <MasterCoordinatorProfileForm
                    initialValues={{
                      coordinator_id: entry.coordinatorId,
                      unit_id: entry.unitId,
                      nome_completo: entry.name,
                      cargo: entry.roleTitle
                    }}
                  />
                </details>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Nenhum coordenador encontrado com os filtros atuais.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
