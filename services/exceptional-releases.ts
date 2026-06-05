import { getCurrentAppUser } from "@/lib/auth/session";
import { roleLabels } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  ExceptionalReleaseCheckContext,
  ExceptionalReleaseGateResult,
  ExceptionalReleaseResolution,
  ExceptionalReleaseScope,
  ExceptionalReleaseType,
  SessionUser
} from "@/types/domain";

type ReleaseRow = Database["public"]["Tables"]["liberacoes_excepcionais"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

interface EmptyState {
  title: string;
  description: string;
}

export interface ExceptionalReleaseRecipientOption {
  id: string;
  name: string;
  email: string;
  role: Exclude<Database["public"]["Tables"]["perfis"]["Row"]["codigo"], "aluno" | "coordenador_master">;
  roleLabel: string;
  label: string;
}

export interface ExceptionalReleaseSemesterOption {
  id: string;
  code: string;
  name: string;
  status: SemesterRow["status"];
  label: string;
}

export interface ExceptionalReleaseClassOption {
  id: string;
  semesterId: string;
  code: string;
  name: string;
  areaName: string;
  label: string;
}

export interface ExceptionalReleaseStudentOption {
  id: string;
  semesterId: string;
  classIds: string[];
  name: string;
  registration: string;
  email: string;
  classLabel: string;
  label: string;
}

export interface ExceptionalReleaseListEntry {
  id: string;
  type: ExceptionalReleaseType;
  typeLabel: string;
  scope: ExceptionalReleaseScope;
  scopeLabel: string;
  semesterCode: string;
  semesterName: string;
  classLabel: string | null;
  studentLabel: string | null;
  authorizedUserName: string;
  authorizedUserEmail: string;
  authorizedUserRoleLabel: string;
  createdByName: string;
  reason: string;
  startsAt: string;
  expiresAt: string;
  manuallyClosedAt: string | null;
  createdAt: string;
  statusKey: "ativa" | "agendada" | "expirada" | "encerrada";
  statusLabel: string;
  statusClassName: string;
  canManualClose: boolean;
}

export interface ExceptionalReleaseSummary {
  activeCount: number;
  scheduledCount: number;
  expiredCount: number;
  closedCount: number;
}

export interface ExceptionalReleaseManagementPageData {
  coordinator: {
    id: string;
    name: string;
    unitId: string;
    unitName: string | null;
  };
  semesterOptions: ExceptionalReleaseSemesterOption[];
  classOptions: ExceptionalReleaseClassOption[];
  studentOptions: ExceptionalReleaseStudentOption[];
  recipientOptions: ExceptionalReleaseRecipientOption[];
  activeEntries: ExceptionalReleaseListEntry[];
  historicalEntries: ExceptionalReleaseListEntry[];
  summary: ExceptionalReleaseSummary;
}

export interface ExceptionalReleaseManagementLoadResult {
  pageData: ExceptionalReleaseManagementPageData | null;
  emptyState: EmptyState | null;
}

const exceptionalReleaseTypeLabels: Record<ExceptionalReleaseType, string> = {
  avaliacao: "Avaliação",
  ausencia: "Ausência",
  clinica_supervisionada: "Clínica supervisionada"
};

const exceptionalReleaseScopeLabels: Record<ExceptionalReleaseScope, string> = {
  semestre: "Semestre",
  turma: "Turma",
  aluno: "Aluno"
};

function normalizeOptionalUuid(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalTimestamp(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function formatExceptionalReleaseUntil(expiresAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(expiresAt));
}

function buildExceptionalReleaseNotice(expiresAt: string) {
  return `Edicao liberada excepcionalmente ate ${formatExceptionalReleaseUntil(expiresAt)}.`;
}

function buildEmptyState(title: string, description: string): ExceptionalReleaseManagementLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function sortSemesters(semesters: SemesterRow[]) {
  return [...semesters].sort(
    (left, right) =>
      new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime()
  );
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim())))
  );
}

function buildReleaseStatus(row: ReleaseRow) {
  const now = Date.now();
  const startsAt = new Date(row.inicio_em).getTime();
  const expiresAt = new Date(row.expira_em).getTime();

  if (!row.ativo || row.encerrado_manualmente_em) {
    return {
      key: "encerrada" as const,
      label: "Encerrada",
      className: "status-encerrada"
    };
  }

  if (Number.isFinite(startsAt) && startsAt > now) {
    return {
      key: "agendada" as const,
      label: "Agendada",
      className: "status-planejado"
    };
  }

  if (Number.isFinite(expiresAt) && expiresAt < now) {
    return {
      key: "expirada" as const,
      label: "Expirada",
      className: "status-expirada"
    };
  }

  return {
    key: "ativa" as const,
    label: "Ativa",
    className: "status-ativo"
  };
}

function getRequiredUnitId(currentUser: SessionUser) {
  return currentUser.unitId ?? null;
}

export async function getCoordinatorExceptionalReleasePageData(
  currentUser: SessionUser
): Promise<ExceptionalReleaseManagementLoadResult> {
  const currentUnitId = getRequiredUnitId(currentUser);

  if (!currentUnitId) {
    return buildEmptyState(
      "Unidade operacional não identificada",
      "O coordenador autenticado precisa estar vinculado a uma unidade para gerenciar liberações excepcionais."
    );
  }

  const supabase = await createSupabaseServerClient();
  const [
    profileRowsResult,
    semesterRowsResult,
    unitUsersResult,
    releaseRowsResult
  ] = await Promise.all([
    supabase
      .from("perfis")
      .select("*")
      .in("codigo", [
        "aluno",
        "professor",
        "secretaria",
        "coordenador",
        "coordenador_master"
      ]),
    supabase.from("semestres").select("*").eq("unidade_id", currentUnitId),
    supabase.from("usuarios").select("*").eq("unidade_id", currentUnitId),
    supabase
      .from("liberacoes_excepcionais")
      .select("*")
      .eq("unidade_id", currentUnitId)
      .order("created_at", { ascending: false })
  ]);

  if (
    profileRowsResult.error ||
    semesterRowsResult.error ||
    unitUsersResult.error ||
    releaseRowsResult.error
  ) {
    return buildEmptyState(
      "Não foi possível carregar as liberações excepcionais",
      "Houve um problema ao consultar usuários, semestres ou liberações da unidade."
    );
  }

  const profileRows = (profileRowsResult.data ?? []) as ProfileRow[];
  const semesterRows = sortSemesters((semesterRowsResult.data ?? []) as SemesterRow[]);
  const unitUsers = (unitUsersResult.data ?? []) as UserRow[];
  const releaseRows = (releaseRowsResult.data ?? []) as ReleaseRow[];
  const semesterIds = semesterRows.map((semester) => semester.id);
  const closedSemesterRows = semesterRows.filter(
    (semester) => semester.status === "encerrado"
  );

  const classRowsResult = semesterIds.length
    ? await supabase.from("turmas").select("*").in("semestre_id", semesterIds)
    : { data: [], error: null };

  if (classRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar as liberações excepcionais",
      "Houve um problema ao consultar as turmas vinculadas aos semestres da unidade."
    );
  }

  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const classIds = classRows.map((classGroup) => classGroup.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase.from("matriculas_turma").select("*").in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar as liberações excepcionais",
      "Houve um problema ao consultar as matrículas das turmas da unidade."
    );
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const studentUserIds = uniqueStringValues(
    enrollmentRows.map((enrollment) => enrollment.aluno_id)
  );
  const studentRowsResult = studentUserIds.length
    ? await supabase.from("alunos").select("*").in("usuario_id", studentUserIds)
    : { data: [], error: null };

  if (studentRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar as liberações excepcionais",
      "Houve um problema ao consultar os alunos vinculados às turmas da unidade."
    );
  }

  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const profileById = new Map(profileRows.map((profile) => [profile.id, profile.codigo]));
  const semesterById = new Map(semesterRows.map((semester) => [semester.id, semester]));
  const classById = new Map(classRows.map((classGroup) => [classGroup.id, classGroup]));
  const userById = new Map(unitUsers.map((user) => [user.id, user]));
  const studentById = new Map(studentRows.map((student) => [student.usuario_id, student]));
  const studentOptionMap = new Map<
    string,
    {
      id: string;
      semesterId: string;
      name: string;
      registration: string;
      email: string;
      classIds: Set<string>;
      classLabels: Set<string>;
    }
  >();

  for (const enrollment of enrollmentRows) {
    const classGroup = classById.get(enrollment.turma_id);

    if (!classGroup) {
      continue;
    }

    const semester = semesterById.get(classGroup.semestre_id);

    if (!semester || semester.status !== "encerrado") {
      continue;
    }

    const studentUser = userById.get(enrollment.aluno_id);
    const student = studentById.get(enrollment.aluno_id);

    if (!studentUser || !student) {
      continue;
    }

    const optionKey = `${semester.id}:${student.usuario_id}`;
    const currentOption =
      studentOptionMap.get(optionKey) ??
      {
        id: student.usuario_id,
        semesterId: semester.id,
        name: studentUser.nome_completo,
        registration: student.matricula,
        email: studentUser.email,
        classIds: new Set<string>(),
        classLabels: new Set<string>()
      };

    currentOption.classIds.add(classGroup.id);
    currentOption.classLabels.add(`${classGroup.codigo} · ${classGroup.nome}`);
    studentOptionMap.set(optionKey, currentOption);
  }

  const semesterOptions: ExceptionalReleaseSemesterOption[] = closedSemesterRows.map(
    (semester) => ({
      id: semester.id,
      code: semester.codigo,
      name: semester.nome,
      status: semester.status,
      label: `${semester.codigo} · ${semester.nome}`
    })
  );

  const classOptions: ExceptionalReleaseClassOption[] = classRows
    .filter((classGroup) => {
      const semester = semesterById.get(classGroup.semestre_id);
      return semester?.status === "encerrado";
    })
    .map((classGroup) => ({
      id: classGroup.id,
      semesterId: classGroup.semestre_id,
      code: classGroup.codigo,
      name: classGroup.nome,
      areaName: classGroup.area_estagio,
      label: `${classGroup.codigo} · ${classGroup.nome} · ${classGroup.area_estagio}`
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const studentOptions: ExceptionalReleaseStudentOption[] = Array.from(
    studentOptionMap.values()
  )
    .map((studentOption) => {
      const classLabel = Array.from(studentOption.classLabels)
        .sort((left, right) => left.localeCompare(right, "pt-BR"))
        .join(" | ");

      return {
        id: studentOption.id,
        semesterId: studentOption.semesterId,
        classIds: Array.from(studentOption.classIds),
        name: studentOption.name,
        registration: studentOption.registration,
        email: studentOption.email,
        classLabel,
        label: `${studentOption.name} · ${studentOption.registration} · ${classLabel}`
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const recipientOptions: ExceptionalReleaseRecipientOption[] = unitUsers
    .filter((user) => {
      if (!user.ativo) {
        return false;
      }

      const profileCode = profileById.get(user.perfil_id);
      return (
        profileCode === "professor" ||
        profileCode === "secretaria" ||
        profileCode === "coordenador"
      );
    })
    .map((user) => {
      const profileCode =
        (profileById.get(user.perfil_id) as ExceptionalReleaseRecipientOption["role"]) ??
        "professor";
      const roleLabel = roleLabels[profileCode];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        role: profileCode,
        roleLabel,
        label: `${user.nome_completo} · ${roleLabel} · ${user.email}`
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const releaseEntries: ExceptionalReleaseListEntry[] = releaseRows.map((release) => {
    const status = buildReleaseStatus(release);
    const semester = semesterById.get(release.semestre_id);
    const classGroup = release.turma_id ? classById.get(release.turma_id) ?? null : null;
    const student = release.aluno_id ? studentById.get(release.aluno_id) ?? null : null;
    const studentUser = release.aluno_id ? userById.get(release.aluno_id) ?? null : null;
    const authorizedUser = userById.get(release.usuario_autorizado_id) ?? null;
    const creatorUser = userById.get(release.criado_por) ?? null;
    const authorizedRoleCode = authorizedUser
      ? profileById.get(authorizedUser.perfil_id) ?? null
      : null;

    return {
      id: release.id,
      type: release.tipo,
      typeLabel: exceptionalReleaseTypeLabels[release.tipo],
      scope: release.escopo,
      scopeLabel: exceptionalReleaseScopeLabels[release.escopo],
      semesterCode: semester?.codigo ?? "Semestre não identificado",
      semesterName: semester?.nome ?? "Semestre não identificado",
      classLabel: classGroup
        ? `${classGroup.codigo} · ${classGroup.nome}`
        : null,
      studentLabel:
        student && studentUser
          ? `${studentUser.nome_completo} · ${student.matricula}`
          : null,
      authorizedUserName: authorizedUser?.nome_completo ?? "Usuário não identificado",
      authorizedUserEmail: authorizedUser?.email ?? "Sem e-mail visível",
      authorizedUserRoleLabel:
        authorizedRoleCode && authorizedRoleCode in roleLabels
          ? roleLabels[authorizedRoleCode]
          : "Perfil não identificado",
      createdByName: creatorUser?.nome_completo ?? "Autorização institucional",
      reason: release.motivo,
      startsAt: release.inicio_em,
      expiresAt: release.expira_em,
      manuallyClosedAt: release.encerrado_manualmente_em,
      createdAt: release.created_at,
      statusKey: status.key,
      statusLabel: status.label,
      statusClassName: status.className,
      canManualClose: status.key === "ativa" || status.key === "agendada"
    };
  });

  const activeEntries = releaseEntries.filter(
    (entry) => entry.statusKey === "ativa" || entry.statusKey === "agendada"
  );
  const historicalEntries = releaseEntries.filter(
    (entry) => entry.statusKey === "expirada" || entry.statusKey === "encerrada"
  );

  return {
    pageData: {
      coordinator: {
        id: currentUser.id,
        name: currentUser.name,
        unitId: currentUnitId,
        unitName: currentUser.unitName ?? null
      },
      semesterOptions,
      classOptions,
      studentOptions,
      recipientOptions,
      activeEntries,
      historicalEntries,
      summary: {
        activeCount: releaseEntries.filter((entry) => entry.statusKey === "ativa").length,
        scheduledCount: releaseEntries.filter((entry) => entry.statusKey === "agendada")
          .length,
        expiredCount: releaseEntries.filter((entry) => entry.statusKey === "expirada").length,
        closedCount: releaseEntries.filter((entry) => entry.statusKey === "encerrada").length
      }
    },
    emptyState: null
  };
}

export async function findActiveExceptionalRelease(
  input: ExceptionalReleaseCheckContext,
  currentUserOverride?: SessionUser | null
): Promise<ExceptionalReleaseResolution | null> {
  const currentUser = currentUserOverride ?? (await getCurrentAppUser());

  if (!currentUser) {
    throw new Error(
      "Não foi possível verificar a liberação excepcional sem um usuário autenticado."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase.rpc as any)(
    "obter_liberacao_excepcional_ativa",
    {
      p_tipo: input.type,
      p_semestre_id: input.semesterId,
      p_turma_id: normalizeOptionalUuid(input.classId),
      p_aluno_id: normalizeOptionalUuid(input.studentId),
      p_usuario_id: normalizeOptionalUuid(input.authorizedUserId) ?? currentUser.id,
      p_unidade_id: normalizeOptionalUuid(input.unitId) ?? currentUser.unitId ?? null,
      p_referencia_em: normalizeOptionalTimestamp(input.referenceAt)
    }
  );

  if (error) {
    throw new Error(
      "Não foi possível verificar a liberação excepcional ativa para este contexto."
    );
  }

  const releaseId = typeof data === "string" && data.length > 0 ? data : null;

  if (!releaseId) {
    return null;
  }

  const { data: releaseData, error: releaseError } = await supabase
    .from("liberacoes_excepcionais")
    .select("id, expira_em")
    .eq("id", releaseId)
    .maybeSingle();
  const releaseRow = (releaseData ?? null) as Pick<ReleaseRow, "id" | "expira_em"> | null;

  if (releaseError || !releaseRow) {
    throw new Error(
      "NÃ£o foi possÃ­vel carregar a vigÃªncia da liberaÃ§Ã£o excepcional ativa."
    );
  }

  return {
    releaseId,
    expiresAt: releaseRow.expira_em,
    noticeMessage: buildExceptionalReleaseNotice(releaseRow.expira_em)
  };
}

export async function hasActiveExceptionalRelease(
  input: ExceptionalReleaseCheckContext
) {
  const release = await findActiveExceptionalRelease(input);
  return release !== null;
}

export async function requireActiveExceptionalRelease(
  input: ExceptionalReleaseCheckContext,
  message = "O período letivo está encerrado e não há liberação excepcional ativa para esta ação."
) {
  const release = await findActiveExceptionalRelease(input);

  if (!release) {
    throw new Error(message);
  }

  return release;
}

export async function resolveExceptionalReleaseGate(
  input: ExceptionalReleaseCheckContext,
  options?: {
    currentUser?: SessionUser | null;
    semesterStatus?: SemesterRow["status"] | null;
    blockedMessage?: string;
  }
): Promise<ExceptionalReleaseGateResult> {
  const currentUser = options?.currentUser ?? (await getCurrentAppUser());

  if (!currentUser) {
    throw new Error(
      "NÃ£o foi possÃ­vel verificar a liberaÃ§Ã£o excepcional sem um usuÃ¡rio autenticado."
    );
  }

  let semesterStatus = options?.semesterStatus ?? null;

  if (!semesterStatus) {
    const supabase = await createSupabaseServerClient();
    let semesterQuery = supabase.from("semestres").select("status").eq("id", input.semesterId);
    const requestedUnitId = input.unitId ?? currentUser.unitId ?? null;

    if (requestedUnitId) {
      semesterQuery = semesterQuery.eq("unidade_id", requestedUnitId);
    }

    const { data: semesterData, error: semesterError } = await semesterQuery.maybeSingle();
    const semesterRow = (semesterData ?? null) as Pick<SemesterRow, "status"> | null;

    if (semesterError || !semesterRow) {
      throw new Error(
        "NÃ£o foi possÃ­vel identificar o semestre vinculado a esta operaÃ§Ã£o."
      );
    }

    semesterStatus = semesterRow.status;
  }

  if (semesterStatus !== "encerrado") {
    return {
      semesterClosed: false,
      allowed: true,
      viaExceptionalRelease: false,
      release: null,
      blockedMessage: null,
      noticeMessage: null
    };
  }

  const release = await findActiveExceptionalRelease(
    {
      ...input,
      authorizedUserId: input.authorizedUserId ?? currentUser.id,
      unitId: input.unitId ?? currentUser.unitId ?? null
    },
    currentUser
  );

  if (!release) {
    return {
      semesterClosed: true,
      allowed: false,
      viaExceptionalRelease: false,
      release: null,
      blockedMessage:
        options?.blockedMessage ??
        "O perÃ­odo letivo estÃ¡ encerrado e nÃ£o hÃ¡ liberaÃ§Ã£o excepcional ativa para esta aÃ§Ã£o.",
      noticeMessage: null
    };
  }

  return {
    semesterClosed: true,
    allowed: true,
    viaExceptionalRelease: true,
    release,
    blockedMessage: null,
    noticeMessage: release.noticeMessage
  };
}

export async function attachExceptionalReleaseToAuditRecords(input: {
  supabase?: SupabaseServerClient;
  releaseId?: string | null;
  tableName: string;
  recordIds: Array<string | null | undefined>;
}) {
  const releaseId = normalizeOptionalUuid(input.releaseId);
  const recordIds = Array.from(
    new Set(
      input.recordIds.filter((recordId): recordId is string =>
        Boolean(recordId && recordId.trim())
      )
    )
  );

  if (!releaseId || recordIds.length === 0) {
    return 0;
  }

  const supabase = input.supabase ?? (await createSupabaseServerClient());
  const { data, error } = await (supabase.rpc as any)(
    "vincular_liberacao_excepcional_auditoria",
    {
      p_liberacao_excepcional_id: releaseId,
      p_tabela: input.tableName,
      p_registro_ids: recordIds
    }
  );

  if (error) {
    throw new Error(
      "NÃ£o foi possÃ­vel vincular a liberaÃ§Ã£o excepcional ao histÃ³rico de auditoria."
    );
  }

  return typeof data === "number" ? data : 0;
}
