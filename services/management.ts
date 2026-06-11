import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadScopedOperationalGraph,
  resolveScopedDataAccess,
  type ResolvedSessionDataScope
} from "@/lib/auth/data-scope";
import {
  buildStageAreaBlocks,
  loadVisibleStageAreaCatalog
} from "@/services/stage-areas";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ProfessorAreaRow = Database["public"]["Tables"]["professor_areas_estagio"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

interface ScopedProfessorRoster {
  professorUsers: UserRow[];
  professorRows: ProfessorRow[];
  professorAreaRows: ProfessorAreaRow[];
}

async function resolveSafeLegacyProfessorUnitIds(input: {
  supabase: SupabaseServerClient;
  scope: ResolvedSessionDataScope;
  selectedUnitId?: UnitRow["id"] | null;
}) {
  const requestedUnitIds = input.selectedUnitId
    ? [input.selectedUnitId]
    : input.scope.unitIds;

  if (!requestedUnitIds.length) {
    return [] as UnitRow["id"][];
  }

  if (input.scope.scopeKind !== "course_manager") {
    return requestedUnitIds;
  }

  if (!input.scope.instituicaoId || !input.scope.cursoId) {
    return [] as UnitRow["id"][];
  }

  const { data: scopedOfferData, error: scopedOfferError } = await input.supabase
    .from("ofertas_curso_unidade")
    .select("unidade_id, curso_id")
    .eq("instituicao_id", input.scope.instituicaoId)
    .in("unidade_id", requestedUnitIds);

  if (scopedOfferError) {
    throw new Error(
      "Houve um problema ao validar as unidades legadas seguras para os professores do curso."
    );
  }

  const courseIdsByUnit = new Map<UnitRow["id"], Set<string>>();

  for (const offerRow of (scopedOfferData ?? []) as Array<
    Pick<OfferRow, "unidade_id" | "curso_id">
  >) {
    const unitCourseIds = courseIdsByUnit.get(offerRow.unidade_id) ?? new Set<string>();
    unitCourseIds.add(offerRow.curso_id);
    courseIdsByUnit.set(offerRow.unidade_id, unitCourseIds);
  }

  return requestedUnitIds.filter((unitId) => {
    const visibleCourseIds = courseIdsByUnit.get(unitId) ?? new Set<string>();
    return visibleCourseIds.size === 1 && visibleCourseIds.has(input.scope.cursoId!);
  });
}

async function loadScopedProfessorRoster(input: {
  supabase: SupabaseServerClient;
  scope: ResolvedSessionDataScope;
  professorProfileId: ProfileRow["id"] | undefined;
  professorLinks: ProfessorLinkRow[];
  offersById: Map<string, OfferRow>;
  selectedUnitId?: UnitRow["id"] | null;
  currentUnitId?: UnitRow["id"] | null;
}) {
  if (!input.professorProfileId) {
    return {
      professorUsers: [],
      professorRows: [],
      professorAreaRows: []
    } satisfies ScopedProfessorRoster;
  }

  if (input.scope.restrictToCourse) {
    const safeLegacyUnitIds = await resolveSafeLegacyProfessorUnitIds({
      supabase: input.supabase,
      scope: input.scope,
      selectedUnitId: input.selectedUnitId
    });

    const [contextRowsResult, fallbackUnitUsersResult] = await Promise.all([
      input.scope.instituicaoId && input.scope.cursoId
        ? input.supabase
            .from("usuarios_papeis_contexto")
            .select("*")
            .eq("perfil_id", input.professorProfileId)
            .eq("instituicao_id", input.scope.instituicaoId)
            .eq("curso_id", input.scope.cursoId)
            .eq("ativo", true)
        : Promise.resolve({ data: [], error: null }),
      safeLegacyUnitIds.length
        ? input.supabase
            .from("usuarios")
            .select("*")
            .eq("perfil_id", input.professorProfileId)
            .in("unidade_id", safeLegacyUnitIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (contextRowsResult.error || fallbackUnitUsersResult.error) {
      throw new Error(
        "Houve um problema ao consultar os vínculos institucionais dos professores."
      );
    }

    const contextRows = ((contextRowsResult.data ?? []) as UserContextRow[]).filter(
      (contextRow) => {
        if (contextRow.oferta_curso_unidade_id) {
          if (!input.scope.offerIds.includes(contextRow.oferta_curso_unidade_id)) {
            return false;
          }

          if (input.selectedUnitId) {
            const offerRow =
              input.offersById.get(contextRow.oferta_curso_unidade_id) ?? null;
            return offerRow?.unidade_id === input.selectedUnitId;
          }

          return true;
        }

        return !input.selectedUnitId;
      }
    );
    const fallbackUnitUsers = (fallbackUnitUsersResult.data ?? []) as UserRow[];
    const professorIds = uniqueStringValues([
      ...input.professorLinks.map((link) => link.professor_id),
      ...contextRows.map((contextRow) => contextRow.usuario_id),
      ...fallbackUnitUsers.map((user) => user.id)
    ]);
    const [professorUsersResult, professorRowsResult, professorAreaRowsResult] =
      await Promise.all([
        professorIds.length
          ? input.supabase.from("usuarios").select("*").in("id", professorIds)
          : Promise.resolve({ data: [], error: null }),
        professorIds.length
          ? input.supabase.from("professores").select("*").in("usuario_id", professorIds)
          : Promise.resolve({ data: [], error: null }),
        professorIds.length
          ? input.supabase
              .from("professor_areas_estagio")
              .select("*")
              .in("professor_id", professorIds)
              .eq("ativo", true)
          : Promise.resolve({ data: [], error: null })
      ]);

    if (
      professorUsersResult.error ||
      professorRowsResult.error ||
      professorAreaRowsResult.error
    ) {
      throw new Error(
        "Houve um problema ao consultar professores e áreas vinculadas ao contexto visível."
      );
    }

    return {
      professorUsers: ((professorUsersResult.data ?? []) as UserRow[]).filter(
        (user) => user.perfil_id === input.professorProfileId
      ),
      professorRows: (professorRowsResult.data ?? []) as ProfessorRow[],
      professorAreaRows: (professorAreaRowsResult.data ?? []) as ProfessorAreaRow[]
    } satisfies ScopedProfessorRoster;
  }

  const currentUnitId = input.currentUnitId ?? null;

  if (!currentUnitId) {
    return {
      professorUsers: [],
      professorRows: [],
      professorAreaRows: []
    } satisfies ScopedProfessorRoster;
  }

  const [unitUsersResult, professorRowsResult] = await Promise.all([
    input.supabase.from("usuarios").select("*").eq("unidade_id", currentUnitId),
    input.supabase.from("professores").select("*")
  ]);

  if (unitUsersResult.error || professorRowsResult.error) {
    throw new Error(
      "Houve um problema ao consultar os professores vinculados à unidade ativa."
    );
  }

  const professorUsers = ((unitUsersResult.data ?? []) as UserRow[]).filter(
    (user) => user.perfil_id === input.professorProfileId
  );
  const professorUserIds = professorUsers.map((user) => user.id);
  const scopedProfessorAreaRowsResult = professorUserIds.length
    ? await input.supabase
        .from("professor_areas_estagio")
        .select("*")
        .in("professor_id", professorUserIds)
        .eq("ativo", true)
    : { data: [], error: null };

  if (scopedProfessorAreaRowsResult.error) {
    throw new Error(
      "Houve um problema ao consultar as áreas vinculadas aos supervisores da unidade."
    );
  }

  return {
    professorUsers,
    professorRows: ((professorRowsResult.data ?? []) as ProfessorRow[]).filter((professor) =>
      professorUserIds.includes(professor.usuario_id)
    ),
    professorAreaRows: (scopedProfessorAreaRowsResult.data ?? []) as ProfessorAreaRow[]
  } satisfies ScopedProfessorRoster;
}

export interface ManagementSemesterOption {
  id: string;
  label: string;
  code: string;
  name: string;
  status: SemesterRow["status"];
  startsAt: string;
  endsAt: string;
}

export interface ManagementAreaOption {
  id: string;
  code: string;
  name: string;
  blockId: number;
  blockCode: string;
  blockName: string;
}

export interface ManagementAreaBlock {
  id: number;
  code: string;
  name: string;
  areas: ManagementAreaOption[];
}

export interface ManagementProfessorOption {
  id: string;
  name: string;
  email: string;
  functional: string | null;
  areaIds: string[];
  label: string;
}

export interface ManagementUnitOption {
  id: string;
  name: string;
  label: string;
}

export interface ManagementStudentAssignment {
  enrollmentId: string;
  semesterId: string;
  semesterCode: string;
  offerId: string | null;
  unitId: string | null;
  unitName: string | null;
  className: string;
  areaName: string;
  blockName: string;
  supervisorNames: string[];
  supervisorIds: string[];
}

export interface ManagementStudentListItem {
  id: string;
  name: string;
  registration: string;
  cellphone: string | null;
  email: string;
  unitId: string | null;
  unitName: string | null;
  isActive: boolean;
  assignments: ManagementStudentAssignment[];
}

export interface ManagementProfessorListItem {
  id: string;
  name: string;
  email: string;
  functional: string | null;
  unitId: string | null;
  unitName: string | null;
  isActive: boolean;
  areas: string[];
}

export interface ManagementSecretaryListItem {
  id: string;
  name: string;
  email: string;
  unitId: string | null;
  unitName: string | null;
  isActive: boolean;
}

export interface ManagementPageData {
  coordinator: {
    id: string;
    name: string;
    email: string;
  };
  semesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
  isCourseManager: boolean;
  selectedUnitId: string | null;
  unitOptions: ManagementUnitOption[];
  students: ManagementStudentListItem[];
  professors: ManagementProfessorListItem[];
  secretaries: ManagementSecretaryListItem[];
}

export interface ManagementStudentSemesterAssignmentRecord {
  enrollmentId: string;
  areaId: string | null;
  areaName: string;
  blockName: string;
  className: string;
  enrollmentStatus: EnrollmentRow["status"];
  currentSupervisorIds: string[];
  currentSupervisorNames: string[];
  allSupervisorNames: string[];
}

export interface ManagementStudentSemesterRecord {
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  semesterStatus: SemesterRow["status"];
  startsAt: string;
  endsAt: string;
  assignments: ManagementStudentSemesterAssignmentRecord[];
}

export interface StudentManagementDetailData {
  coordinator: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    name: string;
    fullName: string;
    registration: string;
    cellphone: string | null;
    email: string;
    isActive: boolean;
  };
  semesters: ManagementSemesterOption[];
  manageableSemesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
  semesterHistory: ManagementStudentSemesterRecord[];
  defaultManagementSemesterId: string;
}

export interface ManagementPageLoadResult {
  pageData: ManagementPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface StudentManagementDetailLoadResult {
  studentData: StudentManagementDetailData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

function buildEmptyState(title: string, description: string): ManagementPageLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function sortSemesters(semesters: SemesterRow[]) {
  return [...semesters].sort((left, right) => {
    const statusWeight = (semester: SemesterRow) =>
      semester.status === "ativo" ? 2 : semester.status === "planejado" ? 1 : 0;

    const statusDifference = statusWeight(right) - statusWeight(left);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime();
  });
}

function getRequiredManagementUnitId(currentUser: SessionUser) {
  return currentUser.unitId ?? null;
}

export async function getCoordinatorManagementPageData(
  currentUser: SessionUser,
  filters?: {
    unitId?: string | null;
  }
): Promise<ManagementPageLoadResult> {
  const supabase = await createSupabaseServerClient();
  const [scopedGraph, blockRowsResult, profileRowsResult] =
    await Promise.all([
      loadScopedOperationalGraph(currentUser, { supabase }),
      supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true }),
      supabase
        .from("perfis")
        .select("*")
        .in("codigo", ["aluno", "professor", "secretaria"])
    ]);

  if (blockRowsResult.error || profileRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os dados reais de semestres, áreas, alunos, professores ou vínculos."
    );
  }

  const scope = scopedGraph.scope;

  if (
    scope.scopeKind === "none" ||
    (scope.restrictToCourse && scopedGraph.semesterRows.length === 0 && scope.offerIds.length === 0)
  ) {
    return buildEmptyState(
      "Contexto acadêmico não identificado",
      "O usuário autenticado precisa estar vinculado a uma oferta, curso ou unidade válida para acessar a gestão acadêmica."
    );
  }

  const semesterRows = sortSemesters(scopedGraph.semesterRows);
  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const profileRows = (profileRowsResult.data ?? []) as ProfileRow[];
  const [offerRowsResult, unitRowsResult] = await Promise.all([
    scope.offerIds.length
      ? supabase.from("ofertas_curso_unidade").select("*").in("id", scope.offerIds)
      : Promise.resolve({ data: [], error: null }),
    scope.unitIds.length
      ? supabase.from("unidades").select("*").in("id", scope.unitIds).order("nome")
      : Promise.resolve({ data: [], error: null })
  ]);

  if (offerRowsResult.error || unitRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar as unidades e ofertas visíveis para o contexto atual."
    );
  }

  if (!blockRows.length) {
    return buildEmptyState(
      "Estrutura academica incompleta",
      "Cadastre ao menos os blocos de estágio para liberar o fluxo de cadastro e a organização das áreas supervisionadas."
    );
  }

  const profileMap = new Map(profileRows.map((profile) => [profile.codigo, profile.id]));
  const offerRows = (offerRowsResult.data ?? []) as OfferRow[];
  const unitRows = (unitRowsResult.data ?? []) as UnitRow[];
  const offersById = new Map(offerRows.map((offer) => [offer.id, offer]));
  const unitsById = new Map(unitRows.map((unit) => [unit.id, unit]));
  const unitOptions = unitRows
    .map((unit) => ({
      id: unit.id,
      name: unit.nome,
      label: unit.nome
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const requestedUnitId = filters?.unitId?.trim() || null;
  const selectedUnitId = requestedUnitId && unitOptions.some((unit) => unit.id === requestedUnitId)
    ? requestedUnitId
    : null;
  const visibleClassRows = scopedGraph.classRows.filter((classGroup) => classGroup.ativa);
  const enrollmentRows = scopedGraph.enrollmentRows;
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const professorLinksResult = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .eq("ativo", true)
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (professorLinksResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os vínculos de supervisão da unidade."
    );
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  let studentUsers: UserRow[] = [];
  let studentRows: StudentRow[] = [];
  let professorUsers: UserRow[] = [];
  let professorRows: ProfessorRow[] = [];
  let professorAreaRows: ProfessorAreaRow[] = [];
  let secretaries: ManagementSecretaryListItem[] = [];
  let currentUnitId: string | null = null;
  let areaRows: AreaRow[] = [];

  if (scope.restrictToCourse) {
    const secretaryProfileId = profileMap.get("secretaria");
    const enrollmentStudentIds = uniqueStringValues(
      enrollmentRows.map((enrollment) => enrollment.aluno_id)
    );
    const studentRowsByCoursePromise = scope.cursoId
      ? supabase.from("alunos").select("*").eq("curso_id", scope.cursoId)
      : Promise.resolve({ data: [], error: null });
    const studentRowsByOfferPromise = scope.offerIds.length
      ? supabase.from("alunos").select("*").in("oferta_curso_unidade_id", scope.offerIds)
      : Promise.resolve({ data: [], error: null });
    const studentRowsByEnrollmentPromise = enrollmentStudentIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", enrollmentStudentIds)
      : Promise.resolve({ data: [], error: null });
    const secretariesResult =
      secretaryProfileId && scope.unitIds.length
        ? supabase
            .from("usuarios")
            .select("*")
            .eq("perfil_id", secretaryProfileId)
            .in("unidade_id", selectedUnitId ? [selectedUnitId] : scope.unitIds)
        : Promise.resolve({ data: [], error: null });

    const [
      studentRowsByCourseResult,
      studentRowsByOfferResult,
      studentRowsByEnrollmentResult,
      secretariesUsersResult
    ] = await Promise.all([
      studentRowsByCoursePromise,
      studentRowsByOfferPromise,
      studentRowsByEnrollmentPromise,
      secretariesResult
    ]);

    if (
      studentRowsByCourseResult.error ||
      studentRowsByOfferResult.error ||
      studentRowsByEnrollmentResult.error ||
      secretariesUsersResult.error
    ) {
      return buildEmptyState(
        "Não foi possível carregar a gestao academica",
        "Houve um problema ao consultar os alunos do curso visível no contexto atual."
      );
    }

    const mergedStudentRows = new Map<string, StudentRow>();

    for (const studentRow of [
      ...((studentRowsByCourseResult.data ?? []) as StudentRow[]),
      ...((studentRowsByOfferResult.data ?? []) as StudentRow[]),
      ...((studentRowsByEnrollmentResult.data ?? []) as StudentRow[])
    ]) {
      mergedStudentRows.set(studentRow.usuario_id, studentRow);
    }

    studentRows = Array.from(mergedStudentRows.values());
    const studentUserIds = studentRows.map((student) => student.usuario_id);
    const [studentUsersResult] = await Promise.all([
      studentUserIds.length
        ? supabase.from("usuarios").select("*").in("id", studentUserIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (studentUsersResult.error) {
      return buildEmptyState(
        "Não foi possível carregar a gestao academica",
        "Houve um problema ao consultar professores, alunos ou turmas dentro do curso visível."
      );
    }

    studentUsers = (studentUsersResult.data ?? []) as UserRow[];
    secretaries = ((secretariesUsersResult.data ?? []) as UserRow[])
      .map((user) => ({
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        unitId: user.unidade_id ?? null,
        unitName: user.unidade_id ? unitsById.get(user.unidade_id)?.nome ?? null : null,
        isActive: user.ativo
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  } else {
    const resolvedCurrentUnitId = getRequiredManagementUnitId(currentUser);

    if (!resolvedCurrentUnitId) {
      return buildEmptyState(
        "Unidade operacional não identificada",
        "O coordenador autenticado precisa estar vinculado a uma unidade para acessar a gestão acadêmica."
      );
    }

    const { data: unitUsersData, error: unitUsersError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("unidade_id", resolvedCurrentUnitId);

    if (unitUsersError) {
      return buildEmptyState(
        "Não foi possível carregar a gestao academica",
        "Houve um problema ao consultar os usuários reais da unidade."
      );
    }

    currentUnitId = resolvedCurrentUnitId;
    const unitUsers = (unitUsersData ?? []) as UserRow[];
    const secretaryUsers = unitUsers.filter((user) => user.perfil_id === profileMap.get("secretaria"));
    studentUsers = unitUsers.filter((user) => user.perfil_id === profileMap.get("aluno"));
    const studentUserIds = studentUsers.map((user) => user.id);
    const [studentRowsResult] = await Promise.all([
      studentUserIds.length
        ? supabase.from("alunos").select("*").in("usuario_id", studentUserIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (studentRowsResult.error) {
      return buildEmptyState(
        "Não foi possível carregar a gestao academica",
        "Houve um problema ao consultar professores, alunos ou turmas da unidade."
      );
    }

    studentRows = (studentRowsResult.data ?? []) as StudentRow[];
    secretaries = secretaryUsers
      .map((user) => ({
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        unitId: user.unidade_id ?? null,
        unitName: user.unidade_id ? unitsById.get(user.unidade_id)?.nome ?? null : null,
        isActive: user.ativo
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }

  try {
    const professorRoster = await loadScopedProfessorRoster({
      supabase,
      scope,
      professorProfileId: profileMap.get("professor"),
      professorLinks,
      offersById,
      selectedUnitId,
      currentUnitId
    });

    professorUsers = professorRoster.professorUsers;
    professorRows = professorRoster.professorRows;
    professorAreaRows = professorRoster.professorAreaRows;
  } catch {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os professores e supervisores visíveis no contexto atual."
    );
  }

  try {
    const visibleStageAreaCatalog = await loadVisibleStageAreaCatalog({
      supabase,
      scope,
      selectedUnitId,
      offerRows,
      visibleClassRows,
      professorAreaRows
    });

    areaRows = visibleStageAreaCatalog.areaRows;
  } catch {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar as áreas supervisionadas visíveis no contexto atual."
    );
  }

  const blockMap = new Map(blockRows.map((block) => [block.id, block]));
  const areaMap = new Map(areaRows.map((área) => [área.id, área]));
  const semesterMap = new Map(semesterRows.map((semester) => [semester.id, semester]));
  const classMap = new Map(visibleClassRows.map((classGroup) => [classGroup.id, classGroup]));
  const professorMap = new Map(professorRows.map((professor) => [professor.usuario_id, professor]));
  const professorUserMap = new Map(professorUsers.map((user) => [user.id, user]));
  const studentMap = new Map(studentRows.map((student) => [student.usuario_id, student]));
  const areaBlocks = buildStageAreaBlocks({
    blockRows,
    areaRows
  });

  const professorOptions = professorUsers
    .filter((user) => user.ativo)
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areaIds = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => link.area_estagio_id);
      const areaNames = areaIds
        .map((areaId) => areaMap.get(areaId)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        areaIds,
        label: `${user.nome_completo} - ${professor.registro_funcional ?? "Sem funcional"}${areaNames.length ? ` - ${areaNames.join(", ")}` : ""}`
      } satisfies ManagementProfessorOption;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementProfessorOption[];

  const students = studentUsers
    .map((user) => {
      const student = studentMap.get(user.id);

      if (!student) {
        return null;
      }

      const studentAssignments = enrollmentRows
        .filter((enrollment) => enrollment.aluno_id === user.id && enrollment.status === "ativa")
        .map((enrollment) => {
          const classGroup = classMap.get(enrollment.turma_id);

          if (!classGroup) {
            return null;
          }

          const semester = semesterMap.get(classGroup.semestre_id);
          const offerRow =
            (classGroup.oferta_curso_unidade_id
              ? offersById.get(classGroup.oferta_curso_unidade_id) ?? null
              : null) ??
            (semester?.oferta_curso_unidade_id
              ? offersById.get(semester.oferta_curso_unidade_id) ?? null
              : null) ??
            (student.oferta_curso_unidade_id
              ? offersById.get(student.oferta_curso_unidade_id) ?? null
              : null);
          const unitRow =
            (offerRow?.unidade_id ? unitsById.get(offerRow.unidade_id) ?? null : null) ??
            (student.unidade_id ? unitsById.get(student.unidade_id) ?? null : null);
          const área = classGroup.area_estagio_id
            ? areaMap.get(classGroup.area_estagio_id)
            : null;
          const block = área ? blockMap.get(área.bloco_id) : null;
          const linkedProfessors = professorLinks
            .filter((link) => link.matricula_turma_id === enrollment.id)
            .sort(
              (left, right) =>
                Number(right.responsavel_principal) - Number(left.responsavel_principal)
            );
          const supervisorNames = linkedProfessors
            .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
            .filter(Boolean) as string[];
          const supervisorIds = linkedProfessors.map((link) => link.professor_id);

          if (!semester) {
            return null;
          }

          return {
            enrollmentId: enrollment.id,
            semesterId: semester.id,
            semesterCode: semester.codigo,
            offerId: offerRow?.id ?? null,
            unitId: unitRow?.id ?? student.unidade_id ?? null,
            unitName: unitRow?.nome ?? null,
            className: classGroup.nome,
            areaName: área?.nome ?? classGroup.area_estagio,
            blockName: block?.nome ?? "Bloco não identificado",
            supervisorNames,
            supervisorIds
          } satisfies ManagementStudentAssignment;
        })
        .filter(Boolean)
        .sort((left, right) => {
          const semesterDifference = right!.semesterCode.localeCompare(left!.semesterCode);

          if (semesterDifference !== 0) {
            return semesterDifference;
          }

          return left!.areaName.localeCompare(right!.areaName, "pt-BR");
        }) as ManagementStudentAssignment[];

      const primaryOfferRow = student.oferta_curso_unidade_id
        ? offersById.get(student.oferta_curso_unidade_id) ?? null
        : null;
      const primaryUnitId = primaryOfferRow?.unidade_id ?? student.unidade_id ?? null;
      const primaryUnitName =
        (primaryUnitId ? unitsById.get(primaryUnitId)?.nome ?? null : null) ??
        studentAssignments[0]?.unitName ??
        null;
      const visibleAssignments = selectedUnitId
        ? studentAssignments.filter((assignment) => assignment.unitId === selectedUnitId)
        : studentAssignments;
      const matchesSelectedUnit =
        !selectedUnitId ||
        primaryUnitId === selectedUnitId ||
        visibleAssignments.length > 0;

      if (!matchesSelectedUnit) {
        return null;
      }

      return {
        id: user.id,
        name: student.nome_social ?? user.nome_completo,
        registration: student.matricula,
        cellphone: student.celular,
        email: user.email,
        unitId: primaryUnitId,
        unitName: primaryUnitName,
        isActive: user.ativo,
        assignments: visibleAssignments
      } satisfies ManagementStudentListItem;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementStudentListItem[];

  const professors = professorUsers
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areas = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => areaMap.get(link.area_estagio_id)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        unitId: user.unidade_id ?? null,
        unitName: user.unidade_id ? unitsById.get(user.unidade_id)?.nome ?? null : null,
        isActive: user.ativo,
        areas
      } satisfies ManagementProfessorListItem;
    })
    .filter((professor): professor is ManagementProfessorListItem => professor !== null)
    .filter((professor) => !selectedUnitId || professor.unitId === selectedUnitId)
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const filteredSecretaries = selectedUnitId
    ? secretaries.filter((secretary) => secretary.unitId === selectedUnitId)
    : secretaries;

  return {
    pageData: {
      coordinator: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      semesters: semesterRows.map((semester) => ({
        id: semester.id,
        code: semester.codigo,
        name: semester.nome,
        status: semester.status,
        startsAt: semester.data_inicio,
        endsAt: semester.data_fim,
        label: `${semester.codigo} - ${semester.nome}`
      })),
      areaBlocks,
      professorOptions,
      isCourseManager: scope.scopeKind === "course_manager",
      selectedUnitId,
      unitOptions,
      students,
      professors,
      secretaries: filteredSecretaries
    },
    emptyState: null
  };
}

export async function getStudentManagementDetailData(
  currentUser: SessionUser,
  studentId: string
): Promise<StudentManagementDetailLoadResult> {
  const supabase = await createSupabaseServerClient();
  const [scope, scopedGraph, blockRowsResult, profileRowsResult] =
    await Promise.all([
      resolveScopedDataAccess(currentUser, { supabase }),
      loadScopedOperationalGraph(currentUser, { supabase }),
      supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true }),
      supabase.from("perfis").select("*").in("codigo", ["aluno", "professor"])
    ]);

  if (blockRowsResult.error || profileRowsResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar o cadastro permanente e o histórico de estagio deste aluno."
      }
    };
  }

  if (
    scope.scopeKind === "none" ||
    (scope.restrictToCourse && scopedGraph.semesterRows.length === 0 && scope.offerIds.length === 0)
  ) {
    return {
      studentData: null,
      emptyState: {
        title: "Contexto acadêmico não identificado",
        description:
          "O usuário autenticado precisa estar vinculado a uma oferta, curso ou unidade válida para acessar a gestão do aluno."
      }
    };
  }

  const studentUserResult = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();
  const studentRowResult = await supabase
    .from("alunos")
    .select("*")
    .eq("usuario_id", studentId)
    .maybeSingle();

  if (studentUserResult.error || studentRowResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar o cadastro permanente e o histórico de estagio deste aluno."
      }
    };
  }

  const studentUser = (studentUserResult.data ?? null) as UserRow | null;
  const studentRow = (studentRowResult.data ?? null) as StudentRow | null;

  if (!studentUser || !studentRow) {
    return {
      studentData: null,
      emptyState: {
        title: "Aluno não encontrado",
        description:
          "O cadastro solicitado não foi localizado nas tabelas de dominio do sistema."
      }
    };
  }

  const canAccessStudent =
    scope.restrictToCourse
      ? studentRow.curso_id === scope.cursoId &&
        (scope.scopeKind === "course_manager" ||
          scope.unitIds.length === 0 ||
          scope.unitIds.includes(studentRow.unidade_id ?? ""))
      : studentUser.unidade_id === getRequiredManagementUnitId(currentUser);

  if (!canAccessStudent) {
    return {
      studentData: null,
      emptyState: {
        title: "Aluno não encontrado",
        description:
          "O cadastro solicitado não pertence ao contexto institucional ativo."
      }
    };
  }

  const semesterRows = sortSemesters(scopedGraph.semesterRows);
  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const profileRows = (profileRowsResult.data ?? []) as ProfileRow[];
  const profileMap = new Map(profileRows.map((profile) => [profile.codigo, profile.id]));
  const professorProfileId = profileMap.get("professor");
  const offerRowsResult = scope.offerIds.length
    ? await supabase.from("ofertas_curso_unidade").select("*").in("id", scope.offerIds)
    : { data: [], error: null };

  if (offerRowsResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar as ofertas vinculadas ao contexto institucional ativo."
      }
    };
  }

  const offerRows = (offerRowsResult.data ?? []) as OfferRow[];
  const offersById = new Map(offerRows.map((offer) => [offer.id, offer]));
  const visibleClassRows = scopedGraph.classRows;
  const visibleClassIds = new Set(visibleClassRows.map((classGroup) => classGroup.id));
  const enrollmentRows = scopedGraph.enrollmentRows.filter(
    (enrollment) => enrollment.aluno_id === studentId && visibleClassIds.has(enrollment.turma_id)
  );
  const professorLinksResult = enrollmentRows.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .in("matricula_turma_id", enrollmentRows.map((enrollment) => enrollment.id))
    : { data: [], error: null };

  if (professorLinksResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar os supervisores",
        description:
          "O histórico de supervisao do aluno não pode ser consultado neste momento."
      }
    };
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const currentUnitId = getRequiredManagementUnitId(currentUser);

  if (!scope.restrictToCourse && !currentUnitId) {
    return {
      studentData: null,
      emptyState: {
        title: "Unidade operacional não identificada",
        description:
          "O usuário autenticado precisa estar vinculado a uma unidade para acessar a gestão detalhada do aluno."
      }
    };
  }

  let professorUsers: UserRow[] = [];
  let professorRows: ProfessorRow[] = [];
  let professorAreaRows: ProfessorAreaRow[] = [];
  let areaRows: AreaRow[] = [];

  try {
    const professorRoster = await loadScopedProfessorRoster({
      supabase,
      scope,
      professorProfileId,
      professorLinks,
      offersById,
      currentUnitId
    });

    professorUsers = professorRoster.professorUsers;
    professorRows = professorRoster.professorRows;
    professorAreaRows = professorRoster.professorAreaRows;

    const visibleStageAreaCatalog = await loadVisibleStageAreaCatalog({
      supabase,
      scope,
      offerRows,
      visibleClassRows,
      professorAreaRows
    });

    areaRows = visibleStageAreaCatalog.areaRows;
  } catch (error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          error instanceof Error
            ? error.message
            : "Houve um problema ao consultar os professores e supervisores disponíveis."
      }
    };
  }

  const blockMap = new Map(blockRows.map((block) => [block.id, block]));
  const areaMap = new Map(areaRows.map((área) => [área.id, área]));
  const semesterMap = new Map(semesterRows.map((semester) => [semester.id, semester]));
  const classMap = new Map(visibleClassRows.map((classGroup) => [classGroup.id, classGroup]));
  const professorMap = new Map(professorRows.map((professor) => [professor.usuario_id, professor]));
  const professorUserMap = new Map(professorUsers.map((user) => [user.id, user]));
  const areaBlocks = buildStageAreaBlocks({
    blockRows,
    areaRows
  });

  const semesters = semesterRows.map((semester) => ({
    id: semester.id,
    code: semester.codigo,
    name: semester.nome,
    status: semester.status,
    startsAt: semester.data_inicio,
    endsAt: semester.data_fim,
    label: `${semester.codigo} - ${semester.nome}`
  }));

  const manageableSemesters = semesters.filter(
    (semester) => semester.status === "ativo" || semester.status === "planejado"
  );

  const professorOptions = professorUsers
    .filter((user) => user.ativo)
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areaIds = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => link.area_estagio_id);
      const areaNames = areaIds
        .map((areaId) => areaMap.get(areaId)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        areaIds,
        label: `${user.nome_completo} - ${professor.registro_funcional ?? "Sem funcional"}${areaNames.length ? ` - ${areaNames.join(", ")}` : ""}`
      } satisfies ManagementProfessorOption;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementProfessorOption[];

  const semesterHistory = semesterRows
    .map((semester) => {
      const semesterAssignments = enrollmentRows
        .map((enrollment) => {
          const classGroup = classMap.get(enrollment.turma_id);

          if (!classGroup || classGroup.semestre_id !== semester.id) {
            return null;
          }

          const área = classGroup.area_estagio_id
            ? areaMap.get(classGroup.area_estagio_id)
            : null;
          const block = área ? blockMap.get(área.bloco_id) : null;
          const linkedProfessors = professorLinks
            .filter((link) => link.matricula_turma_id === enrollment.id)
            .sort((left, right) => {
              const principalDifference =
                Number(right.responsavel_principal) - Number(left.responsavel_principal);

              if (principalDifference !== 0) {
                return principalDifference;
              }

              return left.created_at.localeCompare(right.created_at);
            });
          const currentSupervisorLinks = linkedProfessors.filter((link) => link.ativo);
          const currentSupervisorIds = currentSupervisorLinks.map((link) => link.professor_id);
          const currentSupervisorNames = currentSupervisorLinks
            .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
            .filter(Boolean) as string[];
          const allSupervisorNames = [
            ...new Set(
              linkedProfessors
                .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
                .filter(Boolean) as string[]
            )
          ];

          return {
            enrollmentId: enrollment.id,
            areaId: área?.id ?? null,
            areaName: área?.nome ?? classGroup.area_estagio,
            blockName: block?.nome ?? "Bloco não identificado",
            className: classGroup.nome,
            enrollmentStatus: enrollment.status,
            currentSupervisorIds,
            currentSupervisorNames,
            allSupervisorNames
          } satisfies ManagementStudentSemesterAssignmentRecord;
        })
        .filter(Boolean)
        .sort((left, right) => left!.areaName.localeCompare(right!.areaName, "pt-BR")) as ManagementStudentSemesterAssignmentRecord[];

      return {
        semesterId: semester.id,
        semesterCode: semester.codigo,
        semesterName: semester.nome,
        semesterStatus: semester.status,
        startsAt: semester.data_inicio,
        endsAt: semester.data_fim,
        assignments: semesterAssignments
      } satisfies ManagementStudentSemesterRecord;
    })
    .filter((semesterRecord) => semesterRecord.assignments.length > 0);

  const defaultManagementSemesterId =
    semesterHistory.find(
      (semesterRecord) => semesterRecord.semesterStatus !== "encerrado"
    )?.semesterId ??
    manageableSemesters[0]?.id ??
    semesters[0]?.id ??
    "";

  return {
    studentData: {
      coordinator: {
        id: currentUser.id,
        name: currentUser.name
      },
      student: {
        id: studentUser.id,
        name: studentRow.nome_social ?? studentUser.nome_completo,
        fullName: studentUser.nome_completo,
        registration: studentRow.matricula,
        cellphone: studentRow.celular,
        email: studentUser.email,
        isActive: studentUser.ativo
      },
      semesters,
      manageableSemesters,
      areaBlocks,
      professorOptions,
      semesterHistory,
      defaultManagementSemesterId
    },
    emptyState: null
  };
}


