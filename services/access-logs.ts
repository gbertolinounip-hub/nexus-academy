import { resolveScopedDataAccess } from "@/lib/auth/data-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils/format";
import type { SessionUser } from "@/types/domain";
import type { Database } from "@/types/database";

type AccessLogRow = Database["public"]["Tables"]["acessos_sistema"]["Row"];

export interface AccessLogFilterState {
  startDate: string;
  endDate: string;
}

export interface CoordinatorAccessLogExportEntry {
  id: string;
  userName: string;
  email: string | null;
  profile: string | null;
  profileLabel: string;
  unitName: string;
  loginDate: string;
  loginTime: string;
  loggedAt: string;
}

export interface CoordinatorAccessLogExportData {
  unitId: string;
  unitName: string;
  exportedAt: string;
  filters: AccessLogFilterState;
  totalAccesses: number;
  entries: CoordinatorAccessLogExportEntry[];
}

function normalizeQueryValue(value?: string | string[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeDateFilterValue(value?: string | string[] | null) {
  const normalizedValue = normalizeQueryValue(value).trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) ? normalizedValue : "";
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function formatProfileLabel(
  value: AccessLogRow["perfil"]
): string {
  switch (value) {
    case "aluno":
      return "Aluno";
    case "professor":
      return "Professor";
    case "coordenador":
      return "Coordenador";
    case "coordenador_master":
      return "Coordenador Master";
    default:
      return "Não informado";
  }
}

export function buildAccessLogFilterState(input?: {
  startDate?: string | string[] | null;
  endDate?: string | string[] | null;
}): AccessLogFilterState {
  return {
    startDate: normalizeDateFilterValue(input?.startDate),
    endDate: normalizeDateFilterValue(input?.endDate)
  };
}

export async function registerAuthenticatedAccess(currentUser: SessionUser) {
  const adminClient = createSupabaseAdminClient();
  const { error } = await (adminClient.from("acessos_sistema") as any).insert({
    usuario_id: currentUser.id,
    unidade_id: currentUser.unitId ?? null,
    nome_usuario: currentUser.name,
    email: currentUser.email,
    perfil: currentUser.role
  });

  if (error) {
    throw new Error("Não foi possível registrar o acesso autenticado.");
  }
}

export async function getCoordinatorAccessLogExport(
  currentUser: SessionUser,
  requestedFilters?: {
    startDate?: string | string[] | null;
    endDate?: string | string[] | null;
  }
): Promise<CoordinatorAccessLogExportData | null> {
  if (currentUser.role !== "coordenador" || !currentUser.unitId) {
    return null;
  }

  const scope = await resolveScopedDataAccess(currentUser);

  if (scope.restrictToCourse) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const filters = buildAccessLogFilterState(requestedFilters);
  let accessLogQuery = supabase
    .from("acessos_sistema")
    .select("id, nome_usuario, email, perfil, acessado_em")
    .eq("unidade_id", currentUser.unitId);

  if (filters.startDate) {
    accessLogQuery = accessLogQuery.gte(
      "acessado_em",
      `${filters.startDate}T00:00:00-03:00`
    );
  }

  if (filters.endDate) {
    accessLogQuery = accessLogQuery.lt(
      "acessado_em",
      `${addDays(filters.endDate, 1)}T00:00:00-03:00`
    );
  }

  const { data, error } = await accessLogQuery.order("acessado_em", {
    ascending: false
  });

  if (error) {
    throw new Error("Não foi possível carregar os acessos da unidade para exportação.");
  }

  const rows = (data ?? []) as Array<
    Pick<AccessLogRow, "id" | "nome_usuario" | "email" | "perfil" | "acessado_em">
  >;

  return {
    unitId: currentUser.unitId,
    unitName: currentUser.unitName ?? "Unidade do coordenador",
    exportedAt: formatDateTime(new Date().toISOString()),
    filters,
    totalAccesses: rows.length,
    entries: rows.map((row) => ({
      id: row.id,
      userName: row.nome_usuario,
      email: row.email,
      profile: row.perfil,
      profileLabel: formatProfileLabel(row.perfil),
      unitName: currentUser.unitName ?? "Unidade do coordenador",
      loginDate: formatDate(row.acessado_em),
      loginTime: formatTime(row.acessado_em),
      loggedAt: row.acessado_em
    }))
  };
}
