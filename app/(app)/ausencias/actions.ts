"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
type AbsenceInsert = Database["public"]["Tables"]["ausencias"]["Insert"];
type AbsenceUpdate = Database["public"]["Tables"]["ausencias"]["Update"];

const absenceSchema = z.object({
  ausencia_id: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().uuid().safeParse(value).success, {
      message: "O identificador da falta e invalido."
    }),
  matricula_turma_id: z.string().uuid("Selecione um aluno valido."),
  data_ausencia: z
    .string()
    .trim()
    .min(1, "Informe a data da falta.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, {
      message: "Informe uma data de falta valida."
    }),
  horas: z
    .string()
    .trim()
    .min(1, "Informe a quantidade de horas.")
    .transform((value) => value.replace(",", "."))
    .refine((value) => /^\d+(\.\d{1,2})?$/.test(value), {
      message: "Informe a quantidade de horas em formato valido."
    })
    .transform((value) => Number(value))
    .refine((value) => value > 0, {
      message: "A quantidade de horas deve ser maior que zero."
    })
    .refine((value) => value <= 24, {
      message: "A quantidade de horas deve ser de no maximo 24."
    }),
  justificada: z.enum(["true", "false"], {
    error: "Informe se a falta foi justificada."
  }),
  motivo: z
    .string()
    .trim()
    .max(500, "O motivo deve ter no maximo 500 caracteres.")
    .optional()
    .or(z.literal("")),
  observacoes: z
    .string()
    .trim()
    .max(4000, "As observacoes devem ter no maximo 4000 caracteres.")
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
      message: "O aluno selecionado nao esta vinculado ao professor autenticado.",
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
      message: "O vinculo do professor com a matricula selecionada nao esta mais ativo.",
      fieldErrors: {
        matricula_turma_id: "Escolha uma matricula com vinculo ativo."
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
      "Nesta versao, apenas professores podem registrar faltas por esta tela.",
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
      "Não encontramos um cadastro docente valido para o usuario autenticado.",
      {},
      submittedFormValues
    );
  }

  const parsedData = absenceSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos obrigatorios da falta.",
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
        "Não encontramos uma falta visivel para este professor com o identificador informado.",
        {},
        submittedFormValues
      );
    }

    targetEnrollmentId = existingAbsence.matricula_turma_id;
    isEditing = true;
  }

  const linkValidation = await validateProfessorLink(currentUser.id, targetEnrollmentId);

  if (!linkValidation.ok) {
    return buildErrorState(
      linkValidation.message,
      linkValidation.fieldErrors ?? {},
      submittedFormValues
    );
  }

  const payload = {
    matricula_turma_id: targetEnrollmentId,
    data_ausencia: data_ausencia,
    horas: Math.round(horas * 100) / 100,
    justificada: justificada === "true",
    motivo: motivo || null,
    observacoes: observacoes || null
  } satisfies AbsenceUpdate;

  const absenceTableClient = supabase as unknown as {
    from: (table: "ausencias") => {
      update: (values: AbsenceUpdate) => {
        eq: (
          column: "id",
          value: string
        ) => Promise<{
          error: { message: string } | null;
        }>;
      };
      insert: (values: AbsenceInsert) => {
        select: (columns: "id") => {
          maybeSingle: () => Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  if (isEditing && ausencia_id) {
    const { error: updateError } = await absenceTableClient
      .from("ausencias")
      .update(payload)
      .eq("id", ausencia_id);

    if (updateError) {
      return buildErrorState(
        updateError.message ??
          "Não foi possível atualizar a falta no banco.",
        {},
        submittedFormValues
      );
    }

    revalidatePath("/ausencias");
    revalidatePath(`/ausencias/${ausencia_id}`);
    revalidatePath("/aluno");
    revalidatePath("/professor");
    revalidatePath("/coordenador");
    revalidatePath("/relatorios");
    revalidatePath("/auditoria");

    return buildSuccessState("Falta atualizada com sucesso.", ausencia_id);
  }

  const { data: insertedAbsence, error: insertError } = await absenceTableClient
    .from("ausencias")
    .insert({
      ...payload,
      registrado_por: currentUser.id
    } satisfies AbsenceInsert)
    .select("id")
    .maybeSingle();

  if (insertError || !insertedAbsence?.id) {
    return buildErrorState(
      insertError?.message ??
        "Não foi possível registrar a falta no banco.",
      {},
      submittedFormValues
    );
  }

  revalidatePath("/ausencias");
  revalidatePath(`/ausencias/${insertedAbsence.id}`);
  revalidatePath("/aluno");
  revalidatePath("/professor");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
  revalidatePath("/auditoria");

  return buildSuccessState("Falta registrada com sucesso.", insertedAbsence.id);
}

