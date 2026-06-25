import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterAuditFilters } from "@/components/forms/master-audit-filters";
import { MasterAuditTable } from "@/components/tables/master-audit-table";
import { requireRole } from "@/lib/auth/session";
import { getMasterGlobalAuditPageData } from "@/services/master";

interface MasterAuditPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    perfil?: string | string[];
    periodo?: string | string[];
  }>;
}

export default async function MasterAuditPage({ searchParams }: MasterAuditPageProps) {
  await requireRole(["coordenador_master"]);

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const pageData = await getMasterGlobalAuditPageData({
    institutionId: resolvedSearchParams?.instituicao,
    unitId: resolvedSearchParams?.unidade,
    courseId: resolvedSearchParams?.curso,
    role: resolvedSearchParams?.perfil,
    period: resolvedSearchParams?.periodo
  });

  const exportParams = new URLSearchParams();

  if (pageData.filters.institutionId) {
    exportParams.set("instituicao", pageData.filters.institutionId);
  }

  if (pageData.filters.unitId) {
    exportParams.set("unidade", pageData.filters.unitId);
  }

  if (pageData.filters.courseId) {
    exportParams.set("curso", pageData.filters.courseId);
  }

  if (pageData.filters.role !== "todos") {
    exportParams.set("perfil", pageData.filters.role);
  }

  if (pageData.filters.period !== "all") {
    exportParams.set("periodo", pageData.filters.period);
  }

  const exportHref = exportParams.size
    ? `/master/auditoria/export/excel?${exportParams.toString()}`
    : "/master/auditoria/export/excel";

  return (
    <div className="stack master-dashboard master-audit-dashboard">
      <section className="hero-card master-audit-hero">
        <div className="master-audit-hero-copy">
          <p className="eyebrow">Auditoria global</p>
          <h1>Auditoria global</h1>
          <p>
            Acompanhe eventos recentes por instituição, unidade, curso, perfil e período
            sem misturar esta leitura global com a auditoria operacional local das
            coordenações.
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
        description="Refine a leitura institucional por IES, unidade, curso, perfil de origem e janela temporal."
        className="master-audit-filters-card"
      >
        <MasterAuditFilters
          institutions={pageData.institutions}
          units={pageData.units}
          courses={pageData.courses}
          filters={pageData.filters}
          exportHref={exportHref}
        />
      </SectionCard>

      <SectionCard
        title="Eventos recentes"
        description="Leitura institucional global dos eventos recentes da plataforma."
        className="master-audit-events-card"
      >
        {pageData.entries.length ? (
          <MasterAuditTable entries={pageData.entries} />
        ) : (
          <p className="empty-message">Nenhum evento encontrado com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
