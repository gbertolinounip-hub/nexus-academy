import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getSupabaseServiceRoleKey,
  isSupabaseConfigured
} from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  contextRoleLabels,
  defaultDashboardPath,
  getDefaultDashboardPathForUser,
  getContextRoleDisplayName,
  isContextProfileCode,
  isProfileCode
} from "@/lib/auth/roles";
import type {
  ProfileCode,
  SessionUser,
  SessionUserContext
} from "@/types/domain";
import type { Database } from "@/types/database";

type AuthStateReason =
  | "authenticated"
  | "unauthenticated"
  | "misconfigured"
  | "profile_not_found"
  | "inactive"
  | "invalid_role";

interface AuthState {
  reason: AuthStateReason;
  user: SessionUser | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];

interface SessionContextSnapshot {
  contexts: SessionUserContext[];
  activeContext: SessionUserContext | null;
  legacyUnit: UnitRow | null;
  legacyInstitution: InstitutionRow | null;
}

function readBooleanMetadataFlag(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) {
    return false;
  }

  const value = (metadata as Record<string, unknown>)[key];

  return value === true || value === "true" || value === 1;
}

function readAuthSubject(claims: unknown) {
  if (!claims || typeof claims !== "object" || !("sub" in claims)) {
    return null;
  }

  const sub = (claims as { sub?: unknown }).sub;
  return typeof sub === "string" && sub.length > 0 ? sub : null;
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function buildMapById<T extends { id: string | number }>(rows: T[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function resolveActiveContext(
  contexts: SessionUserContext[],
  contextoPadraoId: string | null
) {
  const activeContexts = contexts.filter((context) => context.ativo);

  if (contextoPadraoId) {
    const defaultContext = activeContexts.find((context) => context.id === contextoPadraoId);

    if (defaultContext) {
      return defaultContext;
    }
  }

  return activeContexts.length === 1 ? activeContexts[0] : null;
}

function createSessionReadClient(supabase: SupabaseServerClient) {
  if (!getSupabaseServiceRoleKey()) {
    return supabase;
  }

  try {
    return createSupabaseAdminClient();
  } catch {
    return supabase;
  }
}

async function loadSessionContextSnapshot(
  input: {
    supabase: SupabaseServerClient;
    userRow: UserRow;
  }
): Promise<SessionContextSnapshot> {
  const readClient = createSessionReadClient(input.supabase);
  const { userRow } = input;

  const { data: contextRowsData, error: contextRowsError } = await readClient
    .from("usuarios_papeis_contexto")
    .select(
      "id, usuario_id, perfil_id, instituicao_id, curso_id, oferta_curso_unidade_id, principal, ativo, inicio_em, fim_em, metadata, created_at, updated_at"
    )
    .eq("usuario_id", userRow.id)
    .order("principal", { ascending: false })
    .order("created_at", { ascending: true });

  const contextRows = !contextRowsError
    ? ((contextRowsData ?? []) as UserContextRow[])
    : [];

  const offerIds = uniqueStringValues(
    contextRows.map((contextRow) => contextRow.oferta_curso_unidade_id)
  );

  const { data: offerRowsData, error: offerRowsError } = offerIds.length
    ? await readClient
        .from("ofertas_curso_unidade")
        .select(
          "id, instituicao_id, unidade_id, curso_id, codigo, nome_exibicao, ativo, metadata, created_at, updated_at"
        )
        .in("id", offerIds)
    : { data: [], error: null };

  const offerRows = !offerRowsError ? ((offerRowsData ?? []) as OfferRow[]) : [];

  const profileIds = [
    userRow.perfil_id,
    ...new Set(contextRows.map((contextRow) => contextRow.perfil_id))
  ];

  const unitIds = uniqueStringValues([
    userRow.unidade_id,
    ...offerRows.map((offerRow) => offerRow.unidade_id)
  ]);

  const courseIds = uniqueStringValues([
    ...contextRows.map((contextRow) => contextRow.curso_id),
    ...offerRows.map((offerRow) => offerRow.curso_id)
  ]);

  const [{ data: profileRowsData }, { data: unitRowsData }, { data: courseRowsData }] =
    await Promise.all([
      readClient
        .from("perfis")
        .select("id, codigo, nome, descricao, created_at")
        .in("id", profileIds),
      unitIds.length
        ? readClient
            .from("unidades")
            .select(
              "id, instituicao_id, nome, sigla, slug, cidade, estado, ativo, created_at, updated_at"
            )
            .in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
      courseIds.length
        ? readClient
            .from("cursos")
            .select(
              "id, instituicao_id, codigo, nome, slug, ativo, metadata, created_at, updated_at"
            )
            .in("id", courseIds)
        : Promise.resolve({ data: [], error: null })
    ]);

  const profileRows = (profileRowsData ?? []) as ProfileRow[];
  const unitRows = (unitRowsData ?? []) as UnitRow[];
  const courseRows = (courseRowsData ?? []) as CourseRow[];

  const institutionIds = uniqueStringValues([
    ...contextRows.map((contextRow) => contextRow.instituicao_id),
    ...offerRows.map((offerRow) => offerRow.instituicao_id),
    ...courseRows.map((courseRow) => courseRow.instituicao_id),
    ...unitRows.map((unitRow) => unitRow.instituicao_id)
  ]);

  const { data: institutionRowsData } = institutionIds.length
    ? await readClient
        .from("instituicoes")
        .select("id, nome, sigla, slug, cnpj, ativo, metadata, created_at, updated_at")
        .in("id", institutionIds)
    : { data: [] };

  const institutionRows = (institutionRowsData ?? []) as InstitutionRow[];
  const profilesById = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow]));
  const offersById = buildMapById(offerRows);
  const unitsById = buildMapById(unitRows);
  const coursesById = buildMapById(courseRows);
  const institutionsById = buildMapById(institutionRows);
  const legacyUnit = userRow.unidade_id ? unitsById.get(userRow.unidade_id) ?? null : null;
  const legacyInstitution =
    legacyUnit?.instituicao_id
      ? institutionsById.get(legacyUnit.instituicao_id) ?? null
      : null;

  const contexts = contextRows
    .map<SessionUserContext | null>((contextRow) => {
      const profileRow = profilesById.get(contextRow.perfil_id) ?? null;

      if (!profileRow || !isContextProfileCode(profileRow.codigo)) {
        return null;
      }

      const offerRow = contextRow.oferta_curso_unidade_id
        ? offersById.get(contextRow.oferta_curso_unidade_id) ?? null
        : null;
      const unitRow = offerRow?.unidade_id
        ? unitsById.get(offerRow.unidade_id) ?? null
        : null;
      const courseId = contextRow.curso_id ?? offerRow?.curso_id ?? null;
      const courseRow = courseId ? coursesById.get(courseId) ?? null : null;
      const institutionId =
        contextRow.instituicao_id ??
        offerRow?.instituicao_id ??
        courseRow?.instituicao_id ??
        unitRow?.instituicao_id ??
        null;
      const institutionRow = institutionId
        ? institutionsById.get(institutionId) ?? null
        : null;

      return {
        id: contextRow.id,
        perfilCodigo: profileRow.codigo,
        perfilNome: getContextRoleDisplayName(profileRow.codigo, profileRow.nome),
        instituicaoId: institutionId,
        instituicaoNome: institutionRow?.nome ?? null,
        instituicaoSigla: institutionRow?.sigla ?? null,
        cursoId: courseId,
        cursoNome: courseRow?.nome ?? null,
        cursoCodigo: courseRow?.codigo ?? null,
        ofertaCursoUnidadeId: contextRow.oferta_curso_unidade_id,
        ofertaNome:
          offerRow?.nome_exibicao ??
          (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : null),
        unidadeId: offerRow?.unidade_id ?? null,
        unidadeNome: unitRow?.nome ?? null,
        unidadeSigla: unitRow?.sigla ?? null,
        unidadeSlug: unitRow?.slug ?? null,
        principal: contextRow.principal,
        ativo: contextRow.ativo
      };
    })
    .filter((context): context is SessionUserContext => context !== null);

  return {
    contexts,
    activeContext: resolveActiveContext(contexts, userRow.contexto_padrao_id),
    legacyUnit,
    legacyInstitution
  };
}

async function resolveAuthState(): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return {
      reason: "misconfigured",
      user: null
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError) {
    return {
      reason: "unauthenticated",
      user: null
    };
  }

  const authUserId = readAuthSubject(claimsData?.claims);

  if (!authUserId) {
    return {
      reason: "unauthenticated",
      user: null
    };
  }

  const { data: authUserData } = await supabase.auth.getUser();
  const passwordChangeRecommended = readBooleanMetadataFlag(
    authUserData.user?.user_metadata,
    "password_change_required"
  );

  const readClient = createSessionReadClient(supabase);
  const { data: userRowData, error: userError } = await readClient
    .from("usuarios")
    .select(
      "id, perfil_id, unidade_id, contexto_padrao_id, email, nome_completo, ativo, created_at, updated_at"
    )
    .eq("id", authUserId)
    .maybeSingle();

  const userRow = (userRowData ?? null) as UserRow | null;

  if (userError || !userRow) {
    return {
      reason: "profile_not_found",
      user: null
    };
  }

  if (!userRow.ativo) {
    return {
      reason: "inactive",
      user: null
    };
  }

  const contextSnapshot = await loadSessionContextSnapshot({
    supabase,
    userRow
  });
  const { data: resolvedProfileRowData, error: profileError } = await readClient
    .from("perfis")
    .select("id, codigo, nome, descricao, created_at")
    .eq("id", userRow.perfil_id)
    .maybeSingle();

  const resolvedProfileRow = (resolvedProfileRowData ?? null) as ProfileRow | null;

  if (profileError || !resolvedProfileRow) {
    return {
      reason: "profile_not_found",
      user: null
    };
  }

  if (!isProfileCode(resolvedProfileRow.codigo)) {
    return {
      reason: "invalid_role",
      user: null
    };
  }

  const role: ProfileCode = resolvedProfileRow.codigo;

  return {
    reason: "authenticated",
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.nome_completo,
      role,
      unitId: userRow.unidade_id ?? contextSnapshot.activeContext?.unidadeId ?? null,
      unitName:
        contextSnapshot.legacyUnit?.nome ??
        contextSnapshot.activeContext?.unidadeNome ??
        null,
      unitSlug: contextSnapshot.legacyUnit?.slug ?? null,
      contextoPadraoId: userRow.contexto_padrao_id,
      contextoAtivo: contextSnapshot.activeContext,
      instituicaoId:
        contextSnapshot.activeContext?.instituicaoId ??
        contextSnapshot.legacyInstitution?.id ??
        null,
      instituicaoNome:
        contextSnapshot.activeContext?.instituicaoNome ??
        contextSnapshot.legacyInstitution?.nome ??
        null,
      cursoId: contextSnapshot.activeContext?.cursoId ?? null,
      cursoNome: contextSnapshot.activeContext?.cursoNome ?? null,
      ofertaCursoUnidadeId: contextSnapshot.activeContext?.ofertaCursoUnidadeId ?? null,
      ofertaCursoUnidadeNome: contextSnapshot.activeContext?.ofertaNome ?? null,
      contextosDisponiveis: contextSnapshot.contexts,
      passwordChangeRecommended
    }
  };
}

export const getAuthState = cache(resolveAuthState);

export async function getCurrentAppUser() {
  const state = await getAuthState();
  return state.user;
}

export async function requireAuthenticatedUser() {
  const state = await getAuthState();

  if (state.reason === "inactive") {
    redirect("/login?auth_notice=access-blocked");
  }

  if (!state.user) {
    redirect("/login");
  }

  return state.user;
}

export async function requireRole(allowedRoles: ProfileCode[]) {
  const user = await requireAuthenticatedUser();

  if (!allowedRoles.includes(user.role)) {
    redirect(getDefaultDashboardPathForUser(user));
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const state = await getAuthState();

  if (state.user) {
    redirect(getDefaultDashboardPathForUser(state.user));
  }
}

export async function redirectToRoleHome() {
  const user = await requireAuthenticatedUser();
  redirect(getDefaultDashboardPathForUser(user));
}
