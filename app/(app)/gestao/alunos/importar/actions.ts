"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";
import {
  buildStudentImportPreviewResult,
  buildStudentTemporaryPassword,
  maskStudentTemporaryPassword,
  parseStudentImportFile,
  type StudentImportPreviewResult,
  type StudentImportPreviewRow,
  type StudentImportSourceRow
} from "@/services/student-import";
import type {
  StudentImportActionState,
  StudentImportPayloadRow,
  StudentImportPreviewRow as StudentImportPreviewRowState,
  StudentImportSummary
} from "@/app/(app)/gestao/alunos/state";

type UserInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type StudentInsert = Database["public"]["Tables"]["alunos"]["Insert"];

const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const studentImportPayloadSchema = z
  .array(
    z.object({
      rowNumber: z.number().int().positive(),
      nome_completo: z.string().trim().min(3).max(160),
      ra: z.string().trim().min(1).max(30),
      celular: z.string().trim().min(1).max(30),
      email: z.string().trim().toLowerCase().email()
    })
  )
  .min(1)
  .max(MAX_IMPORT_ROWS);

function getRequiredCoordinatorUnitId(currentUser: SessionUser) {
  if (!currentUser.unitId) {
    throw new Error(
      "O coordenador autenticado não está vinculado a uma unidade operacional."
    );
  }

  return currentUser.unitId;
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildImportSummary(rows: StudentImportPreviewRowState[]): StudentImportSummary {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.status === "valida").length,
    duplicateRows: rows.filter((row) => row.status === "duplicada").length,
    invalidRows: rows.filter((row) => row.status === "invalida").length,
    importedRows: rows.filter((row) => row.status === "importada").length,
    failedRows: rows.filter((row) => row.status === "falha").length
  };
}

function mapPreviewRowsForState(
  rows: StudentImportPreviewRow[]
): StudentImportPreviewRowState[] {
  return rows.map((row) => ({
    rowNumber: row.rowNumber,
    nome_completo: row.nome_completo,
    ra: row.ra,
    celular: row.celular,
    email: row.email,
    status: row.status,
    issues: row.issues,
    temporaryPasswordMasked: maskStudentTemporaryPassword(row.temporaryPassword)
  }));
}

function buildStudentImportState(input: {
  status: StudentImportActionState["status"];
  message: string | null;
  fieldErrors?: Record<string, string>;
  fileName?: string | null;
  fileTypeLabel?: string | null;
  rows?: StudentImportPreviewRowState[];
  importableRows?: StudentImportPayloadRow[];
}): StudentImportActionState {
  const rows = input.rows ?? [];

  return {
    status: input.status,
    message: input.message,
    fieldErrors: input.fieldErrors ?? {},
    fileName: input.fileName ?? null,
    fileTypeLabel: input.fileTypeLabel ?? null,
    rows,
    importableRows: input.importableRows ?? [],
    summary: buildImportSummary(rows),
    submittedAt: Date.now()
  };
}

async function loadExistingImportConflicts(input: {
  unitId: string;
  rows: StudentImportSourceRow[];
}) {
  const supabase = await createSupabaseServerClient();
  const emails = [...new Set(input.rows.map((row) => row.email).filter(Boolean))];
  const { data: existingUserRows, error: existingUserRowsError } = emails.length
    ? await supabase.from("usuarios").select("email").in("email", emails)
    : { data: [], error: null };
  const { data: existingStudentRows, error: existingStudentRowsError } = await supabase
    .from("alunos")
    .select("matricula")
    .eq("unidade_id", input.unitId);

  if (existingUserRowsError || existingStudentRowsError) {
    throw new Error(
      "Não foi possível validar duplicidades com os alunos já cadastrados."
    );
  }

  return {
    existingEmails: new Set(
      ((existingUserRows ?? []) as Array<{ email: string }>).map((row) => row.email)
    ),
    existingRegistrations: new Set(
      ((existingStudentRows ?? []) as Array<{ matricula: string }>).map(
        (row) => row.matricula
      )
    )
  };
}

async function buildPreviewForRows(input: {
  unitId: string;
  fileName: string;
  fileTypeLabel: string;
  rows: StudentImportSourceRow[];
}) {
  const conflicts = await loadExistingImportConflicts({
    unitId: input.unitId,
    rows: input.rows
  });
  const preview = buildStudentImportPreviewResult({
    rows: input.rows,
    existingEmails: conflicts.existingEmails,
    existingRegistrations: conflicts.existingRegistrations
  });

  return buildStudentImportState({
    status: "preview",
    message: preview.importableRows.length
      ? `Prévia gerada com ${preview.importableRows.length} aluno(s) pronto(s) para importação.`
      : "Nenhuma linha válida foi encontrada para importação. Revise a planilha e tente novamente.",
    fileName: input.fileName,
    fileTypeLabel: input.fileTypeLabel,
    rows: mapPreviewRowsForState(preview.rows),
    importableRows: preview.importableRows
  });
}

async function syncAuthUserActivation(userId: string, isActive: boolean) {
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? "none" : "876000h"
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function cleanupImportedStudent(input: {
  authUserId?: string | null;
  userId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (input.userId) {
    await (supabase.from("usuarios") as any).delete().eq("id", input.userId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

function resolveImportFailureMessage(error: unknown) {
  const rawMessage =
    error instanceof Error ? error.message : "Não foi possível importar esta linha.";

  if (/already.*registered|already.*exists|email/i.test(rawMessage)) {
    return "E-mail já cadastrado no sistema.";
  }

  if (/duplicate key|unique|matricula/i.test(rawMessage)) {
    return "RA já cadastrado nesta unidade.";
  }

  return rawMessage;
}

async function createImportedStudent(input: {
  unitId: string;
  studentProfileId: number;
  row: StudentImportSourceRow;
}) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const temporaryPassword = buildStudentTemporaryPassword(input.row.celular);

  if (!temporaryPassword) {
    return {
      ok: false as const,
      message:
        "Celular sem dígitos suficientes para gerar a senha temporária deste aluno."
    };
  }

  let authUserId: string | null = null;
  let domainUserId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: input.row.email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          temporary_password: true,
          password_change_required: true,
          imported_by_spreadsheet: true
        }
      });

    if (authError || !createdAuthUser.user) {
      throw new Error(
        authError?.message ?? "Não foi possível criar o acesso do aluno no Auth."
      );
    }

    authUserId = createdAuthUser.user.id;
    domainUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: input.studentProfileId,
      unidade_id: input.unitId,
      email: input.row.email,
      nome_completo: input.row.nome_completo,
      ativo: false
    };

    const { error: userInsertError } = await (supabase.from("usuarios") as any).insert(
      userInsertPayload
    );

    if (userInsertError) {
      throw new Error(userInsertError.message);
    }

    const studentInsertPayload: StudentInsert = {
      usuario_id: createdAuthUser.user.id,
      unidade_id: input.unitId,
      matricula: input.row.ra,
      celular: input.row.celular,
      curso: "Fisioterapia"
    };

    const { error: studentInsertError } = await (supabase.from("alunos") as any).insert(
      studentInsertPayload
    );

    if (studentInsertError) {
      throw new Error(studentInsertError.message);
    }

    await syncAuthUserActivation(createdAuthUser.user.id, false);

    return {
      ok: true as const,
      temporaryPassword
    };
  } catch (error) {
    await cleanupImportedStudent({
      authUserId,
      userId: domainUserId
    });

    return {
      ok: false as const,
      message: resolveImportFailureMessage(error)
    };
  }
}

function updatePreviewRowStatus(
  rows: StudentImportPreviewRowState[],
  rowNumber: number,
  status: StudentImportPreviewRowState["status"],
  issues: string[]
) {
  return rows.map((row) =>
    row.rowNumber === rowNumber
      ? {
          ...row,
          status,
          issues
        }
      : row
  );
}

function buildImportResultMessage(summary: StudentImportSummary) {
  if (!summary.importedRows) {
    return "Nenhum aluno foi importado. Revise as linhas sinalizadas e tente novamente.";
  }

  if (!summary.failedRows) {
    return `${summary.importedRows} aluno(s) importado(s) com sucesso. Os cadastros ficaram desativados e prontos para ativação e vínculo posterior.`;
  }

  return `${summary.importedRows} aluno(s) importado(s) com sucesso e ${summary.failedRows} linha(s) ficaram pendentes por erro ou duplicidade detectada durante a confirmação.`;
}

export async function processStudentImportAction(
  _previousState: StudentImportActionState,
  formData: FormData
): Promise<StudentImportActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const intent = readStringField(formData, "intent") === "import" ? "import" : "preview";

  if (intent === "preview") {
    const uploadedFile = formData.get("spreadsheet");

    if (!(uploadedFile instanceof File) || uploadedFile.size <= 0) {
      return buildStudentImportState({
        status: "error",
        message: "Selecione uma planilha para continuar com a importação.",
        fieldErrors: {
          spreadsheet: "Envie um arquivo .xlsx, .xls ou .csv."
        }
      });
    }

    if (uploadedFile.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return buildStudentImportState({
        status: "error",
        message: "A planilha excede o tamanho máximo suportado nesta versão.",
        fieldErrors: {
          spreadsheet: "Use um arquivo com até 5 MB para continuar."
        }
      });
    }

    try {
      const parsedFile = parseStudentImportFile({
        fileName: uploadedFile.name,
        buffer: Buffer.from(await uploadedFile.arrayBuffer())
      });

      if (parsedFile.rows.length > MAX_IMPORT_ROWS) {
        return buildStudentImportState({
          status: "error",
          message: `A planilha possui ${parsedFile.rows.length} linhas preenchidas. Reduza para até ${MAX_IMPORT_ROWS} alunos por importação.`,
          fieldErrors: {
            spreadsheet: `Divida a planilha em lotes de até ${MAX_IMPORT_ROWS} linhas.`
          }
        });
      }

      return await buildPreviewForRows({
        unitId: coordinatorUnitId,
        fileName: parsedFile.fileName,
        fileTypeLabel: parsedFile.fileTypeLabel,
        rows: parsedFile.rows
      });
    } catch (error) {
      return buildStudentImportState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível processar a planilha enviada.",
        fieldErrors: {
          spreadsheet: "Revise o arquivo e tente novamente."
        }
      });
    }
  }

  const serializedPayload = readStringField(formData, "import_payload");
  const fileName = readStringField(formData, "file_name");
  const fileTypeLabel = readStringField(formData, "file_type_label");

  if (!serializedPayload) {
    return buildStudentImportState({
      status: "error",
      message: "Gere a prévia da planilha antes de confirmar a importação.",
      fieldErrors: {
        import_payload: "Faça a validação da planilha antes de importar."
      }
    });
  }

  let parsedPayload: StudentImportSourceRow[];

  try {
    const rawPayload = JSON.parse(serializedPayload);
    parsedPayload = studentImportPayloadSchema.parse(rawPayload);
  } catch {
    return buildStudentImportState({
      status: "error",
      message: "Não foi possível recuperar a prévia validada desta importação.",
      fieldErrors: {
        import_payload: "Gere uma nova prévia da planilha antes de importar."
      }
    });
  }

  let previewState: StudentImportActionState;

  try {
    previewState = await buildPreviewForRows({
      unitId: coordinatorUnitId,
      fileName: fileName || "Planilha importada",
      fileTypeLabel: fileTypeLabel || "Planilha",
      rows: parsedPayload
    });
  } catch (error) {
    return buildStudentImportState({
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível validar novamente a prévia da importação.",
      fileName: fileName || null,
      fileTypeLabel: fileTypeLabel || null
    });
  }

  if (!previewState.importableRows.length) {
    return buildStudentImportState({
      status: "error",
      message: "Nenhuma linha válida permaneceu disponível para importação.",
      fileName: previewState.fileName,
      fileTypeLabel: previewState.fileTypeLabel,
      rows: previewState.rows,
      importableRows: previewState.importableRows
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data: studentProfileRow, error: studentProfileError } = await supabase
    .from("perfis")
    .select("id")
    .eq("codigo", "aluno")
    .maybeSingle();
  const resolvedStudentProfileRow = studentProfileRow as { id: number } | null;

  if (studentProfileError || !resolvedStudentProfileRow) {
    return buildStudentImportState({
      status: "error",
      message: "O perfil de aluno não está configurado no banco.",
      fileName: previewState.fileName,
      fileTypeLabel: previewState.fileTypeLabel,
      rows: previewState.rows,
      importableRows: previewState.importableRows
    });
  }

  let rows = [...previewState.rows];

  for (const row of previewState.importableRows) {
    const importResult = await createImportedStudent({
      unitId: coordinatorUnitId,
      studentProfileId: resolvedStudentProfileRow.id,
      row
    });

    rows = updatePreviewRowStatus(
      rows,
      row.rowNumber,
      importResult.ok ? "importada" : "falha",
      importResult.ok ? [] : [importResult.message]
    );
  }

  if (rows.some((row) => row.status === "importada")) {
    revalidatePath("/gestao/alunos");
    revalidatePath("/coordenador");
    revalidatePath("/relatorios");
    revalidatePath("/auditoria");
  }

  const summary = buildImportSummary(rows);

  return {
    ...buildStudentImportState({
      status: summary.importedRows > 0 ? "success" : "error",
      message: buildImportResultMessage(summary),
      fileName: previewState.fileName,
      fileTypeLabel: previewState.fileTypeLabel,
      rows,
      importableRows: []
    }),
    summary
  };
}
