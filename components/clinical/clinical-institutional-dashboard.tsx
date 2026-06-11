import Link from "next/link";
import type { Route } from "next";
import { ClinicalInstitutionalDashboardFilters } from "@/components/forms/clinical-institutional-dashboard-filters";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  formatClinicalCaseStatus,
  formatClinicalRecordStatus,
  formatClinicalRecordType,
  formatDate,
  formatDateTime
} from "@/lib/utils/format";
import type { ClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

interface ClinicalInstitutionalDashboardLinkAction {
  href: Route;
  label: string;
}

interface ClinicalInstitutionalDashboardScreenProps {
  pageData: ClinicalInstitutionalDashboardPageData;
  basePath: Route;
  printBasePath: Route;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  secondaryActions?: ClinicalInstitutionalDashboardLinkAction[];
  printLabel?: string;
  hideCaseTable?: boolean;
}

interface ClinicalInstitutionalDashboardPrintSectionsProps {
  pageData: ClinicalInstitutionalDashboardPageData;
}

export function buildClinicalInstitutionalDashboardQuery(filters: {
  query: string;
  institutionId?: string;
  unitId?: string;
  semesterId: string;
  areaId: string;
  professorId: string;
  studentId: string;
  status: string;
}) {
  const searchParams = new URLSearchParams();

  if (filters.query) {
    searchParams.set("q", filters.query);
  }

  if (filters.institutionId) {
    searchParams.set("institution_id", filters.institutionId);
  }

  if (filters.unitId) {
    searchParams.set("unit_id", filters.unitId);
  }

  if (filters.semesterId) {
    searchParams.set("semester_id", filters.semesterId);
  }

  if (filters.areaId) {
    searchParams.set("area_id", filters.areaId);
  }

  if (filters.professorId) {
    searchParams.set("professor_id", filters.professorId);
  }

  if (filters.studentId) {
    searchParams.set("student_id", filters.studentId);
  }

  if (filters.status && filters.status !== "todos") {
    searchParams.set("status", filters.status);
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

export function formatClinicalInstitutionalLatestRecordLabel(input: {
  type: string | null;
  status: string | null;
  updatedAt: string | null;
}) {
  if (!input.type || !input.status || !input.updatedAt) {
    return "Ainda sem registro clínico";
  }

  return `${formatClinicalRecordType(input.type)} · ${formatClinicalRecordStatus(
    input.status
  )} · ${formatDateTime(input.updatedAt)}`;
}

export function formatClinicalInstitutionalLatestEvolutionLabel(
  value: string | null
) {
  return value ? formatDate(value) : "Sem evolução registrada";
}

function shouldShowUnitScope(pageData: ClinicalInstitutionalDashboardPageData) {
  return (
    pageData.viewerRole === "coordenador_master" ||
    (pageData.viewerRole === "coordenador" &&
      pageData.filterOptions.units.length > 0) ||
    pageData.breakdowns.byUnit.length > 1
  );
}

function renderBreakdownCard(props: {
  title: string;
  description: string;
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  return (
    <SectionCard title={props.title} description={props.description}>
      <div className="table-wrap">
        <table className="table clinical-institutional-breakdown-table">
          <thead>
            <tr>
              {props.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.length ? (
              props.rows.map((row, rowIndex) => (
                <tr key={`${props.title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${props.title}-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={props.headers.length}>{props.emptyMessage}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export function ClinicalInstitutionalDashboardScreen(
  props: ClinicalInstitutionalDashboardScreenProps
) {
  const { pageData } = props;
  const showUnitScope = shouldShowUnitScope(pageData);
  const showInstitutionScope = pageData.viewerRole === "coordenador_master";
  const showCourseManagerUnitScope =
    pageData.viewerRole === "coordenador" &&
    pageData.filterOptions.units.length > 0;
  const showSearchFilter = !showInstitutionScope && !showCourseManagerUnitScope;
  const dashboardQuery = buildClinicalInstitutionalDashboardQuery(pageData.filters);
  const printHref = dashboardQuery
    ? `${props.printBasePath}${dashboardQuery}&print=1`
    : `${props.printBasePath}?print=1`;

  return (
    <div className="stack clinical-institutional-dashboard">
      <section className="hero-card">
        <p className="eyebrow">{props.heroEyebrow}</p>
        <h1>{props.heroTitle}</h1>
        <p>{props.heroDescription}</p>
        <div className="actions-row">
          {props.secondaryActions?.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="button button-secondary"
            >
              {action.label}
            </Link>
          ))}
          <Link
            href={printHref as Route}
            className="button button-secondary"
            target="_blank"
            rel="noreferrer"
          >
            {props.printLabel ?? "Imprimir relatório"}
          </Link>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Pacientes ativos"
          value={String(pageData.metrics.totalActivePatients)}
          hint="Pacientes com ao menos um caso ainda válido para atendimento no recorte atual."
          tone="positive"
        />
        <MetricCard
          label="Casos ativos"
          value={String(pageData.metrics.totalActiveCases)}
          hint="Casos clínicos em andamento ou atribuídos no recorte atual."
          tone="positive"
        />
        <MetricCard
          label="Casos com alta"
          value={String(pageData.metrics.totalCasesWithAlta)}
          hint="Casos encerrados por alta clínica, mantendo o paciente na base institucional."
        />
        <MetricCard
          label="Casos encerrados"
          value={String(pageData.metrics.totalClosedCases)}
          hint="Casos encerrados administrativamente no recorte atual."
        />
        <MetricCard
          label="Casos com pendências"
          value={String(pageData.metrics.totalCasesWithPendingItems)}
          hint="Casos com registros em enviado ou ajustes solicitados no recorte atual."
          tone="alert"
        />
        <MetricCard
          label="Sem evolução recente"
          value={String(pageData.metrics.totalCasesWithoutRecentEvolution)}
          hint="Casos ativos sem evolução registrada recentemente ou ainda sem evolução."
          tone="alert"
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description={
          showCourseManagerUnitScope
            ? "Refine a visão do curso por unidade, semestre, área, professor, aluno e status do caso."
            : showUnitScope
              ? "Refine a visão global por unidade, paciente, semestre, área, professor, aluno e status do caso."
              : "Refine a visão da unidade por paciente, semestre, área, professor, aluno e status do caso."
        }
      >
        {showInstitutionScope || showCourseManagerUnitScope ? (
          <ClinicalInstitutionalDashboardFilters
            actionPath={props.basePath}
            printHref={printHref as Route}
            filters={pageData.filters}
            filterOptions={pageData.filterOptions}
            showInstitutionFilter={showInstitutionScope}
            showSearchFilter={showSearchFilter}
            showUnitFilter={showUnitScope}
          />
        ) : (
        <form method="get" className="clinical-institutional-filter-form">
          <label className="field">
            <span>Busca</span>
            <input
              className="input"
              type="search"
              name="q"
              defaultValue={pageData.filters.query}
              placeholder="Paciente ou identificador"
            />
          </label>

          {showUnitScope ? (
            <label className="field">
              <span>Unidade</span>
              <select
                className="input"
                name="unit_id"
                defaultValue={pageData.filters.unitId}
              >
                <option value="">Todas</option>
                {pageData.filterOptions.units.map((unitOption) => (
                  <option key={unitOption.id} value={unitOption.id}>
                    {unitOption.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="field">
            <span>Semestre</span>
            <select
              className="input"
              name="semester_id"
              defaultValue={pageData.filters.semesterId}
            >
              <option value="">Todos</option>
              {pageData.filterOptions.semesters.map((semesterOption) => (
                <option key={semesterOption.id} value={semesterOption.id}>
                  {semesterOption.code}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Área</span>
            <select
              className="input"
              name="area_id"
              defaultValue={pageData.filters.areaId}
            >
              <option value="">Todas</option>
              {pageData.filterOptions.areas.map((areaOption) => (
                <option key={areaOption.id} value={areaOption.id}>
                  {areaOption.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Professor</span>
            <select
              className="input"
              name="professor_id"
              defaultValue={pageData.filters.professorId}
            >
              <option value="">Todos</option>
              {pageData.filterOptions.professors.map((professorOption) => (
                <option key={professorOption.id} value={professorOption.id}>
                  {professorOption.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Aluno</span>
            <select
              className="input"
              name="student_id"
              defaultValue={pageData.filters.studentId}
            >
              <option value="">Todos</option>
              {pageData.filterOptions.students.map((studentOption) => (
                <option key={studentOption.id} value={studentOption.id}>
                  {studentOption.name} · {studentOption.registration}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Status do caso</span>
            <select
              className="input"
              name="status"
              defaultValue={pageData.filters.status}
            >
              <option value="todos">Todos</option>
              <option value="atribuido">Atribuído</option>
              <option value="ativo">Ativo</option>
              <option value="alta">Alta</option>
              <option value="encerrado">Encerrado</option>
            </select>
          </label>

          <div className="actions-row clinical-institutional-filter-actions">
            <button type="submit" className="button button-small">
              Aplicar filtros
            </button>
            <Link href={props.basePath} className="button button-secondary button-small">
              Limpar
            </Link>
            <Link
              href={printHref as Route}
              className="button button-secondary button-small"
              target="_blank"
              rel="noreferrer"
            >
              Imprimir
            </Link>
          </div>
        </form>
        )}
      </SectionCard>

      <div className="clinical-institutional-breakdown-grid">
        {showUnitScope
          ? renderBreakdownCard({
              title: "Casos por unidade",
              description: "Distribuição global dos casos clínicos entre as unidades.",
              headers: ["Unidade", "Pacientes", "Casos", "Ativos"],
              rows: pageData.breakdowns.byUnit.map((row) => [
                row.unitName,
                String(row.patientCount),
                String(row.caseCount),
                String(row.activeCaseCount)
              ]),
              emptyMessage: "Nenhuma unidade encontrada para o recorte atual."
            })
          : null}

        {renderBreakdownCard({
          title: "Pacientes por área",
          description: "Consolidação do recorte atual por área de estágio.",
          headers: ["Área", "Pacientes", "Casos", "Ativos"],
          rows: pageData.breakdowns.byArea.map((row) => [
            row.areaName,
            String(row.patientCount),
            String(row.caseCount),
            String(row.activeCaseCount)
          ]),
          emptyMessage: "Nenhuma área encontrada para o recorte atual."
        })}

        {renderBreakdownCard({
          title: "Casos por professor",
          description: "Distribuição dos casos clínicos supervisionados no recorte atual.",
          headers: ["Professor", "Casos", "Ativos"],
          rows: pageData.breakdowns.byProfessor.map((row) => [
            row.professorName,
            String(row.caseCount),
            String(row.activeCaseCount)
          ]),
          emptyMessage: "Nenhum professor encontrado para o recorte atual."
        })}

        {renderBreakdownCard({
          title: "Casos por aluno",
          description: "Distribuição dos casos atribuídos entre os estagiários do recorte atual.",
          headers: ["Aluno", "Matrícula", "Casos", "Ativos"],
          rows: pageData.breakdowns.byStudent.map((row) => [
            row.studentName,
            row.registration,
            String(row.caseCount),
            String(row.activeCaseCount)
          ]),
          emptyMessage: "Nenhum aluno encontrado para o recorte atual."
        })}
      </div>

      {props.hideCaseTable ? null : (
        <SectionCard
          title="Tabela consolidada de casos"
          description={
            showUnitScope
              ? "Leitura institucional multiunidade do recorte atual, com dados clínicos, acadêmicos e acesso ao caso."
              : "Leitura institucional do recorte atual, com dados clínicos, acadêmicos e acesso ao caso."
          }
        >
          {pageData.cases.length ? (
            <div className="table-wrap">
              <table className="table clinical-institutional-case-table">
                <colgroup>
                  {showUnitScope ? <col className="clinical-case-col-unit" /> : null}
                  <col className="clinical-case-col-patient" />
                  <col className="clinical-case-col-semester" />
                  <col className="clinical-case-col-area" />
                  <col className="clinical-case-col-professor" />
                  <col className="clinical-case-col-student" />
                  <col className="clinical-case-col-status" />
                  <col className="clinical-case-col-start" />
                  <col className="clinical-case-col-end" />
                  <col className="clinical-case-col-evolution" />
                  <col className="clinical-case-col-record" />
                  <col className="clinical-case-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    {showUnitScope ? <th>Unidade</th> : null}
                    <th>Paciente</th>
                    <th>Semestre</th>
                    <th>Área</th>
                    <th>Professor</th>
                    <th>Aluno</th>
                    <th>Status</th>
                    <th>Início</th>
                    <th>Fim</th>
                    <th>Última evolução</th>
                    <th>Último registro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.cases.map((row) => (
                    <tr key={row.caseItem.id}>
                      {showUnitScope ? (
                        <td className="clinical-institutional-case-cell-unit">
                          {row.caseItem.unitName}
                        </td>
                      ) : null}
                      <td className="clinical-institutional-case-cell-main clinical-institutional-case-cell-patient">
                        <strong>{row.caseItem.patient.name}</strong>
                        <div className="table-helper">
                          Identificador: {row.caseItem.patient.identifier}
                        </div>
                      </td>
                      <td>{row.caseItem.semesterCode}</td>
                      <td className="clinical-institutional-case-cell-area">
                        {row.caseItem.areaName}
                      </td>
                      <td className="clinical-institutional-case-cell-professor">
                        {row.caseItem.professorName}
                      </td>
                      <td className="clinical-institutional-case-cell-main clinical-institutional-case-cell-student">
                        <strong>{row.caseItem.studentName}</strong>
                        <div className="table-helper">{row.caseItem.registration}</div>
                      </td>
                      <td>
                        <span className={`status-pill status-${row.caseItem.status}`}>
                          {formatClinicalCaseStatus(row.caseItem.status)}
                        </span>
                        {row.hasPendingItems ? (
                          <div className="table-helper">Há pendências clínicas</div>
                        ) : null}
                        {row.hasRecentEvolutionGap ? (
                          <div className="table-helper">Sem evolução recente</div>
                        ) : null}
                      </td>
                      <td>{formatDate(row.caseItem.startedAt)}</td>
                      <td>
                        {row.caseItem.endedAt ? formatDate(row.caseItem.endedAt) : "Em aberto"}
                      </td>
                      <td>
                        {formatClinicalInstitutionalLatestEvolutionLabel(
                          row.latestEvolutionDate
                        )}
                      </td>
                      <td>
                        {formatClinicalInstitutionalLatestRecordLabel({
                          type: row.latestRecordType,
                          status: row.latestRecordStatus,
                          updatedAt: row.latestRecordUpdatedAt
                        })}
                      </td>
                      <td className="clinical-institutional-case-actions-cell">
                        <Link
                          href={`/clinica-supervisionada/${row.caseItem.id}` as Route}
                          className="button button-secondary button-small"
                        >
                          Abrir caso
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">
              Nenhum caso clínico corresponde ao recorte atual da gestão clínica.
            </p>
          )}
        </SectionCard>
      )}
    </div>
  );
}

export function ClinicalInstitutionalDashboardPrintSections(
  props: ClinicalInstitutionalDashboardPrintSectionsProps
) {
  const { pageData } = props;
  const showUnitScope = shouldShowUnitScope(pageData);

  return (
    <>
      <SectionCard
        title="Resumo do relatório"
        description="Indicadores institucionais do recorte atual da Clínica Supervisionada."
      >
        <div className="clinical-case-summary-grid">
          <div className="report-mini-card">
            <span>Gerado em</span>
            <strong>{formatDateTime(pageData.generatedAt)}</strong>
          </div>
          <div className="report-mini-card">
            <span>Pacientes ativos</span>
            <strong>{pageData.metrics.totalActivePatients}</strong>
          </div>
          <div className="report-mini-card">
            <span>Casos ativos</span>
            <strong>{pageData.metrics.totalActiveCases}</strong>
          </div>
          <div className="report-mini-card">
            <span>Casos com alta</span>
            <strong>{pageData.metrics.totalCasesWithAlta}</strong>
          </div>
          <div className="report-mini-card">
            <span>Casos encerrados</span>
            <strong>{pageData.metrics.totalClosedCases}</strong>
          </div>
          <div className="report-mini-card">
            <span>Casos com pendências</span>
            <strong>{pageData.metrics.totalCasesWithPendingItems}</strong>
          </div>
          <div className="report-mini-card">
            <span>Sem evolução recente</span>
            <strong>{pageData.metrics.totalCasesWithoutRecentEvolution}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Distribuição institucional"
        description={
          showUnitScope
            ? "Consolidação do recorte por unidade, área, professor e aluno."
            : "Consolidação do recorte por área, professor e aluno."
        }
      >
        <div className="clinical-print-record-stack">
          {showUnitScope ? (
            <div className="table-wrap">
              <table className="table clinical-institutional-breakdown-table">
                <thead>
                  <tr>
                    <th>Unidade</th>
                    <th>Pacientes</th>
                    <th>Casos</th>
                    <th>Ativos</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.breakdowns.byUnit.map((row) => (
                    <tr key={row.unitId}>
                      <td>{row.unitName}</td>
                      <td>{row.patientCount}</td>
                      <td>{row.caseCount}</td>
                      <td>{row.activeCaseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="table-wrap">
            <table className="table clinical-institutional-breakdown-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Pacientes</th>
                  <th>Casos</th>
                  <th>Ativos</th>
                </tr>
              </thead>
              <tbody>
                {pageData.breakdowns.byArea.map((row) => (
                  <tr key={row.areaId}>
                    <td>{row.areaName}</td>
                    <td>{row.patientCount}</td>
                    <td>{row.caseCount}</td>
                    <td>{row.activeCaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrap">
            <table className="table clinical-institutional-breakdown-table">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Casos</th>
                  <th>Ativos</th>
                </tr>
              </thead>
              <tbody>
                {pageData.breakdowns.byProfessor.map((row) => (
                  <tr key={row.professorId}>
                    <td>{row.professorName}</td>
                    <td>{row.caseCount}</td>
                    <td>{row.activeCaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-wrap">
            <table className="table clinical-institutional-breakdown-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Matrícula</th>
                  <th>Casos</th>
                  <th>Ativos</th>
                </tr>
              </thead>
              <tbody>
                {pageData.breakdowns.byStudent.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.studentName}</td>
                    <td>{row.registration}</td>
                    <td>{row.caseCount}</td>
                    <td>{row.activeCaseCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Tabela consolidada de casos"
        description="Leitura institucional do recorte atual, pronta para impressão e arquivamento."
      >
        {pageData.cases.length ? (
          <div className="table-wrap">
            <table className="table clinical-institutional-case-table">
              <colgroup>
                {showUnitScope ? <col className="clinical-case-col-unit" /> : null}
                <col className="clinical-case-col-patient" />
                <col className="clinical-case-col-semester" />
                <col className="clinical-case-col-area" />
                <col className="clinical-case-col-professor" />
                <col className="clinical-case-col-student" />
                <col className="clinical-case-col-status" />
                <col className="clinical-case-col-start" />
                <col className="clinical-case-col-end" />
                <col className="clinical-case-col-evolution" />
                <col className="clinical-case-col-record" />
              </colgroup>
              <thead>
                <tr>
                  {showUnitScope ? <th>Unidade</th> : null}
                  <th>Paciente</th>
                  <th>Semestre</th>
                  <th>Área</th>
                  <th>Professor</th>
                  <th>Aluno</th>
                  <th>Status</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Última evolução</th>
                  <th>Último registro</th>
                </tr>
              </thead>
              <tbody>
                {pageData.cases.map((row) => (
                  <tr key={row.caseItem.id}>
                    {showUnitScope ? (
                      <td className="clinical-institutional-case-cell-unit">
                        {row.caseItem.unitName}
                      </td>
                    ) : null}
                    <td className="clinical-institutional-case-cell-main clinical-institutional-case-cell-patient">
                      <strong>{row.caseItem.patient.name}</strong>
                      <div className="table-helper">
                        Identificador: {row.caseItem.patient.identifier}
                      </div>
                    </td>
                    <td>{row.caseItem.semesterCode}</td>
                    <td className="clinical-institutional-case-cell-area">{row.caseItem.areaName}</td>
                    <td className="clinical-institutional-case-cell-professor">
                      {row.caseItem.professorName}
                    </td>
                    <td className="clinical-institutional-case-cell-main clinical-institutional-case-cell-student">
                      <strong>{row.caseItem.studentName}</strong>
                      <div className="table-helper">{row.caseItem.registration}</div>
                    </td>
                    <td>{formatClinicalCaseStatus(row.caseItem.status)}</td>
                    <td>{formatDate(row.caseItem.startedAt)}</td>
                    <td>
                      {row.caseItem.endedAt
                        ? formatDate(row.caseItem.endedAt)
                        : "Em aberto"}
                    </td>
                    <td>
                      {formatClinicalInstitutionalLatestEvolutionLabel(
                        row.latestEvolutionDate
                      )}
                    </td>
                    <td>
                      {formatClinicalInstitutionalLatestRecordLabel({
                        type: row.latestRecordType,
                        status: row.latestRecordStatus,
                        updatedAt: row.latestRecordUpdatedAt
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Nenhum caso clínico corresponde ao recorte atual do relatório.
          </p>
        )}
      </SectionCard>
    </>
  );
}
