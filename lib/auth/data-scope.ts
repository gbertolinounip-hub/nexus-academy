import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";
import type { SupabaseClient } from "@supabase/supabase-js";

type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type SupabaseReadClient = SupabaseClient<Database>;

export interface SessionDataScope {
  isGlobalMaster: boolean;
  isCourseManager: boolean;
  isLocalCoordinator: boolean;
  instituicaoId: string | null;
  cursoId: string | null;
  ofertaCursoUnidadeId: string | null;
  unidadeId: string | null;
}

export interface ResolvedSessionDataScope extends SessionDataScope {
  scopeKind:
    | "global_master"
    | "course_manager"
    | "course_context"
    | "offer_context"
    | "unit_fallback"
    | "none";
  restrictToCourse: boolean;
  usesLegacyUnitFallback: boolean;
  offerIds: string[];
  unitIds: string[];
}

export interface ScopedOperationalGraph {
  scope: ResolvedSessionDataScope;
  semesterRows: SemesterRow[];
  classRows: ClassRow[];
  enrollmentRows: EnrollmentRow[];
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}

export function resolveDataScopeForSession(currentUser: SessionUser): SessionDataScope {
  const activeMasterCourseContext = getActiveMasterCourseContext(currentUser);
  const activeContext = currentUser.contextoAtivo?.ativo ? currentUser.contextoAtivo : null;
  const scopedUnitId =
    activeContext?.unidadeId ??
    currentUser.ofertaCursoUnidadeId ??
    currentUser.unitId ??
    null;

  if (currentUser.role === "coordenador_master") {
    return {
      isGlobalMaster: true,
      isCourseManager: false,
      isLocalCoordinator: false,
      instituicaoId: currentUser.instituicaoId ?? null,
      cursoId: currentUser.cursoId ?? null,
      ofertaCursoUnidadeId: currentUser.ofertaCursoUnidadeId ?? null,
      unidadeId: scopedUnitId
    };
  }

  if (activeMasterCourseContext) {
    return {
      isGlobalMaster: false,
      isCourseManager: true,
      isLocalCoordinator: false,
      instituicaoId: activeMasterCourseContext.instituicaoId,
      cursoId: activeMasterCourseContext.cursoId,
      ofertaCursoUnidadeId: activeMasterCourseContext.ofertaCursoUnidadeId ?? null,
      unidadeId: activeMasterCourseContext.unidadeId ?? currentUser.unitId ?? null
    };
  }

  return {
    isGlobalMaster: false,
    isCourseManager: false,
    isLocalCoordinator: currentUser.role === "coordenador",
    instituicaoId:
      activeContext?.instituicaoId ?? currentUser.instituicaoId ?? null,
    cursoId: activeContext?.cursoId ?? currentUser.cursoId ?? null,
    ofertaCursoUnidadeId:
      activeContext?.ofertaCursoUnidadeId ?? currentUser.ofertaCursoUnidadeId ?? null,
    unidadeId: scopedUnitId
  };
}

async function loadOfferRowsForScope(
  supabase: SupabaseReadClient,
  scope: SessionDataScope
) {
  if (scope.ofertaCursoUnidadeId) {
    const { data, error } = await supabase
      .from("ofertas_curso_unidade")
      .select("*")
      .eq("id", scope.ofertaCursoUnidadeId)
      .maybeSingle();

    if (error) {
      throw new Error(
        "Não foi possível carregar a oferta ativa do contexto autenticado."
      );
    }

    return data ? [data as OfferRow] : [];
  }

  if (scope.instituicaoId && scope.cursoId) {
    let query = supabase
      .from("ofertas_curso_unidade")
      .select("*")
      .eq("instituicao_id", scope.instituicaoId)
      .eq("curso_id", scope.cursoId);

    if (!scope.isCourseManager && scope.unidadeId) {
      query = query.eq("unidade_id", scope.unidadeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(
        "Não foi possível carregar as ofertas vinculadas ao contexto institucional ativo."
      );
    }

    return (data ?? []) as OfferRow[];
  }

  return [] as OfferRow[];
}

async function resolveSecretaryFallbackScope(
  currentUser: SessionUser,
  baseScope: SessionDataScope,
  supabase: SupabaseReadClient
) {
  if (
    currentUser.role !== "secretaria" ||
    baseScope.ofertaCursoUnidadeId ||
    baseScope.cursoId ||
    !baseScope.unidadeId
  ) {
    return {
      scope: baseScope,
      hasAmbiguousActiveOffers: false
    };
  }

  const { data, error } = await supabase
    .from("ofertas_curso_unidade")
    .select("id, instituicao_id, unidade_id, curso_id, ativo")
    .eq("unidade_id", baseScope.unidadeId)
    .eq("ativo", true);

  if (error) {
    throw new Error(
      "Não foi possível identificar a oferta operacional ativa da secretaria autenticada."
    );
  }

  const activeOffers = (data ?? []) as Pick<
    OfferRow,
    "id" | "instituicao_id" | "unidade_id" | "curso_id" | "ativo"
  >[];

  if (activeOffers.length !== 1) {
    return {
      scope: baseScope,
      hasAmbiguousActiveOffers: activeOffers.length > 1
    };
  }

  const singleOffer = activeOffers[0];

  return {
    scope: {
      ...baseScope,
      instituicaoId: singleOffer.instituicao_id ?? baseScope.instituicaoId,
      cursoId: singleOffer.curso_id ?? baseScope.cursoId,
      ofertaCursoUnidadeId: singleOffer.id,
      unidadeId: singleOffer.unidade_id ?? baseScope.unidadeId
    },
    hasAmbiguousActiveOffers: false
  };
}

export async function resolveScopedDataAccess(
  currentUser: SessionUser,
  input?: {
    supabase?: SupabaseReadClient;
  }
): Promise<ResolvedSessionDataScope> {
  const baseScope = resolveDataScopeForSession(currentUser);

  if (baseScope.isGlobalMaster) {
    return {
      ...baseScope,
      scopeKind: "global_master",
      restrictToCourse: false,
      usesLegacyUnitFallback: false,
      offerIds: [],
      unitIds: uniqueStringValues([baseScope.unidadeId])
    };
  }

  const supabase = input?.supabase ?? (await createSupabaseServerClient());
  const secretaryFallbackResult = await resolveSecretaryFallbackScope(
    currentUser,
    baseScope,
    supabase
  );
  const effectiveBaseScope = secretaryFallbackResult.scope;

  if (currentUser.role === "secretaria" && secretaryFallbackResult.hasAmbiguousActiveOffers) {
    return {
      ...effectiveBaseScope,
      scopeKind: "none",
      restrictToCourse: false,
      usesLegacyUnitFallback: false,
      offerIds: [],
      unitIds: []
    };
  }

  const scopedOffers = await loadOfferRowsForScope(supabase, effectiveBaseScope);
  const offerIds = scopedOffers.map((offer) => offer.id);
  const unitIds = uniqueStringValues(
    scopedOffers.map((offer) => offer.unidade_id)
  );

  if (effectiveBaseScope.isCourseManager) {
    return {
      ...effectiveBaseScope,
      scopeKind: "course_manager",
      restrictToCourse: true,
      usesLegacyUnitFallback: false,
      offerIds,
      unitIds
    };
  }

  if (effectiveBaseScope.ofertaCursoUnidadeId) {
    return {
      ...effectiveBaseScope,
      scopeKind: "offer_context",
      restrictToCourse: Boolean(effectiveBaseScope.cursoId),
      usesLegacyUnitFallback: false,
      offerIds,
      unitIds:
        unitIds.length > 0
          ? unitIds
          : uniqueStringValues([effectiveBaseScope.unidadeId])
    };
  }

  if (effectiveBaseScope.cursoId) {
    return {
      ...effectiveBaseScope,
      scopeKind: "course_context",
      restrictToCourse: true,
      usesLegacyUnitFallback: false,
      offerIds,
      unitIds
    };
  }

  if (effectiveBaseScope.unidadeId) {
    return {
      ...effectiveBaseScope,
      scopeKind: "unit_fallback",
      restrictToCourse: false,
      usesLegacyUnitFallback: true,
      offerIds: [],
      unitIds: [effectiveBaseScope.unidadeId]
    };
  }

  return {
    ...effectiveBaseScope,
    scopeKind: "none",
    restrictToCourse: false,
    usesLegacyUnitFallback: false,
    offerIds: [],
    unitIds: []
  };
}

export async function loadScopedOperationalGraph(
  currentUser: SessionUser,
  input?: {
    supabase?: SupabaseReadClient;
  }
): Promise<ScopedOperationalGraph> {
  const supabase = input?.supabase ?? (await createSupabaseServerClient());
  const scope = await resolveScopedDataAccess(currentUser, {
    supabase
  });

  if (scope.isGlobalMaster || scope.scopeKind === "none") {
    return {
      scope,
      semesterRows: [],
      classRows: [],
      enrollmentRows: []
    };
  }

  if (scope.restrictToCourse && scope.offerIds.length === 0) {
    return {
      scope,
      semesterRows: [],
      classRows: [],
      enrollmentRows: []
    };
  }

  let semesterQuery = supabase.from("semestres").select("*");

  if (scope.offerIds.length > 0) {
    semesterQuery = semesterQuery.in("oferta_curso_unidade_id", scope.offerIds);
  } else if (scope.unitIds.length > 0) {
    semesterQuery = semesterQuery.in("unidade_id", scope.unitIds);
  } else {
    return {
      scope,
      semesterRows: [],
      classRows: [],
      enrollmentRows: []
    };
  }

  const { data: semesterRowsData, error: semesterRowsError } = await semesterQuery;

  if (semesterRowsError) {
    throw new Error(
      "Não foi possível carregar os semestres visíveis para o contexto autenticado."
    );
  }

  const semesterRows = (semesterRowsData ?? []) as SemesterRow[];
  const semesterIds = semesterRows.map((semester) => semester.id);
  const classRowsResult = semesterIds.length
    ? await supabase.from("turmas").select("*").in("semestre_id", semesterIds)
    : { data: [], error: null };

  if (classRowsResult.error) {
    throw new Error(
      "Não foi possível carregar as turmas visíveis para o contexto autenticado."
    );
  }

  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const classIds = classRows.map((classGroup) => classGroup.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase
        .from("matriculas_turma")
        .select("*")
        .in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error(
      "Não foi possível carregar as matrículas visíveis para o contexto autenticado."
    );
  }

  return {
    scope,
    semesterRows,
    classRows,
    enrollmentRows: (enrollmentRowsResult.data ?? []) as EnrollmentRow[]
  };
}

export function isOfferVisibleInScope(
  scope: ResolvedSessionDataScope,
  offerId: string | null | undefined
) {
  if (scope.isGlobalMaster) {
    return true;
  }

  if (!offerId) {
    return !scope.restrictToCourse;
  }

  return scope.offerIds.includes(offerId);
}

export function isUnitVisibleInScope(
  scope: ResolvedSessionDataScope,
  unitId: string | null | undefined
) {
  if (scope.isGlobalMaster) {
    return true;
  }

  if (!unitId) {
    return false;
  }

  return scope.unitIds.includes(unitId);
}
