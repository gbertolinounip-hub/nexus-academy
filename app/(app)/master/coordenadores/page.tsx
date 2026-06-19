import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterCoordinatorFilters } from "@/components/forms/master-coordinator-filters";
import { MasterCoordinatorDirectory } from "@/components/tables/master-coordinator-directory";
import { requireRole } from "@/lib/auth/session";
import { getMasterCoordinatorsPageData } from "@/services/master";

interface MasterCoordinatorsPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    status?: string | string[];
    busca?: string | string[];
  }>;
}

export default async function MasterCoordinatorsPage({
  searchParams
}: MasterCoordinatorsPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const pageData = await getMasterCoordinatorsPageData({
    institutionId: resolvedSearchParams.instituicao,
    unitId: resolvedSearchParams.unidade,
    status: resolvedSearchParams.status,
    query: resolvedSearchParams.busca
  });

  const visibleActiveCoordinators = pageData.entries.filter((entry) => entry.isActive).length;

  return (
    <div className="stack master-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Coordenadores</p>
        <h1>Gestão institucional de coordenadores</h1>
        <p>
          Liste responsáveis das unidades, filtre por IES e campus, ajuste dados básicos e
          controle o acesso institucional sem misturar este fluxo com a operação acadêmica local.
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
        description="Restrinja a visão por instituição, unidade, status ou busca textual sem alterar a operação diária das coordenações locais."
      >
        <MasterCoordinatorFilters
          institutions={pageData.institutions}
          units={pageData.units}
          filters={pageData.filters}
        />
      </SectionCard>

      <SectionCard
        title="Coordenadores por unidade"
        description="A listagem usa uma estrutura administrativa estável para suportar poucos ou muitos vínculos de coordenação sem perder legibilidade."
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
