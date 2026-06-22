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
import type { ClinicalAttendanceEvolutionStatus } from "@/types/domain";
import type {
  ClinicalEvolutionActionState,
  ClinicalEvolutionFormValues,
  ClinicalEvolutionReviewActionState,
  ClinicalEvolutionReviewFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/state";

type ClinicalAttendanceRow =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Row"];
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

const clinicalEvolutionSchema = z.object({
  record_id: z.string().trim(),
  case_id: z.string().uuid("Caso clínico inválido."),
  attendance_id: z.union([
    z.literal(""),
    z.string().uuid("Atendimento clínico inválido.")
  ]),
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
    attendance_id: readStringField(formData, "attendance_id"),
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

function resolveClinicalAttendanceEvolutionStatusFromRecordStatus(
  value: ClinicalRecordRow["status"]
): ClinicalAttendanceEvolutionStatus {
  switch (value) {
    case "enviado":
      return "enviada";
    case "ajustes_solicitados":
      return "ajustes_solicitados";
    case "aprovado":
      return "aprovada";
    case "rascunho":
    default:
      return "pendente";
  }
}

async function hasDuplicateLegacyEvolutionDate(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  caseId: string;
  sessionDate: string;
  currentRecordId?: string;
}) {
  const { data, error } = await args.supabase
    .from("registros_clinicos")
    .select("id, conteudo_json, atendimento_clinico_id")
    .eq("caso_clinico_id", args.caseId)
    .eq("tipo", "evolucao")
    .is("atendimento_clinico_id", null);

  if (error) {
    return { hasDuplicate: false, failed: true };
  }

  const rows = (data ?? []) as Array<
    Pick<ClinicalRecordRow, "id" | "conteudo_json" | "atendimento_clinico_id">
  >;
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

async function loadClinicalEvolutionRecordByAttendanceId(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  attendanceId: string;
}) {
  const { data, error } = await args.supabase
    .from("registros_clinicos")
    .select("*")
    .eq("tipo", "evolucao")
    .eq("atendimento_clinico_id", args.attendanceId)
    .maybeSingle();

  if (error) {
    throw new Error("Nao foi possivel localizar a evolucao vinculada a este atendimento.");
  }

  return (data ?? null) as ClinicalRecordRow | null;
}

async function loadScopedStudentAttendanceRow(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  attendanceId: string;
  caseId: string;
  studentId: string;
}) {
  const { data, error } = await args.supabase
    .from("atendimentos_clinicos")
    .select("*")
    .eq("id", args.attendanceId)
    .eq("caso_clinico_id", args.caseId)
    .eq("aluno_id", args.studentId)
    .maybeSingle();

  if (error) {
    throw new Error("Nao foi possivel localizar o atendimento diario informado.");
  }

  return (data ?? null) as ClinicalAttendanceRow | null;
}

async function findImplicitStudentAttendanceRow(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  caseId: string;
  studentId: string;
  sessionDate: string;
}) {
  const { data, error } = await args.supabase
    .from("atendimentos_clinicos")
    .select("*")
    .eq("caso_clinico_id", args.caseId)
    .eq("aluno_id", args.studentId)
    .eq("data_atendimento", args.sessionDate)
    .eq("status_presenca", "presente");

  if (error) {
    throw new Error("Nao foi possivel consolidar o atendimento diario desta evolucao.");
  }

  const rows = (data ?? []) as ClinicalAttendanceRow[];

  if (rows.length === 1) {
    return {
      row: rows[0],
      ambiguous: false
    };
  }

  return {
    row: null,
    ambiguous: rows.length > 1
  };
}

async function syncAttendanceEvolutionStatus(args: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  attendanceId: string;
  evolutionStatus: ClinicalAttendanceEvolutionStatus;
}) {
  const { error } = await (args.supabase.from("atendimentos_clinicos") as any)
    .update({
      status_evolucao: args.evolutionStatus
    })
    .eq("id", args.attendanceId);

  if (error) {
    throw new Error("Nao foi possivel sincronizar o status da pendencia de evolucao.");
  }
}

function revalidateClinicalEvolutionPaths(caseId: string, recordId?: string) {
  revalidatePath("/clinica-supervisionada");
  revalidatePath("/clinica-supervisionada/atendimentos");
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
  revalidatePath("/secretaria");
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
      "Nao foi possivel localizar o caso clinico vinculado a esta evolucao."
    );
  }

  const [
    { data: enrollmentData, error: enrollmentError },
    { data: semesterData, error: semesterError }
  ] = await Promise.all([
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
  let clinicalScope;

  try {
    clinicalScope = await loadClinicalCaseExceptionalScope(
      supabase,
      parsedData.data.case_id
    );
  } catch (error) {
    return buildEvolutionErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel localizar o caso clinico desta evolucao.",
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
    return buildEvolutionErrorState(
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

  let linkedAttendanceRow: ClinicalAttendanceRow | null = null;

  if (parsedData.data.attendance_id) {
    try {
      linkedAttendanceRow = await loadScopedStudentAttendanceRow({
        supabase,
        attendanceId: parsedData.data.attendance_id,
        caseId: parsedData.data.case_id,
        studentId: currentUser.id
      });
    } catch (error) {
      return buildEvolutionErrorState(
        error instanceof Error
          ? error.message
          : "Nao foi possivel localizar o atendimento diario informado.",
        {},
        submittedFormValues
      );
    }

    if (!linkedAttendanceRow) {
      return buildEvolutionErrorState(
        "O atendimento diário informado não pertence ao aluno autenticado.",
        {},
        submittedFormValues
      );
    }
  } else if (existingRecord?.atendimento_clinico_id) {
    try {
      linkedAttendanceRow = await loadScopedStudentAttendanceRow({
        supabase,
        attendanceId: existingRecord.atendimento_clinico_id,
        caseId: parsedData.data.case_id,
        studentId: currentUser.id
      });
    } catch {
      linkedAttendanceRow = null;
    }
  } else {
    try {
      const implicitAttendance = await findImplicitStudentAttendanceRow({
        supabase,
        caseId: parsedData.data.case_id,
        studentId: currentUser.id,
        sessionDate: parsedData.data.session_date
      });

      if (implicitAttendance.ambiguous) {
        return buildEvolutionErrorState(
          "Há mais de um atendimento diário presente para esta data. Abra a pendência correta na Clínica Supervisionada antes de registrar a evolução.",
          {
            session_date:
              "Use a pendência diária correta para vincular a evolução ao atendimento exato."
          },
          submittedFormValues
        );
      }

      linkedAttendanceRow = implicitAttendance.row;
    } catch (error) {
      return buildEvolutionErrorState(
        error instanceof Error
          ? error.message
          : "Nao foi possivel consolidar o atendimento diario desta evolucao.",
        {},
        submittedFormValues
      );
    }
  }

  if (linkedAttendanceRow) {
    if (linkedAttendanceRow.status_presenca !== "presente") {
      return buildEvolutionErrorState(
        "Este atendimento foi marcado como ausência do paciente e não exige evolução.",
        {
          session_date:
            "Somente atendimentos marcados como paciente presente podem receber evolução."
        },
        submittedFormValues
      );
    }

    if (parsedData.data.session_date !== linkedAttendanceRow.data_atendimento) {
      return buildEvolutionErrorState(
        "A data da evolução deve corresponder à data do atendimento diário vinculado.",
        {
          session_date:
            "Revise a data do atendimento diário antes de salvar a evolução."
        },
        submittedFormValues
      );
    }

    let linkedRecord: ClinicalRecordRow | null = null;

    try {
      linkedRecord = await loadClinicalEvolutionRecordByAttendanceId({
        supabase,
        attendanceId: linkedAttendanceRow.id
      });
    } catch (error) {
      return buildEvolutionErrorState(
        error instanceof Error
          ? error.message
          : "Nao foi possivel validar a evolucao vinculada a este atendimento.",
        {},
        submittedFormValues
      );
    }

    if (linkedRecord && linkedRecord.id !== existingRecord?.id) {
      return buildEvolutionErrorState(
        "Já existe uma evolução vinculada a este atendimento diário.",
        {
          session_date:
            "Abra o registro já existente para este atendimento em vez de criar outro."
        },
        submittedFormValues
      );
    }
  } else {
    const duplicateDateCheck = await hasDuplicateLegacyEvolutionDate({
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
  }

  const nextStatus = parsedData.data.intent;
  const nowIso = new Date().toISOString();
  const normalizedSessionDate =
    linkedAttendanceRow?.data_atendimento ?? parsedData.data.session_date;
  const contentPayload = buildClinicalEvolutionPayload({
    attendance_id: linkedAttendanceRow?.id ?? parsedData.data.attendance_id,
    session_date: normalizedSessionDate,
    progress_and_conduct: parsedData.data.progress_and_conduct,
    observations: parsedData.data.observations
  });
  const nextAttendanceEvolutionStatus =
    resolveClinicalAttendanceEvolutionStatusFromRecordStatus(nextStatus);

  if (existingRecord) {
    const updatePayload: ClinicalRecordUpdate = {
      status: nextStatus,
      conteudo_json: contentPayload,
      enviado_em: nextStatus === "enviado" ? nowIso : null,
      atendimento_clinico_id:
        linkedAttendanceRow?.id ?? existingRecord.atendimento_clinico_id ?? null
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

    const attendanceIdToSync =
      linkedAttendanceRow?.id ?? existingRecord.atendimento_clinico_id ?? null;

    if (attendanceIdToSync) {
      try {
        await syncAttendanceEvolutionStatus({
          supabase,
          attendanceId: attendanceIdToSync,
          evolutionStatus: nextAttendanceEvolutionStatus
        });
      } catch (error) {
        return buildEvolutionErrorState(
          error instanceof Error
            ? error.message
            : "Nao foi possivel sincronizar a pendencia de evolucao.",
          {},
          submittedFormValues
        );
      }
    }

    if (exceptionalReleaseGate.release) {
      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "registros_clinicos",
        recordIds: [existingRecord.id]
      });
    }

    revalidateClinicalEvolutionPaths(parsedData.data.case_id, existingRecord.id);

    return {
      status: "success",
      message: appendExceptionalReleaseNotice(
        nextStatus === "enviado"
          ? "Registro de Evolução e Conduta enviado para supervisão com sucesso."
          : "Registro de Evolução e Conduta salvo como rascunho.",
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
    atendimento_clinico_id: linkedAttendanceRow?.id ?? null,
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

  if (linkedAttendanceRow) {
    try {
      await syncAttendanceEvolutionStatus({
        supabase,
        attendanceId: linkedAttendanceRow.id,
        evolutionStatus: nextAttendanceEvolutionStatus
      });
    } catch (error) {
      return buildEvolutionErrorState(
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar a pendencia de evolucao.",
        {},
        submittedFormValues
      );
    }
  }

  if (exceptionalReleaseGate.release) {
    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "registros_clinicos",
      recordIds: [createdRecordId]
    });
  }

  revalidateClinicalEvolutionPaths(parsedData.data.case_id, createdRecordId);

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      nextStatus === "enviado"
        ? "Registro de Evolução e Conduta enviado para supervisão com sucesso."
        : "Registro de Evolução e Conduta salvo como rascunho.",
      exceptionalReleaseGate.noticeMessage
    ),
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
        : "Nao foi possivel localizar o caso clinico desta evolucao.",
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
        "O semestre deste caso clinico ja esta encerrado e nao permite novas revisoes.",
      {},
      submittedFormValues
    );
  }

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

  const recordRow = recordRowData as ClinicalRecordRow;
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

  if (recordRow.atendimento_clinico_id) {
    try {
      await syncAttendanceEvolutionStatus({
        supabase,
        attendanceId: recordRow.atendimento_clinico_id,
        evolutionStatus: resolveClinicalAttendanceEvolutionStatusFromRecordStatus(
          parsedData.data.status
        )
      });
    } catch (error) {
      return buildReviewErrorState(
        error instanceof Error
          ? error.message
          : "Nao foi possivel sincronizar a pendencia de evolucao.",
        {},
        submittedFormValues
      );
    }
  }

  if (exceptionalReleaseGate.release) {
    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "registros_clinicos",
      recordIds: [parsedData.data.record_id]
    });
  }

  revalidateClinicalEvolutionPaths(
    parsedData.data.case_id,
    parsedData.data.record_id
  );

  return {
    status: "success",
    message: appendExceptionalReleaseNotice(
      "Supervisão do Registro de Evolução e Conduta atualizada com sucesso.",
      exceptionalReleaseGate.noticeMessage
    ),
    fieldErrors: {},
    submittedAt: Date.now()
  };
}
