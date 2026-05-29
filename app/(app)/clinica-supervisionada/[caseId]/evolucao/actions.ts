"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  ClinicalEvolutionActionState,
  ClinicalEvolutionFormValues,
  ClinicalEvolutionReviewActionState,
  ClinicalEvolutionReviewFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/state";

type ClinicalRecordRow = Database["public"]["Tables"]["registros_clinicos"]["Row"];
type ClinicalRecordInsert =
  Database["public"]["Tables"]["registros_clinicos"]["Insert"];
type ClinicalRecordUpdate =
  Database["public"]["Tables"]["registros_clinicos"]["Update"];

const clinicalEvolutionSchema = z.object({
  record_id: z.string().trim(),
  case_id: z.string().uuid("Caso clínico inválido."),
  session_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do atendimento."),
  progress_and_conduct: z
    .string()
    .trim()
    .max(
      8000,
      "O registro da evolução e conduta deve ter no máximo 8000 caracteres."
    ),
  observations: z
    .string()
    .trim()
    .max(4000, "As observações/intercorrências devem ter no máximo 4000 caracteres."),
  intent: z.enum(["rascunho", "enviado"])
});

const clinicalEvolutionReviewSchema = z.object({
  record_id: z.string().uuid("Registro clínico inválido."),
  case_id: z.string().uuid("Caso clínico inválido."),
  status: z.enum(["rascunho", "enviado", "aprovado", "ajustes_solicitados"]),
  supervisor_feedback: z
    .string()
    .trim()
    .max(5000, "O parecer do supervisor deve ter no máximo 5000 caracteres.")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildEvolutionFormValues(formData: FormData): ClinicalEvolutionFormValues {
  const intent = readStringField(formData, "intent");

  return {
    record_id: readStringField(formData, "record_id"),
    case_id: readStringField(formData, "case_id"),
    session_date: readStringField(formData, "session_date"),
    progress_and_conduct: readStringField(formData, "progress_and_conduct"),
    observations: readStringField(formData, "observations"),
    intent: intent === "enviado" ? "enviado" : intent === "rascunho" ? "rascunho" : ""
  };
}

function buildReviewFormValues(
  formData: FormData
): ClinicalEvolutionReviewFormValues {
  const status = readStringField(formData, "status");

  return {
    record_id: readStringField(formData, "record_id"),
    case_id: readStringField(formData, "case_id"),
    status:
      status === "rascunho" ||
      status === "enviado" ||
      status === "aprovado" ||
      status === "ajustes_solicitados"
        ? status
        : "",
    supervisor_feedback: readStringField(formData, "supervisor_feedback")
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

function buildEvolutionErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalEvolutionFormValues
): ClinicalEvolutionActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildReviewErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalEvolutionReviewFormValues
): ClinicalEvolutionReviewActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildClinicalEvolutionPayload(
  values: Omit<ClinicalEvolutionFormValues, "record_id" | "case_id" | "intent">
) {
  return {
    sessionDate: values.session_date,
    progressAndConduct: values.progress_and_conduct,
    observations: values.observations
  };
}

function validateEvolutionForSubmission(
  values: ClinicalEvolutionFormValues
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (values.intent !== "enviado") {
    return fieldErrors;
  }

  if (values.progress_and_conduct.length < 3) {
    fieldErrors.progress_and_conduct =
      "Descreva a evolução e a conduta antes de enviar para supervisão.";
  }

  return fieldErrors;
}

async function hasDuplicateEvolutionDate(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  caseId: string;
  sessionDate: string;
  currentRecordId?: string;
}) {
  const { data, error } = await args.supabase
    .from("registros_clinicos")
    .select("id, conteudo_json")
    .eq("caso_clinico_id", args.caseId)
    .eq("tipo", "evolucao");

  if (error) {
    return { hasDuplicate: false, failed: true };
  }

  const rows = (data ?? []) as Array<Pick<ClinicalRecordRow, "id" | "conteudo_json">>;
  const hasDuplicate = rows.some((row) => {
    if (args.currentRecordId && row.id === args.currentRecordId) {
      return false;
    }

    const sessionDate =
      row.conteudo_json &&
      typeof row.conteudo_json === "object" &&
      "sessionDate" in row.conteudo_json
        ? String((row.conteudo_json as Record<string, unknown>).sessionDate ?? "").trim()
        : "";

    return sessionDate === args.sessionDate;
  });

  return { hasDuplicate, failed: false };
}

function revalidateClinicalEvolutionPaths(caseId: string, recordId?: string) {
  revalidatePath("/clinica-supervisionada");
  revalidatePath("/clinica-supervisionada/historico");
  revalidatePath(`/clinica-supervisionada/${caseId}`);
  revalidatePath(`/clinica-supervisionada/${caseId}/avaliacao`);
  revalidatePath(`/clinica-supervisionada/${caseId}/plano-tratamento`);
  revalidatePath(`/clinica-supervisionada/${caseId}/evolucao`);
  revalidatePath(`/clinica-supervisionada/${caseId}/evolucao/nova`);
  if (recordId) {
    revalidatePath(`/clinica-supervisionada/${caseId}/evolucao/${recordId}`);
  }
  revalidatePath("/aluno");
  revalidatePath("/professor");
}

export async function saveClinicalEvolutionAction(
  _previousState: ClinicalEvolutionActionState,
  formData: FormData
): Promise<ClinicalEvolutionActionState> {
  const currentUser = await requireRole(["aluno"]);
  const submittedFormValues = buildEvolutionFormValues(formData);
  const parsedData = clinicalEvolutionSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildEvolutionErrorState(
      "Revise os campos obrigatórios do Registro de Evolução e Conduta.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const submissionFieldErrors = validateEvolutionForSubmission(submittedFormValues);

  if (Object.keys(submissionFieldErrors).length > 0) {
    return buildEvolutionErrorState(
      "Preencha os campos mínimos antes de enviar o Registro de Evolução e Conduta para supervisão.",
      submissionFieldErrors,
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: caseRowData, error: caseError } = await supabase
    .from("casos_clinicos")
    .select("id, unidade_id")
    .eq("id", parsedData.data.case_id)
    .maybeSingle();

  if (caseError || !caseRowData) {
    return buildEvolutionErrorState(
      "Não foi possível localizar o caso clínico deste registro de evolução.",
      {},
      submittedFormValues
    );
  }

  const caseContext = caseRowData as Pick<
    Database["public"]["Tables"]["casos_clinicos"]["Row"],
    "id" | "unidade_id"
  >;

  let existingRecord: ClinicalRecordRow | null = null;

  if (parsedData.data.record_id) {
    const { data: recordRowData, error: recordError } = await supabase
      .from("registros_clinicos")
      .select("*")
      .eq("id", parsedData.data.record_id)
      .eq("caso_clinico_id", parsedData.data.case_id)
      .eq("tipo", "evolucao")
      .maybeSingle();

    if (recordError || !recordRowData) {
      return buildEvolutionErrorState(
        "Não foi possível localizar o registro de evolução que você está tentando editar.",
        {},
        submittedFormValues
      );
    }

    existingRecord = recordRowData as ClinicalRecordRow;
  }

  if (existingRecord && existingRecord.autor_id !== currentUser.id) {
    return buildEvolutionErrorState(
      "O Registro de Evolução e Conduta existente deste caso não pertence ao aluno autenticado.",
      {},
      submittedFormValues
    );
  }

  if (
    existingRecord &&
    existingRecord.status !== "rascunho" &&
    existingRecord.status !== "ajustes_solicitados"
  ) {
    return buildEvolutionErrorState(
      existingRecord.status === "aprovado"
        ? "Este Registro de Evolução e Conduta já foi aprovado e não pode ser alterado nesta fase."
        : "O Registro de Evolução e Conduta já foi enviado para supervisão e aguarda retorno do professor.",
      {},
      submittedFormValues
    );
  }

  const duplicateDateCheck = await hasDuplicateEvolutionDate({
    supabase,
    caseId: parsedData.data.case_id,
    sessionDate: parsedData.data.session_date,
    currentRecordId: existingRecord?.id
  });

  if (duplicateDateCheck.failed) {
    return buildEvolutionErrorState(
      "Não foi possível validar a data deste atendimento.",
      {},
      submittedFormValues
    );
  }

  if (duplicateDateCheck.hasDuplicate) {
    return buildEvolutionErrorState(
      "Já existe uma evolução registrada para esta data neste caso clínico.",
      {
        session_date:
          "Use outra data ou abra a evolução já existente para este atendimento."
      },
      submittedFormValues
    );
  }

  const nextStatus = parsedData.data.intent;
  const nowIso = new Date().toISOString();
  const contentPayload = buildClinicalEvolutionPayload(parsedData.data);

  if (existingRecord) {
    const updatePayload: ClinicalRecordUpdate = {
      status: nextStatus,
      conteudo_json: contentPayload,
      enviado_em: nextStatus === "enviado" ? nowIso : null
    };

    const { error: updateError } = await (supabase.from("registros_clinicos") as any)
      .update(updatePayload)
      .eq("id", existingRecord.id)
      .eq("caso_clinico_id", parsedData.data.case_id);

    if (updateError) {
      return buildEvolutionErrorState(
        updateError.message ??
          "Não foi possível atualizar o Registro de Evolução e Conduta.",
        {},
        submittedFormValues
      );
    }

    revalidateClinicalEvolutionPaths(parsedData.data.case_id, existingRecord.id);

    return {
      status: "success",
      message:
        nextStatus === "enviado"
          ? "Registro de Evolução e Conduta enviado para supervisão com sucesso."
          : "Registro de Evolução e Conduta salvo como rascunho.",
      fieldErrors: {},
      savedRecordId: existingRecord.id,
      savedStatus: nextStatus,
      submittedAt: Date.now()
    };
  }

  const createdRecordId = crypto.randomUUID();
  const insertPayload: ClinicalRecordInsert = {
    id: createdRecordId,
    unidade_id: caseContext.unidade_id,
    caso_clinico_id: parsedData.data.case_id,
    tipo: "evolucao",
    status: nextStatus,
    conteudo_json: contentPayload,
    autor_id: currentUser.id,
    enviado_em: nextStatus === "enviado" ? nowIso : null
  };

  const { error: insertError } = await (supabase.from("registros_clinicos") as any).insert(
    insertPayload
  );

  if (insertError) {
    return buildEvolutionErrorState(
      insertError.message ??
        "Não foi possível criar o Registro de Evolução e Conduta deste caso.",
      {},
      submittedFormValues
    );
  }

  revalidateClinicalEvolutionPaths(parsedData.data.case_id, createdRecordId);

  return {
    status: "success",
    message:
      nextStatus === "enviado"
        ? "Registro de Evolução e Conduta enviado para supervisão com sucesso."
        : "Registro de Evolução e Conduta salvo como rascunho.",
    fieldErrors: {},
    savedRecordId: createdRecordId,
    savedStatus: nextStatus,
    submittedAt: Date.now()
  };
}

export async function reviewClinicalEvolutionAction(
  _previousState: ClinicalEvolutionReviewActionState,
  formData: FormData
): Promise<ClinicalEvolutionReviewActionState> {
  const submittedFormValues = buildReviewFormValues(formData);
  const parsedData = clinicalEvolutionReviewSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildReviewErrorState(
      "Revise os campos da supervisão clínica.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  if (
    parsedData.data.status === "ajustes_solicitados" &&
    parsedData.data.supervisor_feedback.length < 5
  ) {
    return buildReviewErrorState(
      "Explique os ajustes solicitados antes de devolver o Registro de Evolução e Conduta ao aluno.",
      {
        supervisor_feedback:
          "Descreva orientações objetivas para os ajustes solicitados."
      },
      submittedFormValues
    );
  }

  const currentUser = await requireRole(["professor"]);
  const supabase = await createSupabaseServerClient();
  const { data: recordRowData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("id", parsedData.data.record_id)
    .eq("caso_clinico_id", parsedData.data.case_id)
    .eq("tipo", "evolucao")
    .maybeSingle();

  if (recordError || !recordRowData) {
    return buildReviewErrorState(
      "Não foi possível localizar o Registro de Evolução e Conduta que será revisado.",
      {},
      submittedFormValues
    );
  }

  const updatePayload: ClinicalRecordUpdate = {
    status: parsedData.data.status,
    parecer_supervisor: parsedData.data.supervisor_feedback || null,
    revisado_por: currentUser.id,
    revisado_em: new Date().toISOString()
  };

  const { error: updateError } = await (supabase.from("registros_clinicos") as any)
    .update(updatePayload)
    .eq("id", parsedData.data.record_id)
    .eq("caso_clinico_id", parsedData.data.case_id);

  if (updateError) {
    return buildReviewErrorState(
      updateError.message ??
        "Não foi possível registrar a revisão do Registro de Evolução e Conduta.",
      {},
      submittedFormValues
    );
  }

  revalidateClinicalEvolutionPaths(
    parsedData.data.case_id,
    parsedData.data.record_id
  );

  return {
    status: "success",
    message: "Supervisão do Registro de Evolução e Conduta atualizada com sucesso.",
    fieldErrors: {},
    submittedAt: Date.now()
  };
}
