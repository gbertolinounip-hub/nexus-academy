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

  return city || state || "Nao informado";
}

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterDashboardPageProps {
  searchParams?: Promise<{
    attentionInstitution?: string | string[];
  }>;
}

export default async function MasterDashboardPage({
  searchParams
}: MasterDashboardPageProps) {
  const currentUser = await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const dashboard = await getMasterDashboardPageData(currentUser);
  const requestedInstitutionId = readSearchParam(
    resolvedSearchParams.attentionInstitution
  );
  const selectedInstitutionId = dashboard.institutions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";
  const priorityUnits = dashboard.units
    .filter((unit) => {
      if (!unit.pendingItems.length) {
        return false;
      }

      if (!selectedInstitutionId) {
        return true;
      }

      return unit.institutionId === selectedInstitutionId;
    })
    .slice(0, 4);

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Governanca institucional</p>
        <h1>{dashboard.masterName}</h1>
        <p>
          Acompanhe a operacao multiunidade da Nexus Academy com visao global de
          unidades, acessos institucionais e governanca academica.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Unidades ativas"
          value={String(dashboard.totalActiveUnits)}
          hint="Campi e operacoes em funcionamento na plataforma."
          tone="positive"
        />
        <MetricCard
          label="Coordenadores vinculados"
          value={String(dashboard.totalLinkedCoordinators)}
          hint="Responsaveis locais ja conectados as respectivas unidades."
        />
        <MetricCard
          label="Semestres ativos"
          value={String(dashboard.totalActiveSemesters)}
          hint="Periodos letivos com operacao academica ativa nas unidades."
        />
      </div>

      <div className="master-dashboard-panels">
        <SectionCard
          title="Navegacao institucional"
          description="Acesse as areas administrativas do Master sem misturar governanca global com a operacao local das unidades."
        >
          <div className="master-quick-grid">
            <Link href={"/master/unidades" as Route} className="master-quick-link">
              <strong>Unidades</strong>
              <span>Cadastro, status e visao resumida por campus.</span>
            </Link>
            <Link href={"/master/coordenadores" as Route} className="master-quick-link">
              <strong>Coordenadores</strong>
              <span>Gestao institucional dos responsaveis por unidade.</span>
            </Link>
            <Link href={"/master/gestores-curso" as Route} className="master-quick-link">
              <strong>Gestores de curso</strong>
              <span>Atribuicao e monitoramento dos gestores institucionais por curso.</span>
            </Link>
            <Link href={"/master/usuarios" as Route} className="master-quick-link">
              <strong>Usuarios</strong>
              <span>Listagem global por perfil, unidade e status.</span>
            </Link>
            <Link href={"/master/auditoria" as Route} className="master-quick-link">
              <strong>Auditoria global</strong>
              <span>Movimentacao institucional filtravel por unidade e perfil.</span>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Cadastrar unidade"
          description="Crie a estrutura base do campus ou unidade antes de iniciar a operacao local."
        >
          <MasterUnitForm
            institutions={dashboard.institutions}
            initialValues={createEmptyUnitFormValues()}
            submitLabel="Cadastrar unidade"
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Unidades com atencao institucional"
        description="Priorize unidades que ainda exigem estrutura minima de coordenacao, semestres ou ativacao institucional."
        actions={
          <Link href={"/master/unidades" as Route} className="button button-secondary">
            Ver todas as unidades
          </Link>
        }
      >
        <form method="get" className="master-filter-form master-filter-form-wide">
          <label className="field">
            <span>Instituicoes / IES</span>
            <select
              className="input"
              name="attentionInstitution"
              defaultValue={selectedInstitutionId}
            >
              <option value="">Todas as instituicoes</option>
              {dashboard.institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </label>

          <div className="actions-row master-filter-actions">
            <button className="button button-secondary" type="submit">
              Aplicar filtro
            </button>
            <Link href={"/master" as Route} className="button button-secondary">
              Limpar
            </Link>
          </div>
        </form>

        {priorityUnits.length ? (
          <div className="master-unit-grid">
            {priorityUnits.map((unit) => (
              <article key={unit.id} className="management-block-card master-unit-card">
                <div className="management-block-header">
                  <div>
                    <h3>{unit.name}</h3>
                    <p className="field-help">
                      {unit.institutionName} · {unit.acronym} · {unit.slug}
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
            {selectedInstitutionId
              ? "Nenhuma unidade com atencao institucional foi encontrada para a instituicao selecionada."
              : "Todas as unidades cadastradas ja contam com a estrutura institucional minima para operacao."}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
