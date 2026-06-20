import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import {
  loadScopedOperationalGraph,
  resolveScopedDataAccess
} from "@/lib/auth/data-scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadVisibleStageAreaCatalog } from "@/services/stage-areas";
import type { Database } from "@/types/database";
import type {
  SessionUser,
  StudentTce,
  TceConcedingPartyData,
  TceInternshipConfiguration,
  TceModel,
  TceScheduleData,
  TceStudentData,
  TceTermData
} from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type TceModelRow = Database["public"]["Tables"]["modelos_tce"]["Row"];
type TceConfigurationRow =
  Database["public"]["Tables"]["configuracoes_tce_estagio"]["Row"];
type StudentTceRow = Database["public"]["Tables"]["tces_aluno"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type TceConfigurationInsert =
  Database["public"]["Tables"]["configuracoes_tce_estagio"]["Insert"];
type TceConfigurationUpdate =
  Database["public"]["Tables"]["configuracoes_tce_estagio"]["Update"];

type TceQueryClient =
  | Awaited<ReturnType<typeof createSupabaseServerClient>>
  | ReturnType<typeof createSupabaseAdminClient>;

export class TceServiceError extends Error {
  constructor(
    readonly kind:
      | "database_not_ready"
      | "invalid_scope"
      | "missing_models"
      | "duplicate_active"
      | "ambiguous_configuration"
      | "validation"
      | "not_found",
    message: string,
    readonly fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "TceServiceError";
  }
}

export interface CoordinatorTceModelOption {
  id: string;
  name: string;
  code: string;
  description: string | null;
  templateVersion: string | null;
  scopeLabel: string;
  label: string;
}

export interface CoordinatorTceSemesterOption {
  id: string;
  code: string;
  name: string;
  label: string;
}

export interface CoordinatorTceClassOption {
  id: string;
  semesterId: string;
  areaId: string | null;
  code: string;
  name: string;
  active: boolean;
  label: string;
}

export interface CoordinatorTceAreaOption {
  id: string;
  code: string;
  name: string;
  blockName: string;
  label: string;
}

export interface CoordinatorTceConfigurationEntry
  extends Omit<
    TceInternshipConfiguration,
    | "modelId"
    | "offerId"
    | "classId"
    | "stageAreaId"
    | "termData"
    | "scheduleData"
    | "concedingPartyData"
  > {
  modelId: string;
  modelName: string;
  modelCode: string;
  offerId: string;
  offerName: string | null;
  semesterLabel: string | null;
  classId: string | null;
  classLabel: string | null;
  stageAreaId: string;
  stageAreaName: string;
  blockName: string | null;
  termData: TceTermData;
  scheduleData: TceScheduleData;
  concedingPartyData: TceConcedingPartyData;
}

export interface CoordinatorTcePageData {
  courseId: string;
  courseName: string;
  institutionId: string;
  offerId: string;
  offerName: string | null;
  unitId: string | null;
  unitName: string | null;
  modelOptions: CoordinatorTceModelOption[];
  missingModelMessage: string | null;
  areaOptions: CoordinatorTceAreaOption[];
  semesterOptions: CoordinatorTceSemesterOption[];
  classOptions: CoordinatorTceClassOption[];
  configurations: CoordinatorTceConfigurationEntry[];
}

export interface CoordinatorTcePageLoadResult {
  pageData: CoordinatorTcePageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface StudentTceAvailableEntry {
  entryKey: string;
  configuration: TceInternshipConfiguration;
  model: TceModel;
  enrollmentId: string;
  classId: string;
  className: string;
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  curricularPeriod: number | null;
  areaId: string;
  areaName: string;
  blockName: string | null;
  offerId: string;
  offerName: string | null;
  courseName: string;
  institutionName: string | null;
  unitName: string | null;
  professorNames: string[];
  label: string;
  helperText: string;
  savedTce: StudentTce | null;
  initialStudentData: TceStudentData;
}

export interface StudentTcePageData {
  student: {
    id: string;
    name: string;
    registration: string;
    email: string;
    phone: string | null;
    courseName: string;
    institutionName: string | null;
    unitName: string | null;
  };
  availableTces: StudentTceAvailableEntry[];
  warnings: string[];
}

export interface StudentTcePageLoadResult {
  pageData: StudentTcePageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface SaveStudentTceDataInput {
  configurationId: string;
  enrollmentId: string;
  areaId: string;
  studentData: TceStudentData;
}

export interface SaveTceConfigurationInput {
  modelId: string;
  name: string;
  areaId: string;
  semesterId: string | null;
  classId: string | null;
  active: boolean;
  concedingPartyData: TceConcedingPartyData;
  termData: TceTermData;
  scheduleData: TceScheduleData;
  dailyWorkload: string | null;
  weeklyWorkload: string | null;
  semesterWorkload: string | null;
  activityPlan: string | null;
  signatureCity: string | null;
  signatureDate: string | null;
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim())))
  );
}

function uniqueNumberValues(values: Array<number | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is number => typeof value === "number"))
  );
}

function buildEmptyState(title: string, description: string): CoordinatorTcePageLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function isMissingTceModuleRelationError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";

  return (
    code === "42P01" ||
    /modelos_tce|configuracoes_tce_estagio|tces_aluno/i.test(message)
  );
}

function buildTceModuleSetupError() {
  return buildEmptyState(
    "Módulo de TCE indisponível",
    "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente. Aplique o script-15 do TCE gerador antes de usar esta tela."
  );
}

function toOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length ? normalizedValue : null;
}

function toJsonRecord(value: Record<string, unknown>) {
  return value;
}

function toConcedingPartyData(value: unknown): TceConcedingPartyData {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    corporateName: toOptionalText(data.corporateName),
    documentNumber: toOptionalText(data.documentNumber),
    address: toOptionalText(data.address),
    addressNumber: toOptionalText(data.addressNumber),
    addressComplement: toOptionalText(data.addressComplement),
    neighborhood: toOptionalText(data.neighborhood),
    city: toOptionalText(data.city),
    state: toOptionalText(data.state),
    postalCode: toOptionalText(data.postalCode),
    phone: toOptionalText(data.phone),
    email: toOptionalText(data.email),
    internshipLocation: toOptionalText(data.internshipLocation),
    internshipLocationAddress: toOptionalText(data.internshipLocationAddress),
    internshipLocationNumber: toOptionalText(data.internshipLocationNumber),
    internshipLocationComplement: toOptionalText(data.internshipLocationComplement),
    internshipLocationNeighborhood: toOptionalText(data.internshipLocationNeighborhood),
    internshipLocationCity: toOptionalText(data.internshipLocationCity),
    internshipLocationState: toOptionalText(data.internshipLocationState),
    internshipLocationPostalCode: toOptionalText(data.internshipLocationPostalCode),
    internshipLocationPhone: toOptionalText(data.internshipLocationPhone),
    internshipLocationEmail: toOptionalText(data.internshipLocationEmail),
    responsibleName: toOptionalText(data.responsibleName),
    responsibleDocument: toOptionalText(data.responsibleDocument),
    professionalCouncil: toOptionalText(data.professionalCouncil)
  };
}

function toTermData(value: unknown): TceTermData {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    startsAt: toOptionalText(data.startsAt),
    endsAt: toOptionalText(data.endsAt)
  };
}

function toScheduleDayData(value: unknown) {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    startTime: toOptionalText(data.startTime),
    endTime: toOptionalText(data.endTime),
    breakStartTime: toOptionalText(data.breakStartTime),
    breakEndTime: toOptionalText(data.breakEndTime)
  };
}

function toScheduleData(value: unknown): TceScheduleData {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    monday: toScheduleDayData(data.monday),
    tuesday: toScheduleDayData(data.tuesday),
    wednesday: toScheduleDayData(data.wednesday),
    thursday: toScheduleDayData(data.thursday),
    friday: toScheduleDayData(data.friday),
    saturday: toScheduleDayData(data.saturday)
  };
}

function buildModelScopeLabel(input: {
  row: Pick<TceModelRow, "instituicao_id" | "curso_id">;
  institutionName: string | null;
  courseName: string | null;
}) {
  if (input.row.curso_id) {
    return input.courseName ? `Curso: ${input.courseName}` : "Curso específico";
  }

  if (input.row.instituicao_id) {
    return input.institutionName
      ? `Instituição: ${input.institutionName}`
      : "Instituição específica";
  }

  return "Base global";
}

function buildClassLabel(input: {
  classRow: Pick<ClassRow, "codigo" | "nome" | "ativa" | "area_estagio_id" | "semestre_id">;
  semesterMap: Map<string, SemesterRow>;
  areaMap: Map<string, AreaRow>;
}) {
  const semester = input.semesterMap.get(input.classRow.semestre_id) ?? null;
  const area = input.classRow.area_estagio_id
    ? input.areaMap.get(input.classRow.area_estagio_id) ?? null
    : null;
  const labelParts = [semester?.codigo ?? null, area?.nome ?? null, input.classRow.nome];

  return labelParts.filter((part): part is string => Boolean(part)).join(" - ");
}

async function resolveCoordinatorTceScope(currentUser: SessionUser) {
  if (getActiveMasterCourseContext(currentUser)) {
    throw new TceServiceError(
      "invalid_scope",
      "Use um contexto de coordenador local para configurar os TCEs da oferta."
    );
  }

  const scope = await resolveScopedDataAccess(currentUser);

  if (
    scope.scopeKind === "none" ||
    !scope.instituicaoId ||
    !scope.cursoId ||
    (!scope.ofertaCursoUnidadeId && scope.offerIds.length === 0)
  ) {
    throw new TceServiceError(
      "invalid_scope",
      "O coordenador autenticado precisa estar vinculado a uma oferta ativa para configurar TCEs."
    );
  }

  const activeOfferId =
    scope.ofertaCursoUnidadeId ?? (scope.offerIds.length === 1 ? scope.offerIds[0] : null);

  if (!activeOfferId) {
    throw new TceServiceError(
      "invalid_scope",
      "Não foi possível identificar a oferta ativa do coordenador para configurar os TCEs."
    );
  }

  return {
    scope,
    instituicaoId: scope.instituicaoId,
    courseId: scope.cursoId,
    offerId: activeOfferId,
    unitId: scope.unidadeId ?? scope.unitIds[0] ?? null
  };
}

async function loadCoordinatorTceResourceCatalog(input: { currentUser: SessionUser }) {
  const serverClient = await createSupabaseServerClient();
  const resolvedScope = await resolveCoordinatorTceScope(input.currentUser);
  const scopedGraph = await loadScopedOperationalGraph(input.currentUser, {
    supabase: serverClient
  });
  const { data: offerRowsData, error: offerRowsError } = await serverClient
    .from("ofertas_curso_unidade")
    .select("*")
    .in("id", uniqueStringValues([resolvedScope.offerId, ...resolvedScope.scope.offerIds]));

  if (offerRowsError) {
    throw new TceServiceError(
      "invalid_scope",
      "Houve um problema ao consultar a oferta ativa do coordenador."
    );
  }

  const offerRows = (offerRowsData ?? []) as OfferRow[];
  const activeOfferRow = offerRows.find((offerRow) => offerRow.id === resolvedScope.offerId) ?? null;

  if (!activeOfferRow) {
    throw new TceServiceError(
      "invalid_scope",
      "A oferta ativa do coordenador não foi encontrada."
    );
  }

  const areaCatalog = await loadVisibleStageAreaCatalog({
    supabase: serverClient,
    scope: resolvedScope.scope,
    offerRows,
    visibleClassRows: scopedGraph.classRows
  });

  const scopedSemesterRows = scopedGraph.semesterRows
    .filter((semesterRow) => semesterRow.oferta_curso_unidade_id === resolvedScope.offerId)
    .sort(
      (left, right) =>
        new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime()
    );
  const scopedSemesterIds = new Set(scopedSemesterRows.map((semesterRow) => semesterRow.id));
  const scopedClassRows = scopedGraph.classRows
    .filter((classRow) => scopedSemesterIds.has(classRow.semestre_id))
    .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));

  return {
    ...resolvedScope,
    activeOfferRow,
    areaRows: areaCatalog.areaRows,
    semesterRows: scopedSemesterRows,
    classRows: scopedClassRows
  };
}

async function queryAvailableTceModels(input: {
  client: TceQueryClient;
  instituicaoId: string;
  courseId: string;
}) {
  const { data, error } = await input.client
    .from("modelos_tce")
    .select("*")
    .eq("ativo", true);

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    throw new Error("Houve um problema ao consultar os modelos de TCE disponíveis.");
  }

  return ((data ?? []) as TceModelRow[])
    .filter((row) => {
      if (row.curso_id) {
        return row.curso_id === input.courseId;
      }

      if (row.instituicao_id) {
        return row.instituicao_id === input.instituicaoId;
      }

      return true;
    })
    .sort((left, right) => {
      const specificityWeight = (row: Pick<TceModelRow, "curso_id" | "instituicao_id">) => {
        if (row.curso_id) {
          return 2;
        }

        if (row.instituicao_id) {
          return 1;
        }

        return 0;
      };

      const specificityDifference = specificityWeight(right) - specificityWeight(left);

      if (specificityDifference !== 0) {
        return specificityDifference;
      }

      return left.nome.localeCompare(right.nome, "pt-BR");
    });
}

async function loadActiveCourseRow(input: {
  client: TceQueryClient;
  courseId: string;
}) {
  const { data, error } = await input.client
    .from("cursos")
    .select("*")
    .eq("id", input.courseId)
    .maybeSingle();

  if (error) {
    throw new Error("Houve um problema ao consultar os dados do curso ativo do TCE.");
  }

  return (data ?? null) as CourseRow | null;
}

async function loadActiveUnitRow(input: {
  client: TceQueryClient;
  unitId: string | null;
}) {
  if (!input.unitId) {
    return null;
  }

  const { data, error } = await input.client
    .from("unidades")
    .select("*")
    .eq("id", input.unitId)
    .maybeSingle();

  if (error) {
    throw new Error("Houve um problema ao consultar os dados da unidade ativa do TCE.");
  }

  return (data ?? null) as UnitRow | null;
}

async function loadInstitutionRow(input: {
  client: TceQueryClient;
  institutionId: string | null;
}) {
  if (!input.institutionId) {
    return null;
  }

  const { data, error } = await input.client
    .from("instituicoes")
    .select("*")
    .eq("id", input.institutionId)
    .maybeSingle();

  if (error) {
    throw new Error("Houve um problema ao consultar os dados da instituição do TCE.");
  }

  return (data ?? null) as InstitutionRow | null;
}

function mapModelRowsToOptions(input: {
  modelRows: TceModelRow[];
  institutionName: string | null;
  courseName: string | null;
}): CoordinatorTceModelOption[] {
  return input.modelRows.map((row) => {
    const scopeLabel = buildModelScopeLabel({
      row,
      institutionName: input.institutionName,
      courseName: input.courseName
    });

    return {
      id: row.id,
      name: row.nome,
      code: row.codigo,
      description: row.descricao,
      templateVersion: row.template_version,
      scopeLabel,
      label: `${row.nome} - ${scopeLabel}`
    } satisfies CoordinatorTceModelOption;
  });
}

function mapConfigurationRowToEntry(input: {
  row: TceConfigurationRow;
  offerRow: OfferRow | null;
  areaMap: Map<string, AreaRow>;
  semesterMap: Map<string, SemesterRow>;
  classMap: Map<string, ClassRow>;
  modelMap: Map<string, TceModelRow>;
  courseName: string;
}) {
  const modelRow = input.modelMap.get(input.row.modelo_tce_id) ?? null;
  const areaRow = input.areaMap.get(input.row.area_estagio_id) ?? null;
  const semesterRow = input.row.semestre_id
    ? input.semesterMap.get(input.row.semestre_id) ?? null
    : null;
  const classRow = input.row.turma_id ? input.classMap.get(input.row.turma_id) ?? null : null;

  return {
    id: input.row.id,
    modelId: input.row.modelo_tce_id,
    modelName: modelRow?.nome ?? "Modelo indisponível",
    modelCode: modelRow?.codigo ?? "modelo_indisponivel",
    courseId: input.row.curso_id,
    offerId: input.row.oferta_curso_unidade_id,
    offerName: input.offerRow?.nome_exibicao ?? null,
    classId: input.row.turma_id,
    classLabel: classRow
      ? buildClassLabel({
          classRow,
          semesterMap: input.semesterMap,
          areaMap: input.areaMap
        })
      : null,
    stageAreaId: input.row.area_estagio_id,
    stageAreaName: areaRow?.nome ?? "Área indisponível",
    blockName: areaRow ? `Bloco ${areaRow.bloco_id}` : null,
    name: input.row.nome,
    active: input.row.ativo,
    concedingPartyData: toConcedingPartyData(input.row.dados_concedente),
    termData: toTermData(input.row.dados_vigencia),
    scheduleData: toScheduleData(input.row.dados_horario),
    dailyWorkload: input.row.jornada_diaria,
    weeklyWorkload: input.row.jornada_semanal,
    semesterWorkload: input.row.jornada_semestral,
    activityPlan: input.row.plano_atividades,
    signatureCity: input.row.cidade_assinatura,
    signatureDate: input.row.data_assinatura,
    createdBy: input.row.created_by,
    updatedBy: input.row.updated_by,
    metadata: input.row.metadata,
    createdAt: input.row.created_at,
    updatedAt: input.row.updated_at,
    semesterId: input.row.semestre_id,
    semesterLabel: semesterRow
      ? `${semesterRow.codigo} - ${semesterRow.nome}`
      : null
  } satisfies CoordinatorTceConfigurationEntry;
}

async function ensureExistingConfigurationInScope(input: {
  configurationId: string;
  currentUser: SessionUser;
  client?: TceQueryClient;
}) {
  const client = input.client ?? createSupabaseAdminClient();
  const scopeData = await loadCoordinatorTceResourceCatalog({
    currentUser: input.currentUser
  });
  const { data, error } = await client
    .from("configuracoes_tce_estagio")
    .select("*")
    .eq("id", input.configurationId)
    .maybeSingle();

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    throw new Error("Houve um problema ao consultar a configuração de TCE informada.");
  }

  const configurationRow = (data ?? null) as TceConfigurationRow | null;

  if (!configurationRow || configurationRow.oferta_curso_unidade_id !== scopeData.offerId) {
    throw new TceServiceError(
      "not_found",
      "A configuração de TCE informada não pertence ao escopo da oferta atual."
    );
  }

  return {
    scopeData,
    configurationRow
  };
}

function normalizeSignatureDate(value: string | null) {
  return value && value.trim().length ? value : null;
}

function buildConfigurationPayload(input: {
  scopeData: Awaited<ReturnType<typeof loadCoordinatorTceResourceCatalog>>;
  currentUser: SessionUser;
  data: SaveTceConfigurationInput;
  mode: "create" | "update";
}) {
  const semesterMap = new Map(
    input.scopeData.semesterRows.map((semesterRow) => [semesterRow.id, semesterRow])
  );
  const classMap = new Map(input.scopeData.classRows.map((classRow) => [classRow.id, classRow]));
  const areaMap = new Map(input.scopeData.areaRows.map((areaRow) => [areaRow.id, areaRow]));

  if (!areaMap.has(input.data.areaId)) {
    throw new TceServiceError(
      "validation",
      "Selecione uma área de estágio válida da oferta atual.",
      { area_estagio_id: "Selecione uma área de estágio válida." }
    );
  }

  let resolvedSemesterId = input.data.semesterId;
  let resolvedClassId = input.data.classId;

  if (resolvedSemesterId && !semesterMap.has(resolvedSemesterId)) {
    throw new TceServiceError(
      "validation",
      "Selecione um semestre acadêmico válido da oferta atual.",
      { semestre_id: "Selecione um semestre válido." }
    );
  }

  const selectedClass = resolvedClassId ? classMap.get(resolvedClassId) ?? null : null;

  if (resolvedClassId && !selectedClass) {
    throw new TceServiceError(
      "validation",
      "Selecione uma turma válida da oferta atual.",
      { turma_id: "Selecione uma turma válida." }
    );
  }

  if (selectedClass) {
    if (!resolvedSemesterId) {
      resolvedSemesterId = selectedClass.semestre_id;
    } else if (selectedClass.semestre_id !== resolvedSemesterId) {
      throw new TceServiceError(
        "validation",
        "A turma selecionada não pertence ao semestre informado.",
        { turma_id: "A turma não pertence ao semestre selecionado." }
      );
    }

    if (selectedClass.area_estagio_id && selectedClass.area_estagio_id !== input.data.areaId) {
      throw new TceServiceError(
        "validation",
        "A turma selecionada não pertence à área de estágio informada.",
        { turma_id: "A turma não pertence à área selecionada." }
      );
    }
  }

  const payload = {
    modelo_tce_id: input.data.modelId,
    curso_id: input.scopeData.courseId,
    oferta_curso_unidade_id: input.scopeData.offerId,
    semestre_id: resolvedSemesterId,
    turma_id: resolvedClassId,
    area_estagio_id: input.data.areaId,
    nome: input.data.name.trim(),
    ativo: input.data.active,
    dados_concedente: toJsonRecord(
      input.data.concedingPartyData as Record<string, unknown>
    ),
    dados_vigencia: toJsonRecord(input.data.termData as Record<string, unknown>),
    dados_horario: toJsonRecord(input.data.scheduleData as Record<string, unknown>),
    jornada_diaria: toOptionalText(input.data.dailyWorkload),
    jornada_semanal: toOptionalText(input.data.weeklyWorkload),
    jornada_semestral: toOptionalText(input.data.semesterWorkload),
    plano_atividades: toOptionalText(input.data.activityPlan),
    cidade_assinatura: toOptionalText(input.data.signatureCity),
    data_assinatura: normalizeSignatureDate(input.data.signatureDate),
    updated_by: input.currentUser.id
  } satisfies TceConfigurationInsert;

  if (input.mode === "create") {
    return {
      ...payload,
      created_by: input.currentUser.id,
      metadata: {}
    } satisfies TceConfigurationInsert;
  }

  return payload satisfies TceConfigurationUpdate;
}

async function ensureAllowedModelSelection(input: {
  currentUser: SessionUser;
  modelId: string;
  client: TceQueryClient;
}) {
  const scopeData = await loadCoordinatorTceResourceCatalog({
    currentUser: input.currentUser
  });
  const availableModelRows = await queryAvailableTceModels({
    client: input.client,
    instituicaoId: scopeData.instituicaoId,
    courseId: scopeData.courseId
  });

  if (!availableModelRows.length) {
    throw new TceServiceError(
      "missing_models",
      "Nenhum modelo de TCE ativo foi encontrado. Cadastre ou habilite um modelo de TCE antes de criar configurações.",
      {
        modelo_tce_id:
          "Nenhum modelo de TCE ativo foi encontrado para esta oferta."
      }
    );
  }

  if (!availableModelRows.some((modelRow) => modelRow.id === input.modelId)) {
    throw new TceServiceError(
      "validation",
      "Selecione um modelo de TCE ativo disponível para este curso.",
      { modelo_tce_id: "Selecione um modelo de TCE válido." }
    );
  }

  return {
    scopeData,
    availableModelRows
  };
}

async function ensureNoActiveScopeDuplicate(input: {
  client: ReturnType<typeof createSupabaseAdminClient>;
  offerId: string;
  areaId: string;
  semesterId: string | null;
  classId: string | null;
  excludeId?: string;
}) {
  let query = input.client
    .from("configuracoes_tce_estagio")
    .select("id")
    .eq("oferta_curso_unidade_id", input.offerId)
    .eq("area_estagio_id", input.areaId)
    .eq("ativo", true);

  query = input.semesterId
    ? query.eq("semestre_id", input.semesterId)
    : query.is("semestre_id", null);
  query = input.classId ? query.eq("turma_id", input.classId) : query.is("turma_id", null);

  if (input.excludeId) {
    query = query.neq("id", input.excludeId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    throw new Error("Houve um problema ao validar duplicidade ativa da configuração de TCE.");
  }

  if ((data ?? []).length > 0) {
    throw new TceServiceError(
      "duplicate_active",
      "Já existe uma configuração ativa de TCE para esta combinação de oferta, área, semestre e turma.",
      {
        area_estagio_id:
          "Já existe uma configuração ativa de TCE para este escopo.",
        semestre_id:
          "Já existe uma configuração ativa de TCE para este escopo.",
        turma_id:
          "Já existe uma configuração ativa de TCE para este escopo."
      }
    );
  }
}

export async function loadAvailableTceModels(currentUser: SessionUser) {
  const scopeData = await loadCoordinatorTceResourceCatalog({ currentUser });
  const serverClient = await createSupabaseServerClient();
  const courseRow = await loadActiveCourseRow({
    client: serverClient,
    courseId: scopeData.courseId
  });
  const modelRows = await queryAvailableTceModels({
    client: serverClient,
    instituicaoId: scopeData.instituicaoId,
    courseId: scopeData.courseId
  });

  return mapModelRowsToOptions({
    modelRows,
    institutionName: null,
    courseName: courseRow?.nome ?? null
  });
}

export async function loadCoordinatorTceConfigurations(currentUser: SessionUser) {
  const scopeData = await loadCoordinatorTceResourceCatalog({ currentUser });
  const serverClient = await createSupabaseServerClient();
  const { data, error } = await serverClient
    .from("configuracoes_tce_estagio")
    .select("*")
    .eq("oferta_curso_unidade_id", scopeData.offerId)
    .order("ativo", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    throw new Error("Houve um problema ao consultar as configurações de TCE da oferta.");
  }

  const courseRow = await loadActiveCourseRow({
    client: serverClient,
    courseId: scopeData.courseId
  });
  const modelRows = await queryAvailableTceModels({
    client: serverClient,
    instituicaoId: scopeData.instituicaoId,
    courseId: scopeData.courseId
  });
  const areaMap = new Map(scopeData.areaRows.map((areaRow) => [areaRow.id, areaRow]));
  const semesterMap = new Map(
    scopeData.semesterRows.map((semesterRow) => [semesterRow.id, semesterRow])
  );
  const classMap = new Map(scopeData.classRows.map((classRow) => [classRow.id, classRow]));
  const modelMap = new Map(modelRows.map((modelRow) => [modelRow.id, modelRow]));

  return ((data ?? []) as TceConfigurationRow[])
    .map((row) =>
      mapConfigurationRowToEntry({
        row,
        offerRow: scopeData.activeOfferRow,
        areaMap,
        semesterMap,
        classMap,
        modelMap,
        courseName: courseRow?.nome ?? scopeData.courseId
      })
    )
    .sort((left, right) => {
      const activeDifference = Number(right.active) - Number(left.active);

      if (activeDifference !== 0) {
        return activeDifference;
      }

      const areaDifference = left.stageAreaName.localeCompare(right.stageAreaName, "pt-BR");

      if (areaDifference !== 0) {
        return areaDifference;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });
}

export async function loadTceConfigurationById(
  currentUser: SessionUser,
  configurationId: string
) {
  const serverClient = await createSupabaseServerClient();
  const { scopeData, configurationRow } = await ensureExistingConfigurationInScope({
    configurationId,
    currentUser,
    client: serverClient
  });
  const courseRow = await loadActiveCourseRow({
    client: serverClient,
    courseId: scopeData.courseId
  });
  const modelRows = await queryAvailableTceModels({
    client: serverClient,
    instituicaoId: scopeData.instituicaoId,
    courseId: scopeData.courseId
  });
  const areaMap = new Map(scopeData.areaRows.map((areaRow) => [areaRow.id, areaRow]));
  const semesterMap = new Map(
    scopeData.semesterRows.map((semesterRow) => [semesterRow.id, semesterRow])
  );
  const classMap = new Map(scopeData.classRows.map((classRow) => [classRow.id, classRow]));
  const modelMap = new Map(modelRows.map((modelRow) => [modelRow.id, modelRow]));

  return mapConfigurationRowToEntry({
    row: configurationRow,
    offerRow: scopeData.activeOfferRow,
    areaMap,
    semesterMap,
    classMap,
    modelMap,
    courseName: courseRow?.nome ?? scopeData.courseId
  });
}

export async function loadCoordinatorTcePageData(
  currentUser: SessionUser
): Promise<CoordinatorTcePageLoadResult> {
  try {
    const scopeData = await loadCoordinatorTceResourceCatalog({ currentUser });
    const serverClient = await createSupabaseServerClient();
    const [courseRow, unitRow, configurations, modelRows] = await Promise.all([
      loadActiveCourseRow({
        client: serverClient,
        courseId: scopeData.courseId
      }),
      loadActiveUnitRow({
        client: serverClient,
        unitId: scopeData.unitId
      }),
      loadCoordinatorTceConfigurations(currentUser),
      queryAvailableTceModels({
        client: serverClient,
        instituicaoId: scopeData.instituicaoId,
        courseId: scopeData.courseId
      })
    ]);

    const areaOptions = scopeData.areaRows.map((areaRow) => ({
      id: areaRow.id,
      code: areaRow.codigo,
      name: areaRow.nome,
      blockName: `Bloco ${areaRow.bloco_id}`,
      label: areaRow.nome
    }));
    const semesterOptions = scopeData.semesterRows.map((semesterRow) => ({
      id: semesterRow.id,
      code: semesterRow.codigo,
      name: semesterRow.nome,
      label: `${semesterRow.codigo} - ${semesterRow.nome}`
    }));
    const areaMap = new Map(scopeData.areaRows.map((areaRow) => [areaRow.id, areaRow]));
    const semesterMap = new Map(
      scopeData.semesterRows.map((semesterRow) => [semesterRow.id, semesterRow])
    );
    const classOptions = scopeData.classRows.map((classRow) => ({
      id: classRow.id,
      semesterId: classRow.semestre_id,
      areaId: classRow.area_estagio_id,
      code: classRow.codigo,
      name: classRow.nome,
      active: classRow.ativa,
      label: buildClassLabel({
        classRow,
        semesterMap,
        areaMap
      })
    }));
    const modelOptions = mapModelRowsToOptions({
      modelRows,
      institutionName: null,
      courseName: courseRow?.nome ?? null
    });

    return {
      pageData: {
        courseId: scopeData.courseId,
        courseName: courseRow?.nome ?? "Curso indisponível",
        institutionId: scopeData.instituicaoId,
        offerId: scopeData.offerId,
        offerName: scopeData.activeOfferRow.nome_exibicao,
        unitId: scopeData.unitId,
        unitName: unitRow?.nome ?? null,
        modelOptions,
        missingModelMessage: modelOptions.length
          ? null
          : "Nenhum modelo de TCE ativo foi encontrado. Cadastre ou habilite um modelo de TCE antes de criar configurações.",
        areaOptions,
        semesterOptions,
        classOptions,
        configurations
      },
      emptyState: null
    };
  } catch (error) {
    if (
      error instanceof TceServiceError &&
      error.kind === "database_not_ready"
    ) {
      return buildTceModuleSetupError();
    }

    if (error instanceof TceServiceError && error.kind === "invalid_scope") {
      return buildEmptyState("Contexto de TCE não identificado", error.message);
    }

    return buildEmptyState(
      "Não foi possível carregar os TCEs",
      "Houve um problema ao consultar os modelos, áreas e configurações de TCE da oferta atual."
    );
  }
}

export async function createTceConfiguration(
  currentUser: SessionUser,
  input: SaveTceConfigurationInput
) {
  const adminClient = createSupabaseAdminClient();
  const { scopeData } = await ensureAllowedModelSelection({
    currentUser,
    modelId: input.modelId,
    client: adminClient
  });
  const payload = buildConfigurationPayload({
    scopeData,
    currentUser,
    data: input,
    mode: "create"
  }) as TceConfigurationInsert;

  if (payload.ativo) {
    await ensureNoActiveScopeDuplicate({
      client: adminClient,
      offerId: payload.oferta_curso_unidade_id,
      areaId: payload.area_estagio_id,
      semesterId: payload.semestre_id ?? null,
      classId: payload.turma_id ?? null
    });
  }

  const { data, error } = await adminClient
    .from("configuracoes_tce_estagio")
    .insert(payload as never)
    .select("*")
    .single();

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
      throw new TceServiceError(
        "duplicate_active",
        "Já existe uma configuração ativa de TCE para esta combinação de oferta, área, semestre e turma."
      );
    }

    throw new Error("Houve um problema ao criar a configuração de TCE.");
  }

  return data as TceConfigurationRow;
}

export async function updateTceConfiguration(
  currentUser: SessionUser,
  configurationId: string,
  input: SaveTceConfigurationInput
) {
  const adminClient = createSupabaseAdminClient();
  const { scopeData } = await ensureExistingConfigurationInScope({
    configurationId,
    currentUser,
    client: adminClient
  });
  await ensureAllowedModelSelection({
    currentUser,
    modelId: input.modelId,
    client: adminClient
  });
  const payload = buildConfigurationPayload({
    scopeData,
    currentUser,
    data: input,
    mode: "update"
  }) as TceConfigurationUpdate;

  if (payload.ativo) {
    await ensureNoActiveScopeDuplicate({
      client: adminClient,
      offerId: scopeData.offerId,
      areaId: payload.area_estagio_id!,
      semesterId: payload.semestre_id ?? null,
      classId: payload.turma_id ?? null,
      excludeId: configurationId
    });
  }

  const { data, error } = await adminClient
    .from("configuracoes_tce_estagio")
    .update(payload as never)
    .eq("id", configurationId)
    .select("*")
    .single();

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
      throw new TceServiceError(
        "duplicate_active",
        "Já existe uma configuração ativa de TCE para esta combinação de oferta, área, semestre e turma."
      );
    }

    throw new Error("Houve um problema ao atualizar a configuração de TCE.");
  }

  return data as TceConfigurationRow;
}

export async function setTceConfigurationActive(
  currentUser: SessionUser,
  input: {
    configurationId: string;
    active: boolean;
  }
) {
  const adminClient = createSupabaseAdminClient();
  const { configurationRow } = await ensureExistingConfigurationInScope({
    configurationId: input.configurationId,
    currentUser,
    client: adminClient
  });

  if (input.active) {
    await ensureNoActiveScopeDuplicate({
      client: adminClient,
      offerId: configurationRow.oferta_curso_unidade_id,
      areaId: configurationRow.area_estagio_id,
      semesterId: configurationRow.semestre_id ?? null,
      classId: configurationRow.turma_id ?? null,
      excludeId: input.configurationId
    });
  }

  const { data, error } = await adminClient
    .from("configuracoes_tce_estagio")
    .update(
      {
        ativo: input.active,
        updated_by: currentUser.id
      } as never
    )
    .eq("id", input.configurationId)
    .select("*")
    .single();

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
      throw new TceServiceError(
        "duplicate_active",
        "Já existe uma configuração ativa de TCE para esta combinação de oferta, área, semestre e turma."
      );
    }

    throw new Error("Houve um problema ao alterar o status da configuração de TCE.");
  }

  return data as TceConfigurationRow;
}

export function mapTceModelRowToDomain(row: TceModelRow): TceModel {
  return {
    id: row.id,
    institutionId: row.instituicao_id,
    courseId: row.curso_id,
    name: row.nome,
    code: row.codigo,
    description: row.descricao,
    active: row.ativo,
    templatePath: row.template_path,
    templateVersion: row.template_version,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTceConfigurationRowToDomain(row: TceConfigurationRow): TceInternshipConfiguration {
  return {
    id: row.id,
    modelId: row.modelo_tce_id,
    courseId: row.curso_id,
    offerId: row.oferta_curso_unidade_id,
    semesterId: row.semestre_id,
    classId: row.turma_id,
    stageAreaId: row.area_estagio_id,
    name: row.nome,
    active: row.ativo,
    concedingPartyData: toConcedingPartyData(row.dados_concedente),
    termData: toTermData(row.dados_vigencia),
    scheduleData: toScheduleData(row.dados_horario),
    dailyWorkload: row.jornada_diaria,
    weeklyWorkload: row.jornada_semanal,
    semesterWorkload: row.jornada_semestral,
    activityPlan: row.plano_atividades,
    signatureCity: row.cidade_assinatura,
    signatureDate: row.data_assinatura,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toTceStudentData(value: unknown): TceStudentData {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    fullName: toOptionalText(data.fullName),
    registration: toOptionalText(data.registration),
    campus: toOptionalText(data.campus),
    courseName: toOptionalText(data.courseName),
    semesterLabel: toOptionalText(data.semesterLabel),
    shift: toOptionalText(data.shift),
    address: toOptionalText(data.address),
    addressNumber: toOptionalText(data.addressNumber),
    addressComplement: toOptionalText(data.addressComplement),
    neighborhood: toOptionalText(data.neighborhood),
    city: toOptionalText(data.city),
    state: toOptionalText(data.state),
    postalCode: toOptionalText(data.postalCode),
    phone: toOptionalText(data.phone),
    email: toOptionalText(data.email)
  };
}

function mapStudentTceRowToDomain(row: StudentTceRow): StudentTce {
  return {
    id: row.id,
    configurationId: row.configuracao_tce_estagio_id,
    studentId: row.aluno_id,
    enrollmentId: row.matricula_turma_id,
    stageAreaId: row.area_estagio_id,
    studentData: toTceStudentData(row.dados_estagiario),
    configurationSnapshot:
      row.configuracao_snapshot && typeof row.configuracao_snapshot === "object"
        ? (row.configuracao_snapshot as Record<string, unknown>)
        : {},
    templateVersionSnapshot: row.template_version_snapshot,
    generatedPdfPath: row.pdf_gerado_path,
    generatedAt: row.gerado_em,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export interface ResolvedStudentTceContextEntry {
  enrollment: EnrollmentRow;
  classRow: ClassRow;
  semester: SemesterRow;
  area: AreaRow;
  block: BlockRow | null;
  offer: OfferRow;
  course: CourseRow | null;
  unit: UnitRow | null;
  institution: InstitutionRow | null;
  professorNames: string[];
}

export interface ResolvedStudentTceContext {
  student: StudentRow;
  contexts: ResolvedStudentTceContextEntry[];
  warnings: string[];
}

function buildStudentTceEmptyState(
  title: string,
  description: string
): StudentTcePageLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildStudentTceModuleSetupError() {
  return buildStudentTceEmptyState(
    "Módulo de TCE indisponível",
    "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente. Aplique o script-15 do TCE gerador antes de liberar a área do aluno."
  );
}

function buildStudentSemesterLabel(input: {
  semester: SemesterRow;
  classRow: ClassRow;
}) {
  if (input.classRow.periodo_curricular && input.classRow.periodo_curricular > 0) {
    return `${input.classRow.periodo_curricular}º período`;
  }

  return input.semester.codigo;
}

function buildStudentTcePrefillData(input: {
  currentUser: SessionUser;
  student: StudentRow;
  context: ResolvedStudentTceContextEntry;
}): TceStudentData {
  return {
    fullName: input.currentUser.name || input.student.nome_social || null,
    registration: input.student.matricula,
    campus: input.context.unit?.nome ?? input.currentUser.unitName ?? null,
    courseName: input.context.course?.nome ?? input.student.curso,
    semesterLabel: buildStudentSemesterLabel({
      semester: input.context.semester,
      classRow: input.context.classRow
    }),
    shift: null,
    address: null,
    addressNumber: null,
    addressComplement: null,
    neighborhood: null,
    city: null,
    state: input.context.unit?.estado ?? null,
    postalCode: null,
    phone: input.student.celular,
    email: input.currentUser.email || null
  };
}

function buildStudentTceLabel(input: {
  configurationName: string;
  areaName: string;
  semesterCode: string;
}) {
  return input.configurationName.trim().length
    ? input.configurationName
    : `TCE - ${input.areaName} - ${input.semesterCode}`;
}

function buildStudentTceHelperText(input: {
  courseName: string;
  semesterCode: string;
  className: string;
  professorNames: string[];
}) {
  const professorLabel = input.professorNames.length
    ? input.professorNames.join(", ")
    : "Supervisor ainda não vinculado";

  return [input.courseName, input.semesterCode, input.className, professorLabel]
    .filter((value) => value.trim().length)
    .join(" · ");
}

function matchesTceConfigurationContext(input: {
  configuration: TceConfigurationRow;
  context: ResolvedStudentTceContextEntry;
}) {
  if (input.configuration.oferta_curso_unidade_id !== input.context.offer.id) {
    return false;
  }

  if (input.configuration.area_estagio_id !== input.context.area.id) {
    return false;
  }

  if (
    input.configuration.semestre_id &&
    input.configuration.semestre_id !== input.context.semester.id
  ) {
    return false;
  }

  if (input.configuration.turma_id && input.configuration.turma_id !== input.context.classRow.id) {
    return false;
  }

  return true;
}

function computeTceConfigurationSpecificity(configuration: TceConfigurationRow) {
  return [
    configuration.oferta_curso_unidade_id,
    configuration.area_estagio_id,
    configuration.semestre_id,
    configuration.turma_id
  ].filter(Boolean).length;
}

function computeTceConfigurationPrecedence(configuration: TceConfigurationRow) {
  let score = 0;

  if (configuration.turma_id) {
    score += 8;
  }

  if (configuration.semestre_id) {
    score += 4;
  }

  if (configuration.area_estagio_id) {
    score += 2;
  }

  if (configuration.oferta_curso_unidade_id) {
    score += 1;
  }

  return score;
}

function compareTceConfigurationSelection(
  left: TceConfigurationRow,
  right: TceConfigurationRow
) {
  const specificityDifference =
    computeTceConfigurationSpecificity(right) - computeTceConfigurationSpecificity(left);

  if (specificityDifference !== 0) {
    return specificityDifference;
  }

  const precedenceDifference =
    computeTceConfigurationPrecedence(right) - computeTceConfigurationPrecedence(left);

  if (precedenceDifference !== 0) {
    return precedenceDifference;
  }

  const updatedAtDifference =
    new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();

  if (updatedAtDifference !== 0) {
    return updatedAtDifference;
  }

  return right.id.localeCompare(left.id, "pt-BR");
}

function hasEquivalentTceConfigurationRank(
  left: TceConfigurationRow,
  right: TceConfigurationRow
) {
  return (
    computeTceConfigurationSpecificity(left) ===
      computeTceConfigurationSpecificity(right) &&
    computeTceConfigurationPrecedence(left) ===
      computeTceConfigurationPrecedence(right) &&
    left.updated_at === right.updated_at
  );
}

function serializeTceStudentData(studentData: TceStudentData) {
  return {
    fullName: studentData.fullName ?? null,
    registration: studentData.registration ?? null,
    campus: studentData.campus ?? null,
    courseName: studentData.courseName ?? null,
    semesterLabel: studentData.semesterLabel ?? null,
    shift: studentData.shift ?? null,
    address: studentData.address ?? null,
    addressNumber: studentData.addressNumber ?? null,
    addressComplement: studentData.addressComplement ?? null,
    neighborhood: studentData.neighborhood ?? null,
    city: studentData.city ?? null,
    state: studentData.state ?? null,
    postalCode: studentData.postalCode ?? null,
    phone: studentData.phone ?? null,
    email: studentData.email ?? null
  } satisfies Record<string, unknown>;
}

function buildTceConfigurationSnapshot(entry: StudentTceAvailableEntry) {
  return {
    configurationId: entry.configuration.id,
    configurationName: entry.configuration.name,
    model: {
      id: entry.model.id,
      name: entry.model.name,
      code: entry.model.code,
      templateVersion: entry.model.templateVersion
    },
    context: {
      enrollmentId: entry.enrollmentId,
      classId: entry.classId,
      className: entry.className,
      semesterId: entry.semesterId,
      semesterCode: entry.semesterCode,
      semesterName: entry.semesterName,
      curricularPeriod: entry.curricularPeriod,
      areaId: entry.areaId,
      areaName: entry.areaName,
      blockName: entry.blockName,
      offerId: entry.offerId,
      offerName: entry.offerName,
      courseName: entry.courseName,
      institutionName: entry.institutionName,
      unitName: entry.unitName
    },
    fixedData: {
      concedingPartyData: entry.configuration.concedingPartyData,
      termData: entry.configuration.termData,
      scheduleData: entry.configuration.scheduleData,
      dailyWorkload: entry.configuration.dailyWorkload,
      weeklyWorkload: entry.configuration.weeklyWorkload,
      semesterWorkload: entry.configuration.semesterWorkload,
      activityPlan: entry.configuration.activityPlan,
      signatureCity: entry.configuration.signatureCity,
      signatureDate: entry.configuration.signatureDate
    },
    savedAt: new Date().toISOString()
  } satisfies Record<string, unknown>;
}

export async function resolveStudentTceContext(
  currentUser: SessionUser,
  client?: TceQueryClient
): Promise<ResolvedStudentTceContext> {
  const queryClient = client ?? (await createSupabaseServerClient());
  const { data: studentData, error: studentError } = await queryClient
    .from("alunos")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (studentError) {
    throw new Error("Houve um problema ao localizar o cadastro acadêmico do aluno.");
  }

  const student = (studentData ?? null) as StudentRow | null;

  if (!student) {
    throw new TceServiceError(
      "invalid_scope",
      "Não foi possível localizar o cadastro acadêmico do aluno autenticado."
    );
  }

  const { data: enrollmentData, error: enrollmentError } = await queryClient
    .from("matriculas_turma")
    .select("*")
    .eq("aluno_id", currentUser.id)
    .eq("status", "ativa");

  if (enrollmentError) {
    throw new Error("Houve um problema ao consultar as matrículas ativas do aluno.");
  }

  const enrollments = (enrollmentData ?? []) as EnrollmentRow[];
  const classIds = uniqueStringValues(enrollments.map((row) => row.turma_id));
  const classResult = classIds.length
    ? await queryClient.from("turmas").select("*").in("id", classIds).eq("ativa", true)
    : { data: [], error: null };

  if (classResult.error) {
    throw new Error("Houve um problema ao consultar as turmas ativas do aluno.");
  }

  const classRows = (classResult.data ?? []) as ClassRow[];
  const semesterIds = uniqueStringValues(classRows.map((row) => row.semestre_id));
  const semesterResult = semesterIds.length
    ? await queryClient.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterResult.error) {
    throw new Error("Houve um problema ao consultar os semestres ativos do aluno.");
  }

  const visibleSemesters = ((semesterResult.data ?? []) as SemesterRow[]).filter(
    (semester) => semester.status === "ativo" || semester.status === "planejado"
  );
  const visibleSemesterIds = new Set(visibleSemesters.map((semester) => semester.id));
  const visibleClassRows = classRows.filter((classRow) =>
    visibleSemesterIds.has(classRow.semestre_id)
  );
  const visibleClassIds = new Set(visibleClassRows.map((classRow) => classRow.id));
  const visibleEnrollments = enrollments.filter((enrollment) =>
    visibleClassIds.has(enrollment.turma_id)
  );
  const areaIds = uniqueStringValues(
    visibleClassRows.map((classRow) => classRow.area_estagio_id)
  );
  const [areaResult, professorLinksResult] = await Promise.all([
    areaIds.length
      ? queryClient.from("areas_estagio").select("*").in("id", areaIds)
      : Promise.resolve({ data: [], error: null }),
    visibleEnrollments.length
      ? queryClient
          .from("vinculos_professor_aluno")
          .select("*")
          .in(
            "matricula_turma_id",
            visibleEnrollments.map((enrollment) => enrollment.id)
          )
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (areaResult.error || professorLinksResult.error) {
    throw new Error("Houve um problema ao montar o contexto de TCE do aluno.");
  }

  const areas = (areaResult.data ?? []) as AreaRow[];
  const blockIds = uniqueNumberValues(areas.map((area) => area.bloco_id));
  const professorIds = uniqueStringValues(
    ((professorLinksResult.data ?? []) as Array<{ professor_id: string }>).map(
      (link) => link.professor_id
    )
  );
  const offerIds = uniqueStringValues([
    student.oferta_curso_unidade_id,
    ...visibleEnrollments.map((enrollment) => enrollment.oferta_curso_unidade_id),
    ...visibleClassRows.map((classRow) => classRow.oferta_curso_unidade_id),
    ...visibleSemesters.map((semester) => semester.oferta_curso_unidade_id)
  ]);
  const [blockResult, professorUsersResult, offerResult] = await Promise.all([
    blockIds.length
      ? queryClient.from("blocos_estagio").select("*").in("id", blockIds)
      : Promise.resolve({ data: [], error: null }),
    professorIds.length
      ? queryClient.from("usuarios").select("*").in("id", professorIds)
      : Promise.resolve({ data: [], error: null }),
    offerIds.length
      ? queryClient.from("ofertas_curso_unidade").select("*").in("id", offerIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (blockResult.error || professorUsersResult.error || offerResult.error) {
    throw new Error("Houve um problema ao complementar o contexto institucional do TCE.");
  }

  const offers = (offerResult.data ?? []) as OfferRow[];
  const courseIds = uniqueStringValues([
    student.curso_id,
    ...offers.map((offer) => offer.curso_id)
  ]);
  const unitIds = uniqueStringValues([
    student.unidade_id,
    ...offers.map((offer) => offer.unidade_id)
  ]);
  const institutionIds = uniqueStringValues([
    currentUser.instituicaoId,
    ...offers.map((offer) => offer.instituicao_id)
  ]);
  const [courseResult, unitResult, institutionResult] = await Promise.all([
    courseIds.length
      ? queryClient.from("cursos").select("*").in("id", courseIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? queryClient.from("unidades").select("*").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    institutionIds.length
      ? queryClient.from("instituicoes").select("*").in("id", institutionIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (courseResult.error || unitResult.error || institutionResult.error) {
    throw new Error("Houve um problema ao carregar os dados institucionais do TCE.");
  }

  const semesterMap = new Map(visibleSemesters.map((semester) => [semester.id, semester]));
  const classMap = new Map(visibleClassRows.map((classRow) => [classRow.id, classRow]));
  const areaMap = new Map(areas.map((area) => [area.id, area]));
  const blockMap = new Map(((blockResult.data ?? []) as BlockRow[]).map((block) => [block.id, block]));
  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
  const courseMap = new Map(((courseResult.data ?? []) as CourseRow[]).map((course) => [course.id, course]));
  const unitMap = new Map(((unitResult.data ?? []) as UnitRow[]).map((unit) => [unit.id, unit]));
  const institutionMap = new Map(
    ((institutionResult.data ?? []) as InstitutionRow[]).map((institution) => [
      institution.id,
      institution
    ])
  );
  const professorUserMap = new Map(
    ((professorUsersResult.data ?? []) as UserRow[]).map((user) => [user.id, user])
  );
  const professorLinks = (professorLinksResult.data ?? []) as Array<{
    matricula_turma_id: string;
    professor_id: string;
  }>;
  const warnings: string[] = [];

  const contexts = visibleEnrollments
    .map((enrollment) => {
      const classRow = classMap.get(enrollment.turma_id) ?? null;
      const semester = classRow ? semesterMap.get(classRow.semestre_id) ?? null : null;
      const area =
        classRow?.area_estagio_id ? areaMap.get(classRow.area_estagio_id) ?? null : null;

      const resolvedOfferId =
        enrollment.oferta_curso_unidade_id ??
        classRow?.oferta_curso_unidade_id ??
        semester?.oferta_curso_unidade_id ??
        student.oferta_curso_unidade_id ??
        null;
      const offer = resolvedOfferId ? offerMap.get(resolvedOfferId) ?? null : null;

      if (!classRow || !semester || !area || !offer) {
        warnings.push(
          `Não foi possível identificar todo o contexto de estágio da matrícula ${enrollment.id}. Procure a coordenação para revisar turma, semestre e área.`
        );
        return null;
      }

      const block = blockMap.get(area.bloco_id) ?? null;
      const course = courseMap.get(offer.curso_id) ?? null;
      const unit = unitMap.get(offer.unidade_id) ?? null;
      const institution = institutionMap.get(offer.instituicao_id) ?? null;
      const professorNames = professorLinks
        .filter((link) => link.matricula_turma_id === enrollment.id)
        .map((link) => professorUserMap.get(link.professor_id)?.nome_completo ?? null)
        .filter((value): value is string => Boolean(value));

      return {
        enrollment,
        classRow,
        semester,
        area,
        block,
        offer,
        course,
        unit,
        institution,
        professorNames
      } satisfies ResolvedStudentTceContextEntry;
    })
    .filter((entry): entry is ResolvedStudentTceContextEntry => Boolean(entry));

  return {
    student,
    contexts,
    warnings
  };
}

function buildStudentTcePageStudentSummary(input: {
  currentUser: SessionUser;
  student: StudentRow;
  contexts: ResolvedStudentTceContextEntry[];
}) {
  const firstContext = input.contexts[0] ?? null;

  return {
    id: input.currentUser.id,
    name: input.currentUser.name,
    registration: input.student.matricula,
    email: input.currentUser.email,
    phone: input.student.celular,
    courseName: firstContext?.course?.nome ?? input.student.curso,
    institutionName: firstContext?.institution?.nome ?? input.currentUser.instituicaoNome ?? null,
    unitName: firstContext?.unit?.nome ?? input.currentUser.unitName ?? null
  };
}

export async function loadStudentAvailableTces(
  currentUser: SessionUser
): Promise<StudentTcePageLoadResult> {
  try {
    const serverClient = await createSupabaseServerClient();
    const resolvedContext = await resolveStudentTceContext(currentUser, serverClient);

    if (!resolvedContext.contexts.length) {
      return {
        pageData: {
          student: buildStudentTcePageStudentSummary({
            currentUser,
            student: resolvedContext.student,
            contexts: resolvedContext.contexts
          }),
          availableTces: [],
          warnings: [
            ...resolvedContext.warnings,
            "Nenhum TCE disponível para sua matrícula/área de estágio no momento."
          ]
        },
        emptyState: null
      };
    }

    const offerIds = uniqueStringValues(
      resolvedContext.contexts.map((context) => context.offer.id)
    );
    const { data: configurationData, error: configurationError } = await serverClient
      .from("configuracoes_tce_estagio")
      .select("*")
      .in("oferta_curso_unidade_id", offerIds)
      .eq("ativo", true)
      .order("updated_at", { ascending: false });

    if (configurationError) {
      if (isMissingTceModuleRelationError(configurationError)) {
        throw new TceServiceError(
          "database_not_ready",
          "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
        );
      }

      throw new Error("Houve um problema ao consultar as configurações ativas de TCE.");
    }

    const configurationRows = (configurationData ?? []) as TceConfigurationRow[];
    const modelIds = uniqueStringValues(configurationRows.map((row) => row.modelo_tce_id));
    const modelResult = modelIds.length
      ? await serverClient
          .from("modelos_tce")
          .select("*")
          .in("id", modelIds)
          .eq("ativo", true)
      : { data: [], error: null };

    if (modelResult.error) {
      throw new Error("Houve um problema ao consultar os modelos ativos de TCE.");
    }

    const activeModelMap = new Map(
      ((modelResult.data ?? []) as TceModelRow[]).map((row) => [row.id, row])
    );
    const warnings = [...resolvedContext.warnings];
    const selectedEntries = new Map<
      string,
      {
        configurationRow: TceConfigurationRow;
        context: ResolvedStudentTceContextEntry;
      }
    >();

    for (const context of resolvedContext.contexts) {
      const compatibleConfigurations = configurationRows
        .filter((configurationRow) => {
          const modelRow = activeModelMap.get(configurationRow.modelo_tce_id) ?? null;

          if (!modelRow) {
            return false;
          }

          if (modelRow.curso_id && modelRow.curso_id !== context.offer.curso_id) {
            return false;
          }

          if (
            modelRow.instituicao_id &&
            modelRow.instituicao_id !== context.offer.instituicao_id
          ) {
            return false;
          }

          return matchesTceConfigurationContext({
            configuration: configurationRow,
            context
          });
        })
        .sort(compareTceConfigurationSelection);

      if (!compatibleConfigurations.length) {
        warnings.push(
          `Nenhum TCE ativo foi configurado para ${context.area.nome} em ${context.semester.codigo}.`
        );
        continue;
      }

      const selectedConfiguration = compatibleConfigurations[0] ?? null;
      const secondConfiguration = compatibleConfigurations[1] ?? null;

      if (
        selectedConfiguration &&
        secondConfiguration &&
        hasEquivalentTceConfigurationRank(selectedConfiguration, secondConfiguration)
      ) {
        warnings.push(
          `Há mais de uma configuração de TCE aplicável a ${context.area.nome} em ${context.semester.codigo}. Procure a coordenação.`
        );
        continue;
      }

      if (!selectedConfiguration) {
        continue;
      }

      if (selectedEntries.has(selectedConfiguration.id)) {
        warnings.push(
          `A configuração ${selectedConfiguration.nome} ficou vinculada a mais de uma matrícula ativa e será exibida apenas uma vez nesta tela.`
        );
        continue;
      }

      selectedEntries.set(selectedConfiguration.id, {
        configurationRow: selectedConfiguration,
        context
      });
    }

    const selectedConfigurationIds = [...selectedEntries.keys()];
    const existingStudentTceResult = selectedConfigurationIds.length
      ? await serverClient
          .from("tces_aluno")
          .select("*")
          .eq("aluno_id", currentUser.id)
          .in("configuracao_tce_estagio_id", selectedConfigurationIds)
      : { data: [], error: null };

    if (existingStudentTceResult.error) {
      throw new Error("Houve um problema ao carregar os dados já salvos do TCE.");
    }

    const existingStudentTceMap = new Map(
      ((existingStudentTceResult.data ?? []) as StudentTceRow[]).map((row) => [
        row.configuracao_tce_estagio_id,
        mapStudentTceRowToDomain(row)
      ])
    );

    const availableTces = [...selectedEntries.values()]
      .map(({ configurationRow, context }) => {
        const modelRow = activeModelMap.get(configurationRow.modelo_tce_id) ?? null;

        if (!modelRow) {
          return null;
        }

        const savedTce = existingStudentTceMap.get(configurationRow.id) ?? null;
        const initialStudentData =
          savedTce?.studentData ??
          buildStudentTcePrefillData({
            currentUser,
            student: resolvedContext.student,
            context
          });
        const configuration = mapTceConfigurationRowToDomain(configurationRow);
        const model = mapTceModelRowToDomain(modelRow);

        return {
          entryKey: `${configuration.id}:${context.enrollment.id}`,
          configuration,
          model,
          enrollmentId: context.enrollment.id,
          classId: context.classRow.id,
          className: context.classRow.nome,
          semesterId: context.semester.id,
          semesterCode: context.semester.codigo,
          semesterName: context.semester.nome,
          curricularPeriod: context.classRow.periodo_curricular,
          areaId: context.area.id,
          areaName: context.area.nome,
          blockName: context.block?.nome ?? null,
          offerId: context.offer.id,
          offerName: context.offer.nome_exibicao,
          courseName: context.course?.nome ?? resolvedContext.student.curso,
          institutionName:
            context.institution?.nome ?? currentUser.instituicaoNome ?? null,
          unitName: context.unit?.nome ?? currentUser.unitName ?? null,
          professorNames: context.professorNames,
          label: buildStudentTceLabel({
            configurationName: configuration.name,
            areaName: context.area.nome,
            semesterCode: context.semester.codigo
          }),
          helperText: buildStudentTceHelperText({
            courseName: context.course?.nome ?? resolvedContext.student.curso,
            semesterCode: context.semester.codigo,
            className: context.classRow.nome,
            professorNames: context.professorNames
          }),
          savedTce,
          initialStudentData
        } satisfies StudentTceAvailableEntry;
      })
      .filter((entry): entry is StudentTceAvailableEntry => Boolean(entry))
      .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

    if (!availableTces.length && !warnings.length) {
      warnings.push("Nenhum TCE disponível para sua matrícula/área de estágio no momento.");
    }

    return {
      pageData: {
        student: buildStudentTcePageStudentSummary({
          currentUser,
          student: resolvedContext.student,
          contexts: resolvedContext.contexts
        }),
        availableTces,
        warnings
      },
      emptyState: null
    };
  } catch (error) {
    if (error instanceof TceServiceError && error.kind === "database_not_ready") {
      return buildStudentTceModuleSetupError();
    }

    if (error instanceof TceServiceError && error.kind === "invalid_scope") {
      return buildStudentTceEmptyState("Contexto acadêmico indisponível", error.message);
    }

    return buildStudentTceEmptyState(
      "Não foi possível carregar o TCE",
      "Houve um problema ao localizar a configuração de TCE aplicável ao aluno autenticado."
    );
  }
}

export async function loadStudentTceByConfiguration(
  currentUser: SessionUser,
  configurationId: string
) {
  const { pageData, emptyState } = await loadStudentAvailableTces(currentUser);

  if (!pageData) {
    throw new TceServiceError(
      emptyState?.title === "Módulo de TCE indisponível"
        ? "database_not_ready"
        : "not_found",
      emptyState?.description ?? "Não foi possível carregar a configuração do TCE."
    );
  }

  const entry =
    pageData.availableTces.find(
      (availableEntry) => availableEntry.configuration.id === configurationId
    ) ?? null;

  if (!entry) {
    throw new TceServiceError(
      "not_found",
      "O TCE informado não está disponível para o aluno autenticado."
    );
  }

  return entry;
}

export async function saveStudentTceData(
  currentUser: SessionUser,
  input: SaveStudentTceDataInput
) {
  const availableEntry = await loadStudentTceByConfiguration(
    currentUser,
    input.configurationId
  );

  if (availableEntry.enrollmentId !== input.enrollmentId) {
    throw new TceServiceError(
      "validation",
      "A matrícula informada não corresponde ao TCE selecionado."
    );
  }

  if (availableEntry.areaId !== input.areaId) {
    throw new TceServiceError(
      "validation",
      "A área de estágio informada não corresponde ao TCE selecionado."
    );
  }

  const adminClient = createSupabaseAdminClient();
  const payload = {
    configuracao_tce_estagio_id: availableEntry.configuration.id,
    aluno_id: currentUser.id,
    matricula_turma_id: availableEntry.enrollmentId,
    area_estagio_id: availableEntry.areaId,
    dados_estagiario: serializeTceStudentData(input.studentData),
    configuracao_snapshot: buildTceConfigurationSnapshot(availableEntry),
    template_version_snapshot: availableEntry.model.templateVersion,
    metadata: availableEntry.savedTce?.metadata ?? {}
  };

  const { data, error } = await adminClient
    .from("tces_aluno")
    .upsert(payload as never, {
      onConflict: "configuracao_tce_estagio_id,aluno_id"
    })
    .select("*")
    .single();

  if (error) {
    if (isMissingTceModuleRelationError(error)) {
      throw new TceServiceError(
        "database_not_ready",
        "As tabelas do módulo TCE ainda não estão disponíveis neste ambiente."
      );
    }

    throw new Error("Houve um problema ao salvar os dados preenchidos do TCE.");
  }

  return mapStudentTceRowToDomain(data as StudentTceRow);
}
