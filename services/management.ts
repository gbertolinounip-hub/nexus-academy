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
type EvaluationModelRow =
  Database["public"]["Tables"]["modelos_avaliacao_curso"]["Row"];
type EvaluationModelApplicationRuleRow =
  Database["public"]["Tables"]["regras_aplicacao_modelo_avaliacao"]["Row"];
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

  if (input.scope.usesLegacyUnitFallback) {
    return requestedUnitIds;
  }

  if (!input.scope.instituicaoId || !input.scope.cursoId) {
    return [] as UnitRow["id"][];
  }

  const { data: scopedOfferData, error: scopedOfferError } = await input.supabase
    .from("ofertas_curso_unidade")
    .select("id, unidade_id, curso_id, ativo")
    .eq("instituicao_id", input.scope.instituicaoId)
    .eq("ativo", true)
    .in("unidade_id", requestedUnitIds);

  if (scopedOfferError) {
    throw new Error(
      "Houve um problema ao validar as unidades legadas seguras para os professores do curso."
    );
  }

  const activeOffersByUnit = new Map<
    UnitRow["id"],
    Array<Pick<OfferRow, "id" | "unidade_id" | "curso_id" | "ativo">>
  >();

  for (const offerRow of (scopedOfferData ?? []) as Array<
    Pick<OfferRow, "id" | "unidade_id" | "curso_id" | "ativo">
  >) {
    const currentOffers = activeOffersByUnit.get(offerRow.unidade_id) ?? [];
    currentOffers.push(offerRow);
    activeOffersByUnit.set(offerRow.unidade_id, currentOffers);
  }

  return requestedUnitIds.filter((unitId) => {
    const activeOffers = activeOffersByUnit.get(unitId) ?? [];

    if (activeOffers.length !== 1) {
      return false;
    }

    const [singleOffer] = activeOffers;

    if (singleOffer.curso_id !== input.scope.cursoId) {
      return false;
    }

    if (input.scope.scopeKind === "course_manager") {
      return true;
    }

    return input.scope.offerIds.includes(singleOffer.id);
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

async function resolveSafeLegacySecretaryUnitIds(input: {
  supabase: SupabaseServerClient;
  scope: ResolvedSessionDataScope;
  selectedUnitId?: UnitRow["id"] | null;
}) {
  const requestedUnitIds = input.selectedUnitId
    ? [input.selectedUnitId]
    : input.scope.unitIds;

  if (!requestedUnitIds.length || !input.scope.restrictToCourse) {
    return [] as UnitRow["id"][];
  }

  if (!input.scope.instituicaoId || !input.scope.cursoId) {
    return [] as UnitRow["id"][];
  }

  const { data: activeOfferData, error: activeOfferError } = await input.supabase
    .from("ofertas_curso_unidade")
    .select("id, unidade_id, curso_id")
    .eq("instituicao_id", input.scope.instituicaoId)
    .eq("ativo", true)
    .in("unidade_id", requestedUnitIds);

  if (activeOfferError) {
    throw new Error(
      "Houve um problema ao validar as unidades seguras para fallback legado das secretarias."
    );
  }

  const activeOffersByUnit = new Map<UnitRow["id"], Array<Pick<OfferRow, "id" | "unidade_id" | "curso_id">>>();

  for (const offerRow of (activeOfferData ?? []) as Array<
    Pick<OfferRow, "id" | "unidade_id" | "curso_id">
  >) {
    const currentOffers = activeOffersByUnit.get(offerRow.unidade_id) ?? [];
    currentOffers.push(offerRow);
    activeOffersByUnit.set(offerRow.unidade_id, currentOffers);
  }

  return requestedUnitIds.filter((unitId) => {
    const activeOffers = activeOffersByUnit.get(unitId) ?? [];

    return activeOffers.length === 1 && activeOffers[0]?.curso_id === input.scope.cursoId;
  });
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

export interface ManagementClassListItem {
  id: string;
  code: string;
  name: string;
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  offerId: string | null;
  unitId: string | null;
  unitName: string | null;
  areaName: string;
  curricularPeriod: number | null;
  curricularPeriodOptions: ManagementCurricularPeriodOption[];
  curricularPeriodSelectionMessage: string | null;
  curricularPeriodSelectionBlocked: boolean;
  isActive: boolean;
  enrollmentCount: number;
}

export interface ManagementCurricularPeriodOption {
  value: number;
  label: string;
  modelNames: string[];
  hasMultipleModels: boolean;
}

export interface ManagementSecretaryListItem {
  id: string;
  name: string;
  email: string;
  unitId: string | null;
  unitName: string | null;
  isActive: boolean;
}

async function loadScopedSecretaryList(input: {
  supabase: SupabaseServerClient;
  scope: ResolvedSessionDataScope;
  secretaryProfileId: ProfileRow["id"] | undefined;
  selectedUnitId?: UnitRow["id"] | null;
  offersById: Map<string, OfferRow>;
  unitsById: Map<string, UnitRow>;
}) {
  if (!input.secretaryProfileId || !input.scope.restrictToCourse) {
    return [] as ManagementSecretaryListItem[];
  }

  const safeLegacyUnitIds = await resolveSafeLegacySecretaryUnitIds({
    supabase: input.supabase,
    scope: input.scope,
    selectedUnitId: input.selectedUnitId
  });

  const [contextRowsResult, fallbackUsersResult] = await Promise.all([
    input.scope.instituicaoId && input.scope.cursoId
      ? input.supabase
          .from("usuarios_papeis_contexto")
          .select("*")
          .eq("perfil_id", input.secretaryProfileId)
          .eq("instituicao_id", input.scope.instituicaoId)
          .eq("curso_id", input.scope.cursoId)
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null }),
    safeLegacyUnitIds.length
      ? input.supabase
          .from("usuarios")
          .select("*")
          .eq("perfil_id", input.secretaryProfileId)
          .in("unidade_id", safeLegacyUnitIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (contextRowsResult.error || fallbackUsersResult.error) {
    throw new Error(
      "Houve um problema ao consultar os vínculos institucionais das secretarias."
    );
  }

  const rawContextRows = (contextRowsResult.data ?? []) as UserContextRow[];
  const contextUserIds = uniqueStringValues(rawContextRows.map((contextRow) => contextRow.usuario_id));
  const explicitUsersResult = contextUserIds.length
    ? await input.supabase.from("usuarios").select("*").in("id", contextUserIds)
    : { data: [], error: null };

  if (explicitUsersResult.error) {
    throw new Error(
      "Houve um problema ao consultar as secretarias ligadas aos contextos institucionais do curso."
    );
  }

  const explicitUsers = (explicitUsersResult.data ?? []) as UserRow[];
  const usersById = new Map(explicitUsers.map((user) => [user.id, user]));
  const contextRows = rawContextRows.filter((contextRow) => {
    if (contextRow.oferta_curso_unidade_id) {
      if (!input.scope.offerIds.includes(contextRow.oferta_curso_unidade_id)) {
        return false;
      }

      if (input.selectedUnitId) {
        const offerRow = input.offersById.get(contextRow.oferta_curso_unidade_id) ?? null;
        return offerRow?.unidade_id === input.selectedUnitId;
      }

      return true;
    }

    const userRow = usersById.get(contextRow.usuario_id) ?? null;
    const userUnitId = userRow?.unidade_id ?? null;

    if (!userUnitId || !safeLegacyUnitIds.includes(userUnitId)) {
      return false;
    }

    return !input.selectedUnitId || userUnitId === input.selectedUnitId;
  });
  const contextRowsByUserId = new Map<string, UserContextRow[]>();

  for (const contextRow of contextRows) {
    const currentContexts = contextRowsByUserId.get(contextRow.usuario_id) ?? [];
    currentContexts.push(contextRow);
    contextRowsByUserId.set(contextRow.usuario_id, currentContexts);
  }

  const matchingContextUserIds = uniqueStringValues(contextRows.map((contextRow) => contextRow.usuario_id));
  const fallbackUsers = (fallbackUsersResult.data ?? []) as UserRow[];
  const mergedSecretaryEntries = new Map<string, ManagementSecretaryListItem>();

  for (const userId of matchingContextUserIds) {
    const userRow = usersById.get(userId) ?? null;

    if (!userRow) {
      continue;
    }

    const userContexts = contextRowsByUserId.get(userId) ?? [];
    const explicitOfferIds = uniqueStringValues(
      userContexts.map((contextRow) => contextRow.oferta_curso_unidade_id)
    );
    const explicitUnitIds = uniqueStringValues(
      explicitOfferIds.map(
        (offerId) => input.offersById.get(offerId)?.unidade_id ?? null
      )
    );
    const fallbackUnitId =
      userRow.unidade_id && safeLegacyUnitIds.includes(userRow.unidade_id)
        ? userRow.unidade_id
        : null;
    const unitIds = uniqueStringValues([
      ...explicitUnitIds,
      fallbackUnitId
    ]);
    const resolvedUnitId =
      input.selectedUnitId ??
      (unitIds.length === 1 ? unitIds[0] : fallbackUnitId ?? unitIds[0] ?? null);
    const resolvedUnitName =
      unitIds.length > 1
        ? unitIds
            .map((unitId) => input.unitsById.get(unitId)?.nome)
            .filter(Boolean)
            .join(", ")
        : resolvedUnitId
          ? input.unitsById.get(resolvedUnitId)?.nome ?? null
          : null;

    mergedSecretaryEntries.set(userRow.id, {
      id: userRow.id,
      name: userRow.nome_completo,
      email: userRow.email,
      unitId: resolvedUnitId,
      unitName: resolvedUnitName,
      isActive: userRow.ativo
    });
  }

  for (const userRow of fallbackUsers) {
    if (mergedSecretaryEntries.has(userRow.id)) {
      continue;
    }

    mergedSecretaryEntries.set(userRow.id, {
      id: userRow.id,
      name: userRow.nome_completo,
      email: userRow.email,
      unitId: userRow.unidade_id ?? null,
      unitName: userRow.unidade_id ? input.unitsById.get(userRow.unidade_id)?.nome ?? null : null,
      isActive: userRow.ativo
    });
  }

  return [...mergedSecretaryEntries.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR")
  );
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
  classes: ManagementClassListItem[];
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

interface CurricularPeriodCatalog {
  options: ManagementCurricularPeriodOption[];
  warning: string | null;
}

function sortByNumericValue(left: number, right: number) {
  return left - right;
}

function buildCurricularPeriodSelectionMessage() {
  return "Nenhuma regra por periodo curricular foi configurada para este curso. Configure as regras no Master antes de vincular o periodo da turma.";
}

function buildCurricularPeriodOptionsFromModelNames(
  periodModelNamesMap: Map<number, Set<string>>
) {
  return [...periodModelNamesMap.entries()]
    .sort(([leftPeriod], [rightPeriod]) => sortByNumericValue(leftPeriod, rightPeriod))
    .map(([periodValue, modelNamesSet]) => {
      const modelNames = [...modelNamesSet].sort((left, right) =>
        left.localeCompare(right, "pt-BR")
      );

      return {
        value: periodValue,
        label:
          modelNames.length > 1
            ? `${periodValue}º periodo - multiplos modelos configurados`
            : `${periodValue}º periodo - ${modelNames[0] ?? "Modelo nao identificado"}`,
        modelNames,
        hasMultipleModels: modelNames.length > 1
      } satisfies ManagementCurricularPeriodOption;
    });
}

export async function loadAvailableCurricularPeriodCatalogs(input: {
  supabase?: SupabaseServerClient;
  courseId: string | null;
  offerIds: string[];
}) {
  const supabase = input.supabase ?? (await createSupabaseServerClient());
  const normalizedOfferIds = uniqueStringValues(input.offerIds);
  const emptyCatalog: CurricularPeriodCatalog = {
    options: [],
    warning: buildCurricularPeriodSelectionMessage()
  };

  if (!input.courseId) {
    return {
      defaultCatalog: emptyCatalog,
      catalogsByOfferId: new Map<string, CurricularPeriodCatalog>()
    };
  }

  const { data: modelData, error: modelError } = await supabase
    .from("modelos_avaliacao_curso")
    .select("id, nome, ativo")
    .eq("curso_id", input.courseId)
    .eq("ativo", true);

  if (modelError) {
    throw new Error(
      "Houve um problema ao consultar os modelos ativos usados para liberar os periodos curriculares."
    );
  }

  const activeModels = (modelData ?? []) as Pick<EvaluationModelRow, "id" | "nome" | "ativo">[];

  if (!activeModels.length) {
    return {
      defaultCatalog: emptyCatalog,
      catalogsByOfferId: new Map<string, CurricularPeriodCatalog>(
        normalizedOfferIds.map((offerId) => [offerId, emptyCatalog])
      )
    };
  }

  const activeModelIds = activeModels.map((modelRow) => modelRow.id);
  const modelNamesById = new Map(activeModels.map((modelRow) => [modelRow.id, modelRow.nome]));
  const { data: ruleData, error: ruleError } = await supabase
    .from("regras_aplicacao_modelo_avaliacao")
    .select(
      "id, modelo_avaliacao_curso_id, oferta_curso_unidade_id, periodo_curricular, semestre_id, turma_id, area_estagio_id, ativo"
    )
    .in("modelo_avaliacao_curso_id", activeModelIds)
    .eq("ativo", true)
    .not("periodo_curricular", "is", null);

  if (ruleError) {
    throw new Error(
      "Houve um problema ao consultar as regras de periodo curricular liberadas pelo Master."
    );
  }

  const generalPeriodModelNames = new Map<number, Set<string>>();
  const periodModelNamesByOfferId = new Map<string, Map<number, Set<string>>>(
    normalizedOfferIds.map((offerId) => [offerId, new Map<number, Set<string>>()])
  );

  for (const ruleRow of (ruleData ?? []) as Array<
    Pick<
      EvaluationModelApplicationRuleRow,
      | "id"
      | "modelo_avaliacao_curso_id"
      | "oferta_curso_unidade_id"
      | "periodo_curricular"
      | "semestre_id"
      | "turma_id"
      | "area_estagio_id"
      | "ativo"
    >
  >) {
    if (
      ruleRow.periodo_curricular === null ||
      ruleRow.semestre_id !== null ||
      ruleRow.turma_id !== null ||
      ruleRow.area_estagio_id !== null
    ) {
      continue;
    }

    const modelName =
      modelNamesById.get(ruleRow.modelo_avaliacao_curso_id) ?? "Modelo nao identificado";

    if (!ruleRow.oferta_curso_unidade_id) {
      const currentModelNames =
        generalPeriodModelNames.get(ruleRow.periodo_curricular) ?? new Set<string>();
      currentModelNames.add(modelName);
      generalPeriodModelNames.set(ruleRow.periodo_curricular, currentModelNames);

      for (const offerId of normalizedOfferIds) {
        const offerPeriodModelNames =
          periodModelNamesByOfferId.get(offerId) ?? new Map<number, Set<string>>();
        const currentOfferModelNames =
          offerPeriodModelNames.get(ruleRow.periodo_curricular) ?? new Set<string>();
        currentOfferModelNames.add(modelName);
        offerPeriodModelNames.set(ruleRow.periodo_curricular, currentOfferModelNames);
        periodModelNamesByOfferId.set(offerId, offerPeriodModelNames);
      }

      continue;
    }

    if (!normalizedOfferIds.includes(ruleRow.oferta_curso_unidade_id)) {
      continue;
    }

    const offerPeriodModelNames =
      periodModelNamesByOfferId.get(ruleRow.oferta_curso_unidade_id) ?? new Map<number, Set<string>>();
    const currentOfferModelNames =
      offerPeriodModelNames.get(ruleRow.periodo_curricular) ?? new Set<string>();
    currentOfferModelNames.add(modelName);
    offerPeriodModelNames.set(ruleRow.periodo_curricular, currentOfferModelNames);
    periodModelNamesByOfferId.set(ruleRow.oferta_curso_unidade_id, offerPeriodModelNames);
  }

  const defaultCatalogOptions = buildCurricularPeriodOptionsFromModelNames(generalPeriodModelNames);
  const defaultCatalog: CurricularPeriodCatalog = {
    options: defaultCatalogOptions,
    warning: defaultCatalogOptions.length ? null : buildCurricularPeriodSelectionMessage()
  };
  const catalogsByOfferId = new Map<string, CurricularPeriodCatalog>(
    normalizedOfferIds.map((offerId) => {
      const offerOptions = buildCurricularPeriodOptionsFromModelNames(
        periodModelNamesByOfferId.get(offerId) ?? new Map<number, Set<string>>()
      );

      return [
        offerId,
        {
          options: offerOptions,
          warning: offerOptions.length ? null : buildCurricularPeriodSelectionMessage()
        } satisfies CurricularPeriodCatalog
      ];
    })
  );

  return {
    defaultCatalog,
    catalogsByOfferId
  };
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

function resolveEnrollmentOfferId(input: {
  enrollment: EnrollmentRow;
  classMap: Map<string, ClassRow>;
  semesterMap: Map<string, SemesterRow>;
}) {
  const classGroup = input.classMap.get(input.enrollment.turma_id) ?? null;
  const semester = classGroup
    ? input.semesterMap.get(classGroup.semestre_id) ?? null
    : null;

  return (
    input.enrollment.oferta_curso_unidade_id ??
    classGroup?.oferta_curso_unidade_id ??
    semester?.oferta_curso_unidade_id ??
    null
  );
}

function resolveStudentScopedOfferIds(input: {
  student: StudentRow;
  enrollments: EnrollmentRow[];
  classMap: Map<string, ClassRow>;
  semesterMap: Map<string, SemesterRow>;
}) {
  return uniqueStringValues([
    input.student.oferta_curso_unidade_id,
    ...input.enrollments.map((enrollment) =>
      resolveEnrollmentOfferId({
        enrollment,
        classMap: input.classMap,
        semesterMap: input.semesterMap
      })
    )
  ]);
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
  let curricularPeriodCatalogs: Awaited<
    ReturnType<typeof loadAvailableCurricularPeriodCatalogs>
  >;

  try {
    curricularPeriodCatalogs = await loadAvailableCurricularPeriodCatalogs({
      supabase,
      courseId: scope.cursoId,
      offerIds: scope.offerIds
    });
  } catch {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os periodos curriculares liberados pelas regras de avaliacao do curso."
    );
  }
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

    const [
      studentRowsByCourseResult,
      studentRowsByOfferResult,
      studentRowsByEnrollmentResult
    ] = await Promise.all([
      studentRowsByCoursePromise,
      studentRowsByOfferPromise,
      studentRowsByEnrollmentPromise
    ]);

    if (
      studentRowsByCourseResult.error ||
      studentRowsByOfferResult.error ||
      studentRowsByEnrollmentResult.error
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

    try {
      secretaries = await loadScopedSecretaryList({
        supabase,
        scope,
        secretaryProfileId,
        selectedUnitId,
        offersById,
        unitsById
      });
    } catch (error) {
      return buildEmptyState(
        "Não foi possível carregar a gestao academica",
        error instanceof Error
          ? error.message
          : "Houve um problema ao consultar as secretarias visíveis no contexto atual."
      );
    }
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

  const classes = visibleClassRows
    .map((classGroup) => {
      const semester = semesterMap.get(classGroup.semestre_id);

      if (!semester) {
        return null;
      }

      const offerRow =
        (classGroup.oferta_curso_unidade_id
          ? offersById.get(classGroup.oferta_curso_unidade_id) ?? null
          : null) ??
        (semester.oferta_curso_unidade_id
          ? offersById.get(semester.oferta_curso_unidade_id) ?? null
          : null);
      const unitId = offerRow?.unidade_id ?? semester.unidade_id ?? null;

      if (selectedUnitId && unitId !== selectedUnitId) {
        return null;
      }

      const area = classGroup.area_estagio_id ? areaMap.get(classGroup.area_estagio_id) : null;
      const enrollmentCount = enrollmentRows.filter(
        (enrollment) => enrollment.turma_id === classGroup.id && enrollment.status === "ativa"
      ).length;
      const curricularPeriodCatalog = offerRow?.id
        ? curricularPeriodCatalogs.catalogsByOfferId.get(offerRow.id) ??
          curricularPeriodCatalogs.defaultCatalog
        : curricularPeriodCatalogs.defaultCatalog;

      return {
        id: classGroup.id,
        code: classGroup.codigo,
        name: classGroup.nome,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        semesterName: semester.nome,
        offerId: offerRow?.id ?? null,
        unitId,
        unitName: unitId ? unitsById.get(unitId)?.nome ?? null : null,
        areaName: area?.nome ?? classGroup.area_estagio,
        curricularPeriod: classGroup.periodo_curricular,
        curricularPeriodOptions: curricularPeriodCatalog.options,
        curricularPeriodSelectionMessage: curricularPeriodCatalog.warning,
        curricularPeriodSelectionBlocked: curricularPeriodCatalog.options.length === 0,
        isActive: classGroup.ativa,
        enrollmentCount
      } satisfies ManagementClassListItem;
    })
    .filter((classEntry): classEntry is ManagementClassListItem => classEntry !== null)
    .sort((left, right) => {
      const semesterDifference = right.semesterCode.localeCompare(left.semesterCode, "pt-BR");

      if (semesterDifference !== 0) {
        return semesterDifference;
      }

      const areaDifference = left.areaName.localeCompare(right.areaName, "pt-BR");

      if (areaDifference !== 0) {
        return areaDifference;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });

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
      const visibleOfferIds = resolveStudentScopedOfferIds({
        student,
        enrollments: enrollmentRows.filter((enrollment) => enrollment.aluno_id === user.id),
        classMap,
        semesterMap
      });
      const matchesVisibleOfferScope =
        scope.offerIds.length === 0 ||
        visibleOfferIds.some((offerId) => scope.offerIds.includes(offerId)) ||
        (visibleOfferIds.length === 0 && scope.usesLegacyUnitFallback);

      if (!matchesSelectedUnit || !matchesVisibleOfferScope) {
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
      classes,
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
  const classMapForAccess = new Map(
    visibleClassRows.map((classGroup) => [classGroup.id, classGroup])
  );
  const semesterMapForAccess = new Map(
    semesterRows.map((semester) => [semester.id, semester])
  );
  const canAccessStudent =
    scope.restrictToCourse
      ? (() => {
          if (studentRow.curso_id !== scope.cursoId) {
            return false;
          }

          const studentOfferIds = resolveStudentScopedOfferIds({
            student: studentRow,
            enrollments: enrollmentRows,
            classMap: classMapForAccess,
            semesterMap: semesterMapForAccess
          });

          if (scope.offerIds.length > 0) {
            return (
              studentOfferIds.some((offerId) => scope.offerIds.includes(offerId)) ||
              (studentOfferIds.length === 0 &&
                scope.usesLegacyUnitFallback &&
                scope.unitIds.includes(studentRow.unidade_id ?? ""))
            );
          }

          return scope.unitIds.length === 0 || scope.unitIds.includes(studentRow.unidade_id ?? "");
        })()
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


