"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachExceptionalReleaseToAuditRecords,
  resolveExceptionalReleaseGate
} from "@/services/exceptional-releases";
import type { Database } from "@/types/database";
import type {
  ClinicalTreatmentPlanActionState,
  ClinicalTreatmentPlanFormValues,
  ClinicalTreatmentPlanReviewActionState,
  ClinicalTreatmentPlanReviewFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/plano-tratamento/state";

type ClinicalRecordRow = Database["public"]["Tables"]["registros_clinicos"]["Row"];
type ClinicalRecordInsert =
  Database["public"]["Tables"]["registros_clinicos"]["Insert"];
type ClinicalRecordUpdate =
  Database["public"]["Tables"]["registros_clinicos"]["Update"];
type ClinicalCaseScopeRow = Pick<
  Database["public"]["Tables"]["casos_clinicos"]["Row"],
  "id" | "unidade_id" | "semestre_id" | "turma_id" | "matricula_turma_id"
>;
type EnrollmentRow = Pick<
  Database["public"]["Tables"]["matriculas_turma"]["Row"],
  "id" | "aluno_id"
>;
type SemesterRow = Pick<
  Database["public"]["Tables"]["semestres"]["Row"],
  "id" | "status"
>;

const clinicalTreatmentPlanSchema = z.object({
  record_id: z.string().trim(),
  case_id: z.string().uuid("Caso clínico inválido."),
  plan_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do plano."),
  objectives: z
    .string()
    .trim()
    .max(5000, "Os objetivos devem ter no máximo 5000 caracteres."),
  conducts: z
    .string()
    .trim()
    .max(5000, "As condutas devem ter no máximo 5000 caracteres."),
  observations: z
    .string()
    .trim()
    .max(4000, "As observações devem ter no máximo 4000 caracteres."),
  intent: z.enum(["rascunho", "enviado"])
});

const clinicalTreatmentPlanReviewSchema = z.object({
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

function buildTreatmentPlanFormValues(
  formData: FormData
): ClinicalTreatmentPlanFormValues {
  const intent = readStringField(formData, "intent");

  return {
    record_id: readStringField(formData, "record_id"),
    case_id: readStringField(formData, "case_id"),
    plan_date: readStringField(formData, "plan_date"),
    objectives: readStringField(formData, "objectives"),
    conducts: readStringField(formData, "conducts"),
    observations: readStringField(formData, "observations"),
    intent: intent === "enviado" ? "enviado" : intent === "rascunho" ? "rascunho" : ""
  };
}

function buildReviewFormValues(
  formData: FormData
): ClinicalTreatmentPlanReviewFormValues {
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

function buildTreatmentPlanErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalTreatmentPlanFormValues
): ClinicalTreatmentPlanActionState {
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
  formValues?: ClinicalTreatmentPlanReviewFormValues
): ClinicalTreatmentPlanReviewActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildClinicalTreatmentPlanPayload(
  values: Omit<ClinicalTreatmentPlanFormValues, "record_id" | "case_id" | "intent">
) {
  return {
    planDate: values.plan_date,
    objectives: values.objectives,
    conducts: values.conducts,
    observations: values.observations
  };
}

function validateTreatmentPlanForSubmission(
  values: ClinicalTreatmentPlanFormValues
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (values.intent !== "enviado") {
    return fieldErrors;
  }

  if (values.objectives.length < 3) {
    fieldErrors.objectives =
      "Descreva os objetivos terapêuticos antes de enviar para supervisão.";
  }

  if (values.conducts.length < 3) {
    fieldErrors.conducts =
      "Descreva as condutas terapêuticas antes de enviar para supervisão.";
  }

  return fieldErrors;
}

function revalidateClinicalTreatmentPlanPaths(caseId: string) {
  revalidatePath("/clinica-supervisionada");
  revalidatePath(`/clinica-supervisionada/${caseId}`);
  revalidatePath(`/clinica-supervisionada/${caseId}/avaliacao`);
  revalidatePath(`/clinica-supervisionada/${caseId}/plano-tratamento`);
  revalidatePath("/aluno");
  revalidatePath("/professor");
}

function appendExceptionalReleaseNotice(message: string, noticeMessage?: string | null) {
  return noticeMessage ? `${message} ${noticeMessage}` : message;
}

async function loadClinicalCaseExceptionalScope(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  caseId: string
) {
  const { data: caseData, error: caseError } = await supabase
    .from("casos_clinicos")
    .select("id, unidade_id, semestre_id, turma_id, matricula_turma_id")
    .eq("id", caseId)
    .maybeSingle();

  const caseRow = (caseData ?? null) as ClinicalCaseScopeRow | null;

  if (caseError || !caseRow) {
    throw new Error(
      "Nao foi possivel localizar o caso clinico vinculado a este plano."
    );
  }

  const [{ data: enrollmentData, error: enrollmentError }, { data: semesterData, error: semesterError }] =
    await Promise.all([
      supabase
        .from("matriculas_turma")
        .select("id, aluno_id")
        .eq("id", caseRow.matricula_turma_id)
        .maybeSingle(),
      supabase
        .from("semestres")
        .select("id, status")
        .eq("id", caseRow.semestre_id)
        .maybeSingle()
    ]);

  const enrollment = (enrollmentData ?? null) as EnrollmentRow | null;
  const semester = (semesterData ?? null) as SemesterRow | null;

  if (enrollmentError || !enrollment || semesterError || !semester) {
    throw new Error(
      "Nao foi possivel consolidar o contexto academico do caso clinico."
    );
  }

  return {
    caseRow,
    semesterId: semester.id,
    semesterStatus: semester.status,
    classId: caseRow.turma_id,
    studentId: enrollment.aluno_id
  };
}

export async function saveClinicalTreatmentPlanAction(
  _previousState: ClinicalTreatmentPlanActionState,
  formData: FormData
): Promise<ClinicalTreatmentPlanActionState> {
  const currentUser = await requireRole(["aluno"]);
  const submittedFormValues = buildTreatmentPlanFormValues(formData);
  const parsedData = clinicalTreatmentPlanSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildTreatmentPlanErrorState(
      "Revise os campos obrigatórios do Plano de tratamento.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const submissionFieldErrors =
    validateTreatmentPlanForSubmission(submittedFormValues);

  if (Object.keys(submissionFieldErrors).length > 0) {
    return buildTreatmentPlanErrorState(
      "Preencha os campos mínimos antes de enviar o Plano de tratamento para supervisão.",
      submissionFieldErrors,
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  let clinicalScope;

  try {
    clinicalScope = await loadClinicalCaseExceptionalScope(
      supabase,
      parsedData.data.case_id
    );
  } catch (error) {
    return buildTreatmentPlanErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel localizar o caso clinico deste plano.",
      {},
      submittedFormValues
    );
  }

  const exceptionalReleaseGate = await resolveExceptionalReleaseGate(
    {
      type: "clinica_supervisionada",
      semesterId: clinicalScope.semesterId,
      classId: clinicalScope.classId,
      studentId: clinicalScope.studentId,
      unitId: clinicalScope.caseRow.unidade_id ?? currentUser.unitId ?? null,
      authorizedUserId: currentUser.id
    },
    {
      currentUser,
      semesterStatus: clinicalScope.semesterStatus,
      blockedMessage:
        "O semestre deste caso clinico ja esta encerrado. Esta edicao so pode ser realizada com liberacao excepcional ativa."
    }
  );

  if (!exceptionalReleaseGate.allowed) {
    return buildTreatmentPlanErrorState(
      exceptionalReleaseGate.blockedMessage ??
        "O semestre deste caso clinico ja esta encerrado e nao permite novos ajustes.",
      {},
      submittedFormValues
    );
  }
  const { data: caseRowData, error: caseError } = await supabase
    .from("casos_clinicos")
    .select("id, unidade_id")
    .eq("id", parsedData.data.case_id)
    .maybeSingle();

  if (caseError || !caseRowData) {
    return buildTreatmentPlanErrorState(
      "Não foi possível localizar o caso clínico deste Plano de tratamento.",
      {},
      submittedFormValues
    );
  }

  const caseContext = caseRowData as Pick<
    Database["public"]["Tables"]["casos_clinicos"]["Row"],
    "id" | "unidade_id"
  >;

  const { data: recordRowData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("caso_clinico_id", parsedData.data.case_id)
    .eq("tipo", "plano_tratamento")
    .maybeSingle();

  if (recordError) {
    return buildTreatmentPlanErrorState(
      "Não foi possível carregar o Plano de tratamento atual deste caso.",
      {},
      submittedFormValues
    );
  }

  const existingRecord = (recordRowData ?? null) as ClinicalRecordRow | null;

  if (existingRecord && existingRecord.autor_id !== currentUser.id) {
    return buildTreatmentPlanErrorState(
      "O Plano de tratamento existente deste caso não pertence ao aluno autenticado.",
      {},
      submittedFormValues
    );
  }

  if (
    existingRecord &&
    existingRecord.status !== "rascunho" &&
    existingRecord.status !== "ajustes_solicitados"
  ) {
    return buildTreatmentPlanErrorState(
      existingRecord.status === "aprovado"
        ? "Este Plano de tratamento já foi aprovado e não pode ser alterado nesta fase."
        : "O Plano de tratamento já foi enviado para supervisão e aguarda retorno do professor.",
      {},
      submittedFormValues
    );
  }

  const nextStatus = parsedData.data.intent;
  const nowIso = new Date().toISOString();
  const contentPayload = buildClinicalTreatmentPlanPayload(parsedData.data);

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
      return buildTreatmentPlanErrorState(
        updateError.message ?? "Não foi possível atualizar o Plano de tratamento.",
        {},
        submittedFormValues
      );
    }

    if (exceptionalReleaseGate.release) {
      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "registros_clinicos",
        recordIds: [existingRecord.id]
      });
    }

    revalidateClinicalTreatmentPlanPaths(parsedData.data.case_id);

    return {
      status: "success",
      message: appendExceptionalReleaseNotice(
        nextStatus === "enviado"
          ? "Plano de tratamento enviado para supervisão com sucesso."
          : "Plano de tratamento salvo como rascunho.",
        exceptionalReleaseGate.noticeMessage
      ),
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
    tipo: "plano_tratamento",
    status: nextStatus,
    conteudo_json: contentPayload,
    autor_id: currentUser.id,
    enviado_em: nextStatus === "enviado" ? nowIso : null
  };

  const { error: insertError } = await (supabase.from("registros_clinicos") as any).insert(
    insertPayload
  );

  if (insertError) {
    return buildTreatmentPlanErrorState(
      insertError.message ?? "Não foi possível criar o Plano de tratamento deste caso.",
      {},
      submittedFormValues
    );
  }

  if (exceptionalReleaseGate.release) {
    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "registros_clinicos",
      recordIds: [createdRecordId]
    });
  }

  revalidateClinicalTreatmentPlanPaths(parsedData.data.case_id);

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      nextStatus === "enviado"
        ? "Plano de tratamento enviado para supervisão com sucesso."
        : "Plano de tratamento salvo como rascunho.",
      exceptionalReleaseGate.noticeMessage
    ),
    fieldErrors: {},
    savedRecordId: createdRecordId,
    savedStatus: nextStatus,
    submittedAt: Date.now()
  };
}

export async function reviewClinicalTreatmentPlanAction(
  _previousState: ClinicalTreatmentPlanReviewActionState,
  formData: FormData
): Promise<ClinicalTreatmentPlanReviewActionState> {
  const submittedFormValues = buildReviewFormValues(formData);
  const parsedData = clinicalTreatmentPlanReviewSchema.safeParse(submittedFormValues);

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
      "Explique os ajustes solicitados antes de devolver o Plano de tratamento ao aluno.",
      {
        supervisor_feedback:
          "Descreva orientações objetivas para os ajustes solicitados."
      },
      submittedFormValues
    );
  }

  const currentUser = await requireRole(["professor"]);
  const supabase = await createSupabaseServerClient();
  let clinicalScope;

  try {
    clinicalScope = await loadClinicalCaseExceptionalScope(
      supabase,
      parsedData.data.case_id
    );
  } catch (error) {
    return buildReviewErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel localizar o caso clinico desta supervisao.",
      {},
      submittedFormValues
    );
  }

  const exceptionalReleaseGate = await resolveExceptionalReleaseGate(
    {
      type: "clinica_supervisionada",
      semesterId: clinicalScope.semesterId,
      classId: clinicalScope.classId,
      studentId: clinicalScope.studentId,
      unitId: clinicalScope.caseRow.unidade_id ?? currentUser.unitId ?? null,
      authorizedUserId: currentUser.id
    },
    {
      currentUser,
      semesterStatus: clinicalScope.semesterStatus,
      blockedMessage:
        "O semestre deste caso clinico ja esta encerrado. Esta revisao so pode ser realizada com liberacao excepcional ativa."
    }
  );

  if (!exceptionalReleaseGate.allowed) {
    return buildReviewErrorState(
      exceptionalReleaseGate.blockedMessage ??
        "O semestre deste caso clinico ja esta encerrado e nao permite novos ajustes.",
      {},
      submittedFormValues
    );
  }

  const { data: recordRowData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("id", parsedData.data.record_id)
    .eq("caso_clinico_id", parsedData.data.case_id)
    .eq("tipo", "plano_tratamento")
    .maybeSingle();

  if (recordError || !recordRowData) {
    return buildReviewErrorState(
      "Não foi possível localizar o Plano de tratamento que será revisado.",
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
      updateError.message ?? "Não foi possível registrar a revisão do Plano de tratamento.",
      {},
      submittedFormValues
    );
  }

  if (exceptionalReleaseGate.release) {
    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "registros_clinicos",
      recordIds: [parsedData.data.record_id]
    });
  }

  revalidateClinicalTreatmentPlanPaths(parsedData.data.case_id);

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      "Supervisão do Plano de tratamento atualizada com sucesso.",
      exceptionalReleaseGate.noticeMessage
    ),
    fieldErrors: {},
    submittedAt: Date.now()
  };
}
