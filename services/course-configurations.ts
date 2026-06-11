import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type ModelRow = Database["public"]["Tables"]["modelos_avaliacao_curso"]["Row"];
type GroupRow = Database["public"]["Tables"]["grupos_modelo_avaliacao"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_modelo_avaliacao"]["Row"];
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
  isActive: boolean;
  groupWeightDiagnostic: CourseConfigurationWeightDiagnostic;
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
  code: string;
  name: string;
  description: string | null;
  order: number;
  weightPercent: number;
  maxScale: number;
  isActive: boolean;
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

export interface CourseConfigurationDocumentTypeOption {
  id: string;
  code: string;
  name: string;
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
  hasReusableInitialModel: boolean;
  models: CourseConfigurationModelEntry[];
  groups: CourseConfigurationGroupEntry[];
  criteria: CourseConfigurationCriterionEntry[];
  requiredDocuments: CourseConfigurationRequiredDocumentEntry[];
}

export interface CourseConfigurationCopyTargetOption {
  courseId: string;
  institutionId: string;
  institutionName: string;
  courseCode: string;
  courseName: string;
  status: CourseConfigurationStatus;
}

export interface CourseConfigurationPageData {
  summary: CourseConfigurationSummary;
  courses: CourseConfigurationCourseEntry[];
  copyTargetOptions: CourseConfigurationCopyTargetOption[];
  documentTypeOptions: CourseConfigurationDocumentTypeOption[];
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

function sortCriteria(left: CriterionRow, right: CriterionRow) {
  if (left.ordem !== right.ordem) {
    return left.ordem - right.ordem;
  }

  return compareByLocale(left.nome, right.nome);
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
  courseCode: string;
  hasConfiguredFisioBase: boolean;
  modelCount: number;
  groupCount: number;
  criterionCount: number;
  requiredDocumentCount: number;
}) {
  if (input.courseCode === "FISIO") {
    return {
      canDuplicateFromFisioterapia: false,
      duplicateBaseBlockedReason: "A Fisioterapia ja e o curso-base desta instituicao.",
      hasReusableInitialModel: false
    };
  }

  if (!input.hasConfiguredFisioBase) {
    return {
      canDuplicateFromFisioterapia: false,
      duplicateBaseBlockedReason:
        "A instituicao ainda nao possui uma base configurada de Fisioterapia para duplicacao.",
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

export async function getCourseConfigurationPageData(): Promise<CourseConfigurationPageData> {
  const supabase = createSupabaseAdminClient();
  const [
    institutionsResult,
    coursesResult,
    modelsResult,
    groupsResult,
    criteriaResult,
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
  const requiredDocumentRows =
    (requiredDocumentsResult.data ?? []) as RequiredDocumentRow[];
  const documentTypeRows = (documentTypesResult.data ?? []) as DocumentTypeRow[];

  const institutionsById = buildMapById(institutionRows);
  const documentTypesById = buildMapById(documentTypeRows);
  const modelsById = buildMapById(modelRows);
  const groupsById = buildMapById(groupRows);

  const modelsByCourseId = new Map<string, ModelRow[]>();
  const groupsByModelId = new Map<string, GroupRow[]>();
  const criteriaByGroupId = new Map<string, CriterionRow[]>();
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

  for (const requiredDocumentRow of requiredDocumentRows) {
    pushToMap(requiredDocumentsByCourseId, requiredDocumentRow.curso_id, requiredDocumentRow);
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
        hasReusableInitialModel: false,
        models: sourceModels.map((modelRow) => {
          const modelGroups = [...(groupsByModelId.get(modelRow.id) ?? [])].sort(sortGroups);

          return {
            id: modelRow.id,
            code: modelRow.codigo,
            name: modelRow.nome,
            description: modelRow.descricao,
            version: modelRow.versao,
            isActive: modelRow.ativo,
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
          code: criterionRow.codigo,
          name: criterionRow.nome,
          description: criterionRow.descricao,
          order: criterionRow.ordem,
          weightPercent: criterionRow.peso_percentual,
          maxScale: criterionRow.escala_maxima,
          isActive: criterionRow.ativo
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
  const configuredFisioInstitutionIds = new Set(
    baseCourses
      .filter(
        (course) =>
          course.courseCode === "FISIO" &&
          course.status === "Configurado"
      )
      .map((course) => course.institutionId)
  );
  const courses = baseCourses.map((course) => ({
    ...course,
    sourceConfigurationAvailable:
      course.courseCode !== "FISIO" && configuredFisioInstitutionIds.has(course.institutionId),
    ...resolveDuplicateBaseState({
      courseCode: course.courseCode,
      hasConfiguredFisioBase: configuredFisioInstitutionIds.has(course.institutionId),
      modelCount: course.modelCount,
      groupCount: course.groupCount,
      criterionCount: course.criterionCount,
      requiredDocumentCount: course.requiredDocumentCount
    })
  }));

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
        status: course.status
      })),
    documentTypeOptions: documentTypeRows
      .filter((documentTypeRow) => documentTypeRow.ativo)
      .map((documentTypeRow) => ({
        id: documentTypeRow.id,
        code: documentTypeRow.codigo,
        name: documentTypeRow.nome
      }))
  };
}
