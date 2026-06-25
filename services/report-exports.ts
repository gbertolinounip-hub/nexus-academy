import type {
  ClassFinalReportData,
  ReportsHubData,
  StudentFinalReportData
} from "@/services/reports";
import type { InstitutionalReportHeaderRow } from "@/services/report-branding";

type ExportCell = string | number | boolean | null;

interface WorkbookMetric {
  label: string;
  value: string;
  hint?: string;
}

interface WorkbookTable {
  title: string;
  columns: string[];
  rows: ExportCell[][];
}

interface WorkbookSheetDefinition {
  name: string;
  title: string;
  subtitle?: string;
  headerRows?: InstitutionalReportHeaderRow[];
  metrics?: WorkbookMetric[];
  tables: WorkbookTable[];
}

interface WorkbookDefinition {
  sheets: WorkbookSheetDefinition[];
}

export interface AccessLogWorkbookData {
  unitName: string;
  exportedAt: string;
  totalAccesses: number;
  filters: {
    startDate: string;
    endDate: string;
  };
  entries: Array<{
    userName: string;
    email: string | null;
    profileLabel: string;
    unitName: string;
    loginDate: string;
    loginTime: string;
    loggedAt: string;
  }>;
}

type WorkbookRowCell = {
  value: ExportCell;
  styleId?: string;
  mergeAcross?: number;
};

function escapeCsvCell(value: ExportCell) {
  const text =
    value === null || value === undefined ? "" : String(value).replace(/\r?\n/g, " ");

  if (/[",;\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function toCsv(columns: string[], rows: ExportCell[][]) {
  const header = columns.map(escapeCsvCell).join(";");
  const body = rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
  return `\uFEFF${header}\n${body}`;
}

function sanitizeSheetName(name: string) {
  const sanitized = name.replace(/[\\/*?:[\]]/g, " ").trim();
  return sanitized.length > 31 ? sanitized.slice(0, 31) : sanitized || "Planilha";
}

function sanitizeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeWorkbookCellValue(value: ExportCell) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "Sim" : "NÃ£o";
  }

  return value;
}

function getWorkbookCellType(value: ExportCell) {
  return typeof value === "number" && Number.isFinite(value) ? "Number" : "String";
}

function buildWorkbookCellXml({ value, styleId, mergeAcross }: WorkbookRowCell) {
  const normalizedValue = normalizeWorkbookCellValue(value);
  const attributes = [
    styleId ? ` ss:StyleID="${styleId}"` : "",
    typeof mergeAcross === "number" && mergeAcross > 0
      ? ` ss:MergeAcross="${mergeAcross}"`
      : ""
  ].join("");

  return `<Cell${attributes}><Data ss:Type="${getWorkbookCellType(
    normalizedValue
  )}">${escapeXml(String(normalizedValue))}</Data></Cell>`;
}

function buildWorkbookRowXml(cells: WorkbookRowCell[]) {
  if (cells.length === 0) {
    return "<Row/>";
  }

  return `<Row>${cells.map(buildWorkbookCellXml).join("")}</Row>`;
}

function getSheetColumnCount(sheet: WorkbookSheetDefinition) {
  return Math.max(
    1,
    sheet.headerRows && sheet.headerRows.length > 0 ? 2 : 1,
    sheet.metrics && sheet.metrics.length > 0 ? 3 : 1,
    ...sheet.tables.map((table) => Math.max(1, table.columns.length))
  );
}

function buildMergedTextRow(
  text: string,
  columnCount: number,
  styleId: string
): WorkbookRowCell[] {
  return [
    {
      value: text,
      styleId,
      mergeAcross: columnCount > 1 ? columnCount - 1 : undefined
    }
  ];
}

function buildMetricsRows(metrics: WorkbookMetric[], columnCount: number) {
  if (metrics.length === 0) {
    return [];
  }

  const rows: string[] = [
    buildWorkbookRowXml(buildMergedTextRow("Indicadores", columnCount, "section"))
  ];

  for (const metric of metrics) {
    rows.push(
      buildWorkbookRowXml([
        { value: metric.label, styleId: "label" },
        { value: metric.value, styleId: "value" },
        { value: metric.hint ?? "", styleId: metric.hint ? "hint" : "value" }
      ])
    );
  }

  rows.push("<Row/>");
  return rows;
}

function buildHeaderRows(
  headerRows: InstitutionalReportHeaderRow[],
  columnCount: number
) {
  if (headerRows.length === 0) {
    return [];
  }

  const rows = headerRows.map((row) =>
    buildWorkbookRowXml([
      { value: row.label, styleId: "label" },
      {
        value: row.value,
        styleId: "value",
        mergeAcross: columnCount > 2 ? columnCount - 2 : undefined
      }
    ])
  );

  rows.push("<Row/>");
  return rows;
}

function buildTableRows(table: WorkbookTable, columnCount: number) {
  const rows: string[] = [
    buildWorkbookRowXml(buildMergedTextRow(table.title, columnCount, "section")),
    buildWorkbookRowXml(
      table.columns.map((column) => ({ value: column, styleId: "header" }))
    )
  ];

  if (table.rows.length === 0) {
    rows.push(
      buildWorkbookRowXml(
        buildMergedTextRow(
          "Nenhum dado disponÃ­vel para exportaÃ§Ã£o neste recorte.",
          Math.max(columnCount, table.columns.length),
          "hint"
        )
      )
    );
    rows.push("<Row/>");
    return rows;
  }

  for (const row of table.rows) {
    rows.push(
      buildWorkbookRowXml(
        row.map((cell) => ({
          value: cell,
          styleId: typeof cell === "number" ? "number" : "value"
        }))
      )
    );
  }

  rows.push("<Row/>");
  return rows;
}

function buildWorksheetXml(sheet: WorkbookSheetDefinition) {
  const columnCount = getSheetColumnCount(sheet);
  const rows: string[] = [];

  if (sheet.headerRows && sheet.headerRows.length > 0) {
    rows.push(...buildHeaderRows(sheet.headerRows, columnCount));
  }

  rows.push(buildWorkbookRowXml(buildMergedTextRow(sheet.title, columnCount, "title")));

  if (sheet.subtitle) {
    rows.push(buildWorkbookRowXml(buildMergedTextRow(sheet.subtitle, columnCount, "subtitle")));
  }

  rows.push("<Row/>");

  if (sheet.metrics && sheet.metrics.length > 0) {
    rows.push(...buildMetricsRows(sheet.metrics, columnCount));
  }

  for (const table of sheet.tables) {
    rows.push(...buildTableRows(table, Math.max(columnCount, table.columns.length)));
  }

  const columns = Array.from({ length: columnCount }, (_, index) => {
    const width = index === 0 ? 180 : index === 1 ? 140 : 110;
    return `<Column ss:AutoFitWidth="1" ss:Width="${width}"/>`;
  }).join("");

  return [
    `<Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheet.name))}">`,
    `<Table>${columns}${rows.join("")}</Table>`,
    `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">`,
    "<ProtectObjects>False</ProtectObjects>",
    "<ProtectScenarios>False</ProtectScenarios>",
    "</WorksheetOptions>",
    "</Worksheet>"
  ].join("");
}

function buildWorkbookXml(definition: WorkbookDefinition) {
  const worksheets = definition.sheets.map(buildWorksheetXml).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    "<DocumentProperties xmlns=\"urn:schemas-microsoft-com:office:office\">",
    "<Author>Nexus Academy</Author>",
    "<Company>Nexus Academy</Company>",
    "<Version>16.00</Version>",
    "</DocumentProperties>",
    "<ExcelWorkbook xmlns=\"urn:schemas-microsoft-com:office:excel\">",
    "<ProtectStructure>False</ProtectStructure>",
    "<ProtectWindows>False</ProtectWindows>",
    "</ExcelWorkbook>",
    "<Styles>",
    '<Style ss:ID="Default" ss:Name="Normal">',
    '<Alignment ss:Vertical="Top" ss:WrapText="1"/>',
    '<Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders>',
    '<Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/>',
    '<Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>',
    "</Style>",
    '<Style ss:ID="title"><Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#0F172A"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>',
    '<Style ss:ID="subtitle"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569"/><Alignment ss:Vertical="Center" ss:WrapText="1"/></Style>',
    '<Style ss:ID="section"><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#EEF4FF" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="header"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#0F172A"/><Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/></Style>',
    '<Style ss:ID="label"><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#1E293B"/></Style>',
    '<Style ss:ID="value"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/></Style>',
    '<Style ss:ID="number"><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#111827"/><NumberFormat ss:Format="0.00"/></Style>',
    '<Style ss:ID="hint"><Font ss:FontName="Calibri" ss:Size="9" ss:Italic="1" ss:Color="#64748B"/></Style>',
    "</Styles>",
    worksheets,
    "</Workbook>"
  ].join("");
}

async function buildWorkbookBytes(definition: WorkbookDefinition) {
  return Buffer.from(buildWorkbookXml(definition), "utf8");
}

export function buildConsolidatedCsv(report: ReportsHubData) {
  const columns = [
    "Semestre",
    "Aluno",
    "RA",
    "E-mail",
    "Celular",
    "Ãreas",
    "Blocos",
    "Supervisores",
    "Subtotal (%)",
    "Desconto faltas (%)",
    "Total final (%)",
    "Nota equivalente",
    "ConclusÃ£o (%)",
    "SituaÃ§Ã£o"
  ];
  const rows = report.studentReports.map((student) => [
    report.selectedSemester.code,
    student.studentName,
    student.registration,
    student.email,
    student.cellphone ?? "",
    student.areaNames.join(", "),
    student.blockNames.join(", "),
    student.supervisorNames.join(", "),
    student.subtotalPercentage,
    student.absencePenaltyPercentage,
    student.finalPercentage,
    student.finalGradeOutOfTen,
    student.completionRate,
    student.status
  ]);

  return toCsv(columns, rows);
}

export function buildClassCsv(report: ClassFinalReportData) {
  const columns = [
    "Semestre",
    "Turma",
    "Ãrea",
    "Aluno",
    "RA",
    "E-mail",
    "Celular",
    "Subtotal (%)",
    "Desconto faltas (%)",
    "Total final (%)",
    "ConclusÃ£o (%)",
    "SituaÃ§Ã£o"
  ];
  const rows = report.students.map((student) => [
    report.classGroup.semesterCode,
    report.classGroup.code,
    report.classGroup.areaName,
    student.studentName,
    student.registration,
    student.email,
    student.cellphone ?? "",
    student.subtotalPercentage,
    student.absencePenaltyPercentage,
    student.finalPercentage,
    student.completionRate,
    student.status
  ]);

  return toCsv(columns, rows);
}

export function buildStudentCsv(report: StudentFinalReportData) {
  const columns = [
    "Semestre",
    "Aluno",
    "RA",
    "Ãrea",
    "Bloco",
    "CritÃ©rio",
    "Peso (%)",
    "Nota",
    "PontuaÃ§Ã£o (%)",
    "Justificativa",
    "Ãšltima atualizaÃ§Ã£o"
  ];
  const rows = report.areaReports.flatMap((areaReport) =>
    areaReport.groups.flatMap((group) =>
      group.criteria.map((criterion) => [
        report.selectedSemester.code,
        report.student.name,
        report.student.registration,
        areaReport.areaName,
        areaReport.blockName,
        criterion.name,
        criterion.weightPercentage,
        criterion.latestRawScore ?? "",
        criterion.earnedPercentage,
        criterion.latestFeedback ?? "",
        criterion.updatedAt ?? ""
      ])
    )
  );

  return toCsv(columns, rows);
}

export async function buildConsolidatedWorkbook(
  report: ReportsHubData,
  headerRows: InstitutionalReportHeaderRow[] = []
) {
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo do semestre",
        headerRows,
        title: `RelatÃ³rio consolidado - ${report.selectedSemester.code}`,
        subtitle:
          "VisÃ£o gerencial consolidada do semestre, respeitando o escopo do perfil autenticado.",
        metrics: [
          { label: "Semestre", value: report.selectedSemester.code },
          { label: "Alunos", value: String(report.summary.totalStudents) },
          { label: "Turmas", value: String(report.summary.totalClasses) },
          { label: "Ãreas", value: String(report.summary.totalAreas) },
          { label: "Supervisores", value: String(report.summary.totalProfessors) },
          {
            label: "AvaliaÃ§Ãµes publicadas",
            value: String(report.summary.totalPublishedEvaluations)
          },
          {
            label: "Horas nÃ£o justificadas",
            value: `${report.summary.totalUnjustifiedAbsenceHours}h`
          }
        ],
        tables: [
          {
            title: "Blocos",
            columns: ["Bloco", "Ãreas", "Alunos", "MÃ©dia final (%)"],
            rows: report.blockSummaries.map((block) => [
              block.blockName,
              block.areaCount,
              block.studentCount,
              block.averageFinalPercentage
            ])
          },
          {
            title: "Ãreas",
            columns: [
              "Bloco",
              "Ãrea",
              "Alunos",
              "MÃ©dia final (%)",
              "AvaliaÃ§Ãµes",
              "Horas nÃ£o justificadas"
            ],
            rows: report.areaSummaries.map((area) => [
              area.blockName,
              area.areaName,
              area.studentCount,
              area.averageFinalPercentage,
              area.totalPublishedEvaluations,
              area.totalUnjustifiedAbsenceHours
            ])
          }
        ]
      },
      {
        name: "Turmas",
        headerRows,
        title: "RelatÃ³rios finais por turma",
        tables: [
          {
            title: "Turmas do semestre",
            columns: [
              "Turma",
              "Ãrea",
              "Bloco",
              "Supervisores",
              "Alunos",
              "MÃ©dia final (%)",
              "AvaliaÃ§Ãµes",
              "Horas nÃ£o justificadas",
              "Alunos em atenÃ§Ã£o"
            ],
            rows: report.classReports.map((classReport) => [
              `${classReport.classCode} - ${classReport.className}`,
              classReport.areaName,
              classReport.blockName,
              classReport.professorNames.join(", "),
              classReport.studentCount,
              classReport.averageFinalPercentage,
              classReport.totalPublishedEvaluations,
              classReport.totalUnjustifiedAbsenceHours,
              classReport.studentsAtRisk
            ])
          }
        ]
      },
      {
        name: "Alunos",
        headerRows,
        title: "Relatórios finais por aluno",
        tables: [
          {
            title: "Alunos do semestre",
            columns: [
              "Aluno",
              "RA",
              "E-mail",
              "Celular",
              "Ãreas",
              "Blocos",
              "Supervisores",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "Nota final",
              "ConclusÃ£o (%)",
              "SituaÃ§Ã£o"
            ],
            rows: report.studentReports.map((student) => [
              student.studentName,
              student.registration,
              student.email,
              student.cellphone ?? "",
              student.areaNames.join(", "),
              student.blockNames.join(", "),
              student.supervisorNames.join(", "),
              student.subtotalPercentage,
              student.absencePenaltyPercentage,
              student.finalPercentage,
              student.finalGradeOutOfTen,
              student.completionRate,
              student.status
            ])
          }
        ]
      }
    ]
  };

  return buildWorkbookBytes(definition);
}

export async function buildClassWorkbook(
  report: ClassFinalReportData,
  headerRows: InstitutionalReportHeaderRow[] = []
) {
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo da turma",
        headerRows,
        title: `RelatÃ³rio final da turma - ${report.classGroup.code}`,
        subtitle: `${report.classGroup.semesterCode} - ${report.classGroup.areaName} - ${report.classGroup.blockName}`,
        metrics: [
          { label: "Turma", value: report.classGroup.name },
          { label: "Semestre", value: report.classGroup.semesterCode },
          { label: "Ãrea", value: report.classGroup.areaName },
          { label: "Bloco", value: report.classGroup.blockName },
          { label: "Alunos", value: String(report.summary.totalStudents) },
          {
            label: "MÃ©dia final",
            value: `${report.summary.averageFinalPercentage}%`
          },
          {
            label: "AvaliaÃ§Ãµes publicadas",
            value: String(report.summary.totalPublishedEvaluations)
          },
          {
            label: "Horas nÃ£o justificadas",
            value: `${report.summary.totalUnjustifiedAbsenceHours}h`
          },
          {
            label: "Alunos em atenÃ§Ã£o",
            value: String(report.summary.studentsAtRisk)
          }
        ],
        tables: [
          {
            title: "Panorama resumido",
            columns: ["Resumo"],
            rows: [[report.summary.panorama]]
          }
        ]
      },
      {
        name: "Supervisores",
        headerRows,
        title: "Supervisores vinculados",
        tables: [
          {
            title: "Professores da turma",
            columns: ["Nome", "E-mail", "Alunos vinculados"],
            rows: report.supervisors.map((supervisor) => [
              supervisor.name,
              supervisor.email,
              supervisor.linkedStudents
            ])
          }
        ]
      },
      {
        name: "Alunos",
        headerRows,
        title: "Alunos da turma",
        tables: [
          {
            title: "ComposiÃ§Ã£o e situaÃ§Ã£o da turma",
            columns: [
              "Aluno",
              "RA",
              "E-mail",
              "Celular",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "ConclusÃ£o (%)",
              "SituaÃ§Ã£o"
            ],
            rows: report.students.map((student) => [
              student.studentName,
              student.registration,
              student.email,
              student.cellphone ?? "",
              student.subtotalPercentage,
              student.absencePenaltyPercentage,
              student.finalPercentage,
              student.completionRate,
              student.status
            ])
          }
        ]
      }
    ]
  };

  return buildWorkbookBytes(definition);
}

export async function buildStudentWorkbook(
  report: StudentFinalReportData,
  headerRows: InstitutionalReportHeaderRow[] = []
) {
  const singleAreaReport =
    report.reportContext.kind === "area" ? report.areaReports[0] ?? null : null;
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo do aluno",
        headerRows,
        title:
          report.reportContext.kind === "area"
            ? `RelatÃ³rio final da Ã¡rea - ${report.student.name}`
            : `RelatÃ³rio final do aluno - ${report.student.name}`,
        subtitle: singleAreaReport
          ? `${report.selectedSemester.code} - ${singleAreaReport.areaName} - ${singleAreaReport.classCode}`
          : `${report.selectedSemester.code} - ${report.selectedSemester.name}`,
        metrics: [
          { label: "RA", value: report.student.registration },
          { label: "E-mail", value: report.student.email },
          { label: "Celular", value: report.student.cellphone ?? "NÃ£o informado" },
          {
            label: "Subtotal consolidado",
            value: `${report.summary.subtotalPercentage}%`
          },
          {
            label: "Desconto por faltas",
            value: `${report.summary.absencePenaltyPercentage}%`
          },
          {
            label: "Total final",
            value: `${report.summary.finalPercentage}%`
          },
          {
            label: "Nota equivalente",
            value: String(report.summary.finalGradeOutOfTen)
          },
          {
            label: "SituaÃ§Ã£o",
            value: report.summary.status
          }
        ],
        tables: [
          {
            title: "Resumo acadÃªmico",
            columns: ["DescriÃ§Ã£o"],
            rows: [[report.summary.statusSummary]]
          }
        ]
      },
      {
        name: "Áreas",
        headerRows,
        title: "Áreas e supervisores",
        tables: [
          {
            title: "Ãreas do semestre",
            columns: [
              "Ãrea",
              "Bloco",
              "Turma",
              "Supervisores",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "ConclusÃ£o (%)",
              "SituaÃ§Ã£o"
            ],
            rows: report.areaReports.map((areaReport) => [
              areaReport.areaName,
              areaReport.blockName,
              `${areaReport.classCode} - ${areaReport.className}`,
              areaReport.supervisors.map((supervisor) => supervisor.name).join(", "),
              areaReport.subtotalPercentage,
              areaReport.absencePenaltyPercentage,
              areaReport.finalPercentage,
              areaReport.completionRate,
              areaReport.status
            ])
          }
        ]
      },
      {
        name: "Critérios",
        headerRows,
        title: "Detalhamento por critério",
        tables: [
          {
            title: "Ãšltimo estado publicado por critÃ©rio",
            columns: [
              "Ãrea",
              "Bloco",
              "Grupo",
              "CritÃ©rio",
              "Peso (%)",
              "Nota",
              "PontuaÃ§Ã£o (%)",
              "Justificativa",
              "Atualizado em"
            ],
            rows: report.areaReports.flatMap((areaReport) =>
              areaReport.groups.flatMap((group) =>
                group.criteria.map((criterion) => [
                  areaReport.areaName,
                  areaReport.blockName,
                  group.name,
                  criterion.name,
                  criterion.weightPercentage,
                  criterion.latestRawScore ?? "",
                  criterion.earnedPercentage,
                  criterion.latestFeedback ?? "",
                  criterion.updatedAt ?? ""
                ])
              )
            )
          }
        ]
      },
      {
        name: "Faltas",
        headerRows,
        title: "HistÃ³rico de faltas",
        tables: [
          {
            title: "AusÃªncias do semestre",
            columns: ["Data", "Horas", "Justificada", "Motivo"],
            rows: report.absences.map((absence) => [
              absence.date,
              absence.hours,
              absence.justified ? "Sim" : "NÃ£o",
              absence.reason ?? ""
            ])
          }
        ]
      }
    ]
  };

  return buildWorkbookBytes(definition);
}

export function getConsolidatedFileBaseName(report: ReportsHubData) {
  return sanitizeFileName(`relatorio-consolidado-${report.selectedSemester.code}`);
}

export function getClassFileBaseName(report: ClassFinalReportData) {
  return sanitizeFileName(`relatorio-turma-${report.classGroup.code}`);
}

export function getStudentFileBaseName(report: StudentFinalReportData) {
  const areaSuffix =
    report.reportContext.kind === "area" && report.areaReports[0]
      ? `-${sanitizeFileName(report.areaReports[0].areaName)}`
      : "";

  return sanitizeFileName(
    `relatorio-aluno-${report.student.registration}-${report.selectedSemester.code}${areaSuffix}`
  );
}

export async function buildAccessLogWorkbook(data: AccessLogWorkbookData) {
  const filtersLabel =
    data.filters.startDate || data.filters.endDate
      ? `${data.filters.startDate || "inÃ­cio aberto"} atÃ© ${
          data.filters.endDate || "fim aberto"
        }`
      : "PerÃ­odo integral";
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Acessos",
        title: `Acessos ao sistema - ${data.unitName}`,
        subtitle:
          "Registro simples de logins com sucesso da unidade do coordenador.",
        metrics: [
          { label: "Unidade", value: data.unitName },
          { label: "PerÃ­odo exportado", value: filtersLabel },
          { label: "Total de acessos", value: String(data.totalAccesses) },
          { label: "Exportado em", value: data.exportedAt }
        ],
        tables: [
          {
            title: "Acessos registrados",
            columns: [
              "Nome do usuÃ¡rio",
              "E-mail",
              "Perfil",
              "Unidade",
              "Dia do login",
              "HorÃ¡rio do login"
            ],
            rows: data.entries.map((entry) => [
              entry.userName,
              entry.email ?? "",
              entry.profileLabel,
              entry.unitName,
              entry.loginDate,
              entry.loginTime
            ])
          }
        ]
      }
    ]
  };

  return buildWorkbookBytes(definition);
}

export function getAccessLogFileBaseName(unitName: string) {
  return sanitizeFileName(`acessos-${unitName}-${new Date().toISOString().slice(0, 10)}`);
}

