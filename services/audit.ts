import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { AuditEntry, SessionUser } from "@/types/domain";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type AuditHistoryRow = Database["public"]["Tables"]["historico_alteracoes"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_avaliacao"]["Row"];
type SupabaseDatabaseClient = SupabaseClient<Database>;

type JsonRecord = Record<string, unknown>;

interface AuditPageLoadResult {
  entries: AuditEntry[];
  areaOptions: UnitAuditAreaOption[];
  filters: UnitAuditFilterState;
  closedSemesters: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  selectedSemesterId: string | null;
  selectedClosedSemester: ClosedSemesterAuditView | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface ClosedSemesterAreaAuditSummary {
  classId: string;
  classCode: string;
  className: string;
  areaName: string;
  blockName: string;
  archivedAt: string;
  responsibleLabel: string;
  supervisorNames: string[];
}

export interface ClosedSemesterAuditView {
  id: string;
  code: string;
  name: string;
  archivedAt: string;
  archivedByName: string;
  areas: ClosedSemesterAreaAuditSummary[];
}

export interface ClosedSemesterAreaAuditDetail {
  semester: {
    id: string;
    code: string;
    name: string;
    archivedAt: string;
    archivedByName: string;
  };
  area: {
    classId: string;
    classCode: string;
    className: string;
    areaName: string;
    blockName: string;
    supervisorNames: string[];
  };
}

interface AuditContext {
  actorUsers: Map<string, UserRow>;
  professorUsers: Map<string, UserRow>;
  semesters: Map<string, SemesterRow>;
  classes: Map<string, ClassRow>;
  studentRows: Map<string, StudentRow>;
  studentUsers: Map<string, UserRow>;
  enrollments: Map<string, EnrollmentRow>;
  evaluations: Map<string, EvaluationRow>;
  evaluationSnapshots: Map<string, JsonRecord>;
  criteria: Map<string, CriterionRow>;
  areas: Map<string, UnitAuditAreaOption>;
}

export interface UnitAuditFilterState {
  startDate: string;
  endDate: string;
  areaId: string;
}

export interface UnitAuditAreaOption {
  id: string;
  name: string;
  blockName: string;
}

export interface UnitAuditFeed {
  entries: AuditEntry[];
  areaOptions: UnitAuditAreaOption[];
  filters: UnitAuditFilterState;
  semesterRows: SemesterRow[];
  classRows: ClassRow[];
}

function buildAuditEmptyState(
  title: string,
  description: string
): AuditPageLoadResult {
  return {
    entries: [],
    areaOptions: [],
    filters: {
      startDate: "",
      endDate: "",
      areaId: ""
    },
    closedSemesters: [],
    selectedSemesterId: null,
    selectedClosedSemester: null,
    emptyState: {
      title,
      description
    }
  };
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

function isAuditUnitScopeMissingColumnError(error: PostgrestError | null) {
  if (!error) {
    return false;
  }

  const haystack = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    error.code === "42703" ||
    (haystack.includes("historico_alteracoes") && haystack.includes("unidade_id"))
  );
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

function buildUnitAuditFilterState(input?: {
  startDate?: string | string[] | null;
  endDate?: string | string[] | null;
  areaId?: string | string[] | null;
}): UnitAuditFilterState {
  return {
    startDate: normalizeDateFilterValue(input?.startDate),
    endDate: normalizeDateFilterValue(input?.endDate),
    areaId: normalizeQueryValue(input?.areaId).trim()
  };
}

async function loadAuditRowsForUnit(input: {
  supabase: SupabaseDatabaseClient;
  unitId: string;
  limit: number;
  filters: UnitAuditFilterState;
}) {
  const hasExplicitFilters = Boolean(
    input.filters.startDate || input.filters.endDate || input.filters.areaId
  );
  let unitScopedQuery = input.supabase
    .from("historico_alteracoes")
    .select("*")
    .eq("unidade_id", input.unitId);

  if (input.filters.startDate) {
    unitScopedQuery = unitScopedQuery.gte(
      "created_at",
      `${input.filters.startDate}T00:00:00-03:00`
    );
  }

  if (input.filters.endDate) {
    unitScopedQuery = unitScopedQuery.lt(
      "created_at",
      `${addDays(input.filters.endDate, 1)}T00:00:00-03:00`
    );
  }

  let orderedUnitScopedQuery = unitScopedQuery.order("created_at", {
    ascending: false
  });

  if (!hasExplicitFilters) {
    orderedUnitScopedQuery = orderedUnitScopedQuery.limit(input.limit);
  }

  const unitScopedResult = await orderedUnitScopedQuery;

  if (!unitScopedResult.error) {
    return {
      rows: (unitScopedResult.data ?? []) as AuditHistoryRow[],
      scopedByUnit: true,
      warning: null,
      error: null as PostgrestError | null
    };
  }

  if (!isAuditUnitScopeMissingColumnError(unitScopedResult.error)) {
    return {
      rows: [] as AuditHistoryRow[],
      scopedByUnit: true,
      warning: null,
      error: unitScopedResult.error
    };
  }

  let fallbackQuery = input.supabase.from("historico_alteracoes").select("*");

  if (input.filters.startDate) {
    fallbackQuery = fallbackQuery.gte(
      "created_at",
      `${input.filters.startDate}T00:00:00-03:00`
    );
  }

  if (input.filters.endDate) {
    fallbackQuery = fallbackQuery.lt(
      "created_at",
      `${addDays(input.filters.endDate, 1)}T00:00:00-03:00`
    );
  }

  const fallbackLimit = hasExplicitFilters
    ? Math.max(input.limit * 20, 4000)
    : Math.max(input.limit * 4, 400);
  const fallbackResult = await fallbackQuery
    .order("created_at", { ascending: false })
    .limit(fallbackLimit);

  if (fallbackResult.error) {
    return {
      rows: [] as AuditHistoryRow[],
      scopedByUnit: false,
      warning: formatSupabaseErrorMessage(
        "A consulta por unidade em public.historico_alteracoes falhou e o fallback também não pôde ser executado.",
        unitScopedResult.error
      ),
      error: fallbackResult.error
    };
  }

  return {
    rows: (fallbackResult.data ?? []) as AuditHistoryRow[],
    scopedByUnit: false,
    warning: formatSupabaseErrorMessage(
      "A consulta por unidade em public.historico_alteracoes falhou; a auditoria usará filtragem defensiva por semestre até a migração ficar homogênea em todos os ambientes.",
      unitScopedResult.error
    ),
    error: null as PostgrestError | null
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function getString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(record: JsonRecord, key: string) {
  const value = record[key];

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }

  return undefined;
}

function getBoolean(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function pickAuditPayload(entry: AuditHistoryRow) {
  return asRecord(entry.dados_depois ?? entry.dados_antes);
}

function launchTypeLabel(value?: string) {
  switch (value) {
    case "parcial":
      return "Lançamento parcial";
    case "revisao":
      return "Lançamento de revisão";
    case "fechamento":
      return "Lançamento de fechamento";
    default:
      return "Lançamento";
  }
}

function formatHourValue(value?: number) {
  if (value === undefined) {
    return null;
  }

  return `${value.toFixed(2).replace(".", ",")}h`;
}

function formatRawValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "vazio";
  }

  if (typeof value === "boolean") {
    return value ? "sim" : "não";
  }

  if (typeof value === "number") {
    return String(value).replace(".", ",");
  }

  return String(value);
}

function getChangedKeys(before: JsonRecord, after: JsonRecord) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key])
  );
}

function fieldLabel(key: string) {
  const labels: Record<string, string> = {
    tipo_lancamento: "tipo de lançamento",
    referencia: "referencia",
    observacoes: "observacoes",
    avaliacao_origem_id: "avaliação de origem",
    avaliacao_raiz_id: "avaliação raiz",
    status: "status",
    avaliado_em: "data da avaliação",
    nota_bruta: "nota bruta",
    feedback: "feedback",
    horas: "horas",
    justificada: "justificada",
    motivo: "motivo",
    data_ausencia: "data da ausencia",
    ativo: "situacao do vínculo",
    responsavel_principal: "responsavel principal",
    data_inicio: "data de inicio",
    data_fim: "data de fim"
  };

  return labels[key] ?? key.replaceAll("_", " ");
}

function buildFieldDiffSummary(before: JsonRecord, after: JsonRecord) {
  const changes = getChangedKeys(before, after)
    .filter((key) => !["updated_at", "created_at", "id"].includes(key))
    .slice(0, 3)
    .map((key) => {
      const label = fieldLabel(key);
      return `${label}: ${formatRawValue(before[key])} -> ${formatRawValue(after[key])}`;
    });

  if (!changes.length) {
    return "Campos internos atualizados.";
  }

  return changes.join("; ");
}

function resolveEvaluationRecord(
  evaluationId: string | undefined,
  context: AuditContext
) {
  if (!evaluationId) {
    return undefined;
  }

  return context.evaluations.get(evaluationId) ?? context.evaluationSnapshots.get(evaluationId);
}

function resolveEnrollmentId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  if (entry.tabela === "avaliacoes" || entry.tabela === "ausencias") {
    return getString(payload, "matricula_turma_id");
  }

  if (entry.tabela === "vinculos_professor_aluno") {
    return getString(payload, "matricula_turma_id");
  }

  if (entry.tabela === "itens_avaliados") {
    const evaluationId = getString(payload, "avaliacao_id");
    const evaluationRecord = resolveEvaluationRecord(evaluationId, context);
    return getString(asRecord(evaluationRecord), "matricula_turma_id");
  }

  return undefined;
}

function resolveProfessorId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  if (entry.tabela === "avaliacoes" || entry.tabela === "vinculos_professor_aluno") {
    return getString(payload, "professor_id");
  }

  if (entry.tabela === "itens_avaliados") {
    const evaluationId = getString(payload, "avaliacao_id");
    const evaluationRecord = resolveEvaluationRecord(evaluationId, context);
    return getString(asRecord(evaluationRecord), "professor_id");
  }

  return undefined;
}

function resolveEntrySemesterId(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  if (entry.tabela === "semestres") {
    return getString(payload, "id") ?? entry.registro_id ?? undefined;
  }

  if (entry.tabela === "turmas") {
    return getString(payload, "semestre_id");
  }

  const enrollmentId = resolveEnrollmentId(entry, payload, context);

  if (!enrollmentId) {
    return undefined;
  }

  const enrollment = context.enrollments.get(enrollmentId);
  const classGroup = enrollment ? context.classes.get(enrollment.turma_id) : null;

  return classGroup?.semestre_id;
}

function resolveEntryClass(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  if (entry.tabela === "turmas") {
    const classId = getString(payload, "id") ?? entry.registro_id ?? undefined;
    return classId ? context.classes.get(classId) : undefined;
  }

  if (entry.tabela === "matriculas_turma") {
    const enrollmentId = getString(payload, "id") ?? entry.registro_id ?? undefined;
    const enrollment = enrollmentId ? context.enrollments.get(enrollmentId) : undefined;
    return enrollment ? context.classes.get(enrollment.turma_id) : undefined;
  }

  const enrollmentId = resolveEnrollmentId(entry, payload, context);
  const enrollment = enrollmentId ? context.enrollments.get(enrollmentId) : undefined;

  return enrollment ? context.classes.get(enrollment.turma_id) : undefined;
}

function resolveEntryArea(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  const classGroup = resolveEntryClass(entry, payload, context);

  if (!classGroup?.area_estagio_id) {
    return null;
  }

  return context.areas.get(classGroup.area_estagio_id) ?? null;
}

function resolveStudentName(enrollmentId: string | undefined, context: AuditContext) {
  if (!enrollmentId) {
    return "Aluno não identificado";
  }

  const enrollment = context.enrollments.get(enrollmentId);

  if (!enrollment) {
    return "Aluno não identificado";
  }

  const studentRow = context.studentRows.get(enrollment.aluno_id);
  const studentUser = context.studentUsers.get(enrollment.aluno_id);

  return studentRow?.nome_social ?? studentUser?.nome_completo ?? "Aluno não identificado";
}

function resolveProfessorName(professorId: string | undefined, context: AuditContext) {
  if (!professorId) {
    return "Professor não identificado";
  }

  return context.professorUsers.get(professorId)?.nome_completo ?? "Professor não identificado";
}

function uniqueStringValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function findSemesterClosureEntry(
  semesterId: string,
  auditRows: AuditHistoryRow[]
) {
  return auditRows.find((entry) => {
    if (entry.tabela !== "semestres" || entry.registro_id !== semesterId) {
      return false;
    }

    return getString(asRecord(entry.dados_depois), "status") === "encerrado";
  });
}

function fallbackAreaName(
  classGroup: ClassRow,
  areaMap: Map<string, { nome: string; blocoId: number }>
) {
  if (classGroup.area_estagio_id) {
    return areaMap.get(classGroup.area_estagio_id)?.nome ?? classGroup.area_estagio;
  }

  return classGroup.area_estagio;
}

function fallbackBlockName(
  classGroup: ClassRow,
  areaMap: Map<string, { nome: string; blocoId: number }>,
  blockMap: Map<number, string>
) {
  if (classGroup.area_estagio_id) {
    const area = areaMap.get(classGroup.area_estagio_id);
    return area ? blockMap.get(area.blocoId) ?? "Bloco não identificado" : "Bloco não identificado";
  }

  return "Bloco não identificado";
}

async function buildClosedSemesterAuditView(input: {
  semester: SemesterRow;
  fallbackAuditRows: AuditHistoryRow[];
}) {
  const supabase = await createSupabaseServerClient();
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
    throw new Error(
      "Não foi possível carregar as áreas arquivadas deste semestre."
    );
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
    ? await supabase
        .from("matriculas_turma")
        .select("*")
        .in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error(
      "Não foi possível carregar as matrículas arquivadas do semestre."
    );
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
    throw new Error(
      "Não foi possível consolidar o histórico das áreas arquivadas."
    );
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const professorIds = uniqueStringValues(
    professorLinks.map((link) => link.professor_id)
  );
  const professorUsersResult = professorIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", professorIds)
    : { data: [], error: null };

  if (professorUsersResult.error) {
    throw new Error(
      "Não foi possível carregar os responsáveis das áreas arquivadas."
    );
  }

  const professorNameMap = new Map(
    (((professorUsersResult.data ?? []) as Array<Pick<UserRow, "id" | "nome_completo">>)).map(
      (user) => [user.id, user.nome_completo]
    )
  );
  const areaMap = new Map(
    (((areaRowsResult.data ?? []) as Array<Pick<AreaRow, "id" | "nome" | "bloco_id">>)).map(
      (area) => [area.id, { nome: area.nome, blocoId: area.bloco_id }]
    )
  );
  const blockMap = new Map(
    (((blockRowsResult.data ?? []) as Array<Pick<BlockRow, "id" | "nome">>)).map(
      (block) => [block.id, block.nome]
    )
  );
  const enrollmentsByClassId = new Map<string, EnrollmentRow[]>();

  for (const enrollment of enrollmentRows) {
    const currentRows = enrollmentsByClassId.get(enrollment.turma_id) ?? [];
    currentRows.push(enrollment);
    enrollmentsByClassId.set(enrollment.turma_id, currentRows);
  }

  const linksByEnrollmentId = new Map<string, ProfessorLinkRow[]>();

  for (const link of professorLinks) {
    const currentLinks = linksByEnrollmentId.get(link.matricula_turma_id) ?? [];
    currentLinks.push(link);
    linksByEnrollmentId.set(link.matricula_turma_id, currentLinks);
  }

  const areas = classRows.map((classGroup) => {
    const classEnrollments = enrollmentsByClassId.get(classGroup.id) ?? [];
    const supervisorNames = uniqueStringValues(
      classEnrollments
        .flatMap((enrollment) => linksByEnrollmentId.get(enrollment.id) ?? [])
        .sort(
          (left, right) =>
            Number(right.responsavel_principal) - Number(left.responsavel_principal)
        )
        .map((link) => professorNameMap.get(link.professor_id) ?? "")
    );

    return {
      classId: classGroup.id,
      classCode: classGroup.codigo,
      className: classGroup.nome,
      areaName: fallbackAreaName(classGroup, areaMap),
      blockName: fallbackBlockName(classGroup, areaMap, blockMap),
      archivedAt,
      responsibleLabel: supervisorNames.length
        ? supervisorNames.join(", ")
        : "Sem supervisor definido",
      supervisorNames
    } satisfies ClosedSemesterAreaAuditSummary;
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

function buildRecordLabel(
  entry: AuditHistoryRow,
  payload: JsonRecord,
  context: AuditContext
) {
  const studentName = resolveStudentName(
    resolveEnrollmentId(entry, payload, context),
    context
  );

  if (entry.tabela === "avaliacoes") {
    const reference = getString(payload, "referencia");
    const launchType = getString(payload, "tipo_lancamento");
    return `${reference ?? launchTypeLabel(launchType)} · ${studentName}`;
  }

  if (entry.tabela === "itens_avaliados") {
    const criterionId = getString(payload, "criterio_id");
    const criterionName =
      criterionId && context.criteria.get(criterionId) ? context.criteria.get(criterionId)!.nome
        : "Criterio avaliado";

    return `${criterionName} · ${studentName}`;
  }

  if (entry.tabela === "ausencias") {
    return `Ausência · ${studentName}`;
  }

  if (entry.tabela === "vinculos_professor_aluno") {
    const professorName = resolveProfessorName(
      resolveProfessorId(entry, payload, context),
      context
    );
    return `${studentName} · ${professorName}`;
  }

  return entry.registro_id ? `${entry.tabela} · ${entry.registro_id.slice(0, 8)}`
    : entry.tabela;
}

function buildSummary(entry: AuditHistoryRow, payload: JsonRecord, context: AuditContext) {
  const before = asRecord(entry.dados_antes);
  const after = asRecord(entry.dados_depois);
  const studentName = resolveStudentName(
    resolveEnrollmentId(entry, payload, context),
    context
  );

  if (entry.tabela === "avaliacoes") {
    const reference =
      getString(payload, "referencia") ??
      launchTypeLabel(getString(payload, "tipo_lancamento"));
    const originEvaluationId = getString(payload, "avaliacao_origem_id");
    const originEvaluation = resolveEvaluationRecord(originEvaluationId, context);
    const originReference = getString(asRecord(originEvaluation), "referencia");

    if (entry.acao === "INSERT") {
      if (originEvaluationId) {
        return `Nova revisão vinculada ${reference} para ${studentName}, derivada de ${originReference ?? "uma avaliação publicada anterior"}.`;
      }

      return `Novo lançamento ${reference} para ${studentName}.`;
    }

    if (entry.acao === "DELETE") {
      return `Lançamento ${reference} removido para ${studentName}.`;
    }

    return `Lançamento ${reference} atualizado para ${studentName}: ${buildFieldDiffSummary(before, after)}.`;
  }

  if (entry.tabela === "itens_avaliados") {
    const criterionId = getString(payload, "criterio_id");
    const criterionName =
      criterionId && context.criteria.get(criterionId) ? context.criteria.get(criterionId)!.nome
        : "critério avaliado";
    const score = getNumber(payload, "nota_bruta");

    if (entry.acao === "INSERT") {
      return `Novo item ${criterionName} com nota ${formatRawValue(score)} para ${studentName}.`;
    }

    if (entry.acao === "DELETE") {
      return `Item ${criterionName} removido do histórico de ${studentName}.`;
    }

    return `Item ${criterionName} atualizado para ${studentName}: ${buildFieldDiffSummary(before, after)}.`;
  }

  if (entry.tabela === "ausencias") {
    const hours = formatHourValue(getNumber(payload, "horas"));
    const justified = getBoolean(payload, "justificada");

    if (entry.acao === "INSERT") {
      return `Registro de ${hours ?? "0h"} ${justified ? "justificada" : "não justificada"} para ${studentName}.`;
    }

    if (entry.acao === "DELETE") {
      return `Registro de ausencia removido para ${studentName}.`;
    }

    return `Ausência atualizada para ${studentName}: ${buildFieldDiffSummary(before, after)}.`;
  }

  if (entry.tabela === "vinculos_professor_aluno") {
    const professorName = resolveProfessorName(
      resolveProfessorId(entry, payload, context),
      context
    );

    if (entry.acao === "INSERT") {
      return `Novo vínculo entre ${professorName} e ${studentName}.`;
    }

    if (entry.acao === "DELETE") {
      return `Vinculo removido entre ${professorName} e ${studentName}.`;
    }

    return `Vinculo atualizado entre ${professorName} e ${studentName}: ${buildFieldDiffSummary(before, after)}.`;
  }

  return `Evento em ${entry.tabela}: ${buildFieldDiffSummary(before, after)}.`;
}

export async function loadUnitAuditFeed(input: {
  supabase: SupabaseDatabaseClient;
  unitId: string;
  limit?: number;
  filters?: {
    startDate?: string | string[] | null;
    endDate?: string | string[] | null;
    areaId?: string | string[] | null;
  };
}): Promise<UnitAuditFeed> {
  const filters = buildUnitAuditFilterState(input.filters);
  const limit = input.limit ?? 200;
  const semesterRowsResult = await input.supabase
    .from("semestres")
    .select("*")
    .eq("unidade_id", input.unitId)
    .order("data_inicio", { ascending: false });

  if (semesterRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os semestres da unidade para a auditoria.",
        semesterRowsResult.error
      )
    );
  }

  const semesterRows = (semesterRowsResult.data ?? []) as SemesterRow[];
  const visibleSemesterIds = new Set(semesterRows.map((semester) => semester.id));
  const classRowsResult = semesterRows.length
    ? await input.supabase
        .from("turmas")
        .select("*")
        .in(
          "semestre_id",
          semesterRows.map((semester) => semester.id)
        )
    : { data: [], error: null };

  if (classRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as turmas da unidade para a auditoria.",
        classRowsResult.error
      )
    );
  }

  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const areaIds = [
    ...new Set(classRows.map((classGroup) => classGroup.area_estagio_id).filter(Boolean))
  ] as string[];
  const areaRowsResult = areaIds.length
    ? await input.supabase
        .from("areas_estagio")
        .select("id, nome, bloco_id")
        .in("id", areaIds)
    : { data: [], error: null };

  if (areaRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as áreas de estágio da unidade para a auditoria.",
        areaRowsResult.error
      )
    );
  }

  const areaRows = (areaRowsResult.data ?? []) as Array<
    Pick<AreaRow, "id" | "nome" | "bloco_id">
  >;
  const blockIds = [...new Set(areaRows.map((area) => area.bloco_id))];
  const blockRowsResult = blockIds.length
    ? await input.supabase
        .from("blocos_estagio")
        .select("id, nome")
        .in("id", blockIds)
    : { data: [], error: null };

  if (blockRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os blocos das áreas de estágio da unidade.",
        blockRowsResult.error
      )
    );
  }

  const blockNameMap = new Map(
    (((blockRowsResult.data ?? []) as Array<Pick<BlockRow, "id" | "nome">>)).map(
      (block) => [block.id, block.nome]
    )
  );
  const areaMap = new Map(
    areaRows.map((area) => [
      area.id,
      {
        id: area.id,
        name: area.nome,
        blockName: blockNameMap.get(area.bloco_id) ?? "Bloco não identificado"
      } satisfies UnitAuditAreaOption
    ])
  );
  const areaOptions = [...areaMap.values()].sort((left, right) => {
    const nameDifference = left.name.localeCompare(right.name, "pt-BR");

    if (nameDifference !== 0) {
      return nameDifference;
    }

    return left.blockName.localeCompare(right.blockName, "pt-BR");
  });

  const auditRowsLoadResult = await loadAuditRowsForUnit({
    supabase: input.supabase,
    unitId: input.unitId,
    limit,
    filters
  });

  if (auditRowsLoadResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Houve um problema ao consultar os eventos reais de public.historico_alteracoes.",
        auditRowsLoadResult.error
      )
    );
  }

  if (auditRowsLoadResult.warning) {
    console.warn(auditRowsLoadResult.warning);
  }

  const auditRows = auditRowsLoadResult.rows;

  if (!auditRows.length) {
    return {
      entries: [],
      areaOptions,
      filters,
      semesterRows,
      classRows
    };
  }

  const actorIds = [
    ...new Set(auditRows.map((entry) => entry.usuario_id).filter(Boolean))
  ] as string[];
  const evaluationSnapshots = new Map<string, JsonRecord>();
  const evaluationIds = new Set<string>();
  const enrollmentIds = new Set<string>();
  const criterionIds = new Set<string>();
  const professorIds = new Set<string>();

  for (const entry of auditRows) {
    const payload = pickAuditPayload(entry);

    if (entry.tabela === "avaliacoes" && entry.registro_id) {
      evaluationSnapshots.set(entry.registro_id, payload);
      evaluationIds.add(entry.registro_id);
    }

    if (entry.tabela === "matriculas_turma") {
      const directEnrollmentId = getString(payload, "id") ?? entry.registro_id ?? undefined;

      if (directEnrollmentId) {
        enrollmentIds.add(directEnrollmentId);
      }
    }

    const directEnrollmentId = resolveEnrollmentId(
      entry,
      payload,
      {
        actorUsers: new Map(),
        professorUsers: new Map(),
        semesters: new Map(),
        classes: new Map(),
        studentRows: new Map(),
        studentUsers: new Map(),
        enrollments: new Map(),
        evaluations: new Map(),
        evaluationSnapshots,
        criteria: new Map(),
        areas: new Map()
      }
    );

    if (directEnrollmentId) {
      enrollmentIds.add(directEnrollmentId);
    }

    const directProfessorId = getString(payload, "professor_id");

    if (directProfessorId) {
      professorIds.add(directProfessorId);
    }

    const evaluationId = getString(payload, "avaliacao_id");

    if (evaluationId) {
      evaluationIds.add(evaluationId);
    }

    const criterionId = getString(payload, "criterio_id");

    if (criterionId) {
      criterionIds.add(criterionId);
    }
  }

  const [actorUsersResult, evaluationRowsResult, criterionRowsResult] = await Promise.all([
    actorIds.length
      ? input.supabase.from("usuarios").select("*").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
    evaluationIds.size
      ? input.supabase.from("avaliacoes").select("*").in("id", [...evaluationIds])
      : Promise.resolve({ data: [], error: null }),
    criterionIds.size
      ? input.supabase.from("criterios_avaliacao").select("*").in("id", [...criterionIds])
      : Promise.resolve({ data: [], error: null })
  ]);

  if (actorUsersResult.error || evaluationRowsResult.error || criterionRowsResult.error) {
    throw new Error(
      "Os eventos foram encontrados, mas usuários, avaliações ou critérios relacionados não puderam ser consultados."
    );
  }

  const evaluationRows = (evaluationRowsResult.data ?? []) as EvaluationRow[];

  for (const evaluation of evaluationRows) {
    enrollmentIds.add(evaluation.matricula_turma_id);
    professorIds.add(evaluation.professor_id);
  }

  const [enrollmentRowsResult, professorUsersResult] = await Promise.all([
    enrollmentIds.size
      ? input.supabase.from("matriculas_turma").select("*").in("id", [...enrollmentIds])
      : Promise.resolve({ data: [], error: null }),
    professorIds.size
      ? input.supabase.from("usuarios").select("*").in("id", [...professorIds])
      : Promise.resolve({ data: [], error: null })
  ]);

  if (enrollmentRowsResult.error || professorUsersResult.error) {
    throw new Error(
      "Os eventos foram encontrados, mas faltou contexto de matrículas ou usuários docentes para a exibição."
    );
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const additionalClassIds = [
    ...new Set(enrollmentRows.map((enrollment) => enrollment.turma_id))
  ].filter((classId) => !classRows.some((classGroup) => classGroup.id === classId));
  const additionalClassRowsResult = additionalClassIds.length
    ? await input.supabase.from("turmas").select("*").in("id", additionalClassIds)
    : { data: [], error: null };

  if (additionalClassRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Os eventos foram encontrados, mas o contexto das turmas não pôde ser consultado.",
        additionalClassRowsResult.error
      )
    );
  }

  const allClassRows = [
    ...classRows,
    ...((additionalClassRowsResult.data ?? []) as ClassRow[])
  ];
  const studentIds = [...new Set(enrollmentRows.map((enrollment) => enrollment.aluno_id))];
  const [studentRowsResult, studentUsersResult] = await Promise.all([
    studentIds.length
      ? input.supabase.from("alunos").select("*").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? input.supabase.from("usuarios").select("*").in("id", studentIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (studentRowsResult.error || studentUsersResult.error) {
    throw new Error(
      "Os eventos foram encontrados, mas os dados de aluno vinculados às matrículas não puderam ser consultados."
    );
  }

  const context: AuditContext = {
    actorUsers: new Map(
      ((actorUsersResult.data ?? []) as UserRow[]).map((user) => [user.id, user])
    ),
    professorUsers: new Map(
      ((professorUsersResult.data ?? []) as UserRow[]).map((user) => [user.id, user])
    ),
    semesters: new Map(semesterRows.map((semester) => [semester.id, semester])),
    classes: new Map(allClassRows.map((classGroup) => [classGroup.id, classGroup])),
    studentRows: new Map(
      ((studentRowsResult.data ?? []) as StudentRow[]).map((student) => [
        student.usuario_id,
        student
      ])
    ),
    studentUsers: new Map(
      ((studentUsersResult.data ?? []) as UserRow[]).map((user) => [user.id, user])
    ),
    enrollments: new Map(enrollmentRows.map((enrollment) => [enrollment.id, enrollment])),
    evaluations: new Map(evaluationRows.map((evaluation) => [evaluation.id, evaluation])),
    evaluationSnapshots,
    criteria: new Map(
      ((criterionRowsResult.data ?? []) as CriterionRow[]).map((criterion) => [
        criterion.id,
        criterion
      ])
    ),
    areas: areaMap
  };

  const entries = auditRows
    .map((entry) => {
      const payload = pickAuditPayload(entry);
      const actor = entry.usuario_id ? context.actorUsers.get(entry.usuario_id) : null;
      const semesterId = resolveEntrySemesterId(entry, payload, context);
      const semester = semesterId ? context.semesters.get(semesterId) : null;
      const area = resolveEntryArea(entry, payload, context);

      return {
        id: String(entry.id),
        tableName: entry.tabela,
        action: entry.acao,
        actorId: entry.usuario_id ?? "sistema",
        actorName: actor?.nome_completo ?? "Sistema",
        happenedAt: entry.created_at,
        recordLabel: buildRecordLabel(entry, payload, context),
        summary: buildSummary(entry, payload, context),
        semesterId,
        semesterCode: semester?.codigo,
        areaId: area?.id ?? null,
        areaName: area?.name ?? null,
        blockName: area?.blockName ?? null
      } satisfies AuditEntry;
    })
    .filter((entry) => {
      if (!auditRowsLoadResult.scopedByUnit) {
        if (entry.semesterId && !visibleSemesterIds.has(entry.semesterId)) {
          return false;
        }

        if (!entry.semesterId) {
          return false;
        }
      }

      if (filters.areaId && entry.areaId !== filters.areaId) {
        return false;
      }

      return true;
    });

  return {
    entries,
    areaOptions,
    filters,
    semesterRows,
    classRows
  };
}

export async function getAuthenticatedAuditEntries(
  currentUser: SessionUser,
  requestedSemesterId?: string | null,
  requestedFilters?: {
    startDate?: string | string[] | null;
    endDate?: string | string[] | null;
    areaId?: string | string[] | null;
  }
): Promise<AuditPageLoadResult> {
  if (!currentUser.unitId) {
    return buildAuditEmptyState(
      "Unidade operacional não identificada",
      "O coordenador autenticado precisa estar vinculado a uma unidade para acessar a auditoria."
    );
  }

  const supabase = await createSupabaseServerClient();
  let auditFeed: UnitAuditFeed;

  try {
    auditFeed = await loadUnitAuditFeed({
      supabase,
      unitId: currentUser.unitId,
      limit: 200,
      filters: requestedFilters
    });
  } catch (error) {
    return buildAuditEmptyState(
      "Não foi possível carregar o histórico de auditoria",
      error instanceof Error
        ? error.message
        : "Houve um problema ao consultar os eventos reais de public.historico_alteracoes."
    );
  }

  const semesterRows = auditFeed.semesterRows;
  const visibleSemesterIds = new Set(semesterRows.map((semester) => semester.id));
  const closedSemesters = semesterRows
    .filter((semester) => semester.status === "encerrado")
    .map((semester) => ({
      id: semester.id,
      code: semester.codigo,
      name: semester.nome
    }));
  const selectedSemesterId = closedSemesters.some(
    (semester) => semester.id === requestedSemesterId
  )
    ? requestedSemesterId ?? null
    : null;
  const selectedSemester = selectedSemesterId
    ? semesterRows.find((semester) => semester.id === selectedSemesterId) ?? null
    : null;

  if (!auditFeed.entries.length) {
    const selectedClosedSemester = selectedSemester
      ? await buildClosedSemesterAuditView({
          semester: selectedSemester,
          fallbackAuditRows: []
        })
      : null;

    return {
      entries: [],
      areaOptions: auditFeed.areaOptions,
      filters: auditFeed.filters,
      closedSemesters,
      selectedSemesterId,
      selectedClosedSemester,
      emptyState: {
        title: "Nenhum evento auditavel encontrado",
        description:
          "Ainda não ha registros em public.historico_alteracoes para exibir nesta tela."
      }
    };
  }
  const selectedClosedSemester = selectedSemester
    ? await buildClosedSemesterAuditView({
        semester: selectedSemester,
        fallbackAuditRows: []
      })
    : null;

  const entries = auditFeed.entries.filter((entry) => {
    if (selectedSemesterId && entry.semesterId !== selectedSemesterId) {
      return false;
    }

    return entry.semesterId ? visibleSemesterIds.has(entry.semesterId) : true;
  });

  return {
    entries,
    areaOptions: auditFeed.areaOptions,
    filters: auditFeed.filters,
    closedSemesters,
    selectedSemesterId,
    selectedClosedSemester,
    emptyState: null
  };
}

export async function getAuthenticatedClosedSemesterAreaDetail(
  currentUser: SessionUser,
  semesterId: string,
  classId: string
): Promise<ClosedSemesterAreaAuditDetail | null> {
  if (!currentUser.unitId) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const [semesterResult, classResult, closureRowsResult] = await Promise.all([
    supabase
      .from("semestres")
      .select("*")
      .eq("id", semesterId)
      .eq("unidade_id", currentUser.unitId)
      .maybeSingle(),
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
    throw new Error(
      "Não foi possível consolidar o contexto da área arquivada."
    );
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
    throw new Error(
      "Não foi possível carregar os supervisores desta área arquivada."
    );
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const professorIds = uniqueStringValues(
    professorLinks.map((link) => link.professor_id)
  );
  const professorUsersResult = professorIds.length
    ? await supabase
        .from("usuarios")
        .select("id, nome_completo")
        .in("id", professorIds)
    : { data: [], error: null };

  if (professorUsersResult.error) {
    throw new Error(
      "Não foi possível carregar os responsáveis desta área arquivada."
    );
  }

  const areaMap = new Map(
    (((areaRowsResult.data ?? []) as Array<Pick<AreaRow, "id" | "nome" | "bloco_id">>)).map(
      (area) => [area.id, { nome: area.nome, blocoId: area.bloco_id }]
    )
  );
  const blockMap = new Map(
    (((blockRowsResult.data ?? []) as Array<Pick<BlockRow, "id" | "nome">>)).map(
      (block) => [block.id, block.nome]
    )
  );
  const professorNameMap = new Map(
    (((professorUsersResult.data ?? []) as Array<Pick<UserRow, "id" | "nome_completo">>)).map(
      (user) => [user.id, user.nome_completo]
    )
  );
  const linksByEnrollmentId = new Map<string, ProfessorLinkRow[]>();

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
      areaName: fallbackAreaName(classGroup, areaMap),
      blockName: fallbackBlockName(classGroup, areaMap, blockMap),
      supervisorNames
    }
  };
}




