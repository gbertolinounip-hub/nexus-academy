import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterCoordinatorDirectory } from "@/components/tables/master-coordinator-directory";
import { requireRole } from "@/lib/auth/session";
import { getMasterCoordinatorsPageData } from "@/services/master";

interface MasterCoordinatorsPageProps {
  searchParams?: Promise<{
    unidade?: string | string[];
    status?: string | string[];
    busca?: string | string[];
  }>;
}

export default async function MasterCoordinatorsPage({
  searchParams
}: MasterCoordinatorsPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterCoordinatorsPageData({
    unitId: resolvedSearchParams?.unidade,
    status: resolvedSearchParams?.status,
    query: resolvedSearchParams?.busca
  });
  const visibleActiveCoordinators = pageData.entries.filter((entry) => entry.isActive).length;

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
          label="Coordenadores encontrados"
          value={String(pageData.entries.length)}
          hint={`${pageData.totalCoordinators} vínculo(s) de coordenação cadastrado(s) no total.`}
        />
        <MetricCard
          label="Ativos no recorte"
          value={String(visibleActiveCoordinators)}
          hint={`${pageData.activeCoordinators} acesso(s) ativos no total institucional.`}
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description="Restrinja a visão por unidade, status ou busca textual sem alterar a operação diária das coordenações locais."
      >
        <form method="get" className="master-filter-form">
          <label className="field">
            <span>Busca</span>
            <input
              className="input"
              type="search"
              name="busca"
              defaultValue={pageData.filters.query}
              placeholder="Nome, e-mail, unidade ou cargo"
            />
          </label>

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
        description="A listagem agora usa uma estrutura administrativa estável para suportar poucos ou muitos vínculos de coordenação sem perder legibilidade."
      >
        <MasterCoordinatorDirectory
          entries={pageData.entries}
          emptyMessage="Nenhum coordenador encontrado com os filtros atuais."
          showUnitColumn
          showOpenUnitAction
        />
      </SectionCard>
    </div>
  );
}
