import * as XLSX from "xlsx";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import type { InstitutionalReportHeaderRow } from "@/services/report-branding";
import type {
  ClinicalAttendanceIndicatorsBreakdownRow,
  ClinicalAttendanceIndicatorsPageData,
  ClinicalAttendanceIndicatorsViewerRole
} from "@/services/clinical-indicators";

function sanitizeClinicalIndicatorsFileToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function resolveClinicalIndicatorsViewerLabel(
  viewerRole: ClinicalAttendanceIndicatorsViewerRole
) {
  switch (viewerRole) {
    case "professor":
      return "Professor/supervisor";
    case "coordenador":
      return "Coordenador local";
    case "master_curso":
      return "Gestor/master-curso";
    case "coordenador_master":
      return "Master institucional";
    default:
      return viewerRole;
  }
}

function resolveClinicalIndicatorsSelectedOptionLabel(
  options: Array<{ id: string; name: string }>,
  value: string
) {
  if (!value) {
    return "Todos";
  }

  return options.find((option) => option.id === value)?.name ?? value;
}

function resolveClinicalIndicatorsSelectedStatusLabel(
  options: ClinicalAttendanceIndicatorsPageData["filterOptions"]["statuses"],
  value: ClinicalAttendanceIndicatorsPageData["filters"]["statusEvolucao"]
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function buildClinicalIndicatorsSheetRows(
  rows: ClinicalAttendanceIndicatorsBreakdownRow[]
) {
  if (!rows.length) {
    return [["Nenhum dado disponível para este recorte."]];
  }

  return rows.map((row) => [
    row.label,
    row.sublabel ?? "",
    row.attendancesPerformed,
    row.absentPatients,
    row.openEvolutions,
    row.sentForReview,
    row.adjustmentRequests,
    row.approvedEvolutions
  ]);
}

function applyClinicalIndicatorsSheetColumns(
  sheet: XLSX.WorkSheet,
  widths: number[]
) {
  sheet["!cols"] = widths.map((width) => ({ wch: width }));
}

function buildClinicalIndicatorsHeaderMatrix(
  headerRows: InstitutionalReportHeaderRow[]
) {
  if (!headerRows.length) {
    return [];
  }

  return [...headerRows.map((row) => [row.label, row.value]), []];
}

export function getClinicalAttendanceIndicatorsFileBaseName(
  pageData: ClinicalAttendanceIndicatorsPageData
) {
  const roleToken = sanitizeClinicalIndicatorsFileToken(pageData.viewerRole);
  return `indicadores-clinicos-${roleToken}-${pageData.filters.dateFrom}-a-${pageData.filters.dateTo}`;
}

export function buildClinicalAttendanceIndicatorsWorkbook(
  pageData: ClinicalAttendanceIndicatorsPageData,
  headerRows: InstitutionalReportHeaderRow[] = []
) {
  const workbook = XLSX.utils.book_new();
  const workbookHeaderMatrix = buildClinicalIndicatorsHeaderMatrix(headerRows);
  const filterSummaryRows = [
    ["Perfil", resolveClinicalIndicatorsViewerLabel(pageData.viewerRole)],
    ["Gerado em", formatDateTime(pageData.generatedAt)],
    ["Data inicial", formatDate(pageData.filters.dateFrom)],
    ["Data final", formatDate(pageData.filters.dateTo)],
    [
      "Instituição / IES",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.institutions,
        pageData.filters.institutionId
      )
    ],
    [
      "Curso",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.courses,
        pageData.filters.courseId
      )
    ],
    [
      "Unidade",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.units,
        pageData.filters.unitId
      )
    ],
    [
      "Área de estágio",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.areas,
        pageData.filters.areaId
      )
    ],
    [
      "Professor",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.professors,
        pageData.filters.professorId
      )
    ],
    [
      "Aluno",
      resolveClinicalIndicatorsSelectedOptionLabel(
        pageData.filterOptions.students.map((student) => ({
          id: student.id,
          name: `${student.name} · ${student.registration}`
        })),
        pageData.filters.studentId
      )
    ],
    [
      "Status da evolução",
      resolveClinicalIndicatorsSelectedStatusLabel(
        pageData.filterOptions.statuses,
        pageData.filters.statusEvolucao
      )
    ]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet([
    ...workbookHeaderMatrix,
    ["Indicadores clínicos"],
    [],
    ...filterSummaryRows,
    [],
    ["Indicador", "Valor"],
    ["Atendimentos realizados", pageData.metrics.attendancesPerformed],
    ["Pacientes ausentes", pageData.metrics.absentPatients],
    ["Evoluções pendentes", pageData.metrics.openEvolutions],
    ["Enviadas para revisão", pageData.metrics.sentForReview],
    ["Ajustes solicitados", pageData.metrics.adjustmentRequests],
    ["Evoluções aprovadas", pageData.metrics.approvedEvolutions]
  ]);
  applyClinicalIndicatorsSheetColumns(summarySheet, [28, 42]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

  const breakdownHeader = [
    "Recorte",
    "Complemento",
    "Atendimentos realizados",
    "Pacientes ausentes",
    "Evoluções pendentes",
    "Enviadas para revisão",
    "Ajustes solicitados",
    "Evoluções aprovadas"
  ];
  const breakdownWidths = [34, 24, 16, 16, 18, 18, 18, 18];

  const appendBreakdownSheet = (
    name: string,
    rows: ClinicalAttendanceIndicatorsBreakdownRow[]
  ) => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ...workbookHeaderMatrix,
      [`Indicadores clínicos · ${name}`],
      [],
      breakdownHeader,
      ...buildClinicalIndicatorsSheetRows(rows)
    ]);
    applyClinicalIndicatorsSheetColumns(sheet, breakdownWidths);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  };

  appendBreakdownSheet("Por área", pageData.breakdowns.byArea);
  appendBreakdownSheet("Por aluno", pageData.breakdowns.byStudent);
  appendBreakdownSheet("Por professor", pageData.breakdowns.byProfessor);

  if (pageData.visibility.showUnitBreakdown) {
    appendBreakdownSheet("Por unidade", pageData.breakdowns.byUnit);
  }

  if (pageData.visibility.showCourseBreakdown) {
    appendBreakdownSheet("Por curso", pageData.breakdowns.byCourse);
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx"
  }) as Buffer;
}
