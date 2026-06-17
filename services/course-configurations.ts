import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type { EvaluationModelApplicationRule } from "@/types/domain";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type ModelRow = Database["public"]["Tables"]["modelos_avaliacao_curso"]["Row"];
type GroupRow = Database["public"]["Tables"]["grupos_modelo_avaliacao"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_modelo_avaliacao"]["Row"];
type CriterionOptionRow =
  Database["public"]["Tables"]["opcoes_criterio_modelo_avaliacao"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type ModelApplicationRuleRow =
  Database["public"]["Tables"]["regras_aplicacao_modelo_avaliacao"]["Row"];
type DocumentTypeRow = Database["public"]["Tables"]["tipos_documento"]["Row"];
type RequiredDocumentRow =
  Database["public"]["Tables"]["documentos_obrigatorios_curso"]["Row"];

export type CourseConfigurationStatus =
  | "Configurado"
  | "Parcial"
  | "Sem configuracao";

export type CourseConfigurationWeightDiagnosticStatus =
  | "OK"
  | "Atencao"
  | "Sem itens ativos";

export interface CourseConfigurationSummary {
  totalCourses: number;
  configuredCourses: number;
  partialCourses: number;
  unconfiguredCourses: number;
  totalModels: number;
  totalRequiredDocuments: number;
}

export interface CourseConfigurationWeightDiagnostic {
  activeItemCount: number;
  totalWeight: number;
  expectedWeight: number;
  status: CourseConfigurationWeightDiagnosticStatus;
  statusLabel: string;
}

export interface CourseConfigurationModelEntry {
  id: string;
  code: string;
  name: string;
  description: string | null;
  version: number;
  modality: ModelRow["modalidade"];
  isLaunchDefault: boolean;
  isActive: boolean;
  applicationRules: CourseConfigurationModelApplicationRuleEntry[];
  applicationRuleConflictWarning: string | null;
  groupWeightDiagnostic: CourseConfigurationWeightDiagnostic;
}

export interface CourseConfigurationModelApplicationRuleEntry
  extends EvaluationModelApplicationRule {
  offerName: string | null;
  semesterLabel: string | null;
  classLabel: string | null;
  areaName: string | null;
  specificity: number;
  summary: string;
}

export interface CourseConfigurationCriterionOptionEntry {
  id: string;
  label: string;
  description: string | null;
  scoreValue: number;
  order: number;
  isActive: boolean;
}

export interface CourseConfigurationGroupEntry {
  id: string;
  modelId: string;
  modelCode: string;
  code: string;
  name: string;
  order: number;
  weightPercent: number;
  isActive: boolean;
  criterionWeightDiagnostic: CourseConfigurationWeightDiagnostic;
}

export interface CourseConfigurationCriterionEntry {
  id: string;
  groupId: string;
  groupName: string;
  modelId: string;
  modelModality: ModelRow["modalidade"];
  code: string;
  name: string;
  description: string | null;
  order: number;
  weightPercent: number;
  maxScale: number;
  isActive: boolean;
  rubricOptions: CourseConfigurationCriterionOptionEntry[];
}

export interface CourseConfigurationRequiredDocumentEntry {
  id: string;
  typeId: string;
  code: string | null;
  typeCode: string;
  typeName: string;
  displayName: string | null;
  description: string | null;
  isRequired: boolean;
  order: number | null;
  isActive: boolean;
}

export type CourseConfigurationCopySourceScope =
  | "same_institution"
  | "global_default";

export interface CourseConfigurationDocumentTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface CourseConfigurationModelApplicationOfferOption {
  id: string;
  label: string;
}

export interface CourseConfigurationModelApplicationSemesterOption {
  id: string;
  offerId: string | null;
  label: string;
}

export interface CourseConfigurationModelApplicationClassOption {
  id: string;
  offerId: string | null;
  semesterId: string;
  curricularPeriod: number | null;
  label: string;
}

export interface CourseConfigurationModelApplicationAreaOption {
  id: string;
  offerId: string | null;
  label: string;
}

export interface CourseConfigurationModelApplicationRuleOptions {
  offers: CourseConfigurationModelApplicationOfferOption[];
  semesters: CourseConfigurationModelApplicationSemesterOption[];
  classes: CourseConfigurationModelApplicationClassOption[];
  areas: CourseConfigurationModelApplicationAreaOption[];
}

export interface CourseConfigurationImportableModelOption {
  id: string;
  sourceCourseId: string;
  code: string;
  name: string;
  modality: ModelRow["modalidade"];
  version: number;
  groupCount: number;
  criterionCount: number;
  rubricOptionCount: number;
  portableCurricularRuleCount: number;
}

export interface CourseConfigurationCourseEntry {
  id: string;
  institutionId: string;
  institutionName: string;
  courseCode: string;
  courseName: string;
  courseSlug: string;
  isActive: boolean;
  modelCount: number;
  groupCount: number;
  criterionCount: number;
  requiredDocumentCount: number;
  status: CourseConfigurationStatus;
  sourceConfigurationAvailable: boolean;
  canDuplicateFromFisioterapia: boolean;
  duplicateBaseBlockedReason: string | null;
  duplicateBaseSourceLabel: string | null;
  importBaseSourceLabel: string | null;
  importBaseModelOptions: CourseConfigurationImportableModelOption[];
  hasReusableInitialModel: boolean;
  models: CourseConfigurationModelEntry[];
  groups: CourseConfigurationGroupEntry[];
  criteria: CourseConfigurationCriterionEntry[];
  requiredDocuments: CourseConfigurationRequiredDocumentEntry[];
  applicationRuleOptions: CourseConfigurationModelApplicationRuleOptions;
}

export interface CourseConfigurationCopyTargetOption {
  courseId: string;
  institutionId: string;
  institutionName: string;
  courseCode: string;
  courseName: string;
  status: CourseConfigurationStatus;
  sourceLabel: string;
}

export interface CourseConfigurationPageData {
  summary: CourseConfigurationSummary;
  courses: CourseConfigurationCourseEntry[];
  copyTargetOptions: CourseConfigurationCopyTargetOption[];
  documentTypeOptions: CourseConfigurationDocumentTypeOption[];
  fisioterapiaBaseSourceLabel: string | null;
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

function isMissingRelationError(error: PostgrestError | null) {
  return error?.code === "42P01";
}

function buildMapById<T extends { id: string | number }>(rows: T[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function pushToMap<T>(targetMap: Map<string, T[]>, key: string, value: T) {
  const currentValues = targetMap.get(key);

  if (currentValues) {
    currentValues.push(value);
    return;
  }

  targetMap.set(key, [value]);
}

function compareByLocale(left: string, right: string) {
  return left.localeCompare(right, "pt-BR");
}

function safeSortableTimestamp(value?: string | null) {
  return typeof value === "string" ? value : "";
}

function sortModels(left: ModelRow, right: ModelRow) {
  if (left.versao !== right.versao) {
    return left.versao - right.versao;
  }

  return compareByLocale(left.nome, right.nome);
}

function sortGroups(left: GroupRow, right: GroupRow) {
  if (left.ordem !== right.ordem) {
    return left.ordem - right.ordem;
  }

  return compareByLocale(left.nome, right.nome);
}

function countModelApplicationRuleSpecificity(rule: Pick<
  ModelApplicationRuleRow,
  "oferta_curso_unidade_id" | "periodo_curricular" | "semestre_id" | "turma_id" | "area_estagio_id"
>) {
  return [
    rule.oferta_curso_unidade_id,
    rule.periodo_curricular,
    rule.semestre_id,
    rule.turma_id,
    rule.area_estagio_id
  ].filter((value) => value !== null).length;
}

function sortModelApplicationRules(left: ModelApplicationRuleRow, right: ModelApplicationRuleRow) {
  const specificityDifference =
    countModelApplicationRuleSpecificity(right) - countModelApplicationRuleSpecificity(left);

  if (specificityDifference !== 0) {
    return specificityDifference;
  }

  if (left.prioridade !== right.prioridade) {
    return right.prioridade - left.prioridade;
  }

  const updatedDifference = safeSortableTimestamp(right.updated_at).localeCompare(
    safeSortableTimestamp(left.updated_at)
  );

  if (updatedDifference !== 0) {
    return updatedDifference;
  }

  return right.id.localeCompare(left.id);
}

function buildModelApplicationRuleSummary(input: {
  rule: ModelApplicationRuleRow;
  offersById: Map<string, OfferRow>;
  semestersById: Map<string, SemesterRow>;
  classesById: Map<string, ClassRow>;
  areasById: Map<string, AreaRow>;
}) {
  const offerName = input.rule.oferta_curso_unidade_id
    ? input.offersById.get(input.rule.oferta_curso_unidade_id)?.nome_exibicao ?? null
    : null;
  const semesterRow = input.rule.semestre_id
    ? input.semestersById.get(input.rule.semestre_id) ?? null
    : null;
  const classRow = input.rule.turma_id ? input.classesById.get(input.rule.turma_id) ?? null : null;
  const areaRow = input.rule.area_estagio_id
    ? input.areasById.get(input.rule.area_estagio_id) ?? null
    : null;
  const summaryParts = [
    classRow ? `Turma: ${classRow.codigo} - ${classRow.nome}` : null,
    areaRow ? `Area: ${areaRow.nome}` : null,
    input.rule.periodo_curricular ? `${input.rule.periodo_curricular}º periodo` : null,
    semesterRow ? `Semestre academico: ${semesterRow.codigo}` : null,
    offerName ? `Oferta: ${offerName}` : null
  ].filter(Boolean);

  return {
    offerName,
    semesterLabel: semesterRow ? `${semesterRow.codigo} - ${semesterRow.nome}` : null,
    classLabel: classRow ? `${classRow.codigo} - ${classRow.nome}` : null,
    areaName: areaRow?.nome ?? null,
    specificity: countModelApplicationRuleSpecificity(input.rule),
    summary: summaryParts.join(" · ") || "Escopo especifico nao identificado."
  };
}

function doModelApplicationRulesPotentiallyOverlap(
  left: Pick<
    ModelApplicationRuleRow,
    "oferta_curso_unidade_id" | "periodo_curricular" | "semestre_id" | "turma_id" | "area_estagio_id"
  >,
  right: Pick<
    ModelApplicationRuleRow,
    "oferta_curso_unidade_id" | "periodo_curricular" | "semestre_id" | "turma_id" | "area_estagio_id"
  >
) {
  const comparableFields = [
    [left.oferta_curso_unidade_id, right.oferta_curso_unidade_id],
    [left.periodo_curricular, right.periodo_curricular],
    [left.semestre_id, right.semestre_id],
    [left.turma_id, right.turma_id],
    [left.area_estagio_id, right.area_estagio_id]
  ];

  return comparableFields.every(
    ([leftValue, rightValue]) =>
      leftValue === null || rightValue === null || leftValue === rightValue
  );
}

function resolveModelApplicationRuleConflictWarning(applicationRules: ModelApplicationRuleRow[]) {
  const activeRules = applicationRules.filter((applicationRule) => applicationRule.ativo);

  for (let leftIndex = 0; leftIndex < activeRules.length; leftIndex += 1) {
    const leftRule = activeRules[leftIndex];

    for (let rightIndex = leftIndex + 1; rightIndex < activeRules.length; rightIndex += 1) {
      const rightRule = activeRules[rightIndex];

      if (doModelApplicationRulesPotentiallyOverlap(leftRule, rightRule)) {
        return "Atencao: existem regras que podem se sobrepor. O runtime usara a regra mais especifica e com maior prioridade.";
      }
    }
  }

  return null;
}

function sortCriteria(left: CriterionRow, right: CriterionRow) {
  if (left.ordem !== right.ordem) {
    return left.ordem - right.ordem;
  }

  return compareByLocale(left.nome, right.nome);
}

function sortCriterionOptions(left: CriterionOptionRow, right: CriterionOptionRow) {
  if (left.ordem !== right.ordem) {
    return left.ordem - right.ordem;
  }

  return compareByLocale(left.rotulo, right.rotulo);
}

function sortRequiredDocuments(left: RequiredDocumentRow, right: RequiredDocumentRow) {
  const leftOrder = left.ordem ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right.ordem ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return compareByLocale(left.nome_exibicao ?? "", right.nome_exibicao ?? "");
}

function roundWeightValue(value: number) {
  return Number(value.toFixed(2));
}

function buildWeightDiagnostic(
  weights: number[],
  emptyStatusLabel: string
): CourseConfigurationWeightDiagnostic {
  if (!weights.length) {
    return {
      activeItemCount: 0,
      totalWeight: 0,
      expectedWeight: 100,
      status: "Sem itens ativos",
      statusLabel: emptyStatusLabel
    };
  }

  const totalWeight = roundWeightValue(weights.reduce((sum, weight) => sum + weight, 0));

  return {
    activeItemCount: weights.length,
    totalWeight,
    expectedWeight: 100,
    status: Math.abs(totalWeight - 100) < 0.001 ? "OK" : "Atencao",
    statusLabel: Math.abs(totalWeight - 100) < 0.001 ? "OK" : "Atencao"
  };
}

function resolveConfigurationStatus(input: {
  modelCount: number;
  groupCount: number;
  criterionCount: number;
  requiredDocumentCount: number;
}): CourseConfigurationStatus {
  const hasAnyConfiguration =
    input.modelCount > 0 ||
    input.groupCount > 0 ||
    input.criterionCount > 0 ||
    input.requiredDocumentCount > 0;
  const isFullyConfigured =
    input.modelCount > 0 &&
    input.groupCount > 0 &&
    input.criterionCount > 0 &&
    input.requiredDocumentCount > 0;

  if (isFullyConfigured) {
    return "Configurado";
  }

  if (!hasAnyConfiguration) {
    return "Sem configuracao";
  }

  return "Parcial";
}

function resolveDuplicateBaseState(input: {
  courseId: string;
  sourceCourseId: string | null;
  modelCount: number;
  groupCount: number;
  criterionCount: number;
  requiredDocumentCount: number;
}) {
  if (!input.sourceCourseId) {
    return {
      canDuplicateFromFisioterapia: false,
      duplicateBaseBlockedReason:
        "Nenhuma base padrao de Fisioterapia configurada foi encontrada.",
      hasReusableInitialModel: false
    };
  }

  if (input.courseId === input.sourceCourseId) {
    return {
      canDuplicateFromFisioterapia: false,
      duplicateBaseBlockedReason:
        "Este curso ja e a base de Fisioterapia usada como origem padrao da plataforma.",
      hasReusableInitialModel: false
    };
  }

  const hasReusableInitialModel =
    input.modelCount === 1 &&
    input.groupCount === 0 &&
    input.criterionCount === 0 &&
    input.requiredDocumentCount === 0;
  const canDuplicateFromFisioterapia =
    input.groupCount === 0 &&
    input.criterionCount === 0 &&
    input.requiredDocumentCount === 0 &&
    input.modelCount <= 1;

  if (canDuplicateFromFisioterapia) {
    return {
      canDuplicateFromFisioterapia: true,
      duplicateBaseBlockedReason: null,
      hasReusableInitialModel
    };
  }

  return {
    canDuplicateFromFisioterapia: false,
    duplicateBaseBlockedReason:
      "Este curso ja possui configuracao academica em andamento. Revise manualmente os grupos, criterios e documentos antes de duplicar a base da Fisioterapia.",
    hasReusableInitialModel
  };
}

function isConfiguredFisioterapiaCourse(course: CourseConfigurationCourseEntry) {
  return course.courseCode === "FISIO" && course.status === "Configurado" && course.isActive;
}

function getConfiguredFisioterapiaSourcePriority(course: CourseConfigurationCourseEntry) {
  return course.institutionName.toUpperCase().includes("UNIP") ? 0 : 1;
}

function compareConfiguredFisioterapiaSources(
  left: CourseConfigurationCourseEntry,
  right: CourseConfigurationCourseEntry
) {
  const priorityDifference =
    getConfiguredFisioterapiaSourcePriority(left) -
    getConfiguredFisioterapiaSourcePriority(right);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  if (left.requiredDocumentCount !== right.requiredDocumentCount) {
    return right.requiredDocumentCount - left.requiredDocumentCount;
  }

  if (left.criterionCount !== right.criterionCount) {
    return right.criterionCount - left.criterionCount;
  }

  if (left.groupCount !== right.groupCount) {
    return right.groupCount - left.groupCount;
  }

  if (left.modelCount !== right.modelCount) {
    return right.modelCount - left.modelCount;
  }

  const institutionComparison = compareByLocale(left.institutionName, right.institutionName);

  if (institutionComparison !== 0) {
    return institutionComparison;
  }

  return compareByLocale(left.courseName, right.courseName);
}

function buildFisioterapiaSourceLabel(
  sourceCourse: Pick<CourseConfigurationCourseEntry, "institutionName" | "courseName">,
  scope: CourseConfigurationCopySourceScope
) {
  const suffix =
    scope === "same_institution" ? "mesma IES" : "base padrao global";

  return `${sourceCourse.institutionName} / ${sourceCourse.courseName} (${suffix})`;
}

function resolveFisioterapiaSourceForCourse(
  course: CourseConfigurationCourseEntry,
  configuredFisioterapiaCourses: CourseConfigurationCourseEntry[]
) {
  const sameInstitutionSource = configuredFisioterapiaCourses.find(
    (candidate) => candidate.institutionId === course.institutionId
  );

  if (sameInstitutionSource) {
    return {
      course: sameInstitutionSource,
      scope: "same_institution" as const,
      label: buildFisioterapiaSourceLabel(sameInstitutionSource, "same_institution")
    };
  }

  const globalSource =
    configuredFisioterapiaCourses.find((candidate) => candidate.id !== course.id) ??
    configuredFisioterapiaCourses[0];

  if (!globalSource) {
    return null;
  }

  return {
    course: globalSource,
    scope: "global_default" as const,
    label: buildFisioterapiaSourceLabel(globalSource, "global_default")
  };
}

function isPortableCurricularApplicationRule(rule: {
  offerId: string | null;
  curricularPeriod: number | null;
  semesterId: string | null;
  classId: string | null;
  stageAreaId: string | null;
}) {
  return (
    rule.curricularPeriod !== null &&
    !rule.offerId &&
    !rule.semesterId &&
    !rule.classId &&
    !rule.stageAreaId
  );
}

export async function getCourseConfigurationPageData(): Promise<CourseConfigurationPageData> {
  const supabase = createSupabaseAdminClient();
  const [
    institutionsResult,
    coursesResult,
    modelsResult,
    groupsResult,
    criteriaResult,
    criterionOptionsResult,
    requiredDocumentsResult,
    documentTypesResult
  ] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("cursos").select("*").order("nome", { ascending: true }),
    supabase
      .from("modelos_avaliacao_curso")
      .select("*")
      .order("curso_id", { ascending: true })
      .order("versao", { ascending: true }),
    supabase
      .from("grupos_modelo_avaliacao")
      .select("*")
      .order("modelo_avaliacao_curso_id", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase
      .from("criterios_modelo_avaliacao")
      .select("*")
      .order("grupo_modelo_avaliacao_id", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase
      .from("opcoes_criterio_modelo_avaliacao")
      .select("*")
      .order("criterio_modelo_avaliacao_id", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase
      .from("documentos_obrigatorios_curso")
      .select("*")
      .order("curso_id", { ascending: true })
      .order("ordem", { ascending: true }),
    supabase.from("tipos_documento").select("*").order("nome", { ascending: true })
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes para configuracao de cursos.",
        institutionsResult.error
      )
    );
  }

  if (coursesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os cursos para configuracao.",
        coursesResult.error
      )
    );
  }

  if (modelsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os modelos de avaliacao por curso.",
        modelsResult.error
      )
    );
  }

  if (groupsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os grupos de avaliacao por curso.",
        groupsResult.error
      )
    );
  }

  if (criteriaResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os criterios de avaliacao por curso.",
        criteriaResult.error
      )
    );
  }

  if (criterionOptionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as opcoes de rubrica por criterio.",
        criterionOptionsResult.error
      )
    );
  }

  if (requiredDocumentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os documentos obrigatorios por curso.",
        requiredDocumentsResult.error
      )
    );
  }

  if (documentTypesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os tipos documentais.",
        documentTypesResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const modelRows = (modelsResult.data ?? []) as ModelRow[];
  const groupRows = (groupsResult.data ?? []) as GroupRow[];
  const criterionRows = (criteriaResult.data ?? []) as CriterionRow[];
  const criterionOptionRows =
    (criterionOptionsResult.data ?? []) as CriterionOptionRow[];
  const requiredDocumentRows =
    (requiredDocumentsResult.data ?? []) as RequiredDocumentRow[];
  const documentTypeRows = (documentTypesResult.data ?? []) as DocumentTypeRow[];
  const courseIds = [...new Set(courseRows.map((courseRow) => courseRow.id))];
  const courseOffersResult = courseIds.length
    ? await supabase
        .from("ofertas_curso_unidade")
        .select("id, curso_id, nome_exibicao")
        .in("curso_id", courseIds)
        .order("nome_exibicao", { ascending: true })
    : { data: [], error: null };

  if (courseOffersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as ofertas do curso para as regras de aplicacao.",
        courseOffersResult.error
      )
    );
  }

  const courseOfferRows =
    (courseOffersResult.data ?? []) as Array<Pick<OfferRow, "id" | "curso_id" | "nome_exibicao">>;
  const courseOfferIds = courseOfferRows.map((offerRow) => offerRow.id);
  const courseSemestersResult = courseOfferIds.length
    ? await supabase
        .from("semestres")
        .select("id, oferta_curso_unidade_id, codigo, nome")
        .in("oferta_curso_unidade_id", courseOfferIds)
        .order("codigo", { ascending: true })
    : { data: [], error: null };

  if (courseSemestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os semestres disponiveis para as regras de aplicacao.",
        courseSemestersResult.error
      )
    );
  }

  const courseSemesterRows = (courseSemestersResult.data ?? []) as Array<
    Pick<SemesterRow, "id" | "oferta_curso_unidade_id" | "codigo" | "nome">
  >;
  const courseSemesterIds = courseSemesterRows.map((semesterRow) => semesterRow.id);
  const courseClassesResult = courseSemesterIds.length
    ? await supabase
        .from("turmas")
        .select("id, semestre_id, oferta_curso_unidade_id, periodo_curricular, codigo, nome")
        .in("semestre_id", courseSemesterIds)
        .order("codigo", { ascending: true })
    : { data: [], error: null };

  if (courseClassesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as turmas disponiveis para as regras de aplicacao.",
        courseClassesResult.error
      )
    );
  }

  const courseClassRows = (courseClassesResult.data ?? []) as Array<
    Pick<
      ClassRow,
      "id" | "semestre_id" | "oferta_curso_unidade_id" | "periodo_curricular" | "codigo" | "nome"
    >
  >;
  const courseAreasResult = courseOfferIds.length
    ? await supabase
        .from("areas_estagio")
        .select("id, oferta_curso_unidade_id, nome")
        .in("oferta_curso_unidade_id", courseOfferIds)
        .order("nome", { ascending: true })
    : { data: [], error: null };

  if (courseAreasResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as areas de estagio disponiveis para as regras de aplicacao.",
        courseAreasResult.error
      )
    );
  }

  const courseAreaRows = (courseAreasResult.data ?? []) as Array<
    Pick<AreaRow, "id" | "oferta_curso_unidade_id" | "nome">
  >;
  const modelApplicationRulesResult = await supabase
    .from("regras_aplicacao_modelo_avaliacao")
    .select("*")
    .order("modelo_avaliacao_curso_id", { ascending: true })
    .order("prioridade", { ascending: false })
    .order("updated_at", { ascending: false });

  if (modelApplicationRulesResult.error && !isMissingRelationError(modelApplicationRulesResult.error)) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as regras de aplicacao dos modelos de avaliacao.",
        modelApplicationRulesResult.error
      )
    );
  }

  const modelApplicationRuleRows = modelApplicationRulesResult.error
    ? []
    : ((modelApplicationRulesResult.data ?? []) as ModelApplicationRuleRow[]);
  const offerIds = [...new Set(
    modelApplicationRuleRows
      .map((ruleRow) => ruleRow.oferta_curso_unidade_id)
      .filter((value): value is string => Boolean(value))
  )];
  const semesterIds = [...new Set(
    modelApplicationRuleRows
      .map((ruleRow) => ruleRow.semestre_id)
      .filter((value): value is string => Boolean(value))
  )];
  const classIds = [...new Set(
    modelApplicationRuleRows
      .map((ruleRow) => ruleRow.turma_id)
      .filter((value): value is string => Boolean(value))
  )];
  const areaIds = [...new Set(
    modelApplicationRuleRows
      .map((ruleRow) => ruleRow.area_estagio_id)
      .filter((value): value is string => Boolean(value))
  )];
  const [ruleOffersResult, ruleSemestersResult, ruleClassesResult, ruleAreasResult] = await Promise.all([
    offerIds.length
      ? supabase.from("ofertas_curso_unidade").select("id, nome_exibicao").in("id", offerIds)
      : Promise.resolve({ data: [], error: null }),
    semesterIds.length
      ? supabase.from("semestres").select("id, codigo, nome").in("id", semesterIds)
      : Promise.resolve({ data: [], error: null }),
    classIds.length
      ? supabase.from("turmas").select("id, codigo, nome").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
    areaIds.length
      ? supabase.from("areas_estagio").select("id, nome").in("id", areaIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    ruleOffersResult.error ||
    ruleSemestersResult.error ||
    ruleClassesResult.error ||
    ruleAreasResult.error
  ) {
    throw new Error("Nao foi possivel carregar os metadados das regras de aplicacao dos modelos.");
  }

  const institutionsById = buildMapById(institutionRows);
  const documentTypesById = buildMapById(documentTypeRows);
  const modelsById = buildMapById(modelRows);
  const groupsById = buildMapById(groupRows);
  const offersById = buildMapById((ruleOffersResult.data ?? []) as Array<Pick<OfferRow, "id" | "nome_exibicao">>);
  const semestersById = buildMapById(
    (ruleSemestersResult.data ?? []) as Array<Pick<SemesterRow, "id" | "codigo" | "nome">>
  );
  const classesById = buildMapById(
    (ruleClassesResult.data ?? []) as Array<Pick<ClassRow, "id" | "codigo" | "nome">>
  );
  const areasById = buildMapById((ruleAreasResult.data ?? []) as Array<Pick<AreaRow, "id" | "nome">>);
  const courseOffersByCourseId = new Map<
    string,
    Array<Pick<OfferRow, "id" | "curso_id" | "nome_exibicao">>
  >();
  const courseSemestersByOfferId = new Map<
    string,
    Array<Pick<SemesterRow, "id" | "oferta_curso_unidade_id" | "codigo" | "nome">>
  >();
  const courseClassesByOfferId = new Map<
    string,
    Array<
      Pick<
        ClassRow,
        "id" | "semestre_id" | "oferta_curso_unidade_id" | "periodo_curricular" | "codigo" | "nome"
      >
    >
  >();
  const courseAreasByOfferId = new Map<
    string,
    Array<Pick<AreaRow, "id" | "oferta_curso_unidade_id" | "nome">>
  >();

  const modelsByCourseId = new Map<string, ModelRow[]>();
  const groupsByModelId = new Map<string, GroupRow[]>();
  const criteriaByGroupId = new Map<string, CriterionRow[]>();
  const optionsByCriterionId = new Map<string, CriterionOptionRow[]>();
  const applicationRulesByModelId = new Map<string, ModelApplicationRuleRow[]>();
  const requiredDocumentsByCourseId = new Map<string, RequiredDocumentRow[]>();

  for (const modelRow of modelRows) {
    pushToMap(modelsByCourseId, modelRow.curso_id, modelRow);
  }

  for (const groupRow of groupRows) {
    pushToMap(groupsByModelId, groupRow.modelo_avaliacao_curso_id, groupRow);
  }

  for (const criterionRow of criterionRows) {
    pushToMap(criteriaByGroupId, criterionRow.grupo_modelo_avaliacao_id, criterionRow);
  }

  for (const criterionOptionRow of criterionOptionRows) {
    pushToMap(
      optionsByCriterionId,
      criterionOptionRow.criterio_modelo_avaliacao_id,
      criterionOptionRow
    );
  }

  for (const applicationRuleRow of modelApplicationRuleRows) {
    pushToMap(applicationRulesByModelId, applicationRuleRow.modelo_avaliacao_curso_id, applicationRuleRow);
  }

  for (const requiredDocumentRow of requiredDocumentRows) {
    pushToMap(requiredDocumentsByCourseId, requiredDocumentRow.curso_id, requiredDocumentRow);
  }

  for (const courseOfferRow of courseOfferRows) {
    pushToMap(courseOffersByCourseId, courseOfferRow.curso_id, courseOfferRow);
  }

  for (const courseSemesterRow of courseSemesterRows) {
    if (!courseSemesterRow.oferta_curso_unidade_id) {
      continue;
    }

    pushToMap(courseSemestersByOfferId, courseSemesterRow.oferta_curso_unidade_id, courseSemesterRow);
  }

  const courseSemesterById = buildMapById(courseSemesterRows);

  for (const courseClassRow of courseClassRows) {
    const resolvedOfferId =
      courseClassRow.oferta_curso_unidade_id ??
      courseSemesterById.get(courseClassRow.semestre_id)?.oferta_curso_unidade_id ??
      null;

    if (!resolvedOfferId) {
      continue;
    }

    pushToMap(courseClassesByOfferId, resolvedOfferId, courseClassRow);
  }

  for (const courseAreaRow of courseAreaRows) {
    if (!courseAreaRow.oferta_curso_unidade_id) {
      continue;
    }

    pushToMap(courseAreasByOfferId, courseAreaRow.oferta_curso_unidade_id, courseAreaRow);
  }

  const baseCourses = courseRows
    .map((courseRow) => {
      const institutionName =
        institutionsById.get(courseRow.instituicao_id)?.nome ?? "Instituicao nao identificada";
      const sourceModels = [...(modelsByCourseId.get(courseRow.id) ?? [])].sort(sortModels);
      const sourceGroups = sourceModels.flatMap((modelRow) =>
        [...(groupsByModelId.get(modelRow.id) ?? [])].sort(sortGroups)
      );
      const sourceCriteria = sourceGroups.flatMap((groupRow) =>
        [...(criteriaByGroupId.get(groupRow.id) ?? [])].sort(sortCriteria)
      );
      const sourceDocuments = [...(requiredDocumentsByCourseId.get(courseRow.id) ?? [])].sort(
        sortRequiredDocuments
      );
      const status = resolveConfigurationStatus({
        modelCount: sourceModels.length,
        groupCount: sourceGroups.length,
        criterionCount: sourceCriteria.length,
        requiredDocumentCount: sourceDocuments.length
      });
      const courseScopedOffers = [...(courseOffersByCourseId.get(courseRow.id) ?? [])].sort(
        (left, right) =>
          compareByLocale(left.nome_exibicao ?? left.id, right.nome_exibicao ?? right.id)
      );
      const applicationRuleOptions: CourseConfigurationModelApplicationRuleOptions = {
        offers: courseScopedOffers.map((offerRow) => ({
          id: offerRow.id,
          label: offerRow.nome_exibicao ?? "Oferta sem nome"
        })),
        semesters: courseScopedOffers.flatMap((offerRow) =>
          [...(courseSemestersByOfferId.get(offerRow.id) ?? [])]
            .sort((left, right) => compareByLocale(left.codigo, right.codigo))
            .map((semesterRow) => ({
              id: semesterRow.id,
              offerId: offerRow.id,
              label: `${semesterRow.codigo} - ${semesterRow.nome}`
            }))
        ),
        classes: courseScopedOffers.flatMap((offerRow) =>
          [...(courseClassesByOfferId.get(offerRow.id) ?? [])]
            .sort((left, right) => compareByLocale(left.codigo, right.codigo))
            .map((classRow) => {
              const semesterLabel =
                courseSemesterById.get(classRow.semestre_id)?.codigo ?? "Sem semestre";

              return {
                id: classRow.id,
                offerId: offerRow.id,
                semesterId: classRow.semestre_id,
                curricularPeriod: classRow.periodo_curricular,
                label: `${classRow.codigo} - ${classRow.nome} (${semesterLabel})`
              };
            })
        ),
        areas: courseScopedOffers.flatMap((offerRow) =>
          [...(courseAreasByOfferId.get(offerRow.id) ?? [])]
            .sort((left, right) => compareByLocale(left.nome, right.nome))
            .map((areaRow) => ({
              id: areaRow.id,
              offerId: offerRow.id,
              label: areaRow.nome
            }))
        )
      };

      return {
        id: courseRow.id,
        institutionId: courseRow.instituicao_id,
        institutionName,
        courseCode: courseRow.codigo,
        courseName: courseRow.nome,
        courseSlug: courseRow.slug,
        isActive: courseRow.ativo,
        modelCount: sourceModels.length,
        groupCount: sourceGroups.length,
        criterionCount: sourceCriteria.length,
        requiredDocumentCount: sourceDocuments.length,
        status,
        sourceConfigurationAvailable: false,
        canDuplicateFromFisioterapia: false,
        duplicateBaseBlockedReason: null,
        duplicateBaseSourceLabel: null,
        importBaseSourceLabel: null,
        importBaseModelOptions: [],
        hasReusableInitialModel: false,
        applicationRuleOptions,
        models: sourceModels.map((modelRow) => {
          const modelGroups = [...(groupsByModelId.get(modelRow.id) ?? [])].sort(sortGroups);
          const sourceApplicationRules = [...(applicationRulesByModelId.get(modelRow.id) ?? [])]
            .sort(sortModelApplicationRules);
          const applicationRules = sourceApplicationRules
            .map((ruleRow) => {
              const summary = buildModelApplicationRuleSummary({
                rule: ruleRow,
                offersById: offersById as Map<string, OfferRow>,
                semestersById: semestersById as Map<string, SemesterRow>,
                classesById: classesById as Map<string, ClassRow>,
                areasById: areasById as Map<string, AreaRow>
              });

              return {
                id: ruleRow.id,
                modelId: ruleRow.modelo_avaliacao_curso_id,
                offerId: ruleRow.oferta_curso_unidade_id,
                curricularPeriod: ruleRow.periodo_curricular,
                semesterId: ruleRow.semestre_id,
                classId: ruleRow.turma_id,
                stageAreaId: ruleRow.area_estagio_id,
                priority: ruleRow.prioridade,
                active: ruleRow.ativo,
                metadata: ruleRow.metadata,
                createdAt: ruleRow.created_at,
                updatedAt: ruleRow.updated_at,
                offerName: summary.offerName,
                semesterLabel: summary.semesterLabel,
                classLabel: summary.classLabel,
                areaName: summary.areaName,
                specificity: summary.specificity,
                summary: summary.summary
              } satisfies CourseConfigurationModelApplicationRuleEntry;
            });

          return {
            id: modelRow.id,
            code: modelRow.codigo,
            name: modelRow.nome,
            description: modelRow.descricao,
            version: modelRow.versao,
            modality: modelRow.modalidade,
            isLaunchDefault: modelRow.padrao_lancamento,
            isActive: modelRow.ativo,
            applicationRules,
            applicationRuleConflictWarning:
              resolveModelApplicationRuleConflictWarning(sourceApplicationRules),
            groupWeightDiagnostic: buildWeightDiagnostic(
              modelGroups.filter((groupRow) => groupRow.ativo).map((groupRow) => groupRow.peso_percentual),
              "Sem grupos ativos"
            )
          };
        }),
        groups: sourceGroups.map((groupRow) => ({
          id: groupRow.id,
          modelId: groupRow.modelo_avaliacao_curso_id,
          modelCode:
            modelsById.get(groupRow.modelo_avaliacao_curso_id)?.codigo ??
            "modelo-nao-identificado",
          code: groupRow.codigo,
          name: groupRow.nome,
          order: groupRow.ordem,
          weightPercent: groupRow.peso_percentual,
          isActive: groupRow.ativo,
          criterionWeightDiagnostic: buildWeightDiagnostic(
            (criteriaByGroupId.get(groupRow.id) ?? [])
              .filter((criterionRow) => criterionRow.ativo)
              .map((criterionRow) => criterionRow.peso_percentual),
            "Sem criterios ativos"
          )
        })),
        criteria: sourceCriteria.map((criterionRow) => ({
          id: criterionRow.id,
          groupId: criterionRow.grupo_modelo_avaliacao_id,
          groupName:
            groupsById.get(criterionRow.grupo_modelo_avaliacao_id)?.nome ??
            "Grupo nao identificado",
          modelId:
            groupsById.get(criterionRow.grupo_modelo_avaliacao_id)?.modelo_avaliacao_curso_id ??
            "",
          modelModality:
            modelsById.get(
              groupsById.get(criterionRow.grupo_modelo_avaliacao_id)?.modelo_avaliacao_curso_id ??
                ""
            )?.modalidade ?? "descritiva",
          code: criterionRow.codigo,
          name: criterionRow.nome,
          description: criterionRow.descricao,
          order: criterionRow.ordem,
          weightPercent: criterionRow.peso_percentual,
          maxScale: criterionRow.escala_maxima,
          isActive: criterionRow.ativo,
          rubricOptions: [...(optionsByCriterionId.get(criterionRow.id) ?? [])]
            .sort(sortCriterionOptions)
            .map((optionRow) => ({
              id: optionRow.id,
              label: optionRow.rotulo,
              description: optionRow.descricao,
              scoreValue: optionRow.valor_nota,
              order: optionRow.ordem,
              isActive: optionRow.ativo
            }))
        })),
        requiredDocuments: sourceDocuments.map((requiredDocumentRow) => ({
          id: requiredDocumentRow.id,
          typeId: requiredDocumentRow.tipo_documento_id,
          code: requiredDocumentRow.codigo,
          typeCode:
            documentTypesById.get(requiredDocumentRow.tipo_documento_id)?.codigo ??
            "TIPO_NAO_IDENTIFICADO",
          typeName:
            documentTypesById.get(requiredDocumentRow.tipo_documento_id)?.nome ??
            "Tipo nao identificado",
          displayName: requiredDocumentRow.nome_exibicao,
          description: requiredDocumentRow.descricao,
          isRequired: requiredDocumentRow.obrigatorio,
          order: requiredDocumentRow.ordem,
          isActive: requiredDocumentRow.ativo
        }))
      } satisfies CourseConfigurationCourseEntry;
    })
    .sort((left, right) => {
      const institutionComparison = compareByLocale(left.institutionName, right.institutionName);

      if (institutionComparison !== 0) {
        return institutionComparison;
      }

      return compareByLocale(left.courseName, right.courseName);
    });
  const configuredFisioterapiaCourses = [...baseCourses]
    .filter(isConfiguredFisioterapiaCourse)
    .sort(compareConfiguredFisioterapiaSources);
  const globalFisioterapiaSource = configuredFisioterapiaCourses[0] ?? null;
  const globalFisioterapiaSourceLabel = globalFisioterapiaSource
    ? buildFisioterapiaSourceLabel(globalFisioterapiaSource, "global_default")
    : null;
  const courses = baseCourses.map((course) => {
    const resolvedCopySource = resolveFisioterapiaSourceForCourse(
      course,
      configuredFisioterapiaCourses
    );
    const resolvedImportSource =
      resolvedCopySource && resolvedCopySource.course.id !== course.id ? resolvedCopySource : null;
    const importBaseModelOptions = resolvedImportSource
      ? [...resolvedImportSource.course.models]
          .filter((sourceModel) => sourceModel.isActive)
          .sort((left, right) => {
            const nameComparison = compareByLocale(left.name, right.name);

            if (nameComparison !== 0) {
              return nameComparison;
            }

            return left.version - right.version;
          })
          .map((sourceModel) => {
            const modelGroups = resolvedImportSource.course.groups.filter(
              (group) => group.modelId === sourceModel.id
            );
            const modelGroupIds = new Set(modelGroups.map((group) => group.id));
            const modelCriteria = resolvedImportSource.course.criteria.filter((criterion) =>
              modelGroupIds.has(criterion.groupId)
            );

            return {
              id: sourceModel.id,
              sourceCourseId: resolvedImportSource.course.id,
              code: sourceModel.code,
              name: sourceModel.name,
              modality: sourceModel.modality,
              version: sourceModel.version,
              groupCount: modelGroups.length,
              criterionCount: modelCriteria.length,
              rubricOptionCount: modelCriteria.reduce(
                (total, criterion) => total + criterion.rubricOptions.length,
                0
              ),
              portableCurricularRuleCount: sourceModel.applicationRules.filter(
                isPortableCurricularApplicationRule
              ).length
            } satisfies CourseConfigurationImportableModelOption;
          })
      : [];

    return {
      ...course,
      sourceConfigurationAvailable: Boolean(resolvedCopySource),
      duplicateBaseSourceLabel: resolvedCopySource?.label ?? null,
      importBaseSourceLabel: resolvedImportSource?.label ?? null,
      importBaseModelOptions,
      ...resolveDuplicateBaseState({
        courseId: course.id,
        sourceCourseId: resolvedCopySource?.course.id ?? null,
        modelCount: course.modelCount,
        groupCount: course.groupCount,
        criterionCount: course.criterionCount,
        requiredDocumentCount: course.requiredDocumentCount
      })
    };
  });

  return {
    summary: {
      totalCourses: courses.length,
      configuredCourses: courses.filter((course) => course.status === "Configurado").length,
      partialCourses: courses.filter((course) => course.status === "Parcial").length,
      unconfiguredCourses: courses.filter((course) => course.status === "Sem configuracao").length,
      totalModels: modelRows.length,
      totalRequiredDocuments: requiredDocumentRows.length
    },
    courses,
    copyTargetOptions: courses
      .filter(
        (course) =>
          course.canDuplicateFromFisioterapia
      )
      .map((course) => ({
        courseId: course.id,
        institutionId: course.institutionId,
        institutionName: course.institutionName,
        courseCode: course.courseCode,
        courseName: course.courseName,
        status: course.status,
        sourceLabel:
          course.duplicateBaseSourceLabel ?? globalFisioterapiaSourceLabel ?? "Origem indisponivel"
      })),
    documentTypeOptions: documentTypeRows
      .filter((documentTypeRow) => documentTypeRow.ativo)
      .map((documentTypeRow) => ({
        id: documentTypeRow.id,
        code: documentTypeRow.codigo,
        name: documentTypeRow.nome
      })),
    fisioterapiaBaseSourceLabel: globalFisioterapiaSourceLabel
  };
}
