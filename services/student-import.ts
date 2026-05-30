import { z } from "zod";
import * as XLSX from "xlsx";

const REQUIRED_IMPORT_HEADERS = [
  "nome_completo",
  "ra",
  "celular",
  "email"
] as const;

const studentImportRowSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do aluno.")
    .max(160, "O nome do aluno deve ter no máximo 160 caracteres."),
  ra: z
    .string()
    .trim()
    .min(1, "Informe o RA do aluno.")
    .max(30, "O RA deve ter no máximo 30 caracteres."),
  celular: z
    .string()
    .trim()
    .min(1, "Informe o celular do aluno.")
    .max(30, "O celular deve ter no máximo 30 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido para o aluno.")
});

export type StudentImportPreviewRowStatus =
  | "valida"
  | "duplicada"
  | "invalida"
  | "importada"
  | "falha";

export interface StudentImportSourceRow {
  rowNumber: number;
  nome_completo: string;
  ra: string;
  celular: string;
  email: string;
}

export interface StudentImportPreviewRow extends StudentImportSourceRow {
  status: StudentImportPreviewRowStatus;
  issues: string[];
  temporaryPassword: string | null;
}

export interface StudentImportPreviewSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  importedRows: number;
  failedRows: number;
}

export interface ParsedStudentImportFile {
  fileName: string;
  fileTypeLabel: string;
  rows: StudentImportSourceRow[];
}

export interface StudentImportPreviewResult {
  rows: StudentImportPreviewRow[];
  importableRows: StudentImportSourceRow[];
  summary: StudentImportPreviewSummary;
}

interface StudentImportValidationContext {
  duplicateEmailsInFile: Set<string>;
  duplicateRegistrationsInFile: Set<string>;
  existingEmails: Set<string>;
  existingRegistrations: Set<string>;
}

type ImportHeaderKey = (typeof REQUIRED_IMPORT_HEADERS)[number];

const headerAliasMap = new Map<string, ImportHeaderKey>([
  ["nomecompleto", "nome_completo"],
  ["nome", "nome_completo"],
  ["ra", "ra"],
  ["registroacademico", "ra"],
  ["matricula", "ra"],
  ["celular", "celular"],
  ["telefonecelular", "celular"],
  ["telefone", "celular"],
  ["contato", "celular"],
  ["email", "email"],
  ["emaildeacesso", "email"],
  ["correioeletronico", "email"]
]);

function normalizeHeaderValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeImportCellValue(value: unknown) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .trim();
}

function normalizeImportName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractCellphoneDigits(value: string) {
  return value.replace(/\D+/g, "");
}

function buildDuplicateKey(value: string) {
  return value.trim().toLowerCase();
}

function buildRegistrationKey(value: string) {
  return value.trim().toLowerCase();
}

function resolveHeaderIndexes(headerRow: unknown[]) {
  const headerIndexes = new Map<ImportHeaderKey, number>();

  headerRow.forEach((headerValue, index) => {
    const normalizedHeader = normalizeHeaderValue(normalizeImportCellValue(headerValue));
    const mappedHeader = headerAliasMap.get(normalizedHeader);

    if (mappedHeader && !headerIndexes.has(mappedHeader)) {
      headerIndexes.set(mappedHeader, index);
    }
  });

  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !headerIndexes.has(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(
      `A planilha precisa conter as colunas ${missingHeaders
        .map((header) => `\`${header}\``)
        .join(", ")}.`
    );
  }

  return headerIndexes;
}

function buildFileTypeLabel(fileName: string) {
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedFileName.endsWith(".csv")) {
    return "CSV";
  }

  if (normalizedFileName.endsWith(".xls")) {
    return "Excel (.xls)";
  }

  return "Excel (.xlsx)";
}

export function buildStudentTemporaryPassword(cellphone: string) {
  const digits = extractCellphoneDigits(cellphone);

  if (digits.length < 6) {
    return null;
  }

  return `Nx@${digits.slice(-6)}`;
}

export function maskStudentTemporaryPassword(temporaryPassword: string | null) {
  if (!temporaryPassword) {
    return "Indisponível";
  }

  return `${temporaryPassword.slice(0, 3)}••••••`;
}

export function parseStudentImportFile(input: {
  fileName: string;
  buffer: Buffer;
}): ParsedStudentImportFile {
  const normalizedFileName = input.fileName.trim().toLowerCase();
  const isCsv = normalizedFileName.endsWith(".csv");
  const isExcel =
    normalizedFileName.endsWith(".xlsx") || normalizedFileName.endsWith(".xls");

  if (!isCsv && !isExcel) {
    throw new Error(
      "Envie uma planilha nos formatos .xlsx, .xls ou .csv para continuar."
    );
  }

  let workbook: XLSX.WorkBook;

  try {
    workbook = isCsv
      ? XLSX.read(input.buffer.toString("utf8"), { type: "string" })
      : XLSX.read(input.buffer, { type: "buffer" });
  } catch {
    throw new Error("Não foi possível ler a planilha enviada. Revise o arquivo e tente novamente.");
  }

  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error("A planilha enviada está vazia.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const sheetRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false
  });

  if (!sheetRows.length) {
    throw new Error("A planilha enviada está vazia.");
  }

  const headerIndexes = resolveHeaderIndexes(sheetRows[0] ?? []);
  const rows: StudentImportSourceRow[] = [];

  for (let rowIndex = 1; rowIndex < sheetRows.length; rowIndex += 1) {
    const row = Array.isArray(sheetRows[rowIndex]) ? sheetRows[rowIndex] : [];
    const normalizedRow: StudentImportSourceRow = {
      rowNumber: rowIndex + 1,
      nome_completo: normalizeImportName(
        normalizeImportCellValue(row[headerIndexes.get("nome_completo") ?? -1])
      ),
      ra: normalizeImportCellValue(row[headerIndexes.get("ra") ?? -1]),
      celular: normalizeImportCellValue(row[headerIndexes.get("celular") ?? -1]),
      email: normalizeImportCellValue(row[headerIndexes.get("email") ?? -1]).toLowerCase()
    };

    const hasAnyValue = REQUIRED_IMPORT_HEADERS.some((header) =>
      Boolean(normalizedRow[header])
    );

    if (!hasAnyValue) {
      continue;
    }

    rows.push(normalizedRow);
  }

  if (!rows.length) {
    throw new Error(
      "A planilha não possui linhas preenchidas para importar alunos."
    );
  }

  return {
    fileName: input.fileName,
    fileTypeLabel: buildFileTypeLabel(input.fileName),
    rows
  };
}

export function collectStudentImportDuplicateSets(rows: StudentImportSourceRow[]) {
  const emailOccurrences = new Map<string, number>();
  const registrationOccurrences = new Map<string, number>();

  for (const row of rows) {
    const emailKey = buildDuplicateKey(row.email);
    const registrationKey = buildRegistrationKey(row.ra);

    if (emailKey) {
      emailOccurrences.set(emailKey, (emailOccurrences.get(emailKey) ?? 0) + 1);
    }

    if (registrationKey) {
      registrationOccurrences.set(
        registrationKey,
        (registrationOccurrences.get(registrationKey) ?? 0) + 1
      );
    }
  }

  return {
    duplicateEmailsInFile: new Set(
      [...emailOccurrences.entries()]
        .filter(([, count]) => count > 1)
        .map(([email]) => email)
    ),
    duplicateRegistrationsInFile: new Set(
      [...registrationOccurrences.entries()]
        .filter(([, count]) => count > 1)
        .map(([registration]) => registration)
    )
  };
}

function validateStudentImportRow(
  row: StudentImportSourceRow,
  validationContext: StudentImportValidationContext
) {
  const issues: string[] = [];
  const parsedRow = studentImportRowSchema.safeParse({
    nome_completo: row.nome_completo,
    ra: row.ra,
    celular: row.celular,
    email: row.email
  });

  if (!parsedRow.success) {
    issues.push(...parsedRow.error.issues.map((issue) => issue.message));
  }

  const cellphoneDigits = extractCellphoneDigits(row.celular);

  if (cellphoneDigits.length < 6) {
    issues.push(
      "Informe um celular com pelo menos 6 dígitos válidos para gerar a senha temporária."
    );
  }

  const emailKey = buildDuplicateKey(row.email);
  const registrationKey = buildRegistrationKey(row.ra);
  const duplicatedInFile =
    (emailKey && validationContext.duplicateEmailsInFile.has(emailKey)) ||
    (registrationKey &&
      validationContext.duplicateRegistrationsInFile.has(registrationKey));

  if (emailKey && validationContext.duplicateEmailsInFile.has(emailKey)) {
    issues.push("E-mail duplicado dentro da própria planilha.");
  }

  if (registrationKey && validationContext.duplicateRegistrationsInFile.has(registrationKey)) {
    issues.push("RA duplicado dentro da própria planilha.");
  }

  if (emailKey && validationContext.existingEmails.has(emailKey)) {
    issues.push("E-mail já cadastrado no sistema.");
  }

  if (registrationKey && validationContext.existingRegistrations.has(registrationKey)) {
    issues.push("RA já cadastrado nesta unidade.");
  }

  const temporaryPassword = buildStudentTemporaryPassword(row.celular);
  const status: StudentImportPreviewRowStatus =
    issues.length === 0
      ? "valida"
      : duplicatedInFile ||
          (emailKey && validationContext.existingEmails.has(emailKey)) ||
          (registrationKey && validationContext.existingRegistrations.has(registrationKey))
        ? "duplicada"
        : "invalida";

  return {
    ...row,
    temporaryPassword,
    issues,
    status
  } satisfies StudentImportPreviewRow;
}

export function buildStudentImportPreviewResult(input: {
  rows: StudentImportSourceRow[];
  existingEmails: Iterable<string>;
  existingRegistrations: Iterable<string>;
}): StudentImportPreviewResult {
  const duplicateSets = collectStudentImportDuplicateSets(input.rows);
  const validationContext: StudentImportValidationContext = {
    duplicateEmailsInFile: duplicateSets.duplicateEmailsInFile,
    duplicateRegistrationsInFile: duplicateSets.duplicateRegistrationsInFile,
    existingEmails: new Set(
      [...input.existingEmails].map((email) => buildDuplicateKey(email))
    ),
    existingRegistrations: new Set(
      [...input.existingRegistrations].map((registration) =>
        buildRegistrationKey(registration)
      )
    )
  };

  const previewRows = input.rows.map((row) =>
    validateStudentImportRow(row, validationContext)
  );
  const importableRows = previewRows
    .filter((row) => row.status === "valida")
    .map(({ rowNumber, nome_completo, ra, celular, email }) => ({
      rowNumber,
      nome_completo,
      ra,
      celular,
      email
    }));

  return {
    rows: previewRows,
    importableRows,
    summary: {
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.status === "valida").length,
      duplicateRows: previewRows.filter((row) => row.status === "duplicada").length,
      invalidRows: previewRows.filter((row) => row.status === "invalida").length,
      importedRows: 0,
      failedRows: 0
    }
  };
}
