import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { repairKnownMojibake } from "@/lib/utils/format";
import type { AuditEntry, ProfileCode, SessionUser } from "@/types/domain";
import type { Database } from "@/types/database";
import {
  loadUnitAuditFeed,
  type ClosedSemesterAreaAuditDetail,
  type ClosedSemesterAuditView,
  type UnitAuditAreaOption,
  type UnitAuditFilterState
} from "@/services/audit";

type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CoordinatorRow = Database["public"]["Tables"]["coordenadores"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type AuditHistoryRow = Database["public"]["Tables"]["historico_alteracoes"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type InstitutionalContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type CourseOfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type JsonRecord = Record<string, unknown>;

type VisibleProfileCode = Exclude<ProfileCode, "coordenador_master">;

const visibleInstitutionalProfiles: VisibleProfileCode[] = [
  "coordenador",
  "professor",
  "aluno"
];

export interface MasterUnitOption {
  id: string;
  institutionId: string | null;
  institutionName: string;
  name: string;
  acronym: string;
  slug: string;
  isActive: boolean;
}

export interface MasterInstitutionOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface MasterCourseOption {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  unitIds: string[];
}

export interface MasterUnitSummary {
  id: string;
  institutionId: string | null;
  institutionName: string;
  name: string;
  acronym: string;
  slug: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  activeSemesterCount: number;
  totalSemesterCount: number;
  coordinator:
    | {
        id: string;
        name: string;
        email: string;
        roleTitle: string;
        isActive: boolean;
      }
    | null;
  additionalCoordinatorCount: number;
  pendingItems: string[];
}

export interface MasterDashboardData {
  masterName: string;
  totalActiveUnits: number;
  totalLinkedCoordinators: number;
  totalActiveSemesters: number;
  institutions: MasterInstitutionOption[];
  units: MasterUnitSummary[];
}

export interface MasterCoordinatorsPageData {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  filters: {
    institutionId: string;
    unitId: string;
    status: "ativos" | "inativos" | "todos";
    query: string;
  };
  totalCoordinators: number;
  activeCoordinators: number;
  entries: MasterCoordinatorDirectoryEntry[];
}

export interface MasterCoordinatorDirectoryEntry {
  coordinatorId: string;
  unitId: string;
  unitName: string;
  unitSlug: string;
  unitIsActive: boolean;
  name: string;
  email: string;
  roleTitle: string;
  isActive: boolean;
  isResponsible: boolean;
  createdAt: string;
}

export interface MasterUsersPageData {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  filters: {
    institutionId: string;
    unitId: string;
    role: VisibleProfileCode | "todos";
    status: "ativos" | "inativos" | "todos";
  };
  totalUsers: number;
  activeUsers: number;
  entries: Array<{
    userId: string;
    name: string;
    email: string;
    role: VisibleProfileCode;
    roleLabel: string;
    unitId: string | null;
    unitName: string;
    isActive: boolean;
    auxiliaryLabel: string;
  }>;
}

export interface MasterUnitDetailPageData {
  unit: {
    id: string;
    institutionId: string | null;
    institutionName: string;
    name: string;
    acronym: string;
    slug: string;
    city: string | null;
    state: string | null;
    isActive: boolean;
  };
  summary: {
    totalCoordinators: number;
    activeCoordinators: number;
    totalProfessors: number;
    totalStudents: number;
    totalSemesters: number;
    activeSemesters: number;
    totalClasses: number;
    totalEnrollments: number;
  };
  responsibleCoordinator:
    | {
        id: string;
        name: string;
        email: string;
        roleTitle: string;
        isActive: boolean;
      }
    | null;
  coordinators: Array<{
    coordinatorId: string;
    name: string;
    email: string;
    roleTitle: string;
    isActive: boolean;
    isResponsible: boolean;
    createdAt: string;
  }>;
  semesters: Array<{
    id: string;
    code: string;
    name: string;
    status: SemesterRow["status"];
    startsAt: string;
    endsAt: string;
  }>;
  pendingItems: string[];
  auditAreas: UnitAuditAreaOption[];
  auditFilters: UnitAuditFilterState;
  recentAuditEntries: AuditEntry[];
}

export interface MasterGlobalAuditEntry {
  id: string;
  institutionName: string;
  unitName: string;
  courseName: string | null;
  actorName: string;
  actorProfileLabel: string;
  action: AuditEntry["action"];
  tableName: string;
  recordLabel: string;
  summary: string;
  detailsText: string;
  happenedAt: string;
}

export interface MasterGlobalAuditPageData {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  courses: MasterCourseOption[];
  closedSemesters: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  selectedSemesterId: string | null;
  selectedClosedSemester: ClosedSemesterAuditView | null;
  filters: {
    institutionId: string;
    unitId: string;
    courseId: string;
    role: VisibleProfileCode | "todos";
    period: "7" | "30" | "90" | "365" | "all";
  };
  totalEvents: number;
  totalUnitsTouched: number;
  totalActors: number;
  generatedAt: string;
  entries: MasterGlobalAuditEntry[];
}

function formatSupabaseErrorMessage(context: string, error: PostgrestError | null) {
  if (!error) {
    return context;
  }

  const details = [
    error.message ? `message=${error.message}` : null,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null
  ].filter(Boolean);

  return details.length ? `${context} (${details.join(" | ")})` : context;
}

function roleLabel(role: VisibleProfileCode) {
  switch (role) {
    case "coordenador":
      return "Coordenador";
    case "professor":
      return "Professor";
    case "aluno":
      return "Aluno";
    default:
      return role;
  }
}

function buildUnitOptions(
  units: UnitRow[],
  institutionMap?: Map<string, Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">>
): MasterUnitOption[] {
  return [...units]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((unit) => ({
      id: unit.id,
      institutionId: unit.instituicao_id,
      institutionName: unit.instituicao_id
        ? institutionMap?.get(unit.instituicao_id)?.nome ?? "Instituição não identificada"
        : "Instituição não identificada",
      name: unit.nome,
      acronym: unit.sigla,
      slug: unit.slug,
      isActive: unit.ativo
    }));
}

function buildCourseOptions(
  courses: Array<Pick<CourseRow, "id" | "instituicao_id" | "codigo" | "nome">>,
  offers: Array<Pick<CourseOfferRow, "id" | "instituicao_id" | "unidade_id" | "curso_id">>
): MasterCourseOption[] {
  const unitIdsByCourseId = new Map<string, Set<string>>();

  for (const offer of offers) {
    const currentUnitIds = unitIdsByCourseId.get(offer.curso_id) ?? new Set<string>();
    currentUnitIds.add(offer.unidade_id);
    unitIdsByCourseId.set(offer.curso_id, currentUnitIds);
  }

  return [...courses]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((course) => ({
      id: course.id,
      institutionId: course.instituicao_id,
      code: course.codigo,
      name: course.nome,
      unitIds: [...(unitIdsByCourseId.get(course.id) ?? new Set<string>())]
    }));
}

function buildInstitutionOptions(institutions: Array<Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">>): MasterInstitutionOption[] {
  return [...institutions]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((institution) => ({
      id: institution.id,
      name: institution.nome,
      slug: institution.slug,
      isActive: institution.ativo
    }));
}

function formatLocation(city: string | null, state: string | null) {
  if (city && state) {
    return `${city} / ${state}`;
  }

  return city || state || "Não informado";
}

function normalizeFilterValue(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function normalizeAuditDisplayText(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return repairKnownMojibake(value).trim();
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function buildCourseDisplayName(course: Pick<CourseRow, "codigo" | "nome"> | null | undefined) {
  if (!course) {
    return null;
  }

  return course.codigo?.trim() ? `${course.codigo} - ${course.nome}` : course.nome;
}

function matchesCoordinatorSearch(
  entry: MasterCoordinatorDirectoryEntry,
  query: string
) {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return true;
  }

  return [
    entry.name,
    entry.email,
    entry.unitName,
    entry.unitSlug,
    entry.roleTitle
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function sortCoordinatorRows(
  coordinators: CoordinatorRow[],
  userMap: Map<string, Pick<UserRow, "id" | "ativo" | "nome_completo" | "email">>
) {
  return [...coordinators].sort((left, right) => {
    const leftActive = userMap.get(left.usuario_id)?.ativo ? 1 : 0;
    const rightActive = userMap.get(right.usuario_id)?.ativo ? 1 : 0;

    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

function buildRecordLabel(entry: AuditHistoryRow) {
  if (!entry.registro_id) {
    return entry.tabela;
  }

  return `${entry.tabela} · ${entry.registro_id.slice(0, 8)}`;
}

function buildAuditSummary(entry: AuditHistoryRow) {
  switch (entry.acao) {
    case "INSERT":
      return `Inclusão registrada em ${entry.tabela}.`;
    case "UPDATE":
      return `Atualização registrada em ${entry.tabela}.`;
    case "DELETE":
      return `Exclusão registrada em ${entry.tabela}.`;
    default:
      return `Movimentação registrada em ${entry.tabela}.`;
  }
}

function findSemesterClosureEntry(semesterId: string, auditRows: AuditHistoryRow[]) {
  return auditRows.find((entry) => {
    if (entry.tabela !== "semestres" || entry.registro_id !== semesterId) {
      return false;
    }

    return getAuditString(asAuditRecord(entry.dados_depois), "status") === "encerrado";
  });
}

function isSemesterVisibleInMasterAuditScope(input: {
  semester: Pick<SemesterRow, "id" | "codigo" | "nome" | "unidade_id" | "oferta_curso_unidade_id">;
  validInstitutionId: string;
  validUnitId: string;
  validCourseId: string;
  offersById: Map<
    string,
    Pick<CourseOfferRow, "id" | "instituicao_id" | "unidade_id" | "curso_id">
  >;
  unitsById: Map<string, Pick<UnitRow, "id" | "instituicao_id">>;
}) {
  const offer = input.semester.oferta_curso_unidade_id
    ? input.offersById.get(input.semester.oferta_curso_unidade_id) ?? null
    : null;
  const resolvedUnitId = offer?.unidade_id ?? input.semester.unidade_id ?? null;
  const resolvedInstitutionId =
    offer?.instituicao_id ??
    (resolvedUnitId
      ? input.unitsById.get(resolvedUnitId)?.instituicao_id ?? null
      : null);
  const resolvedCourseId = offer?.curso_id ?? null;

  if (
    input.validInstitutionId &&
    resolvedInstitutionId !== input.validInstitutionId
  ) {
    return false;
  }

  if (input.validUnitId && resolvedUnitId !== input.validUnitId) {
    return false;
  }

  if (input.validCourseId && resolvedCourseId !== input.validCourseId) {
    return false;
  }

  return true;
}

async function buildMasterClosedSemesterAuditView(input: {
  semester: SemesterRow;
  fallbackAuditRows: AuditHistoryRow[];
}) {
  const supabase = createSupabaseAdminClient();
  const [classRowsResult, closureRowsResult] = await Promise.all([
    supabase
      .from("turmas")
      .select("*")
      .eq("semestre_id", input.semester.id)
      .order("nome", { ascending: true }),
    supabase
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "semestres")
      .eq("registro_id", input.semester.id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (classRowsResult.error || closureRowsResult.error) {
    throw new Error("Não foi possível carregar as áreas arquivadas deste semestre.");
  }

  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const closureRows = (closureRowsResult.data ?? []) as AuditHistoryRow[];
  const closureEntry =
    findSemesterClosureEntry(input.semester.id, closureRows) ??
    findSemesterClosureEntry(input.semester.id, input.fallbackAuditRows) ??
    closureRows[0] ??
    null;
  const archivedAt = closureEntry?.created_at ?? input.semester.updated_at;
  const archivedById = closureEntry?.usuario_id ?? null;
  const classIds = classRows.map((classGroup) => classGroup.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase.from("matriculas_turma").select("*").in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error("Não foi possível carregar as matrículas arquivadas do semestre.");
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const [professorLinksResult, areaRowsResult, blockRowsResult, archivedByResult] =
    await Promise.all([
      enrollmentIds.length
        ? supabase
            .from("vinculos_professor_aluno")
            .select("*")
            .in("matricula_turma_id", enrollmentIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("areas_estagio").select("id, nome, bloco_id"),
      supabase.from("blocos_estagio").select("id, nome"),
      archivedById
        ? supabase
            .from("usuarios")
            .select("nome_completo")
            .eq("id", archivedById)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

  if (
    professorLinksResult.error ||
    areaRowsResult.error ||
    blockRowsResult.error ||
    archivedByResult.error
  ) {
    throw new Error("Não foi possível consolidar o histórico das áreas arquivadas.");
  }

  const professorLinks = (professorLinksResult.data ?? []) as Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"][];
  const professorIds = uniqueStringValues(professorLinks.map((link) => link.professor_id));
  const professorUsersResult = professorIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", professorIds)
    : { data: [], error: null };

  if (professorUsersResult.error) {
    throw new Error("Não foi possível carregar os responsáveis pelas áreas arquivadas.");
  }

  const areaMap = new Map(
    (
      ((areaRowsResult.data ?? []) as Array<
        Pick<Database["public"]["Tables"]["areas_estagio"]["Row"], "id" | "nome" | "bloco_id">
      >)
    ).map((area) => [area.id, { nome: area.nome, blocoId: area.bloco_id }])
  );
  const blockMap = new Map(
    (
      ((blockRowsResult.data ?? []) as Array<
        Pick<Database["public"]["Tables"]["blocos_estagio"]["Row"], "id" | "nome">
      >)
    ).map((block) => [block.id, block.nome])
  );
  const professorNameMap = new Map(
    (
      ((professorUsersResult.data ?? []) as Array<
        Pick<UserRow, "id" | "nome_completo">
      >)
    ).map((user) => [user.id, user.nome_completo])
  );
  const linksByEnrollmentId = new Map<
    string,
    Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"][]
  >();

  for (const link of professorLinks) {
    const currentLinks = linksByEnrollmentId.get(link.matricula_turma_id) ?? [];
    currentLinks.push(link);
    linksByEnrollmentId.set(link.matricula_turma_id, currentLinks);
  }

  const areas = classRows.map((classGroup) => {
    const supervisorNames = uniqueStringValues(
      enrollmentRows
        .filter((enrollment) => enrollment.turma_id === classGroup.id)
        .flatMap((enrollment) => linksByEnrollmentId.get(enrollment.id) ?? [])
        .sort(
          (left, right) =>
            Number(right.responsavel_principal) - Number(left.responsavel_principal)
        )
        .map((link) => professorNameMap.get(link.professor_id) ?? "")
    );
    const areaRecord = classGroup.area_estagio_id
      ? areaMap.get(classGroup.area_estagio_id) ?? null
      : null;

    return {
      classId: classGroup.id,
      classCode: classGroup.codigo,
      className: classGroup.nome,
      areaName: areaRecord?.nome ?? classGroup.area_estagio,
      blockName:
        (areaRecord?.blocoId ? blockMap.get(areaRecord.blocoId) : null) ??
        "Bloco não identificado",
      archivedAt,
      responsibleLabel:
        supervisorNames[0] ??
        ((archivedByResult.data as Pick<UserRow, "nome_completo"> | null)?.nome_completo ??
          "Responsável não identificado"),
      supervisorNames
    };
  });

  return {
    id: input.semester.id,
    code: input.semester.codigo,
    name: input.semester.nome,
    archivedAt,
    archivedByName:
      ((archivedByResult.data as Pick<UserRow, "nome_completo"> | null)?.nome_completo ??
        "Coordenação não identificada"),
    areas
  } satisfies ClosedSemesterAuditView;
}

export async function getMasterClosedSemesterAreaDetail(
  semesterId: string,
  classId: string
): Promise<ClosedSemesterAreaAuditDetail | null> {
  const supabase = createSupabaseAdminClient();
  const [semesterResult, classResult, closureRowsResult] = await Promise.all([
    supabase.from("semestres").select("*").eq("id", semesterId).maybeSingle(),
    supabase.from("turmas").select("*").eq("id", classId).maybeSingle(),
    supabase
      .from("historico_alteracoes")
      .select("*")
      .eq("tabela", "semestres")
      .eq("registro_id", semesterId)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (semesterResult.error || classResult.error || closureRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os dados históricos desta área encerrada.",
        semesterResult.error ?? classResult.error ?? closureRowsResult.error
      )
    );
  }

  const semester = (semesterResult.data ?? null) as SemesterRow | null;
  const classGroup = (classResult.data ?? null) as ClassRow | null;

  if (!semester || !classGroup || classGroup.semestre_id !== semesterId) {
    return null;
  }

  if (semester.status !== "encerrado") {
    return null;
  }

  const closureRows = (closureRowsResult.data ?? []) as AuditHistoryRow[];
  const closureEntry = findSemesterClosureEntry(semesterId, closureRows) ?? closureRows[0] ?? null;
  const archivedAt = closureEntry?.created_at ?? semester.updated_at;
  const archivedById = closureEntry?.usuario_id ?? null;

  const [areaRowsResult, blockRowsResult, enrollmentRowsResult, archivedByResult] =
    await Promise.all([
      supabase.from("areas_estagio").select("id, nome, bloco_id"),
      supabase.from("blocos_estagio").select("id, nome"),
      supabase.from("matriculas_turma").select("*").eq("turma_id", classId),
      archivedById
        ? supabase
            .from("usuarios")
            .select("nome_completo")
            .eq("id", archivedById)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

  if (
    areaRowsResult.error ||
    blockRowsResult.error ||
    enrollmentRowsResult.error ||
    archivedByResult.error
  ) {
    throw new Error("Não foi possível consolidar o contexto da área arquivada.");
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const professorLinksResult = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (professorLinksResult.error) {
    throw new Error("Não foi possível carregar os supervisores desta área arquivada.");
  }

  const professorLinks = (professorLinksResult.data ?? []) as Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"][];
  const professorIds = uniqueStringValues(professorLinks.map((link) => link.professor_id));
  const professorUsersResult = professorIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", professorIds)
    : { data: [], error: null };

  if (professorUsersResult.error) {
    throw new Error("Não foi possível carregar os responsáveis desta área arquivada.");
  }

  const areaMap = new Map(
    (
      ((areaRowsResult.data ?? []) as Array<
        Pick<Database["public"]["Tables"]["areas_estagio"]["Row"], "id" | "nome" | "bloco_id">
      >)
    ).map((area) => [area.id, { nome: area.nome, blocoId: area.bloco_id }])
  );
  const blockMap = new Map(
    (
      ((blockRowsResult.data ?? []) as Array<
        Pick<Database["public"]["Tables"]["blocos_estagio"]["Row"], "id" | "nome">
      >)
    ).map((block) => [block.id, block.nome])
  );
  const professorNameMap = new Map(
    (
      ((professorUsersResult.data ?? []) as Array<
        Pick<UserRow, "id" | "nome_completo">
      >)
    ).map((user) => [user.id, user.nome_completo])
  );
  const linksByEnrollmentId = new Map<
    string,
    Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"][]
  >();

  for (const link of professorLinks) {
    const currentLinks = linksByEnrollmentId.get(link.matricula_turma_id) ?? [];
    currentLinks.push(link);
    linksByEnrollmentId.set(link.matricula_turma_id, currentLinks);
  }

  const supervisorNames = uniqueStringValues(
    enrollmentRows
      .flatMap((enrollment) => linksByEnrollmentId.get(enrollment.id) ?? [])
      .sort(
        (left, right) =>
          Number(right.responsavel_principal) - Number(left.responsavel_principal)
      )
      .map((link) => professorNameMap.get(link.professor_id) ?? "")
  );
  const areaRecord = classGroup.area_estagio_id
    ? areaMap.get(classGroup.area_estagio_id) ?? null
    : null;

  return {
    semester: {
      id: semester.id,
      code: semester.codigo,
      name: semester.nome,
      archivedAt,
      archivedByName:
        ((archivedByResult.data as Pick<UserRow, "nome_completo"> | null)?.nome_completo ??
          "Coordenação não identificada")
    },
    area: {
      classId: classGroup.id,
      classCode: classGroup.codigo,
      className: classGroup.nome,
      areaName: areaRecord?.nome ?? classGroup.area_estagio,
      blockName:
        (areaRecord?.blocoId ? blockMap.get(areaRecord.blocoId) : null) ??
        "Bloco não identificado",
      supervisorNames
    }
  };
}

interface MasterGlobalAuditResolutionContext {
  evaluations: Map<
    string,
    Pick<EvaluationRow, "id" | "matricula_turma_id" | "oferta_curso_unidade_id">
  >;
  enrollments: Map<
    string,
    Pick<EnrollmentRow, "id" | "turma_id" | "oferta_curso_unidade_id">
  >;
  classes: Map<
    string,
    Pick<ClassRow, "id" | "semestre_id" | "oferta_curso_unidade_id">
  >;
  semesters: Map<
    string,
    Pick<SemesterRow, "id" | "unidade_id" | "oferta_curso_unidade_id">
  >;
  offers: Map<
    string,
    Pick<CourseOfferRow, "id" | "curso_id" | "instituicao_id" | "unidade_id">
  >;
}

function asAuditRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getAuditString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveMasterAuditEvaluationRecord(
  evaluationId: string | undefined,
  context: MasterGlobalAuditResolutionContext
) {
  return evaluationId ? context.evaluations.get(evaluationId) ?? null : null;
}

function resolveMasterAuditEnrollmentId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  if (entry.tabela === "matriculas_turma") {
    return getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  const directEnrollmentId = getAuditString(payload, "matricula_turma_id");

  if (directEnrollmentId) {
    return directEnrollmentId;
  }

  if (entry.tabela === "itens_avaliados") {
    const evaluationRecord = resolveMasterAuditEvaluationRecord(
      getAuditString(payload, "avaliacao_id"),
      context
    );

    return evaluationRecord?.matricula_turma_id ?? undefined;
  }

  if (entry.tabela === "avaliacoes") {
    return getAuditString(payload, "id")
      ? context.evaluations.get(getAuditString(payload, "id")!)?.matricula_turma_id ??
          getAuditString(payload, "matricula_turma_id")
      : getAuditString(payload, "matricula_turma_id");
  }

  return undefined;
}

function resolveMasterAuditClassId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  if (entry.tabela === "turmas") {
    return getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  const directClassId = getAuditString(payload, "turma_id");

  if (directClassId) {
    return directClassId;
  }

  const enrollmentId = resolveMasterAuditEnrollmentId(entry, payload, context);
  const enrollment = enrollmentId ? context.enrollments.get(enrollmentId) ?? null : null;

  return enrollment?.turma_id ?? undefined;
}

function resolveMasterAuditSemesterId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  if (entry.tabela === "semestres") {
    return getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  const directSemesterId = getAuditString(payload, "semestre_id");

  if (directSemesterId) {
    return directSemesterId;
  }

  const classId = resolveMasterAuditClassId(entry, payload, context);
  const classGroup = classId ? context.classes.get(classId) ?? null : null;

  return classGroup?.semestre_id ?? undefined;
}

function resolveMasterAuditUnitId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  const directUnitId = getAuditString(payload, "unidade_id") ?? entry.unidade_id ?? undefined;

  if (directUnitId) {
    return directUnitId;
  }

  const offerId = resolveMasterAuditOfferId(entry, payload, context);
  const offer = offerId ? context.offers.get(offerId) ?? null : null;

  if (offer?.unidade_id) {
    return offer.unidade_id;
  }

  const semesterId = resolveMasterAuditSemesterId(entry, payload, context);
  const semester = semesterId ? context.semesters.get(semesterId) ?? null : null;

  return semester?.unidade_id ?? null;
}

function resolveMasterAuditOfferId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  if (entry.tabela === "ofertas_curso_unidade") {
    return getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  const directOfferId = getAuditString(payload, "oferta_curso_unidade_id");

  if (directOfferId) {
    return directOfferId;
  }

  if (entry.tabela === "avaliacoes") {
    const evaluationId = getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
    const evaluation = evaluationId ? context.evaluations.get(evaluationId) ?? null : null;

    if (evaluation?.oferta_curso_unidade_id) {
      return evaluation.oferta_curso_unidade_id;
    }
  }

  const enrollmentId = resolveMasterAuditEnrollmentId(entry, payload, context);
  const enrollment = enrollmentId ? context.enrollments.get(enrollmentId) ?? null : null;

  if (enrollment?.oferta_curso_unidade_id) {
    return enrollment.oferta_curso_unidade_id;
  }

  const classId = resolveMasterAuditClassId(entry, payload, context);
  const classGroup = classId ? context.classes.get(classId) ?? null : null;

  if (classGroup?.oferta_curso_unidade_id) {
    return classGroup.oferta_curso_unidade_id;
  }

  const semesterId = resolveMasterAuditSemesterId(entry, payload, context);
  const semester = semesterId ? context.semesters.get(semesterId) ?? null : null;

  return semester?.oferta_curso_unidade_id ?? undefined;
}

function resolveMasterAuditCourseId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: MasterGlobalAuditResolutionContext
) {
  if (entry.tabela === "cursos") {
    return getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  const directCourseId = getAuditString(payload, "curso_id");

  if (directCourseId) {
    return directCourseId;
  }

  const offerId = resolveMasterAuditOfferId(entry, payload, context);
  const offer = offerId ? context.offers.get(offerId) ?? null : null;

  return offer?.curso_id ?? undefined;
}

async function loadProfiles() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("perfis").select("id, codigo, nome");

  if (error) {
    throw new Error(
      formatSupabaseErrorMessage("NÃƒÂ£o foi possÃƒÂ­vel carregar os perfis da plataforma.", error)
    );
  }

  const rows = (data ?? []) as Array<Pick<ProfileRow, "id" | "codigo" | "nome">>;
  const byId = new Map(rows.map((profile) => [profile.id, profile]));
  const byCode = new Map(rows.map((profile) => [profile.codigo, profile]));

  return { rows, byId, byCode };
}

async function loadMasterBaseData() {
  const supabase = createSupabaseAdminClient();
  const [institutionsResult, unitsResult, coordinatorsResult, semestersResult] = await Promise.all([
    supabase.from("instituicoes").select("id, nome, slug, ativo").order("nome"),
    supabase.from("unidades").select("*").order("nome"),
    supabase.from("coordenadores").select("*").order("created_at", { ascending: false }),
    supabase.from("semestres").select("*").order("data_inicio", { ascending: false })
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes das unidades.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar as unidades cadastradas.",
        unitsResult.error
      )
    );
  }

  if (coordinatorsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar os coordenadores das unidades.",
        coordinatorsResult.error
      )
    );
  }

  if (semestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar os semestres das unidades.",
        semestersResult.error
      )
    );
  }

  const units = (unitsResult.data ?? []) as UnitRow[];
  const institutions = (institutionsResult.data ?? []) as Array<
    Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">
  >;
  const coordinators = (coordinatorsResult.data ?? []) as CoordinatorRow[];
  const semesters = (semestersResult.data ?? []) as SemesterRow[];
  const coordinatorUserIds = [...new Set(coordinators.map((row) => row.usuario_id))];
  const coordinatorUsersResult = coordinatorUserIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo, email, ativo")
        .in("id", coordinatorUserIds)
    : { data: [], error: null };

  if (coordinatorUsersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar os usuÃƒÂ¡rios coordenadores.",
        coordinatorUsersResult.error
      )
    );
  }

  const coordinatorUsers = (coordinatorUsersResult.data ?? []) as Array<
    Pick<UserRow, "id" | "nome_completo" | "email" | "ativo">
  >;

  return {
    institutions,
    units,
    coordinators,
    semesters,
    coordinatorUserMap: new Map(
      coordinatorUsers.map((user) => [user.id, user])
    )
  };
}

function buildUnitSummaries(input: {
  institutions: Array<Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">>;
  units: UnitRow[];
  coordinators: CoordinatorRow[];
  semesters: SemesterRow[];
  coordinatorUserMap: Map<string, Pick<UserRow, "id" | "nome_completo" | "email" | "ativo">>;
}) {
  const coordinatorsByUnit = new Map<string, CoordinatorRow[]>();
  const semestersByUnit = new Map<string, SemesterRow[]>();
  const institutionMap = new Map(
    input.institutions.map((institution) => [institution.id, institution])
  );

  for (const coordinator of input.coordinators) {
    if (!coordinator.unidade_id) {
      continue;
    }

    const currentList = coordinatorsByUnit.get(coordinator.unidade_id) ?? [];
    currentList.push(coordinator);
    coordinatorsByUnit.set(coordinator.unidade_id, currentList);
  }

  for (const semester of input.semesters) {
    if (!semester.unidade_id) {
      continue;
    }

    const currentList = semestersByUnit.get(semester.unidade_id) ?? [];
    currentList.push(semester);
    semestersByUnit.set(semester.unidade_id, currentList);
  }

  return [...input.units]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((unit) => {
      const institution = unit.instituicao_id
        ? institutionMap.get(unit.instituicao_id) ?? null
        : null;
      const linkedCoordinators = sortCoordinatorRows(
        coordinatorsByUnit.get(unit.id) ?? [],
        input.coordinatorUserMap
      );
      const unitSemesters = semestersByUnit.get(unit.id) ?? [];
      const primaryCoordinator = linkedCoordinators[0] ?? null;
      const primaryCoordinatorUser = primaryCoordinator
        ? input.coordinatorUserMap.get(primaryCoordinator.usuario_id) ?? null
        : null;
      const activeSemesterCount = unitSemesters.filter(
        (semester) => semester.status === "ativo"
      ).length;
      const pendingItems: string[] = [];

      if (!unit.ativo) {
        pendingItems.push("Unidade inativa no cadastro institucional.");
      }

      if (!institution) {
        pendingItems.push("Unidade sem instituicao vinculada.");
      } else if (!institution.ativo) {
        pendingItems.push("Instituicao vinculada esta inativa.");
      }

      if (!linkedCoordinators.some((coordinator) =>
        input.coordinatorUserMap.get(coordinator.usuario_id)?.ativo
      )) {
        pendingItems.push("Nenhum coordenador ativo vinculado ÃƒÂ  unidade.");
      }

      if (!unitSemesters.length) {
        pendingItems.push("Nenhum semestre cadastrado para a unidade.");
      } else if (!activeSemesterCount) {
        pendingItems.push("Nenhum semestre ativo na unidade.");
      }

      return {
        id: unit.id,
        institutionId: unit.instituicao_id,
        institutionName: institution?.nome ?? "Instituicao nao identificada",
        name: unit.nome,
        acronym: unit.sigla,
        slug: unit.slug,
        city: unit.cidade,
        state: unit.estado,
        isActive: unit.ativo,
        activeSemesterCount,
        totalSemesterCount: unitSemesters.length,
        coordinator:
          primaryCoordinator && primaryCoordinatorUser
            ? {
                id: primaryCoordinator.usuario_id,
                name: primaryCoordinatorUser.nome_completo,
                email: primaryCoordinatorUser.email,
                roleTitle: primaryCoordinator.cargo,
                isActive: primaryCoordinatorUser.ativo
              }
            : null,
        additionalCoordinatorCount: Math.max(linkedCoordinators.length - 1, 0),
        pendingItems
      } satisfies MasterUnitSummary;
    });
}

export async function getMasterDashboardPageData(
  currentUser: SessionUser
): Promise<MasterDashboardData> {
  const baseData = await loadMasterBaseData();
  const unitSummaries = buildUnitSummaries(baseData);

  return {
    masterName: currentUser.name,
    totalActiveUnits: baseData.units.filter((unit) => unit.ativo).length,
    totalLinkedCoordinators: baseData.coordinators.length,
    totalActiveSemesters: baseData.semesters.filter(
      (semester) => semester.status === "ativo"
    ).length,
    institutions: buildInstitutionOptions(baseData.institutions),
    units: unitSummaries
  };
}

export async function getMasterUnitsPageData() {
  const baseData = await loadMasterBaseData();
  const institutions = buildInstitutionOptions(baseData.institutions);
  const institutionMap = new Map(
    baseData.institutions.map((institution) => [institution.id, institution])
  );

  return {
    units: buildUnitSummaries(baseData),
    unitOptions: buildUnitOptions(baseData.units, institutionMap),
    institutions
  };
}

export async function getMasterCoordinatorsPageData(input?: {
  institutionId?: string | string[];
  unitId?: string | string[];
  status?: string | string[];
  query?: string | string[];
}): Promise<MasterCoordinatorsPageData> {
  const baseData = await loadMasterBaseData();
  const institutionMap = new Map(
    baseData.institutions.map((institution) => [institution.id, institution])
  );
  const units = buildUnitOptions(baseData.units, institutionMap);
  const institutions = buildInstitutionOptions(baseData.institutions);
  const requestedInstitutionId = normalizeFilterValue(input?.institutionId);
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedStatus = normalizeFilterValue(input?.status);
  const requestedQuery = normalizeFilterValue(input?.query).trim();
  const validInstitutionId = institutions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";
  const validUnitId = units.some(
    (unit) =>
      unit.id === requestedUnitId &&
      (!validInstitutionId || unit.institutionId === validInstitutionId)
  )
    ? requestedUnitId
    : "";
  const statusFilter: MasterCoordinatorsPageData["filters"]["status"] =
    requestedStatus === "ativos" || requestedStatus === "inativos"
      ? requestedStatus
      : "todos";

  const coordinatorsByUnit = new Map<string, CoordinatorRow[]>();

  for (const coordinator of baseData.coordinators) {
    if (!coordinator.unidade_id) {
      continue;
    }

    const currentList = coordinatorsByUnit.get(coordinator.unidade_id) ?? [];
    currentList.push(coordinator);
    coordinatorsByUnit.set(coordinator.unidade_id, currentList);
  }

  const entries = baseData.units.flatMap((unit) => {
    const unitCoordinators = sortCoordinatorRows(
      coordinatorsByUnit.get(unit.id) ?? [],
      baseData.coordinatorUserMap
    );

    return unitCoordinators.map((coordinator, index) => {
      const coordinatorUser = baseData.coordinatorUserMap.get(coordinator.usuario_id);

      return {
        coordinatorId: coordinator.usuario_id,
        unitId: unit.id,
        unitName: unit.nome,
        unitSlug: unit.slug,
        unitIsActive: unit.ativo,
        name: coordinatorUser?.nome_completo ?? "Coordenador nÃƒÂ£o identificado",
        email: coordinatorUser?.email ?? "Sem e-mail",
        roleTitle: coordinator.cargo,
        isActive: Boolean(coordinatorUser?.ativo),
        isResponsible: index === 0,
        createdAt: coordinator.created_at
      };
    });
  });

  const filteredEntries = entries.filter((entry) => {
    const unit = units.find((item) => item.id === entry.unitId) ?? null;

    if (validInstitutionId && unit?.institutionId !== validInstitutionId) {
      return false;
    }

    if (validUnitId && entry.unitId !== validUnitId) {
      return false;
    }

    if (statusFilter === "ativos" && !entry.isActive) {
      return false;
    }

    if (statusFilter === "inativos" && entry.isActive) {
      return false;
    }

    return matchesCoordinatorSearch(entry, requestedQuery);
  });

  filteredEntries.sort((left, right) => {
    const unitDifference = left.unitName.localeCompare(right.unitName, "pt-BR");

    if (unitDifference !== 0) {
      return unitDifference;
    }

    if (left.isResponsible !== right.isResponsible) {
      return Number(right.isResponsible) - Number(left.isResponsible);
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });

  return {
    institutions,
    units,
    filters: {
      institutionId: validInstitutionId,
      unitId: validUnitId,
      status: statusFilter,
      query: requestedQuery
    },
    totalCoordinators: entries.length,
    activeCoordinators: entries.filter((entry) => entry.isActive).length,
    entries: filteredEntries
  };
}

export async function getMasterUsersPageData(input?: {
  institutionId?: string | string[];
  unitId?: string | string[];
  role?: string | string[];
  status?: string | string[];
}): Promise<MasterUsersPageData> {
  const supabase = createSupabaseAdminClient();
  const { byCode: profilesByCode, byId: profilesById } = await loadProfiles();
  const [institutionsResult, unitsResult] = await Promise.all([
    supabase.from("instituicoes").select("id, nome, slug, ativo").order("nome"),
    supabase.from("unidades").select("*").order("nome")
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes para a visao de usuarios.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar as unidades para a visÃƒÂ£o de usuÃƒÂ¡rios.",
        unitsResult.error
      )
    );
  }

  const institutions = (institutionsResult.data ?? []) as Array<
    Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">
  >;
  const units = (unitsResult.data ?? []) as UnitRow[];
  const institutionMap = new Map(institutions.map((institution) => [institution.id, institution]));
  const institutionOptions = buildInstitutionOptions(institutions);
  const unitOptions = buildUnitOptions(units, institutionMap);
  const requestedInstitutionId = normalizeFilterValue(input?.institutionId);
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedRole = normalizeFilterValue(input?.role);
  const requestedStatus = normalizeFilterValue(input?.status);
  const validInstitutionId = institutionOptions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";
  const validUnitId = unitOptions.some(
    (unit) =>
      unit.id === requestedUnitId &&
      (!validInstitutionId || unit.institutionId === validInstitutionId)
  )
    ? requestedUnitId
    : "";
  const roleFilter: MasterUsersPageData["filters"]["role"] =
    visibleInstitutionalProfiles.includes(requestedRole as VisibleProfileCode)
      ? (requestedRole as VisibleProfileCode)
      : "todos";
  const statusFilter: MasterUsersPageData["filters"]["status"] =
    requestedStatus === "ativos" || requestedStatus === "inativos"
      ? requestedStatus
      : "todos";

  const visibleProfileIds = visibleInstitutionalProfiles
    .map((profileCode) => profilesByCode.get(profileCode)?.id ?? null)
    .filter(Boolean) as number[];

  let usersQuery = supabase
    .from("usuarios")
    .select("*")
    .in("perfil_id", visibleProfileIds)
    .order("nome_completo");

  if (statusFilter === "ativos") {
    usersQuery = usersQuery.eq("ativo", true);
  }

  if (statusFilter === "inativos") {
    usersQuery = usersQuery.eq("ativo", false);
  }

  if (roleFilter !== "todos") {
    const profileId = profilesByCode.get(roleFilter)?.id ?? null;

    if (profileId) {
      usersQuery = usersQuery.eq("perfil_id", profileId);
    }
  }

  const usersResult = await usersQuery;

  if (usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar os usuÃƒÂ¡rios institucionais.",
        usersResult.error
      )
    );
  }

  const users = (usersResult.data ?? []) as UserRow[];
  const userIds = users.map((user) => user.id);
  const [
    studentRowsResult,
    professorRowsResult,
    coordinatorRowsResult,
    contextRowsResult
  ] = await Promise.all([
    userIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("professores").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("coordenadores").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("usuarios_papeis_contexto").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    studentRowsResult.error ||
    professorRowsResult.error ||
    coordinatorRowsResult.error ||
    contextRowsResult.error
  ) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃƒÂ£o foi possÃƒÂ­vel carregar os vÃƒÂ­nculos institucionais dos usuÃƒÂ¡rios.",
        studentRowsResult.error ??
          professorRowsResult.error ??
          coordinatorRowsResult.error ??
          contextRowsResult.error
      )
    );
  }

  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const professorRows = (professorRowsResult.data ?? []) as ProfessorRow[];
  const coordinatorRows = (coordinatorRowsResult.data ?? []) as CoordinatorRow[];
  const contextRows = (contextRowsResult.data ?? []) as InstitutionalContextRow[];
  const studentMap = new Map(studentRows.map((student) => [student.usuario_id, student]));
  const professorMap = new Map(professorRows.map((professor) => [professor.usuario_id, professor]));
  const coordinatorMap = new Map(
    coordinatorRows.map((coordinator) => [coordinator.usuario_id, coordinator])
  );
  const contextsByUserId = new Map<string, InstitutionalContextRow[]>();
  const relatedOfferIds = new Set<string>();

  for (const contextRow of contextRows) {
    const currentRows = contextsByUserId.get(contextRow.usuario_id) ?? [];
    currentRows.push(contextRow);
    contextsByUserId.set(contextRow.usuario_id, currentRows);

    if (contextRow.oferta_curso_unidade_id) {
      relatedOfferIds.add(contextRow.oferta_curso_unidade_id);
    }
  }

  for (const studentRow of studentRows) {
    if (studentRow.oferta_curso_unidade_id) {
      relatedOfferIds.add(studentRow.oferta_curso_unidade_id);
    }
  }

  const offerRowsResult = relatedOfferIds.size
    ? await supabase
        .from("ofertas_curso_unidade")
        .select("id, instituicao_id, unidade_id")
        .in("id", [...relatedOfferIds])
    : { data: [], error: null };

  if (offerRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as ofertas relacionadas aos usuarios institucionais.",
        offerRowsResult.error
      )
    );
  }

  const offerMap = new Map(
    ((offerRowsResult.data ?? []) as Array<
      Pick<CourseOfferRow, "id" | "instituicao_id" | "unidade_id">
    >).map((offer) => [offer.id, offer])
  );

  const entries = users.map((user) => {
    const profile = profilesById.get(user.perfil_id);
    const role = (profile?.codigo ?? "aluno") as VisibleProfileCode;
    let auxiliaryLabel = "Sem vÃƒÂ­nculo complementar";

    if (role === "aluno") {
      const student = studentMap.get(user.id);
      auxiliaryLabel = student?.matricula
        ? `RA ${student.matricula}`
        : "Aluno sem RA cadastrado";
    }

    if (role === "professor") {
      const professor = professorMap.get(user.id);
      auxiliaryLabel = professor?.registro_funcional
        ? `Registro ${professor.registro_funcional}`
        : "Professor sem registro funcional";
    }

    if (role === "coordenador") {
      const coordinator = coordinatorMap.get(user.id);
      auxiliaryLabel = coordinator?.cargo
        ? coordinator.cargo
        : "Coordenador sem cargo informado";
    }

    return {
      userId: user.id,
      name: user.nome_completo,
      email: user.email,
      role,
      roleLabel: roleLabel(role),
      unitId: user.unidade_id,
      unitName: user.unidade_id
        ? unitMap.get(user.unidade_id)?.nome ?? "Unidade nÃƒÂ£o identificada"
        : "Sem unidade vinculada",
      isActive: user.ativo,
      auxiliaryLabel
    };
  });

  const userScopeById = new Map(
    users.map((user) => {
      const student = studentMap.get(user.id) ?? null;
      const professor = professorMap.get(user.id) ?? null;
      const coordinator = coordinatorMap.get(user.id) ?? null;
      const userContexts = contextsByUserId.get(user.id) ?? [];
      const studentOffer =
        student?.oferta_curso_unidade_id
          ? offerMap.get(student.oferta_curso_unidade_id) ?? null
          : null;
      const contextOffers = userContexts
        .map((contextRow) =>
          contextRow.oferta_curso_unidade_id
            ? offerMap.get(contextRow.oferta_curso_unidade_id) ?? null
            : null
        )
        .filter(Boolean) as Array<Pick<CourseOfferRow, "id" | "instituicao_id" | "unidade_id">>;
      const relatedUnitIds = new Set<string>();
      const relatedInstitutionIds = new Set<string>();

      const appendInstitutionId = (institutionId: string | null | undefined) => {
        if (institutionId) {
          relatedInstitutionIds.add(institutionId);
        }
      };

      const appendUnitId = (unitId: string | null | undefined) => {
        if (!unitId) {
          return;
        }

        relatedUnitIds.add(unitId);
        appendInstitutionId(unitMap.get(unitId)?.instituicao_id ?? null);
      };

      appendUnitId(user.unidade_id);
      appendUnitId(coordinator?.unidade_id);
      appendUnitId(professor?.unidade_id);
      appendUnitId(student?.unidade_id);
      appendUnitId(studentOffer?.unidade_id);
      appendInstitutionId(studentOffer?.instituicao_id);

      for (const contextRow of userContexts) {
        appendInstitutionId(contextRow.instituicao_id);
      }

      for (const contextOffer of contextOffers) {
        appendUnitId(contextOffer.unidade_id);
        appendInstitutionId(contextOffer.instituicao_id);
      }

      return [
        user.id,
        {
          relatedUnitIds,
          relatedInstitutionIds,
          resolvedUnitId:
            user.unidade_id ??
            coordinator?.unidade_id ??
            professor?.unidade_id ??
            student?.unidade_id ??
            studentOffer?.unidade_id ??
            contextOffers[0]?.unidade_id ??
            null
        }
      ] as const;
    })
  );

  const filteredEntries = entries
    .filter((entry) => {
      const userScope = userScopeById.get(entry.userId);

      if (validInstitutionId && !userScope?.relatedInstitutionIds.has(validInstitutionId)) {
        return false;
      }

      if (validUnitId && !userScope?.relatedUnitIds.has(validUnitId)) {
        return false;
      }

      return true;
    })
    .map((entry) => {
      const userScope = userScopeById.get(entry.userId);
      const resolvedUnitId = userScope?.resolvedUnitId ?? entry.unitId;

      return {
        ...entry,
        unitId: resolvedUnitId,
        unitName: resolvedUnitId
          ? unitMap.get(resolvedUnitId)?.nome ?? entry.unitName
          : entry.unitName
      };
    });

  return {
    institutions: institutionOptions,
    units: unitOptions,
    filters: {
      institutionId: validInstitutionId,
      unitId: validUnitId,
      role: roleFilter,
      status: statusFilter
    },
    totalUsers: filteredEntries.length,
    activeUsers: filteredEntries.filter((entry) => entry.isActive).length,
    entries: filteredEntries
  };
}

export async function getMasterUnitDetailPageData(
  unitId: string,
  auditFilters?: {
    startDate?: string | string[] | null;
    endDate?: string | string[] | null;
    areaId?: string | string[] | null;
  }
): Promise<MasterUnitDetailPageData | null> {
  const supabase = createSupabaseAdminClient();
  const { data: unitData, error: unitError } = await supabase
    .from("unidades")
    .select("*")
    .eq("id", unitId)
    .maybeSingle();

  if (unitError) {
    throw new Error(
      formatSupabaseErrorMessage("NÃ£o foi possÃ­vel carregar a unidade solicitada.", unitError)
    );
  }

  const unit = (unitData ?? null) as UnitRow | null;

  if (!unit) {
    return null;
  }

  const institutionResult = unit.instituicao_id
    ? await supabase
        .from("instituicoes")
        .select("id, nome")
        .eq("id", unit.instituicao_id)
        .maybeSingle()
    : { data: null, error: null };

  if (institutionResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar a instituicao da unidade.",
        institutionResult.error
      )
    );
  }

  const institution = institutionResult.data as
    | Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome">
    | null;

  const [profiles, coordinatorsResult, usersResult, auditFeed] = await Promise.all([
    loadProfiles(),
    supabase
      .from("coordenadores")
      .select("*")
      .eq("unidade_id", unitId)
      .order("created_at", { ascending: false }),
    supabase.from("usuarios").select("*").eq("unidade_id", unitId),
    loadUnitAuditFeed({
      supabase,
      unitId,
      limit: 120,
      filters: auditFilters
    })
  ]);

  if (coordinatorsResult.error || usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel consolidar a visÃ£o institucional desta unidade.",
        coordinatorsResult.error ?? usersResult.error
      )
    );
  }

  const coordinators = (coordinatorsResult.data ?? []) as CoordinatorRow[];
  const users = (usersResult.data ?? []) as UserRow[];
  const semesters = auditFeed.semesterRows;
  const classes = auditFeed.classRows;
  const coordinatorUserMap = new Map(
    users
      .filter((user) => profiles.byId.get(user.perfil_id)?.codigo === "coordenador")
      .map((user) => [user.id, user])
  );
  const sortedCoordinators = sortCoordinatorRows(coordinators, coordinatorUserMap as Map<
    string,
    Pick<UserRow, "id" | "ativo" | "nome_completo" | "email">
  >);
  const responsibleCoordinator = sortedCoordinators[0]
    ? coordinatorUserMap.get(sortedCoordinators[0].usuario_id) ?? null
    : null;
  const activeCoordinatorCount = sortedCoordinators.filter(
    (coordinator) => coordinatorUserMap.get(coordinator.usuario_id)?.ativo
  ).length;
  const professorUsers = users.filter(
    (user) => profiles.byId.get(user.perfil_id)?.codigo === "professor"
  );
  const studentUsers = users.filter(
    (user) => profiles.byId.get(user.perfil_id)?.codigo === "aluno"
  );
  const classIds = classes.map((classGroup) => classGroup.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase.from("matriculas_turma").select("*").in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar as matrÃ­culas da unidade.",
        enrollmentRowsResult.error
      )
    );
  }

  const enrollments = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const pendingItems: string[] = [];

  if (!unit.ativo) {
    pendingItems.push("A unidade estÃ¡ inativa no cadastro institucional.");
  }

  if (!activeCoordinatorCount) {
    pendingItems.push("A unidade nÃ£o possui coordenador ativo no momento.");
  }

  if (!semesters.length) {
    pendingItems.push("A unidade ainda nÃ£o possui semestres cadastrados.");
  } else if (!semesters.some((semester) => semester.status === "ativo")) {
    pendingItems.push("A unidade nÃ£o possui semestre ativo.");
  }

  if (!professorUsers.length) {
    pendingItems.push("Ainda nÃ£o hÃ¡ professores cadastrados na unidade.");
  }

  if (!studentUsers.length) {
    pendingItems.push("Ainda nÃ£o hÃ¡ alunos cadastrados na unidade.");
  }

  return {
    unit: {
      id: unit.id,
      institutionId: unit.instituicao_id,
      institutionName: institution?.nome ?? "Instituicao nao identificada",
      name: unit.nome,
      acronym: unit.sigla,
      slug: unit.slug,
      city: unit.cidade,
      state: unit.estado,
      isActive: unit.ativo
    },
    summary: {
      totalCoordinators: sortedCoordinators.length,
      activeCoordinators: activeCoordinatorCount,
      totalProfessors: professorUsers.length,
      totalStudents: studentUsers.length,
      totalSemesters: semesters.length,
      activeSemesters: semesters.filter((semester) => semester.status === "ativo").length,
      totalClasses: classes.length,
      totalEnrollments: enrollments.length
    },
    responsibleCoordinator:
      responsibleCoordinator && sortedCoordinators[0]
        ? {
            id: sortedCoordinators[0].usuario_id,
            name: responsibleCoordinator.nome_completo,
            email: responsibleCoordinator.email,
            roleTitle: sortedCoordinators[0].cargo,
            isActive: responsibleCoordinator.ativo
          }
        : null,
    coordinators: sortedCoordinators.map((coordinator, index) => {
      const user = coordinatorUserMap.get(coordinator.usuario_id);

      return {
        coordinatorId: coordinator.usuario_id,
        name: user?.nome_completo ?? "Coordenador nÃ£o identificado",
        email: user?.email ?? "Sem e-mail",
        roleTitle: coordinator.cargo,
        isActive: Boolean(user?.ativo),
        isResponsible: index === 0,
        createdAt: coordinator.created_at
      };
    }),
    semesters: semesters.map((semester) => ({
      id: semester.id,
      code: semester.codigo,
      name: semester.nome,
      status: semester.status,
      startsAt: semester.data_inicio,
      endsAt: semester.data_fim
    })),
    pendingItems,
    auditAreas: auditFeed.areaOptions,
    auditFilters: auditFeed.filters,
    recentAuditEntries: auditFeed.entries
  };
}
export async function getMasterGlobalAuditPageData(input?: {
  institutionId?: string | string[];
  unitId?: string | string[];
  courseId?: string | string[];
  semesterId?: string | string[];
  role?: string | string[];
  period?: string | string[];
}): Promise<MasterGlobalAuditPageData> {
  const supabase = createSupabaseAdminClient();
  const [institutionsResult, unitsResult, coursesResult, offersResult, profiles] =
    await Promise.all([
      supabase.from("instituicoes").select("id, nome, slug, ativo").order("nome"),
      supabase.from("unidades").select("*").order("nome"),
      supabase.from("cursos").select("id, instituicao_id, codigo, nome").order("nome"),
      supabase
        .from("ofertas_curso_unidade")
        .select("id, instituicao_id, unidade_id, curso_id")
        .order("created_at", { ascending: false }),
      loadProfiles()
    ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as instituições para a auditoria global.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as unidades para a auditoria global.",
        unitsResult.error
      )
    );
  }

  if (coursesResult.error || offersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os cursos disponíveis para a auditoria global.",
        coursesResult.error ?? offersResult.error
      )
    );
  }

  const institutions = (institutionsResult.data ?? []) as Array<
    Pick<Database["public"]["Tables"]["instituicoes"]["Row"], "id" | "nome" | "slug" | "ativo">
  >;
  const units = (unitsResult.data ?? []) as UnitRow[];
  const courses = (coursesResult.data ?? []) as Array<
    Pick<CourseRow, "id" | "instituicao_id" | "codigo" | "nome">
  >;
  const offers = (offersResult.data ?? []) as Array<
    Pick<CourseOfferRow, "id" | "instituicao_id" | "unidade_id" | "curso_id">
  >;
  const institutionsById = new Map(
    institutions.map((institution) => [institution.id, institution])
  );
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const requestedInstitutionId = normalizeFilterValue(input?.institutionId);
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedCourseId = normalizeFilterValue(input?.courseId);
  const requestedSemesterId = normalizeFilterValue(input?.semesterId);
  const requestedRole = normalizeFilterValue(input?.role);
  const requestedPeriod = normalizeFilterValue(input?.period);
  const validInstitutionId = institutionsById.has(requestedInstitutionId)
    ? requestedInstitutionId
    : "";
  const requestedUnit = units.find((unit) => unit.id === requestedUnitId) ?? null;
  const validUnitId =
    requestedUnit &&
    (!validInstitutionId || requestedUnit.instituicao_id === validInstitutionId)
      ? requestedUnitId
      : "";
  const requestedCourse = courseMap.get(requestedCourseId) ?? null;
  const validCourseId =
    requestedCourse &&
    (!validInstitutionId || requestedCourse.instituicao_id === validInstitutionId) &&
    (!validUnitId ||
      offers.some(
        (offer) =>
          offer.curso_id === requestedCourseId &&
          offer.unidade_id === validUnitId &&
          (!validInstitutionId || offer.instituicao_id === validInstitutionId)
      ))
      ? requestedCourseId
      : "";
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
  const roleFilter: MasterGlobalAuditPageData["filters"]["role"] =
    visibleInstitutionalProfiles.includes(requestedRole as VisibleProfileCode)
      ? (requestedRole as VisibleProfileCode)
      : "todos";
  const periodFilter: MasterGlobalAuditPageData["filters"]["period"] =
    requestedPeriod === "7" ||
    requestedPeriod === "30" ||
    requestedPeriod === "90" ||
    requestedPeriod === "365"
      ? requestedPeriod
      : "all";
  const auditRowLimit =
    validUnitId || validInstitutionId || validCourseId ? 1200 : 400;
  const closedSemestersResult = await supabase
    .from("semestres")
    .select("*")
    .eq("status", "encerrado")
    .order("data_inicio", { ascending: false });

  if (closedSemestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os semestres encerrados da auditoria global.",
        closedSemestersResult.error
      )
    );
  }

  const closedSemesterRows = ((closedSemestersResult.data ?? []) as SemesterRow[]).filter(
    (semester) =>
      isSemesterVisibleInMasterAuditScope({
        semester,
        validInstitutionId,
        validUnitId,
        validCourseId,
        offersById: offerMap,
        unitsById: unitMap
      })
  );
  const closedSemesters = [...closedSemesterRows]
    .sort(
      (left, right) =>
        new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime()
    )
    .map((semester) => ({
      id: semester.id,
      code: semester.codigo,
      name: semester.nome
    }));
  const selectedSemester =
    closedSemesterRows.find((semester) => semester.id === requestedSemesterId) ?? null;
  const selectedSemesterId = selectedSemester?.id ?? null;

  let auditQuery = supabase
    .from("historico_alteracoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(auditRowLimit);

  if (periodFilter !== "all") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - Number(periodFilter));
    auditQuery = auditQuery.gte("created_at", threshold.toISOString());
  }

  const auditRowsResult = await auditQuery;

  if (auditRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os eventos da auditoria global.",
        auditRowsResult.error
      )
    );
  }

  const auditRows = (auditRowsResult.data ?? []) as AuditHistoryRow[];
  const evaluationIds = new Set<string>();
  const enrollmentIds = new Set<string>();
  const classIds = new Set<string>();
  const semesterIds = new Set<string>();

  for (const entry of auditRows) {
    const payload = asAuditRecord(entry.dados_depois ?? entry.dados_antes);

    if (entry.tabela === "semestres") {
      const semesterId = getAuditString(payload, "id") ?? entry.registro_id ?? undefined;

      if (semesterId) {
        semesterIds.add(semesterId);
      }
    }

    if (entry.tabela === "turmas") {
      const classId = getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
      const semesterId = getAuditString(payload, "semestre_id");

      if (classId) {
        classIds.add(classId);
      }

      if (semesterId) {
        semesterIds.add(semesterId);
      }
    }

    if (entry.tabela === "matriculas_turma") {
      const enrollmentId = getAuditString(payload, "id") ?? entry.registro_id ?? undefined;
      const classId = getAuditString(payload, "turma_id");

      if (enrollmentId) {
        enrollmentIds.add(enrollmentId);
      }

      if (classId) {
        classIds.add(classId);
      }
    }

    if (entry.tabela === "avaliacoes") {
      const evaluationId = getAuditString(payload, "id") ?? entry.registro_id ?? undefined;

      if (evaluationId) {
        evaluationIds.add(evaluationId);
      }
    }

    const directEvaluationId = getAuditString(payload, "avaliacao_id");
    if (directEvaluationId) {
      evaluationIds.add(directEvaluationId);
    }

    const directEnrollmentId = getAuditString(payload, "matricula_turma_id");
    if (directEnrollmentId) {
      enrollmentIds.add(directEnrollmentId);
    }

    const directClassId = getAuditString(payload, "turma_id");
    if (directClassId) {
      classIds.add(directClassId);
    }

    const directSemesterId = getAuditString(payload, "semestre_id");
    if (directSemesterId) {
      semesterIds.add(directSemesterId);
    }
  }

  const evaluationRowsResult = evaluationIds.size
    ? await supabase
        .from("avaliacoes")
        .select("id, matricula_turma_id, oferta_curso_unidade_id")
        .in("id", [...evaluationIds])
    : { data: [], error: null };

  if (evaluationRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar o contexto das avaliações para a auditoria global.",
        evaluationRowsResult.error
      )
    );
  }

  const evaluationRows = (evaluationRowsResult.data ?? []) as Array<
    Pick<EvaluationRow, "id" | "matricula_turma_id" | "oferta_curso_unidade_id">
  >;

  for (const evaluation of evaluationRows) {
    enrollmentIds.add(evaluation.matricula_turma_id);
  }

  const enrollmentRowsResult = enrollmentIds.size
    ? await supabase
        .from("matriculas_turma")
        .select("id, turma_id, oferta_curso_unidade_id")
        .in("id", [...enrollmentIds])
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar o contexto das matrículas para a auditoria global.",
        enrollmentRowsResult.error
      )
    );
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as Array<
    Pick<EnrollmentRow, "id" | "turma_id" | "oferta_curso_unidade_id">
  >;

  for (const enrollment of enrollmentRows) {
    classIds.add(enrollment.turma_id);
  }

  const classRowsResult = classIds.size
    ? await supabase
        .from("turmas")
        .select("id, semestre_id, oferta_curso_unidade_id")
        .in("id", [...classIds])
    : { data: [], error: null };

  if (classRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar o contexto das turmas para a auditoria global.",
        classRowsResult.error
      )
    );
  }

  const classRows = (classRowsResult.data ?? []) as Array<
    Pick<ClassRow, "id" | "semestre_id" | "oferta_curso_unidade_id">
  >;

  for (const classGroup of classRows) {
    semesterIds.add(classGroup.semestre_id);
  }

  const semesterRowsResult = semesterIds.size
    ? await supabase
        .from("semestres")
        .select("id, unidade_id, oferta_curso_unidade_id")
        .in("id", [...semesterIds])
    : { data: [], error: null };

  if (semesterRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar o contexto dos semestres para a auditoria global.",
        semesterRowsResult.error
      )
    );
  }

  const actorIds = [...new Set(auditRows.map((entry) => entry.usuario_id).filter(Boolean))] as string[];
  const actorUsersResult = actorIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo, perfil_id")
        .in("id", actorIds)
    : { data: [], error: null };

  if (actorUsersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os usuários responsáveis pelos eventos.",
        actorUsersResult.error
      )
    );
  }

  const actorUsers = (actorUsersResult.data ?? []) as Array<
    Pick<UserRow, "id" | "nome_completo" | "perfil_id">
  >;
  const actorUserMap = new Map(actorUsers.map((user) => [user.id, user]));
  const resolutionContext: MasterGlobalAuditResolutionContext = {
    evaluations: new Map(evaluationRows.map((evaluation) => [evaluation.id, evaluation])),
    enrollments: new Map(enrollmentRows.map((enrollment) => [enrollment.id, enrollment])),
    classes: new Map(classRows.map((classGroup) => [classGroup.id, classGroup])),
    semesters: new Map(
      (
        (semesterRowsResult.data ?? []) as Array<
          Pick<SemesterRow, "id" | "unidade_id" | "oferta_curso_unidade_id">
        >
      ).map((semester) => [semester.id, semester])
    ),
    offers: new Map(offers.map((offer) => [offer.id, offer]))
  };

  const entries = auditRows
    .map((entry) => {
      const actor = entry.usuario_id ? actorUserMap.get(entry.usuario_id) ?? null : null;
      const profileCode = actor
        ? ((profiles.byId.get(actor.perfil_id)?.codigo ?? null) as VisibleProfileCode | null)
        : null;
      const payload = asAuditRecord(entry.dados_depois ?? entry.dados_antes);
      const resolvedUnitId = resolveMasterAuditUnitId(entry, payload, resolutionContext);
      const resolvedCourseId = resolveMasterAuditCourseId(entry, payload, resolutionContext);
      const resolvedInstitutionId =
        resolvedUnitId
          ? unitMap.get(resolvedUnitId)?.instituicao_id ?? null
          : resolvedCourseId
            ? courseMap.get(resolvedCourseId)?.instituicao_id ?? null
            : null;
      const resolvedCourse = resolvedCourseId ? courseMap.get(resolvedCourseId) ?? null : null;

      return {
        id: String(entry.id),
        institutionId: resolvedInstitutionId,
        institutionName: resolvedInstitutionId
          ? institutionsById.get(resolvedInstitutionId)?.nome ?? "Instituição não identificada"
          : "Sem instituição",
        unitName: resolvedUnitId
          ? unitMap.get(resolvedUnitId)?.nome ?? "Unidade não identificada"
          : "Sem unidade",
        courseId: resolvedCourseId ?? null,
        courseName: buildCourseDisplayName(resolvedCourse),
        actorName: normalizeAuditDisplayText(actor?.nome_completo ?? "Sistema") || "Sistema",
        actorProfileLabel:
          normalizeAuditDisplayText(profileCode ? roleLabel(profileCode) : "Sistema") || "Sistema",
        actorProfileCode: profileCode,
        action: entry.acao,
        tableName: normalizeAuditDisplayText(entry.tabela) || entry.tabela,
        recordLabel: normalizeAuditDisplayText(buildRecordLabel(entry)) || entry.tabela,
        summary:
          normalizeAuditDisplayText(buildAuditSummary(entry)) || buildAuditSummary(entry),
        detailsText: normalizeAuditDisplayText(
          [
            `Perfil: ${profileCode ? roleLabel(profileCode) : "Sistema"}`,
            `Responsável: ${actor?.nome_completo ?? "Sistema"}`,
            `Tabela: ${entry.tabela}`,
            `Registro: ${buildRecordLabel(entry)}`
          ].join(" | ")
        ),
        happenedAt: entry.created_at,
        unitId: resolvedUnitId
      };
    })
    .filter((entry) => {
      if (validInstitutionId && entry.institutionId !== validInstitutionId) {
        return false;
      }

      if (validUnitId && entry.unitId !== validUnitId) {
        return false;
      }

      if (validCourseId && entry.courseId !== validCourseId) {
        return false;
      }

      if (roleFilter !== "todos" && entry.actorProfileCode !== roleFilter) {
        return false;
      }

      return true;
    });
  const selectedClosedSemester = selectedSemester
    ? await buildMasterClosedSemesterAuditView({
        semester: selectedSemester,
        fallbackAuditRows: auditRows
      })
    : null;

  return {
    institutions: buildInstitutionOptions(institutions),
    units: buildUnitOptions(units, institutionsById),
    courses: buildCourseOptions(courses, offers),
    closedSemesters,
    selectedSemesterId,
    selectedClosedSemester,
    filters: {
      institutionId: validInstitutionId,
      unitId: validUnitId,
      courseId: validCourseId,
      role: roleFilter,
      period: periodFilter
    },
    totalEvents: entries.length,
    totalUnitsTouched: new Set(entries.map((entry) => entry.unitId).filter(Boolean)).size,
    totalActors: new Set(
      entries
        .filter((entry) => entry.actorName !== "Sistema")
        .map((entry) => `${entry.actorName}-${entry.actorProfileLabel}`)
    ).size,
    generatedAt: new Date().toISOString(),
    entries: entries.map((entry) => ({
      id: entry.id,
      institutionName: entry.institutionName,
      unitName: entry.unitName,
      courseName: entry.courseName,
      actorName: entry.actorName,
      actorProfileLabel: entry.actorProfileLabel,
      action: entry.action,
      tableName: entry.tableName,
      recordLabel: entry.recordLabel,
      summary: entry.summary,
      detailsText: entry.detailsText,
      happenedAt: entry.happenedAt
    }))
  };
}
