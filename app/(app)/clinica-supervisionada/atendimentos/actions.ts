"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadScopedOperationalGraph } from "@/lib/auth/data-scope";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getClinicalWeekdayFromDateOnly } from "@/lib/utils/format";
import type { Database } from "@/types/database";
import type {
  ClinicalAttendancePresenceStatus,
  ClinicalRecordStatus
} from "@/types/domain";
import type {
  ClinicalAttendanceActionFormValues,
  ClinicalAttendanceActionState
} from "@/app/(app)/clinica-supervisionada/atendimentos/state";

type ClinicalAttendanceRow =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Row"];
type ClinicalAttendanceInsert =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Insert"];
type ClinicalAttendanceUpdate =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Update"];
type ClinicalCaseRow = Pick<
  Database["public"]["Tables"]["casos_clinicos"]["Row"],
  | "id"
  | "paciente_id"
  | "matricula_turma_id"
  | "professor_id"
  | "semestre_id"
  | "turma_id"
  | "area_estagio_id"
  | "unidade_id"
  | "data_inicio"
  | "data_fim"
  | "dia_semana"
>;
type EnrollmentRow = Pick<
  Database["public"]["Tables"]["matriculas_turma"]["Row"],
  "id" | "aluno_id" | "oferta_curso_unidade_id"
>;
type ClassRow = Pick<
  Database["public"]["Tables"]["turmas"]["Row"],
  "id" | "oferta_curso_unidade_id"
>;
type SemesterRow = Pick<
  Database["public"]["Tables"]["semestres"]["Row"],
  "id" | "oferta_curso_unidade_id"
>;
type OfferRow = Pick<
  Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"],
  "id" | "curso_id" | "instituicao_id" | "unidade_id"
>;
type ClinicalCaseScheduleRow = Pick<
  Database["public"]["Tables"]["casos_clinicos_horarios"]["Row"],
  "id" | "caso_clinico_id" | "dia_semana"
>;
type ClinicalRecordRow = Pick<
  Database["public"]["Tables"]["registros_clinicos"]["Row"],
  "id" | "status"
>;

const clinicalAttendanceActionSchema = z.object({
  attendance_id: z.union([
    z.literal(""),
    z.string().uuid("Atendimento clínico inválido.")
  ]),
  case_id: z.string().uuid("Caso clínico inválido."),
  attendance_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data real do atendimento."),
  schedule_id: z.string().trim(),
  presence_status: z.enum(["presente", "ausente"]),
  administrative_note: z
    .string()
    .trim()
    .max(3000, "A observação administrativa deve ter no máximo 3000 caracteres.")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildAttendanceFormValues(
  formData: FormData
): ClinicalAttendanceActionFormValues {
  const presenceStatus = readStringField(formData, "presence_status");

  return {
    attendance_id: readStringField(formData, "attendance_id"),
    case_id: readStringField(formData, "case_id"),
    attendance_date: readStringField(formData, "attendance_date"),
    schedule_id: readStringField(formData, "schedule_id"),
    presence_status:
      presenceStatus === "presente" || presenceStatus === "ausente"
        ? presenceStatus
        : "",
    administrative_note: readStringField(formData, "administrative_note")
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

function buildAttendanceErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalAttendanceActionFormValues
): ClinicalAttendanceActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function normalizeScheduleId(value: string) {
  const normalizedValue = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    normalizedValue
  )
    ? normalizedValue
    : null;
}

function resolveAttendanceEvolutionStatusFromRecordStatus(
  value: ClinicalRecordStatus
) {
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

function revalidateClinicalAttendancePaths(caseId: string, recordId?: string | null) {
  revalidatePath("/clinica-supervisionada");
  revalidatePath("/clinica-supervisionada/atendimentos");
  revalidatePath(`/clinica-supervisionada/${caseId}`);
  revalidatePath(`/clinica-supervisionada/${caseId}/evolucao`);
  revalidatePath(`/clinica-supervisionada/${caseId}/evolucao/nova`);
  if (recordId) {
    revalidatePath(`/clinica-supervisionada/${caseId}/evolucao/${recordId}`);
  }
  revalidatePath("/aluno");
  revalidatePath("/professor");
  revalidatePath("/secretaria");
}

async function loadScopedClinicalAttendanceContext(args: {
  currentUser: Awaited<ReturnType<typeof requireRole>>;
  caseId: string;
  attendanceDate: string;
  scheduleId: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data: caseData, error: caseError } = await supabase
    .from("casos_clinicos")
    .select(
      "id, paciente_id, matricula_turma_id, professor_id, semestre_id, turma_id, area_estagio_id, unidade_id, data_inicio, data_fim, dia_semana"
    )
    .eq("id", args.caseId)
    .maybeSingle();

  const caseRow = (caseData ?? null) as ClinicalCaseRow | null;

  if (caseError || !caseRow) {
    throw new Error("Não foi possível localizar o caso clínico deste atendimento.");
  }

  if (args.currentUser.role === "professor" && caseRow.professor_id !== args.currentUser.id) {
    throw new Error("Este caso clínico não pertence ao escopo do professor autenticado.");
  }

  if (args.currentUser.role === "secretaria") {
    const scopedGraph = await loadScopedOperationalGraph(args.currentUser, {
      supabase
    });
    const enrollmentIds = new Set(scopedGraph.enrollmentRows.map((row) => row.id));

    if (!enrollmentIds.has(caseRow.matricula_turma_id)) {
      throw new Error("Este caso clínico não pertence ao escopo operacional desta secretaria.");
    }
  }

  if (caseRow.data_inicio && args.attendanceDate < caseRow.data_inicio) {
    throw new Error("A data informada é anterior ao início configurado para este caso clínico.");
  }

  if (caseRow.data_fim && args.attendanceDate > caseRow.data_fim) {
    throw new Error("A data informada é posterior ao encerramento configurado para este caso clínico.");
  }

  const weekday = getClinicalWeekdayFromDateOnly(args.attendanceDate);

  if (!weekday) {
    throw new Error("Informe uma data válida para o atendimento diário.");
  }

  let scheduleRow: ClinicalCaseScheduleRow | null = null;

  if (args.scheduleId) {
    const { data: scheduleData, error: scheduleError } = await supabase
      .from("casos_clinicos_horarios")
      .select("id, caso_clinico_id, dia_semana")
      .eq("id", args.scheduleId)
      .eq("caso_clinico_id", caseRow.id)
      .maybeSingle();

    scheduleRow = (scheduleData ?? null) as ClinicalCaseScheduleRow | null;

    if (scheduleError || !scheduleRow) {
      throw new Error("Não foi possível localizar o horário recorrente deste caso clínico.");
    }

    if (scheduleRow.dia_semana !== weekday) {
      throw new Error(
        "A data informada não corresponde ao dia semanal configurado para este horário de atendimento."
      );
    }
  } else if (caseRow.dia_semana !== weekday) {
    throw new Error(
      "A data informada não corresponde ao dia semanal configurado para este caso clínico."
    );
  }

  const [
    { data: enrollmentData, error: enrollmentError },
    { data: classData, error: classError },
    { data: semesterData, error: semesterError }
  ] = await Promise.all([
    supabase
      .from("matriculas_turma")
      .select("id, aluno_id, oferta_curso_unidade_id")
      .eq("id", caseRow.matricula_turma_id)
      .maybeSingle(),
    supabase
      .from("turmas")
      .select("id, oferta_curso_unidade_id")
      .eq("id", caseRow.turma_id)
      .maybeSingle(),
    supabase
      .from("semestres")
      .select("id, oferta_curso_unidade_id")
      .eq("id", caseRow.semestre_id)
      .maybeSingle()
  ]);

  const enrollment = (enrollmentData ?? null) as EnrollmentRow | null;
  const classRow = (classData ?? null) as ClassRow | null;
  const semesterRow = (semesterData ?? null) as SemesterRow | null;

  if (
    enrollmentError ||
    !enrollment ||
    classError ||
    !classRow ||
    semesterError ||
    !semesterRow
  ) {
    throw new Error("Não foi possível consolidar o contexto acadêmico do caso clínico.");
  }

  const offerId =
    enrollment.oferta_curso_unidade_id ??
    classRow.oferta_curso_unidade_id ??
    semesterRow.oferta_curso_unidade_id ??
    null;

  let offerRow: OfferRow | null = null;

  if (offerId) {
    const { data: offerData, error: offerError } = await supabase
      .from("ofertas_curso_unidade")
      .select("id, curso_id, instituicao_id, unidade_id")
      .eq("id", offerId)
      .maybeSingle();

    offerRow = (offerData ?? null) as OfferRow | null;

    if (offerError || !offerRow) {
      throw new Error("Não foi possível consolidar a oferta vinculada a este caso clínico.");
    }
  }

  return {
    supabase,
    caseRow,
    enrollment,
    offerRow,
    scheduleRow
  };
}

async function loadExistingClinicalAttendance(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  attendanceId?: string;
  caseId: string;
  attendanceDate: string;
  scheduleId: string | null;
}) {
  if (args.attendanceId) {
    const { data, error } = await args.supabase
      .from("atendimentos_clinicos")
      .select("*")
      .eq("id", args.attendanceId)
      .eq("caso_clinico_id", args.caseId)
      .maybeSingle();

    if (error) {
      throw new Error("Não foi possível localizar o atendimento diário selecionado.");
    }

    if (!data) {
      throw new Error("O atendimento diário selecionado não está mais disponível para atualização.");
    }

    return (data ?? null) as ClinicalAttendanceRow | null;
  }

  let query = args.supabase
    .from("atendimentos_clinicos")
    .select("*")
    .eq("caso_clinico_id", args.caseId)
    .eq("data_atendimento", args.attendanceDate);

  query = args.scheduleId
    ? query.eq("caso_clinico_horario_id", args.scheduleId)
    : query.is("caso_clinico_horario_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error("Não foi possível localizar o atendimento diário deste caso.");
  }

  return (data ?? null) as ClinicalAttendanceRow | null;
}

async function loadLinkedEvolutionForAttendance(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>;
  attendanceId: string;
}) {
  const { data, error } = await args.supabase
    .from("registros_clinicos")
    .select("id, status")
    .eq("tipo", "evolucao")
    .eq("atendimento_clinico_id", args.attendanceId)
    .maybeSingle();

  if (error) {
    throw new Error("Não foi possível localizar a evolução vinculada a este atendimento.");
  }

  return (data ?? null) as ClinicalRecordRow | null;
}

export async function saveClinicalAttendanceStatusAction(
  _previousState: ClinicalAttendanceActionState,
  formData: FormData
): Promise<ClinicalAttendanceActionState> {
  const currentUser = await requireRole(["professor", "secretaria"]);
  const submittedFormValues = buildAttendanceFormValues(formData);
  const parsedData = clinicalAttendanceActionSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildAttendanceErrorState(
      "Revise os campos do atendimento diário.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const normalizedScheduleId = normalizeScheduleId(parsedData.data.schedule_id);
  let scopedContext;

  try {
    scopedContext = await loadScopedClinicalAttendanceContext({
      currentUser,
      caseId: parsedData.data.case_id,
      attendanceDate: parsedData.data.attendance_date,
      scheduleId: normalizedScheduleId
    });
  } catch (error) {
    return buildAttendanceErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível validar o contexto deste atendimento diário.",
      {},
      submittedFormValues
    );
  }

  let existingAttendance: ClinicalAttendanceRow | null = null;

  try {
    existingAttendance = await loadExistingClinicalAttendance({
      supabase: scopedContext.supabase,
      attendanceId: parsedData.data.attendance_id || undefined,
      caseId: parsedData.data.case_id,
      attendanceDate: parsedData.data.attendance_date,
      scheduleId: normalizedScheduleId
    });
  } catch (error) {
    return buildAttendanceErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível localizar o atendimento diário selecionado.",
      {},
      submittedFormValues
    );
  }

  let linkedEvolution: ClinicalRecordRow | null = null;

  if (existingAttendance?.id) {
    try {
      linkedEvolution = await loadLinkedEvolutionForAttendance({
        supabase: scopedContext.supabase,
        attendanceId: existingAttendance.id
      });
    } catch (error) {
      return buildAttendanceErrorState(
        error instanceof Error
          ? error.message
          : "Não foi possível verificar a evolução vinculada a este atendimento.",
        {},
        submittedFormValues
      );
    }
  }

  if (parsedData.data.presence_status === "ausente" && linkedEvolution) {
    return buildAttendanceErrorState(
      "Já existe uma evolução vinculada a este atendimento diário. Revise a evolução antes de marcar o paciente como ausente.",
      {
        presence_status:
          "Atendimentos com evolução vinculada não podem ser dispensados como ausência."
      },
      submittedFormValues
    );
  }

  const nextEvolutionStatus =
    parsedData.data.presence_status === "presente"
      ? linkedEvolution
        ? resolveAttendanceEvolutionStatusFromRecordStatus(linkedEvolution.status)
        : "pendente"
      : "dispensada";

  const persistencePayload = {
    caso_clinico_id: scopedContext.caseRow.id,
    paciente_id: scopedContext.caseRow.paciente_id,
    data_atendimento: parsedData.data.attendance_date,
    caso_clinico_horario_id: normalizedScheduleId,
    matricula_turma_id: scopedContext.caseRow.matricula_turma_id,
    turma_id: scopedContext.caseRow.turma_id,
    semestre_id: scopedContext.caseRow.semestre_id,
    area_estagio_id: scopedContext.caseRow.area_estagio_id,
    unidade_id:
      scopedContext.offerRow?.unidade_id ?? scopedContext.caseRow.unidade_id ?? null,
    oferta_curso_unidade_id: scopedContext.offerRow?.id ?? null,
    curso_id: scopedContext.offerRow?.curso_id ?? null,
    instituicao_id: scopedContext.offerRow?.instituicao_id ?? null,
    professor_id: scopedContext.caseRow.professor_id,
    aluno_id: scopedContext.enrollment.aluno_id,
    status_presenca: parsedData.data.presence_status,
    status_evolucao: nextEvolutionStatus,
    observacao_administrativa: parsedData.data.administrative_note || null,
    registrado_por: currentUser.id,
    registrado_em: new Date().toISOString()
  } satisfies Omit<
    ClinicalAttendanceInsert,
    "id" | "created_at" | "updated_at"
  >;

  let savedAttendanceId = existingAttendance?.id ?? "";

  if (existingAttendance) {
    const updatePayload: ClinicalAttendanceUpdate = {
      ...persistencePayload
    };

    const { error: updateError } = await (scopedContext.supabase.from(
      "atendimentos_clinicos"
    ) as any)
      .update(updatePayload)
      .eq("id", existingAttendance.id);

    if (updateError) {
      return buildAttendanceErrorState(
        updateError.message ??
          "Não foi possível atualizar o atendimento diário selecionado.",
        {},
        submittedFormValues
      );
    }
  } else {
    const insertPayload: ClinicalAttendanceInsert = {
      id: crypto.randomUUID(),
      ...persistencePayload
    };

    const { error: insertError } = await (scopedContext.supabase.from(
      "atendimentos_clinicos"
    ) as any).insert(insertPayload);

    if (insertError) {
      return buildAttendanceErrorState(
        insertError.message ??
          "Não foi possível criar o atendimento diário selecionado.",
        {},
        submittedFormValues
      );
    }

    savedAttendanceId = insertPayload.id ?? "";
  }

  revalidateClinicalAttendancePaths(
    parsedData.data.case_id,
    linkedEvolution?.id ?? null
  );

  return {
    status: "success",
    message:
      parsedData.data.presence_status === "presente"
        ? linkedEvolution
          ? "Paciente marcado como presente. O status da evolução vinculada foi preservado."
          : "Paciente marcado como presente. A evolução ficou pendente para o aluno."
        : "Paciente marcado como ausente. A evolução foi dispensada para esta data.",
    fieldErrors: {},
    savedAttendanceId,
    savedPresenceStatus: parsedData.data.presence_status as ClinicalAttendancePresenceStatus,
    savedEvolutionStatus: nextEvolutionStatus,
    submittedAt: Date.now()
  };
}
