import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { StudentDocumentDirectory } from "@/components/documents/student-document-directory";
import { MasterStudentDocumentFilters } from "@/components/forms/master-student-document-filters";
import { formatStageAreaDisplayFromLegacyLabel } from "@/lib/utils/format";
import type { StudentDocumentDirectoryPageData } from "@/services/student-documents";

interface StudentDocumentDirectoryScreenProps {
  pageData: StudentDocumentDirectoryPageData;
  basePath: Route;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
}

export function StudentDocumentDirectoryScreen({
  pageData,
  basePath,
  heroEyebrow,
  heroTitle,
  heroDescription
}: StudentDocumentDirectoryScreenProps) {
  const showInstitutionScope = pageData.viewerRole === "coordenador_master";
  const showScopedUnitFilter =
    pageData.viewerRole === "coordenador" && pageData.unitOptions.length > 0;
  const showUnitColumn = showInstitutionScope || showScopedUnitFilter;

  return (
    <div className="stack student-documents-page student-documents-directory-page">
      <section className="hero-card">
        <p className="eyebrow">{heroEyebrow}</p>
        <h1>{heroTitle}</h1>
        <p>{heroDescription}</p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Alunos no recorte"
          value={String(pageData.metrics.totalStudents)}
          hint="Quantidade de alunos visíveis após a aplicação dos filtros atuais."
        />
        <MetricCard
          label="Com pendências"
          value={String(pageData.metrics.withPendingDocuments)}
          hint="Alunos com documentos ativos aguardando análise."
          tone="alert"
        />
        <MetricCard
          label="Com reprovação ativa"
          value={String(pageData.metrics.withRejectedDocuments)}
          hint="Alunos com documento ativo reprovado e passível de novo envio."
          tone="alert"
        />
        <MetricCard
          label="Com notificação não lida"
          value={String(pageData.metrics.withUnreadNotifications)}
          hint="Alunos que ainda possuem devolutiva pendente de leitura."
        />
      </div>

      <SectionCard
        title="Filtros documentais"
        description={
          showInstitutionScope
            ? "Refine a visão global por instituição, unidade, aluno, área e status documental."
            : showScopedUnitFilter
              ? "Refine a visão documental do curso por unidade, aluno, área e status documental."
            : "Refine a visão operacional por aluno, área e status documental."
        }
      >
        {showInstitutionScope ? (
          <MasterStudentDocumentFilters
            basePath={basePath}
            filters={pageData.filters}
            institutionOptions={pageData.institutionOptions}
            unitOptions={pageData.unitOptions}
            areaOptions={pageData.areaOptions}
            statusOptions={pageData.statusOptions}
          />
        ) : (
          <form method="get" className="student-document-filter-form">
            <label className="field">
              <span>Busca</span>
              <input
                className="input"
                type="search"
                name="q"
                defaultValue={pageData.filters.search}
                placeholder="Nome, matrícula ou e-mail"
              />
            </label>

            <label className="field">
              <span>Área</span>
              <select className="input" name="area_id" defaultValue={pageData.filters.areaId}>
                <option value="">Todas</option>
                {pageData.areaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {formatStageAreaDisplayFromLegacyLabel(option.label)}
                  </option>
                ))}
              </select>
            </label>

            {showScopedUnitFilter ? (
              <label className="field">
                <span>Unidade</span>
                <select className="input" name="unit_id" defaultValue={pageData.filters.unitId}>
                  <option value="">Todas</option>
                  {pageData.unitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <span>Status</span>
              <select className="input" name="status" defaultValue={pageData.filters.status}>
                {pageData.statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="actions-row student-document-filter-actions">
              <button type="submit" className="button button-small">
                Aplicar filtros
              </button>
              <Link href={basePath} className="button button-secondary button-small">
                Limpar
              </Link>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard title={pageData.title} description={pageData.description}>
        <StudentDocumentDirectory
          entries={pageData.entries}
          emptyMessage="Nenhum aluno corresponde ao recorte documental selecionado."
          basePath={basePath}
          showUnitColumn={showUnitColumn}
          tableScrollClassName={showUnitColumn ? "master-documents-table-scroll" : undefined}
        />
      </SectionCard>
    </div>
  );
}
