import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditEntry, ProfileCode, SessionUser } from "@/types/domain";
import type { Database } from "@/types/database";
import {
  loadUnitAuditFeed,
  type UnitAuditAreaOption,
  type UnitAuditFilterState
} from "@/services/audit";

type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CoordinatorRow = Database["public"]["Tables"]["coordenadores"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type AuditHistoryRow = Database["public"]["Tables"]["historico_alteracoes"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];

type VisibleProfileCode = Exclude<ProfileCode, "coordenador_master">;

const visibleInstitutionalProfiles: VisibleProfileCode[] = [
  "coordenador",
  "professor",
  "aluno"
];

export interface MasterUnitOption {
  id: string;
  name: string;
  acronym: string;
  slug: string;
  isActive: boolean;
}

export interface MasterUnitSummary {
  id: string;
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
  units: MasterUnitSummary[];
}

export interface MasterCoordinatorsPageData {
  units: MasterUnitOption[];
  filters: {
    unitId: string;
    status: "ativos" | "inativos" | "todos";
  };
  totalCoordinators: number;
  activeCoordinators: number;
  entries: Array<{
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
  }>;
}

export interface MasterUsersPageData {
  units: MasterUnitOption[];
  filters: {
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
  unitName: string;
  actorName: string;
  actorProfileLabel: string;
  action: AuditEntry["action"];
  tableName: string;
  recordLabel: string;
  summary: string;
  happenedAt: string;
}

export interface MasterGlobalAuditPageData {
  units: MasterUnitOption[];
  filters: {
    unitId: string;
    role: VisibleProfileCode | "todos";
    period: "7" | "30" | "90" | "365" | "all";
  };
  totalEvents: number;
  totalUnitsTouched: number;
  totalActors: number;
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

function buildUnitOptions(units: UnitRow[]): MasterUnitOption[] {
  return [...units]
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"))
    .map((unit) => ({
      id: unit.id,
      name: unit.nome,
      acronym: unit.sigla,
      slug: unit.slug,
      isActive: unit.ativo
    }));
}

function formatLocation(city: string | null, state: string | null) {
  if (city && state) {
    return `${city} / ${state}`;
  }

  return city || state || "NÃ£o informado";
}

function normalizeFilterValue(
  value: string | string[] | undefined
): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

  return `${entry.tabela} Â· ${entry.registro_id.slice(0, 8)}`;
}

function buildAuditSummary(entry: AuditHistoryRow) {
  switch (entry.acao) {
    case "INSERT":
      return `InclusÃ£o registrada em ${entry.tabela}.`;
    case "UPDATE":
      return `AtualizaÃ§Ã£o registrada em ${entry.tabela}.`;
    case "DELETE":
      return `ExclusÃ£o registrada em ${entry.tabela}.`;
    default:
      return `MovimentaÃ§Ã£o registrada em ${entry.tabela}.`;
  }
}

async function loadProfiles() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("perfis").select("id, codigo, nome");

  if (error) {
    throw new Error(
      formatSupabaseErrorMessage("NÃ£o foi possÃ­vel carregar os perfis da plataforma.", error)
    );
  }

  const rows = (data ?? []) as Array<Pick<ProfileRow, "id" | "codigo" | "nome">>;
  const byId = new Map(rows.map((profile) => [profile.id, profile]));
  const byCode = new Map(rows.map((profile) => [profile.codigo, profile]));

  return { rows, byId, byCode };
}

async function loadMasterBaseData() {
  const supabase = createSupabaseAdminClient();
  const [unitsResult, coordinatorsResult, semestersResult] = await Promise.all([
    supabase.from("unidades").select("*").order("nome"),
    supabase.from("coordenadores").select("*").order("created_at", { ascending: false }),
    supabase.from("semestres").select("*").order("data_inicio", { ascending: false })
  ]);

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar as unidades cadastradas.",
        unitsResult.error
      )
    );
  }

  if (coordinatorsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar os coordenadores das unidades.",
        coordinatorsResult.error
      )
    );
  }

  if (semestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar os semestres das unidades.",
        semestersResult.error
      )
    );
  }

  const units = (unitsResult.data ?? []) as UnitRow[];
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
        "NÃ£o foi possÃ­vel carregar os usuÃ¡rios coordenadores.",
        coordinatorUsersResult.error
      )
    );
  }

  const coordinatorUsers = (coordinatorUsersResult.data ?? []) as Array<
    Pick<UserRow, "id" | "nome_completo" | "email" | "ativo">
  >;

  return {
    units,
    coordinators,
    semesters,
    coordinatorUserMap: new Map(
      coordinatorUsers.map((user) => [user.id, user])
    )
  };
}

function buildUnitSummaries(input: {
  units: UnitRow[];
  coordinators: CoordinatorRow[];
  semesters: SemesterRow[];
  coordinatorUserMap: Map<string, Pick<UserRow, "id" | "nome_completo" | "email" | "ativo">>;
}) {
  const coordinatorsByUnit = new Map<string, CoordinatorRow[]>();
  const semestersByUnit = new Map<string, SemesterRow[]>();

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

      if (!linkedCoordinators.some((coordinator) =>
        input.coordinatorUserMap.get(coordinator.usuario_id)?.ativo
      )) {
        pendingItems.push("Nenhum coordenador ativo vinculado Ã  unidade.");
      }

      if (!unitSemesters.length) {
        pendingItems.push("Nenhum semestre cadastrado para a unidade.");
      } else if (!activeSemesterCount) {
        pendingItems.push("Nenhum semestre ativo na unidade.");
      }

      return {
        id: unit.id,
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
    units: unitSummaries
  };
}

export async function getMasterUnitsPageData() {
  const baseData = await loadMasterBaseData();
  return {
    units: buildUnitSummaries(baseData),
    unitOptions: buildUnitOptions(baseData.units)
  };
}

export async function getMasterCoordinatorsPageData(input?: {
  unitId?: string | string[];
  status?: string | string[];
}): Promise<MasterCoordinatorsPageData> {
  const baseData = await loadMasterBaseData();
  const units = buildUnitOptions(baseData.units);
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedStatus = normalizeFilterValue(input?.status);
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
        name: coordinatorUser?.nome_completo ?? "Coordenador nÃ£o identificado",
        email: coordinatorUser?.email ?? "Sem e-mail",
        roleTitle: coordinator.cargo,
        isActive: Boolean(coordinatorUser?.ativo),
        isResponsible: index === 0,
        createdAt: coordinator.created_at
      };
    });
  });

  const filteredEntries = entries.filter((entry) => {
    if (requestedUnitId && entry.unitId !== requestedUnitId) {
      return false;
    }

    if (statusFilter === "ativos" && !entry.isActive) {
      return false;
    }

    if (statusFilter === "inativos" && entry.isActive) {
      return false;
    }

    return true;
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
    units,
    filters: {
      unitId: requestedUnitId,
      status: statusFilter
    },
    totalCoordinators: entries.length,
    activeCoordinators: entries.filter((entry) => entry.isActive).length,
    entries: filteredEntries
  };
}

export async function getMasterUsersPageData(input?: {
  unitId?: string | string[];
  role?: string | string[];
  status?: string | string[];
}): Promise<MasterUsersPageData> {
  const supabase = createSupabaseAdminClient();
  const { byCode: profilesByCode, byId: profilesById } = await loadProfiles();
  const unitsResult = await supabase.from("unidades").select("*").order("nome");

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar as unidades para a visÃ£o de usuÃ¡rios.",
        unitsResult.error
      )
    );
  }

  const units = (unitsResult.data ?? []) as UnitRow[];
  const unitOptions = buildUnitOptions(units);
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedRole = normalizeFilterValue(input?.role);
  const requestedStatus = normalizeFilterValue(input?.status);
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

  if (requestedUnitId) {
    usersQuery = usersQuery.eq("unidade_id", requestedUnitId);
  }

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
        "NÃ£o foi possÃ­vel carregar os usuÃ¡rios institucionais.",
        usersResult.error
      )
    );
  }

  const users = (usersResult.data ?? []) as UserRow[];
  const userIds = users.map((user) => user.id);
  const [studentRowsResult, professorRowsResult, coordinatorRowsResult] = await Promise.all([
    userIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("professores").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase.from("coordenadores").select("*").in("usuario_id", userIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (studentRowsResult.error || professorRowsResult.error || coordinatorRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar os vÃ­nculos institucionais dos usuÃ¡rios.",
        studentRowsResult.error ??
          professorRowsResult.error ??
          coordinatorRowsResult.error
      )
    );
  }

  const unitMap = new Map(units.map((unit) => [unit.id, unit]));
  const studentMap = new Map(
    ((studentRowsResult.data ?? []) as StudentRow[]).map((student) => [
      student.usuario_id,
      student
    ])
  );
  const professorMap = new Map(
    ((professorRowsResult.data ?? []) as ProfessorRow[]).map((professor) => [
      professor.usuario_id,
      professor
    ])
  );
  const coordinatorMap = new Map(
    ((coordinatorRowsResult.data ?? []) as CoordinatorRow[]).map((coordinator) => [
      coordinator.usuario_id,
      coordinator
    ])
  );

  const entries = users.map((user) => {
    const profile = profilesById.get(user.perfil_id);
    const role = (profile?.codigo ?? "aluno") as VisibleProfileCode;
    let auxiliaryLabel = "Sem vÃ­nculo complementar";

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
        ? unitMap.get(user.unidade_id)?.nome ?? "Unidade nÃ£o identificada"
        : "Sem unidade vinculada",
      isActive: user.ativo,
      auxiliaryLabel
    };
  });

  return {
    units: unitOptions,
    filters: {
      unitId: requestedUnitId,
      role: roleFilter,
      status: statusFilter
    },
    totalUsers: entries.length,
    activeUsers: entries.filter((entry) => entry.isActive).length,
    entries
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
      formatSupabaseErrorMessage("Não foi possível carregar a unidade solicitada.", unitError)
    );
  }

  const unit = (unitData ?? null) as UnitRow | null;

  if (!unit) {
    return null;
  }

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
        "Não foi possível consolidar a visão institucional desta unidade.",
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
        "Não foi possível carregar as matrículas da unidade.",
        enrollmentRowsResult.error
      )
    );
  }

  const enrollments = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const pendingItems: string[] = [];

  if (!unit.ativo) {
    pendingItems.push("A unidade está inativa no cadastro institucional.");
  }

  if (!activeCoordinatorCount) {
    pendingItems.push("A unidade não possui coordenador ativo no momento.");
  }

  if (!semesters.length) {
    pendingItems.push("A unidade ainda não possui semestres cadastrados.");
  } else if (!semesters.some((semester) => semester.status === "ativo")) {
    pendingItems.push("A unidade não possui semestre ativo.");
  }

  if (!professorUsers.length) {
    pendingItems.push("Ainda não há professores cadastrados na unidade.");
  }

  if (!studentUsers.length) {
    pendingItems.push("Ainda não há alunos cadastrados na unidade.");
  }

  return {
    unit: {
      id: unit.id,
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
        name: user?.nome_completo ?? "Coordenador não identificado",
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
  unitId?: string | string[];
  role?: string | string[];
  period?: string | string[];
}): Promise<MasterGlobalAuditPageData> {
  const supabase = createSupabaseAdminClient();
  const [unitsResult, profiles] = await Promise.all([
    supabase.from("unidades").select("*").order("nome"),
    loadProfiles()
  ]);

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar as unidades para a auditoria global.",
        unitsResult.error
      )
    );
  }

  const units = (unitsResult.data ?? []) as UnitRow[];
  const requestedUnitId = normalizeFilterValue(input?.unitId);
  const requestedRole = normalizeFilterValue(input?.role);
  const requestedPeriod = normalizeFilterValue(input?.period);
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

  let auditQuery = supabase
    .from("historico_alteracoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(250);

  if (requestedUnitId) {
    auditQuery = auditQuery.eq("unidade_id", requestedUnitId);
  }

  if (periodFilter !== "all") {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - Number(periodFilter));
    auditQuery = auditQuery.gte("created_at", threshold.toISOString());
  }

  const auditRowsResult = await auditQuery;

  if (auditRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "NÃ£o foi possÃ­vel carregar os eventos da auditoria global.",
        auditRowsResult.error
      )
    );
  }

  const auditRows = (auditRowsResult.data ?? []) as AuditHistoryRow[];
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
        "NÃ£o foi possÃ­vel carregar os usuÃ¡rios responsÃ¡veis pelos eventos.",
        actorUsersResult.error
      )
    );
  }

  const actorUsers = (actorUsersResult.data ?? []) as Array<
    Pick<UserRow, "id" | "nome_completo" | "perfil_id">
  >;
  const actorUserMap = new Map(actorUsers.map((user) => [user.id, user]));
  const unitMap = new Map(units.map((unit) => [unit.id, unit]));

  const entries = auditRows
    .map((entry) => {
      const actor = entry.usuario_id ? actorUserMap.get(entry.usuario_id) ?? null : null;
      const profileCode = actor
        ? ((profiles.byId.get(actor.perfil_id)?.codigo ?? null) as VisibleProfileCode | null)
        : null;

      return {
        id: String(entry.id),
        unitName: entry.unidade_id
          ? unitMap.get(entry.unidade_id)?.nome ?? "Unidade nÃ£o identificada"
          : "Sem unidade",
        actorName: actor?.nome_completo ?? "Sistema",
        actorProfileLabel: profileCode ? roleLabel(profileCode) : "Sistema",
        actorProfileCode: profileCode,
        action: entry.acao,
        tableName: entry.tabela,
        recordLabel: buildRecordLabel(entry),
        summary: buildAuditSummary(entry),
        happenedAt: entry.created_at,
        unitId: entry.unidade_id ?? null
      };
    })
    .filter((entry) => {
      if (roleFilter !== "todos" && entry.actorProfileCode !== roleFilter) {
        return false;
      }

      return true;
    });

  return {
    units: buildUnitOptions(units),
    filters: {
      unitId: requestedUnitId,
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
    entries: entries.map((entry) => ({
      id: entry.id,
      unitName: entry.unitName,
      actorName: entry.actorName,
      actorProfileLabel: entry.actorProfileLabel,
      action: entry.action,
      tableName: entry.tableName,
      recordLabel: entry.recordLabel,
      summary: entry.summary,
      happenedAt: entry.happenedAt
    }))
  };
}

