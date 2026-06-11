"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import {
  loadScopedOperationalGraph,
  resolveScopedDataAccess
} from "@/lib/auth/data-scope";
import { loadVisibleStageAreaCatalog } from "@/services/stage-areas";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";
import type {
  ExistingStudentResolutionAction,
  StudentProfileActionState,
  StudentRegistrationConflictInfo,
  StudentProfileFormValues,
  ProfessorRegistrationActionState,
  CourseManagerUnitCoordinatorActionState,
  CourseManagerUnitCoordinatorFormValues,
  ProfessorRegistrationFormValues,
  SecretaryRegistrationActionState,
  SecretaryRegistrationFormValues,
  SemesterManagementActionState,
  SemesterManagementFormValues,
  StageAreaRegistrationActionState,
  StageAreaRegistrationFormValues,
  StudentRegistrationActionState,
  StudentRegistrationAssignmentFormValue,
  StudentStageManagementActionState,
  StudentStageManagementFormValues,
  StudentRegistrationFormValues
} from "@/app/(app)/gestao/alunos/state";

type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type StageBlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ProfessorAreaRow = Database["public"]["Tables"]["professor_areas_estagio"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type UserInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type StudentInsert = Database["public"]["Tables"]["alunos"]["Insert"];
type ProfessorInsert = Database["public"]["Tables"]["professores"]["Insert"];
type ProfessorAreaInsert = Database["public"]["Tables"]["professor_areas_estagio"]["Insert"];
type CoordinatorInsert = Database["public"]["Tables"]["coordenadores"]["Insert"];
type ClassInsert = Database["public"]["Tables"]["turmas"]["Insert"];
type EnrollmentInsert = Database["public"]["Tables"]["matriculas_turma"]["Insert"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type EnrollmentUpdate = Database["public"]["Tables"]["matriculas_turma"]["Update"];
type ProfessorLinkInsert =
  Database["public"]["Tables"]["vinculos_professor_aluno"]["Insert"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type ProfessorLinkUpdate =
  Database["public"]["Tables"]["vinculos_professor_aluno"]["Update"];
type UserUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
type StudentUpdate = Database["public"]["Tables"]["alunos"]["Update"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type UserContextInsert = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Insert"];
type UserContextUpdate = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Update"];
type AuditRow = Database["public"]["Tables"]["historico_alteracoes"]["Row"];

interface ResolvedOperationalScope {
  unitId: string;
  instituicaoId: string | null;
  courseId: string | null;
  courseName: string | null;
  offerId: string | null;
}

interface ParsedStudentAssignment {
  row_id: string;
  area_id: string;
  supervisor_1_id: string;
  supervisor_2_id: string;
}

interface PersistableStudentAssignment {
  index: number;
  rowId: string;
  areaId: string;
  supervisorIds: string[];
}

type ExistingStudentLookupResult =
  | { kind: "none" }
  | {
      kind: "same_unit_student";
      user: Pick<UserRow, "id" | "email" | "nome_completo" | "ativo" | "unidade_id">;
      student: Pick<StudentRow, "usuario_id" | "matricula">;
      hasOperationalActiveSemester: boolean;
      selectedSemesterLinked: boolean;
    }
  | {
      kind: "different_unit";
      unitName: string;
    }
  | {
      kind: "different_profile";
      profileCode: ProfileRow["codigo"];
    }
  | {
      kind: "inconsistent";
      message: string;
    };

const studentAssignmentSchema = z.object({
  row_id: z.string().trim().min(1).max(80),
  area_id: z.string().trim().max(64),
  supervisor_1_id: z.string().trim().max(64),
  supervisor_2_id: z.string().trim().max(64)
});

const studentRegistrationSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do aluno.")
    .max(160, "O nome do aluno deve ter no maximo 160 caracteres."),
  ra: z
    .string()
    .trim()
    .min(3, "Informe o RA do aluno.")
    .max(30, "O RA deve ter no maximo 30 caracteres."),
  celular: z
    .string()
    .trim()
    .min(8, "Informe o celular do aluno.")
    .max(30, "O celular deve ter no maximo 30 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para o aluno."),
  senha: z
    .string()
    .min(8, "A senha do aluno deve ter ao menos 8 caracteres.")
    .max(72, "A senha do aluno deve ter no maximo 72 caracteres."),
  semestre_id: z.string().trim(),
  assignments: z
    .array(studentAssignmentSchema)
    .max(20, "Reduza a quantidade de areas vinculadas neste envio.")
});

const studentProfileSchema = z.object({
  student_id: z.string().uuid("Aluno invalido."),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do aluno.")
    .max(160, "O nome do aluno deve ter no maximo 160 caracteres."),
  ra: z
    .string()
    .trim()
    .min(3, "Informe o RA do aluno.")
    .max(30, "O RA deve ter no maximo 30 caracteres."),
  celular: z
    .string()
    .trim()
    .min(8, "Informe o celular do aluno.")
    .max(30, "O celular deve ter no maximo 30 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para o aluno.")
});

const studentStageManagementSchema = z.object({
  student_id: z.string().uuid("Aluno invalido."),
  semestre_id: z.string().uuid("Selecione um semestre valido."),
  assignments: z
    .array(studentAssignmentSchema)
    .max(20, "Reduza a quantidade de areas vinculadas neste envio.")
});

const professorRegistrationSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do professor.")
    .max(160, "O nome do professor deve ter no maximo 160 caracteres."),
  funcional: z
    .string()
    .trim()
    .min(3, "Informe o funcional do professor.")
    .max(30, "O funcional deve ter no maximo 30 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para o professor."),
  senha: z
    .string()
    .min(8, "A senha do professor deve ter ao menos 8 caracteres.")
    .max(72, "A senha do professor deve ter no maximo 72 caracteres."),
  area_ids: z
    .array(z.string().uuid("Selecione areas validas."))
    .min(1, "Selecione ao menos uma area para o professor.")
});

const secretaryRegistrationSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo da secretária.")
    .max(160, "O nome da secretária deve ter no maximo 160 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para a secretária."),
  senha: z
    .string()
    .min(8, "A senha da secretária deve ter ao menos 8 caracteres.")
    .max(72, "A senha da secretária deve ter no maximo 72 caracteres.")
});

const semesterManagementSchema = z
  .object({
    codigo: z
      .string()
      .trim()
      .regex(/^\d{4}\/[12]$/, "Use o formato AAAA/1 ou AAAA/2."),
    nome: z
      .string()
      .trim()
      .min(3, "Informe um nome para o semestre.")
      .max(80, "O nome do semestre deve ter no maximo 80 caracteres."),
    data_inicio: z.iso.date("Informe uma data de inicio valida."),
    data_fim: z.iso.date("Informe uma data de fim valida."),
    status: z.enum(["planejado", "ativo", "encerrado"])
  })
  .refine((value) => value.data_inicio < value.data_fim, {
    path: ["data_fim"],
    message: "A data de fim deve ser posterior a data de inicio."
  });

const stageAreaRegistrationSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da área supervisionada.")
    .max(120, "O nome da área deve ter no máximo 120 caracteres."),
  codigo: z
    .string()
    .trim()
    .max(60, "O código da área deve ter no máximo 60 caracteres."),
  ativo: z.enum(["true", "false"])
});

const courseManagerUnitCoordinatorSchema = z.object({
  unidade_id: z.string().uuid("Selecione uma unidade valida."),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do coordenador.")
    .max(160, "O nome do coordenador deve ter no maximo 160 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para o coordenador."),
  senha: z
    .string()
    .min(8, "A senha inicial deve ter ao menos 8 caracteres.")
    .max(72, "A senha inicial deve ter no maximo 72 caracteres."),
  cargo: z
    .string()
    .trim()
    .min(3, "Informe o cargo do coordenador.")
    .max(120, "O cargo deve ter no maximo 120 caracteres."),
  ativo: z.enum(["true", "false"])
});

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildStudentErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: StudentRegistrationFormValues
): StudentRegistrationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    conflictInfo: null,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentIdleState(
  formValues?: StudentRegistrationFormValues
): StudentRegistrationActionState {
  return {
    status: "idle",
    message: null,
    fieldErrors: {},
    conflictInfo: null,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentConflictState(
  message: string,
  conflictInfo: StudentRegistrationConflictInfo,
  formValues?: StudentRegistrationFormValues
): StudentRegistrationActionState {
  return {
    status: "conflict",
    message,
    fieldErrors: {},
    conflictInfo,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentProfileErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: StudentProfileFormValues
): StudentProfileActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentStageErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: StudentStageManagementFormValues
): StudentStageManagementActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildProfessorErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: ProfessorRegistrationFormValues
): ProfessorRegistrationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildSecretaryErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: SecretaryRegistrationFormValues
): SecretaryRegistrationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildSemesterErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: SemesterManagementFormValues
): SemesterManagementActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStageAreaErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: StageAreaRegistrationFormValues
): StageAreaRegistrationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildCourseManagerCoordinatorErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: CourseManagerUnitCoordinatorFormValues
): CourseManagerUnitCoordinatorActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentSuccessState(message: string): StudentRegistrationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    conflictInfo: null,
    submittedAt: Date.now()
  };
}

function buildStudentProfileSuccessState(
  message: string,
  formValues?: StudentProfileFormValues
): StudentProfileActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    formValues,
    submittedAt: Date.now()
  };
}

function buildStudentStageSuccessState(
  message: string,
  formValues?: StudentStageManagementFormValues
): StudentStageManagementActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    formValues,
    submittedAt: Date.now()
  };
}

function buildProfessorSuccessState(message: string): ProfessorRegistrationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    submittedAt: Date.now()
  };
}

function buildSecretarySuccessState(message: string): SecretaryRegistrationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    submittedAt: Date.now()
  };
}

function buildSemesterSuccessState(message: string): SemesterManagementActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    submittedAt: Date.now()
  };
}

function buildStageAreaSuccessState(message: string): StageAreaRegistrationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    submittedAt: Date.now()
  };
}

function buildCourseManagerCoordinatorSuccessState(
  message: string
): CourseManagerUnitCoordinatorActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    submittedAt: Date.now()
  };
}

function isDuplicateEmailMessage(message: string | undefined) {
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("already") || normalizedMessage.includes("duplicate");
}

function resolveCoordinatorOperationalContext(currentUser: SessionUser, unitId: string) {
  const activeContext =
    currentUser.contextoAtivo?.ativo && currentUser.contextoAtivo.perfilCodigo === "coordenador"
      ? currentUser.contextoAtivo
      : null;

  if (activeContext) {
    return activeContext;
  }

  const coordinatorContexts = currentUser.contextosDisponiveis.filter(
    (context) => context.ativo && context.perfilCodigo === "coordenador"
  );
  const matchingUnitContexts = coordinatorContexts.filter(
    (context) => !context.unidadeId || context.unidadeId === unitId
  );

  if (matchingUnitContexts.length === 1) {
    return matchingUnitContexts[0];
  }

  if (coordinatorContexts.length === 1) {
    return coordinatorContexts[0];
  }

  return null;
}

function getRequiredCoordinatorUnitId(currentUser: SessionUser) {
  if (!currentUser.unitId) {
    throw new Error(
      "O coordenador autenticado não está vinculado a uma unidade operacional."
    );
  }

  return currentUser.unitId;
}

function assertOperationalMutationAllowed(currentUser: SessionUser) {
  if (getActiveMasterCourseContext(currentUser)) {
    throw new Error(
      "O Gestor do curso possui acesso somente de consulta na aba Cadastros. Use o Coordenador Local para executar cadastros operacionais."
    );
  }
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readReturnPath(formData: FormData, fallbackPath: string) {
  const returnPath = readStringField(formData, "return_to");
  return returnPath.startsWith("/") ? returnPath : fallbackPath;
}

function readExistingStudentResolutionAction(formData: FormData) {
  const value = readStringField(formData, "existing_student_resolution");

  return value === "reactivate" || value === "link" || value === "cancel"
    ? (value as ExistingStudentResolutionAction)
    : null;
}

function parseAssignmentRows(rawValue: string) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
}

function normalizeAssignmentRow(
  value: unknown,
  index: number
): StudentRegistrationAssignmentFormValue {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const readAssignmentField = (field: string) => {
    const fieldValue = record[field];
    return typeof fieldValue === "string" ? fieldValue.trim() : "";
  };

  return {
    row_id: readAssignmentField("row_id") || `assignment-${index + 1}`,
    area_id: readAssignmentField("area_id"),
    supervisor_1_id: readAssignmentField("supervisor_1_id"),
    supervisor_2_id: readAssignmentField("supervisor_2_id")
  };
}

function buildStudentFormValues(formData: FormData): StudentRegistrationFormValues {
  const assignments = parseAssignmentRows(readStringField(formData, "assignments_payload")).map(
    normalizeAssignmentRow
  );

  return {
    nome_completo: readStringField(formData, "nome_completo"),
    ra: readStringField(formData, "ra"),
    celular: readStringField(formData, "celular"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha"),
    semestre_id: readStringField(formData, "semestre_id"),
    assignments
  };
}

function buildStudentProfileFormValues(formData: FormData): StudentProfileFormValues {
  return {
    student_id: readStringField(formData, "student_id"),
    nome_completo: readStringField(formData, "nome_completo"),
    ra: readStringField(formData, "ra"),
    celular: readStringField(formData, "celular"),
    email: readStringField(formData, "email").toLowerCase()
  };
}

function buildStudentStageFormValues(formData: FormData): StudentStageManagementFormValues {
  const assignments = parseAssignmentRows(readStringField(formData, "assignments_payload")).map(
    normalizeAssignmentRow
  );

  return {
    student_id: readStringField(formData, "student_id"),
    semestre_id: readStringField(formData, "semestre_id"),
    assignments
  };
}

function buildProfessorFormValues(formData: FormData): ProfessorRegistrationFormValues {
  const areaIds = formData
    .getAll("area_ids")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    nome_completo: readStringField(formData, "nome_completo"),
    funcional: readStringField(formData, "funcional"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha"),
    area_ids: areaIds
  };
}

function buildSecretaryFormValues(formData: FormData): SecretaryRegistrationFormValues {
  return {
    nome_completo: readStringField(formData, "nome_completo"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha")
  };
}

function buildSemesterFormValues(formData: FormData): SemesterManagementFormValues {
  const status = readStringField(formData, "status");

  return {
    codigo: readStringField(formData, "codigo"),
    nome: readStringField(formData, "nome"),
    data_inicio: readStringField(formData, "data_inicio"),
    data_fim: readStringField(formData, "data_fim"),
    status:
      status === "ativo" || status === "encerrado" ? status : "planejado"
  };
}

function buildStageAreaFormValues(formData: FormData): StageAreaRegistrationFormValues {
  const activeValue = readStringField(formData, "ativo");

  return {
    nome: readStringField(formData, "nome"),
    codigo: readStringField(formData, "codigo"),
    ativo: activeValue === "false" ? "false" : "true"
  };
}

function buildCourseManagerCoordinatorFormValues(
  formData: FormData
): CourseManagerUnitCoordinatorFormValues {
  const activeValue = readStringField(formData, "ativo");

  return {
    unidade_id: readStringField(formData, "unidade_id"),
    nome_completo: readStringField(formData, "nome_completo"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha"),
    cargo: readStringField(formData, "cargo"),
    ativo: activeValue === "false" ? "false" : "true"
  };
}

function collectAssignmentsToPersist(
  assignments: ParsedStudentAssignment[]
): PersistableStudentAssignment[] {
  return assignments
    .map((assignment, index) => {
      const supervisorIds = [
        assignment.supervisor_1_id,
        assignment.supervisor_2_id
      ].filter(Boolean);

      return {
        index,
        rowId: assignment.row_id,
        areaId: assignment.area_id,
        supervisorIds
      };
    })
    .filter(
      (assignment) => assignment.areaId || assignment.supervisorIds.length > 0
    );
}

async function loadProfileMap() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase.from("perfis") as any).select("*");

  if (error) {
    throw new Error("Não foi possível carregar os perfis de acesso.");
  }

  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [profile.codigo, profile])
  );
}

async function resolveOperationalScopeForCurrentCoordinator(
  currentUser: SessionUser
): Promise<ResolvedOperationalScope> {
  const unitId = getRequiredCoordinatorUnitId(currentUser);
  const activeContext = resolveCoordinatorOperationalContext(currentUser, unitId);
  const supabase = await createSupabaseServerClient();
  const scope = await resolveScopedDataAccess(currentUser, {
    supabase
  });
  const candidateOfferId =
    activeContext?.ofertaCursoUnidadeId ??
    currentUser.ofertaCursoUnidadeId ??
    (scope.offerIds.length === 1 ? scope.offerIds[0] : null);

  if (!candidateOfferId) {
    return {
      unitId,
      instituicaoId: activeContext?.instituicaoId ?? currentUser.instituicaoId ?? null,
      courseId: activeContext?.cursoId ?? currentUser.cursoId ?? null,
      courseName: activeContext?.cursoNome ?? currentUser.cursoNome ?? null,
      offerId: null
    };
  }

  const { data: offerData, error: offerError } = await supabase
    .from("ofertas_curso_unidade")
    .select("id, unidade_id, instituicao_id, curso_id")
    .eq("id", candidateOfferId)
    .maybeSingle();

  const offerRow = (offerData ?? null) as Pick<
    OfferRow,
    "id" | "unidade_id" | "instituicao_id" | "curso_id"
  > | null;

  if (offerError || !offerRow) {
    return {
      unitId,
      instituicaoId: activeContext?.instituicaoId ?? currentUser.instituicaoId ?? null,
      courseId: activeContext?.cursoId ?? currentUser.cursoId ?? null,
      courseName: activeContext?.cursoNome ?? currentUser.cursoNome ?? null,
      offerId: null
    };
  }

  const { data: courseData } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("id", offerRow.curso_id)
    .maybeSingle();
  const courseRow = (courseData ?? null) as Pick<CourseRow, "id" | "nome"> | null;

  return {
    unitId: offerRow.unidade_id ?? unitId,
    instituicaoId: offerRow.instituicao_id ?? activeContext?.instituicaoId ?? null,
    courseId: offerRow.curso_id ?? activeContext?.cursoId ?? null,
    courseName: courseRow?.nome ?? activeContext?.cursoNome ?? null,
    offerId: offerRow.id
  };
}

function buildAreaClassCode(semester: SemesterRow, area: AreaRow) {
  const rawCode = `${semester.codigo}-${area.codigo}`.toUpperCase();
  return rawCode.slice(0, 30);
}

function normalizeStageAreaCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function resolveUniqueStageAreaCode(baseCode: string, existingCodes: Set<string>) {
  if (!existingCodes.has(baseCode)) {
    return baseCode;
  }

  let suffix = 2;
  let nextCode = `${baseCode}_${suffix}`;

  while (existingCodes.has(nextCode)) {
    suffix += 1;
    nextCode = `${baseCode}_${suffix}`;
  }

  return nextCode;
}

async function findOrCreateAreaClass(input: {
  semester: SemesterRow;
  area: AreaRow;
  coordinatorId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: existingClassData, error: existingClassError } = await (supabase
    .from("turmas") as any)
    .select("*")
    .eq("semestre_id", input.semester.id)
    .eq("area_estagio_id", input.area.id)
    .maybeSingle();

  if (existingClassError) {
    throw new Error("Não foi possível consultar a turma da área de estágio.");
  }

  if (existingClassData) {
    return existingClassData as ClassRow;
  }

  const classInsertPayload: ClassInsert = {
    semestre_id: input.semester.id,
    oferta_curso_unidade_id: input.semester.oferta_curso_unidade_id ?? null,
    codigo: buildAreaClassCode(input.semester, input.area),
    nome: `${input.area.nome} - ${input.semester.codigo}`,
    area_estagio: input.area.nome,
    area_estagio_id: input.area.id,
    coordenador_id: input.coordinatorId,
    ativa: true
  };

  const { data: insertedClass, error: insertClassError } = await (supabase
    .from("turmas") as any)
    .insert(classInsertPayload)
    .select("*")
    .maybeSingle();

  if (insertClassError || !insertedClass) {
    throw new Error(
      insertClassError?.message ??
        "Não foi possível criar a turma operacional da área de estágio."
    );
  }

  return insertedClass as ClassRow;
}

function buildCurrentDateIso() {
  return new Date().toISOString().slice(0, 10);
}

function uniqueStringValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function syncAuthUserActivations(userIds: string[], isActive: boolean) {
  const uniqueUserIds = uniqueStringValues(userIds);

  if (!uniqueUserIds.length) {
    return;
  }

  await Promise.all(
    uniqueUserIds.map((userId) => syncAuthUserActivation(userId, isActive))
  );
}

async function reconcileStudentOperationalAccess(studentIds: string[]) {
  const uniqueStudentIds = uniqueStringValues(studentIds);

  if (!uniqueStudentIds.length) {
    return {
      activatedIds: [] as string[],
      deactivatedIds: [] as string[]
    };
  }

  const supabase = await createSupabaseServerClient();
  const [userRowsResult, enrollmentRowsResult] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, ativo")
      .in("id", uniqueStudentIds),
    supabase
      .from("matriculas_turma")
      .select("id, aluno_id, turma_id, status")
      .in("aluno_id", uniqueStudentIds)
      .eq("status", "ativa")
  ]);

  if (userRowsResult.error || enrollmentRowsResult.error) {
    throw new Error(
      "Não foi possível reconciliar o acesso operacional dos alunos."
    );
  }

  const userRows = (userRowsResult.data ?? []) as Array<Pick<UserRow, "id" | "ativo">>;
  const enrollmentRows = (enrollmentRowsResult.data ?? []) as Array<
    Pick<EnrollmentRow, "id" | "aluno_id" | "turma_id" | "status">
  >;
  const classIds = uniqueStringValues(enrollmentRows.map((enrollment) => enrollment.turma_id));

  const classRowsResult = classIds.length
    ? await supabase
        .from("turmas")
        .select("id, semestre_id")
        .in("id", classIds)
    : { data: [], error: null };

  if (classRowsResult.error) {
    throw new Error(
      "Não foi possível carregar as turmas para reconciliar o acesso operacional dos alunos."
    );
  }

  const classRows = (classRowsResult.data ?? []) as Array<
    Pick<ClassRow, "id" | "semestre_id">
  >;
  const semesterIds = uniqueStringValues(
    classRows.map((classGroup) => classGroup.semestre_id)
  );
  const semesterRowsResult = semesterIds.length
    ? await supabase
        .from("semestres")
        .select("id, status")
        .in("id", semesterIds)
    : { data: [], error: null };

  if (semesterRowsResult.error) {
    throw new Error(
      "Não foi possível carregar os semestres para reconciliar o acesso operacional dos alunos."
    );
  }

  const semesterRows = (semesterRowsResult.data ?? []) as Array<
    Pick<SemesterRow, "id" | "status">
  >;
  const classSemesterMap = new Map(
    classRows.map((classGroup) => [classGroup.id, classGroup.semestre_id])
  );
  const activeSemesterIds = new Set(
    semesterRows
      .filter((semester) => semester.status === "ativo")
      .map((semester) => semester.id)
  );

  const shouldBeActiveStudentIds = new Set(
    enrollmentRows
      .filter((enrollment) => {
        const semesterId = classSemesterMap.get(enrollment.turma_id);
        return semesterId ? activeSemesterIds.has(semesterId) : false;
      })
      .map((enrollment) => enrollment.aluno_id)
  );

  const usersToActivate = userRows
    .filter((user) => !user.ativo && shouldBeActiveStudentIds.has(user.id))
    .map((user) => user.id);
  const usersToDeactivate = userRows
    .filter((user) => user.ativo && !shouldBeActiveStudentIds.has(user.id))
    .map((user) => user.id);

  if (usersToActivate.length) {
    const { error } = await (supabase.from("usuarios") as any)
      .update({ ativo: true } satisfies UserUpdate)
      .in("id", usersToActivate);

    if (error) {
      throw new Error(
        "Não foi possível reativar alunos com semestre operacional ativo."
      );
    }
  }

  if (usersToDeactivate.length) {
    const { error } = await (supabase.from("usuarios") as any)
      .update({ ativo: false } satisfies UserUpdate)
      .in("id", usersToDeactivate);

    if (error) {
      throw new Error(
        "Não foi possível arquivar os alunos sem semestre operacional ativo."
      );
    }
  }

  await syncAuthUserActivations(usersToActivate, true);
  await syncAuthUserActivations(usersToDeactivate, false);

  return {
    activatedIds: usersToActivate,
    deactivatedIds: usersToDeactivate
  };
}

async function loadSemesterOperationalContext(input: {
  semesterId: string;
  operationalScope: ResolvedOperationalScope;
}) {
  const supabase = await createSupabaseServerClient();
  const semesterQuery = supabase
    .from("semestres")
    .select("*")
    .eq("id", input.semesterId);

  if (input.operationalScope.offerId) {
    semesterQuery.eq("oferta_curso_unidade_id", input.operationalScope.offerId);
  } else {
    semesterQuery.eq("unidade_id", input.operationalScope.unitId);
  }

  const { data: semesterData, error: semesterError } = await semesterQuery.maybeSingle();

  if (semesterError || !semesterData) {
    throw new Error("Não foi possível localizar o semestre informado.");
  }

  const semester = semesterData as SemesterRow;
  const { data: classRowsData, error: classRowsError } = await supabase
    .from("turmas")
    .select("*")
    .eq("semestre_id", input.semesterId);

  if (classRowsError) {
    throw new Error("Não foi possível carregar as turmas do semestre.");
  }

  const classRows = (classRowsData ?? []) as ClassRow[];
  const classIds = classRows.map((classGroup) => classGroup.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase
        .from("matriculas_turma")
        .select("*")
        .in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error("Não foi possível carregar as matrículas do semestre.");
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];

  return {
    supabase,
    semester,
    classRows,
    enrollmentRows
  };
}

async function setSemesterToClosedOperationally(input: {
  semesterId: string;
  operationalScope: ResolvedOperationalScope;
}) {
  const { supabase, semester, classRows, enrollmentRows } =
    await loadSemesterOperationalContext(input);

  if (semester.status === "encerrado") {
    return {
      semester,
      affectedStudentIds: [] as string[],
      message: `O semestre ${semester.codigo} já estava encerrado.`
    };
  }

  const classIds = classRows.map((classGroup) => classGroup.id);
  const activeEnrollmentIds = enrollmentRows
    .filter((enrollment) => enrollment.status === "ativa")
    .map((enrollment) => enrollment.id);
  const allEnrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const affectedStudentIds = uniqueStringValues(
    enrollmentRows.map((enrollment) => enrollment.aluno_id)
  );
  const today = buildCurrentDateIso();

  const { error: semesterError } = await (supabase.from("semestres") as any)
    .update({ status: "encerrado" } satisfies Pick<SemesterRow, "status">)
    .eq("id", semester.id);

  if (semesterError) {
    throw new Error(semesterError.message);
  }

  if (classIds.length) {
    const { error } = await (supabase.from("turmas") as any)
      .update({ ativa: false } satisfies Pick<ClassRow, "ativa">)
      .in("id", classIds);

    if (error) {
      throw new Error("Não foi possível arquivar as turmas do semestre.");
    }
  }

  if (activeEnrollmentIds.length) {
    const { error } = await (supabase.from("matriculas_turma") as any)
      .update({ status: "concluida" } satisfies EnrollmentUpdate)
      .in("id", activeEnrollmentIds)
      .eq("status", "ativa");

    if (error) {
      throw new Error("Não foi possível concluir as matrículas ativas do semestre.");
    }
  }

  if (allEnrollmentIds.length) {
    const { error } = await (supabase.from("vinculos_professor_aluno") as any)
      .update({
        ativo: false,
        data_fim: today
      } satisfies ProfessorLinkUpdate)
      .in("matricula_turma_id", allEnrollmentIds)
      .eq("ativo", true);

    if (error) {
      throw new Error(
        "Não foi possível encerrar os vínculos de supervisão do semestre."
      );
    }
  }

  const reconciliation = await reconcileStudentOperationalAccess(affectedStudentIds);

  return {
    semester,
    affectedStudentIds,
    message: `Semestre ${semester.codigo} encerrado com sucesso. ${activeEnrollmentIds.length} matrícula(s) foram concluídas e ${reconciliation.deactivatedIds.length} aluno(s) tiveram o acesso operacional arquivado.`
  };
}

async function setSemesterToActiveOperationally(input: {
  semesterId: string;
  operationalScope: ResolvedOperationalScope;
}) {
  const { supabase, semester, classRows, enrollmentRows } =
    await loadSemesterOperationalContext(input);

  if (semester.status === "encerrado") {
    throw new Error(
      "Semestres encerrados ficam em histórico e não podem ser reativados."
    );
  }

  const { error: semesterError } = await (supabase.from("semestres") as any)
    .update({ status: "ativo" } satisfies Pick<SemesterRow, "status">)
    .eq("id", semester.id);

  if (semesterError) {
    throw new Error(semesterError.message);
  }

  const classIds = classRows.map((classGroup) => classGroup.id);

  if (classIds.length) {
    const { error } = await (supabase.from("turmas") as any)
      .update({ ativa: true } satisfies Pick<ClassRow, "ativa">)
      .in("id", classIds);

    if (error) {
      throw new Error("Não foi possível ativar as turmas do semestre.");
    }
  }

  const affectedStudentIds = uniqueStringValues(
    enrollmentRows.map((enrollment) => enrollment.aluno_id)
  );
  const reconciliation = await reconcileStudentOperationalAccess(affectedStudentIds);

  return {
    semester,
    message: `Semestre ${semester.codigo} ativado com sucesso. ${reconciliation.activatedIds.length} aluno(s) ficaram aptos para o fluxo operacional.`
  };
}

async function setSemesterToPlannedOperationally(input: {
  semesterId: string;
  operationalScope: ResolvedOperationalScope;
}) {
  const { supabase, semester, classRows, enrollmentRows } =
    await loadSemesterOperationalContext(input);

  if (semester.status === "encerrado") {
    throw new Error(
      "Semestres encerrados ficam em histórico e não podem voltar para planejado."
    );
  }

  const { error: semesterError } = await (supabase.from("semestres") as any)
    .update({ status: "planejado" } satisfies Pick<SemesterRow, "status">)
    .eq("id", semester.id);

  if (semesterError) {
    throw new Error(semesterError.message);
  }

  const classIds = classRows.map((classGroup) => classGroup.id);

  if (classIds.length) {
    const { error } = await (supabase.from("turmas") as any)
      .update({ ativa: false } satisfies Pick<ClassRow, "ativa">)
      .in("id", classIds);

    if (error) {
      throw new Error("Não foi possível marcar as turmas do semestre como planejadas.");
    }
  }

  const affectedStudentIds = uniqueStringValues(
    enrollmentRows.map((enrollment) => enrollment.aluno_id)
  );
  const reconciliation = await reconcileStudentOperationalAccess(affectedStudentIds);

  return {
    semester,
    message: `Semestre ${semester.codigo} movido para planejado. ${reconciliation.deactivatedIds.length} aluno(s) ficaram sem acesso operacional ativo até uma nova ativação.`
  };
}

function validateAssignmentStructure(
  assignmentsToPersist: PersistableStudentAssignment[]
) {
  const assignmentFieldErrors: Record<string, string> = {};
  const selectedAreaMap = new Map<string, number>();

  for (const assignment of assignmentsToPersist) {
    const areaField = `assignments.${assignment.index}.area_id`;
    const supervisor1Field = `assignments.${assignment.index}.supervisor_1_id`;
    const supervisor2Field = `assignments.${assignment.index}.supervisor_2_id`;

    if (!assignment.areaId && assignment.supervisorIds.length > 0) {
      assignmentFieldErrors[areaField] =
        "Selecione a área antes de escolher supervisores.";
    }

    if (assignment.supervisorIds.length !== new Set(assignment.supervisorIds).size) {
      assignmentFieldErrors[supervisor2Field] =
        "Não repita o mesmo supervisor na mesma área.";
    }

    if (assignment.areaId) {
      const firstOccurrence = selectedAreaMap.get(assignment.areaId);

      if (firstOccurrence !== undefined) {
        assignmentFieldErrors[areaField] =
          "Selecione cada área apenas uma vez no mesmo semestre.";
        assignmentFieldErrors[`assignments.${firstOccurrence}.area_id`] =
          "Selecione cada área apenas uma vez no mesmo semestre.";
      } else {
        selectedAreaMap.set(assignment.areaId, assignment.index);
      }
    }

    if (assignment.supervisorIds.length === 2 && !assignment.supervisorIds[0]) {
      assignmentFieldErrors[supervisor1Field] =
        "Defina primeiro o supervisor principal antes do adicional.";
    }
  }

  return assignmentFieldErrors;
}

async function loadAssignmentValidationContext(input: {
  currentUser: SessionUser;
  operationalScope: ResolvedOperationalScope;
  semesterId: string;
  assignmentsToPersist: PersistableStudentAssignment[];
}) {
  const supabase = await createSupabaseServerClient();
  const scopedGraph = await loadScopedOperationalGraph(input.currentUser, { supabase });
  const scope = scopedGraph.scope;
  const areaIds = [
    ...new Set(input.assignmentsToPersist.map((assignment) => assignment.areaId).filter(Boolean))
  ];
  const supervisorIds = [
    ...new Set(input.assignmentsToPersist.flatMap((assignment) => assignment.supervisorIds))
  ];
  const semesterQuery = supabase.from("semestres").select("*").eq("id", input.semesterId);

  if (input.operationalScope.offerId) {
    semesterQuery.eq("oferta_curso_unidade_id", input.operationalScope.offerId);
  } else {
    semesterQuery.eq("unidade_id", input.operationalScope.unitId);
  }

  const visibleStageAreaCatalog = await loadVisibleStageAreaCatalog({
    supabase,
    scope,
    selectedUnitId: input.operationalScope.unitId,
    visibleClassRows: scopedGraph.classRows.filter((classRow) => classRow.ativa)
  });
  const visibleAreaRows = visibleStageAreaCatalog.areaRows.filter(
    (areaRow) => areaIds.length === 0 || areaIds.includes(areaRow.id)
  );
  let allowedSupervisorIds = supervisorIds;
  const shouldFilterSupervisorUsersByUnit =
    !input.operationalScope.offerId &&
    !(input.operationalScope.instituicaoId && input.operationalScope.courseId);

  if (supervisorIds.length > 0) {
    if (input.operationalScope.offerId) {
      const { data: contextRowsData, error: contextRowsError } = await supabase
        .from("usuarios_papeis_contexto")
        .select("usuario_id")
        .eq("oferta_curso_unidade_id", input.operationalScope.offerId)
        .eq("ativo", true)
        .in("usuario_id", supervisorIds);

      if (contextRowsError) {
        return {
          semesterResult: { data: null, error: contextRowsError },
          areaResult: { data: visibleAreaRows, error: null },
          professorAreaResult: { data: [], error: contextRowsError },
          professorUsersResult: { data: [], error: contextRowsError }
        };
      }

      allowedSupervisorIds = uniqueStringValues(
        ((contextRowsData ?? []) as Array<Pick<UserContextRow, "usuario_id">>).map(
          (contextRow) => contextRow.usuario_id
        )
      );
    } else if (input.operationalScope.instituicaoId && input.operationalScope.courseId) {
      const { data: contextRowsData, error: contextRowsError } = await supabase
        .from("usuarios_papeis_contexto")
        .select("usuario_id")
        .eq("instituicao_id", input.operationalScope.instituicaoId)
        .eq("curso_id", input.operationalScope.courseId)
        .eq("ativo", true)
        .in("usuario_id", supervisorIds);

      if (contextRowsError) {
        return {
          semesterResult: { data: null, error: contextRowsError },
          areaResult: { data: visibleAreaRows, error: null },
          professorAreaResult: { data: [], error: contextRowsError },
          professorUsersResult: { data: [], error: contextRowsError }
        };
      }

      allowedSupervisorIds = uniqueStringValues(
        ((contextRowsData ?? []) as Array<Pick<UserContextRow, "usuario_id">>).map(
          (contextRow) => contextRow.usuario_id
        )
      );
    }
  }

  const [semesterResult, areaResult, professorAreaResult, professorUsersResult] =
    await Promise.all([
      semesterQuery.maybeSingle(),
      Promise.resolve({ data: visibleAreaRows, error: null }),
      areaIds.length && allowedSupervisorIds.length
        ? supabase
            .from("professor_areas_estagio")
            .select("*")
            .in("area_estagio_id", areaIds)
            .in("professor_id", allowedSupervisorIds)
            .eq("ativo", true)
        : Promise.resolve({ data: [], error: null }),
      allowedSupervisorIds.length
        ? shouldFilterSupervisorUsersByUnit
          ? supabase
              .from("usuarios")
              .select("*")
              .in("id", allowedSupervisorIds)
              .eq("unidade_id", input.operationalScope.unitId)
          : supabase
              .from("usuarios")
              .select("*")
              .in("id", allowedSupervisorIds)
        : Promise.resolve({ data: [], error: null })
    ]);

  return {
    semesterResult,
    areaResult,
    professorAreaResult,
    professorUsersResult
  };
}

function validateAssignmentsAgainstLoadedContext(input: {
  assignmentsToPersist: PersistableStudentAssignment[];
  areaRows: AreaRow[];
  professorAreaRows: ProfessorAreaRow[];
  professorUsers: UserRow[];
}) {
  const assignmentFieldErrors: Record<string, string> = {};
  const areaMap = new Map(input.areaRows.map((area) => [area.id, area]));
  const professorUserMap = new Map(
    input.professorUsers.map((user) => [user.id, user])
  );

  for (const assignment of input.assignmentsToPersist) {
    const areaField = `assignments.${assignment.index}.area_id`;
    const supervisor1Field = `assignments.${assignment.index}.supervisor_1_id`;
    const supervisor2Field = `assignments.${assignment.index}.supervisor_2_id`;
    const area = assignment.areaId ? areaMap.get(assignment.areaId) : null;

    if (assignment.areaId && !area) {
      assignmentFieldErrors[areaField] = "Área de estágio inválida.";
      continue;
    }

    for (const [supervisorIndex, supervisorId] of assignment.supervisorIds.entries()) {
      const supervisorField =
        supervisorIndex === 0 ? supervisor1Field : supervisor2Field;

      if (!professorUserMap.has(supervisorId)) {
        assignmentFieldErrors[supervisorField] =
          "Supervisor inválido para esta área.";
        continue;
      }

      if (!professorUserMap.get(supervisorId)?.ativo) {
        assignmentFieldErrors[supervisorField] =
          "Selecione um supervisor ativo para esta área.";
        continue;
      }

      if (
        assignment.areaId &&
        !input.professorAreaRows.some(
          (professorArea) =>
            professorArea.area_estagio_id === assignment.areaId &&
            professorArea.professor_id === supervisorId
        )
      ) {
        assignmentFieldErrors[supervisorField] =
          "Selecione um supervisor vinculado a esta área.";
      }
    }
  }

  return {
    fieldErrors: assignmentFieldErrors,
    areaMap,
    professorUserMap
  };
}

async function syncEnrollmentProfessorLinks(input: {
  enrollmentId: string;
  desiredSupervisorIds: string[];
  existingProfessorLinks: ProfessorLinkRow[];
}) {
  const supabase = await createSupabaseServerClient();
  const today = buildCurrentDateIso();
  const activeProfessorLinks = input.existingProfessorLinks.filter((link) => link.ativo);

  for (const professorLink of activeProfessorLinks) {
    if (input.desiredSupervisorIds.includes(professorLink.professor_id)) {
      continue;
    }

    const professorLinkUpdatePayload: ProfessorLinkUpdate = {
      ativo: false,
      data_fim: today
    };

    const { error } = await (supabase.from("vinculos_professor_aluno") as any)
      .update(professorLinkUpdatePayload)
      .eq("id", professorLink.id);

    if (error) {
      throw new Error("Não foi possível encerrar um vínculo antigo de supervisão.");
    }
  }

  for (const [supervisorIndex, supervisorId] of input.desiredSupervisorIds.entries()) {
    const activeProfessorLink = activeProfessorLinks.find(
      (link) => link.professor_id === supervisorId
    );

    if (activeProfessorLink) {
      const professorLinkUpdatePayload: ProfessorLinkUpdate = {
        responsavel_principal: supervisorIndex === 0
      };

      const { error } = await (supabase.from("vinculos_professor_aluno") as any)
        .update(professorLinkUpdatePayload)
        .eq("id", activeProfessorLink.id);

      if (error) {
        throw new Error("Não foi possível atualizar a hierarquia dos supervisores.");
      }

      continue;
    }

    const professorLinkInsertPayload: ProfessorLinkInsert = {
      professor_id: supervisorId,
      matricula_turma_id: input.enrollmentId,
      responsavel_principal: supervisorIndex === 0,
      ativo: true
    };

    const { error } = await (supabase.from("vinculos_professor_aluno") as any)
      .insert(professorLinkInsertPayload);

    if (error) {
      throw new Error(
        error.message || "Não foi possível criar o vínculo de supervisão para a área."
      );
    }
  }
}

async function syncStudentSemesterAssignments(input: {
  coordinatorId: string;
  studentId: string;
  semester: SemesterRow;
  assignmentsToPersist: PersistableStudentAssignment[];
  areaMap: Map<string, AreaRow>;
  preserveOtherAreas?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const today = buildCurrentDateIso();
  const desiredAreaIds = new Set(
    input.assignmentsToPersist.map((assignment) => assignment.areaId).filter(Boolean)
  );

  const { data: semesterClassData, error: semesterClassError } = await supabase
    .from("turmas")
    .select("*")
    .eq("semestre_id", input.semester.id);

  if (semesterClassError) {
    throw new Error("Não foi possível carregar as turmas operacionais do semestre.");
  }

  const semesterClasses = (semesterClassData ?? []) as ClassRow[];
  const semesterClassMapByArea = new Map<string, ClassRow>();

  for (const semesterClass of semesterClasses) {
    if (semesterClass.area_estagio_id) {
      semesterClassMapByArea.set(semesterClass.area_estagio_id, semesterClass);
    }
  }

  const semesterClassIds = semesterClasses.map((semesterClass) => semesterClass.id);
  const { data: enrollmentData, error: enrollmentError } = semesterClassIds.length
    ? await supabase
        .from("matriculas_turma")
        .select("*")
        .eq("aluno_id", input.studentId)
        .in("turma_id", semesterClassIds)
    : { data: [], error: null };

  if (enrollmentError) {
    throw new Error("Não foi possível consultar os vinculos do aluno neste semestre.");
  }

  const semesterEnrollments = (enrollmentData ?? []) as EnrollmentRow[];
  const enrollmentMapByArea = new Map<
    string,
    {
      enrollment: EnrollmentRow;
      classGroup: ClassRow;
    }
  >();

  for (const enrollment of semesterEnrollments) {
    const classGroup = semesterClasses.find((semesterClass) => semesterClass.id === enrollment.turma_id);

    if (!classGroup?.area_estagio_id) {
      continue;
    }

    enrollmentMapByArea.set(classGroup.area_estagio_id, {
      enrollment,
      classGroup
    });
  }

  const enrollmentIds = semesterEnrollments.map((enrollment) => enrollment.id);
  const { data: professorLinkData, error: professorLinkError } = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (professorLinkError) {
    throw new Error("Não foi possível consultar os supervisores vinculados ao semestre.");
  }

  const professorLinks = (professorLinkData ?? []) as ProfessorLinkRow[];

  for (const assignment of input.assignmentsToPersist) {
    const area = input.areaMap.get(assignment.areaId);

    if (!area) {
      continue;
    }

    let classGroup = semesterClassMapByArea.get(area.id);

    if (!classGroup) {
      classGroup = await findOrCreateAreaClass({
        semester: input.semester,
        area,
        coordinatorId: input.coordinatorId
      });
      semesterClassMapByArea.set(area.id, classGroup);
    }

    const existingEnrollmentEntry = enrollmentMapByArea.get(area.id);
    let enrollment = existingEnrollmentEntry?.enrollment;
    const desiredOfferId =
      classGroup.oferta_curso_unidade_id ?? input.semester.oferta_curso_unidade_id ?? null;

    if (!enrollment) {
      const enrollmentInsertPayload: EnrollmentInsert = {
        turma_id: classGroup.id,
        aluno_id: input.studentId,
        oferta_curso_unidade_id: desiredOfferId,
        status: "ativa"
      };

      const { data: insertedEnrollment, error: insertedEnrollmentError } = await (supabase
        .from("matriculas_turma") as any)
        .insert(enrollmentInsertPayload)
        .select("*")
        .maybeSingle();

      if (insertedEnrollmentError || !insertedEnrollment) {
        throw new Error(
          insertedEnrollmentError?.message ??
            "Não foi possível criar a matrícula do aluno na área selecionada."
        );
      }

      enrollment = insertedEnrollment as EnrollmentRow;
      enrollmentMapByArea.set(area.id, {
        enrollment,
        classGroup
      });
    } else if (enrollment.status !== "ativa") {
      const enrollmentUpdatePayload: EnrollmentUpdate = {
        status: "ativa",
        oferta_curso_unidade_id: desiredOfferId
      };

      const { error } = await (supabase.from("matriculas_turma") as any)
        .update(enrollmentUpdatePayload)
        .eq("id", enrollment.id);

      if (error) {
        throw new Error("Não foi possível reativar a matrícula da área selecionada.");
      }

      enrollment = {
        ...enrollment,
        status: "ativa"
      };

      enrollmentMapByArea.set(area.id, {
        enrollment,
        classGroup
      });
    } else if (enrollment.oferta_curso_unidade_id !== desiredOfferId) {
      const enrollmentUpdatePayload: EnrollmentUpdate = {
        oferta_curso_unidade_id: desiredOfferId
      };

      const { error } = await (supabase.from("matriculas_turma") as any)
        .update(enrollmentUpdatePayload)
        .eq("id", enrollment.id);

      if (error) {
        throw new Error("Não foi possível sincronizar a oferta institucional da matrícula.");
      }

      enrollment = {
        ...enrollment,
        oferta_curso_unidade_id: desiredOfferId
      };

      enrollmentMapByArea.set(area.id, {
        enrollment,
        classGroup
      });
    }

    await syncEnrollmentProfessorLinks({
      enrollmentId: enrollment.id,
      desiredSupervisorIds: assignment.supervisorIds,
      existingProfessorLinks: professorLinks.filter(
        (professorLink) => professorLink.matricula_turma_id === enrollment!.id
      )
    });
  }

  if (!input.preserveOtherAreas) {
    for (const [areaId, existingEnrollmentEntry] of enrollmentMapByArea.entries()) {
      if (desiredAreaIds.has(areaId)) {
        continue;
      }

      if (existingEnrollmentEntry.enrollment.status === "ativa") {
        const enrollmentUpdatePayload: EnrollmentUpdate = {
          status: "cancelada"
        };

        const { error } = await (supabase.from("matriculas_turma") as any)
          .update(enrollmentUpdatePayload)
          .eq("id", existingEnrollmentEntry.enrollment.id);

        if (error) {
          throw new Error("Não foi possível encerrar um vínculo antigo de área.");
        }
      }

      const activeProfessorLinks = professorLinks.filter(
        (professorLink) =>
          professorLink.matricula_turma_id === existingEnrollmentEntry.enrollment.id &&
          professorLink.ativo
      );

      for (const activeProfessorLink of activeProfessorLinks) {
        const professorLinkUpdatePayload: ProfessorLinkUpdate = {
          ativo: false,
          data_fim: today
        };

        const { error } = await (supabase.from("vinculos_professor_aluno") as any)
          .update(professorLinkUpdatePayload)
          .eq("id", activeProfessorLink.id);

        if (error) {
          throw new Error("Não foi possível encerrar um supervisor antigo da área.");
        }
      }
    }
  }
}

function buildStudentRegistrationFieldErrors(message: string) {
  const normalizedMessage = message.toLowerCase();
  const isDuplicateEmail =
    normalizedMessage.includes("email") ||
    normalizedMessage.includes("usuarios_email") ||
    normalizedMessage.includes("users_email");
  const isDuplicateRegistration =
    normalizedMessage.includes("matricula") ||
    normalizedMessage.includes("ra") ||
    normalizedMessage.includes("alunos_unidade_id_matricula");

  return {
    ...(isDuplicateEmail ? { email: "Use um e-mail ainda não cadastrado." } : {}),
    ...(isDuplicateRegistration ? { ra: "Use um RA ainda não cadastrado." } : {})
  };
}

function buildProfileConflictLabel(profileCode: ProfileRow["codigo"]) {
  switch (profileCode) {
    case "coordenador":
      return "coordenador";
    case "coordenador_master":
      return "coordenador master";
    case "professor":
      return "professor";
    default:
      return "usuário";
  }
}

async function updateExistingStudentBaseRegistration(input: {
  userId: string;
  unitId: string;
  name: string;
  email: string;
  registration: string;
  cellphone: string;
  courseId: string | null;
  courseName: string | null;
  offerId: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  const userUpdatePayload: UserUpdate = {
    unidade_id: input.unitId,
    nome_completo: input.name,
    email: input.email
  };
  const studentUpdatePayload: StudentUpdate = {
    unidade_id: input.unitId,
    matricula: input.registration,
    celular: input.cellphone,
    curso: input.courseName ?? "Fisioterapia",
    curso_id: input.courseId,
    oferta_curso_unidade_id: input.offerId
  };

  const { error: userUpdateError } = await (supabase.from("usuarios") as any)
    .update(userUpdatePayload)
    .eq("id", input.userId)
    .eq("unidade_id", input.unitId);

  if (userUpdateError) {
    throw new Error(userUpdateError.message);
  }

  const { error: studentUpdateError } = await (supabase.from("alunos") as any)
    .update(studentUpdatePayload)
    .eq("usuario_id", input.userId);

  if (studentUpdateError) {
    throw new Error(studentUpdateError.message);
  }
}

async function applyExistingStudentResolution(input: {
  userId: string;
  unitId: string;
  operationalScope: ResolvedOperationalScope;
  currentUser: SessionUser;
  submittedFormValues: StudentRegistrationFormValues;
  parsedData: z.infer<typeof studentRegistrationSchema>;
  validatedSemester: SemesterRow | null;
  validatedAreaMap: Map<string, AreaRow>;
  assignmentsToPersist: PersistableStudentAssignment[];
  resolution: Extract<ExistingStudentResolutionAction, "reactivate" | "link">;
}) {
  if (input.resolution === "link") {
    if (!input.validatedSemester) {
      return buildStudentErrorState(
        "Selecione um semestre inicial antes de vincular o aluno existente ao ciclo atual.",
        {
          semestre_id: "Escolha um semestre inicial para criar o vínculo acadêmico."
        },
        input.submittedFormValues
      );
    }

    if (!input.assignmentsToPersist.some((assignment) => assignment.areaId)) {
      return buildStudentErrorState(
        "Selecione ao menos uma área de estágio para vincular o aluno ao semestre atual.",
        {
          semestre_id: "O vínculo ao semestre atual precisa de ao menos uma área."
        },
        input.submittedFormValues
      );
    }
  }

  try {
    await updateExistingStudentBaseRegistration({
      userId: input.userId,
      unitId: input.unitId,
      name: input.parsedData.nome_completo,
      email: input.parsedData.email,
      registration: input.parsedData.ra,
      cellphone: input.parsedData.celular,
      courseId: input.operationalScope.courseId,
      courseName: input.operationalScope.courseName,
      offerId: input.operationalScope.offerId
    });

    if (input.resolution === "reactivate") {
      const adminClient = createSupabaseAdminClient();
      const { error: authError } = await adminClient.auth.admin.updateUserById(input.userId, {
        password: input.parsedData.senha,
        email_confirm: true
      });

      if (authError) {
        throw new Error(authError.message);
      }
    }

    const linkedAssignments = input.assignmentsToPersist.filter((assignment) => assignment.areaId);

    if (input.validatedSemester && linkedAssignments.length) {
      await syncStudentSemesterAssignments({
        coordinatorId: input.currentUser.id,
        studentId: input.userId,
        semester: input.validatedSemester,
        assignmentsToPersist: linkedAssignments,
        areaMap: input.validatedAreaMap,
        preserveOtherAreas: true
      });
    }

    const reconciliation = await reconcileStudentOperationalAccess([input.userId]);
    const isOperationallyActive = reconciliation.activatedIds.includes(input.userId);

    revalidateAcademicViews(input.userId);

    if (input.resolution === "reactivate") {
      if (linkedAssignments.length && input.validatedSemester) {
        return buildStudentSuccessState(
          isOperationallyActive
            ? `Cadastro-base reaproveitado. O aluno foi reativado, teve a senha redefinida e já ficou apto para o semestre ${input.validatedSemester.codigo}.`
            : `Cadastro-base reaproveitado. A senha foi redefinida e os vínculos do semestre ${input.validatedSemester.codigo} foram preparados sem duplicar o histórico. O acesso operacional será liberado quando houver vínculo ativo em semestre ativo.`
        );
      }

      return buildStudentSuccessState(
        isOperationallyActive
          ? "Cadastro-base reaproveitado. O aluno foi reativado e a senha de acesso foi redefinida."
          : "Cadastro-base reaproveitado. A senha foi redefinida e o histórico foi preservado. O acesso operacional continuará seguindo os vínculos ativos do aluno."
      );
    }

    return buildStudentSuccessState(
      isOperationallyActive && input.validatedSemester
        ? `Cadastro-base reaproveitado e vinculado ao semestre ${input.validatedSemester.codigo} sem duplicar o aluno.`
        : input.validatedSemester
          ? `Cadastro-base reaproveitado e vínculo do semestre ${input.validatedSemester.codigo} atualizado sem duplicar a pessoa.`
          : "Cadastro-base reaproveitado sem duplicar o aluno."
    );
  } catch (error) {
    const resolvedMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível reaproveitar o cadastro-base do aluno.";

    return buildStudentErrorState(
      resolvedMessage,
      buildStudentRegistrationFieldErrors(resolvedMessage),
      input.submittedFormValues
    );
  }
}

async function cleanupCreatedStudentData(input: {
  authUserId?: string | null;
  userId?: string | null;
  enrollmentIds: string[];
  professorLinkIds: string[];
}) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (input.professorLinkIds.length) {
    await (supabase.from("vinculos_professor_aluno") as any)
      .delete()
      .in("id", input.professorLinkIds);
  }

  if (input.enrollmentIds.length) {
    await (supabase.from("matriculas_turma") as any)
      .delete()
      .in("id", input.enrollmentIds);
  }

  if (input.userId) {
    await (supabase.from("usuarios") as any).delete().eq("id", input.userId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

async function cleanupCreatedCoordinatorDataForCourseManager(input: {
  authUserId?: string | null;
  userId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (input.userId) {
    await (supabase.from("usuarios_papeis_contexto") as any).delete().eq("usuario_id", input.userId);
    await (supabase.from("coordenadores") as any).delete().eq("usuario_id", input.userId);
    await (supabase.from("usuarios") as any).delete().eq("id", input.userId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

async function cleanupCreatedProfessorData(input: {
  authUserId?: string | null;
  userId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  if (input.userId) {
    await (supabase.from("usuarios_papeis_contexto") as any)
      .delete()
      .eq("usuario_id", input.userId);
    await (supabase.from("professor_areas_estagio") as any)
      .delete()
      .eq("professor_id", input.userId);
    await (supabase.from("professores") as any)
      .delete()
      .eq("usuario_id", input.userId);
    await (supabase.from("usuarios") as any).delete().eq("id", input.userId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

function buildStudentSuccessMessage(assignmentCount: number, professorLinkCount: number) {
  if (assignmentCount === 0) {
    return "Aluno cadastrado com sucesso. Nenhum vinculo operacional foi criado neste momento.";
  }

  return `Aluno cadastrado com sucesso e vinculado a ${assignmentCount} área(s) do semestre, com ${professorLinkCount} supervisor(es) associado(s).`;
}

function revalidateAcademicViews(studentId?: string) {
  revalidatePath("/gestao/alunos");

  if (studentId) {
    revalidatePath(`/gestao/alunos/${studentId}`);
  }

  revalidatePath("/coordenador");
  revalidatePath("/professor");
  revalidatePath("/secretaria");
  revalidatePath("/aluno");
  revalidatePath("/relatorios");
  revalidatePath("/auditoria");
  revalidatePath("/master-curso");
}

function buildRedirectPathWithNotice(
  path: string,
  noticeType: "success" | "error",
  message: string
) {
  const targetUrl = new URL(path, "http://localhost");
  targetUrl.searchParams.set("notice", message);
  targetUrl.searchParams.set("notice_type", noticeType);
  return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function redirectWithManagementNotice(
  path: string,
  noticeType: "success" | "error",
  message: string
): never {
  redirect(buildRedirectPathWithNotice(path, noticeType, message) as any);
}

function buildDeletionBlockedMessage(input: {
  evaluationCount: number;
  itemCount: number;
  absenceCount: number;
}) {
  const details: string[] = [];

  if (input.evaluationCount > 0) {
    details.push(`${input.evaluationCount} avaliação(ões)`);
  }

  if (input.itemCount > 0) {
    details.push(`${input.itemCount} item(ns) avaliado(s)`);
  }

  if (input.absenceCount > 0) {
    details.push(`${input.absenceCount} falta(s) registrada(s)`);
  }

  if (!details.length) {
    return "Este cadastro possui histórico e não pode ser excluído. Use a opção Desativar.";
  }

  return `Este cadastro possui histórico (${details.join(", ")}) e não pode ser excluído. Use a opção Desativar.`;
}

function buildSemesterDiscardBlockedMessage(input: {
  semesterCode: string;
  evaluationCount: number;
  itemCount: number;
  absenceCount: number;
}) {
  const details: string[] = [];

  if (input.evaluationCount > 0) {
    details.push(`${input.evaluationCount} avaliação(ões)`);
  }

  if (input.itemCount > 0) {
    details.push(`${input.itemCount} item(ns) avaliado(s)`);
  }

  if (input.absenceCount > 0) {
    details.push(`${input.absenceCount} falta(s) registrada(s)`);
  }

  if (!details.length) {
    return `O semestre ${input.semesterCode} possui histórico acadêmico relevante e não pode ser descartado. Preserve-o no sistema para manter o histórico e a auditoria.`;
  }

  return `O semestre ${input.semesterCode} possui histórico acadêmico (${details.join(", ")}) e não pode ser descartado. Preserve-o no sistema para manter o histórico e a auditoria.`;
}

async function deleteAuditRowsByTableRecordIds(
  tableName: AuditRow["tabela"],
  recordIds: string[]
) {
  if (!recordIds.length) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const uniqueRecordIds = [...new Set(recordIds)];
  const { error } = await (adminClient.from("historico_alteracoes") as any)
    .delete()
    .eq("tabela", tableName)
    .in("registro_id", uniqueRecordIds);

  if (error) {
    throw new Error("Não foi possível limpar a auditoria do cadastro excluido.");
  }
}

async function deleteAuditRowsByActor(userId: string) {
  const adminClient = createSupabaseAdminClient();
  const { error } = await (adminClient.from("historico_alteracoes") as any)
    .delete()
    .eq("usuario_id", userId);

  if (error) {
    throw new Error("Não foi possível limpar a autoria de auditoria do cadastro excluido.");
  }
}

async function purgeStudentAuditTrail(input: {
  userId: string;
  enrollmentIds: string[];
  professorLinkIds: string[];
}) {
  await deleteAuditRowsByTableRecordIds("vinculos_professor_aluno", input.professorLinkIds);
  await deleteAuditRowsByTableRecordIds("matriculas_turma", input.enrollmentIds);
  await deleteAuditRowsByTableRecordIds("alunos", [input.userId]);
  await deleteAuditRowsByTableRecordIds("usuarios", [input.userId]);
  await deleteAuditRowsByActor(input.userId);
}

async function purgeProfessorAuditTrail(input: {
  userId: string;
  professorAreaIds: string[];
  professorLinkIds: string[];
}) {
  await deleteAuditRowsByTableRecordIds("vinculos_professor_aluno", input.professorLinkIds);
  await deleteAuditRowsByTableRecordIds(
    "professor_areas_estagio",
    input.professorAreaIds
  );
  await deleteAuditRowsByTableRecordIds("professores", [input.userId]);
  await deleteAuditRowsByTableRecordIds("usuarios", [input.userId]);
  await deleteAuditRowsByActor(input.userId);
}

async function purgeSecretaryAuditTrail(userId: string) {
  await deleteAuditRowsByTableRecordIds("usuarios", [userId]);
  await deleteAuditRowsByActor(userId);
}

async function purgeSemesterAuditTrail(input: {
  semesterId: string;
  classIds: string[];
  enrollmentIds: string[];
  professorLinkIds: string[];
}) {
  await deleteAuditRowsByTableRecordIds("vinculos_professor_aluno", input.professorLinkIds);
  await deleteAuditRowsByTableRecordIds("matriculas_turma", input.enrollmentIds);
  await deleteAuditRowsByTableRecordIds("turmas", input.classIds);
  await deleteAuditRowsByTableRecordIds("semestres", [input.semesterId]);
}

async function loadUserProfileCode(input: {
  userId: string;
  expectedProfileCode: "aluno" | "professor" | "secretaria";
  currentUnitId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase
    .from("usuarios")
    .select("id, perfil_id, ativo")
    .eq("id", input.userId)
    .eq("unidade_id", input.currentUnitId)
    .maybeSingle();
  const resolvedUserData = (userData ?? null) as
    | Pick<UserRow, "id" | "perfil_id" | "ativo">
    | null;

  if (userError || !resolvedUserData) {
    throw new Error("Cadastro não encontrado para esta operacao.");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("perfis")
    .select("codigo")
    .eq("id", resolvedUserData.perfil_id)
    .maybeSingle();
  const resolvedProfileData = (profileData ?? null) as Pick<ProfileRow, "codigo"> | null;

  if (
    profileError ||
    !resolvedProfileData ||
    resolvedProfileData.codigo !== input.expectedProfileCode
  ) {
    throw new Error("Perfil invalido para esta operacao.");
  }

  return resolvedUserData;
}

async function assessStudentDeletionSafety(userId: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("id")
    .eq("aluno_id", userId);

  if (enrollmentError) {
    throw new Error("Não foi possível consultar as matriculas do aluno.");
  }

  const enrollments = ((enrollmentData ?? []) as Array<Pick<EnrollmentRow, "id">>).map(
    (enrollment) => enrollment.id
  );

  const professorLinksResult = enrollments.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("id")
        .in("matricula_turma_id", enrollments)
    : { data: [], error: null };
  const evaluationsResult = enrollments.length
    ? await supabase.from("avaliacoes").select("id").in("matricula_turma_id", enrollments)
    : { data: [], error: null };
  const absencesResult = enrollments.length
    ? await supabase
        .from("ausencias")
        .select("id", { count: "exact" })
        .in("matricula_turma_id", enrollments)
    : { data: [], count: 0, error: null };

  if (
    professorLinksResult.error ||
    evaluationsResult.error ||
    absencesResult.error
  ) {
    throw new Error("Não foi possível validar o histórico operacional do aluno.");
  }

  const professorLinkIds = (
    (professorLinksResult.data ?? []) as Array<Pick<ProfessorLinkRow, "id">>
  ).map((link) => link.id);
  const evaluationIds = (
    (evaluationsResult.data ?? []) as Array<{ id: string }>
  ).map((evaluation) => evaluation.id);
  const evaluationCount = evaluationIds.length;
  const absenceCount = absencesResult.count ?? 0;

  let itemCount = 0;

  if (evaluationIds.length) {
    const { count, error } = await adminClient
      .from("itens_avaliados")
      .select("id", { count: "exact", head: true })
      .in("avaliacao_id", evaluationIds);

    if (error) {
      throw new Error("Não foi possível validar os itens avaliados do aluno.");
    }

    itemCount = count ?? 0;
  }

  return {
    enrollmentIds: enrollments,
    professorLinkIds,
    evaluationCount,
    itemCount,
    absenceCount,
    canDelete: evaluationCount === 0 && itemCount === 0 && absenceCount === 0
  };
}

async function assessProfessorDeletionSafety(userId: string) {
  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const [professorAreaResult, professorLinksResult, directEvaluationsResult] =
    await Promise.all([
      supabase.from("professor_areas_estagio").select("id").eq("professor_id", userId),
      supabase
        .from("vinculos_professor_aluno")
        .select("id, matricula_turma_id")
        .eq("professor_id", userId),
      supabase.from("avaliacoes").select("id").eq("professor_id", userId)
    ]);

  if (
    professorAreaResult.error ||
    professorLinksResult.error ||
    directEvaluationsResult.error
  ) {
    throw new Error("Não foi possível validar o histórico operacional do professor.");
  }

  const professorAreaIds = (
    (professorAreaResult.data ?? []) as Array<{ id: string }>
  ).map((link) => link.id);
  const professorLinks = (professorLinksResult.data ?? []) as Array<{
    id: string;
    matricula_turma_id: string;
  }>;
  const professorLinkIds = professorLinks.map((link) => link.id);
  const linkedEnrollmentIds = [...new Set(professorLinks.map((link) => link.matricula_turma_id))];
  const directEvaluationIds = (
    (directEvaluationsResult.data ?? []) as Array<{ id: string }>
  ).map((evaluation) => evaluation.id);

  const linkedEvaluationsResult = linkedEnrollmentIds.length
    ? await supabase
        .from("avaliacoes")
        .select("id")
        .in("matricula_turma_id", linkedEnrollmentIds)
    : { data: [], error: null };
  const absencesResult = linkedEnrollmentIds.length
    ? await supabase
        .from("ausencias")
        .select("id", { count: "exact" })
        .in("matricula_turma_id", linkedEnrollmentIds)
    : { data: [], count: 0, error: null };

  if (linkedEvaluationsResult.error || absencesResult.error) {
    throw new Error("Não foi possível validar os vínculos do professor com histórico.");
  }

  const linkedEvaluationIds = (
    (linkedEvaluationsResult.data ?? []) as Array<{ id: string }>
  ).map((evaluation) => evaluation.id);
  const allEvaluationIds = [...new Set([...directEvaluationIds, ...linkedEvaluationIds])];
  const evaluationCount = allEvaluationIds.length;
  const absenceCount = absencesResult.count ?? 0;

  let itemCount = 0;

  if (allEvaluationIds.length) {
    const { count, error } = await adminClient
      .from("itens_avaliados")
      .select("id", { count: "exact", head: true })
      .in("avaliacao_id", allEvaluationIds);

    if (error) {
      throw new Error("Não foi possível validar os itens avaliados ligados ao professor.");
    }

    itemCount = count ?? 0;
  }

  return {
    professorAreaIds,
    professorLinkIds,
    evaluationCount,
    itemCount,
    absenceCount,
    canDelete: evaluationCount === 0 && itemCount === 0 && absenceCount === 0
  };
}

async function assessSemesterDiscardSafety(input: {
  semesterId: string;
  unitId: string;
  offerId: string | null;
}) {
  const { supabase, semester, classRows, enrollmentRows } =
    await loadSemesterOperationalContext({
      semesterId: input.semesterId,
      operationalScope: {
        unitId: input.unitId,
        instituicaoId: null,
        courseId: null,
        courseName: null,
        offerId: input.offerId
      }
    });
  const adminClient = createSupabaseAdminClient();
  const classIds = classRows.map((classGroup) => classGroup.id);
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const affectedStudentIds = uniqueStringValues(
    enrollmentRows.map((enrollment) => enrollment.aluno_id)
  );

  const professorLinksResult = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("id")
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };
  const evaluationsResult = await supabase
    .from("avaliacoes")
    .select("id")
    .eq("semestre_id", input.semesterId);
  const absencesResult = enrollmentIds.length
    ? await supabase
        .from("ausencias")
        .select("id", { count: "exact" })
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], count: 0, error: null };

  if (
    professorLinksResult.error ||
    evaluationsResult.error ||
    absencesResult.error
  ) {
    throw new Error("Não foi possível validar o histórico acadêmico deste semestre.");
  }

  const professorLinkIds = (
    (professorLinksResult.data ?? []) as Array<Pick<ProfessorLinkRow, "id">>
  ).map((link) => link.id);
  const evaluationIds = (
    (evaluationsResult.data ?? []) as Array<{ id: string }>
  ).map((evaluation) => evaluation.id);
  const evaluationCount = evaluationIds.length;
  const absenceCount = absencesResult.count ?? 0;

  let itemCount = 0;

  if (evaluationIds.length) {
    const { count, error } = await adminClient
      .from("itens_avaliados")
      .select("id", { count: "exact", head: true })
      .in("avaliacao_id", evaluationIds);

    if (error) {
      throw new Error("Não foi possível validar os itens avaliados deste semestre.");
    }

    itemCount = count ?? 0;
  }

  return {
    semester,
    classIds,
    enrollmentIds,
    affectedStudentIds,
    professorLinkIds,
    evaluationCount,
    itemCount,
    absenceCount,
    canDelete: evaluationCount === 0 && itemCount === 0 && absenceCount === 0
  };
}

async function deleteStudentSafely(userId: string) {
  const adminClient = createSupabaseAdminClient();
  const safety = await assessStudentDeletionSafety(userId);

  if (!safety.canDelete) {
    return {
      deleted: false as const,
      message: buildDeletionBlockedMessage(safety)
    };
  }

  if (safety.professorLinkIds.length) {
    const { error } = await (adminClient.from("vinculos_professor_aluno") as any)
      .delete()
      .in("id", safety.professorLinkIds);

    if (error) {
      throw new Error("Não foi possível remover os vínculos de supervisão do aluno.");
    }
  }

  if (safety.enrollmentIds.length) {
    const { error } = await (adminClient.from("matriculas_turma") as any)
      .delete()
      .in("id", safety.enrollmentIds);

    if (error) {
      throw new Error("Não foi possível remover as matriculas operacionais do aluno.");
    }
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    throw new Error(authDeleteError.message);
  }

  await purgeStudentAuditTrail({
    userId,
    enrollmentIds: safety.enrollmentIds,
    professorLinkIds: safety.professorLinkIds
  });

  return {
    deleted: true as const,
    message:
      "Cadastro excluído com sucesso. O sistema removeu apenas matrículas e vínculos sem histórico relevante."
  };
}

async function deleteProfessorSafely(userId: string) {
  const adminClient = createSupabaseAdminClient();
  const safety = await assessProfessorDeletionSafety(userId);

  if (!safety.canDelete) {
    return {
      deleted: false as const,
      message: buildDeletionBlockedMessage(safety)
    };
  }

  if (safety.professorLinkIds.length) {
    const { error } = await (adminClient.from("vinculos_professor_aluno") as any)
      .delete()
      .in("id", safety.professorLinkIds);

    if (error) {
      throw new Error("Não foi possível remover os vinculos do professor com alunos.");
    }
  }

  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    throw new Error(authDeleteError.message);
  }

  await purgeProfessorAuditTrail({
    userId,
    professorAreaIds: safety.professorAreaIds,
    professorLinkIds: safety.professorLinkIds
  });

  return {
    deleted: true as const,
    message:
      "Cadastro excluído com sucesso. O sistema removeu apenas vínculos e áreas sem histórico relevante."
  };
}

async function deleteSecretarySafely(userId: string) {
  const adminClient = createSupabaseAdminClient();
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    throw new Error(authDeleteError.message);
  }

  await purgeSecretaryAuditTrail(userId);

  return {
    deleted: true as const,
    message: "Cadastro da secretária excluído com sucesso."
  };
}

async function deleteSemesterSafely(input: {
  semesterId: string;
  unitId: string;
  offerId: string | null;
}) {
  const adminClient = createSupabaseAdminClient();
  const safety = await assessSemesterDiscardSafety(input);

  if (!safety.canDelete) {
    return {
      deleted: false as const,
      message: buildSemesterDiscardBlockedMessage({
        semesterCode: safety.semester.codigo,
        evaluationCount: safety.evaluationCount,
        itemCount: safety.itemCount,
        absenceCount: safety.absenceCount
      })
    };
  }

  if (safety.professorLinkIds.length) {
    const { error } = await (adminClient.from("vinculos_professor_aluno") as any)
      .delete()
      .in("id", safety.professorLinkIds);

    if (error) {
      throw new Error(
        "Não foi possível remover os vínculos de supervisão do semestre descartável."
      );
    }
  }

  if (safety.enrollmentIds.length) {
    const { error } = await (adminClient.from("matriculas_turma") as any)
      .delete()
      .in("id", safety.enrollmentIds);

    if (error) {
      throw new Error(
        "Não foi possível remover as matrículas operacionais do semestre descartável."
      );
    }
  }

  if (safety.classIds.length) {
    const { error } = await (adminClient.from("turmas") as any)
      .delete()
      .in("id", safety.classIds);

    if (error) {
      throw new Error(
        "Não foi possível remover as turmas operacionais do semestre descartável."
      );
    }
  }

  const { error: semesterDeleteError } = await (adminClient.from("semestres") as any)
    .delete()
    .eq("id", safety.semester.id);

  if (semesterDeleteError) {
    throw new Error("Não foi possível remover o semestre descartável.");
  }

  await purgeSemesterAuditTrail({
    semesterId: safety.semester.id,
    classIds: safety.classIds,
    enrollmentIds: safety.enrollmentIds,
    professorLinkIds: safety.professorLinkIds
  });

  const reconciliation = await reconcileStudentOperationalAccess(
    safety.affectedStudentIds
  );
  const recalculatedStudentCount =
    reconciliation.activatedIds.length + reconciliation.deactivatedIds.length;

  return {
    deleted: true as const,
    message: `Semestre ${safety.semester.codigo} descartado com sucesso. O código ficou liberado para novo cadastro${
      recalculatedStudentCount
        ? ` e ${recalculatedStudentCount} aluno(s) tiveram o acesso operacional recalculado.`
        : "."
    }`
  };
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

async function studentHasOperationalActiveSemester(studentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: enrollmentRowsData, error: enrollmentRowsError } = await supabase
    .from("matriculas_turma")
    .select("turma_id")
    .eq("aluno_id", studentId)
    .eq("status", "ativa");

  if (enrollmentRowsError) {
    throw new Error(
      "Não foi possível validar as matrículas operacionais do aluno."
    );
  }

  const classIds = uniqueStringValues(
    ((enrollmentRowsData ?? []) as Array<Pick<EnrollmentRow, "turma_id">>).map(
      (enrollment) => enrollment.turma_id
    )
  );

  if (!classIds.length) {
    return false;
  }

  const { data: classRowsData, error: classRowsError } = await supabase
    .from("turmas")
    .select("semestre_id")
    .in("id", classIds);

  if (classRowsError) {
    throw new Error("Não foi possível validar as turmas operacionais do aluno.");
  }

  const semesterIds = uniqueStringValues(
    ((classRowsData ?? []) as Array<Pick<ClassRow, "semestre_id">>).map(
      (classGroup) => classGroup.semestre_id
    )
  );

  if (!semesterIds.length) {
    return false;
  }

  const { data: semesterRowsData, error: semesterRowsError } = await supabase
    .from("semestres")
    .select("id")
    .in("id", semesterIds)
    .eq("status", "ativo")
    .limit(1);

  if (semesterRowsError) {
    throw new Error("Não foi possível validar o semestre operacional do aluno.");
  }

  return ((semesterRowsData ?? []) as Array<Pick<SemesterRow, "id">>).length > 0;
}

async function studentAlreadyLinkedToSemester(studentId: string, semesterId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: classRowsData, error: classRowsError } = await supabase
    .from("turmas")
    .select("id")
    .eq("semestre_id", semesterId);

  if (classRowsError) {
    throw new Error("Não foi possível validar as turmas do semestre informado.");
  }

  const classIds = uniqueStringValues(
    ((classRowsData ?? []) as Array<Pick<ClassRow, "id">>).map((classGroup) => classGroup.id)
  );

  if (!classIds.length) {
    return false;
  }

  const { data: enrollmentRowsData, error: enrollmentRowsError } = await supabase
    .from("matriculas_turma")
    .select("id")
    .eq("aluno_id", studentId)
    .in("turma_id", classIds)
    .limit(1);

  if (enrollmentRowsError) {
    throw new Error("Não foi possível validar o vínculo atual do aluno com o semestre.");
  }

  return ((enrollmentRowsData ?? []) as Array<Pick<EnrollmentRow, "id">>).length > 0;
}

async function loadExistingStudentLookup(input: {
  email: string;
  currentUnitId: string;
  selectedSemesterId?: string;
}): Promise<ExistingStudentLookupResult> {
  const adminClient = createSupabaseAdminClient();
  const { data: userData, error: userError } = await adminClient
    .from("usuarios")
    .select("id, perfil_id, unidade_id, email, nome_completo, ativo")
    .eq("email", input.email)
    .maybeSingle();

  const resolvedUserData = (userData ?? null) as
    | Pick<UserRow, "id" | "perfil_id" | "unidade_id" | "email" | "nome_completo" | "ativo">
    | null;

  if (userError) {
    throw new Error("Não foi possível verificar se o e-mail informado já está cadastrado.");
  }

  if (!resolvedUserData) {
    return {
      kind: "none"
    };
  }

  const { data: profileData, error: profileError } = await adminClient
    .from("perfis")
    .select("codigo")
    .eq("id", resolvedUserData.perfil_id)
    .maybeSingle();

  const resolvedProfileData = (profileData ?? null) as Pick<ProfileRow, "codigo"> | null;

  if (profileError || !resolvedProfileData) {
    return {
      kind: "inconsistent",
      message: "O e-mail informado já existe, mas o perfil do cadastro não pôde ser identificado."
    };
  }

  if (!resolvedUserData.unidade_id || resolvedUserData.unidade_id !== input.currentUnitId) {
    const { data: unitData } = resolvedUserData.unidade_id
      ? await adminClient
          .from("unidades")
          .select("nome")
          .eq("id", resolvedUserData.unidade_id)
          .maybeSingle()
      : { data: null };

    return {
      kind: "different_unit",
      unitName:
        ((unitData ?? null) as Pick<Database["public"]["Tables"]["unidades"]["Row"], "nome"> | null)
          ?.nome ?? "outra unidade"
    };
  }

  if (resolvedProfileData.codigo !== "aluno") {
    return {
      kind: "different_profile",
      profileCode: resolvedProfileData.codigo
    };
  }

  const { data: studentData, error: studentError } = await adminClient
    .from("alunos")
    .select("usuario_id, matricula")
    .eq("usuario_id", resolvedUserData.id)
    .maybeSingle();

  const resolvedStudentData = (studentData ?? null) as
    | Pick<StudentRow, "usuario_id" | "matricula">
    | null;

  if (studentError || !resolvedStudentData) {
    return {
      kind: "inconsistent",
      message:
        "O e-mail informado já existe, mas o cadastro-base do aluno está incompleto."
    };
  }

  const [hasOperationalActiveSemester, selectedSemesterLinked] = await Promise.all([
    studentHasOperationalActiveSemester(resolvedUserData.id),
    input.selectedSemesterId
      ? studentAlreadyLinkedToSemester(resolvedUserData.id, input.selectedSemesterId)
      : Promise.resolve(false)
  ]);

  return {
    kind: "same_unit_student",
    user: resolvedUserData,
    student: resolvedStudentData,
    hasOperationalActiveSemester,
    selectedSemesterLinked
  };
}

function buildStudentConflictInfo(input: {
  lookup: Extract<ExistingStudentLookupResult, { kind: "same_unit_student" }>;
  semester: SemesterRow | null;
  assignmentsToPersist: PersistableStudentAssignment[];
}): StudentRegistrationConflictInfo {
  const canLinkCurrentSemester =
    Boolean(input.semester) && input.assignmentsToPersist.some((assignment) => assignment.areaId);
  const linkDisabledReason = !input.semester
    ? "Selecione um semestre inicial para criar o vínculo acadêmico deste aluno."
    : !input.assignmentsToPersist.some((assignment) => assignment.areaId)
      ? "Selecione ao menos uma área de estágio para vincular o aluno ao semestre informado."
      : null;

  return {
    userId: input.lookup.user.id,
    name: input.lookup.user.nome_completo,
    email: input.lookup.user.email,
    registration: input.lookup.student.matricula,
    isActive: input.lookup.user.ativo,
    hasOperationalActiveSemester: input.lookup.hasOperationalActiveSemester,
    selectedSemesterLinked: input.lookup.selectedSemesterLinked,
    selectedSemesterLabel: input.semester ? input.semester.codigo : null,
    canLinkCurrentSemester,
    linkDisabledReason
  };
}

async function updateUserActivation(input: {
  userId: string;
  nextActive: boolean;
  expectedProfileCode: "aluno" | "professor" | "secretaria";
  currentUnitId: string;
}) {
  const supabase = await createSupabaseServerClient();
  await loadUserProfileCode(input);

  const userUpdatePayload: UserUpdate = {
    ativo: input.nextActive
  };

  const { error: updateError } = await (supabase.from("usuarios") as any)
    .update(userUpdatePayload)
    .eq("id", input.userId)
    .eq("unidade_id", input.currentUnitId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await syncAuthUserActivation(input.userId, input.nextActive);

  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/professor");
  revalidatePath("/secretaria");
  revalidatePath("/aluno");
  revalidatePath("/relatorios");
  revalidatePath("/auditoria");
}

export async function createStudentRegistrationAction(
  _previousState: StudentRegistrationActionState,
  formData: FormData
): Promise<StudentRegistrationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const submittedFormValues = buildStudentFormValues(formData);
  const requestedResolution = readExistingStudentResolutionAction(formData);
  const expectedExistingUserId = readStringField(formData, "existing_student_user_id");

  if (requestedResolution === "cancel") {
    return buildStudentIdleState(submittedFormValues);
  }

  const parsedData = studentRegistrationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildStudentErrorState(
      "Revise os campos obrigatorios do cadastro do aluno.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const assignmentsToPersist = collectAssignmentsToPersist(parsedData.data.assignments);
  const assignmentFieldErrors = validateAssignmentStructure(assignmentsToPersist);

  if (assignmentsToPersist.length > 0 && !parsedData.data.semestre_id) {
    assignmentFieldErrors.semestre_id =
      "Selecione um semestre antes de aplicar vínculos de estágio.";
  }

  if (
    parsedData.data.semestre_id &&
    !z.string().uuid().safeParse(parsedData.data.semestre_id).success
  ) {
    assignmentFieldErrors.semestre_id = "Selecione um semestre valido.";
  }

  if (Object.keys(assignmentFieldErrors).length > 0) {
    return buildStudentErrorState(
      "Revise os vínculos de área e supervisão do aluno.",
      assignmentFieldErrors,
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);
  const profileMap = await loadProfileMap();
  let validatedSemester: SemesterRow | null = null;
  let validatedAreaMap = new Map<string, AreaRow>();

  if (assignmentsToPersist.length > 0 && parsedData.data.semestre_id) {
    const validationContext = await loadAssignmentValidationContext({
      currentUser,
      operationalScope,
      semesterId: parsedData.data.semestre_id,
      assignmentsToPersist
    });

    if (validationContext.semesterResult.error || !validationContext.semesterResult.data) {
      return buildStudentErrorState(
        "Não foi possível localizar o semestre selecionado.",
        { semestre_id: "Selecione um semestre valido." },
        submittedFormValues
      );
    }

    if (validationContext.areaResult.error) {
      return buildStudentErrorState(
        "Não foi possível carregar as áreas de estágio selecionadas.",
        {},
        submittedFormValues
      );
    }

    if (
      validationContext.professorAreaResult.error ||
      validationContext.professorUsersResult.error
    ) {
      return buildStudentErrorState(
        "Não foi possível validar os supervisores selecionados.",
        {},
        submittedFormValues
      );
    }

    const assignmentValidation = validateAssignmentsAgainstLoadedContext({
      assignmentsToPersist,
      areaRows: (validationContext.areaResult.data ?? []) as AreaRow[],
      professorAreaRows:
        (validationContext.professorAreaResult.data ?? []) as ProfessorAreaRow[],
      professorUsers: (validationContext.professorUsersResult.data ?? []) as UserRow[]
    });

    if (Object.keys(assignmentValidation.fieldErrors).length > 0) {
      return buildStudentErrorState(
        "Revise os vínculos de área e supervisão do aluno.",
        assignmentValidation.fieldErrors,
        submittedFormValues
      );
    }

    validatedSemester = validationContext.semesterResult.data as SemesterRow;
    validatedAreaMap = assignmentValidation.areaMap;
  }

  const studentProfile = profileMap.get("aluno");

  if (!studentProfile) {
    return buildStudentErrorState(
      "O perfil de aluno não está configurado no banco.",
      {},
      submittedFormValues
    );
  }

  let existingStudentLookup: ExistingStudentLookupResult;

  try {
    existingStudentLookup = await loadExistingStudentLookup({
      email: parsedData.data.email,
      currentUnitId: coordinatorUnitId,
      selectedSemesterId: validatedSemester?.id
    });
  } catch (error) {
    return buildStudentErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível verificar o reaproveitamento do cadastro-base do aluno.",
      {},
      submittedFormValues
    );
  }

  if (requestedResolution && existingStudentLookup.kind === "none") {
    return buildStudentErrorState(
      "O e-mail foi alterado depois da detecção do cadastro existente. Revise os dados e envie novamente para continuar.",
      {
        email: "Revise o e-mail antes de confirmar o reaproveitamento deste cadastro."
      },
      submittedFormValues
    );
  }

  if (existingStudentLookup.kind === "different_unit") {
    return buildStudentErrorState(
      `Já existe um cadastro com este e-mail vinculado à unidade ${existingStudentLookup.unitName}. O reaproveitamento automático do aluno só pode ser feito dentro da própria unidade.`,
      {
        email: "Este e-mail já pertence a outra unidade."
      },
      submittedFormValues
    );
  }

  if (existingStudentLookup.kind === "different_profile") {
    return buildStudentErrorState(
      `Este e-mail já está em uso por um ${buildProfileConflictLabel(
        existingStudentLookup.profileCode
      )}. O cadastro-base do aluno não pode sobrescrever outro perfil institucional.`,
      {
        email: "Este e-mail já está vinculado a outro perfil de acesso."
      },
      submittedFormValues
    );
  }

  if (existingStudentLookup.kind === "inconsistent") {
    return buildStudentErrorState(
      existingStudentLookup.message,
      {
        email: "Existe um cadastro incompleto com este e-mail."
      },
      submittedFormValues
    );
  }

  if (existingStudentLookup.kind === "same_unit_student") {
    if (!requestedResolution) {
      return buildStudentConflictState(
        "Este e-mail já pertence a um aluno cadastrado na sua unidade. Escolha como deseja reaproveitar o cadastro-base sem duplicar a pessoa.",
        buildStudentConflictInfo({
          lookup: existingStudentLookup,
          semester: validatedSemester,
          assignmentsToPersist
        }),
        submittedFormValues
      );
    }

    if (expectedExistingUserId && expectedExistingUserId !== existingStudentLookup.user.id) {
      return buildStudentErrorState(
        "O cadastro-base identificado mudou desde a última validação. Revise o e-mail informado e tente novamente.",
        {
          email: "Revise o e-mail antes de confirmar a reutilização deste cadastro."
        },
        submittedFormValues
      );
    }

    return applyExistingStudentResolution({
      userId: existingStudentLookup.user.id,
      unitId: coordinatorUnitId,
      operationalScope,
      currentUser,
      submittedFormValues,
      parsedData: parsedData.data,
      validatedSemester,
      validatedAreaMap,
      assignmentsToPersist,
      resolution: requestedResolution
    });
  }

  const adminClient = createSupabaseAdminClient();
  let authUserId: string | null = null;
  let domainUserId: string | null = null;
  const createdEnrollmentIds: string[] = [];
  const createdProfessorLinkIds: string[] = [];
  const shouldStudentStartActive = Boolean(
    validatedSemester &&
      validatedSemester.status === "ativo" &&
      assignmentsToPersist.some((assignment) => assignment.areaId)
  );

  try {
    const { data: createdAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: parsedData.data.email,
        password: parsedData.data.senha,
        email_confirm: true
      });

    if (authError || !createdAuthUser.user) {
      return buildStudentErrorState(
        authError?.message ?? "Não foi possível criar o acesso do aluno no Auth.",
        {
          email: "Não foi possível criar este e-mail no sistema de autenticacao."
        },
        submittedFormValues
      );
    }

    authUserId = createdAuthUser.user.id;
    domainUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: studentProfile.id,
      unidade_id: coordinatorUnitId,
      email: parsedData.data.email,
      nome_completo: parsedData.data.nome_completo,
      ativo: shouldStudentStartActive
    };

    const { error: userInsertError } = await (supabase.from("usuarios") as any).insert(
      userInsertPayload
    );

    if (userInsertError) {
      throw new Error(userInsertError.message);
    }

    const studentInsertPayload: StudentInsert = {
      usuario_id: createdAuthUser.user.id,
      unidade_id: coordinatorUnitId,
      matricula: parsedData.data.ra,
      celular: parsedData.data.celular,
      curso: operationalScope.courseName ?? "Fisioterapia",
      curso_id: operationalScope.courseId,
      oferta_curso_unidade_id: operationalScope.offerId
    };

    const { error: studentInsertError } = await (supabase.from("alunos") as any).insert(
      studentInsertPayload
    );

    if (studentInsertError) {
      throw new Error(studentInsertError.message);
    }

    if (!shouldStudentStartActive) {
      await syncAuthUserActivation(createdAuthUser.user.id, false);
    }

    for (const assignment of assignmentsToPersist) {
      if (!assignment.areaId) {
        continue;
      }

      if (!validatedSemester) {
        throw new Error("Não foi possível identificar o semestre dos vínculos do aluno.");
      }

      const semester = validatedSemester;
      const area = validatedAreaMap.get(assignment.areaId);

      if (!area) {
        throw new Error("Não foi possível localizar a área de estágio selecionada.");
      }

      const classGroup = await findOrCreateAreaClass({
        semester,
        area,
        coordinatorId: currentUser.id
      });

      const enrollmentInsertPayload: EnrollmentInsert = {
        turma_id: classGroup.id,
        aluno_id: createdAuthUser.user.id,
        oferta_curso_unidade_id:
          classGroup.oferta_curso_unidade_id ??
          validatedSemester.oferta_curso_unidade_id ??
          operationalScope.offerId,
        status: "ativa"
      };

      const { data: insertedEnrollment, error: enrollmentInsertError } = await (supabase
        .from("matriculas_turma") as any)
        .insert(enrollmentInsertPayload)
        .select("*")
        .maybeSingle();

      if (enrollmentInsertError || !insertedEnrollment) {
        throw new Error(
          enrollmentInsertError?.message ??
            "Não foi possível criar a matrícula do aluno na área."
        );
      }

      const enrollmentRow = insertedEnrollment as { id: string };
      createdEnrollmentIds.push(enrollmentRow.id);

      for (const [supervisorIndex, supervisorId] of assignment.supervisorIds.entries()) {
        const professorLinkInsertPayload: ProfessorLinkInsert = {
          professor_id: supervisorId,
          matricula_turma_id: enrollmentRow.id,
          responsavel_principal: supervisorIndex === 0,
          ativo: true
        };

        const { data: insertedProfessorLink, error: professorLinkError } = await (supabase
          .from("vinculos_professor_aluno") as any)
          .insert(professorLinkInsertPayload)
          .select("*")
          .maybeSingle();

        if (professorLinkError || !insertedProfessorLink) {
          throw new Error(
            professorLinkError?.message ??
              "Não foi possível vincular o supervisor à área do aluno."
          );
        }

        createdProfessorLinkIds.push((insertedProfessorLink as { id: string }).id);
      }
    }
  } catch (error) {
    await cleanupCreatedStudentData({
      authUserId,
      userId: domainUserId,
      enrollmentIds: createdEnrollmentIds,
      professorLinkIds: createdProfessorLinkIds
    });

    const resolvedMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível concluir o cadastro do aluno.";

    return buildStudentErrorState(
      resolvedMessage,
      buildStudentRegistrationFieldErrors(resolvedMessage),
      submittedFormValues
    );
  }

  revalidateAcademicViews(domainUserId ?? undefined);

  return buildStudentSuccessState(
    buildStudentSuccessMessage(assignmentsToPersist.filter((assignment) => assignment.areaId).length, createdProfessorLinkIds.length)
  );
}

export async function updateStudentProfileAction(
  _previousState: StudentProfileActionState,
  formData: FormData
): Promise<StudentProfileActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const submittedFormValues = buildStudentProfileFormValues(formData);
  const parsedData = studentProfileSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildStudentProfileErrorState(
      "Revise os campos obrigatorios do cadastro do aluno.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();

  const { data: existingUserData, error: existingUserError } = await supabase
    .from("usuarios")
    .select("id, email")
    .eq("id", parsedData.data.student_id)
    .eq("unidade_id", coordinatorUnitId)
    .maybeSingle();

  const resolvedExistingUserData = (existingUserData ?? null) as
    | Pick<UserRow, "id" | "email">
    | null;

  if (existingUserError || !resolvedExistingUserData) {
    return buildStudentProfileErrorState(
      "Aluno não encontrado para atualizacao.",
      {},
      submittedFormValues
    );
  }

  const emailWasChanged =
    resolvedExistingUserData.email.toLowerCase() !== parsedData.data.email.toLowerCase();

  try {
    if (emailWasChanged) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        parsedData.data.student_id,
        {
          email: parsedData.data.email,
          email_confirm: true
        }
      );

      if (authError) {
        throw new Error(authError.message);
      }
    }

    const userUpdatePayload: UserUpdate = {
      nome_completo: parsedData.data.nome_completo,
      email: parsedData.data.email
    };
    const studentUpdatePayload: StudentUpdate = {
      matricula: parsedData.data.ra,
      celular: parsedData.data.celular
    };

    const { error: userUpdateError } = await (supabase.from("usuarios") as any)
      .update(userUpdatePayload)
      .eq("id", parsedData.data.student_id);

    if (userUpdateError) {
      throw new Error(userUpdateError.message);
    }

    const { error: studentUpdateError } = await (supabase.from("alunos") as any)
      .update(studentUpdatePayload)
      .eq("usuario_id", parsedData.data.student_id);

    if (studentUpdateError) {
      throw new Error(studentUpdateError.message);
    }
  } catch (error) {
    if (emailWasChanged) {
      await adminClient.auth.admin.updateUserById(parsedData.data.student_id, {
        email: resolvedExistingUserData.email,
        email_confirm: true
      });
    }

    const resolvedMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar o cadastro do aluno.";
    const isDuplicateEmail = /email|duplicate|unique/i.test(resolvedMessage);
    const isDuplicateRegistration = /matricula|ra|duplicate|unique/i.test(resolvedMessage);

    return buildStudentProfileErrorState(
      resolvedMessage,
      {
        ...(isDuplicateEmail ? { email: "Use um e-mail ainda nao cadastrado." } : {}),
        ...(isDuplicateRegistration ? { ra: "Use um RA ainda nao cadastrado." } : {})
      },
      submittedFormValues
    );
  }

  revalidateAcademicViews(parsedData.data.student_id);

  return buildStudentProfileSuccessState(
    "Cadastro do aluno atualizado com sucesso.",
    submittedFormValues
  );
}

export async function updateStudentSemesterAction(
  _previousState: StudentStageManagementActionState,
  formData: FormData
): Promise<StudentStageManagementActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const submittedFormValues = buildStudentStageFormValues(formData);
  const parsedData = studentStageManagementSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildStudentStageErrorState(
      "Revise os campos obrigatórios da gestão de estágio.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const assignmentsToPersist = collectAssignmentsToPersist(parsedData.data.assignments);
  const assignmentFieldErrors = validateAssignmentStructure(assignmentsToPersist);

  if (Object.keys(assignmentFieldErrors).length > 0) {
    return buildStudentStageErrorState(
      "Revise os vínculos de área e supervisão do semestre.",
      assignmentFieldErrors,
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);
  const [studentUserResult, validationContext] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, ativo")
      .eq("id", parsedData.data.student_id)
      .eq("unidade_id", coordinatorUnitId)
      .maybeSingle(),
    loadAssignmentValidationContext({
      currentUser,
      operationalScope,
      semesterId: parsedData.data.semestre_id,
      assignmentsToPersist
    })
  ]);

  const resolvedStudentUser = (studentUserResult.data ?? null) as
    | Pick<UserRow, "id" | "ativo">
    | null;

  if (studentUserResult.error || !resolvedStudentUser) {
    return buildStudentStageErrorState(
      "Aluno não encontrado para gestão do estágio.",
      {},
      submittedFormValues
    );
  }

  if (validationContext.semesterResult.error || !validationContext.semesterResult.data) {
    return buildStudentStageErrorState(
      "Não foi possível localizar o semestre selecionado.",
      { semestre_id: "Selecione um semestre valido." },
      submittedFormValues
    );
  }

  const semester = validationContext.semesterResult.data as SemesterRow;

  if (semester.status === "encerrado") {
    return buildStudentStageErrorState(
      "Semestres encerrados ficam somente em histórico. Selecione um semestre planejado ou ativo para editar os vínculos.",
      { semestre_id: "Este semestre está encerrado e não pode ser alterado." },
      submittedFormValues
    );
  }

  if (validationContext.areaResult.error) {
    return buildStudentStageErrorState(
      "Não foi possível carregar as áreas de estágio selecionadas.",
      {},
      submittedFormValues
    );
  }

  if (
    validationContext.professorAreaResult.error ||
    validationContext.professorUsersResult.error
  ) {
    return buildStudentStageErrorState(
      "Não foi possível validar os supervisores selecionados.",
      {},
      submittedFormValues
    );
  }

  const assignmentValidation = validateAssignmentsAgainstLoadedContext({
    assignmentsToPersist,
    areaRows: (validationContext.areaResult.data ?? []) as AreaRow[],
    professorAreaRows:
      (validationContext.professorAreaResult.data ?? []) as ProfessorAreaRow[],
    professorUsers: (validationContext.professorUsersResult.data ?? []) as UserRow[]
  });

  if (Object.keys(assignmentValidation.fieldErrors).length > 0) {
    return buildStudentStageErrorState(
      "Revise os vínculos de área e supervisão do semestre.",
      assignmentValidation.fieldErrors,
      submittedFormValues
    );
  }

  try {
    await syncStudentSemesterAssignments({
      coordinatorId: currentUser.id,
      studentId: parsedData.data.student_id,
      semester,
      assignmentsToPersist,
      areaMap: assignmentValidation.areaMap
    });
    await reconcileStudentOperationalAccess([parsedData.data.student_id]);
  } catch (error) {
    return buildStudentStageErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar os vinculos do semestre.",
      {},
      submittedFormValues
    );
  }

  revalidateAcademicViews(parsedData.data.student_id);

  return buildStudentStageSuccessState(
    `Vinculos do semestre ${semester.codigo} atualizados com sucesso.`,
    submittedFormValues
  );
}

export async function createProfessorRegistrationAction(
  _previousState: ProfessorRegistrationActionState,
  formData: FormData
): Promise<ProfessorRegistrationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);
  const submittedFormValues = buildProfessorFormValues(formData);
  const parsedData = professorRegistrationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildProfessorErrorState(
      "Revise os campos obrigatorios do cadastro do professor.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  if (new Set(parsedData.data.area_ids).size !== parsedData.data.area_ids.length) {
    return buildProfessorErrorState(
      "Selecione cada área apenas uma vez.",
      {
        area_ids: "Não repita a mesma área no cadastro do professor."
      },
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const scopedGraph = await loadScopedOperationalGraph(currentUser, { supabase });
  const scope = scopedGraph.scope;
  let profileMap: Map<string, ProfileRow>;
  let visibleStageAreaCatalog: Awaited<ReturnType<typeof loadVisibleStageAreaCatalog>>;

  try {
    [profileMap, visibleStageAreaCatalog] = await Promise.all([
      loadProfileMap(),
      loadVisibleStageAreaCatalog({
        supabase,
        scope,
        selectedUnitId: operationalScope.unitId,
        visibleClassRows: scopedGraph.classRows.filter((classRow) => classRow.ativa)
      })
    ]);
  } catch (error) {
    return buildProfessorErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível validar as áreas supervisionadas disponíveis.",
      {},
      submittedFormValues
    );
  }

  const visibleAreaRows = visibleStageAreaCatalog.areaRows.filter((areaRow) =>
    parsedData.data.area_ids.includes(areaRow.id)
  );

  if (visibleAreaRows.length !== parsedData.data.area_ids.length) {
    return buildProfessorErrorState(
      "Uma ou mais áreas selecionadas não pertencem à oferta atual.",
      {
        area_ids: "Selecione apenas áreas supervisionadas visíveis no contexto atual."
      },
      submittedFormValues
    );
  }

  const professorProfile = profileMap.get("professor");

  if (!professorProfile) {
    return buildProfessorErrorState(
      "O perfil de professor nao esta configurado no banco.",
      {},
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  let authUserId: string | null = null;
  let domainUserId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: parsedData.data.email,
        password: parsedData.data.senha,
        email_confirm: true
      });

    if (authError || !createdAuthUser.user) {
      return buildProfessorErrorState(
        authError?.message ?? "Não foi possível criar o acesso do professor no Auth.",
        {
          email: "Não foi possível criar este e-mail no sistema de autenticacao."
        },
        submittedFormValues
      );
    }

    authUserId = createdAuthUser.user.id;
    domainUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: professorProfile.id,
      unidade_id: coordinatorUnitId,
      email: parsedData.data.email,
      nome_completo: parsedData.data.nome_completo,
      ativo: true
    };

    const { error: userInsertError } = await (supabase.from("usuarios") as any).insert(
      userInsertPayload
    );

    if (userInsertError) {
      throw new Error(userInsertError.message);
    }

    const professorInsertPayload: ProfessorInsert = {
      usuario_id: createdAuthUser.user.id,
      registro_funcional: parsedData.data.funcional
    };

    const { error: professorInsertError } = await (supabase
      .from("professores") as any).insert(professorInsertPayload);

    if (professorInsertError) {
      throw new Error(professorInsertError.message);
    }

    const professorAreaInserts: ProfessorAreaInsert[] = parsedData.data.area_ids.map(
      (areaId) => ({
        professor_id: createdAuthUser.user.id,
        area_estagio_id: areaId,
        ativo: true
      })
    );

    const { error: professorAreaInsertError } = await (supabase
      .from("professor_areas_estagio") as any)
      .insert(professorAreaInserts);

    if (professorAreaInsertError) {
      throw new Error(professorAreaInsertError.message);
    }

    if (operationalScope.instituicaoId && operationalScope.courseId) {
      const contextInsertPayload: UserContextInsert = {
        usuario_id: createdAuthUser.user.id,
        perfil_id: professorProfile.id,
        instituicao_id: operationalScope.instituicaoId,
        curso_id: operationalScope.courseId,
        oferta_curso_unidade_id: operationalScope.offerId,
        principal: true,
        ativo: true,
        metadata: {
          origem: "coordinator-professor-registration",
          escopo: operationalScope.offerId ? "oferta_unidade" : "curso_unidade"
        }
      };

      const { data: insertedContextData, error: insertedContextError } = await adminClient
        .from("usuarios_papeis_contexto")
        .insert(contextInsertPayload as never)
        .select("id")
        .single();

      const insertedContext = (insertedContextData ?? null) as Pick<
        UserContextRow,
        "id"
      > | null;

      if (insertedContextError || !insertedContext) {
        throw new Error(
          insertedContextError?.message ??
            "Não foi possível criar o contexto institucional do professor."
        );
      }

      const { error: defaultContextError } = await adminClient
        .from("usuarios")
        .update({
          contexto_padrao_id: insertedContext.id
        } as never)
        .eq("id", createdAuthUser.user.id);

      if (defaultContextError) {
        throw new Error(
          "Não foi possível definir o contexto padrão do professor recém-cadastrado."
        );
      }
    }
  } catch (error) {
    await cleanupCreatedProfessorData({
      authUserId,
      userId: domainUserId
    });

    return buildProfessorErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir o cadastro do professor.",
      {},
      submittedFormValues
    );
  }

  revalidateAcademicViews();

  return buildProfessorSuccessState(
    "Professor cadastrado com sucesso e vinculado às áreas selecionadas."
  );
}

export async function createStageAreaAction(
  _previousState: StageAreaRegistrationActionState,
  formData: FormData
): Promise<StageAreaRegistrationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const submittedFormValues = buildStageAreaFormValues(formData);
  const parsedData = stageAreaRegistrationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildStageAreaErrorState(
      "Revise os campos obrigatórios da área supervisionada.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);

  if (!operationalScope.offerId) {
    return buildStageAreaErrorState(
      "O coordenador local precisa estar vinculado a uma oferta do curso para cadastrar áreas supervisionadas.",
      {},
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const scopedGraph = await loadScopedOperationalGraph(currentUser, { supabase });
  const scope = scopedGraph.scope;
  const [defaultBlockResult, existingOfferAreasResult] = await Promise.all([
    supabase
      .from("blocos_estagio")
      .select("id")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("areas_estagio")
      .select("*")
      .eq("oferta_curso_unidade_id", operationalScope.offerId)
  ]);

  if (defaultBlockResult.error || !defaultBlockResult.data) {
    return buildStageAreaErrorState(
      "Não foi possível localizar a estrutura técnica necessária para cadastrar a área supervisionada.",
      {},
      submittedFormValues
    );
  }

  if (existingOfferAreasResult.error) {
    return buildStageAreaErrorState(
      "Não foi possível validar as áreas já cadastradas para esta oferta.",
      {},
      submittedFormValues
    );
  }

  let visibleStageAreaCatalog: Awaited<ReturnType<typeof loadVisibleStageAreaCatalog>>;

  try {
    visibleStageAreaCatalog = await loadVisibleStageAreaCatalog({
      supabase,
      scope,
      selectedUnitId: operationalScope.unitId,
      visibleClassRows: scopedGraph.classRows.filter((classRow) => classRow.ativa)
    });
  } catch (error) {
    return buildStageAreaErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível consultar as áreas supervisionadas visíveis.",
      {},
      submittedFormValues
    );
  }

  const defaultBlock = defaultBlockResult.data as Pick<StageBlockRow, "id">;
  const blockId = defaultBlock.id;
  const normalizedName = parsedData.data.nome.trim();
  const normalizedNameKey = normalizeStageAreaCode(normalizedName);
  const requestedCode = normalizeStageAreaCode(
    parsedData.data.codigo || parsedData.data.nome
  );

  if (!requestedCode) {
    return buildStageAreaErrorState(
      "Informe um nome válido para gerar o código da área supervisionada.",
      {
        codigo: "Use letras e números para gerar um código de área válido."
      },
      submittedFormValues
    );
  }

  const visibleAreas = visibleStageAreaCatalog.areaRows;
  const existingOfferAreas = (existingOfferAreasResult.data ?? []) as AreaRow[];
  const existingOfferCodes = new Set(
    existingOfferAreas.map((areaRow) => normalizeStageAreaCode(areaRow.codigo))
  );
  const visibleNameExists = visibleAreas.some(
    (areaRow) => normalizeStageAreaCode(areaRow.nome) === normalizedNameKey
  );

  if (visibleNameExists) {
    return buildStageAreaErrorState(
      "Já existe uma área supervisionada com este nome no contexto atual.",
      {
        nome: "Use um nome diferente para evitar duplicidade na oferta."
      },
      submittedFormValues
    );
  }

  if (parsedData.data.codigo && existingOfferCodes.has(requestedCode)) {
    return buildStageAreaErrorState(
      "Já existe uma área supervisionada com este código na oferta atual.",
      {
        codigo: "Use um código diferente para esta área supervisionada."
      },
      submittedFormValues
    );
  }

  const nextCode = parsedData.data.codigo
    ? requestedCode
    : resolveUniqueStageAreaCode(requestedCode, existingOfferCodes);
  const nextOrder =
    Math.max(
      0,
      ...existingOfferAreas
        .filter((areaRow) => areaRow.bloco_id === blockId)
        .map((areaRow) => areaRow.ordem),
      ...visibleAreas
        .filter((areaRow) => areaRow.bloco_id === blockId)
        .map((areaRow) => areaRow.ordem)
    ) + 1;

  const { error: insertError } = await (supabase.from("areas_estagio") as any).insert({
    bloco_id: blockId,
    oferta_curso_unidade_id: operationalScope.offerId,
    codigo: nextCode,
    nome: normalizedName,
    ordem: nextOrder,
    ativa: parsedData.data.ativo === "true"
  } satisfies Database["public"]["Tables"]["areas_estagio"]["Insert"]);

  if (insertError) {
    const auditCaseNotFound = /case not found/i.test(insertError.message);
    const duplicateConstraint =
      insertError.code === "23505" || /duplicate key|unique/i.test(insertError.message);

    return buildStageAreaErrorState(
      auditCaseNotFound
        ? "A auditoria do banco local ainda não foi atualizada para o cadastro de áreas supervisionadas. Aplique o patch SQL desta etapa e tente novamente."
        : duplicateConstraint
        ? "Já existe uma área supervisionada com este nome ou código na oferta atual."
        : insertError.message,
      auditCaseNotFound
        ? {
            nome: "Atualize a função de auditoria do banco antes de cadastrar novas áreas."
          }
        : duplicateConstraint
        ? {
            nome: "Revise o nome ou o código desta área supervisionada."
          }
        : {},
      submittedFormValues
    );
  }

  revalidateAcademicViews();

  return buildStageAreaSuccessState(
    `${normalizedName} foi cadastrada com sucesso para a oferta atual.`
  );
}

export async function createSecretaryRegistrationAction(
  _previousState: SecretaryRegistrationActionState,
  formData: FormData
): Promise<SecretaryRegistrationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const submittedFormValues = buildSecretaryFormValues(formData);
  const parsedData = secretaryRegistrationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildSecretaryErrorState(
      "Revise os campos obrigatórios do cadastro da secretária.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const profileMap = await loadProfileMap();
  const secretaryProfile = profileMap.get("secretaria");

  if (!secretaryProfile) {
    return buildSecretaryErrorState(
      "O perfil de secretaria não está configurado no banco.",
      {},
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const adminClient = createSupabaseAdminClient();
  let authUserId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: parsedData.data.email,
        password: parsedData.data.senha,
        email_confirm: true
      });

    if (authError || !createdAuthUser.user) {
      return buildSecretaryErrorState(
        authError?.message ?? "Não foi possível criar o acesso da secretária no Auth.",
        {
          email: "Não foi possível criar este e-mail no sistema de autenticação."
        },
        submittedFormValues
      );
    }

    authUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: secretaryProfile.id,
      unidade_id: coordinatorUnitId,
      email: parsedData.data.email,
      nome_completo: parsedData.data.nome_completo,
      ativo: true
    };

    const { error: userInsertError } = await (supabase.from("usuarios") as any).insert(
      userInsertPayload
    );

    if (userInsertError) {
      throw new Error(userInsertError.message);
    }
  } catch (error) {
    if (authUserId) {
      await adminClient.auth.admin.deleteUser(authUserId);
    }

    return buildSecretaryErrorState(
      error instanceof Error
        ? error.message
        : "Não foi possível concluir o cadastro da secretária.",
      {},
      submittedFormValues
    );
  }

  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/secretaria");

  return buildSecretarySuccessState(
    "Secretária cadastrada com sucesso e vinculada à unidade."
  );
}

export async function createSemesterAction(
  _previousState: SemesterManagementActionState,
  formData: FormData
): Promise<SemesterManagementActionState> {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const submittedFormValues = buildSemesterFormValues(formData);
  const parsedData = semesterManagementSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildSemesterErrorState(
      "Revise os campos obrigatorios do semestre.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);

  const { error } = await (supabase.from("semestres") as any).insert({
    unidade_id: coordinatorUnitId,
    oferta_curso_unidade_id: operationalScope.offerId,
    codigo: parsedData.data.codigo,
    nome: parsedData.data.nome,
    data_inicio: parsedData.data.data_inicio,
    data_fim: parsedData.data.data_fim,
    status: parsedData.data.status
  });

  if (error) {
    const isDuplicateCode =
      error.code === "23505" || /duplicate key|unique/i.test(error.message);

    return buildSemesterErrorState(
      isDuplicateCode
        ? "Já existe um semestre cadastrado com este codigo."
        : error.message,
      isDuplicateCode ? { codigo: "Use um codigo de semestre ainda nao cadastrado." } : {},
      submittedFormValues
    );
  }

  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
  revalidatePath("/master-curso");

  return buildSemesterSuccessState("Semestre cadastrado com sucesso.");
}

export async function createCourseManagerUnitCoordinatorAction(
  _previousState: CourseManagerUnitCoordinatorActionState,
  formData: FormData
): Promise<CourseManagerUnitCoordinatorActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const activeCourseManagerContext = getActiveMasterCourseContext(currentUser);
  const submittedFormValues = buildCourseManagerCoordinatorFormValues(formData);
  const parsedData = courseManagerUnitCoordinatorSchema.safeParse(submittedFormValues);

  if (!activeCourseManagerContext) {
    return buildCourseManagerCoordinatorErrorState(
      "Somente o Gestor do curso pode cadastrar o Coordenador de Unidade nesta área.",
      {},
      submittedFormValues
    );
  }

  if (!parsedData.success) {
    return buildCourseManagerCoordinatorErrorState(
      "Revise os campos obrigatorios do Coordenador de Unidade.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const scope = await resolveScopedDataAccess(currentUser, { supabase });

  if (!scope.isCourseManager || !scope.unitIds.includes(parsedData.data.unidade_id)) {
    return buildCourseManagerCoordinatorErrorState(
      "A unidade selecionada nao pertence ao contexto ativo do Gestor do curso.",
      {
        unidade_id: "Selecione uma unidade com oferta do curso atual."
      },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const profileMap = await loadProfileMap();
  const coordinatorProfile = profileMap.get("coordenador");

  if (!coordinatorProfile) {
    return buildCourseManagerCoordinatorErrorState(
      "O perfil tecnico de coordenador nao foi encontrado.",
      {
        unidade_id: "Nao foi possivel validar o perfil tecnico de coordenador."
      },
      submittedFormValues
    );
  }

  const { data: selectedOfferData, error: selectedOfferError } = await adminClient
    .from("ofertas_curso_unidade")
    .select("id, unidade_id, instituicao_id, curso_id, ativo")
    .eq("instituicao_id", activeCourseManagerContext.instituicaoId)
    .eq("curso_id", activeCourseManagerContext.cursoId)
    .eq("unidade_id", parsedData.data.unidade_id)
    .maybeSingle();
  const selectedOffer = (selectedOfferData ?? null) as Pick<
    OfferRow,
    "id" | "unidade_id" | "instituicao_id" | "curso_id" | "ativo"
  > | null;

  if (selectedOfferError || !selectedOffer) {
    return buildCourseManagerCoordinatorErrorState(
      "Nao foi possivel localizar a oferta do curso para a unidade selecionada.",
      {
        unidade_id: "Selecione uma unidade que possua oferta ativa do curso."
      },
      submittedFormValues
    );
  }

  if (!selectedOffer.ativo) {
    return buildCourseManagerCoordinatorErrorState(
      "A oferta do curso na unidade selecionada esta inativa.",
      {
        unidade_id: "Selecione uma unidade com oferta ativa do curso."
      },
      submittedFormValues
    );
  }

  const shouldActivate = parsedData.data.ativo === "true";
  const { data: existingUserData, error: existingUserError } = await adminClient
    .from("usuarios")
    .select("id, perfil_id, contexto_padrao_id, ativo")
    .eq("email", parsedData.data.email)
    .maybeSingle();
  const existingUser = (existingUserData ?? null) as Pick<
    UserRow,
    "id" | "perfil_id" | "contexto_padrao_id" | "ativo"
  > | null;

  if (existingUserError) {
    return buildCourseManagerCoordinatorErrorState(
      "Nao foi possivel validar a disponibilidade do e-mail informado.",
      {
        email: "Tente novamente com outro e-mail ou revise o cadastro existente."
      },
      submittedFormValues
    );
  }

  if (existingUser && existingUser.perfil_id !== coordinatorProfile.id) {
    return buildCourseManagerCoordinatorErrorState(
      "Este e-mail ja pertence a outro perfil institucional e nao pode ser reaproveitado como Coordenador de Unidade nesta etapa.",
      {
        email: "Use um e-mail exclusivo de coordenador para esta unidade."
      },
      submittedFormValues
    );
  }

  let userId = existingUser?.id ?? null;
  let createdAuthUserId: string | null = null;
  let reusedExistingContext = false;

  try {
    if (!existingUser) {
      const { data: createdAuthUser, error: authError } =
        await adminClient.auth.admin.createUser({
          email: parsedData.data.email,
          password: parsedData.data.senha,
          email_confirm: true
        });

      if (authError || !createdAuthUser.user) {
        return buildCourseManagerCoordinatorErrorState(
          authError?.message ?? "Nao foi possivel criar o acesso do coordenador no Auth.",
          {
            email: isDuplicateEmailMessage(authError?.message)
              ? "Este e-mail ja possui cadastro institucional."
              : "Nao foi possivel criar o acesso de autenticacao."
          },
          submittedFormValues
        );
      }

      createdAuthUserId = createdAuthUser.user.id;
      userId = createdAuthUser.user.id;

      const userInsertPayload: UserInsert = {
        id: createdAuthUser.user.id,
        perfil_id: coordinatorProfile.id,
        unidade_id: parsedData.data.unidade_id,
        contexto_padrao_id: null,
        email: parsedData.data.email,
        nome_completo: parsedData.data.nome_completo,
        ativo: shouldActivate
      };

      const { error: userInsertError } = await adminClient
        .from("usuarios")
        .insert(userInsertPayload as never);

      if (userInsertError) {
        throw new Error(userInsertError.message);
      }
    } else {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
        existingUser.id,
        {
          password: parsedData.data.senha,
          email_confirm: true
        }
      );

      if (authUpdateError) {
        throw new Error(authUpdateError.message);
      }

      const userUpdatePayload: UserUpdate = {
        perfil_id: coordinatorProfile.id,
        unidade_id: parsedData.data.unidade_id,
        nome_completo: parsedData.data.nome_completo,
        email: parsedData.data.email,
        ativo: shouldActivate
      };

      const { error: userUpdateError } = await adminClient
        .from("usuarios")
        .update(userUpdatePayload as never)
        .eq("id", existingUser.id);

      if (userUpdateError) {
        throw new Error(userUpdateError.message);
      }
    }

    const coordinatorUpsertPayload: CoordinatorInsert = {
      usuario_id: userId!,
      unidade_id: parsedData.data.unidade_id,
      cargo: parsedData.data.cargo
    };

    const { error: coordinatorUpsertError } = await adminClient
      .from("coordenadores")
      .upsert(coordinatorUpsertPayload as never, {
        onConflict: "usuario_id"
      });

    if (coordinatorUpsertError) {
      throw new Error(coordinatorUpsertError.message);
    }

    const { data: userContextsData, error: userContextsError } = await adminClient
      .from("usuarios_papeis_contexto")
      .select("*")
      .eq("usuario_id", userId!);
    const userContexts = (userContextsData ?? []) as UserContextRow[];

    if (userContextsError) {
      throw new Error("Nao foi possivel consultar os contextos atuais do coordenador.");
    }

    const existingCoordinatorContext =
      userContexts.find(
        (contextRow) =>
          contextRow.perfil_id === coordinatorProfile.id &&
          contextRow.instituicao_id === activeCourseManagerContext.instituicaoId &&
          contextRow.curso_id === activeCourseManagerContext.cursoId &&
          contextRow.oferta_curso_unidade_id === selectedOffer.id
      ) ?? null;
    reusedExistingContext = Boolean(existingCoordinatorContext);
    const shouldBePrincipal = userContexts.length === 0;

    let coordinatorContextId = existingCoordinatorContext?.id ?? null;

    if (!existingCoordinatorContext) {
      const contextInsertPayload: UserContextInsert = {
        usuario_id: userId!,
        perfil_id: coordinatorProfile.id,
        instituicao_id: activeCourseManagerContext.instituicaoId,
        curso_id: activeCourseManagerContext.cursoId,
        oferta_curso_unidade_id: selectedOffer.id,
        principal: shouldBePrincipal,
        ativo: shouldActivate,
        metadata: {
          origem: "course-manager-unit-coordinator",
          escopo: "oferta_unidade"
        }
      };

      const { data: insertedContextData, error: insertedContextError } = await adminClient
        .from("usuarios_papeis_contexto")
        .insert(contextInsertPayload as never)
        .select("id")
        .single();

      const insertedContext = (insertedContextData ?? null) as Pick<
        UserContextRow,
        "id"
      > | null;

      if (insertedContextError || !insertedContext) {
        throw new Error(
          insertedContextError?.message ??
            "Nao foi possivel criar o contexto institucional do Coordenador de Unidade."
        );
      }

      coordinatorContextId = insertedContext.id;
    } else {
      const contextUpdatePayload: UserContextUpdate = {
        ativo: shouldActivate,
        principal: existingCoordinatorContext.principal || shouldBePrincipal
      };

      const { error: contextUpdateError } = await adminClient
        .from("usuarios_papeis_contexto")
        .update(contextUpdatePayload as never)
        .eq("id", existingCoordinatorContext.id);

      if (contextUpdateError) {
        throw new Error(
          "Nao foi possivel reativar o contexto institucional do Coordenador de Unidade."
        );
      }

      coordinatorContextId = existingCoordinatorContext.id;
    }

    if (shouldActivate && coordinatorContextId && (!existingUser?.contexto_padrao_id || shouldBePrincipal)) {
      const userUpdatePayload: UserUpdate = {
        contexto_padrao_id: coordinatorContextId
      };

      const { error: contextoPadraoError } = await adminClient
        .from("usuarios")
        .update(userUpdatePayload as never)
        .eq("id", userId!);

      if (contextoPadraoError) {
        throw new Error(
          "Nao foi possivel definir o contexto padrao do Coordenador de Unidade."
        );
      }
    } else if (
      !shouldActivate &&
      coordinatorContextId &&
      existingUser?.contexto_padrao_id === coordinatorContextId
    ) {
      const userUpdatePayload: UserUpdate = {
        contexto_padrao_id: null
      };

      const { error: clearDefaultContextError } = await adminClient
        .from("usuarios")
        .update(userUpdatePayload as never)
        .eq("id", userId!);

      if (clearDefaultContextError) {
        throw new Error(
          "Nao foi possivel limpar o contexto padrao do Coordenador de Unidade desativado."
        );
      }
    }

    await syncAuthUserActivation(userId!, shouldActivate);
  } catch (error) {
    if (createdAuthUserId) {
      await cleanupCreatedCoordinatorDataForCourseManager({
        authUserId: createdAuthUserId,
        userId
      });
    }

    return buildCourseManagerCoordinatorErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel concluir o cadastro do Coordenador de Unidade.",
      {},
      submittedFormValues
    );
  }

  revalidateAcademicViews();
  revalidatePath("/master-curso");
  revalidatePath("/master/contextos");

  return buildCourseManagerCoordinatorSuccessState(
    shouldActivate
      ? `${parsedData.data.nome_completo} foi ${
          reusedExistingContext || existingUser ? "habilitado" : "cadastrado"
        } como Coordenador de Unidade para a oferta atual do curso.`
      : `${parsedData.data.nome_completo} foi vinculado como Coordenador de Unidade, mas o acesso inicial permaneceu inativo.`
  );
}

export async function updateSemesterStatusAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);

  const semesterId = readStringField(formData, "semester_id");
  const rawStatus = readStringField(formData, "status");
  const rawReturnPath = readStringField(formData, "return_to");
  const returnPath = rawReturnPath.startsWith("/") ? rawReturnPath : "";
  const status =
    rawStatus === "ativo" || rawStatus === "encerrado" ? rawStatus : "planejado";

  const validationResult = z
    .object({
      semester_id: z.string().uuid(),
      status: z.enum(["planejado", "ativo", "encerrado"])
    })
    .safeParse({
      semester_id: semesterId,
      status
    });

  if (!validationResult.success) {
    if (returnPath) {
      redirectWithManagementNotice(
        returnPath,
        "error",
        "Não foi possível identificar o semestre desta ação."
      );
    }

    return;
  }

  let successMessage = "Status do semestre atualizado com sucesso.";

  try {
    if (validationResult.data.status === "encerrado") {
      const result = await setSemesterToClosedOperationally(
        {
          semesterId: validationResult.data.semester_id,
          operationalScope
        }
      );
      successMessage = result.message;
    } else if (validationResult.data.status === "ativo") {
      const result = await setSemesterToActiveOperationally(
        {
          semesterId: validationResult.data.semester_id,
          operationalScope
        }
      );
      successMessage = result.message;
    } else {
      const result = await setSemesterToPlannedOperationally(
        {
          semesterId: validationResult.data.semester_id,
          operationalScope
        }
      );
      successMessage = result.message;
    }
  } catch (error) {
    if (returnPath) {
      redirectWithManagementNotice(
        returnPath,
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o status do semestre."
      );
    }

    throw error;
  }

  revalidateAcademicViews();

  if (returnPath) {
    redirectWithManagementNotice(returnPath, "success", successMessage);
  }
}

export async function discardSemesterAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const operationalScope = await resolveOperationalScopeForCurrentCoordinator(currentUser);
  const semesterId = readStringField(formData, "semester_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");
  let noticeType: "success" | "error" = "error";
  let noticeMessage =
    "Não foi possível descartar o semestre informado.";

  const validationResult = z
    .object({
      semester_id: z.string().uuid()
    })
    .safeParse({
      semester_id: semesterId
    });

  if (!validationResult.success) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      "Não foi possível identificar o semestre que será descartado."
    );
  }

  try {
    const result = await deleteSemesterSafely({
      semesterId: validationResult.data.semester_id,
      unitId: operationalScope.unitId,
      offerId: operationalScope.offerId
    });
    noticeType = result.deleted ? "success" : "error";
    noticeMessage = result.message;
    revalidateAcademicViews();
  } catch (error) {
    noticeType = "error";
    noticeMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível descartar o semestre informado.";
  }

  redirectWithManagementNotice(returnPath, noticeType, noticeMessage);
}

export async function deactivateStudentAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: false,
      expectedProfileCode: "aluno",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(returnPath, "success", "Aluno desativado com sucesso.");
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível desativar o aluno."
    );
  }
}

export async function reactivateStudentAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: true,
      expectedProfileCode: "aluno",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(returnPath, "success", "Aluno reativado com sucesso.");
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível reativar o aluno."
    );
  }
}

export async function deactivateProfessorAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: false,
      expectedProfileCode: "professor",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(
      returnPath,
      "success",
      "Professor desativado com sucesso."
    );
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível desativar o professor."
    );
  }
}

export async function reactivateProfessorAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: true,
      expectedProfileCode: "professor",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(
      returnPath,
      "success",
      "Professor reativado com sucesso."
    );
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível reativar o professor."
    );
  }
}

export async function deactivateSecretaryAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: false,
      expectedProfileCode: "secretaria",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(
      returnPath,
      "success",
      "Secretária desativada com sucesso."
    );
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível desativar a secretária."
    );
  }
}

export async function reactivateSecretaryAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");

  try {
    await updateUserActivation({
      userId,
      nextActive: true,
      expectedProfileCode: "secretaria",
      currentUnitId: coordinatorUnitId
    });
    redirectWithManagementNotice(
      returnPath,
      "success",
      "Secretária reativada com sucesso."
    );
  } catch (error) {
    redirectWithManagementNotice(
      returnPath,
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível reativar a secretária."
    );
  }
}

export async function deleteStudentAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");
  let targetPath = returnPath;
  let noticeType: "success" | "error" = "error";
  let noticeMessage = "Não foi possível excluir o cadastro do aluno.";

  try {
    await loadUserProfileCode({
      userId,
      expectedProfileCode: "aluno",
      currentUnitId: coordinatorUnitId
    });

    const result = await deleteStudentSafely(userId);

    revalidateAcademicViews(userId);

    targetPath = result.deleted ? "/gestao/alunos" : returnPath;
    noticeType = result.deleted ? "success" : "error";
    noticeMessage = result.message;
  } catch (error) {
    targetPath = returnPath;
    noticeType = "error";
    noticeMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o cadastro do aluno.";
  }

  redirectWithManagementNotice(targetPath, noticeType, noticeMessage);
}

export async function deleteProfessorAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");
  let targetPath = "/gestao/alunos";
  let noticeType: "success" | "error" = "error";
  let noticeMessage = "Não foi possível excluir o cadastro do professor.";

  try {
    await loadUserProfileCode({
      userId,
      expectedProfileCode: "professor",
      currentUnitId: coordinatorUnitId
    });

    const result = await deleteProfessorSafely(userId);

    revalidateAcademicViews();

    targetPath = "/gestao/alunos";
    noticeType = result.deleted ? "success" : "error";
    noticeMessage = result.message;
  } catch (error) {
    targetPath = returnPath;
    noticeType = "error";
    noticeMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o cadastro do professor.";
  }

  redirectWithManagementNotice(targetPath, noticeType, noticeMessage);
}

export async function deleteSecretaryAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  assertOperationalMutationAllowed(currentUser);
  const coordinatorUnitId = getRequiredCoordinatorUnitId(currentUser);
  const userId = readStringField(formData, "user_id");
  const returnPath = readReturnPath(formData, "/gestao/alunos");
  let noticeType: "success" | "error" = "error";
  let noticeMessage = "Não foi possível excluir o cadastro da secretária.";

  try {
    await loadUserProfileCode({
      userId,
      expectedProfileCode: "secretaria",
      currentUnitId: coordinatorUnitId
    });

    const result = await deleteSecretarySafely(userId);

    revalidateAcademicViews();

    noticeType = result.deleted ? "success" : "error";
    noticeMessage = result.message;
  } catch (error) {
    noticeType = "error";
    noticeMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível excluir o cadastro da secretária.";
  }

  redirectWithManagementNotice(returnPath, noticeType, noticeMessage);
}


