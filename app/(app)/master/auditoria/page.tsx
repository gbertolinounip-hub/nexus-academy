import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterAuditTable } from "@/components/tables/master-audit-table";
import { requireRole } from "@/lib/auth/session";
import { getMasterGlobalAuditPageData } from "@/services/master";

interface MasterAuditPageProps {
  searchParams?: Promise<{
    unidade?: string | string[];
    perfil?: string | string[];
    periodo?: string | string[];
  }>;
}

export default async function MasterAuditPage({
  searchParams
}: MasterAuditPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterGlobalAuditPageData({
    unitId: resolvedSearchParams?.unidade,
    role: resolvedSearchParams?.perfil,
    period: resolvedSearchParams?.periodo
  });

  return (
    <div className="stack master-dashboard master-audit-dashboard">
      <section className="hero-card master-audit-hero">
        <div className="master-audit-hero-copy">
          <p className="eyebrow">Auditoria global</p>
          <h1>Auditoria global</h1>
          <p>
            Acompanhe eventos recentes por unidade, perfil e período sem misturar
            esta leitura global com a auditoria operacional local das coordenações.
          </p>
        </div>
      </section>

      <div className="metrics-grid master-audit-metrics-grid">
        <MetricCard
          label="Eventos listados"
          value={String(pageData.totalEvents)}
          hint="Total de registros visíveis com os filtros atuais."
        />
        <MetricCard
          label="Unidades tocadas"
          value={String(pageData.totalUnitsTouched)}
          hint="Quantidade de unidades com movimentação no recorte atual."
        />
        <MetricCard
          label="Responsáveis únicos"
          value={String(pageData.totalActors)}
          hint="Perfis institucionais que participaram dos eventos listados."
        />
      </div>

      <SectionCard
        title="Filtros globais"
        description="Refine a leitura institucional por unidade, perfil de origem e janela temporal."
        className="master-audit-filters-card"
      >
        <form
          method="get"
          className="master-filter-form master-filter-form-wide master-audit-filter-form"
        >
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
            <span>Período</span>
            <select
              className="input"
              name="periodo"
              defaultValue={pageData.filters.period}
            >
              <option value="all">Todo o histórico recente</option>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 365 dias</option>
            </select>
          </label>

          <div className="actions-row master-filter-actions master-audit-filter-actions">
            <button className="button button-secondary" type="submit">
              Aplicar filtros
            </button>
            <Link href={"/master/auditoria" as Route} className="button button-secondary">
              Limpar
            </Link>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Eventos recentes"
        description="Leitura institucional global dos eventos recentes da plataforma."
        className="master-audit-events-card"
      >
        {pageData.entries.length ? (
          <MasterAuditTable entries={pageData.entries} />
        ) : (
          <p className="empty-message">
            Nenhum evento encontrado com os filtros atuais.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
