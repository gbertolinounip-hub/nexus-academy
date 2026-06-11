import type { PostgrestError } from "@supabase/supabase-js";
import { roleLabels } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProfileCode } from "@/types/domain";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];

export interface CourseManagerManagementSummary {
  totalManagers: number;
  totalActiveManagers: number;
  totalInactiveManagers: number;
  totalInstitutionsCovered: number;
  totalCoursesCovered: number;
  totalAvailableUsers: number;
}

export interface CourseManagerInstitutionOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CourseManagerCourseOption {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface CourseManagerUserOption {
  id: string;
  name: string;
  email: string;
  legacyProfileName: string;
  legacyUnitName: string | null;
  label: string;
}

export interface CourseManagerManagementEntry {
  contextId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userActive: boolean;
  institutionId: string | null;
  institutionName: string | null;
  courseId: string | null;
  courseCode: string | null;
  courseName: string | null;
  principal: boolean;
  ativo: boolean;
  createdAt: string;
  scopeLabel: string;
  isDefaultContext: boolean;
}

export interface CourseManagerManagementPageData {
  summary: CourseManagerManagementSummary;
  institutions: CourseManagerInstitutionOption[];
  courses: CourseManagerCourseOption[];
  users: CourseManagerUserOption[];
  entries: CourseManagerManagementEntry[];
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

function buildMapById<T extends { id: string | number }>(rows: T[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function resolveLegacyProfileCode(value: string | null | undefined): ProfileCode | null {
  if (
    value === "aluno" ||
    value === "professor" ||
    value === "secretaria" ||
    value === "coordenador" ||
    value === "coordenador_master"
  ) {
    return value;
  }

  return null;
}

export async function getCourseManagerManagementPageData(): Promise<CourseManagerManagementPageData> {
  const supabase = createSupabaseAdminClient();
  const [
    institutionsResult,
    coursesResult,
    usersResult,
    unitsResult,
    profilesResult,
    contextsResult
  ] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("cursos").select("*").order("nome", { ascending: true }),
    supabase.from("usuarios").select("*").order("nome_completo", { ascending: true }),
    supabase.from("unidades").select("*").order("nome", { ascending: true }),
    supabase.from("perfis").select("*"),
    supabase
      .from("usuarios_papeis_contexto")
      .select("*")
      .order("created_at", { ascending: true })
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes.",
        institutionsResult.error
      )
    );
  }

  if (coursesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os cursos.", coursesResult.error)
    );
  }

  if (usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os usuarios.", usersResult.error)
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar as unidades.", unitsResult.error)
    );
  }

  if (profilesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os perfis.", profilesResult.error)
    );
  }

  if (contextsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os contextos de usuarios.",
        contextsResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const userRows = (usersResult.data ?? []) as UserRow[];
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const profileRows = (profilesResult.data ?? []) as ProfileRow[];
  const contextRows = (contextsResult.data ?? []) as UserContextRow[];

  const institutionsById = buildMapById(institutionRows);
  const coursesById = buildMapById(courseRows);
  const usersById = buildMapById(userRows);
  const unitsById = buildMapById(unitRows);
  const profilesById = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow]));

  const institutions = institutionRows.map((institutionRow) => ({
    id: institutionRow.id,
    name: institutionRow.nome,
    slug: institutionRow.slug,
    isActive: institutionRow.ativo
  }));

  const courses = courseRows.map((courseRow) => ({
    id: courseRow.id,
    institutionId: courseRow.instituicao_id,
    code: courseRow.codigo,
    name: courseRow.nome,
    isActive: courseRow.ativo
  }));

  const users = userRows
    .filter((userRow) => userRow.ativo)
    .map<CourseManagerUserOption>((userRow) => {
      const legacyProfileRow = profilesById.get(userRow.perfil_id) ?? null;
      const legacyProfileCode = resolveLegacyProfileCode(legacyProfileRow?.codigo);
      const legacyUnitRow = userRow.unidade_id ? unitsById.get(userRow.unidade_id) ?? null : null;
      const legacyProfileName =
        (legacyProfileCode ? roleLabels[legacyProfileCode] : null) ??
        legacyProfileRow?.nome ??
        "Perfil nao identificado";

      return {
        id: userRow.id,
        name: userRow.nome_completo,
        email: userRow.email,
        legacyProfileName,
        legacyUnitName: legacyUnitRow?.nome ?? null,
        label: `${userRow.nome_completo} (${userRow.email}) · ${legacyProfileName}${
          legacyUnitRow ? ` · ${legacyUnitRow.nome}` : ""
        }`
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const entries = contextRows
    .map<CourseManagerManagementEntry | null>((contextRow) => {
      const profileRow = profilesById.get(contextRow.perfil_id) ?? null;

      if (profileRow?.codigo !== "master_curso") {
        return null;
      }

      const userRow = usersById.get(contextRow.usuario_id) ?? null;
      const courseRow = contextRow.curso_id ? coursesById.get(contextRow.curso_id) ?? null : null;
      const institutionId = contextRow.instituicao_id ?? courseRow?.instituicao_id ?? null;
      const institutionRow = institutionId ? institutionsById.get(institutionId) ?? null : null;

      if (!userRow) {
        return null;
      }

      return {
        contextId: contextRow.id,
        userId: userRow.id,
        userName: userRow.nome_completo,
        userEmail: userRow.email,
        userActive: userRow.ativo,
        institutionId,
        institutionName: institutionRow?.nome ?? null,
        courseId: courseRow?.id ?? null,
        courseCode: courseRow?.codigo ?? null,
        courseName: courseRow?.nome ?? null,
        principal: contextRow.principal,
        ativo: contextRow.ativo,
        createdAt: contextRow.created_at,
        scopeLabel: "Curso inteiro",
        isDefaultContext: userRow.contexto_padrao_id === contextRow.id
      };
    })
    .filter((entry): entry is CourseManagerManagementEntry => entry !== null)
    .sort((left, right) => {
      const institutionComparison = (left.institutionName ?? "").localeCompare(
        right.institutionName ?? "",
        "pt-BR"
      );

      if (institutionComparison !== 0) {
        return institutionComparison;
      }

      const courseComparison = `${left.courseCode ?? ""} ${left.courseName ?? ""}`.localeCompare(
        `${right.courseCode ?? ""} ${right.courseName ?? ""}`,
        "pt-BR"
      );

      if (courseComparison !== 0) {
        return courseComparison;
      }

      return left.userName.localeCompare(right.userName, "pt-BR");
    });

  return {
    summary: {
      totalManagers: entries.length,
      totalActiveManagers: entries.filter((entry) => entry.ativo).length,
      totalInactiveManagers: entries.filter((entry) => !entry.ativo).length,
      totalInstitutionsCovered: new Set(
        entries.map((entry) => entry.institutionId).filter(Boolean)
      ).size,
      totalCoursesCovered: new Set(entries.map((entry) => entry.courseId).filter(Boolean)).size,
      totalAvailableUsers: users.length
    },
    institutions,
    courses,
    users,
    entries
  };
}
