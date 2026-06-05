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
  ClinicalEvaluationActionState,
  ClinicalEvaluationFormValues,
  ClinicalEvaluationReviewActionState,
  ClinicalEvaluationReviewFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/avaliacao/state";

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

const clinicalEvaluationSchema = z.object({
  record_id: z.string().trim(),
  case_id: z.string().uuid("Caso clínico inválido."),
  evaluation_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da avaliação."),
  chief_complaint: z
    .string()
    .trim()
    .min(3, "Informe a queixa principal.")
    .max(500, "A queixa principal deve ter no máximo 500 caracteres."),
  current_illness_history: z
    .string()
    .trim()
    .max(4000, "A história clínica deve ter no máximo 4000 caracteres."),
  relevant_history: z
    .string()
    .trim()
    .max(4000, "Os antecedentes devem ter no máximo 4000 caracteres."),
  medications_and_notes: z
    .string()
    .trim()
    .max(4000, "Os medicamentos e observações devem ter no máximo 4000 caracteres."),
  inspection_notes: z
    .string()
    .trim()
    .max(4000, "A inspeção deve ter no máximo 4000 caracteres."),
  pain_notes: z
    .string()
    .trim()
    .max(4000, "O campo de dor deve ter no máximo 4000 caracteres."),
  range_of_motion: z
    .string()
    .trim()
    .max(4000, "A amplitude de movimento deve ter no máximo 4000 caracteres."),
  muscle_strength: z
    .string()
    .trim()
    .max(4000, "A força muscular deve ter no máximo 4000 caracteres."),
  functionality_limitations: z
    .string()
    .trim()
    .max(4000, "A funcionalidade deve ter no máximo 4000 caracteres."),
  other_findings: z
    .string()
    .trim()
    .max(4000, "Os outros achados devem ter no máximo 4000 caracteres."),
  clinical_diagnosis: z
    .string()
    .trim()
    .max(4000, "O diagnóstico funcional deve ter no máximo 4000 caracteres."),
  initial_objectives: z
    .string()
    .trim()
    .max(4000, "Os objetivos iniciais devem ter no máximo 4000 caracteres."),
  final_observations: z
    .string()
    .trim()
    .max(4000, "As observações finais devem ter no máximo 4000 caracteres."),
  intent: z.enum(["rascunho", "enviado"])
});

const clinicalEvaluationReviewSchema = z.object({
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

function buildEvaluationFormValues(formData: FormData): ClinicalEvaluationFormValues {
  const intent = readStringField(formData, "intent");

  return {
    record_id: readStringField(formData, "record_id"),
    case_id: readStringField(formData, "case_id"),
    evaluation_date: readStringField(formData, "evaluation_date"),
    chief_complaint: readStringField(formData, "chief_complaint"),
    current_illness_history: readStringField(formData, "current_illness_history"),
    relevant_history: readStringField(formData, "relevant_history"),
    medications_and_notes: readStringField(formData, "medications_and_notes"),
    inspection_notes: readStringField(formData, "inspection_notes"),
    pain_notes: readStringField(formData, "pain_notes"),
    range_of_motion: readStringField(formData, "range_of_motion"),
    muscle_strength: readStringField(formData, "muscle_strength"),
    functionality_limitations: readStringField(formData, "functionality_limitations"),
    other_findings: readStringField(formData, "other_findings"),
    clinical_diagnosis: readStringField(formData, "clinical_diagnosis"),
    initial_objectives: readStringField(formData, "initial_objectives"),
    final_observations: readStringField(formData, "final_observations"),
    intent: intent === "enviado" ? "enviado" : intent === "rascunho" ? "rascunho" : ""
  };
}

function buildReviewFormValues(formData: FormData): ClinicalEvaluationReviewFormValues {
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

function buildEvaluationErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalEvaluationFormValues
): ClinicalEvaluationActionState {
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
  formValues?: ClinicalEvaluationReviewFormValues
): ClinicalEvaluationReviewActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildClinicalEvaluationPayload(
  values: Omit<ClinicalEvaluationFormValues, "record_id" | "case_id" | "intent">
) {
  return {
    evaluationDate: values.evaluation_date,
    chiefComplaint: values.chief_complaint,
    currentIllnessHistory: values.current_illness_history,
    relevantHistory: values.relevant_history,
    medicationsAndNotes: values.medications_and_notes,
    inspectionNotes: values.inspection_notes,
    painNotes: values.pain_notes,
    rangeOfMotion: values.range_of_motion,
    muscleStrength: values.muscle_strength,
    functionalityLimitations: values.functionality_limitations,
    otherFindings: values.other_findings,
    clinicalDiagnosis: values.clinical_diagnosis,
    initialObjectives: values.initial_objectives,
    finalObservations: values.final_observations
  };
}

function validateEvaluationForSubmission(
  values: ClinicalEvaluationFormValues
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (values.intent !== "enviado") {
    return fieldErrors;
  }

  if (values.current_illness_history.length < 3) {
    fieldErrors.current_illness_history =
      "Descreva a história da moléstia atual antes de enviar.";
  }

  if (values.clinical_diagnosis.length < 3) {
    fieldErrors.clinical_diagnosis =
      "Informe o diagnóstico cinético-funcional antes de enviar.";
  }

  if (values.initial_objectives.length < 3) {
    fieldErrors.initial_objectives =
      "Informe os objetivos iniciais antes de enviar.";
  }

  return fieldErrors;
}

function revalidateClinicalEvaluationPaths(caseId: string) {
  revalidatePath("/clinica-supervisionada");
  revalidatePath(`/clinica-supervisionada/${caseId}`);
  revalidatePath(`/clinica-supervisionada/${caseId}/avaliacao`);
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
      "Nao foi possivel localizar o caso clinico vinculado a esta avaliacao."
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

export async function saveClinicalEvaluationAction(
  _previousState: ClinicalEvaluationActionState,
  formData: FormData
): Promise<ClinicalEvaluationActionState> {
  const currentUser = await requireRole(["aluno"]);
  const submittedFormValues = buildEvaluationFormValues(formData);
  const parsedData = clinicalEvaluationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildEvaluationErrorState(
      "Revise os campos obrigatórios da avaliação clínica.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const submissionFieldErrors = validateEvaluationForSubmission(submittedFormValues);

  if (Object.keys(submissionFieldErrors).length > 0) {
    return buildEvaluationErrorState(
      "Preencha os campos mínimos antes de enviar a avaliação para supervisão.",
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
    return buildEvaluationErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel localizar o caso clinico desta avaliacao.",
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
    return buildEvaluationErrorState(
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
    return buildEvaluationErrorState(
      "Não foi possível localizar o caso clínico desta avaliação.",
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
    .eq("tipo", "avaliacao")
    .maybeSingle();

  if (recordError) {
    return buildEvaluationErrorState(
      "Não foi possível carregar a avaliação clínica atual deste caso.",
      {},
      submittedFormValues
    );
  }

  const existingRecord = (recordRowData ?? null) as ClinicalRecordRow | null;

  if (existingRecord && existingRecord.autor_id !== currentUser.id) {
    return buildEvaluationErrorState(
      "A avaliação existente deste caso não pertence ao aluno autenticado.",
      {},
      submittedFormValues
    );
  }

  if (
    existingRecord &&
    existingRecord.status !== "rascunho" &&
    existingRecord.status !== "ajustes_solicitados"
  ) {
    return buildEvaluationErrorState(
      existingRecord.status === "aprovado"
        ? "Esta avaliação já foi aprovada e não pode ser alterada nesta fase."
        : "A avaliação já foi enviada para supervisão e aguarda retorno do professor.",
      {},
      submittedFormValues
    );
  }

  const nextStatus = parsedData.data.intent;
  const nowIso = new Date().toISOString();
  const contentPayload = buildClinicalEvaluationPayload(parsedData.data);

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
      return buildEvaluationErrorState(
        updateError.message ?? "Não foi possível atualizar a avaliação clínica.",
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

    revalidateClinicalEvaluationPaths(parsedData.data.case_id);

    return {
      status: "success",
      message: appendExceptionalReleaseNotice(
        nextStatus === "enviado"
          ? "Avaliação enviada para supervisão com sucesso."
          : "Avaliação salva como rascunho.",
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
    tipo: "avaliacao",
    status: nextStatus,
    conteudo_json: contentPayload,
    autor_id: currentUser.id,
    enviado_em: nextStatus === "enviado" ? nowIso : null
  };

  const { error: insertError } = await (supabase.from("registros_clinicos") as any).insert(
    insertPayload
  );

  if (insertError) {
    return buildEvaluationErrorState(
      insertError.message ?? "Não foi possível criar a avaliação clínica deste caso.",
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

  revalidateClinicalEvaluationPaths(parsedData.data.case_id);

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      nextStatus === "enviado"
        ? "Avaliação enviada para supervisão com sucesso."
        : "Avaliação salva como rascunho.",
      exceptionalReleaseGate.noticeMessage
    ),
    fieldErrors: {},
    savedRecordId: createdRecordId,
    savedStatus: nextStatus,
    submittedAt: Date.now()
  };
}

export async function reviewClinicalEvaluationAction(
  _previousState: ClinicalEvaluationReviewActionState,
  formData: FormData
): Promise<ClinicalEvaluationReviewActionState> {
  const submittedFormValues = buildReviewFormValues(formData);
  const parsedData = clinicalEvaluationReviewSchema.safeParse(submittedFormValues);

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
      "Explique os ajustes solicitados antes de devolver a avaliação ao aluno.",
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
    .eq("tipo", "avaliacao")
    .maybeSingle();

  if (recordError || !recordRowData) {
    return buildReviewErrorState(
      "Não foi possível localizar a avaliação clínica que será revisada.",
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
      updateError.message ?? "Não foi possível registrar a revisão da avaliação clínica.",
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

  revalidateClinicalEvaluationPaths(parsedData.data.case_id);

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      "Supervisão da avaliação atualizada com sucesso.",
      exceptionalReleaseGate.noticeMessage
    ),
    fieldErrors: {},
    submittedAt: Date.now()
  };
}
