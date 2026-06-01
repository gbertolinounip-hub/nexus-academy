import Link from "next/link";
import { SectionCard } from "@/components/common/section-card";
import { AuditTable } from "@/components/tables/audit-table";
import { requireRole } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils/format";
import { getAuthenticatedAuditEntries } from "@/services/audit";

function buildAccessExportHref(filters: {
  startDate: string;
  endDate: string;
}) {
  const query = new URLSearchParams();

  if (filters.startDate) {
    query.set("inicio", filters.startDate);
  }

  if (filters.endDate) {
    query.set("fim", filters.endDate);
  }

  const queryString = query.toString();
  return queryString
    ? `/auditoria/export/acessos/excel?${queryString}`
    : "/auditoria/export/acessos/excel";
}

export default async function AuditPage(props: {
  searchParams?: Promise<{
    semestre?: string | string[];
    inicio?: string | string[];
    fim?: string | string[];
    area?: string | string[];
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const requestedSemesterId = Array.isArray(searchParams.semestre)
    ? searchParams.semestre[0]
    : searchParams.semestre;
  const {
    entries,
    areaOptions,
    filters,
    emptyState,
    closedSemesters,
    selectedSemesterId,
    selectedClosedSemester
  } = await getAuthenticatedAuditEntries(currentUser, requestedSemesterId, {
    startDate: searchParams.inicio,
    endDate: searchParams.fim,
    areaId: searchParams.area
  });

  return (
    <div className="stack audit-page">
      <section className="hero-card">
        <p className="eyebrow">Histórico e auditoria</p>
        <h1>Rastreabilidade de lançamentos</h1>
        <p>
          Área destinada ao coordenador para acompanhar inserções, revisões,
          alterações em notas, ausências, vínculos e semestres arquivados.
        </p>
      </section>

      <SectionCard
        title={
          selectedClosedSemester
            ? `Semestre encerrado · ${selectedClosedSemester.code}`
            : "Eventos recentes"
        }
        description={
          selectedClosedSemester
            ? `Histórico preservado do semestre ${selectedClosedSemester.name}, fora do fluxo operacional e organizado por área arquivada.`
            : "No banco real, estes registros são alimentados por triggers em tabelas críticas."
        }
        actions={
          currentUser.unitId ? (
            <a
              href={buildAccessExportHref(filters)}
              className="button button-secondary"
            >
              Exportar acessos
            </a>
          ) : null
        }
      >
        {closedSemesters.length ? (
          <div className="report-chip-list">
            <Link
              href="/auditoria"
              className={`report-chip ${selectedClosedSemester ? "" : "report-chip-active"}`}
            >
              Visão geral
            </Link>
            {closedSemesters.map((semester) => (
              <Link
                key={semester.id}
                href={`/auditoria?semestre=${encodeURIComponent(semester.id)}`}
                className={`report-chip ${
                  selectedSemesterId === semester.id ? "report-chip-active" : ""
                }`}
              >
                {semester.code}
              </Link>
            ))}
          </div>
        ) : null}

        {!selectedClosedSemester ? (
          <form method="get" className="unit-audit-filter-form">
            <label className="field">
              <span>Data inicial</span>
              <input
                type="date"
                name="inicio"
                className="input"
                defaultValue={filters.startDate}
              />
            </label>

            <label className="field">
              <span>Data final</span>
              <input
                type="date"
                name="fim"
                className="input"
                defaultValue={filters.endDate}
              />
            </label>

            <label className="field">
              <span>Área de estágio</span>
              <select
                name="area"
                className="input"
                defaultValue={filters.areaId}
              >
                <option value="">Todas as áreas</option>
                {areaOptions.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name} · {area.blockName}
                  </option>
                ))}
              </select>
            </label>

            <div className="actions-row unit-audit-filter-actions">
              <button type="submit" className="button button-secondary">
                Aplicar filtros
              </button>
              <Link href="/auditoria" className="button button-secondary">
                Limpar
              </Link>
            </div>
          </form>
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
                        href={`/auditoria/semestres/${selectedClosedSemester.id}/areas/${area.classId}`}
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
        ) : entries.length ? (
          <AuditTable entries={entries} />
        ) : (
          <div className="form-stack">
            <p className="empty-message">
              {emptyState?.title ?? "Nenhum evento encontrado"}
            </p>
            <p className="empty-message">
              {emptyState?.description ??
                `O usuário ${currentUser.name} ainda não possui eventos auditáveis disponíveis no banco.`}
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
