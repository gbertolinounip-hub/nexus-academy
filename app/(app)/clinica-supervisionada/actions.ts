"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachExceptionalReleaseToAuditRecords,
  resolveExceptionalReleaseGate
} from "@/services/exceptional-releases";
import type { Database } from "@/types/database";
import type {
  ClinicalCaseActionState,
  ClinicalCaseFormValues,
  ClinicalCaseScheduleFormValue
} from "@/app/(app)/clinica-supervisionada/state";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type ClinicalPatientRow = Database["public"]["Tables"]["pacientes_clinica"]["Row"];
type ClinicalPatientInsert =
  Database["public"]["Tables"]["pacientes_clinica"]["Insert"];
type ClinicalPatientUpdate =
  Database["public"]["Tables"]["pacientes_clinica"]["Update"];
type ClinicalCaseRow = Database["public"]["Tables"]["casos_clinicos"]["Row"];
type ClinicalCaseInsert = Database["public"]["Tables"]["casos_clinicos"]["Insert"];
type ClinicalCaseUpdate = Database["public"]["Tables"]["casos_clinicos"]["Update"];
type ClinicalCaseScheduleInsert =
  Database["public"]["Tables"]["casos_clinicos_horarios"]["Insert"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const CLINICAL_WEEKDAYS = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado"
] as const;

const CLINICAL_WEEKDAY_ORDER = new Map(
  CLINICAL_WEEKDAYS.map((weekday, index) => [weekday, index])
);

const clinicalCaseScheduleSchema = z.object({
  row_id: z.string().trim().min(1).max(80),
  weekday: z.enum(CLINICAL_WEEKDAYS),
  appointment_time: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Informe o horario no formato HH:MM.")
});

const clinicalCaseSchema = z.object({
  case_id: z.string().trim(),
  patient_id: z.string().trim(),
  patient_identifier: z
    .string()
    .trim()
    .min(2, "Informe o identificador do paciente.")
    .max(40, "O identificador deve ter no maximo 40 caracteres."),
  patient_name: z
    .string()
    .trim()
    .min(3, "Informe o nome do paciente.")
    .max(160, "O nome do paciente deve ter no maximo 160 caracteres."),
  patient_birth_date: z.string().trim(),
  patient_cpf: z.string().trim().max(20, "O CPF deve ter no maximo 20 caracteres."),
  patient_contact: z
    .string()
    .trim()
    .max(160, "O contato deve ter no maximo 160 caracteres."),
  patient_companion: z
    .string()
    .trim()
    .max(160, "O acompanhante deve ter no maximo 160 caracteres."),
  enrollment_id: z.string().uuid("Selecione um estagiario valido."),
  schedules: z
    .array(clinicalCaseScheduleSchema)
    .min(1, "Adicione ao menos um horario fixo para o caso clinico.")
    .max(12, "Reduza a quantidade de horarios semanais deste caso clinico."),
  status: z.enum(["atribuido", "ativo", "encerrado", "alta"])
});

interface ClinicalAssignmentEnrollmentContext {
  enrollment: EnrollmentRow;
  semester: SemesterRow;
  classGroup: ClassRow;
  area: AreaRow;
  student: StudentRow;
  studentUser: UserRow;
  professorId: string;
  professorUser: UserRow;
}

interface PersistableClinicalSchedule {
  index: number;
  rowId: string;
  weekday: ClinicalCaseScheduleFormValue["weekday"];
  appointmentTime: string;
}

function buildErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ClinicalCaseFormValues
): ClinicalCaseActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
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

function parseScheduleRows(payload: string): ClinicalCaseScheduleFormValue[] {
  if (!payload) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(payload);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.map((schedule, index) => ({
      row_id:
        schedule && typeof schedule === "object" && typeof schedule.row_id === "string"
          ? schedule.row_id
          : `clinical-schedule-${index + 1}`,
      weekday:
        schedule &&
        typeof schedule === "object" &&
        typeof schedule.weekday === "string" &&
        CLINICAL_WEEKDAYS.includes(
          schedule.weekday as (typeof CLINICAL_WEEKDAYS)[number]
        )
          ? (schedule.weekday as ClinicalCaseScheduleFormValue["weekday"])
          : "segunda",
      appointment_time:
        schedule &&
        typeof schedule === "object" &&
        typeof schedule.appointment_time === "string"
          ? schedule.appointment_time.trim()
          : ""
    }));
  } catch {
    return [];
  }
}

function buildFormValues(formData: FormData): ClinicalCaseFormValues {
  const status = readStringField(formData, "status");
  const schedules = parseScheduleRows(readStringField(formData, "schedules_payload"));

  return {
    case_id: readStringField(formData, "case_id"),
    patient_id: readStringField(formData, "patient_id"),
    patient_identifier: readStringField(formData, "patient_identifier"),
    patient_name: readStringField(formData, "patient_name"),
    patient_birth_date: readStringField(formData, "patient_birth_date"),
    patient_cpf: readStringField(formData, "patient_cpf"),
    patient_contact: readStringField(formData, "patient_contact"),
    patient_companion: readStringField(formData, "patient_companion"),
    enrollment_id: readStringField(formData, "enrollment_id"),
    schedules,
    status:
      status === "ativo" || status === "encerrado" || status === "alta"
        ? status
        : "atribuido"
  };
}

function collectSchedulesToPersist(
  schedules: ClinicalCaseScheduleFormValue[]
): PersistableClinicalSchedule[] {
  return schedules
    .map((schedule, index) => ({
      index,
      rowId: schedule.row_id,
      weekday: schedule.weekday,
      appointmentTime: schedule.appointment_time.trim()
    }))
    .sort((left, right) => {
      const weekdayDiff =
        (CLINICAL_WEEKDAY_ORDER.get(left.weekday) ?? 0) -
        (CLINICAL_WEEKDAY_ORDER.get(right.weekday) ?? 0);

      if (weekdayDiff !== 0) {
        return weekdayDiff;
      }

      return left.appointmentTime.localeCompare(right.appointmentTime, "pt-BR");
    });
}

function validateScheduleStructure(
  schedules: PersistableClinicalSchedule[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const firstIndexByFingerprint = new Map<string, number>();

  for (const schedule of schedules) {
    const fingerprint = `${schedule.weekday}:${schedule.appointmentTime}`;

    if (firstIndexByFingerprint.has(fingerprint)) {
      const firstIndex = firstIndexByFingerprint.get(fingerprint) ?? schedule.index;
      fieldErrors[`schedules.${firstIndex}.weekday`] =
        "Nao repita o mesmo dia e horario para este caso clinico.";
      fieldErrors[`schedules.${schedule.index}.weekday`] =
        "Este dia e horario ja foi informado em outro atendimento.";
    } else {
      firstIndexByFingerprint.set(fingerprint, schedule.index);
    }
  }

  return fieldErrors;
}

function getRequiredClinicalUnitId(unitId: string | null | undefined) {
  if (!unitId) {
    throw new Error(
      "O usuario autenticado precisa estar vinculado a uma unidade para operar a Clinica Supervisionada."
    );
  }

  return unitId;
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function selectAssignableProfessorLink(professorLinks: ProfessorLinkRow[]) {
  if (!professorLinks.length) {
    return {
      link: null,
      error:
        "A matricula selecionada ainda nao possui um supervisor ativo definido para receber novo caso clinico."
    };
  }

  const principalLinks = professorLinks.filter((link) => link.responsavel_principal);

  if (principalLinks.length === 1) {
    return { link: principalLinks[0], error: null };
  }

  if (principalLinks.length > 1) {
    return {
      link: null,
      error:
        "A matricula selecionada possui mais de um supervisor principal ativo. Revise os vinculos antes de abrir um novo caso."
    };
  }

  if (professorLinks.length === 1) {
    return { link: professorLinks[0], error: null };
  }

  return {
    link: null,
    error:
      "A matricula selecionada possui mais de um supervisor ativo. Defina um responsavel principal antes de abrir um novo caso."
  };
}

async function loadClinicalAssignmentEnrollmentContext(input: {
  supabase: SupabaseServerClient;
  currentUser: Awaited<ReturnType<typeof requireRole>>;
  unitId: string;
  enrollmentId: string;
}) {
  const today = getTodayInSaoPaulo();
  const enrollmentResult = await input.supabase
    .from("matriculas_turma")
    .select("*")
    .eq("id", input.enrollmentId)
    .maybeSingle();
  const enrollment = (enrollmentResult.data ?? null) as EnrollmentRow | null;

  if (enrollmentResult.error || !enrollment || enrollment.status !== "ativa") {
    return {
      context: null,
      error:
        "A matricula selecionada nao esta ativa para receber atribuicao clinica neste momento."
    };
  }

  let professorId = input.currentUser.id;

  if (input.currentUser.role === "professor") {
    const { data: professorLinkData, error: linkError } = await input.supabase
      .from("vinculos_professor_aluno")
      .select("*")
      .eq("professor_id", input.currentUser.id)
      .eq("matricula_turma_id", input.enrollmentId)
      .eq("ativo", true)
      .maybeSingle();

    const professorLink = (professorLinkData ?? null) as ProfessorLinkRow | null;

    if (
      linkError ||
      !professorLink ||
      (professorLink.data_fim && professorLink.data_fim < today)
    ) {
      return {
        context: null,
        error:
          "O estagiario selecionado nao esta mais vinculado ativamente a supervisao deste professor."
      };
    }
  } else {
    const { data: professorLinksData, error: linksError } = await input.supabase
      .from("vinculos_professor_aluno")
      .select("*")
      .eq("matricula_turma_id", input.enrollmentId)
      .eq("ativo", true);

    if (linksError) {
      return {
        context: null,
        error:
          "Nao foi possivel identificar o supervisor responsavel pela matricula selecionada."
      };
    }

    const activeProfessorLinks = ((professorLinksData ?? []) as ProfessorLinkRow[]).filter(
      (link) => !link.data_fim || link.data_fim >= today
    );
    const professorLinkSelection = selectAssignableProfessorLink(activeProfessorLinks);

    if (!professorLinkSelection.link) {
      return {
        context: null,
        error: professorLinkSelection.error
      };
    }

    professorId = professorLinkSelection.link.professor_id;
  }

  const [classResult, studentResult, studentUserResult] = await Promise.all([
    input.supabase.from("turmas").select("*").eq("id", enrollment.turma_id).maybeSingle(),
    input.supabase
      .from("alunos")
      .select("*")
      .eq("usuario_id", enrollment.aluno_id)
      .maybeSingle(),
    input.supabase
      .from("usuarios")
      .select("*")
      .eq("id", enrollment.aluno_id)
      .eq("unidade_id", input.unitId)
      .eq("ativo", true)
      .maybeSingle()
  ]);

  const classGroup = (classResult.data ?? null) as ClassRow | null;
  const student = (studentResult.data ?? null) as StudentRow | null;
  const studentUser = (studentUserResult.data ?? null) as UserRow | null;

  if (
    classResult.error ||
    !classGroup ||
    studentResult.error ||
    !student ||
    studentUserResult.error ||
    !studentUser
  ) {
    return {
      context: null,
      error:
        "Nao foi possivel consolidar os dados do estagiario selecionado para esta atribuicao clinica."
    };
  }

  const { data: semesterData, error: semesterError } = await input.supabase
    .from("semestres")
    .select("*")
    .eq("id", classGroup.semestre_id)
    .eq("unidade_id", input.unitId)
    .maybeSingle();

  const semester = (semesterData ?? null) as SemesterRow | null;

  if (semesterError || !semester) {
    return {
      context: null,
      error:
        "O semestre vinculado ao estagiario nao pode ser identificado dentro da unidade atual."
    };
  }

  if (!classGroup.area_estagio_id) {
    return {
      context: null,
      error:
        "A turma selecionada ainda nao possui area de estagio configurada para a Clinica Supervisionada."
    };
  }

  const { data: areaData, error: areaError } = await input.supabase
    .from("areas_estagio")
    .select("*")
    .eq("id", classGroup.area_estagio_id)
    .maybeSingle();

  const area = (areaData ?? null) as AreaRow | null;

  if (areaError || !area) {
    return {
      context: null,
      error:
        "A area de estagio do estagiario nao pode ser localizada para esta atribuicao clinica."
    };
  }

  const { data: professorUserData, error: professorUserError } = await input.supabase
    .from("usuarios")
    .select("*")
    .eq("id", professorId)
    .eq("unidade_id", input.unitId)
    .eq("ativo", true)
    .maybeSingle();

  const professorUser = (professorUserData ?? null) as UserRow | null;

  if (professorUserError || !professorUser) {
    return {
      context: null,
      error:
        "Nao foi possivel consolidar o supervisor responsavel pela matricula selecionada."
    };
  }

  return {
    context: {
      enrollment,
      semester,
      classGroup,
      area,
      student,
      studentUser,
      professorId,
      professorUser
    } satisfies ClinicalAssignmentEnrollmentContext,
    error: null
  };
}

async function loadSelectedPatient(input: {
  supabase: SupabaseServerClient;
  unitId: string;
  patientId: string;
}) {
  const { data: patientData, error: patientError } = await input.supabase
    .from("pacientes_clinica")
    .select("*")
    .eq("id", input.patientId)
    .eq("unidade_id", input.unitId)
    .maybeSingle();

  if (patientError) {
    throw new Error("Nao foi possivel validar o cadastro-base selecionado.");
  }

  return (patientData ?? null) as ClinicalPatientRow | null;
}

async function findExistingPatient(input: {
  supabase: SupabaseServerClient;
  unitId: string;
  identifier: string;
  cpf: string | null;
}) {
  const byIdentifierResult = await input.supabase
    .from("pacientes_clinica")
    .select("*")
    .eq("unidade_id", input.unitId)
    .eq("identificador", input.identifier)
    .maybeSingle();

  const patientByIdentifier = (byIdentifierResult.data ?? null) as ClinicalPatientRow | null;

  if (byIdentifierResult.error) {
    throw new Error("Nao foi possivel validar o identificador do paciente.");
  }

  if (patientByIdentifier) {
    return patientByIdentifier;
  }

  if (!input.cpf) {
    return null;
  }

  const byCpfResult = await input.supabase
    .from("pacientes_clinica")
    .select("*")
    .eq("unidade_id", input.unitId)
    .eq("cpf", input.cpf)
    .maybeSingle();

  if (byCpfResult.error) {
    throw new Error("Nao foi possivel validar o CPF do paciente.");
  }

  return (byCpfResult.data ?? null) as ClinicalPatientRow | null;
}

function buildNoticePath(path: string, type: "success" | "error", message: string) {
  const searchParams = new URLSearchParams({
    notice_type: type,
    notice: message
  });

  return `${path}?${searchParams.toString()}`;
}

function appendExceptionalReleaseNotice(message: string, noticeMessage?: string | null) {
  return noticeMessage ? `${message} ${noticeMessage}` : message;
}

function buildPatientUniquenessErrorState(
  submittedFormValues: ClinicalCaseFormValues,
  error: { code?: string | null; message?: string | null; details?: string | null }
) {
  const fingerprint = `${error.message ?? ""} ${error.details ?? ""}`;

  if (
    error.code === "23505" &&
    fingerprint.includes("idx_pacientes_clinica_unidade_identificador_uk")
  ) {
    return buildErrorState(
      "Ja existe um paciente desta unidade com o identificador informado.",
      {
        patient_identifier:
          "Use outro identificador ou reutilize o cadastro-base ja existente deste paciente."
      },
      submittedFormValues
    );
  }

  if (
    error.code === "23505" &&
    fingerprint.includes("idx_pacientes_clinica_unidade_cpf_uk")
  ) {
    return buildErrorState(
      "Ja existe um paciente desta unidade com o CPF informado.",
      {
        patient_cpf:
          "Use outro CPF ou reutilize o cadastro-base ja existente deste paciente."
      },
      submittedFormValues
    );
  }

  return null;
}

async function replaceClinicalCaseSchedules(input: {
  supabase: SupabaseServerClient;
  caseId: string;
  schedules: PersistableClinicalSchedule[];
  formValues: ClinicalCaseFormValues;
}) {
  const { error: deleteError } = await input.supabase
    .from("casos_clinicos_horarios")
    .delete()
    .eq("caso_clinico_id", input.caseId);

  if (deleteError) {
    return buildErrorState(
      deleteError.message ??
        "Nao foi possivel limpar os horarios anteriores do caso clinico.",
      {},
      input.formValues
    );
  }

  const schedulePayload: ClinicalCaseScheduleInsert[] = input.schedules.map((schedule) => ({
    caso_clinico_id: input.caseId,
    dia_semana: schedule.weekday,
    horario_atendimento: `${schedule.appointmentTime}:00`
  }));

  const { error: insertError } = await (input.supabase
    .from("casos_clinicos_horarios") as any)
    .insert(schedulePayload);

  if (insertError) {
    return buildErrorState(
      insertError.message ??
        "Nao foi possivel salvar os horarios semanais do caso clinico.",
      {},
      input.formValues
    );
  }

  return null;
}

export async function createOrUpdateClinicalCaseAction(
  _previousState: ClinicalCaseActionState,
  formData: FormData
): Promise<ClinicalCaseActionState> {
  const currentUser = await requireRole(["professor", "coordenador", "secretaria"]);
  const currentUnitId = getRequiredClinicalUnitId(currentUser.unitId);
  const submittedFormValues = buildFormValues(formData);
  const parsedData = clinicalCaseSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos obrigatorios do paciente e da atribuicao clinica.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const schedulesToPersist = collectSchedulesToPersist(parsedData.data.schedules);
  const scheduleFieldErrors = validateScheduleStructure(schedulesToPersist);

  if (Object.keys(scheduleFieldErrors).length > 0) {
    return buildErrorState(
      "Revise os horarios semanais informados para este caso clinico.",
      scheduleFieldErrors,
      submittedFormValues
    );
  }

  const primarySchedule = schedulesToPersist[0];

  if (!primarySchedule) {
    return buildErrorState(
      "Adicione ao menos um horario fixo para este caso clinico.",
      { schedules: "Adicione ao menos um horario fixo para o caso clinico." },
      submittedFormValues
    );
  }

  const authSupabase = await createSupabaseServerClient();
  const dataSupabase =
    currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : authSupabase;
  const { data: authData, error: authError } = await authSupabase.auth.getUser();

  if (authError || authData.user?.id !== currentUser.id) {
    return buildErrorState(
      "Nao foi possivel confirmar a sessao autenticada para salvar o caso clinico.",
      {},
      submittedFormValues
    );
  }

  const isEditing = Boolean(parsedData.data.case_id);
  const selectedPatientId = parsedData.data.patient_id || null;
  const normalizedCpf = parsedData.data.patient_cpf || null;
  const normalizedBirthDate = parsedData.data.patient_birth_date || null;
  const normalizedContact = parsedData.data.patient_contact || null;
  const normalizedCompanion = parsedData.data.patient_companion || null;
  const today = getTodayInSaoPaulo();

  if (isEditing && currentUser.role !== "professor") {
    return buildErrorState(
      "A edicao operacional do caso clinico permanece disponivel apenas para o professor responsavel nesta fase.",
      {},
      submittedFormValues
    );
  }

  const enrollmentContextResult = await loadClinicalAssignmentEnrollmentContext({
    supabase: dataSupabase as SupabaseServerClient,
    currentUser,
    unitId: currentUnitId,
    enrollmentId: parsedData.data.enrollment_id
  });

  if (!enrollmentContextResult.context) {
    return buildErrorState(
      enrollmentContextResult.error ??
        "Nao foi possivel validar o estagiario selecionado para a Clinica Supervisionada.",
      { enrollment_id: "Selecione um estagiario valido da sua supervisao." },
      submittedFormValues
    );
  }

  const exceptionalReleaseGate = await resolveExceptionalReleaseGate(
    {
      type: "clinica_supervisionada",
      semesterId: enrollmentContextResult.context.semester.id,
      classId: enrollmentContextResult.context.classGroup.id,
      studentId: enrollmentContextResult.context.studentUser.id,
      unitId: currentUnitId,
      authorizedUserId: currentUser.id
    },
    {
      currentUser,
      semesterStatus: enrollmentContextResult.context.semester.status,
      blockedMessage:
        "O semestre vinculado a esta operacao clinica ja esta encerrado. Esta edicao so pode ser realizada com liberacao excepcional ativa."
    }
  );

  if (!exceptionalReleaseGate.allowed) {
    return buildErrorState(
      exceptionalReleaseGate.blockedMessage ??
        "O semestre vinculado a esta operacao clinica ja esta encerrado e nao permite novos ajustes.",
      {},
      submittedFormValues
    );
  }

  let currentCase: ClinicalCaseRow | null = null;
  let previousScheduleIds: string[] = [];

  if (isEditing) {
    const { data: currentCaseData, error: currentCaseError } = await dataSupabase
      .from("casos_clinicos")
      .select("*")
      .eq("id", parsedData.data.case_id)
      .eq("professor_id", currentUser.id)
      .maybeSingle();

    currentCase = (currentCaseData ?? null) as ClinicalCaseRow | null;

    if (currentCaseError || !currentCase) {
      return buildErrorState(
        "Nao foi possivel localizar o caso clinico que sera editado.",
        {},
        submittedFormValues
      );
    }

    if (exceptionalReleaseGate.release) {
      const { data: scheduleRowsData } = await dataSupabase
        .from("casos_clinicos_horarios")
        .select("id")
        .eq("caso_clinico_id", currentCase.id);

      previousScheduleIds = (
        ((scheduleRowsData ?? []) as Array<
          Pick<Database["public"]["Tables"]["casos_clinicos_horarios"]["Row"], "id">
        >)
      ).map((schedule) => schedule.id);
    }
  }

  let existingPatient: ClinicalPatientRow | null;
  let selectedPatient: ClinicalPatientRow | null = null;

  try {
    if (selectedPatientId) {
      selectedPatient = await loadSelectedPatient({
        supabase: dataSupabase as SupabaseServerClient,
        unitId: currentUnitId,
        patientId: selectedPatientId
      });

      if (!selectedPatient) {
        return buildErrorState(
          "Nao foi possivel localizar o cadastro-base do paciente selecionado para reaproveitamento.",
          { patient_identifier: "Selecione novamente um paciente valido da base institucional." },
          submittedFormValues
        );
      }
    }

    existingPatient = await findExistingPatient({
      supabase: dataSupabase as SupabaseServerClient,
      unitId: currentUnitId,
      identifier: parsedData.data.patient_identifier,
      cpf: normalizedCpf
    });
  } catch (error) {
    return buildErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel validar o cadastro-base do paciente.",
      {},
      submittedFormValues
    );
  }

  if (
    selectedPatient &&
    existingPatient &&
    existingPatient.id !== selectedPatient.id
  ) {
    return buildErrorState(
      "Ja existe outro paciente desta unidade com o identificador ou CPF informado.",
      {
        patient_identifier:
          "Use o cadastro-base ja existente deste paciente ou revise o identificador e o CPF informados."
      },
      submittedFormValues
    );
  }

  if (
    isEditing &&
    currentCase &&
    existingPatient &&
    existingPatient.id !== (selectedPatient?.id ?? currentCase.paciente_id)
  ) {
    return buildErrorState(
      "Ja existe outro paciente desta unidade com o identificador ou CPF informado.",
      {
        patient_identifier:
          "Use o cadastro-base ja existente deste paciente ou revise o identificador informado."
      },
      submittedFormValues
    );
  }

  let patientId =
    selectedPatient?.id ?? currentCase?.paciente_id ?? existingPatient?.id ?? null;
  const patientPayload: ClinicalPatientInsert = {
    unidade_id: currentUnitId,
    identificador: parsedData.data.patient_identifier,
    nome: parsedData.data.patient_name,
    data_nascimento: normalizedBirthDate,
    cpf: normalizedCpf,
    contato: normalizedContact,
    acompanhante: normalizedCompanion,
    ativo: true
  };

  if (patientId) {
    const patientUpdatePayload: ClinicalPatientUpdate = { ...patientPayload };
    const { error: patientUpdateError } = await (dataSupabase
      .from("pacientes_clinica") as any)
      .update(patientUpdatePayload)
      .eq("id", patientId);

    if (patientUpdateError) {
      const uniquenessErrorState = buildPatientUniquenessErrorState(
        submittedFormValues,
        patientUpdateError
      );

      if (uniquenessErrorState) {
        return uniquenessErrorState;
      }

      return buildErrorState(
        patientUpdateError.message,
        {},
        submittedFormValues
      );
    }
  } else {
    const generatedPatientId = crypto.randomUUID();
    const { error: patientInsertError } = await (dataSupabase
      .from("pacientes_clinica") as any)
      .insert({
        ...patientPayload,
        id: generatedPatientId
      });

    if (patientInsertError) {
      const uniquenessErrorState = buildPatientUniquenessErrorState(
        submittedFormValues,
        patientInsertError
      );

      if (uniquenessErrorState) {
        return uniquenessErrorState;
      }

      return buildErrorState(
        patientInsertError.message ??
          "Nao foi possivel criar o cadastro-base do paciente.",
        {},
        submittedFormValues
      );
    }

    patientId = generatedPatientId;
  }

  const activeFlag =
    parsedData.data.status === "atribuido" || parsedData.data.status === "ativo";
  const casePayload: ClinicalCaseInsert = {
    unidade_id: currentUnitId,
    paciente_id: patientId,
    matricula_turma_id: parsedData.data.enrollment_id,
    professor_id: enrollmentContextResult.context.professorId,
    semestre_id: enrollmentContextResult.context.semester.id,
    turma_id: enrollmentContextResult.context.classGroup.id,
    area_estagio_id: enrollmentContextResult.context.area.id,
    dia_semana: primarySchedule.weekday,
    horario_atendimento: `${primarySchedule.appointmentTime}:00`,
    status: parsedData.data.status,
    ativo: activeFlag,
    data_inicio: currentCase?.data_inicio ?? today,
    data_fim: activeFlag ? null : currentCase?.data_fim ?? today
  };

  if (!isEditing) {
    const { data: duplicatedCaseData, error: duplicatedCaseError } = await dataSupabase
      .from("casos_clinicos")
      .select("id")
      .eq("paciente_id", patientId)
      .eq("matricula_turma_id", parsedData.data.enrollment_id)
      .eq("semestre_id", enrollmentContextResult.context.semester.id)
      .eq("ativo", true)
      .maybeSingle();

    if (duplicatedCaseError) {
      return buildErrorState(
        "Nao foi possivel validar se este paciente ja possui caso ativo com o estagiario selecionado.",
        {},
        submittedFormValues
      );
    }

    if (duplicatedCaseData) {
      return buildErrorState(
        "Este paciente ja possui um caso clinico ativo com o estagiario selecionado neste semestre.",
        { enrollment_id: "Escolha outro estagiario ou edite o caso ja existente." },
        submittedFormValues
      );
    }
  }

  if (isEditing && currentCase) {
    const caseUpdatePayload: ClinicalCaseUpdate = { ...casePayload };
    const { error: caseUpdateError } = await (dataSupabase
      .from("casos_clinicos") as any)
      .update(caseUpdatePayload)
      .eq("id", currentCase.id)
      .eq("professor_id", currentUser.id);

    if (caseUpdateError) {
      return buildErrorState(
        caseUpdateError.message,
        {},
        submittedFormValues
      );
    }

    const schedulePersistState = await replaceClinicalCaseSchedules({
      supabase: dataSupabase as SupabaseServerClient,
      caseId: currentCase.id,
      schedules: schedulesToPersist,
      formValues: submittedFormValues
    });

    if (schedulePersistState) {
      return schedulePersistState;
    }

    if (exceptionalReleaseGate.release) {
      const { data: currentScheduleRowsData } = await dataSupabase
        .from("casos_clinicos_horarios")
        .select("id")
        .eq("caso_clinico_id", currentCase.id);

      const currentScheduleIds = (
        ((currentScheduleRowsData ?? []) as Array<
          Pick<Database["public"]["Tables"]["casos_clinicos_horarios"]["Row"], "id">
        >)
      ).map((schedule) => schedule.id);

      await attachExceptionalReleaseToAuditRecords({
        supabase: authSupabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "pacientes_clinica",
        recordIds: [patientId]
      });
      await attachExceptionalReleaseToAuditRecords({
        supabase: authSupabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "casos_clinicos",
        recordIds: [currentCase.id]
      });
      await attachExceptionalReleaseToAuditRecords({
        supabase: authSupabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "casos_clinicos_horarios",
        recordIds: [...previousScheduleIds, ...currentScheduleIds]
      });
    }

    revalidatePath("/clinica-supervisionada");
    revalidatePath(`/clinica-supervisionada/${currentCase.id}`);
    revalidatePath("/pacientes");
    revalidatePath(`/pacientes/${patientId}`);
    revalidatePath("/aluno");
    revalidatePath("/professor");
    revalidatePath("/secretaria");
    revalidatePath("/coordenador");

    redirect(
      buildNoticePath(
        `/clinica-supervisionada/${currentCase.id}`,
        "success",
        appendExceptionalReleaseNotice(
          "Caso clinico atualizado com sucesso.",
          exceptionalReleaseGate.noticeMessage
        )
      ) as Route
    );
  }

  const createdCaseId = crypto.randomUUID();
  const { error: caseInsertError } = await (dataSupabase
    .from("casos_clinicos") as any)
    .insert({
      ...casePayload,
      id: createdCaseId
    });

  if (caseInsertError) {
    return buildErrorState(
      caseInsertError.message ??
        "Nao foi possivel concluir a atribuicao clinica do paciente.",
      {},
      submittedFormValues
    );
  }

  const schedulePersistState = await replaceClinicalCaseSchedules({
    supabase: dataSupabase as SupabaseServerClient,
    caseId: createdCaseId,
    schedules: schedulesToPersist,
    formValues: submittedFormValues
  });

  if (schedulePersistState) {
    await (dataSupabase.from("casos_clinicos") as any)
      .delete()
      .eq("id", createdCaseId)
      .eq("professor_id", enrollmentContextResult.context.professorId);

    return schedulePersistState;
  }

  if (exceptionalReleaseGate.release) {
    const { data: currentScheduleRowsData } = await dataSupabase
      .from("casos_clinicos_horarios")
      .select("id")
      .eq("caso_clinico_id", createdCaseId);

    await attachExceptionalReleaseToAuditRecords({
      supabase: authSupabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "pacientes_clinica",
      recordIds: [patientId]
    });
    await attachExceptionalReleaseToAuditRecords({
      supabase: authSupabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "casos_clinicos",
      recordIds: [createdCaseId]
    });
    await attachExceptionalReleaseToAuditRecords({
      supabase: authSupabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "casos_clinicos_horarios",
      recordIds: (
        ((currentScheduleRowsData ?? []) as Array<
          Pick<Database["public"]["Tables"]["casos_clinicos_horarios"]["Row"], "id">
        >)
      ).map((schedule) => schedule.id)
    });
  }

  revalidatePath("/clinica-supervisionada");
  revalidatePath(`/clinica-supervisionada/${createdCaseId}`);
  revalidatePath("/pacientes");
  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/aluno");
  revalidatePath("/professor");
  revalidatePath("/secretaria");
  revalidatePath("/coordenador");

  redirect(
    buildNoticePath(
      `/clinica-supervisionada/${createdCaseId}`,
      "success",
      appendExceptionalReleaseNotice(
        "Novo caso clinico criado com sucesso a partir do cadastro-base do paciente.",
        exceptionalReleaseGate.noticeMessage
      )
    ) as Route
  );
}
