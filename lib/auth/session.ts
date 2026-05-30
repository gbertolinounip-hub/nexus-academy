import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { defaultDashboardPath } from "@/lib/auth/roles";
import type { ProfileCode, SessionUser } from "@/types/domain";

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

interface UserRow {
  id: string;
  email: string;
  nome_completo: string;
  perfil_id: number;
  unidade_id: string | null;
  ativo: boolean;
}

interface ProfileRow {
  codigo: string;
}

interface UnitRow {
  id: string;
  nome: string;
  slug: string;
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

  const { data: userRowData, error: userError } = await supabase
    .from("usuarios")
    .select("id, email, nome_completo, perfil_id, unidade_id, ativo")
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

  const { data: profileRowData, error: profileError } = await supabase
    .from("perfis")
    .select("codigo")
    .eq("id", userRow.perfil_id)
    .maybeSingle();

  const profileRow = (profileRowData ?? null) as ProfileRow | null;

  if (profileError || !profileRow) {
    return {
      reason: "profile_not_found",
      user: null
    };
  }

  const role = profileRow.codigo as ProfileCode;

  if (!["aluno", "professor", "coordenador", "coordenador_master"].includes(role)) {
    return {
      reason: "invalid_role",
      user: null
    };
  }

  let unitRow: UnitRow | null = null;

  if (userRow.unidade_id) {
    const { data: unitRowData } = await supabase
      .from("unidades")
      .select("id, nome, slug")
      .eq("id", userRow.unidade_id)
      .maybeSingle();

    unitRow = (unitRowData ?? null) as UnitRow | null;
  }

  return {
    reason: "authenticated",
    user: {
      id: userRow.id,
      email: userRow.email,
      name: userRow.nome_completo,
      role,
      unitId: userRow.unidade_id,
      unitName: unitRow?.nome ?? null,
      unitSlug: unitRow?.slug ?? null,
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
    redirect(defaultDashboardPath[user.role]);
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const state = await getAuthState();

  if (state.user) {
    redirect(defaultDashboardPath[state.user.role]);
  }
}

export async function redirectToRoleHome() {
  const user = await requireAuthenticatedUser();
  redirect(defaultDashboardPath[user.role]);
}
