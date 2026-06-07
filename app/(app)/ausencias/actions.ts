"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachExceptionalReleaseToAuditRecords,
  resolveExceptionalReleaseGate
} from "@/services/exceptional-releases";
import type {
  AbsenceActionFormValues,
  AbsenceActionState
} from "@/app/(app)/ausencias/state";
import type { Database } from "@/types/database";

type ProfessorLinkValidationRow = Pick<
  Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"],
  "id" | "data_fim"
>;
type AbsenceValidationRow = Pick<
  Database["public"]["Tables"]["ausencias"]["Row"],
  "id" | "matricula_turma_id"
>;
type EnrollmentRow = Pick<
  Database["public"]["Tables"]["matriculas_turma"]["Row"],
  "id" | "aluno_id" | "turma_id"
>;
type ClassRow = Pick<
  Database["public"]["Tables"]["turmas"]["Row"],
  "id" | "semestre_id"
>;
type SemesterRow = Pick<
  Database["public"]["Tables"]["semestres"]["Row"],
  "id" | "status"
>;

const absenceSchema = z.object({
  ausencia_id: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().uuid().safeParse(value).success, {
      message: "O identificador da falta é inválido."
    }),
  matricula_turma_id: z.string().uuid("Selecione um aluno válido."),
  data_ausencia: z
    .string()
    .trim()
    .min(1, "Informe a data da falta.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Informe uma data de falta válida."
    }),
  horas: z
    .string()
    .trim()
    .min(1, "Informe a quantidade de horas.")
    .transform((value) => value.replace(",", "."))
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "Informe a quantidade de horas em formato válido."
    })
    .transform((value) => Number(value))
    .refine((value) => value > 0, {
      message: "A quantidade de horas deve ser maior que zero."
    })
    .refine((value) => value <= 24, {
      message: "A quantidade de horas deve ser de no máximo 24."
    }),
  justificada: z.enum(["true", "false"], {
    error: "Informe se a falta foi justificada."
  }),
  motivo: z
    .string()
    .trim()
    .max(500, "O motivo deve ter no máximo 500 caracteres.")
    .optional()
    .or(z.literal("")),
  observacoes: z
    .string()
    .trim()
    .max(4000, "As observações devem ter no máximo 4000 caracteres.")
    .optional()
    .or(z.literal(""))
});

function buildErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: AbsenceActionFormValues
): AbsenceActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildSuccessState(
  message: string,
  absenceId: string
): AbsenceActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    savedAbsenceId: absenceId,
    submittedAt: Date.now()
  };
}

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildSubmittedFormValues(formData: FormData): AbsenceActionFormValues {
  const rawAbsenceId = readStringField(formData, "ausencia_id");
  const rawJustificada = readStringField(formData, "justificada");

  return {
    ausencia_id: rawAbsenceId || undefined,
    matricula_turma_id: readStringField(formData, "matricula_turma_id"),
    data_ausencia: readStringField(formData, "data_ausencia"),
    horas: readStringField(formData, "horas"),
    justificada: rawJustificada === "true" ? "true" : "false",
    motivo: readStringField(formData, "motivo"),
    observacoes: readStringField(formData, "observacoes")
  };
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildAbsenceSuccessMessage(isEditing: boolean) {
  return isEditing ? "Falta atualizada com sucesso." : "Falta registrada com sucesso.";
}

async function tryAttachAbsenceExceptionalReleaseAuditTrail(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  releaseId?: string | null;
  absenceId: string;
  contextLabel: "criacao" | "edicao";
}) {
  if (!input.releaseId?.trim()) {
    return;
  }

  try {
    await attachExceptionalReleaseToAuditRecords({
      supabase: input.supabase,
      releaseId: input.releaseId,
      tableName: "ausencias",
      recordIds: [input.absenceId]
    });
  } catch (error) {
    console.error(
      "Falha complementar ao vincular a liberação excepcional da falta ao histórico de auditoria.",
      {
        contextLabel: input.contextLabel,
        absenceId: input.absenceId,
        releaseId: input.releaseId,
        error
      }
    );
  }
}

async function loadAbsenceOperationalScope(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  enrollmentId: string
) {
  const adminSupabase = createSupabaseAdminClient();

  async function resolveWithClient(
    client:
      | Awaited<ReturnType<typeof createSupabaseServerClient>>
      | ReturnType<typeof createSupabaseAdminClient>
  ) {
    const { data: enrollmentData, error: enrollmentError } = await client
      .from("matriculas_turma")
      .select("id, aluno_id, turma_id")
      .eq("id", enrollmentId)
      .maybeSingle();

    const enrollment = (enrollmentData ?? null) as EnrollmentRow | null;

    if (enrollmentError || !enrollment) {
      return {
        enrollment: null,
        classGroup: null,
        semester: null
      };
    }

    const { data: classData, error: classError } = await client
      .from("turmas")
      .select("id, semestre_id")
      .eq("id", enrollment.turma_id)
      .maybeSingle();

    const classGroup = (classData ?? null) as ClassRow | null;

    if (classError || !classGroup) {
      return {
        enrollment,
        classGroup: null,
        semester: null
      };
    }

    const { data: semesterData, error: semesterError } = await client
      .from("semestres")
      .select("id, status")
      .eq("id", classGroup.semestre_id)
      .maybeSingle();

    const semester = (semesterData ?? null) as SemesterRow | null;

    if (semesterError || !semester) {
      return {
        enrollment,
        classGroup,
        semester: null
      };
    }

    return {
      enrollment,
      classGroup,
      semester
    };
  }

  const authenticatedScope = await resolveWithClient(supabase);
  const resolvedScope = authenticatedScope.semester
    ? authenticatedScope
    : await resolveWithClient(adminSupabase);

  if (!resolvedScope.enrollment) {
    throw new Error("Não foi possível localizar a matrícula vinculada a esta falta.");
  }

  if (!resolvedScope.classGroup) {
    throw new Error("Não foi possível localizar a turma vinculada a esta falta.");
  }

  if (!resolvedScope.semester) {
    throw new Error("Não foi possível localizar o semestre vinculado a esta falta.");
  }

  return {
    semesterId: resolvedScope.semester.id,
    semesterStatus: resolvedScope.semester.status,
    classId: resolvedScope.classGroup.id,
    studentId: resolvedScope.enrollment.aluno_id
  };
}

async function validateProfessorLink(
  professorId: string,
  enrollmentId: string
): Promise<
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
> {
  const supabase = await createSupabaseServerClient();
  const { data: professorLinkRows, error: linkError } = await supabase
    .from("vinculos_professor_aluno")
    .select("id, data_fim")
    .eq("professor_id", professorId)
    .eq("matricula_turma_id", enrollmentId)
    .eq("ativo", true);

  const typedProfessorLinks = (professorLinkRows ?? []) as ProfessorLinkValidationRow[];

  if (linkError || !typedProfessorLinks.length) {
    return {
      ok: false,
      message: "O aluno selecionado não está vinculado ao professor autenticado.",
      fieldErrors: {
        matricula_turma_id: "Selecione um aluno vinculado ao professor autenticado."
      }
    };
  }

  const today = getTodayInSaoPaulo();
  const hasActiveLink = typedProfessorLinks.some(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!hasActiveLink) {
    return {
      ok: false,
      message: "O vínculo do professor com a matrícula selecionada não está mais ativo.",
      fieldErrors: {
        matricula_turma_id: "Escolha uma matrícula com vínculo ativo."
      }
    };
  }

  return { ok: true };
}

export async function submitAbsenceAction(
  _previousState: AbsenceActionState,
  formData: FormData
): Promise<AbsenceActionState> {
  const submittedFormValues = buildSubmittedFormValues(formData);
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role !== "professor") {
    return buildErrorState(
      "Nesta versão, apenas professores podem registrar faltas por esta tela.",
      {},
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: professorRow, error: professorError } = await supabase
    .from("professores")
    .select("usuario_id")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError || !professorRow) {
    return buildErrorState(
      "Não encontramos um cadastro docente válido para o usuário autenticado.",
      {},
      submittedFormValues
    );
  }

  const parsedData = absenceSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos obrigatórios da falta.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const {
    ausencia_id,
    matricula_turma_id,
    data_ausencia,
    horas,
    justificada,
    motivo,
    observacoes
  } = parsedData.data;

  let targetEnrollmentId = matricula_turma_id;
  let isEditing = false;

  if (ausencia_id) {
    const { data: existingAbsenceData, error: existingAbsenceError } = await supabase
      .from("ausencias")
      .select("id, matricula_turma_id")
      .eq("id", ausencia_id)
      .maybeSingle();

    const existingAbsence =
      (existingAbsenceData ?? null) as AbsenceValidationRow | null;

    if (existingAbsenceError || !existingAbsence) {
      return buildErrorState(
        "Não encontramos uma falta visível para este professor com o identificador informado.",
        {},
        submittedFormValues
      );
    }

    targetEnrollmentId = existingAbsence.matricula_turma_id;
    isEditing = true;
  }

  let absenceScope;

  try {
    absenceScope = await loadAbsenceOperationalScope(supabase, targetEnrollmentId);
  } catch (error) {
    return buildErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível identificar o contexto acadêmico desta falta.",
      {},
      submittedFormValues
    );
  }

  const exceptionalReleaseGate = await resolveExceptionalReleaseGate(
    {
      type: "ausencia",
      semesterId: absenceScope.semesterId,
      classId: absenceScope.classId,
      studentId: absenceScope.studentId,
      unitId: currentUser.unitId ?? null,
      authorizedUserId: currentUser.id
    },
    {
      currentUser,
      semesterStatus: absenceScope.semesterStatus,
      blockedMessage:
        "O semestre selecionado já está encerrado. Esta falta só pode ser ajustada com liberação excepcional ativa."
    }
  );

  if (!exceptionalReleaseGate.allowed) {
    return buildErrorState(
      exceptionalReleaseGate.blockedMessage ??
        "O semestre selecionado já está encerrado e não permite novos ajustes.",
      {},
      submittedFormValues
    );
  }

  if (!exceptionalReleaseGate.viaExceptionalRelease) {
    const linkValidation = await validateProfessorLink(currentUser.id, targetEnrollmentId);

    if (!linkValidation.ok) {
      return buildErrorState(
        linkValidation.message,
        linkValidation.fieldErrors ?? {},
        submittedFormValues
      );
    }
  }

  const normalizedHours = Math.round(horas * 100) / 100;
  const normalizedJustified = justificada === "true";
  const normalizedReason = motivo || null;
  const normalizedObservations = observacoes || null;

  if (isEditing && ausencia_id) {
    const updateResult = await (supabase.rpc as any)("atualizar_ausencia", {
      p_ausencia_id: ausencia_id,
      p_data_ausencia: data_ausencia,
      p_horas: normalizedHours,
      p_justificada: normalizedJustified,
      p_motivo: normalizedReason,
      p_observacoes: normalizedObservations
    });
    const updatedAbsenceId =
      typeof updateResult.data === "string" && updateResult.data.length > 0
        ? updateResult.data
        : null;

    if (updateResult.error || !updatedAbsenceId) {
      return buildErrorState(
        "Não foi possível atualizar a falta no banco.",
        {},
        submittedFormValues
      );
    }

    if (exceptionalReleaseGate.release) {
      await tryAttachAbsenceExceptionalReleaseAuditTrail({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        absenceId: updatedAbsenceId,
        contextLabel: "edicao"
      });

      revalidatePath("/coordenador/liberacoes-excepcionais");
    }

    revalidatePath("/ausencias");
    revalidatePath(`/ausencias/${updatedAbsenceId}`);
    revalidatePath("/aluno");
    revalidatePath("/professor");
    revalidatePath("/coordenador");
    revalidatePath("/relatorios");
    revalidatePath("/auditoria");

    return buildSuccessState(
      buildAbsenceSuccessMessage(true),
      updatedAbsenceId
    );
  }

  const insertResult = await (supabase.rpc as any)("criar_ausencia", {
    p_matricula_turma_id: targetEnrollmentId,
    p_data_ausencia: data_ausencia,
    p_horas: normalizedHours,
    p_justificada: normalizedJustified,
    p_motivo: normalizedReason,
    p_observacoes: normalizedObservations
  });
  const insertedAbsenceId =
    typeof insertResult.data === "string" && insertResult.data.length > 0
      ? insertResult.data
      : null;

  if (insertResult.error || !insertedAbsenceId) {
    return buildErrorState(
      "Não foi possível registrar a falta no banco.",
      {},
      submittedFormValues
    );
  }

  if (exceptionalReleaseGate.release) {
    await tryAttachAbsenceExceptionalReleaseAuditTrail({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      absenceId: insertedAbsenceId,
      contextLabel: "criacao"
    });

    revalidatePath("/coordenador/liberacoes-excepcionais");
  }

  revalidatePath("/ausencias");
  revalidatePath(`/ausencias/${insertedAbsenceId}`);
  revalidatePath("/aluno");
  revalidatePath("/professor");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
  revalidatePath("/auditoria");

  return buildSuccessState(
    buildAbsenceSuccessMessage(false),
    insertedAbsenceId
  );
}

