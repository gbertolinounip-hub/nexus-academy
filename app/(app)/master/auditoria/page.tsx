import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterAuditFilters } from "@/components/forms/master-audit-filters";
import { MasterAuditTable } from "@/components/tables/master-audit-table";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { getMasterGlobalAuditPageData } from "@/services/master";

interface MasterAuditPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    semestre?: string | string[];
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
    semesterId: resolvedSearchParams?.semestre,
    role: resolvedSearchParams?.perfil,
    period: resolvedSearchParams?.periodo
  });

  const preservedParams = new URLSearchParams();

  if (pageData.filters.institutionId) {
    preservedParams.set("instituicao", pageData.filters.institutionId);
  }

  if (pageData.filters.unitId) {
    preservedParams.set("unidade", pageData.filters.unitId);
  }

  if (pageData.filters.courseId) {
    preservedParams.set("curso", pageData.filters.courseId);
  }

  if (pageData.filters.role !== "todos") {
    preservedParams.set("perfil", pageData.filters.role);
  }

  if (pageData.filters.period !== "all") {
    preservedParams.set("periodo", pageData.filters.period);
  }

  const exportHref = preservedParams.size
    ? `/master/auditoria/export/excel?${preservedParams.toString()}`
    : "/master/auditoria/export/excel";
  const selectedClosedSemester = pageData.selectedClosedSemester;
  const clearHref = pageData.selectedSemesterId
    ? `/master/auditoria?semestre=${encodeURIComponent(pageData.selectedSemesterId)}`
    : "/master/auditoria";
  const buildAuditHref = (semesterId?: string | null) => {
    const params = new URLSearchParams(preservedParams);

    if (semesterId) {
      params.set("semestre", semesterId);
    } else {
      params.delete("semestre");
    }

    const query = params.toString();
    return query ? `/master/auditoria?${query}` : "/master/auditoria";
  };

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
          clearHref={clearHref}
          preservedSemesterId={pageData.selectedSemesterId}
        />
      </SectionCard>

      <SectionCard
        title={
          selectedClosedSemester
            ? `Semestre encerrado · ${selectedClosedSemester.code}`
            : "Eventos recentes"
        }
        description={
          selectedClosedSemester
            ? `Histórico preservado do semestre ${selectedClosedSemester.name}, com áreas e vínculos arquivados acessíveis ao Master.`
            : "Leitura institucional global dos eventos recentes da plataforma."
        }
        className="master-audit-events-card"
      >
        {pageData.closedSemesters.length ? (
          <div className="report-chip-list">
            <a
              href={buildAuditHref(null)}
              className={`report-chip ${selectedClosedSemester ? "" : "report-chip-active"}`}
            >
              Visão geral
            </a>
            {pageData.closedSemesters.map((semester) => (
              <a
                key={semester.id}
                href={buildAuditHref(semester.id)}
                className={`report-chip ${
                  pageData.selectedSemesterId === semester.id ? "report-chip-active" : ""
                }`}
              >
                {semester.code}
              </a>
            ))}
          </div>
        ) : null}

        {selectedClosedSemester ? (
          <div className="audit-closed-semester-stack">
            <div className="audit-closed-semester-summary">
              <div className="management-student-summary-item">
                <span>Semestre arquivado</span>
                <strong>{selectedClosedSemester.name}</strong>
              </div>
              <div className="management-student-summary-item">
                <span>Encerrado em</span>
                <strong>{formatDateTime(selectedClosedSemester.archivedAt)}</strong>
              </div>
              <div className="management-student-summary-item">
                <span>Encerrado por</span>
                <strong>{selectedClosedSemester.archivedByName}</strong>
              </div>
              <div className="management-student-summary-item">
                <span>Áreas arquivadas</span>
                <strong>{selectedClosedSemester.areas.length}</strong>
              </div>
            </div>

            {selectedClosedSemester.areas.length ? (
              <div className="audit-closed-area-list">
                {selectedClosedSemester.areas.map((area) => (
                  <article key={area.classId} className="audit-closed-area-card">
                    <div className="audit-closed-area-main">
                      <div className="audit-closed-area-meta">
                        <span className="audit-closed-area-kicker">Quando</span>
                        <strong>{formatDateTime(area.archivedAt)}</strong>
                      </div>
                      <div className="audit-closed-area-meta">
                        <span className="audit-closed-area-kicker">Responsável</span>
                        <strong>{area.responsibleLabel}</strong>
                      </div>
                      <div className="audit-closed-area-meta audit-closed-area-meta-wide">
                        <span className="audit-closed-area-kicker">Área</span>
                        <strong>
                          {area.areaName} · {area.blockName}
                        </strong>
                        <span className="table-helper">
                          {area.classCode} · {area.className}
                        </span>
                      </div>
                    </div>

                    <div className="audit-closed-area-actions">
                      <a
                        href={`/master/auditoria/semestres/${encodeURIComponent(selectedClosedSemester.id)}/areas/${encodeURIComponent(area.classId)}`}
                        className="button button-secondary"
                      >
                        Abrir área
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-message">
                Nenhuma área arquivada foi encontrada para este semestre.
              </p>
            )}
          </div>
        ) : pageData.entries.length ? (
          <MasterAuditTable entries={pageData.entries} />
        ) : (
          <p className="empty-message">Nenhum evento encontrado com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
