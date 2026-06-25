import * as XLSX from "xlsx";
import { formatDateTime, repairKnownMojibake } from "@/lib/utils/format";
import type { MasterGlobalAuditPageData } from "@/services/master";
import type { InstitutionalReportHeaderRow } from "@/services/report-branding";

function sanitizeMasterAuditFileToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function resolveMasterAuditSelectedOptionLabel(
  options: Array<{ id: string; name: string }>,
  value: string,
  emptyLabel: string
) {
  if (!value) {
    return emptyLabel;
  }

  return options.find((option) => option.id === value)?.name ?? value;
}

function resolveMasterAuditSelectedRoleLabel(
  value: MasterGlobalAuditPageData["filters"]["role"]
) {
  switch (value) {
    case "coordenador":
      return "Coordenadores";
    case "professor":
      return "Professores";
    case "aluno":
      return "Alunos";
    default:
      return "Todos";
  }
}

function resolveMasterAuditSelectedPeriodLabel(
  value: MasterGlobalAuditPageData["filters"]["period"]
) {
  switch (value) {
    case "7":
      return "Últimos 7 dias";
    case "30":
      return "Últimos 30 dias";
    case "90":
      return "Últimos 90 dias";
    case "365":
      return "Últimos 365 dias";
    default:
      return "Todo o histórico recente";
  }
}

function buildMasterAuditHeaderMatrix(headerRows: InstitutionalReportHeaderRow[]) {
  if (!headerRows.length) {
    return [];
  }

  return [...headerRows.map((row) => [row.label, repairKnownMojibake(row.value)]), []];
}

export function getMasterGlobalAuditFileBaseName(pageData: MasterGlobalAuditPageData) {
  const institutionToken = pageData.filters.institutionId
    ? sanitizeMasterAuditFileToken(pageData.filters.institutionId)
    : "todas-ies";

  return `auditoria-global-${institutionToken}-${pageData.generatedAt.slice(0, 10)}`;
}

export function buildMasterGlobalAuditWorkbook(
  pageData: MasterGlobalAuditPageData,
  headerRows: InstitutionalReportHeaderRow[] = []
) {
  const workbook = XLSX.utils.book_new();
  const headerMatrix = buildMasterAuditHeaderMatrix(headerRows);
  const filterSummaryRows = [
    ["Perfil", resolveMasterAuditSelectedRoleLabel(pageData.filters.role)],
    ["Período", resolveMasterAuditSelectedPeriodLabel(pageData.filters.period)],
    [
      "Instituição / IES",
      resolveMasterAuditSelectedOptionLabel(
        pageData.institutions.map((institution) => ({
          id: institution.id,
          name: institution.name
        })),
        pageData.filters.institutionId,
        "Todas as instituições"
      )
    ],
    [
      "Unidade",
      resolveMasterAuditSelectedOptionLabel(
        pageData.units.map((unit) => ({ id: unit.id, name: unit.name })),
        pageData.filters.unitId,
        "Todas as unidades"
      )
    ],
    [
      "Curso",
      resolveMasterAuditSelectedOptionLabel(
        pageData.courses.map((course) => ({
          id: course.id,
          name: course.code ? `${course.code} - ${course.name}` : course.name
        })),
        pageData.filters.courseId,
        "Todos os cursos"
      )
    ],
    ["Emitido em", formatDateTime(pageData.generatedAt)]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ...headerMatrix,
    ["Auditoria Global"],
    [],
    ...filterSummaryRows,
    [],
    ["Indicador", "Valor"],
    ["Eventos listados", pageData.totalEvents],
    ["Unidades tocadas", pageData.totalUnitsTouched],
    ["Responsáveis únicos", pageData.totalActors]
  ]);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const eventHeader = [
    "Data/hora",
    "Instituição / IES",
    "Unidade",
    "Curso",
    "Perfil",
    "Responsável",
    "Ação",
    "Tabela",
    "Registro",
    "Resumo completo",
    "Detalhes"
  ];
  const eventRows = pageData.entries.length
    ? pageData.entries.map((entry) => [
        formatDateTime(entry.happenedAt),
        repairKnownMojibake(entry.institutionName),
        repairKnownMojibake(entry.unitName),
        repairKnownMojibake(entry.courseName ?? ""),
        repairKnownMojibake(entry.actorProfileLabel),
        repairKnownMojibake(entry.actorName),
        repairKnownMojibake(entry.action),
        repairKnownMojibake(entry.tableName),
        repairKnownMojibake(entry.recordLabel),
        repairKnownMojibake(entry.summary),
        repairKnownMojibake(entry.detailsText)
      ])
    : [["Nenhum evento encontrado com os filtros atuais."]];

  const eventsSheet = XLSX.utils.aoa_to_sheet([
    ...headerMatrix,
    ["Eventos recentes"],
    [],
    eventHeader,
    ...eventRows
  ]);
  eventsSheet["!cols"] = [
    { wch: 20 },
    { wch: 28 },
    { wch: 28 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 14 },
    { wch: 28 },
    { wch: 24 },
    { wch: 42 },
    { wch: 52 }
  ];
  XLSX.utils.book_append_sheet(workbook, eventsSheet, "Eventos");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  }) as Buffer;
}
