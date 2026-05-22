import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import type {
  ClassFinalReportData,
  ReportsHubData,
  StudentFinalReportData
} from "@/services/reports";

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
  metrics?: WorkbookMetric[];
  tables: WorkbookTable[];
}

interface WorkbookDefinition {
  sheets: WorkbookSheetDefinition[];
}

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

async function buildWorkbookBytes(definition: WorkbookDefinition) {
  await ensureArtifactToolLink();
  const tempDir = await mkdtemp(path.join(tmpdir(), "report-export-"));
  const inputPath = path.join(tempDir, "workbook-definition.json");
  const outputPath = path.join(tempDir, "report.xlsx");
  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "report-workbook-builder.mjs"
  );

  await writeFile(inputPath, JSON.stringify(definition), "utf8");

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, inputPath, outputPath], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"]
      });
      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(
          new Error(
            stderr.trim() || `Workbook builder encerrado com código ${code}.`
          )
        );
      });
    });

    return readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function ensureArtifactToolLink() {
  const localOaiPath = path.join(process.cwd(), "node_modules", "@oai");
  const localArtifactToolPath = path.join(localOaiPath, "artifact-tool");

  try {
    await access(localArtifactToolPath);
    return;
  } catch {}

  const bundledOaiPath = path.join(
    homedir(),
    ".cache",
    "codex-runtimes",
    "codex-primary-runtime",
    "dependencies",
    "node",
    "node_modules",
    "@oai"
  );
  const bundledArtifactToolPath = path.join(bundledOaiPath, "artifact-tool");

  try {
    await access(bundledArtifactToolPath);
  } catch {
    throw new Error(
      "Não foi possível localizar o runtime de planilhas necessário para exportação Excel."
    );
  }

  await mkdir(path.join(process.cwd(), "node_modules"), { recursive: true });

  try {
    await symlink(bundledOaiPath, localOaiPath, "junction");
  } catch {
    await access(localArtifactToolPath);
  }
}

export function buildConsolidatedCsv(report: ReportsHubData) {
  const columns = [
    "Semestre",
    "Aluno",
    "RA",
    "E-mail",
    "Celular",
    "Áreas",
    "Blocos",
    "Supervisores",
    "Subtotal (%)",
    "Desconto faltas (%)",
    "Total final (%)",
    "Nota equivalente",
    "Conclusão (%)",
    "Situação"
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
    "Área",
    "Aluno",
    "RA",
    "E-mail",
    "Celular",
    "Subtotal (%)",
    "Desconto faltas (%)",
    "Total final (%)",
    "Conclusão (%)",
    "Situação"
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
    "Área",
    "Bloco",
    "Critério",
    "Peso (%)",
    "Nota",
    "Pontuação (%)",
    "Justificativa",
    "Última atualização"
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

export async function buildConsolidatedWorkbook(report: ReportsHubData) {
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo do semestre",
        title: `Relatório consolidado - ${report.selectedSemester.code}`,
        subtitle:
          "Visão gerencial consolidada do semestre, respeitando o escopo do perfil autenticado.",
        metrics: [
          { label: "Semestre", value: report.selectedSemester.code },
          { label: "Alunos", value: String(report.summary.totalStudents) },
          { label: "Turmas", value: String(report.summary.totalClasses) },
          { label: "Áreas", value: String(report.summary.totalAreas) },
          { label: "Supervisores", value: String(report.summary.totalProfessors) },
          {
            label: "Avaliações publicadas",
            value: String(report.summary.totalPublishedEvaluations)
          },
          {
            label: "Horas não justificadas",
            value: `${report.summary.totalUnjustifiedAbsenceHours}h`
          }
        ],
        tables: [
          {
            title: "Blocos",
            columns: ["Bloco", "Áreas", "Alunos", "Média final (%)"],
            rows: report.blockSummaries.map((block) => [
              block.blockName,
              block.areaCount,
              block.studentCount,
              block.averageFinalPercentage
            ])
          },
          {
            title: "Áreas",
            columns: [
              "Bloco",
              "Área",
              "Alunos",
              "Média final (%)",
              "Avaliações",
              "Horas não justificadas"
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
        title: "Relatórios finais por turma",
        tables: [
          {
            title: "Turmas do semestre",
            columns: [
              "Turma",
              "Área",
              "Bloco",
              "Supervisores",
              "Alunos",
              "Média final (%)",
              "Avaliações",
              "Horas não justificadas",
              "Alunos em atenção"
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
        title: "Relatórios finais por aluno",
        tables: [
          {
            title: "Alunos do semestre",
            columns: [
              "Aluno",
              "RA",
              "E-mail",
              "Celular",
              "Áreas",
              "Blocos",
              "Supervisores",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "Nota final",
              "Conclusão (%)",
              "Situação"
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

export async function buildClassWorkbook(report: ClassFinalReportData) {
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo da turma",
        title: `Relatório final da turma - ${report.classGroup.code}`,
        subtitle: `${report.classGroup.semesterCode} - ${report.classGroup.areaName} - ${report.classGroup.blockName}`,
        metrics: [
          { label: "Turma", value: report.classGroup.name },
          { label: "Semestre", value: report.classGroup.semesterCode },
          { label: "Área", value: report.classGroup.areaName },
          { label: "Bloco", value: report.classGroup.blockName },
          { label: "Alunos", value: String(report.summary.totalStudents) },
          {
            label: "Média final",
            value: `${report.summary.averageFinalPercentage}%`
          },
          {
            label: "Avaliações publicadas",
            value: String(report.summary.totalPublishedEvaluations)
          },
          {
            label: "Horas não justificadas",
            value: `${report.summary.totalUnjustifiedAbsenceHours}h`
          },
          {
            label: "Alunos em atenção",
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
        title: "Alunos da turma",
        tables: [
          {
            title: "Composição e situação da turma",
            columns: [
              "Aluno",
              "RA",
              "E-mail",
              "Celular",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "Conclusão (%)",
              "Situação"
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

export async function buildStudentWorkbook(report: StudentFinalReportData) {
  const singleAreaReport =
    report.reportContext.kind === "area" ? report.areaReports[0] ?? null : null;
  const definition: WorkbookDefinition = {
    sheets: [
      {
        name: "Resumo do aluno",
        title:
          report.reportContext.kind === "area"
            ? `Relatório final da área - ${report.student.name}`
            : `Relatório final do aluno - ${report.student.name}`,
        subtitle: singleAreaReport
          ? `${report.selectedSemester.code} - ${singleAreaReport.areaName} - ${singleAreaReport.classCode}`
          : `${report.selectedSemester.code} - ${report.selectedSemester.name}`,
        metrics: [
          { label: "RA", value: report.student.registration },
          { label: "E-mail", value: report.student.email },
          { label: "Celular", value: report.student.cellphone ?? "Não informado" },
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
            label: "Situação",
            value: report.summary.status
          }
        ],
        tables: [
          {
            title: "Resumo acadêmico",
            columns: ["Descrição"],
            rows: [[report.summary.statusSummary]]
          }
        ]
      },
      {
        name: "Áreas",
        title: "Áreas e supervisores",
        tables: [
          {
            title: "Áreas do semestre",
            columns: [
              "Área",
              "Bloco",
              "Turma",
              "Supervisores",
              "Subtotal (%)",
              "Desconto (%)",
              "Total (%)",
              "Conclusão (%)",
              "Situação"
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
        title: "Detalhamento por critério",
        tables: [
          {
            title: "Último estado publicado por critério",
            columns: [
              "Área",
              "Bloco",
              "Grupo",
              "Critério",
              "Peso (%)",
              "Nota",
              "Pontuação (%)",
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
        title: "Histórico de faltas",
        tables: [
          {
            title: "Ausências do semestre",
            columns: ["Data", "Horas", "Justificada", "Motivo"],
            rows: report.absences.map((absence) => [
              absence.date,
              absence.hours,
              absence.justified ? "Sim" : "Não",
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
  return sanitizeFileName(
    `relatorio-consolidado-${report.selectedSemester.code}`
  );
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


