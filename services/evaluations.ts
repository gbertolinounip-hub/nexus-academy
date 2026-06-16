import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatLaunchIdentity, resolveLaunchIdentity } from "@/lib/utils/format";
import {
  loadReleasedEnrollmentContextsForUser,
  resolveExceptionalReleaseVisualNoticeFromRows
} from "@/services/exceptional-releases";
import type { Database } from "@/types/database";
import type {
  EvaluationModelApplicationRule,
  EvaluationModelMode,
  EvaluationModelSelectionContext,
  ExceptionalReleaseVisualNotice,
  SessionUser
} from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type RubricGroupRow = Database["public"]["Tables"]["grupos_avaliacao"]["Row"];
type RubricCriterionRow = Database["public"]["Tables"]["criterios_avaliacao"]["Row"];
type CourseEvaluationModelRow =
  Database["public"]["Tables"]["modelos_avaliacao_curso"]["Row"];
type CourseEvaluationGroupRow =
  Database["public"]["Tables"]["grupos_modelo_avaliacao"]["Row"];
type CourseEvaluationCriterionRow =
  Database["public"]["Tables"]["criterios_modelo_avaliacao"]["Row"];
type CourseEvaluationCriterionOptionRow =
  Database["public"]["Tables"]["opcoes_criterio_modelo_avaliacao"]["Row"];
type CourseEvaluationModelApplicationRuleRow =
  Database["public"]["Tables"]["regras_aplicacao_modelo_avaliacao"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type StageAreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type EvaluationItemRow = Database["public"]["Tables"]["itens_avaliados"]["Row"];

export type EvaluationRuntimeSource =
  | "application_rule"
  | "course_default"
  | "latest_active_model"
  | "saved_evaluation"
  | "legacy_global";

export interface EvaluationStudentOption {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  registration: string;
  classId: string;
  className: string;
  semesterId: string;
  semesterCode: string;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  label: string;
}

export interface EvaluationRubricCriterion {
  id: string;
  legacyCriterionId: string;
  modelCriterionId: string | null;
  code: string;
  name: string;
  description: string | null;
  weightPercentage: number;
  maxScore: number;
  options: EvaluationRubricCriterionOption[];
}

export interface EvaluationRubricCriterionOption {
  id: string;
  label: string;
  description: string | null;
  scoreValue: number;
  order: number;
  active: boolean;
}

export interface EvaluationRubricGroup {
  id: string;
  code: string;
  name: string;
  weightPercentage: number;
  criteria: EvaluationRubricCriterion[];
}

export interface EvaluationRevisionChainEntry {
  id: string;
  label: string;
  reference: string;
  isLegacyRecord: boolean;
  launchType: EvaluationRow["tipo_lancamento"];
  status: EvaluationRow["status"];
  evaluatedAt: string;
  isCurrent: boolean;
}

export interface EvaluationActionLink {
  href: string;
  label: string;
}

export type EvaluationFormMode = "create" | "edit" | "readonly" | "review";

export interface EvaluationFormInitialValues {
  evaluationId?: string;
  evaluationOriginId?: string;
  evaluationRootId?: string;
  matriculaTurmaId: string;
  tipoLançamento: EvaluationRow["tipo_lancamento"];
  referencia: string;
  observacoes: string;
  status: EvaluationRow["status"];
  avaliadoEm: string;
  criterionScores: Record<string, string>;
  criterionFeedbacks: Record<string, string>;
  criterionOptionSelections: Record<string, string>;
  baselineCriterionScores: Record<string, string>;
  baselineCriterionFeedbacks: Record<string, string>;
  baselineCriterionOptionSelections: Record<string, string>;
  effectiveCriterionScores: Record<string, string>;
  effectiveCriterionFeedbacks: Record<string, string>;
  effectiveCriterionOptionSelections: Record<string, string>;
  changedCriterionIds: string[];
}

export interface EvaluationRuntimeFormContext {
  enrollmentId: string;
  courseId: string | null;
  offerId: string | null;
  modelId: string | null;
  modelCode: string | null;
  modelName: string | null;
  modality: EvaluationModelMode;
  source: EvaluationRuntimeSource;
  applicationRuleId: string | null;
  applicationRuleSummary: string | null;
  rubricGroups: EvaluationRubricGroup[];
}

export interface EvaluationFormPageData {
  professor: {
    id: string;
    name: string;
    email: string;
  };
  studentOptions: EvaluationStudentOption[];
  rubricGroups: EvaluationRubricGroup[];
  evaluationMode: EvaluationModelMode;
  evaluationSource: EvaluationRuntimeSource;
  evaluationModelId: string | null;
  evaluationModelCode: string | null;
  evaluationModelName: string | null;
  runtimeContextsByEnrollmentId: Record<string, EvaluationRuntimeFormContext>;
  mode: EvaluationFormMode;
  initialValues?: EvaluationFormInitialValues;
  readOnlyMessage?: string | null;
  contextMessage?: string | null;
  revisionChain: EvaluationRevisionChainEntry[];
  revisionAction?: EvaluationActionLink | null;
}

export interface EvaluationFormLoadResult {
  formData: EvaluationFormPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface EvaluationReviewLoadResult extends EvaluationFormLoadResult {
  redirectToEvaluationId?: string | null;
}

export interface ProfessorEvaluationListItem {
  id: string;
  studentName: string;
  registration: string;
  className: string;
  semesterCode: string;
  launchType: EvaluationRow["tipo_lancamento"];
  reference: string;
  isLegacyRecord: boolean;
  status: EvaluationRow["status"];
  evaluatedAt: string;
  actionLabel: string;
  versionLabel: string;
  relationHint: string | null;
}

export interface ProfessorEvaluationListPageData {
  professor: {
    id: string;
    name: string;
    email: string;
  };
  evaluations: ProfessorEvaluationListItem[];
}

export interface ProfessorEvaluationListLoadResult {
  listData: ProfessorEvaluationListPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface EmptyState {
  title: string;
  description: string;
}

interface ProfessorEvaluationContext {
  professor: EvaluationFormPageData["professor"];
  studentOptions: EvaluationStudentOption[];
  studentOptionMap: Map<string, EvaluationStudentOption>;
  runtimeContextByEnrollmentId: Map<string, EvaluationRuntimeContext>;
  defaultRuntimeContext: EvaluationRuntimeContext;
}

export interface EvaluationRuntimeContext {
  enrollmentId: string;
  courseId: string | null;
  offerId: string | null;
  modelId: string | null;
  modelCode: string | null;
  modelName: string | null;
  modality: EvaluationModelMode;
  source: EvaluationRuntimeSource;
  applicationRuleId: string | null;
  applicationRuleSummary: string | null;
  rubricGroups: EvaluationRubricGroup[];
}

interface EvaluationModelRuntimeBase {
  modelId: string;
  modelCode: string | null;
  modelName: string | null;
  modality: EvaluationModelMode;
  rubricGroups: EvaluationRubricGroup[];
}

interface EnrollmentEvaluationSelectionContext extends EvaluationModelSelectionContext {
  enrollmentId: string;
  courseId: string | null;
  offerId: string | null;
}

interface RuntimeCourseModelSelection {
  model: CourseEvaluationModelRow;
  source: Exclude<EvaluationRuntimeSource, "application_rule" | "legacy_global">;
}

interface EvaluationChainBundle {
  chainRows: EvaluationRow[];
  itemsByEvaluationId: Map<string, EvaluationItemRow[]>;
  latestPublishedEvaluation: EvaluationRow | null;
  directDraftRevision: EvaluationRow | null;
  baselineScores: Record<string, string>;
  baselineFeedbacks: Record<string, string>;
  baselineOptionSelections: Record<string, string>;
  effectiveScores: Record<string, string>;
  effectiveFeedbacks: Record<string, string>;
  effectiveOptionSelections: Record<string, string>;
  editableScores: Record<string, string>;
  editableFeedbacks: Record<string, string>;
  editableOptionSelections: Record<string, string>;
  changedCriterionIds: string[];
  revisionChain: EvaluationRevisionChainEntry[];
}

function buildEmptyState(title: string, description: string): EvaluationFormLoadResult {
  return {
    formData: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildReviewEmptyState(
  title: string,
  description: string,
  redirectToEvaluationId?: string | null
): EvaluationReviewLoadResult {
  return {
    formData: null,
    emptyState: {
      title,
      description
    },
    redirectToEvaluationId: redirectToEvaluationId ?? null
  };
}

function buildListEmptyState(
  title: string,
  description: string
): ProfessorEvaluationListLoadResult {
  return {
    listData: null,
    emptyState: {
      title,
      description
    }
  };
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function filterSemestersToCurrentUnit(
  semesters: SemesterRow[],
  currentUser: SessionUser
) {
  if (!currentUser.unitId) {
    return semesters;
  }

  return semesters.filter((semester) => semester.unidade_id === currentUser.unitId);
}

function filterClassesToSemesters(classRows: ClassRow[], semesters: SemesterRow[]) {
  const visibleSemesterIds = new Set(semesters.map((semester) => semester.id));
  return classRows.filter((classGroup) => visibleSemesterIds.has(classGroup.semestre_id));
}

function filterEnrollmentsToClasses(enrollments: EnrollmentRow[], classRows: ClassRow[]) {
  const visibleClassIds = new Set(classRows.map((classGroup) => classGroup.id));
  return enrollments.filter((enrollment) => visibleClassIds.has(enrollment.turma_id));
}

function filterActiveStudentUsers(studentUsers: UserRow[]) {
  return studentUsers.filter((studentUser) => studentUser.ativo);
}

function filterEnrollmentsToStudentIds(
  enrollments: EnrollmentRow[],
  studentIds: Set<string>
) {
  return enrollments.filter((enrollment) => studentIds.has(enrollment.aluno_id));
}

function buildEvaluationStudentOption(input: {
  enrollment: Pick<EnrollmentRow, "id" | "aluno_id" | "turma_id">;
  studentRowsById: Map<string, StudentRow>;
  studentUsersById: Map<string, UserRow>;
  classRowsById: Map<string, ClassRow>;
  semestersById: Map<string, SemesterRow>;
}) {
  const studentRow = input.studentRowsById.get(input.enrollment.aluno_id);
  const studentUser = input.studentUsersById.get(input.enrollment.aluno_id);
  const classGroup = input.classRowsById.get(input.enrollment.turma_id);
  const semester = classGroup
    ? input.semestersById.get(classGroup.semestre_id)
    : undefined;

  if (!studentRow || !studentUser || !classGroup || !semester) {
    return null;
  }

  const studentName = studentRow.nome_social ?? studentUser.nome_completo;
  const label = `${studentName} · ${studentRow.matricula} · ${classGroup.nome} · ${semester.codigo}`;

  return {
    enrollmentId: input.enrollment.id,
    studentId: studentUser.id,
    studentName,
    registration: studentRow.matricula,
    classId: classGroup.id,
    className: classGroup.nome,
    semesterId: semester.id,
    semesterCode: semester.codigo,
    exceptionalReleaseNotice: null,
    label
  } satisfies EvaluationStudentOption;
}

function compareCourseModelsForRuntime(
  left: CourseEvaluationModelRow,
  right: CourseEvaluationModelRow
) {
  // Seleção de fallback por curso quando nenhuma regra específica se aplica.
  if (left.padrao_lancamento !== right.padrao_lancamento) {
    return left.padrao_lancamento ? -1 : 1;
  }

  if (left.versao !== right.versao) {
    return right.versao - left.versao;
  }

  const updatedAtDifference = safeSortableTimestamp(right.updated_at).localeCompare(
    safeSortableTimestamp(left.updated_at)
  );

  if (updatedAtDifference !== 0) {
    return updatedAtDifference;
  }

  return right.id.localeCompare(left.id);
}

export function normalizeEvaluationModelApplicationRule(
  ruleRow: CourseEvaluationModelApplicationRuleRow
): EvaluationModelApplicationRule {
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
    updatedAt: ruleRow.updated_at
  };
}

export function matchesEvaluationModelApplicationRule(
  rule: EvaluationModelApplicationRule,
  context: EvaluationModelSelectionContext
) {
  if (rule.offerId !== null && rule.offerId !== context.offerId) {
    return false;
  }

  if (rule.curricularPeriod !== null && rule.curricularPeriod !== context.curricularPeriod) {
    return false;
  }

  if (rule.semesterId !== null && rule.semesterId !== context.semesterId) {
    return false;
  }

  if (rule.classId !== null && rule.classId !== context.classId) {
    return false;
  }

  if (rule.stageAreaId !== null && rule.stageAreaId !== context.stageAreaId) {
    return false;
  }

  return true;
}

export function computeEvaluationModelApplicationRuleSpecificity(
  rule: EvaluationModelApplicationRule
) {
  return [
    rule.offerId,
    rule.curricularPeriod,
    rule.semesterId,
    rule.classId,
    rule.stageAreaId
  ].filter((value) => value !== null).length;
}

function computeEvaluationModelApplicationRulePrecedenceScore(
  rule: EvaluationModelApplicationRule
) {
  return (
    (rule.classId ? 16 : 0) +
    (rule.stageAreaId ? 8 : 0) +
    (rule.curricularPeriod ? 4 : 0) +
    (rule.semesterId ? 2 : 0) +
    (rule.offerId ? 1 : 0)
  );
}

export function compareEvaluationModelApplicationRulesForSelection(
  left: EvaluationModelApplicationRule,
  right: EvaluationModelApplicationRule
) {
  const specificityDifference =
    computeEvaluationModelApplicationRuleSpecificity(right) -
    computeEvaluationModelApplicationRuleSpecificity(left);

  if (specificityDifference !== 0) {
    return specificityDifference;
  }

  const precedenceDifference =
    computeEvaluationModelApplicationRulePrecedenceScore(right) -
    computeEvaluationModelApplicationRulePrecedenceScore(left);

  if (precedenceDifference !== 0) {
    return precedenceDifference;
  }

  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  const updatedAtDifference = safeSortableTimestamp(right.updatedAt).localeCompare(
    safeSortableTimestamp(left.updatedAt)
  );

  if (updatedAtDifference !== 0) {
    return updatedAtDifference;
  }

  return right.id.localeCompare(left.id);
}

function hasEquivalentEvaluationModelApplicationRuleRank(
  left: EvaluationModelApplicationRule,
  right: EvaluationModelApplicationRule
) {
  return (
    computeEvaluationModelApplicationRuleSpecificity(left) ===
      computeEvaluationModelApplicationRuleSpecificity(right) &&
    computeEvaluationModelApplicationRulePrecedenceScore(left) ===
      computeEvaluationModelApplicationRulePrecedenceScore(right) &&
    left.priority === right.priority &&
    safeSortableTimestamp(left.updatedAt) === safeSortableTimestamp(right.updatedAt)
  );
}

export function resolveEvaluationModelApplicationRulesForContext(
  rules: EvaluationModelApplicationRule[],
  context: EvaluationModelSelectionContext
) {
  const matchingRules = rules
    .filter((rule) => rule.active)
    .filter((rule) => matchesEvaluationModelApplicationRule(rule, context))
    .sort(compareEvaluationModelApplicationRulesForSelection);

  const topRule = matchingRules[0] ?? null;
  const secondRule = matchingRules[1] ?? null;
  const hasAmbiguousTopMatch =
    Boolean(topRule) &&
    Boolean(secondRule) &&
    hasEquivalentEvaluationModelApplicationRuleRank(topRule!, secondRule!);

  return {
    matchingRules,
    topRule,
    hasAmbiguousTopMatch
  };
}

function selectRuntimeCourseModelsByCourseId(modelRows: CourseEvaluationModelRow[]) {
  const rowsByCourseId = new Map<string, CourseEvaluationModelRow[]>();
  const selectedModelByCourseId = new Map<string, RuntimeCourseModelSelection>();

  for (const modelRow of modelRows) {
    const currentRows = rowsByCourseId.get(modelRow.curso_id) ?? [];
    currentRows.push(modelRow);
    rowsByCourseId.set(modelRow.curso_id, currentRows);
  }

  for (const [courseId, courseModelRows] of rowsByCourseId.entries()) {
    const sortedCourseModelRows = [...courseModelRows].sort(compareCourseModelsForRuntime);
    const launchDefaultRows = sortedCourseModelRows.filter((modelRow) => modelRow.padrao_lancamento);

    if (sortedCourseModelRows.length > 1 && launchDefaultRows.length === 0) {
      console.warn(
        "[evaluations] Multiple active course models without padrao_lancamento; falling back to latest active model.",
        {
          courseId,
          modelIds: sortedCourseModelRows.map((modelRow) => modelRow.id)
        }
      );
    }

    if (launchDefaultRows.length > 1) {
      console.warn(
        "[evaluations] Multiple active course models marked as padrao_lancamento; using runtime sort fallback.",
        {
          courseId,
          modelIds: launchDefaultRows.map((modelRow) => modelRow.id)
        }
      );
    }

    const selectedModel = sortedCourseModelRows[0];

    if (selectedModel) {
      selectedModelByCourseId.set(courseId, {
        model: selectedModel,
        source: selectedModel.padrao_lancamento ? "course_default" : "latest_active_model"
      });
    }
  }

  return selectedModelByCourseId;
}

function buildLegacyRubricGroups(
  rubricGroups: RubricGroupRow[],
  rubricCriteria: RubricCriterionRow[]
) {
  return rubricGroups.map((group) => ({
    id: group.id,
    code: group.codigo,
    name: group.nome,
    weightPercentage: Number(group.peso_percentual),
    criteria: rubricCriteria
      .filter((criterion) => criterion.grupo_id === group.id)
      .map((criterion) => ({
        id: criterion.id,
        legacyCriterionId: criterion.id,
        modelCriterionId: null,
        code: criterion.codigo,
        name: criterion.nome,
        description: criterion.descricao,
        weightPercentage: Number(criterion.peso_percentual),
        maxScore: Number(criterion.escala_maxima),
        options: []
      }))
  })) satisfies EvaluationRubricGroup[];
}

function buildFallbackRuntimeContext(
  enrollmentId: string,
  rubricGroups: EvaluationRubricGroup[] = []
): EvaluationRuntimeContext {
  return {
    enrollmentId,
    courseId: null,
    offerId: null,
    modelId: null,
    modelCode: null,
    modelName: null,
    modality: "descritiva",
    source: "legacy_global",
    applicationRuleId: null,
    applicationRuleSummary: null,
    rubricGroups
  };
}

function buildRuntimeContextFromModelBase(input: {
  enrollmentId: string;
  courseId: string | null;
  offerId: string | null;
  source: EvaluationRuntimeSource;
  modelBase: EvaluationModelRuntimeBase;
  applicationRuleId?: string | null;
  applicationRuleSummary?: string | null;
}): EvaluationRuntimeContext {
  return {
    enrollmentId: input.enrollmentId,
    courseId: input.courseId,
    offerId: input.offerId,
    modelId: input.modelBase.modelId,
    modelCode: input.modelBase.modelCode,
    modelName: input.modelBase.modelName,
    modality: input.modelBase.modality,
    source: input.source,
    applicationRuleId: input.applicationRuleId ?? null,
    applicationRuleSummary: input.applicationRuleSummary ?? null,
    rubricGroups: input.modelBase.rubricGroups
  };
}

function serializeEvaluationRuntimeContext(
  runtimeContext: EvaluationRuntimeContext
): EvaluationRuntimeFormContext {
  return {
    enrollmentId: runtimeContext.enrollmentId,
    courseId: runtimeContext.courseId,
    offerId: runtimeContext.offerId,
    modelId: runtimeContext.modelId,
    modelCode: runtimeContext.modelCode,
    modelName: runtimeContext.modelName,
    modality: runtimeContext.modality,
    source: runtimeContext.source,
    applicationRuleId: runtimeContext.applicationRuleId,
    applicationRuleSummary: runtimeContext.applicationRuleSummary,
    rubricGroups: runtimeContext.rubricGroups
  };
}

function sortRubricOptionRows(
  left: CourseEvaluationCriterionOptionRow,
  right: CourseEvaluationCriterionOptionRow
) {
  if (left.ordem !== right.ordem) {
    return left.ordem - right.ordem;
  }

  return left.rotulo.localeCompare(right.rotulo, "pt-BR");
}

function buildEvaluationModelRuntimeBaseMap(input: {
  modelRows: CourseEvaluationModelRow[];
  modelGroupRows: CourseEvaluationGroupRow[];
  modelCriterionRows: CourseEvaluationCriterionRow[];
  modelCriterionOptionRows: CourseEvaluationCriterionOptionRow[];
  runtimeRubricCriteria: RubricCriterionRow[];
}) {
  const modelRowById = new Map(input.modelRows.map((modelRow) => [modelRow.id, modelRow]));
  const modelGroupsByModelId = new Map<string, CourseEvaluationGroupRow[]>();
  const modelCriteriaByGroupId = new Map<string, CourseEvaluationCriterionRow[]>();
  const modelOptionsByCriterionId = new Map<string, CourseEvaluationCriterionOptionRow[]>();

  for (const modelGroupRow of input.modelGroupRows) {
    const currentRows = modelGroupsByModelId.get(modelGroupRow.modelo_avaliacao_curso_id) ?? [];
    currentRows.push(modelGroupRow);
    modelGroupsByModelId.set(modelGroupRow.modelo_avaliacao_curso_id, currentRows);
  }

  for (const modelCriterionRow of input.modelCriterionRows) {
    const currentRows =
      modelCriteriaByGroupId.get(modelCriterionRow.grupo_modelo_avaliacao_id) ?? [];
    currentRows.push(modelCriterionRow);
    modelCriteriaByGroupId.set(modelCriterionRow.grupo_modelo_avaliacao_id, currentRows);
  }

  for (const modelCriterionOptionRow of input.modelCriterionOptionRows) {
    const currentRows =
      modelOptionsByCriterionId.get(modelCriterionOptionRow.criterio_modelo_avaliacao_id) ?? [];
    currentRows.push(modelCriterionOptionRow);
    modelOptionsByCriterionId.set(
      modelCriterionOptionRow.criterio_modelo_avaliacao_id,
      currentRows
    );
  }

  const legacyCriterionByCode = new Map<string, RubricCriterionRow>();

  for (const runtimeCriterion of input.runtimeRubricCriteria) {
    if (!legacyCriterionByCode.has(runtimeCriterion.codigo)) {
      legacyCriterionByCode.set(runtimeCriterion.codigo, runtimeCriterion);
    }
  }

  const runtimeBaseByModelId = new Map<string, EvaluationModelRuntimeBase>();

  for (const modelRow of input.modelRows) {
    const modelGroups = modelGroupsByModelId.get(modelRow.id) ?? [];

    if (!modelGroups.length) {
      continue;
    }

    let hasInvalidLegacyMapping = false;
    const rubricGroups = modelGroups
      .map((modelGroup) => {
        const groupCriteria = (modelCriteriaByGroupId.get(modelGroup.id) ?? [])
          .map((modelCriterion) => {
            const legacyCriterion = legacyCriterionByCode.get(modelCriterion.codigo);

            if (!legacyCriterion) {
              hasInvalidLegacyMapping = true;
              return null;
            }

            return {
              id: modelCriterion.id,
              legacyCriterionId: legacyCriterion.id,
              modelCriterionId: modelCriterion.id,
              code: modelCriterion.codigo,
              name: modelCriterion.nome,
              description: modelCriterion.descricao,
              weightPercentage: Number(modelCriterion.peso_percentual),
              maxScore: Number(modelCriterion.escala_maxima),
              options: [...(modelOptionsByCriterionId.get(modelCriterion.id) ?? [])]
                .sort(sortRubricOptionRows)
                .map((optionRow) => ({
                  id: optionRow.id,
                  label: optionRow.rotulo,
                  description: optionRow.descricao,
                  scoreValue: Number(optionRow.valor_nota),
                  order: optionRow.ordem,
                  active: optionRow.ativo
                }))
            } satisfies EvaluationRubricCriterion;
          })
          .filter(Boolean) as EvaluationRubricCriterion[];

        if (!groupCriteria.length) {
          return null;
        }

        return {
          id: modelGroup.id,
          code: modelGroup.codigo,
          name: modelGroup.nome,
          weightPercentage: Number(modelGroup.peso_percentual),
          criteria: groupCriteria
        } satisfies EvaluationRubricGroup;
      })
      .filter(Boolean) as EvaluationRubricGroup[];

    if (hasInvalidLegacyMapping || !rubricGroups.length) {
      continue;
    }

    runtimeBaseByModelId.set(modelRow.id, {
      modelId: modelRow.id,
      modelCode: modelRow.codigo,
      modelName: modelRow.nome,
      modality: modelRow.modalidade,
      rubricGroups
    });
  }

  return {
    modelRowById,
    runtimeBaseByModelId
  };
}

function buildEvaluationModelApplicationRuleSummary(
  rule: EvaluationModelApplicationRule,
  labels: {
    offerNamesById: Map<string, string>;
    semesterLabelsById: Map<string, string>;
    classNamesById: Map<string, string>;
    stageAreaNamesById: Map<string, string>;
  }
) {
  const parts: string[] = [];

  if (rule.classId) {
    parts.push(`Turma: ${labels.classNamesById.get(rule.classId) ?? rule.classId}`);
  }

  if (rule.stageAreaId) {
    parts.push(`Área: ${labels.stageAreaNamesById.get(rule.stageAreaId) ?? rule.stageAreaId}`);
  }

  if (rule.curricularPeriod !== null) {
    parts.push(`Período curricular: ${rule.curricularPeriod}`);
  }

  if (rule.semesterId) {
    parts.push(
      `Semestre acadêmico: ${labels.semesterLabelsById.get(rule.semesterId) ?? rule.semesterId}`
    );
  }

  if (rule.offerId) {
    parts.push(`Oferta: ${labels.offerNamesById.get(rule.offerId) ?? rule.offerId}`);
  }

  return parts.join(" · ");
}

export async function loadEvaluationRuntimeContextsForEnrollments(
  enrollmentIds: string[]
): Promise<Map<string, EvaluationRuntimeContext>> {
  const uniqueEnrollmentIds = [...new Set(enrollmentIds.filter(Boolean))];
  const runtimeContextByEnrollmentId = new Map<string, EvaluationRuntimeContext>();

  if (!uniqueEnrollmentIds.length) {
    return runtimeContextByEnrollmentId;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: enrollmentRowsData, error: enrollmentError } = await adminClient
    .from("matriculas_turma")
    .select("id, aluno_id, turma_id, oferta_curso_unidade_id")
    .in("id", uniqueEnrollmentIds);

  if (enrollmentError) {
    throw new Error(
      "Nao foi possivel carregar as matriculas para resolver a configuracao de avaliacao do curso."
    );
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as Array<
    Pick<EnrollmentRow, "id" | "aluno_id" | "turma_id" | "oferta_curso_unidade_id">
  >;

  if (!enrollmentRows.length) {
    return runtimeContextByEnrollmentId;
  }

  const studentIds = [...new Set(enrollmentRows.map((row) => row.aluno_id))];
  const classIds = [...new Set(enrollmentRows.map((row) => row.turma_id))];

  const [studentRowsResult, classRowsResult, rubricGroupsResult, rubricCriteriaResult] =
    await Promise.all([
      adminClient
        .from("alunos")
        .select("usuario_id, curso_id, oferta_curso_unidade_id")
        .in("usuario_id", studentIds),
      adminClient
        .from("turmas")
        .select("id, nome, semestre_id, oferta_curso_unidade_id, area_estagio_id, periodo_curricular")
        .in("id", classIds),
      adminClient
        .from("grupos_avaliacao")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true }),
      adminClient
        .from("criterios_avaliacao")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
    ]);

  if (
    studentRowsResult.error ||
    classRowsResult.error ||
    rubricGroupsResult.error ||
    rubricCriteriaResult.error
  ) {
    throw new Error(
      "Nao foi possivel consolidar o contexto academico necessario para identificar a modalidade da avaliacao."
    );
  }

  const studentRows = (studentRowsResult.data ?? []) as Array<
    Pick<StudentRow, "usuario_id" | "curso_id" | "oferta_curso_unidade_id">
  >;
  const classRows = (classRowsResult.data ?? []) as Array<
    Pick<
      ClassRow,
      | "id"
      | "nome"
      | "semestre_id"
      | "oferta_curso_unidade_id"
      | "area_estagio_id"
      | "periodo_curricular"
    >
  >;
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];

  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await adminClient
        .from("semestres")
        .select("id, codigo, oferta_curso_unidade_id")
        .in("id", semesterIds)
    : { data: [], error: null };

  if (semesterError) {
    throw new Error(
      "Nao foi possivel carregar os semestres das matriculas para identificar a configuracao de avaliacao."
    );
  }

  const semesterRows = (semesterRowsData ?? []) as Array<
    Pick<SemesterRow, "id" | "codigo" | "oferta_curso_unidade_id">
  >;
  const studentById = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const classById = new Map(classRows.map((row) => [row.id, row]));
  const semesterById = new Map(semesterRows.map((row) => [row.id, row]));
  const runtimeRubricGroups = (rubricGroupsResult.data ?? []) as RubricGroupRow[];
  const runtimeRubricCriteria = (rubricCriteriaResult.data ?? []) as RubricCriterionRow[];
  const legacyRubricGroups = buildLegacyRubricGroups(runtimeRubricGroups, runtimeRubricCriteria);
  const resolvedSelectionContexts = enrollmentRows.map((enrollmentRow) => {
    const classRow = classById.get(enrollmentRow.turma_id);
    const semesterRow = classRow ? semesterById.get(classRow.semestre_id) : undefined;
    const studentRow = studentById.get(enrollmentRow.aluno_id);
    const offerId =
      enrollmentRow.oferta_curso_unidade_id ??
      classRow?.oferta_curso_unidade_id ??
      semesterRow?.oferta_curso_unidade_id ??
      studentRow?.oferta_curso_unidade_id ??
      null;

    return {
      enrollmentId: enrollmentRow.id,
      courseId: studentRow?.curso_id ?? null,
      offerId,
      curricularPeriod: classRow?.periodo_curricular ?? null,
      semesterId: classRow?.semestre_id ?? null,
      classId: classRow?.id ?? null,
      stageAreaId: classRow?.area_estagio_id ?? null
    } satisfies EnrollmentEvaluationSelectionContext;
  });
  const offerIds = [
    ...new Set(
      resolvedSelectionContexts
        .map((selectionContext) => selectionContext.offerId)
        .filter((offerId): offerId is string => Boolean(offerId))
    )
  ];

  const { data: offerRowsData, error: offerError } = offerIds.length
    ? await adminClient
        .from("ofertas_curso_unidade")
        .select("id, curso_id, nome_exibicao")
        .in("id", offerIds)
    : { data: [], error: null };

  if (offerError) {
    throw new Error(
      "Nao foi possivel carregar as ofertas do curso para identificar o modelo de avaliacao ativo."
    );
  }

  const offerRows = (offerRowsData ?? []) as Array<
    Pick<OfferRow, "id" | "curso_id" | "nome_exibicao">
  >;
  const offerById = new Map(offerRows.map((row) => [row.id, row]));
  for (const selectionContext of resolvedSelectionContexts) {
    if (!selectionContext.courseId && selectionContext.offerId) {
      selectionContext.courseId = offerById.get(selectionContext.offerId)?.curso_id ?? null;
    }
  }
  const stageAreaIds = [
    ...new Set(
      resolvedSelectionContexts
        .map((selectionContext) => selectionContext.stageAreaId)
        .filter((stageAreaId): stageAreaId is string => Boolean(stageAreaId))
    )
  ];
  const { data: stageAreaRowsData, error: stageAreaError } = stageAreaIds.length
    ? await adminClient.from("areas_estagio").select("id, nome").in("id", stageAreaIds)
    : { data: [], error: null };

  if (stageAreaError) {
    throw new Error(
      "Nao foi possivel carregar as areas de estagio vinculadas as matriculas para identificar o modelo de avaliacao."
    );
  }

  const stageAreaRows = (stageAreaRowsData ?? []) as Array<
    Pick<StageAreaRow, "id" | "nome">
  >;
  const stageAreaById = new Map(stageAreaRows.map((row) => [row.id, row]));
  const courseIds = [
    ...new Set(
      resolvedSelectionContexts
        .map((selectionContext) => selectionContext.courseId)
        .filter((courseId): courseId is string => Boolean(courseId))
    )
  ];

  const { data: modelRowsData, error: modelError } = courseIds.length
    ? await adminClient
        .from("modelos_avaliacao_curso")
        .select("*")
        .in("curso_id", courseIds)
        .eq("ativo", true)
    : { data: [], error: null };

  if (modelError) {
    throw new Error(
      "Nao foi possivel carregar os modelos de avaliacao por curso para o runtime do professor."
    );
  }

  const modelRows = (modelRowsData ?? []) as CourseEvaluationModelRow[];
  const selectedModelByCourseId = selectRuntimeCourseModelsByCourseId(modelRows);
  const modelIds = modelRows.map((modelRow) => modelRow.id);
  const { data: modelGroupRowsData, error: modelGroupError } = modelIds.length
    ? await adminClient
        .from("grupos_modelo_avaliacao")
        .select("*")
        .in("modelo_avaliacao_curso_id", modelIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (modelGroupError) {
    throw new Error(
      "Nao foi possivel carregar os grupos do modelo de avaliacao configurado para o curso."
    );
  }

  const modelGroupRows = (modelGroupRowsData ?? []) as CourseEvaluationGroupRow[];
  const modelGroupIds = modelGroupRows.map((groupRow) => groupRow.id);
  const { data: modelCriterionRowsData, error: modelCriterionError } = modelGroupIds.length
    ? await adminClient
        .from("criterios_modelo_avaliacao")
        .select("*")
        .in("grupo_modelo_avaliacao_id", modelGroupIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (modelCriterionError) {
    throw new Error(
      "Nao foi possivel carregar os criterios do modelo de avaliacao configurado para o curso."
    );
  }

  const modelCriterionRows = (modelCriterionRowsData ?? []) as CourseEvaluationCriterionRow[];
  const modelCriterionIds = modelCriterionRows.map((criterionRow) => criterionRow.id);
  const { data: modelCriterionOptionRowsData, error: modelCriterionOptionError } =
    modelCriterionIds.length
      ? await adminClient
          .from("opcoes_criterio_modelo_avaliacao")
          .select("*")
          .in("criterio_modelo_avaliacao_id", modelCriterionIds)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
      : { data: [], error: null };

  if (modelCriterionOptionError) {
    throw new Error(
      "Nao foi possivel carregar as opcoes de rubrica configuradas para o curso."
    );
  }

  const modelCriterionOptionRows =
    (modelCriterionOptionRowsData ?? []) as CourseEvaluationCriterionOptionRow[];
  const { data: applicationRuleRowsData, error: applicationRuleError } = modelIds.length
    ? await adminClient
        .from("regras_aplicacao_modelo_avaliacao")
        .select("*")
        .in("modelo_avaliacao_curso_id", modelIds)
        .eq("ativo", true)
    : { data: [], error: null };

  if (applicationRuleError) {
    throw new Error(
      "Nao foi possivel carregar as regras de aplicacao dos modelos de avaliacao."
    );
  }

  const applicationRuleRows =
    (applicationRuleRowsData ?? []) as CourseEvaluationModelApplicationRuleRow[];
  const { modelRowById, runtimeBaseByModelId } = buildEvaluationModelRuntimeBaseMap({
    modelRows,
    modelGroupRows,
    modelCriterionRows,
    modelCriterionOptionRows,
    runtimeRubricCriteria
  });
  const applicationRulesByCourseId = new Map<string, EvaluationModelApplicationRule[]>();

  for (const applicationRuleRow of applicationRuleRows) {
    const modelRow = modelRowById.get(applicationRuleRow.modelo_avaliacao_curso_id);

    if (!modelRow) {
      continue;
    }

    const currentRules = applicationRulesByCourseId.get(modelRow.curso_id) ?? [];
    currentRules.push(normalizeEvaluationModelApplicationRule(applicationRuleRow));
    applicationRulesByCourseId.set(modelRow.curso_id, currentRules);
  }

  const offerNamesById = new Map(
    offerRows.map((offerRow) => [offerRow.id, offerRow.nome_exibicao ?? offerRow.id])
  );
  const semesterLabelsById = new Map(
    semesterRows.map((semesterRow) => [semesterRow.id, semesterRow.codigo ?? semesterRow.id])
  );
  const classNamesById = new Map(
    classRows.map((classRow) => [classRow.id, classRow.nome ?? classRow.id])
  );
  const stageAreaNamesById = new Map(
    stageAreaRows.map((stageAreaRow) => [stageAreaRow.id, stageAreaRow.nome])
  );

  for (const selectionContext of resolvedSelectionContexts) {
    const legacyRuntimeContext = buildFallbackRuntimeContext(
      selectionContext.enrollmentId,
      legacyRubricGroups
    );

    if (!selectionContext.courseId) {
      runtimeContextByEnrollmentId.set(selectionContext.enrollmentId, legacyRuntimeContext);
      continue;
    }

    const applicableRules = applicationRulesByCourseId.get(selectionContext.courseId) ?? [];
    const {
      topRule,
      hasAmbiguousTopMatch
    } = resolveEvaluationModelApplicationRulesForContext(applicableRules, selectionContext);

    if (topRule && hasAmbiguousTopMatch) {
      throw new Error(
        "Configuração ambígua de modelo de avaliação. Há mais de uma regra aplicável com a mesma prioridade. Revise as regras no Master."
      );
    }

    if (topRule) {
      const modelBase = runtimeBaseByModelId.get(topRule.modelId);

      if (!modelBase) {
        throw new Error(
          "A regra aplicável do modelo de avaliação aponta para um modelo sem critérios compatíveis. Revise as regras no Master."
        );
      }

      runtimeContextByEnrollmentId.set(
        selectionContext.enrollmentId,
        buildRuntimeContextFromModelBase({
          enrollmentId: selectionContext.enrollmentId,
          courseId: selectionContext.courseId,
          offerId: selectionContext.offerId,
          source: "application_rule",
          modelBase,
          applicationRuleId: topRule.id,
          applicationRuleSummary: buildEvaluationModelApplicationRuleSummary(topRule, {
            offerNamesById,
            semesterLabelsById,
            classNamesById,
            stageAreaNamesById
          })
        })
      );
      continue;
    }

    const selectedModelEntry = selectedModelByCourseId.get(selectionContext.courseId);

    if (selectedModelEntry) {
      const modelBase = runtimeBaseByModelId.get(selectedModelEntry.model.id);

      if (modelBase) {
        runtimeContextByEnrollmentId.set(
          selectionContext.enrollmentId,
          buildRuntimeContextFromModelBase({
            enrollmentId: selectionContext.enrollmentId,
            courseId: selectionContext.courseId,
            offerId: selectionContext.offerId,
            source: selectedModelEntry.source,
            modelBase
          })
        );
        continue;
      }
    }

    runtimeContextByEnrollmentId.set(selectionContext.enrollmentId, legacyRuntimeContext);
  }

  return runtimeContextByEnrollmentId;
}

export async function loadEvaluationRuntimeContextForSelection(input: {
  enrollmentId: string;
  evaluationModelId?: string | null;
  modalitySnapshot?: EvaluationModelMode | null;
}): Promise<EvaluationRuntimeContext> {
  if (!input.evaluationModelId) {
    const runtimeContextByEnrollmentId = await loadEvaluationRuntimeContextsForEnrollments([
      input.enrollmentId
    ]);

    return (
      runtimeContextByEnrollmentId.get(input.enrollmentId) ??
      buildFallbackRuntimeContext(input.enrollmentId)
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: enrollmentRowData, error: enrollmentError } = await adminClient
    .from("matriculas_turma")
    .select("id, aluno_id, turma_id, oferta_curso_unidade_id")
    .eq("id", input.enrollmentId)
    .maybeSingle();

  if (enrollmentError || !enrollmentRowData) {
    throw new Error(
      "Nao foi possivel localizar a matricula vinculada a este lançamento salvo."
    );
  }

  const enrollmentRow = enrollmentRowData as Pick<
    EnrollmentRow,
    "id" | "aluno_id" | "turma_id" | "oferta_curso_unidade_id"
  >;
  const [studentRowResult, classRowResult] = await Promise.all([
    adminClient
      .from("alunos")
      .select("usuario_id, curso_id, oferta_curso_unidade_id")
      .eq("usuario_id", enrollmentRow.aluno_id)
      .maybeSingle(),
    adminClient
      .from("turmas")
      .select("id, semestre_id, oferta_curso_unidade_id")
      .eq("id", enrollmentRow.turma_id)
      .maybeSingle()
  ]);

  if (studentRowResult.error || classRowResult.error) {
    throw new Error(
      "Nao foi possivel reconstruir o contexto academico deste lançamento salvo."
    );
  }

  const studentRow =
    (studentRowResult.data ?? null) as Pick<
      StudentRow,
      "usuario_id" | "curso_id" | "oferta_curso_unidade_id"
    > | null;
  const classRow =
    (classRowResult.data ?? null) as Pick<
      ClassRow,
      "id" | "semestre_id" | "oferta_curso_unidade_id"
    > | null;
  const { data: semesterRowData, error: semesterError } = classRow?.semestre_id
    ? await adminClient
        .from("semestres")
        .select("id, oferta_curso_unidade_id")
        .eq("id", classRow.semestre_id)
        .maybeSingle()
    : { data: null, error: null };

  if (semesterError) {
    throw new Error(
      "Nao foi possivel localizar o semestre vinculado a este lançamento salvo."
    );
  }

  const semesterRow =
    (semesterRowData ?? null) as Pick<SemesterRow, "id" | "oferta_curso_unidade_id"> | null;
  const resolvedOfferId =
    enrollmentRow.oferta_curso_unidade_id ??
    classRow?.oferta_curso_unidade_id ??
    semesterRow?.oferta_curso_unidade_id ??
    studentRow?.oferta_curso_unidade_id ??
    null;
  const { data: offerRowData, error: offerError } = resolvedOfferId
    ? await adminClient
        .from("ofertas_curso_unidade")
        .select("id, curso_id")
        .eq("id", resolvedOfferId)
        .maybeSingle()
    : { data: null, error: null };

  if (offerError) {
    throw new Error(
      "Nao foi possivel localizar a oferta vinculada a este lançamento salvo."
    );
  }

  const offerRow = (offerRowData ?? null) as Pick<OfferRow, "id" | "curso_id"> | null;
  const resolvedCourseId = studentRow?.curso_id ?? offerRow?.curso_id ?? null;
  const { data: modelRowData, error: modelError } = await adminClient
    .from("modelos_avaliacao_curso")
    .select("*")
    .eq("id", input.evaluationModelId)
    .eq("ativo", true)
    .maybeSingle();

  if (modelError || !modelRowData) {
    throw new Error(
      "O modelo originalmente associado a este lançamento não está mais disponível. Revise a configuração no Master."
    );
  }

  const modelRow = modelRowData as CourseEvaluationModelRow;
  const { data: modelGroupRowsData, error: modelGroupError } = await adminClient
    .from("grupos_modelo_avaliacao")
    .select("*")
    .eq("modelo_avaliacao_curso_id", modelRow.id)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (modelGroupError) {
    throw new Error(
      "Nao foi possivel carregar os grupos do modelo originalmente associado a este lançamento."
    );
  }

  const modelGroupRows = (modelGroupRowsData ?? []) as CourseEvaluationGroupRow[];
  const modelGroupIds = modelGroupRows.map((groupRow) => groupRow.id);
  const { data: modelCriterionRowsData, error: modelCriterionError } = modelGroupIds.length
    ? await adminClient
        .from("criterios_modelo_avaliacao")
        .select("*")
        .in("grupo_modelo_avaliacao_id", modelGroupIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (modelCriterionError) {
    throw new Error(
      "Nao foi possivel carregar os criterios do modelo originalmente associado a este lançamento."
    );
  }

  const modelCriterionRows = (modelCriterionRowsData ?? []) as CourseEvaluationCriterionRow[];
  const modelCriterionIds = modelCriterionRows.map((criterionRow) => criterionRow.id);
  const { data: modelCriterionOptionRowsData, error: modelCriterionOptionError } =
    modelCriterionIds.length
      ? await adminClient
          .from("opcoes_criterio_modelo_avaliacao")
          .select("*")
          .in("criterio_modelo_avaliacao_id", modelCriterionIds)
          .eq("ativo", true)
          .order("ordem", { ascending: true })
      : { data: [], error: null };

  if (modelCriterionOptionError) {
    throw new Error(
      "Nao foi possivel carregar as opcoes do modelo originalmente associado a este lançamento."
    );
  }

  const { data: runtimeRubricCriteriaData, error: runtimeRubricCriteriaError } = await adminClient
    .from("criterios_avaliacao")
    .select("*")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (runtimeRubricCriteriaError) {
    throw new Error(
      "Nao foi possivel carregar os critérios legados necessários para abrir o lançamento salvo."
    );
  }

  const { runtimeBaseByModelId } = buildEvaluationModelRuntimeBaseMap({
    modelRows: [modelRow],
    modelGroupRows,
    modelCriterionRows,
    modelCriterionOptionRows:
      (modelCriterionOptionRowsData ?? []) as CourseEvaluationCriterionOptionRow[],
    runtimeRubricCriteria: (runtimeRubricCriteriaData ?? []) as RubricCriterionRow[]
  });
  const modelBase = runtimeBaseByModelId.get(modelRow.id);

  if (!modelBase) {
    throw new Error(
      "O modelo originalmente associado a este lançamento não possui critérios compatíveis para o runtime atual. Revise a configuração no Master."
    );
  }

  return buildRuntimeContextFromModelBase({
    enrollmentId: enrollmentRow.id,
    courseId: resolvedCourseId ?? modelRow.curso_id,
    offerId: resolvedOfferId,
    source: "saved_evaluation",
    modelBase: {
      ...modelBase,
      modality: input.modalitySnapshot ?? modelBase.modality
    }
  });
}

function safeSortableTimestamp(value?: string | null) {
  return typeof value === "string" ? value : "";
}

function compareEvaluationRows(left: EvaluationRow, right: EvaluationRow) {
  const evaluatedDifference = safeSortableTimestamp(left.avaliado_em).localeCompare(
    safeSortableTimestamp(right.avaliado_em)
  );

  if (evaluatedDifference !== 0) {
    return evaluatedDifference;
  }

  const createdDifference = safeSortableTimestamp(left.created_at).localeCompare(
    safeSortableTimestamp(right.created_at)
  );

  if (createdDifference !== 0) {
    return createdDifference;
  }

  return left.id.localeCompare(right.id);
}

function mapEvaluationItemsByEvaluationId(items: EvaluationItemRow[]) {
  const itemsByEvaluationId = new Map<string, EvaluationItemRow[]>();

  for (const item of items) {
    const currentItems = itemsByEvaluationId.get(item.avaliacao_id) ?? [];
    currentItems.push(item);
    itemsByEvaluationId.set(item.avaliacao_id, currentItems);
  }

  return itemsByEvaluationId;
}

function resolveEvaluationItemCriterionKey(item: EvaluationItemRow) {
  return item.criterio_modelo_avaliacao_id ?? item.criterio_id;
}

function scoreRecordFromItems(items: EvaluationItemRow[]) {
  return Object.fromEntries(
    items.map((item) => [
      resolveEvaluationItemCriterionKey(item),
      String(Number(item.nota_bruta))
    ])
  );
}

function feedbackRecordFromItems(items: EvaluationItemRow[]) {
  return Object.fromEntries(
    items
      .filter((item) => Boolean(item.feedback))
      .map((item) => [resolveEvaluationItemCriterionKey(item), item.feedback ?? ""])
  );
}

function optionSelectionRecordFromItems(items: EvaluationItemRow[]) {
  return Object.fromEntries(
    items
      .filter((item) => Boolean(item.opcao_criterio_modelo_avaliacao_id))
      .map((item) => [
        resolveEvaluationItemCriterionKey(item),
        item.opcao_criterio_modelo_avaliacao_id ?? ""
      ])
  );
}

function scoreRecordFromMap(scoreMap: Map<string, string>) {
  return Object.fromEntries(scoreMap.entries());
}

function mergeScoreMapWithItems(
  baseScores: Map<string, string>,
  items: EvaluationItemRow[]
) {
  const mergedScores = new Map(baseScores);

  for (const item of items) {
    mergedScores.set(
      resolveEvaluationItemCriterionKey(item),
      String(Number(item.nota_bruta))
    );
  }

  return mergedScores;
}

function mergeFeedbackMapWithItems(
  baseFeedbacks: Map<string, string>,
  items: EvaluationItemRow[]
) {
  const mergedFeedbacks = new Map(baseFeedbacks);

  for (const item of items) {
    if (item.feedback && item.feedback.trim() !== "") {
      mergedFeedbacks.set(resolveEvaluationItemCriterionKey(item), item.feedback);
    } else {
      mergedFeedbacks.delete(resolveEvaluationItemCriterionKey(item));
    }
  }

  return mergedFeedbacks;
}

function mergeOptionSelectionMapWithItems(
  baseOptionSelections: Map<string, string>,
  items: EvaluationItemRow[]
) {
  const mergedOptionSelections = new Map(baseOptionSelections);

  for (const item of items) {
    if (item.opcao_criterio_modelo_avaliacao_id) {
      mergedOptionSelections.set(
        resolveEvaluationItemCriterionKey(item),
        item.opcao_criterio_modelo_avaliacao_id
      );
    } else {
      mergedOptionSelections.delete(resolveEvaluationItemCriterionKey(item));
    }
  }

  return mergedOptionSelections;
}

function buildCriterionScoresThroughChain(
  chainRows: EvaluationRow[],
  itemsByEvaluationId: Map<string, EvaluationItemRow[]>,
  stopAtEvaluationId: string
) {
  const scoreMap = new Map<string, string>();

  for (const evaluation of [...chainRows].sort(compareEvaluationRows)) {
    if (evaluation.status === "publicado") {
      for (const item of itemsByEvaluationId.get(evaluation.id) ?? []) {
        scoreMap.set(
          resolveEvaluationItemCriterionKey(item),
          String(Number(item.nota_bruta))
        );
      }
    }

    if (evaluation.id === stopAtEvaluationId) {
      break;
    }
  }

  return scoreMap;
}

function buildCriterionFeedbacksThroughChain(
  chainRows: EvaluationRow[],
  itemsByEvaluationId: Map<string, EvaluationItemRow[]>,
  stopAtEvaluationId: string
) {
  const feedbackMap = new Map<string, string>();

  for (const evaluation of [...chainRows].sort(compareEvaluationRows)) {
    if (evaluation.status === "publicado") {
      for (const item of itemsByEvaluationId.get(evaluation.id) ?? []) {
        if (item.feedback && item.feedback.trim() !== "") {
          feedbackMap.set(resolveEvaluationItemCriterionKey(item), item.feedback);
        } else {
          feedbackMap.delete(resolveEvaluationItemCriterionKey(item));
        }
      }
    }

    if (evaluation.id === stopAtEvaluationId) {
      break;
    }
  }

  return feedbackMap;
}

function buildCriterionOptionSelectionsThroughChain(
  chainRows: EvaluationRow[],
  itemsByEvaluationId: Map<string, EvaluationItemRow[]>,
  stopAtEvaluationId: string
) {
  const optionSelectionMap = new Map<string, string>();

  for (const evaluation of [...chainRows].sort(compareEvaluationRows)) {
    if (evaluation.status === "publicado") {
      for (const item of itemsByEvaluationId.get(evaluation.id) ?? []) {
        if (item.opcao_criterio_modelo_avaliacao_id) {
          optionSelectionMap.set(
            resolveEvaluationItemCriterionKey(item),
            item.opcao_criterio_modelo_avaliacao_id
          );
        } else {
          optionSelectionMap.delete(resolveEvaluationItemCriterionKey(item));
        }
      }
    }

    if (evaluation.id === stopAtEvaluationId) {
      break;
    }
  }

  return optionSelectionMap;
}

function getReviewLevel(
  evaluation: EvaluationRow,
  evaluationById: Map<string, EvaluationRow>
) {
  let reviewLevel = 0;
  let cursor = evaluation;
  let guard = 0;

  while (cursor.avaliacao_origem_id && guard < 20) {
    const originEvaluation = evaluationById.get(cursor.avaliacao_origem_id);

    if (!originEvaluation) {
      break;
    }

    reviewLevel += 1;
    cursor = originEvaluation;
    guard += 1;
  }

  return reviewLevel;
}

function buildRevisionLabel(
  evaluation: EvaluationRow,
  evaluationById: Map<string, EvaluationRow>
) {
  const reviewLevel = getReviewLevel(evaluation, evaluationById);

  if (reviewLevel === 0) {
    return evaluation.status === "rascunho" ? "Original (rascunho)" : "Original";
  }

  const baseLabel = `Revisão ${reviewLevel}`;
  return evaluation.status === "rascunho" ? `${baseLabel} (rascunho)` : baseLabel;
}

function buildRevisionChainEntries(
  chainRows: EvaluationRow[],
  currentEvaluationId: string
) {
  const evaluationById = new Map(chainRows.map((evaluation) => [evaluation.id, evaluation]));

  return [...chainRows]
    .sort(compareEvaluationRows)
    .map((evaluation) => {
      const identity = resolveLaunchIdentity({
        launchType: evaluation.tipo_lancamento,
        evaluatedAt: evaluation.avaliado_em,
        reference: evaluation.referencia,
        createdAt: evaluation.created_at
      });

      return {
        id: evaluation.id,
        label: buildRevisionLabel(evaluation, evaluationById),
        reference: identity.label,
        isLegacyRecord: identity.isLegacyRecord,
        launchType: evaluation.tipo_lancamento,
        status: evaluation.status,
        evaluatedAt:
          identity.effectiveDateValue ??
          evaluation.avaliado_em ??
          evaluation.created_at,
        isCurrent: evaluation.id === currentEvaluationId
      };
    });
}

function buildEvaluationChainBundle(
  targetEvaluation: EvaluationRow,
  chainRows: EvaluationRow[],
  evaluationItems: EvaluationItemRow[]
): EvaluationChainBundle {
  const sortedChainRows = [...chainRows].sort(compareEvaluationRows);
  const itemsByEvaluationId = mapEvaluationItemsByEvaluationId(evaluationItems);
  const targetItems = itemsByEvaluationId.get(targetEvaluation.id) ?? [];
  const latestPublishedEvaluation = [...sortedChainRows]
    .filter((evaluation) => evaluation.status === "publicado")
    .at(-1) ?? null;
  const directDraftRevision =
    sortedChainRows.find(
      (evaluation) =>
        evaluation.avaliacao_origem_id === targetEvaluation.id &&
        evaluation.status === "rascunho"
    ) ?? null;

  const baselineScores =
    targetEvaluation.avaliacao_origem_id !== null
      ? scoreRecordFromMap(
          buildCriterionScoresThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.avaliacao_origem_id
          )
        )
      : {};
  const baselineFeedbacks =
    targetEvaluation.avaliacao_origem_id !== null
      ? scoreRecordFromMap(
          buildCriterionFeedbacksThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.avaliacao_origem_id
          )
        )
      : {};
  const baselineOptionSelections =
    targetEvaluation.avaliacao_origem_id !== null
      ? scoreRecordFromMap(
          buildCriterionOptionSelectionsThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.avaliacao_origem_id
          )
        )
      : {};

  const editableScores = scoreRecordFromItems(targetItems);
  const editableFeedbacks = feedbackRecordFromItems(targetItems);
  const editableOptionSelections = optionSelectionRecordFromItems(targetItems);

  const effectiveScores =
    targetEvaluation.status === "rascunho"
      ? scoreRecordFromMap(
          targetEvaluation.avaliacao_origem_id
            ? mergeScoreMapWithItems(
                new Map(Object.entries(baselineScores)),
                targetItems
              )
            : new Map(Object.entries(editableScores))
        )
      : scoreRecordFromMap(
          buildCriterionScoresThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.id
          )
        );
  const effectiveFeedbacks =
    targetEvaluation.status === "rascunho"
      ? scoreRecordFromMap(
          targetEvaluation.avaliacao_origem_id
            ? mergeFeedbackMapWithItems(
                new Map(Object.entries(baselineFeedbacks)),
                targetItems
              )
            : new Map(Object.entries(editableFeedbacks))
        )
      : scoreRecordFromMap(
          buildCriterionFeedbacksThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.id
          )
        );
  const effectiveOptionSelections =
    targetEvaluation.status === "rascunho"
      ? scoreRecordFromMap(
          targetEvaluation.avaliacao_origem_id
            ? mergeOptionSelectionMapWithItems(
                new Map(Object.entries(baselineOptionSelections)),
                targetItems
              )
            : new Map(Object.entries(editableOptionSelections))
        )
      : scoreRecordFromMap(
          buildCriterionOptionSelectionsThroughChain(
            sortedChainRows,
            itemsByEvaluationId,
            targetEvaluation.id
          )
        );

  return {
    chainRows: sortedChainRows,
    itemsByEvaluationId,
    latestPublishedEvaluation,
    directDraftRevision,
    baselineScores,
    baselineFeedbacks,
    baselineOptionSelections,
    effectiveScores,
    effectiveFeedbacks,
    effectiveOptionSelections,
    editableScores,
    editableFeedbacks,
    editableOptionSelections,
    changedCriterionIds: targetItems.map((item) => resolveEvaluationItemCriterionKey(item)),
    revisionChain: buildRevisionChainEntries(sortedChainRows, targetEvaluation.id)
  };
}

async function loadEvaluationChainBundle(
  targetEvaluation: EvaluationRow
): Promise<{
  bundle: EvaluationChainBundle | null;
  emptyState: EmptyState | null;
}> {
  const supabase = await createSupabaseServerClient();
  const rootEvaluationId = targetEvaluation.avaliacao_raiz_id ?? targetEvaluation.id;

  const { data: chainRowsData, error: chainError } = await supabase
    .from("avaliacoes")
    .select("*")
    .or(`id.eq.${rootEvaluationId},avaliacao_raiz_id.eq.${rootEvaluationId}`);

  if (chainError) {
    return {
      bundle: null,
      emptyState: {
        title: "Não foi possível carregar a cadeia de revisões",
        description:
          "O lançamento foi encontrado, mas as versões relacionadas não puderam ser consultadas."
      }
    };
  }

  const chainRows = ((chainRowsData ?? []) as EvaluationRow[])
    .filter(
      (evaluation) =>
        evaluation.professor_id === targetEvaluation.professor_id &&
        evaluation.matricula_turma_id === targetEvaluation.matricula_turma_id
    )
    .sort(compareEvaluationRows);
  const chainEvaluationIds = [...new Set(chainRows.map((evaluation) => evaluation.id))];

  const { data: evaluationItemsData, error: evaluationItemsError } = chainEvaluationIds.length
    ? await supabase
        .from("itens_avaliados")
        .select("*")
        .in("avaliacao_id", chainEvaluationIds)
    : { data: [], error: null };

  if (evaluationItemsError) {
    return {
      bundle: null,
      emptyState: {
        title: "Não foi possível carregar os itens avaliados",
        description:
          "As versões do lançamento foram encontradas, mas seus itens avaliados não puderam ser consultados."
      }
    };
  }

  return {
    bundle: buildEvaluationChainBundle(
      targetEvaluation,
      chainRows,
      (evaluationItemsData ?? []) as EvaluationItemRow[]
    ),
    emptyState: null
  };
}

async function loadProfessorEvaluationContext(
  currentUser: SessionUser,
  includeRubric: boolean
): Promise<{
  context: ProfessorEvaluationContext | null;
  emptyState: EmptyState | null;
}> {
  if (currentUser.role !== "professor") {
    return {
      context: null,
      emptyState: {
        title: "Fluxo disponível apenas para professores",
        description:
          "Nesta versão, apenas professores com vínculo docente podem acessar os lançamentos por esta área."
      }
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: professorRowData, error: professorError } = await supabase
    .from("professores")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar o professor autenticado",
        description:
          "Houve um problema ao consultar o cadastro docente vinculado a esta sessão."
      }
    };
  }

  const professorRow = (professorRowData ?? null) as ProfessorRow | null;

  if (!professorRow) {
    return {
      context: null,
      emptyState: {
        title: "Cadastro docente ainda não disponível",
        description:
          "Seu usuário esta autenticado como professor, mas ainda não existe registro correspondente em public.professores."
      }
    };
  }

  let exceptionalReleaseRows: Awaited<
    ReturnType<typeof loadReleasedEnrollmentContextsForUser>
  >["releaseRows"] = [];
  let releasedEnrollmentContexts: Awaited<
    ReturnType<typeof loadReleasedEnrollmentContextsForUser>
  >["contexts"] = [];

  try {
    const releasedContextResult = await loadReleasedEnrollmentContextsForUser(currentUser, {
      type: "avaliacao",
      unitId: currentUser.unitId ?? null
    });

    exceptionalReleaseRows = releasedContextResult.releaseRows;
    releasedEnrollmentContexts = releasedContextResult.contexts;
  } catch (_error) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar as liberações excepcionais",
        description:
          "Houve um problema ao consultar os contextos liberados excepcionalmente para este professor."
      }
    };
  }

  const { data: professorLinksData, error: linksError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("professor_id", currentUser.id)
    .eq("ativo", true);

  if (linksError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar os vínculos do professor",
        description:
          "Houve um problema ao consultar os alunos vinculados ao professor autenticado."
      }
    };
  }

  const today = getTodayInSaoPaulo();
  const professorLinks = ((professorLinksData ?? []) as ProfessorLinkRow[]).filter(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!professorLinks.length && !releasedEnrollmentContexts.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno vinculado",
        description:
          "Assim que houver alunos vinculados à sua supervisão, os lançamentos aparecerão aqui."
      }
    };
  }

  const dataSupabase =
    releasedEnrollmentContexts.length > 0
      ? createSupabaseAdminClient()
      : supabase;

  const enrollmentIds = [
    ...new Set([
      ...professorLinks.map((link) => link.matricula_turma_id),
      ...releasedEnrollmentContexts.map((context) => context.enrollmentId)
    ])
  ];

  const { data: enrollmentRowsData, error: enrollmentError } = await dataSupabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar as matrículas vinculadas",
        description:
          "Os vínculos foram encontrados, mas as matrículas dos alunos não puderam ser consultadas."
      }
    };
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as EnrollmentRow[];
  const activeEnrollmentRows = enrollmentRows.filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!activeEnrollmentRows.length && !releasedEnrollmentContexts.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhuma matrícula ativa encontrada",
        description:
          "Os vínculos existem, mas não há matrículas ativas disponíveis para este professor."
      }
    };
  }

  const studentIds = [...new Set(enrollmentRows.map((row) => row.aluno_id))];
  const classIds = [...new Set(enrollmentRows.map((row) => row.turma_id))];

  const [studentRowsResult, studentUsersResult, classRowsResult] = await Promise.all([
    dataSupabase.from("alunos").select("*").in("usuario_id", studentIds),
    currentUser.unitId
      ? dataSupabase
          .from("usuarios")
          .select("*")
          .in("id", studentIds)
          .eq("unidade_id", currentUser.unitId)
      : dataSupabase.from("usuarios").select("*").in("id", studentIds),
    dataSupabase.from("turmas").select("*").in("id", classIds)
  ]);

  if (studentRowsResult.error || studentUsersResult.error || classRowsResult.error) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível consolidar os alunos vinculados",
        description:
          "Faltaram dados de aluno, usuário ou turma para montar as opções de lançamento."
      }
    };
  }

  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const allStudentUsers = (studentUsersResult.data ?? []) as UserRow[];
  const studentUsers = filterActiveStudentUsers(allStudentUsers);
  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];

  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await dataSupabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar os semestres vinculados",
        description:
          "Faltaram dados de semestre para montar os lançamentos do professor."
      }
    };
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterRowsData ?? []) as SemesterRow[],
    currentUser
  );
  classRows = filterClassesToSemesters(classRows, semesterRows);
  const activeEnrollmentIdSet = new Set(
    professorLinks.map((link) => link.matricula_turma_id)
  );
  const releasedEnrollmentIdSet = new Set(
    releasedEnrollmentContexts.map((context) => context.enrollmentId)
  );
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollmentRows = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(
      activeEnrollmentRows.filter((enrollment) => activeEnrollmentIdSet.has(enrollment.id)),
      classRows
    ),
    activeStudentIdSet
  );

  const releasedEnrollmentRows = filterEnrollmentsToClasses(
    enrollmentRows.filter((enrollment) => releasedEnrollmentIdSet.has(enrollment.id)),
    classRows
  );

  if (
    !visibleEnrollmentRows.length &&
    !releasedEnrollmentRows.length
  ) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno vinculado",
        description:
          "Assim que houver alunos vinculados à sua unidade e à sua supervisão, os lançamentos aparecerão aqui."
      }
    };
  }

  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const allStudentUserMap = new Map(allStudentUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));

  const baseStudentOptions = visibleEnrollmentRows
    .map((enrollment) =>
      buildEvaluationStudentOption({
        enrollment,
        studentRowsById: studentRowMap,
        studentUsersById: studentUserMap,
        classRowsById: classMap,
        semestersById: semesterMap
      })
    )
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as EvaluationStudentOption[];

  const releasedStudentOptions = releasedEnrollmentRows
    .map((enrollment) =>
      buildEvaluationStudentOption({
        enrollment,
        studentRowsById: studentRowMap,
        studentUsersById: allStudentUserMap,
        classRowsById: classMap,
        semestersById: semesterMap
      })
    )
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as EvaluationStudentOption[];

  const studentOptionsMap = new Map<string, EvaluationStudentOption>();

  for (const studentOption of baseStudentOptions) {
    studentOptionsMap.set(studentOption.enrollmentId, studentOption);
  }

  for (const studentOption of releasedStudentOptions) {
    studentOptionsMap.set(studentOption.enrollmentId, studentOption);
  }

  let studentOptions = [...studentOptionsMap.values()].sort((left, right) =>
    left.studentName.localeCompare(right.studentName, "pt-BR")
  );

  if (!studentOptions.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno apto para lançamento",
        description:
          "Os vínculos existem, mas faltam dados de aluno, turma ou semestre para montar as opcoes do formulario."
      }
    };
  }

  const closedSemesterIds = [...new Set(
    studentOptions
      .filter((studentOption) => semesterMap.get(studentOption.semesterId)?.status === "encerrado")
      .map((studentOption) => studentOption.semesterId)
  )];

  if (closedSemesterIds.length && exceptionalReleaseRows.length) {
    studentOptions = studentOptions.map((studentOption) => ({
      ...studentOption,
      exceptionalReleaseNotice:
        semesterMap.get(studentOption.semesterId)?.status === "encerrado"
          ? resolveExceptionalReleaseVisualNoticeFromRows(exceptionalReleaseRows, {
              type: "avaliacao",
              semesterId: studentOption.semesterId,
              classId: studentOption.classId,
              studentId: studentOption.studentId,
              authorizedUserId: currentUser.id,
              unitId: currentUser.unitId ?? null
            })
          : null
    }));
  }

  let runtimeContextByEnrollmentId = new Map<string, EvaluationRuntimeContext>();
  let defaultRuntimeContext = buildFallbackRuntimeContext(studentOptions[0]?.enrollmentId ?? "");

  if (includeRubric) {
    try {
      runtimeContextByEnrollmentId = await loadEvaluationRuntimeContextsForEnrollments(
        studentOptions.map((studentOption) => studentOption.enrollmentId)
      );
    } catch (error) {
      return {
        context: null,
        emptyState: {
          title: "Não foi possível carregar a configuração de avaliação",
          description:
            error instanceof Error
              ? error.message
              : "Os grupos, critérios e modalidades necessários para o formulário não puderam ser consultados."
        }
      };
    }

    defaultRuntimeContext =
      runtimeContextByEnrollmentId.get(studentOptions[0]?.enrollmentId ?? "") ??
      buildFallbackRuntimeContext(studentOptions[0]?.enrollmentId ?? "");

    if (!defaultRuntimeContext.rubricGroups.length) {
      return {
        context: null,
        emptyState: {
          title: "Rubrica de avaliação indisponível",
          description:
            "Ainda não há grupos e critérios ativos disponíveis no modelo do curso nem no fallback legado."
        }
      };
    }
  }

  return {
    context: {
      professor: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      studentOptions,
      studentOptionMap: new Map(
        studentOptions.map((studentOption) => [
          studentOption.enrollmentId,
          studentOption
        ])
      ),
      runtimeContextByEnrollmentId,
      defaultRuntimeContext
    },
    emptyState: null
  };
}

function resolveRuntimeContextForEnrollment(
  context: ProfessorEvaluationContext,
  enrollmentId: string | null | undefined
) {
  if (enrollmentId) {
    return (
      context.runtimeContextByEnrollmentId.get(enrollmentId) ??
      buildFallbackRuntimeContext(enrollmentId, context.defaultRuntimeContext.rubricGroups)
    );
  }

  return context.defaultRuntimeContext;
}

async function resolveRuntimeContextForEvaluationRow(
  evaluationRow: EvaluationRow,
  fallbackModelId?: string | null,
  fallbackModality?: EvaluationModelMode | null
) {
  return loadEvaluationRuntimeContextForSelection({
    enrollmentId: evaluationRow.matricula_turma_id,
    evaluationModelId:
      evaluationRow.modelo_avaliacao_curso_id ?? fallbackModelId ?? null,
    modalitySnapshot: evaluationRow.modalidade_snapshot ?? fallbackModality ?? null
  });
}

function serializeRuntimeContextsByEnrollment(
  context: ProfessorEvaluationContext
): Record<string, EvaluationRuntimeFormContext> {
  return Object.fromEntries(
    context.studentOptions.map((studentOption) => {
      const runtimeContext = resolveRuntimeContextForEnrollment(
        context,
        studentOption.enrollmentId
      );

      return [
        studentOption.enrollmentId,
        serializeEvaluationRuntimeContext(runtimeContext)
      ];
    })
  );
}

export async function getEvaluationFormPageData(
  currentUser: SessionUser
): Promise<EvaluationFormLoadResult> {
  const { context, emptyState } = await loadProfessorEvaluationContext(
    currentUser,
    true
  );

  if (!context || emptyState) {
    return buildEmptyState(
      emptyState?.title ?? "Formulário indisponível",
      emptyState?.description ??
        "Não foi possível montar o formulário de lançamento para este professor."
    );
  }

  const runtimeContext = resolveRuntimeContextForEnrollment(
    context,
    context.studentOptions[0]?.enrollmentId
  );

  return {
    formData: {
      professor: context.professor,
      studentOptions: context.studentOptions,
      rubricGroups: runtimeContext.rubricGroups,
      evaluationMode: runtimeContext.modality,
      evaluationSource: runtimeContext.source,
      evaluationModelId: runtimeContext.modelId,
      evaluationModelCode: runtimeContext.modelCode,
      evaluationModelName: runtimeContext.modelName,
      runtimeContextsByEnrollmentId: serializeRuntimeContextsByEnrollment(context),
      mode: "create",
      readOnlyMessage: null,
      contextMessage: null,
      revisionChain: [],
      revisionAction: null
    },
    emptyState: null
  };
}

export async function getProfessorEvaluationListPageData(
  currentUser: SessionUser
): Promise<ProfessorEvaluationListLoadResult> {
  const { context, emptyState } = await loadProfessorEvaluationContext(
    currentUser,
    false
  );

  if (!context || emptyState) {
    return buildListEmptyState(
      emptyState?.title ?? "Meus lançamentos indisponíveis",
      emptyState?.description ??
        "Não foi possível montar a listagem de lançamentos deste professor."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: evaluationRowsData, error: evaluationsError } = await supabase
    .from("avaliacoes")
    .select("*")
    .eq("professor_id", currentUser.id)
    .order("avaliado_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (evaluationsError) {
    return buildListEmptyState(
      "Não foi possível carregar os lançamentos do professor",
      "Houve um problema ao consultar as avaliações registradas para este professor."
    );
  }

  const evaluationRows = (evaluationRowsData ?? []) as EvaluationRow[];
  const evaluationById = new Map(evaluationRows.map((evaluation) => [evaluation.id, evaluation]));
  const evaluations = evaluationRows
    .map((evaluation) => {
      const studentOption = context.studentOptionMap.get(evaluation.matricula_turma_id);

      if (!studentOption) {
        return null;
      }

      const originEvaluation = evaluation.avaliacao_origem_id
        ? evaluationById.get(evaluation.avaliacao_origem_id)
        : null;
      const versionLabel = buildRevisionLabel(evaluation, evaluationById);
      const identity = resolveLaunchIdentity({
        launchType: evaluation.tipo_lancamento,
        evaluatedAt: evaluation.avaliado_em,
        reference: evaluation.referencia,
        createdAt: evaluation.created_at
      });
      const originIdentity = originEvaluation
        ? resolveLaunchIdentity({
            launchType: originEvaluation.tipo_lancamento,
            evaluatedAt: originEvaluation.avaliado_em,
            reference: originEvaluation.referencia,
            createdAt: originEvaluation.created_at
          })
        : null;

      return {
        id: evaluation.id,
        studentName: studentOption.studentName,
        registration: studentOption.registration,
        className: studentOption.className,
        semesterCode: studentOption.semesterCode,
        launchType: evaluation.tipo_lancamento,
        reference: identity.label,
        isLegacyRecord: identity.isLegacyRecord,
        status: evaluation.status,
        evaluatedAt:
          identity.effectiveDateValue ?? evaluation.avaliado_em ?? evaluation.created_at,
        actionLabel:
          evaluation.status === "rascunho" ? "Visualizar / editar" : "Visualizar",
        versionLabel,
        relationHint: originIdentity
          ? `Vinculada a ${originIdentity.label}`
          : "Versao original"
      } satisfies ProfessorEvaluationListItem;
    })
    .filter(Boolean) as ProfessorEvaluationListItem[];

  return {
    listData: {
      professor: context.professor,
      evaluations
    },
    emptyState: null
  };
}

export async function getEvaluationEditorPageData(
  currentUser: SessionUser,
  evaluationId: string
): Promise<EvaluationFormLoadResult> {
  const { context, emptyState } = await loadProfessorEvaluationContext(
    currentUser,
    false
  );

  if (!context || emptyState) {
    return buildEmptyState(
      emptyState?.title ?? "Lançamento indisponível",
      emptyState?.description ??
        "Não foi possível carregar os dados necessários para revisar este lançamento."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: evaluationRowData, error: evaluationError } = await supabase
    .from("avaliacoes")
    .select("*")
    .eq("id", evaluationId)
    .eq("professor_id", currentUser.id)
    .maybeSingle();

  if (evaluationError || !evaluationRowData) {
    return buildEmptyState(
      "Lançamento não encontrado",
      "Não encontramos um lançamento deste professor com o identificador informado."
    );
  }

  const evaluationRow = evaluationRowData as EvaluationRow;
  const studentOption = context.studentOptionMap.get(evaluationRow.matricula_turma_id);

  if (!studentOption) {
    return buildEmptyState(
      "Lançamento sem vínculo disponível",
      "O lançamento foi encontrado, mas os dados atuais de matrícula do aluno não estão disponíveis para esta sessão."
    );
  }

  const { bundle, emptyState: chainEmptyState } = await loadEvaluationChainBundle(
    evaluationRow
  );

  if (!bundle || chainEmptyState) {
    return buildEmptyState(
      chainEmptyState?.title ?? "Cadeia de revisões indisponível",
      chainEmptyState?.description ??
        "Não foi possível carregar as versões relacionadas a este lançamento."
    );
  }

  let runtimeContext: EvaluationRuntimeContext;

  try {
    runtimeContext = await resolveRuntimeContextForEvaluationRow(
      evaluationRow,
      bundle.latestPublishedEvaluation?.modelo_avaliacao_curso_id ?? null,
      bundle.latestPublishedEvaluation?.modalidade_snapshot ?? null
    );
  } catch (error) {
    return buildEmptyState(
      "Não foi possível reabrir o modelo deste lançamento",
      error instanceof Error
        ? error.message
        : "O modelo originalmente associado a este lançamento não pôde ser carregado."
    );
  }

  const runtimeContextsByEnrollmentId = serializeRuntimeContextsByEnrollment(context);
  runtimeContextsByEnrollmentId[evaluationRow.matricula_turma_id] =
    serializeEvaluationRuntimeContext(runtimeContext);

  const isReadOnly =
    evaluationRow.status === "publicado" || evaluationRow.status === "cancelado";
  const isLatestPublishedEvaluation =
    bundle.latestPublishedEvaluation?.id === evaluationRow.id;
  const latestPublishedReference =
    bundle.latestPublishedEvaluation
      ? resolveLaunchIdentity({
          launchType: bundle.latestPublishedEvaluation.tipo_lancamento,
          evaluatedAt: bundle.latestPublishedEvaluation.avaliado_em,
          reference: bundle.latestPublishedEvaluation.referencia,
          createdAt: bundle.latestPublishedEvaluation.created_at
        }).label
      : "a versão mais recente";

  let readOnlyMessage: string | null = null;
  let contextMessage: string | null = null;
  let revisionAction: EvaluationActionLink | null = null;

  if (evaluationRow.status === "publicado") {
    if (isLatestPublishedEvaluation) {
      readOnlyMessage =
        "Este lançamento publicado permanece intacto para auditoria. Para ajustes posteriores, use uma revisão incremental vinculada.";
      revisionAction = bundle.directDraftRevision
        ? {
            href: `/avaliacoes/${bundle.directDraftRevision.id}`,
            label: "Continuar rascunho de revisão"
          }
        : {
            href: `/avaliacoes/${evaluationRow.id}/revisao`,
            label: "Iniciar revisão incremental"
          };
    } else {
      readOnlyMessage = `Esta versao permanece preservada para auditoria. Novas revisões devem partir de ${latestPublishedReference}.`;

      if (bundle.latestPublishedEvaluation) {
        revisionAction = {
          href: `/avaliacoes/${bundle.latestPublishedEvaluation.id}`,
          label: "Abrir versão mais recente"
        };
      }
    }
  } else if (evaluationRow.status === "cancelado") {
    readOnlyMessage =
      "Este lançamento foi cancelado e permanece disponível somente para consulta histórica.";
  } else if (evaluationRow.avaliacao_origem_id) {
    contextMessage =
      "Este é um rascunho de revisão incremental. Altere apenas a nota ou a justificativa dos itens necessários, e os demais continuarão herdados da versão publicada anterior.";
  }

  return {
    formData: {
      professor: context.professor,
      studentOptions: context.studentOptions,
      rubricGroups: runtimeContext.rubricGroups,
      evaluationMode: runtimeContext.modality,
      evaluationSource: runtimeContext.source,
      evaluationModelId: runtimeContext.modelId,
      evaluationModelCode: runtimeContext.modelCode,
      evaluationModelName: runtimeContext.modelName,
      runtimeContextsByEnrollmentId,
      mode: isReadOnly ? "readonly" : "edit",
      readOnlyMessage,
      contextMessage,
      revisionChain: bundle.revisionChain,
      revisionAction,
      initialValues: {
        evaluationId: evaluationRow.id,
        evaluationOriginId: evaluationRow.avaliacao_origem_id ?? undefined,
        evaluationRootId:
          evaluationRow.avaliacao_raiz_id
            ? evaluationRow.avaliacao_origem_id ?? evaluationRow.id
            : undefined,
        matriculaTurmaId: evaluationRow.matricula_turma_id,
        tipoLançamento: evaluationRow.tipo_lancamento,
        referencia: evaluationRow.referencia,
        observacoes: evaluationRow.observacoes ?? "",
        status: evaluationRow.status,
        avaliadoEm: evaluationRow.avaliado_em,
        criterionScores: isReadOnly
          ? bundle.effectiveScores
          : bundle.editableScores,
        criterionFeedbacks: isReadOnly
          ? bundle.effectiveFeedbacks
          : bundle.editableFeedbacks,
        criterionOptionSelections: isReadOnly
          ? bundle.effectiveOptionSelections
          : bundle.editableOptionSelections,
        baselineCriterionScores: bundle.baselineScores,
        baselineCriterionFeedbacks: bundle.baselineFeedbacks,
        baselineCriterionOptionSelections: bundle.baselineOptionSelections,
        effectiveCriterionScores: bundle.effectiveScores,
        effectiveCriterionFeedbacks: bundle.effectiveFeedbacks,
        effectiveCriterionOptionSelections: bundle.effectiveOptionSelections,
        changedCriterionIds: bundle.changedCriterionIds
      }
    },
    emptyState: null
  };
}

export async function getEvaluationReviewPageData(
  currentUser: SessionUser,
  evaluationId: string
): Promise<EvaluationReviewLoadResult> {
  const { context, emptyState } = await loadProfessorEvaluationContext(
    currentUser,
    false
  );

  if (!context || emptyState) {
    return buildReviewEmptyState(
      emptyState?.title ?? "Revisão indisponível",
      emptyState?.description ??
        "Não foi possível montar o formulário de revisão para este professor."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: evaluationRowData, error: evaluationError } = await supabase
    .from("avaliacoes")
    .select("*")
    .eq("id", evaluationId)
    .eq("professor_id", currentUser.id)
    .maybeSingle();

  if (evaluationError || !evaluationRowData) {
    return buildReviewEmptyState(
      "Lançamento não encontrado",
      "Não encontramos um lançamento publicado deste professor com o identificador informado."
    );
  }

  const evaluationRow = evaluationRowData as EvaluationRow;

  if (evaluationRow.status !== "publicado") {
    return buildReviewEmptyState(
      "A revisão incremental exige um lançamento publicado",
      "Somente lançamentos publicados podem gerar uma nova revisão incremental vinculada."
    );
  }

  const studentOption = context.studentOptionMap.get(evaluationRow.matricula_turma_id);

  if (!studentOption) {
    return buildReviewEmptyState(
      "Lançamento sem vínculo disponível",
      "O lançamento foi encontrado, mas os dados atuais de matrícula do aluno não estão disponíveis para esta sessão."
    );
  }

  const { bundle, emptyState: chainEmptyState } = await loadEvaluationChainBundle(
    evaluationRow
  );

  if (!bundle || chainEmptyState) {
    return buildReviewEmptyState(
      chainEmptyState?.title ?? "Cadeia de revisões indisponível",
      chainEmptyState?.description ??
        "Não foi possível carregar as versões relacionadas a este lançamento."
    );
  }

  if (bundle.directDraftRevision) {
    return buildReviewEmptyState(
      "Já existe um rascunho de revisão para esta avaliação",
      "Abra o rascunho já existente para continuar a revisão incremental sem criar uma nova bifurcação.",
      bundle.directDraftRevision.id
    );
  }

  if (bundle.latestPublishedEvaluation?.id !== evaluationRow.id) {
    return buildReviewEmptyState(
      "A revisão precisa partir da versão mais recente",
      `Este lançamento já foi sucedido por ${
        bundle.latestPublishedEvaluation
          ? resolveLaunchIdentity({
              launchType: bundle.latestPublishedEvaluation.tipo_lancamento,
              evaluatedAt: bundle.latestPublishedEvaluation.avaliado_em,
              reference: bundle.latestPublishedEvaluation.referencia,
              createdAt: bundle.latestPublishedEvaluation.created_at
            }).label
          : "uma versão mais recente"
      }. Abra a última versão publicada da cadeia para iniciar nova revisão.`
    );
  }

  let runtimeContext: EvaluationRuntimeContext;

  try {
    runtimeContext = await resolveRuntimeContextForEvaluationRow(evaluationRow);
  } catch (error) {
    return buildReviewEmptyState(
      "Não foi possível preparar o modelo da revisão",
      error instanceof Error
        ? error.message
        : "O modelo associado à avaliação publicada não pôde ser carregado."
    );
  }

  const runtimeContextsByEnrollmentId = serializeRuntimeContextsByEnrollment(context);
  runtimeContextsByEnrollmentId[evaluationRow.matricula_turma_id] =
    serializeEvaluationRuntimeContext(runtimeContext);

  return {
    formData: {
      professor: context.professor,
      studentOptions: context.studentOptions,
      rubricGroups: runtimeContext.rubricGroups,
      evaluationMode: runtimeContext.modality,
      evaluationSource: runtimeContext.source,
      evaluationModelId: runtimeContext.modelId,
      evaluationModelCode: runtimeContext.modelCode,
      evaluationModelName: runtimeContext.modelName,
      runtimeContextsByEnrollmentId,
      mode: "review",
      readOnlyMessage: null,
      contextMessage:
        "Preencha apenas os itens cuja nota ou justificativa mudou. Os demais critérios continuarão herdados da versão publicada atual.",
      revisionChain: bundle.revisionChain,
      revisionAction: null,
      initialValues: {
        evaluationOriginId: evaluationRow.id,
        evaluationRootId: evaluationRow.avaliacao_raiz_id ?? evaluationRow.id,
        matriculaTurmaId: evaluationRow.matricula_turma_id,
        tipoLançamento: "revisao",
        referencia: formatLaunchIdentity("revisao", getTodayInSaoPaulo()),
        observacoes: "",
        status: "rascunho",
        avaliadoEm: getTodayInSaoPaulo(),
        criterionScores: {},
        criterionFeedbacks: {},
        criterionOptionSelections: {},
        baselineCriterionScores: bundle.effectiveScores,
        baselineCriterionFeedbacks: bundle.effectiveFeedbacks,
        baselineCriterionOptionSelections: bundle.effectiveOptionSelections,
        effectiveCriterionScores: bundle.effectiveScores,
        effectiveCriterionFeedbacks: bundle.effectiveFeedbacks,
        effectiveCriterionOptionSelections: bundle.effectiveOptionSelections,
        changedCriterionIds: []
      }
    },
    emptyState: null,
    redirectToEvaluationId: null
  };
}



