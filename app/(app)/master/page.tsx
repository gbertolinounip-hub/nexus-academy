import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterUnitForm } from "@/components/forms/master-unit-form";
import { createEmptyUnitFormValues } from "@/app/(app)/master/state";
import { requireRole } from "@/lib/auth/session";
import { getMasterDashboardPageData } from "@/services/master";

function formatLocation(city: string | null, state: string | null) {
  if (city && state) {
    return `${city} / ${state}`;
  }

  return city || state || "Não informado";
}

export default async function MasterDashboardPage() {
  const currentUser = await requireRole(["coordenador_master"]);
  const dashboard = await getMasterDashboardPageData(currentUser);
  const priorityUnits = dashboard.units.filter((unit) => unit.pendingItems.length).slice(0, 4);

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Governança institucional</p>
        <h1>{dashboard.masterName}</h1>
        <p>
          Acompanhe a operação multiunidade da Nexus Academy com visão global de
          unidades, acessos institucionais e governança acadêmica.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Unidades ativas"
          value={String(dashboard.totalActiveUnits)}
          hint="Campi e operações em funcionamento na plataforma."
          tone="positive"
        />
        <MetricCard
          label="Coordenadores vinculados"
          value={String(dashboard.totalLinkedCoordinators)}
          hint="Responsáveis locais já conectados às respectivas unidades."
        />
        <MetricCard
          label="Semestres ativos"
          value={String(dashboard.totalActiveSemesters)}
          hint="Períodos letivos com operação acadêmica ativa nas unidades."
        />
      </div>

      <div className="master-dashboard-panels">
        <SectionCard
          title="Navegação institucional"
          description="Acesse as áreas administrativas do master sem misturar governança global com a operação local das unidades."
        >
          <div className="master-quick-grid">
            <Link href={"/master/unidades" as Route} className="master-quick-link">
              <strong>Unidades</strong>
              <span>Cadastro, status e visão resumida por campus.</span>
            </Link>
            <Link href={"/master/coordenadores" as Route} className="master-quick-link">
              <strong>Coordenadores</strong>
              <span>Gestão institucional dos responsáveis por unidade.</span>
            </Link>
            <Link href={"/master/usuarios" as Route} className="master-quick-link">
              <strong>Usuários</strong>
              <span>Listagem global por perfil, unidade e status.</span>
            </Link>
            <Link href={"/master/auditoria" as Route} className="master-quick-link">
              <strong>Auditoria global</strong>
              <span>Movimentação institucional filtrável por unidade e perfil.</span>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Cadastrar unidade"
          description="Crie a estrutura base do campus ou unidade antes de iniciar a operação local."
        >
          <MasterUnitForm
            initialValues={createEmptyUnitFormValues()}
            submitLabel="Cadastrar unidade"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Unidades com atenção institucional"
        description="Priorize unidades que ainda exigem estrutura mínima de coordenação, semestres ou ativação institucional."
        actions={
          <Link href={"/master/unidades" as Route} className="button button-secondary">
            Ver todas as unidades
          </Link>
        }
      >
        {priorityUnits.length ? (
          <div className="master-unit-grid">
            {priorityUnits.map((unit) => (
              <article key={unit.id} className="management-block-card master-unit-card">
                <div className="management-block-header">
                  <div>
                    <h3>{unit.name}</h3>
                    <p className="field-help">
                      {unit.acronym} · {unit.slug}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${
                      unit.isActive ? "status-ativo" : "status-inativo"
                    }`}
                  >
                    {unit.isActive ? "ativa" : "inativa"}
                  </span>
                </div>

                <div className="report-mini-grid master-unit-mini-grid">
                  <div className="report-mini-card">
                    <span>Cidade / UF</span>
                    <strong>{formatLocation(unit.city, unit.state)}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Semestres ativos</span>
                    <strong>
                      {unit.activeSemesterCount} / {unit.totalSemesterCount}
                    </strong>
                  </div>
                </div>

                <ul className="master-pending-list">
                  {unit.pendingItems.map((pendingItem) => (
                    <li key={pendingItem}>{pendingItem}</li>
                  ))}
                </ul>

                <div className="actions-row">
                  <Link
                    href={`/master/unidades/${encodeURIComponent(unit.id)}` as Route}
                    className="button button-secondary button-small"
                  >
                    Abrir unidade
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-message">
            Todas as unidades cadastradas já contam com a estrutura institucional
            mínima para operação.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
