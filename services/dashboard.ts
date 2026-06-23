import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadScopedOperationalGraph,
  resolveScopedDataAccess
} from "@/lib/auth/data-scope";
import {
  buildStudentDashboardData,
  calculateGroupAverage,
  countMissingCriteria
} from "@/lib/grades/calculate";
import { rubricGroups } from "@/lib/grades/definitions";
import { resolveLaunchIdentity } from "@/lib/utils/format";
import {
  absences,
  auditEntries,
  coordinators,
  currentClass,
  currentSemester,
  demoSessions,
  evaluationLaunches,
  professors,
  students
} from "@/lib/mocks/data";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type {
  CoordinatorDashboardData,
  EvaluationLaunch,
  ProfessorDashboardData,
  ProfessorRecord,
  ProfessorStudentSummary,
  ProfileCode,
  SessionUser,
  SemesterSummary,
  StudentDashboardData,
  StudentRecord
} from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type CoordinatorRow = Database["public"]["Tables"]["coordenadores"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type EvaluationItemRow = Database["public"]["Tables"]["itens_avaliados"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_avaliacao"]["Row"];
type AbsenceRow = Database["public"]["Tables"]["ausencias"]["Row"];
type AuditHistoryRow = Database["public"]["Tables"]["historico_alteracoes"]["Row"];

interface StudentDashboardLoadResult {
  dashboard: StudentDashboardData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface StudentDashboardAreaNavItem {
  enrollmentId: string;
  areaName: string;
  blockName: string | null;
  className: string;
  professorNames: string[];
  isSelected: boolean;
  recentUpdateAt: string | null;
}

interface StudentSemesterAreaSummary {
  enrollmentId: string;
  areaName: string;
  blockName: string | null;
  className: string;
  professorNames: string[];
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  completionRate: number;
  publishedLaunchCount: number;
  unjustifiedAbsenceHours: number;
  recentUpdateAt: string | null;
}

interface StudentDashboardPageData {
  student: {
    id: string;
    name: string;
    registration: string;
    email: string;
    cellphone?: string | null;
  };
  semester: SemesterSummary;
  navigation: {
    currentView: "overview" | "area";
    selectedEnrollmentId: string | null;
    areas: StudentDashboardAreaNavItem[];
  };
  overview: {
    totalAreas: number;
    averageFinalPercentage: number;
    averageCompletionRate: number;
    totalPublishedLaunches: number;
    totalUnjustifiedAbsenceHours: number;
    areaSummaries: StudentSemesterAreaSummary[];
  };
  selectedAreaDashboard: StudentDashboardData | null;
}

interface StudentDashboardPageLoadResult {
  pageData: StudentDashboardPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface StudentEvaluationDetailPageData {
  evaluation: {
    id: string;
    launchType: EvaluationLaunch["launchType"];
    publishedAt: string;
    reference: string;
    isLegacyRecord: boolean;
    professorId: string;
    professorName: string | null;
    notes: string | null;
  };
  dashboard: StudentDashboardData;
  area: {
    enrollmentId: string;
    areaName: string;
    blockName: string | null;
    className: string;
  };
}

interface StudentEvaluationDetailLoadResult {
  pageData: StudentEvaluationDetailPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface StudentCurrentSemesterSnapshot {
  studentRow: StudentRow;
  selectedSemester: SemesterRow;
  currentSemesterEnrollments: EnrollmentRow[];
  classMap: Map<string, ClassRow>;
  areaById: Map<string, AreaRow>;
  blockById: Map<number, BlockRow>;
  professorLinks: ProfessorLinkRow[];
  professorUserMap: Map<string, UserRow>;
  evaluationRowsByEnrollmentId: Map<string, EvaluationRow[]>;
  evaluationItemsByEnrollmentId: Map<string, EvaluationItemRow[]>;
  absenceRowsByEnrollmentId: Map<string, AbsenceRow[]>;
  criterionRows: CriterionRow[];
}

interface StudentCurrentSemesterSnapshotLoadResult {
  snapshot: StudentCurrentSemesterSnapshot | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface ProfessorDashboardLoadResult {
  dashboard: ProfessorDashboardData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface CoordinatorDashboardLoadResult {
  dashboard: CoordinatorDashboardData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function buildEmptyState(title: string, description: string): StudentDashboardLoadResult {
  return {
    dashboard: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildStudentPageEmptyState(
  title: string,
  description: string
): StudentDashboardPageLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildProfessorEmptyState(
  title: string,
  description: string
): ProfessorDashboardLoadResult {
  return {
    dashboard: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildCoordinatorEmptyState(
  title: string,
  description: string
): CoordinatorDashboardLoadResult {
  return {
    dashboard: null,
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

function selectMostRecentTimestamp(values: Array<string | null | undefined>) {
  const validValues = values.filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (!validValues.length) {
    return null;
  }

  return [...validValues].sort((left, right) => left.localeCompare(right)).at(-1) ?? null;
}

function getStudentAreaRecentUpdateAt(input: {
  enrollment: EnrollmentRow;
  classGroup: ClassRow;
  professorLinks: ProfessorLinkRow[];
  evaluationRows: EvaluationRow[];
  evaluationItemRows: EvaluationItemRow[];
  absenceRows: AbsenceRow[];
}) {
  if (!input.evaluationRows.length) {
    return null;
  }

  return selectMostRecentTimestamp([
    ...input.evaluationRows.flatMap((evaluation) => [
      evaluation.updated_at,
      evaluation.created_at,
      evaluation.avaliado_em
    ]),
    ...input.evaluationItemRows.flatMap((item) => [item.updated_at, item.created_at])
  ]);
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

function scoreEnrollmentCandidate(input: {
  enrollment: EnrollmentRow;
  classGroup: ClassRow;
  semester: SemesterRow;
}) {
  let score = 0;

  if (input.enrollment.status === "ativa") {
    score += 10;
  }

  if (input.semester.status === "ativo") {
    score += 20;
  }

  if (input.classGroup.ativa) {
    score += 5;
  }

  return score;
}

function selectStudentEnrollment(
  enrollments: EnrollmentRow[],
  classes: ClassRow[],
  semesters: SemesterRow[]
) {
  const classMap = new Map(classes.map((classGroup) => [classGroup.id, classGroup]));
  const semesterMap = new Map(
    semesters.map((semester) => [semester.id, semester])
  );

  const candidates = enrollments
    .map((enrollment) => {
      const classGroup = classMap.get(enrollment.turma_id);

      if (!classGroup) {
        return null;
      }

      const semester = semesterMap.get(classGroup.semestre_id);

      if (!semester) {
        return null;
      }

      return {
        enrollment,
        classGroup,
        semester
      };
    })
    .filter(Boolean) as Array<{
    enrollment: EnrollmentRow;
    classGroup: ClassRow;
    semester: SemesterRow;
  }>;

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => {
    const scoreDifference =
      scoreEnrollmentCandidate(right) - scoreEnrollmentCandidate(left);

    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const semesterDifference =
      new Date(right.semester.data_inicio).getTime() -
      new Date(left.semester.data_inicio).getTime();

    if (semesterDifference !== 0) {
      return semesterDifference;
    }

    return (
      new Date(right.enrollment.updated_at).getTime() -
      new Date(left.enrollment.updated_at).getTime()
    );
  });

  return candidates[0];
}

function buildProfessorRecords(
  linkedProfessorUsers: UserRow[],
  links: ProfessorLinkRow[]
): ProfessorRecord[] {
  const linkMap = new Map(links.map((link) => [link.professor_id, link]));

  return [...linkedProfessorUsers]
    .sort((left, right) => {
      const leftPrincipal = linkMap.get(left.id)?.responsavel_principal ? 1 : 0;
      const rightPrincipal = linkMap.get(right.id)?.responsavel_principal ? 1 : 0;

      if (leftPrincipal !== rightPrincipal) {
        return rightPrincipal - leftPrincipal;
      }

      return left.nome_completo.localeCompare(right.nome_completo);
    })
    .map((professor) => ({
      id: professor.id,
      name: professor.nome_completo,
      email: professor.email,
      functional: null,
      linkedEnrollmentIds: links
        .filter((link) => link.professor_id === professor.id)
        .map((link) => link.matricula_turma_id)
    }));
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

function resolveEvaluationItemMergeKey(item: EvaluationItemRow) {
  return item.criterio_modelo_avaliacao_id ?? item.criterio_id;
}

function resolveEvaluationChainKey(
  evaluation: EvaluationRow,
  evaluationById: Map<string, EvaluationRow>
) {
  if (evaluation.avaliacao_raiz_id) {
    return evaluation.avaliacao_raiz_id;
  }

  let cursor = evaluation;
  let guard = 0;

  while (cursor.avaliacao_origem_id && guard < 20) {
    const originEvaluation = evaluationById.get(cursor.avaliacao_origem_id);

    if (!originEvaluation) {
      return cursor.avaliacao_origem_id;
    }

    if (originEvaluation.avaliacao_raiz_id) {
      return originEvaluation.avaliacao_raiz_id;
    }

    cursor = originEvaluation;
    guard += 1;
  }

  return cursor.id;
}

function mapEvaluationItemsToLaunchItems(
  items: EvaluationItemRow[],
  criterionCodeById: Map<string, string>
) {
  return items
    .map((item) => {
      const criterionCode = criterionCodeById.get(item.criterio_id);

      if (!criterionCode) {
        return null;
      }

      return {
        criterionId: criterionCode,
        rawScore: numberValue(item.nota_bruta),
        feedback: item.feedback ?? undefined,
        rubricOptionLabel: item.opcao_rotulo_snapshot ?? null,
        rubricOptionDescription: item.opcao_descricao_snapshot ?? null
      };
    })
    .filter(Boolean) as EvaluationLaunch["items"];
}

function buildEvaluationLaunches(
  evaluations: EvaluationRow[],
  evaluationItems: EvaluationItemRow[],
  criteria: CriterionRow[],
  enrollmentId: string
): EvaluationLaunch[] {
  const criterionCodeById = new Map(
    criteria.map((criterion) => [criterion.id, criterion.codigo])
  );

  return evaluations.map((evaluation) => {
    const identity = resolveLaunchIdentity({
      launchType: evaluation.tipo_lancamento,
      evaluatedAt: evaluation.avaliado_em,
      reference: evaluation.referencia,
      createdAt: evaluation.created_at
    });

    return {
      id: evaluation.id,
      enrollmentId,
      semesterId: evaluation.semestre_id,
      professorId: evaluation.professor_id,
      reference: identity.label,
      isLegacyRecord: identity.isLegacyRecord,
      launchType: evaluation.tipo_lancamento,
      publishedAt:
        identity.effectiveDateValue ?? evaluation.created_at ?? evaluation.avaliado_em,
      createdAt: evaluation.created_at,
      notes: evaluation.observacoes ?? undefined,
      items: mapEvaluationItemsToLaunchItems(
        evaluationItems.filter((item) => item.avaliacao_id === evaluation.id),
        criterionCodeById
      )
    };
  });
}

function buildEffectivePublishedEvaluationLaunches(
  evaluations: EvaluationRow[],
  evaluationItems: EvaluationItemRow[],
  criteria: CriterionRow[],
  enrollmentId: string
): EvaluationLaunch[] {
  const publishedEvaluations = evaluations.filter(
    (evaluation) => evaluation.status === "publicado"
  );

  if (!publishedEvaluations.length) {
    return [];
  }

  const criterionCodeById = new Map(
    criteria.map((criterion) => [criterion.id, criterion.codigo])
  );
  const evaluationById = new Map(
    publishedEvaluations.map((evaluation) => [evaluation.id, evaluation])
  );
  const itemsByEvaluationId = mapEvaluationItemsByEvaluationId(evaluationItems);
  const chainRowsByKey = new Map<string, EvaluationRow[]>();

  for (const evaluation of publishedEvaluations) {
    const chainKey = resolveEvaluationChainKey(evaluation, evaluationById);
    const currentRows = chainRowsByKey.get(chainKey) ?? [];
    currentRows.push(evaluation);
    chainRowsByKey.set(chainKey, currentRows);
  }

  return [...chainRowsByKey.values()]
    .map((chainRows) => {
      const sortedChainRows = [...chainRows].sort(compareEvaluationRows);
      const latestPublishedEvaluation = sortedChainRows.at(-1);

      if (!latestPublishedEvaluation) {
        return null;
      }

      const effectiveItemsByCriterion = new Map<string, EvaluationItemRow>();

      for (const evaluation of sortedChainRows) {
        for (const item of itemsByEvaluationId.get(evaluation.id) ?? []) {
          effectiveItemsByCriterion.set(resolveEvaluationItemMergeKey(item), item);
        }
      }

      const identity = resolveLaunchIdentity({
        launchType: latestPublishedEvaluation.tipo_lancamento,
        evaluatedAt: latestPublishedEvaluation.avaliado_em,
        reference: latestPublishedEvaluation.referencia,
        createdAt: latestPublishedEvaluation.created_at
      });

      return {
        id: latestPublishedEvaluation.id,
        enrollmentId,
        semesterId: latestPublishedEvaluation.semestre_id,
        professorId: latestPublishedEvaluation.professor_id,
        reference: identity.label,
        isLegacyRecord: identity.isLegacyRecord,
        launchType: latestPublishedEvaluation.tipo_lancamento,
        publishedAt:
          identity.effectiveDateValue ??
          latestPublishedEvaluation.created_at ??
          latestPublishedEvaluation.avaliado_em,
        createdAt: latestPublishedEvaluation.created_at,
        notes: latestPublishedEvaluation.observacoes ?? undefined,
        items: mapEvaluationItemsToLaunchItems(
          [...effectiveItemsByCriterion.values()],
          criterionCodeById
        )
      } satisfies EvaluationLaunch;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const publishedDifference = left!.publishedAt.localeCompare(right!.publishedAt);

      if (publishedDifference !== 0) {
        return publishedDifference;
      }

      const createdDifference = safeSortableTimestamp(left!.createdAt).localeCompare(
        safeSortableTimestamp(right!.createdAt)
      );

      if (createdDifference !== 0) {
        return createdDifference;
      }

      return left!.id.localeCompare(right!.id);
    }) as EvaluationLaunch[];
}

function buildAbsenceRecords(absenceRows: AbsenceRow[], enrollmentId: string) {
  return absenceRows.map((absence) => ({
    id: absence.id,
    enrollmentId,
    registeredBy: absence.registrado_por,
    date: absence.data_ausencia,
    hours: numberValue(absence.horas),
    justified: absence.justificada,
    reason: absence.motivo ?? undefined
  }));
}

function buildStudentRecordFromRows(input: {
  currentUserName?: string;
  studentUser: UserRow;
  studentRow: StudentRow;
  enrollment: EnrollmentRow;
  semester: SemesterRow;
  classGroup: ClassRow;
  professorIds: string[];
}): StudentRecord {
  return {
    id: input.studentUser.id,
    enrollmentId: input.enrollment.id,
    registration: input.studentRow.matricula,
    name:
      input.studentRow.nome_social ??
      input.studentUser.nome_completo ??
      input.currentUserName ??
      "Aluno",
    email: input.studentUser.email,
    cellphone: input.studentRow.celular,
    course: input.studentRow.curso,
    semesterId: input.semester.id,
    classId: input.classGroup.id,
    assignedProfessorIds: input.professorIds
  };
}

export function buildStudentDashboardFromRows(input: {
  currentUserName?: string;
  studentUser: UserRow;
  studentRow: StudentRow;
  enrollment: EnrollmentRow;
  semester: SemesterRow;
  classGroup: ClassRow;
  professorLinks: ProfessorLinkRow[];
  linkedProfessorUsers: UserRow[];
  evaluationRows: EvaluationRow[];
  evaluationItemRows: EvaluationItemRow[];
  criterionRows: CriterionRow[];
  absenceRows: AbsenceRow[];
}): StudentDashboardData {
  const professorIds = input.professorLinks.map((link) => link.professor_id);
  const timelineEvaluations = buildEvaluationLaunches(
    input.evaluationRows,
    input.evaluationItemRows,
    input.criterionRows,
    input.enrollment.id
  );
  const effectiveEvaluations = buildEffectivePublishedEvaluationLaunches(
    input.evaluationRows,
    input.evaluationItemRows,
    input.criterionRows,
    input.enrollment.id
  );

  return buildStudentDashboardData({
    student: buildStudentRecordFromRows({
      currentUserName: input.currentUserName,
      studentUser: input.studentUser,
      studentRow: input.studentRow,
      enrollment: input.enrollment,
      semester: input.semester,
      classGroup: input.classGroup,
      professorIds
    }),
    semester: {
      id: input.semester.id,
      code: input.semester.codigo,
      name: input.semester.nome,
      startsAt: input.semester.data_inicio,
      endsAt: input.semester.data_fim
    },
    classGroup: {
      id: input.classGroup.id,
      code: input.classGroup.codigo,
      name: input.classGroup.nome,
      internshipArea: input.classGroup.area_estagio
    },
    professors: buildProfessorRecords(
      input.linkedProfessorUsers,
      input.professorLinks
    ),
    evaluations: timelineEvaluations,
    effectiveEvaluations,
    absences: buildAbsenceRecords(input.absenceRows, input.enrollment.id)
  });
}

function compareEvaluationLaunchRecords(
  left: EvaluationLaunch,
  right: EvaluationLaunch
) {
  const publishedDifference = left.publishedAt.localeCompare(right.publishedAt);

  if (publishedDifference !== 0) {
    return publishedDifference;
  }

  const createdDifference = (left.createdAt ?? left.publishedAt).localeCompare(
    right.createdAt ?? right.publishedAt
  );

  if (createdDifference !== 0) {
    return createdDifference;
  }

  return left.id.localeCompare(right.id);
}

function buildStudentHistoricalEvaluationDetailFromRows(input: {
  currentUserName?: string;
  studentUser: UserRow;
  studentRow: StudentRow;
  enrollment: EnrollmentRow;
  semester: SemesterRow;
  classGroup: ClassRow;
  professorLinks: ProfessorLinkRow[];
  linkedProfessorUsers: UserRow[];
  evaluationRows: EvaluationRow[];
  evaluationItemRows: EvaluationItemRow[];
  criterionRows: CriterionRow[];
  absenceRows: AbsenceRow[];
  evaluationId: string;
}) {
  const professorIds = input.professorLinks.map((link) => link.professor_id);
  const sortedTimelineEvaluations = buildEvaluationLaunches(
    input.evaluationRows,
    input.evaluationItemRows,
    input.criterionRows,
    input.enrollment.id
  ).sort(compareEvaluationLaunchRecords);
  const selectedEvaluationIndex = sortedTimelineEvaluations.findIndex(
    (evaluation) => evaluation.id === input.evaluationId
  );

  if (selectedEvaluationIndex === -1) {
    return null;
  }

  const selectedEvaluation = sortedTimelineEvaluations[selectedEvaluationIndex];
  const evaluationSlice = sortedTimelineEvaluations.slice(0, selectedEvaluationIndex + 1);
  const dashboard = buildStudentDashboardData({
    student: buildStudentRecordFromRows({
      currentUserName: input.currentUserName,
      studentUser: input.studentUser,
      studentRow: input.studentRow,
      enrollment: input.enrollment,
      semester: input.semester,
      classGroup: input.classGroup,
      professorIds
    }),
    semester: {
      id: input.semester.id,
      code: input.semester.codigo,
      name: input.semester.nome,
      startsAt: input.semester.data_inicio,
      endsAt: input.semester.data_fim
    },
    classGroup: {
      id: input.classGroup.id,
      code: input.classGroup.codigo,
      name: input.classGroup.nome,
      internshipArea: input.classGroup.area_estagio
    },
    professors: buildProfessorRecords(
      input.linkedProfessorUsers,
      input.professorLinks
    ),
    evaluations: evaluationSlice,
    effectiveEvaluations: evaluationSlice,
    absences: buildAbsenceRecords(input.absenceRows, input.enrollment.id)
  });

  return {
    dashboard,
    selectedEvaluation
  };
}

function resolveClassAreaSummary(
  classGroup: ClassRow,
  areaById: Map<string, AreaRow>,
  blockById: Map<number, BlockRow>
) {
  const área = classGroup.area_estagio_id
    ? areaById.get(classGroup.area_estagio_id)
    : null;
  const block = área ? blockById.get(área.bloco_id) : null;

  return {
    areaName: área?.nome ?? classGroup.area_estagio,
    blockName: block?.nome ?? null
  };
}

function sortStudentAreaSummaries(
  left: StudentSemesterAreaSummary,
  right: StudentSemesterAreaSummary
) {
  const blockDifference = (left.blockName ?? "").localeCompare(
    right.blockName ?? "",
    "pt-BR"
  );

  if (blockDifference !== 0) {
    return blockDifference;
  }

  return left.areaName.localeCompare(right.areaName, "pt-BR");
}

function selectPrimarySemester(semesters: SemesterRow[]) {
  if (!semesters.length) {
    return null;
  }

  return [...semesters].sort((left, right) => {
    const statusWeight = (semester: SemesterRow) =>
      semester.status === "ativo" ? 2 : semester.status === "planejado" ? 1 : 0;

    const statusDifference = statusWeight(right) - statusWeight(left);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return (
      new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime()
    );
  })[0];
}

function buildCurrentUserStudentUserRow(currentUser: SessionUser): UserRow {
  return {
    id: currentUser.id,
    perfil_id: 0,
    unidade_id: currentUser.unitId ?? null,
    contexto_padrao_id: currentUser.contextoPadraoId ?? null,
    email: currentUser.email,
    nome_completo: currentUser.name,
    ativo: true,
    created_at: "",
    updated_at: ""
  };
}

function mapRowsByEnrollmentId<T extends { matricula_turma_id: string }>(rows: T[]) {
  const rowsByEnrollmentId = new Map<string, T[]>();

  for (const row of rows) {
    const currentRows = rowsByEnrollmentId.get(row.matricula_turma_id) ?? [];
    currentRows.push(row);
    rowsByEnrollmentId.set(row.matricula_turma_id, currentRows);
  }

  return rowsByEnrollmentId;
}

function mapEvaluationItemsByEnrollmentId(
  evaluationRows: EvaluationRow[],
  evaluationItemRows: EvaluationItemRow[]
) {
  const enrollmentIdByEvaluationId = new Map(
    evaluationRows.map((evaluation) => [evaluation.id, evaluation.matricula_turma_id])
  );
  const rowsByEnrollmentId = new Map<string, EvaluationItemRow[]>();

  for (const item of evaluationItemRows) {
    const enrollmentId = enrollmentIdByEvaluationId.get(item.avaliacao_id);

    if (!enrollmentId) {
      continue;
    }

    const currentRows = rowsByEnrollmentId.get(enrollmentId) ?? [];
    currentRows.push(item);
    rowsByEnrollmentId.set(enrollmentId, currentRows);
  }

  return rowsByEnrollmentId;
}

async function loadAuthenticatedStudentCurrentSemesterSnapshot(
  currentUser: SessionUser
): Promise<StudentCurrentSemesterSnapshotLoadResult> {
  const supabase = await createSupabaseServerClient();

  const { data: studentRowData, error: studentError } = await supabase
    .from("alunos")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (studentError) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar seus dados acadêmicos",
        description:
          "Houve um problema ao consultar o cadastro do aluno. Tente novamente em instantes."
      }
    };
  }

  const studentRow = (studentRowData ?? null) as StudentRow | null;

  if (!studentRow) {
    return {
      snapshot: null,
      emptyState: {
        title: "Dados acadêmicos ainda não disponíveis",
        description:
          "Seu usuário está autenticado, mas ainda não encontramos um cadastro em `public.alunos` vinculado a esta conta."
      }
    };
  }

  const { data: enrollmentRowsData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .eq("aluno_id", currentUser.id);

  if (enrollmentError) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar suas matrículas",
        description:
          "Houve um problema ao consultar as matrículas do seu estágio. Tente novamente em instantes."
      }
    };
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as EnrollmentRow[];

  if (!enrollmentRows.length) {
    return {
      snapshot: null,
      emptyState: {
        title: "Dados acadêmicos ainda não disponíveis",
        description:
          "Ainda não há matrículas vinculadas ao seu usuário para montar a navegação por área."
      }
    };
  }

  const classIds = [...new Set(enrollmentRows.map((row) => row.turma_id))];
  const { data: classRowsData, error: classError } = await supabase
    .from("turmas")
    .select("*")
    .in("id", classIds);

  if (classError) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar suas turmas",
        description:
          "Houve um problema ao consultar as turmas vinculadas ao seu estágio."
      }
    };
  }

  const classRows = (classRowsData ?? []) as ClassRow[];
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];
  const semesterResult = semesterIds.length
    ? await supabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterResult.error) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar o semestre",
        description:
          "Houve um problema ao consultar o semestre acadêmico das suas turmas."
      }
    };
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterResult.data ?? []) as SemesterRow[],
    currentUser
  );
  const visibleClassRows = filterClassesToSemesters(classRows, semesterRows);
  const classMap = new Map(visibleClassRows.map((classGroup) => [classGroup.id, classGroup]));
  const visibleEnrollmentRows = filterEnrollmentsToClasses(
    enrollmentRows,
    visibleClassRows
  );
  const selectedSemester = selectPrimarySemester(semesterRows);

  if (!selectedSemester) {
    return {
      snapshot: null,
      emptyState: {
        title: "Dados acadêmicos ainda não disponíveis",
        description:
          "Encontramos seu cadastro, mas ainda não há semestre consistente para montar a navegação."
      }
    };
  }

  const currentSemesterEnrollments = visibleEnrollmentRows.filter((enrollment) => {
    const classGroup = classMap.get(enrollment.turma_id);

    return (
      classGroup?.semestre_id === selectedSemester.id &&
      enrollment.status !== "cancelada"
    );
  });

  if (!currentSemesterEnrollments.length) {
    return {
      snapshot: null,
      emptyState: {
        title: "Nenhuma área encontrada para o semestre atual",
        description:
          "Seu cadastro foi encontrado, mas ainda não há áreas de estágio vinculadas a você no semestre principal."
      }
    };
  }

  const currentSemesterClassIds = [
    ...new Set(currentSemesterEnrollments.map((enrollment) => enrollment.turma_id))
  ];
  const currentSemesterClasses = visibleClassRows.filter((classGroup) =>
    currentSemesterClassIds.includes(classGroup.id)
  );
  const areaIds = [
    ...new Set(
      currentSemesterClasses
        .map((classGroup) => classGroup.area_estagio_id)
        .filter(Boolean)
    )
  ] as string[];

  const [areaRowsResult, blockRowsResult] = await Promise.all([
    areaIds.length
      ? supabase.from("areas_estagio").select("*").in("id", areaIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true })
  ]);

  if (areaRowsResult.error || blockRowsResult.error) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar as áreas de estágio",
        description:
          "Encontramos suas matrículas do semestre, mas faltou contexto de áreas e blocos para montar a navegação."
      }
    };
  }

  const currentSemesterEnrollmentIds = currentSemesterEnrollments.map(
    (enrollment) => enrollment.id
  );
  const [professorLinksResult, evaluationsResult, absencesResult] = await Promise.all([
    supabase
      .from("vinculos_professor_aluno")
      .select("*")
      .in("matricula_turma_id", currentSemesterEnrollmentIds)
      .eq("ativo", true),
    supabase
      .from("avaliacoes")
      .select("*")
      .in("matricula_turma_id", currentSemesterEnrollmentIds)
      .eq("status", "publicado")
      .order("avaliado_em", { ascending: true }),
    supabase
      .from("ausencias")
      .select("*")
      .in("matricula_turma_id", currentSemesterEnrollmentIds)
      .order("data_ausencia", { ascending: true })
  ]);

  if (professorLinksResult.error || evaluationsResult.error || absencesResult.error) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar seu histórico acadêmico",
        description:
          "Houve um problema ao consultar professores, avaliações ou ausências das suas áreas de estágio."
      }
    };
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const evaluationRows = (evaluationsResult.data ?? []) as EvaluationRow[];
  const absenceRows = (absencesResult.data ?? []) as AbsenceRow[];
  const areaRows = (areaRowsResult.data ?? []) as AreaRow[];
  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const professorIds = [...new Set(professorLinks.map((link) => link.professor_id))];
  const evaluationIds = [...new Set(evaluationRows.map((evaluation) => evaluation.id))];

  const [professorUsersResult, evaluationItemsResult] = await Promise.all([
    professorIds.length
      ? currentUser.unitId
        ? supabase
            .from("usuarios")
            .select("*")
            .in("id", professorIds)
            .eq("unidade_id", currentUser.unitId)
        : supabase.from("usuarios").select("*").in("id", professorIds)
      : Promise.resolve({ data: [], error: null }),
    evaluationIds.length
      ? supabase
          .from("itens_avaliados")
          .select("*")
          .in("avaliacao_id", evaluationIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (evaluationItemsResult.error) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar os itens avaliados",
        description:
          "As avaliações foram encontradas, mas os subitens necessários para montar a visão por área não puderam ser consultados."
      }
    };
  }

  const linkedProfessorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const evaluationItemRows = (evaluationItemsResult.data ?? []) as EvaluationItemRow[];
  const criterionIds = [...new Set(evaluationItemRows.map((item) => item.criterio_id))];
  const criteriaResult = criterionIds.length
    ? await supabase.from("criterios_avaliacao").select("*").in("id", criterionIds)
    : { data: [], error: null };

  if (criteriaResult.error) {
    return {
      snapshot: null,
      emptyState: {
        title: "Não foi possível carregar a rubrica de avaliação",
        description:
          "Os critérios de avaliação não puderam ser consultados para montar o detalhamento por área."
      }
    };
  }

  return {
    snapshot: {
      studentRow,
      selectedSemester,
      currentSemesterEnrollments,
      classMap,
      areaById: new Map(areaRows.map((area) => [area.id, area])),
      blockById: new Map(blockRows.map((block) => [block.id, block])),
      professorLinks,
      professorUserMap: new Map(linkedProfessorUsers.map((user) => [user.id, user])),
      evaluationRowsByEnrollmentId: mapRowsByEnrollmentId(evaluationRows),
      evaluationItemsByEnrollmentId: mapEvaluationItemsByEnrollmentId(
        evaluationRows,
        evaluationItemRows
      ),
      absenceRowsByEnrollmentId: mapRowsByEnrollmentId(absenceRows),
      criterionRows: (criteriaResult.data ?? []) as CriterionRow[]
    },
    emptyState: null
  };
}

function buildStudentDashboardForCurrentSemesterEnrollment(input: {
  currentUser: SessionUser;
  snapshot: StudentCurrentSemesterSnapshot;
  enrollment: EnrollmentRow;
}) {
  const classGroup = input.snapshot.classMap.get(input.enrollment.turma_id);

  if (!classGroup) {
    return null;
  }

  const enrollmentProfessorLinks = input.snapshot.professorLinks.filter(
    (link) => link.matricula_turma_id === input.enrollment.id
  );
  const enrollmentProfessorUsers = enrollmentProfessorLinks
    .map((link) => input.snapshot.professorUserMap.get(link.professor_id))
    .filter(Boolean) as UserRow[];
  const enrollmentEvaluations =
    input.snapshot.evaluationRowsByEnrollmentId.get(input.enrollment.id) ?? [];
  const enrollmentEvaluationItems =
    input.snapshot.evaluationItemsByEnrollmentId.get(input.enrollment.id) ?? [];
  const enrollmentAbsences =
    input.snapshot.absenceRowsByEnrollmentId.get(input.enrollment.id) ?? [];

  return buildStudentDashboardFromRows({
    currentUserName: input.currentUser.name,
    studentUser: buildCurrentUserStudentUserRow(input.currentUser),
    studentRow: input.snapshot.studentRow,
    enrollment: input.enrollment,
    semester: input.snapshot.selectedSemester,
    classGroup,
    professorLinks: enrollmentProfessorLinks,
    linkedProfessorUsers: enrollmentProfessorUsers,
    evaluationRows: enrollmentEvaluations,
    evaluationItemRows: enrollmentEvaluationItems,
    criterionRows: input.snapshot.criterionRows,
    absenceRows: enrollmentAbsences
  });
}

function getYearMonthInSaoPaulo(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(typeof value === "string" ? new Date(value) : value);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";

  return `${year}-${month}`;
}

function buildAuditSummary(entry: AuditHistoryRow) {
  const tableLabelMap: Record<string, string> = {
    avaliacoes: "avaliação",
    itens_avaliados: "item avaliado",
    ausencias: "ausência",
    vinculos_professor_aluno: "vínculo"
  };

  const tableLabel = tableLabelMap[entry.tabela] ?? entry.tabela;

  switch (entry.acao) {
    case "INSERT":
      return `Novo registro em ${tableLabel}.`;
    case "UPDATE":
      return `Atualização realizada em ${tableLabel}.`;
    case "DELETE":
      return `Exclusão registrada em ${tableLabel}.`;
    default:
      return `Movimentação em ${tableLabel}.`;
  }
}

function buildAuditEntriesFromRows(
  entries: AuditHistoryRow[],
  users: UserRow[]
): CoordinatorDashboardData["recentAuditEntries"] {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return entries.map((entry) => {
    const actor = entry.usuario_id ? userMap.get(entry.usuario_id) : null;
    const recordLabel = entry.registro_id
      ? `${entry.tabela} · ${entry.registro_id.slice(0, 8)}`
      : entry.tabela;

    return {
      id: String(entry.id),
      tableName: entry.tabela,
      action: entry.acao,
      actorId: entry.usuario_id ?? "sistema",
      actorName: actor?.nome_completo ?? "Sistema",
      happenedAt: entry.created_at,
      recordLabel,
      summary: buildAuditSummary(entry)
    };
  });
}

export function getDemoSession(role: ProfileCode): SessionUser {
  return demoSessions[role];
}

export async function getAuthenticatedStudentDashboard(
  currentUser: SessionUser
): Promise<StudentDashboardLoadResult> {
  const supabase = await createSupabaseServerClient();

  const { data: studentRowData, error: studentError } = await supabase
    .from("alunos")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (studentError) {
    return buildEmptyState(
      "Não foi possível carregar seus dados acadêmicos",
      "Houve um problema ao consultar o cadastro do aluno. Tente novamente em instantes."
    );
  }

  const studentRow = (studentRowData ?? null) as StudentRow | null;

  if (!studentRow) {
    return buildEmptyState(
      "Dados acadêmicos ainda não disponíveis",
      "Seu usuário está autenticado, mas ainda não encontramos um cadastro em `public.alunos` vinculado a esta conta."
    );
  }

  const { data: enrollmentRowsData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .eq("aluno_id", currentUser.id);

  if (enrollmentError) {
    return buildEmptyState(
      "Não foi possível carregar sua matrícula",
      "Houve um problema ao consultar sua matrícula acadêmica. Tente novamente em instantes."
    );
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as EnrollmentRow[];

  if (!enrollmentRows.length) {
    return buildEmptyState(
      "Dados acadêmicos ainda não disponíveis",
      "Ainda não há matrícula de turma vinculada ao seu usuário para exibir o dashboard."
    );
  }

  const classIds = [...new Set(enrollmentRows.map((row) => row.turma_id))];
  const { data: classRowsData, error: classError } = await supabase
    .from("turmas")
    .select("*")
    .in("id", classIds);

  if (classError) {
    return buildEmptyState(
      "Não foi possível carregar sua turma",
      "Houve um problema ao consultar a turma vinculada ao seu estágio."
    );
  }

  const classRows = (classRowsData ?? []) as ClassRow[];
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];

  const semesterResult = semesterIds.length
    ? await supabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterResult.error) {
    return buildEmptyState(
      "Não foi possível carregar o semestre",
      "Houve um problema ao consultar o semestre acadêmico da sua turma."
    );
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterResult.data ?? []) as SemesterRow[],
    currentUser
  );
  const visibleClassRows = filterClassesToSemesters(classRows, semesterRows);
  const visibleEnrollmentRows = filterEnrollmentsToClasses(
    enrollmentRows,
    visibleClassRows
  );
  const selectedEnrollment = selectStudentEnrollment(
    visibleEnrollmentRows,
    visibleClassRows,
    semesterRows
  );

  if (!selectedEnrollment) {
    return buildEmptyState(
      "Dados acadêmicos ainda não disponíveis",
      "Encontramos seu cadastro de aluno, mas ainda não há turma e semestre consistentes para montar o dashboard."
    );
  }

  const { enrollment, classGroup, semester } = selectedEnrollment;

  const [professorLinksResult, evaluationsResult, absencesResult] = await Promise.all([
    supabase
      .from("vinculos_professor_aluno")
      .select("*")
      .eq("matricula_turma_id", enrollment.id)
      .eq("ativo", true),
    supabase
      .from("avaliacoes")
      .select("*")
      .eq("matricula_turma_id", enrollment.id)
      .eq("status", "publicado")
      .order("avaliado_em", { ascending: true }),
    supabase
      .from("ausencias")
      .select("*")
      .eq("matricula_turma_id", enrollment.id)
      .order("data_ausencia", { ascending: true })
  ]);

  if (professorLinksResult.error || evaluationsResult.error || absencesResult.error) {
    return buildEmptyState(
      "Não foi possível carregar seu histórico acadêmico",
      "Houve um problema ao consultar professores, avaliações ou ausências vinculados à sua matrícula."
    );
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const evaluationRows = (evaluationsResult.data ?? []) as EvaluationRow[];
  const absenceRows = (absencesResult.data ?? []) as AbsenceRow[];

  const professorIds = [...new Set(professorLinks.map((link) => link.professor_id))];
  const evaluationIds = [...new Set(evaluationRows.map((evaluation) => evaluation.id))];

  const [professorUsersResult, evaluationItemsResult] = await Promise.all([
    professorIds.length
      ? currentUser.unitId
        ? supabase
            .from("usuarios")
            .select("*")
            .in("id", professorIds)
            .eq("unidade_id", currentUser.unitId)
        : supabase.from("usuarios").select("*").in("id", professorIds)
      : Promise.resolve({ data: [], error: null }),
    evaluationIds.length
      ? supabase
          .from("itens_avaliados")
          .select("*")
          .in("avaliacao_id", evaluationIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (evaluationItemsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar os itens avaliados",
      "As avaliações foram encontradas, mas os subitens necessários para calcular a média não puderam ser consultados."
    );
  }

  const linkedProfessorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const evaluationItemRows = (evaluationItemsResult.data ?? []) as EvaluationItemRow[];
  const criterionIds = [
    ...new Set(evaluationItemRows.map((item) => item.criterio_id))
  ];

  const criteriaResult = criterionIds.length
    ? await supabase.from("criterios_avaliacao").select("*").in("id", criterionIds)
    : { data: [], error: null };

  if (criteriaResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a rubrica de avaliação",
      "Os critérios de avaliação não puderam ser consultados para montar o detalhamento da nota."
    );
  }

  const criterionRows = (criteriaResult.data ?? []) as CriterionRow[];

  const realDashboard = buildStudentDashboardFromRows({
    currentUserName: currentUser.name,
    studentUser: {
      id: currentUser.id,
      perfil_id: 0,
      unidade_id: currentUser.unitId ?? null,
      contexto_padrao_id: currentUser.contextoPadraoId ?? null,
      email: currentUser.email,
      nome_completo: currentUser.name,
      ativo: true,
      created_at: "",
      updated_at: ""
    },
    studentRow,
    enrollment,
    semester,
    classGroup,
    professorLinks,
    linkedProfessorUsers,
    evaluationRows,
    evaluationItemRows,
    criterionRows,
    absenceRows
  });

  return {
    dashboard: realDashboard,
    emptyState: null
  };
}

export async function getAuthenticatedStudentDashboardPageData(
  currentUser: SessionUser,
  requestedEnrollmentId?: string | null
): Promise<StudentDashboardPageLoadResult> {
  const { snapshot, emptyState } =
    await loadAuthenticatedStudentCurrentSemesterSnapshot(currentUser);

  if (!snapshot || emptyState) {
    return {
      pageData: null,
      emptyState
    };
  }

  const dashboardsByEnrollmentId = new Map<string, StudentDashboardData>();
  const recentUpdateAtByEnrollmentId = new Map<string, string | null>();
  const areaSummaries: StudentSemesterAreaSummary[] = [];

  for (const enrollment of snapshot.currentSemesterEnrollments) {
    const classGroup = snapshot.classMap.get(enrollment.turma_id);
    const enrollmentDashboard = buildStudentDashboardForCurrentSemesterEnrollment({
      currentUser,
      snapshot,
      enrollment
    });

    if (!classGroup || !enrollmentDashboard) {
      continue;
    }

    const enrollmentProfessorLinks = snapshot.professorLinks.filter(
      (link) => link.matricula_turma_id === enrollment.id
    );
    const enrollmentEvaluations =
      snapshot.evaluationRowsByEnrollmentId.get(enrollment.id) ?? [];
    const enrollmentEvaluationItems =
      snapshot.evaluationItemsByEnrollmentId.get(enrollment.id) ?? [];
    const enrollmentAbsences =
      snapshot.absenceRowsByEnrollmentId.get(enrollment.id) ?? [];

    dashboardsByEnrollmentId.set(enrollment.id, enrollmentDashboard);
    recentUpdateAtByEnrollmentId.set(
      enrollment.id,
      getStudentAreaRecentUpdateAt({
        enrollment,
        classGroup,
        professorLinks: enrollmentProfessorLinks,
        evaluationRows: enrollmentEvaluations,
        evaluationItemRows: enrollmentEvaluationItems,
        absenceRows: enrollmentAbsences
      })
    );

    const classArea = resolveClassAreaSummary(
      classGroup,
      snapshot.areaById,
      snapshot.blockById
    );
    areaSummaries.push({
      enrollmentId: enrollment.id,
      areaName: classArea.areaName,
      blockName: classArea.blockName,
      className: classGroup.nome,
      professorNames: enrollmentDashboard.professors.map((professor) => professor.name),
      subtotalPercentage: enrollmentDashboard.subtotalPercentage,
      absencePenaltyPercentage: enrollmentDashboard.absencePenaltyPercentage,
      finalPercentage: enrollmentDashboard.finalPercentage,
      completionRate: enrollmentDashboard.completionRate,
      publishedLaunchCount: enrollmentEvaluations.length,
      unjustifiedAbsenceHours: enrollmentDashboard.absences
        .filter((absence) => !absence.justified)
        .reduce((sum, absence) => sum + absence.hours, 0),
      recentUpdateAt: recentUpdateAtByEnrollmentId.get(enrollment.id) ?? null
    });
  }

  if (!dashboardsByEnrollmentId.size || !areaSummaries.length) {
    return buildStudentPageEmptyState(
      "Dados acadêmicos ainda não disponíveis",
      "As áreas do semestre foram encontradas, mas ainda faltam dados consistentes para montar sua navegação acadêmica."
    );
  }

  areaSummaries.sort(sortStudentAreaSummaries);
  const selectedAreaDashboard =
    requestedEnrollmentId && dashboardsByEnrollmentId.has(requestedEnrollmentId)
      ? dashboardsByEnrollmentId.get(requestedEnrollmentId) ?? null
      : null;
  const navigationAreas = areaSummaries.map((areaSummary) => ({
    enrollmentId: areaSummary.enrollmentId,
    areaName: areaSummary.areaName,
    blockName: areaSummary.blockName,
    className: areaSummary.className,
    professorNames: areaSummary.professorNames,
    isSelected: areaSummary.enrollmentId === requestedEnrollmentId,
    recentUpdateAt:
      recentUpdateAtByEnrollmentId.get(areaSummary.enrollmentId) ?? null
  }));
  const averageFinalPercentage = areaSummaries.length
    ? areaSummaries.reduce((sum, areaSummary) => sum + areaSummary.finalPercentage, 0) /
      areaSummaries.length
    : 0;
  const averageCompletionRate = areaSummaries.length
    ? areaSummaries.reduce((sum, areaSummary) => sum + areaSummary.completionRate, 0) /
      areaSummaries.length
    : 0;
  const totalPublishedLaunches = areaSummaries.reduce(
    (sum, areaSummary) => sum + areaSummary.publishedLaunchCount,
    0
  );
  const totalUnjustifiedAbsenceHours = areaSummaries.reduce(
    (sum, areaSummary) => sum + areaSummary.unjustifiedAbsenceHours,
    0
  );

  return {
    pageData: {
      student: {
        id: currentUser.id,
        name: currentUser.name,
        registration: snapshot.studentRow.matricula,
        email: currentUser.email,
        cellphone: snapshot.studentRow.celular
      },
      semester: {
        id: snapshot.selectedSemester.id,
        code: snapshot.selectedSemester.codigo,
        name: snapshot.selectedSemester.nome,
        startsAt: snapshot.selectedSemester.data_inicio,
        endsAt: snapshot.selectedSemester.data_fim
      },
      navigation: {
        currentView: selectedAreaDashboard ? "area" : "overview",
        selectedEnrollmentId: selectedAreaDashboard?.student.enrollmentId ?? null,
        areas: navigationAreas
      },
      overview: {
        totalAreas: areaSummaries.length,
        averageFinalPercentage: Math.round(averageFinalPercentage * 100) / 100,
        averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
        totalPublishedLaunches,
        totalUnjustifiedAbsenceHours:
          Math.round(totalUnjustifiedAbsenceHours * 100) / 100,
        areaSummaries
      },
      selectedAreaDashboard
    },
    emptyState: null
  };
}

export async function getAuthenticatedStudentEvaluationDetailPageData(
  currentUser: SessionUser,
  evaluationId: string
): Promise<StudentEvaluationDetailLoadResult> {
  const normalizedEvaluationId = evaluationId.trim();

  if (!normalizedEvaluationId) {
    return {
      pageData: null,
      emptyState: {
        title: "Avaliação não identificada",
        description:
          "O lançamento solicitado não foi informado corretamente para carregar o histórico."
      }
    };
  }

  const { snapshot, emptyState } =
    await loadAuthenticatedStudentCurrentSemesterSnapshot(currentUser);

  if (!snapshot || emptyState) {
    return {
      pageData: null,
      emptyState
    };
  }

  for (const enrollment of snapshot.currentSemesterEnrollments) {
    const classGroup = snapshot.classMap.get(enrollment.turma_id);
    const enrollmentEvaluations =
      snapshot.evaluationRowsByEnrollmentId.get(enrollment.id) ?? [];

    if (
      !classGroup ||
      !enrollmentEvaluations.some((evaluation) => evaluation.id === normalizedEvaluationId)
    ) {
      continue;
    }

    const enrollmentProfessorLinks = snapshot.professorLinks.filter(
      (link) => link.matricula_turma_id === enrollment.id
    );
    const enrollmentProfessorUsers = enrollmentProfessorLinks
      .map((link) => snapshot.professorUserMap.get(link.professor_id))
      .filter(Boolean) as UserRow[];
    const detail = buildStudentHistoricalEvaluationDetailFromRows({
      currentUserName: currentUser.name,
      studentUser: buildCurrentUserStudentUserRow(currentUser),
      studentRow: snapshot.studentRow,
      enrollment,
      semester: snapshot.selectedSemester,
      classGroup,
      professorLinks: enrollmentProfessorLinks,
      linkedProfessorUsers: enrollmentProfessorUsers,
      evaluationRows: enrollmentEvaluations,
      evaluationItemRows:
        snapshot.evaluationItemsByEnrollmentId.get(enrollment.id) ?? [],
      criterionRows: snapshot.criterionRows,
      absenceRows: snapshot.absenceRowsByEnrollmentId.get(enrollment.id) ?? [],
      evaluationId: normalizedEvaluationId
    });

    if (!detail) {
      continue;
    }

    const classArea = resolveClassAreaSummary(
      classGroup,
      snapshot.areaById,
      snapshot.blockById
    );
    const selectedProfessorName =
      snapshot.professorUserMap.get(detail.selectedEvaluation.professorId)?.nome_completo ??
      null;

    return {
      pageData: {
        evaluation: {
          id: detail.selectedEvaluation.id,
          launchType: detail.selectedEvaluation.launchType,
          publishedAt: detail.selectedEvaluation.publishedAt,
          reference: detail.selectedEvaluation.reference,
          isLegacyRecord: detail.selectedEvaluation.isLegacyRecord ?? false,
          professorId: detail.selectedEvaluation.professorId,
          professorName: selectedProfessorName,
          notes: detail.selectedEvaluation.notes ?? null
        },
        dashboard: detail.dashboard,
        area: {
          enrollmentId: enrollment.id,
          areaName: classArea.areaName,
          blockName: classArea.blockName,
          className: classGroup.nome
        }
      },
      emptyState: null
    };
  }

  return {
    pageData: null,
    emptyState: {
      title: "Avaliação não disponível",
      description:
        "O lançamento solicitado não pertence ao aluno autenticado ou não está disponível no semestre atual."
    }
  };
}

export function getStudentDashboard(studentId = demoSessions.aluno.id) {
  const student = students.find((item) => item.id === studentId);

  if (!student) {
    throw new Error("Aluno não encontrado.");
  }

  const studentProfessors = professors.filter((professor) =>
    student.assignedProfessorIds.includes(professor.id)
  );
  const studentEvaluations = evaluationLaunches.filter(
    (launch) => launch.enrollmentId === student.enrollmentId
  );
  const studentAbsences = absences.filter(
    (absence) => absence.enrollmentId === student.enrollmentId
  );

  return buildStudentDashboardData({
    student,
    semester: currentSemester,
    classGroup: currentClass,
    professors: studentProfessors,
    evaluations: studentEvaluations,
    absences: studentAbsences
  });
}

function classifyStudent(summary: Omit<ProfessorStudentSummary, "status">) {
  if (summary.finalPercentage < 65) {
    return "critico" as const;
  }

  if (summary.finalPercentage < 76) {
    return "atencao" as const;
  }

  return "bem" as const;
}

export function buildProfessorStudentSummary(studentDashboard: StudentDashboardData) {
  const baseSummary = {
    studentId: studentDashboard.student.id,
    enrollmentId: studentDashboard.student.enrollmentId,
    studentName: studentDashboard.student.name,
    registration: studentDashboard.student.registration,
    email: studentDashboard.student.email,
    cellphone: studentDashboard.student.cellphone,
    className: studentDashboard.classGroup.name,
    finalPercentage: studentDashboard.finalPercentage,
    subtotalPercentage: studentDashboard.subtotalPercentage,
    absencePenaltyPercentage: studentDashboard.absencePenaltyPercentage,
    completionRate: studentDashboard.completionRate
  };

  return {
    ...baseSummary,
    status: classifyStudent(baseSummary)
  };
}

export function getProfessorDashboard(
  professorId = demoSessions.professor.id
): ProfessorDashboardData {
  const professor = professors.find((item) => item.id === professorId);

  if (!professor) {
    throw new Error("Professor não encontrado.");
  }

  const linkedStudentDashboards = students
    .filter((student) => professor.linkedEnrollmentIds.includes(student.enrollmentId))
    .map((student) => getStudentDashboard(student.id));

  const linkedStudents = linkedStudentDashboards.map(buildProfessorStudentSummary);

  const classAveragePercentage =
    linkedStudents.reduce((sum, student) => sum + student.finalPercentage, 0) /
    Math.max(linkedStudents.length, 1);

  const launchesThisMonth = evaluationLaunches.filter(
    (launch) =>
      launch.professorId === professorId &&
      launch.publishedAt.startsWith("2026-04")
  ).length;

  return {
    professor,
    semester: currentSemester,
    linkedStudents,
    totalAssignedStudents: linkedStudents.length,
    classAveragePercentage: Math.round(classAveragePercentage * 100) / 100,
    studentsAtRisk: linkedStudents.filter((student) => student.status !== "bem").length,
    launchesThisMonth
  };
}

export async function getAuthenticatedProfessorDashboard(
  currentUser: SessionUser
): Promise<ProfessorDashboardLoadResult> {
  const supabase = await createSupabaseServerClient();

  const { data: professorRowData, error: professorError } = await supabase
    .from("professores")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError) {
    return buildProfessorEmptyState(
      "Não foi possível carregar o cadastro do professor",
      "Houve um problema ao consultar `public.professores` para esta conta."
    );
  }

  if (!professorRowData) {
    return buildProfessorEmptyState(
      "Cadastro docente ainda não disponível",
      "Seu usuário possui perfil professor, mas ainda não existe um registro correspondente em `public.professores`."
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  const { data: professorLinksData, error: linksError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("professor_id", currentUser.id)
    .eq("ativo", true)
    .or(`data_fim.is.null,data_fim.gte.${today}`);

  if (linksError) {
    return buildProfessorEmptyState(
      "Não foi possível carregar seus vínculos",
      "Houve um problema ao consultar os alunos vinculados a este professor."
    );
  }

  const professorLinks = (professorLinksData ?? []) as ProfessorLinkRow[];

  if (!professorLinks.length) {
    return buildProfessorEmptyState(
      "Nenhum aluno vinculado no momento",
      "Este professor ainda não possui vínculos ativos com matrículas de alunos."
    );
  }

  const enrollmentIds = [
    ...new Set(professorLinks.map((link) => link.matricula_turma_id))
  ];

  const { data: enrollmentRowsData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return buildProfessorEmptyState(
      "Não foi possível carregar as matrículas",
      "Os vínculos foram encontrados, mas as matrículas dos alunos não puderam ser consultadas."
    );
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as EnrollmentRow[];
  const activeEnrollmentRows = enrollmentRows.filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!activeEnrollmentRows.length) {
    return buildProfessorEmptyState(
      "Nenhum aluno vinculado no momento",
      "Os vínculos existem, mas não há matrículas ativas disponíveis para este professor."
    );
  }

  const classIds = [...new Set(activeEnrollmentRows.map((row) => row.turma_id))];
  const studentIds = [...new Set(activeEnrollmentRows.map((row) => row.aluno_id))];

  const [classRowsResult, studentRowsResult, studentUsersResult] = await Promise.all([
    classIds.length
      ? supabase.from("turmas").select("*").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? currentUser.unitId
        ? supabase
            .from("usuarios")
            .select("*")
            .in("id", studentIds)
            .eq("unidade_id", currentUser.unitId)
            .eq("ativo", true)
        : supabase.from("usuarios").select("*").in("id", studentIds)
            .eq("ativo", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (classRowsResult.error || studentRowsResult.error || studentUsersResult.error) {
    return buildProfessorEmptyState(
      "Não foi possível carregar os alunos vinculados",
      "Houve um problema ao consultar turmas ou dados básicos dos alunos vinculados."
    );
  }

  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterActiveStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[]
  );
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];

  const [semesterRowsResult, evaluationRowsResult, absenceRowsResult] = await Promise.all([
    semesterIds.length
      ? supabase.from("semestres").select("*").in("id", semesterIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? supabase
          .from("avaliacoes")
          .select("*")
          .in("matricula_turma_id", enrollmentIds)
          .eq("status", "publicado")
          .order("avaliado_em", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? supabase
          .from("ausencias")
          .select("*")
          .in("matricula_turma_id", enrollmentIds)
          .order("data_ausencia", { ascending: true })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (semesterRowsResult.error || evaluationRowsResult.error || absenceRowsResult.error) {
    return buildProfessorEmptyState(
      "Não foi possível carregar o painel acadêmico",
      "Houve um problema ao consultar semestres, avaliações ou ausências dos alunos vinculados."
    );
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterRowsResult.data ?? []) as SemesterRow[],
    currentUser
  );
  classRows = filterClassesToSemesters(classRows, semesterRows);
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollmentRows = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(activeEnrollmentRows, classRows),
    activeStudentIdSet
  );

  if (!visibleEnrollmentRows.length || !classRows.length || !semesterRows.length) {
    return buildProfessorEmptyState(
      "Nenhum aluno vinculado no momento",
      "Assim que houver alunos vinculados à sua unidade e à sua supervisão, este painel será atualizado automaticamente."
    );
  }

  const visibleEnrollmentIdSet = new Set(
    visibleEnrollmentRows.map((enrollment) => enrollment.id)
  );
  const evaluationRows = ((evaluationRowsResult.data ?? []) as EvaluationRow[]).filter(
    (evaluation) => visibleEnrollmentIdSet.has(evaluation.matricula_turma_id)
  );
  const absenceRows = ((absenceRowsResult.data ?? []) as AbsenceRow[]).filter(
    (absence) => visibleEnrollmentIdSet.has(absence.matricula_turma_id)
  );
  const evaluationIds = [...new Set(evaluationRows.map((row) => row.id))];

  const [evaluationItemsResult, professorUsersResult] = await Promise.all([
    evaluationIds.length
      ? supabase
          .from("itens_avaliados")
          .select("*")
          .in("avaliacao_id", evaluationIds)
      : Promise.resolve({ data: [], error: null }),
    currentUser.unitId
      ? supabase
          .from("usuarios")
          .select("*")
          .eq("id", currentUser.id)
          .eq("unidade_id", currentUser.unitId)
      : supabase.from("usuarios").select("*").eq("id", currentUser.id)
  ]);

  if (evaluationItemsResult.error || professorUsersResult.error) {
    return buildProfessorEmptyState(
      "Não foi possível consolidar o painel",
      "Os dados básicos foram encontrados, mas faltaram itens avaliados ou dados do professor para consolidar o painel."
    );
  }

  const evaluationItemRows = (evaluationItemsResult.data ?? []) as EvaluationItemRow[];
  const currentProfessorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const criterionIds = [
    ...new Set(evaluationItemRows.map((item) => item.criterio_id))
  ];

  const criteriaResult = criterionIds.length
    ? await supabase.from("criterios_avaliacao").select("*").in("id", criterionIds)
    : { data: [], error: null };

  if (criteriaResult.error) {
    return buildProfessorEmptyState(
      "Não foi possível carregar a rubrica de avaliação",
      "Os critérios necessários para calcular o desempenho dos alunos não puderam ser consultados."
    );
  }

  const criterionRows = (criteriaResult.data ?? []) as CriterionRow[];
  const enrollmentMap = new Map(visibleEnrollmentRows.map((row) => [row.id, row]));
  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));
  const professorUserMap = new Map(currentProfessorUsers.map((row) => [row.id, row]));

  const visibleEnrollmentIds = visibleEnrollmentRows.map((enrollment) => enrollment.id);
  const linkedStudentDashboards = visibleEnrollmentIds
    .map((enrollmentId) => {
      const enrollment = enrollmentMap.get(enrollmentId);

      if (!enrollment) {
        return null;
      }

      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup
        ? semesterMap.get(classGroup.semestre_id)
        : undefined;

      if (!studentRow || !studentUser || !classGroup || !semester) {
        return null;
      }

      const enrollmentProfessorLinks = professorLinks.filter(
        (link) => link.matricula_turma_id === enrollmentId
      );
      const enrollmentProfessorUsers = enrollmentProfessorLinks
        .map((link) => professorUserMap.get(link.professor_id))
        .filter(Boolean) as UserRow[];

      return buildStudentDashboardFromRows({
        studentUser,
        studentRow,
        enrollment,
        semester,
        classGroup,
        professorLinks: enrollmentProfessorLinks,
        linkedProfessorUsers: enrollmentProfessorUsers,
        evaluationRows: evaluationRows.filter(
          (evaluation) => evaluation.matricula_turma_id === enrollmentId
        ),
        evaluationItemRows: evaluationItemRows.filter((item) =>
          evaluationRows
            .filter((evaluation) => evaluation.matricula_turma_id === enrollmentId)
            .some((evaluation) => evaluation.id === item.avaliacao_id)
        ),
        criterionRows,
        absenceRows: absenceRows.filter(
          (absence) => absence.matricula_turma_id === enrollmentId
        )
      });
    })
    .filter(Boolean) as StudentDashboardData[];

  const linkedStudents = linkedStudentDashboards.map(buildProfessorStudentSummary);
  const activeSemester = selectPrimarySemester(semesterRows);
  const classAveragePercentage = linkedStudents.length
    ? linkedStudents.reduce((sum, student) => sum + student.finalPercentage, 0) /
      linkedStudents.length
    : 0;
  const currentMonth = getYearMonthInSaoPaulo(new Date());
  const launchesThisMonth = evaluationRows.filter(
    (evaluation) =>
      evaluation.professor_id === currentUser.id &&
      getYearMonthInSaoPaulo(evaluation.avaliado_em) === currentMonth
  ).length;

  return {
    dashboard: {
      professor: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        linkedEnrollmentIds: visibleEnrollmentIds
      },
      semester: activeSemester
        ? {
            id: activeSemester.id,
            code: activeSemester.codigo,
            name: activeSemester.nome,
            startsAt: activeSemester.data_inicio,
            endsAt: activeSemester.data_fim
          }
        : {
            id: "semestre-não-identificado",
            code: "N/A",
            name: "Sem semestre identificado",
            startsAt: "",
            endsAt: ""
          },
      linkedStudents,
      totalAssignedStudents: linkedStudents.length,
      classAveragePercentage: Math.round(classAveragePercentage * 100) / 100,
      studentsAtRisk: linkedStudents.filter((student) => student.status !== "bem").length,
      launchesThisMonth
    },
    emptyState: null
  };
}

export async function getAuthenticatedCoordinatorDashboard(
  currentUser: SessionUser
): Promise<CoordinatorDashboardLoadResult> {
  const supabase = await createSupabaseServerClient();
  const [scope, scopedGraph, coordinatorRowResult] = await Promise.all([
    resolveScopedDataAccess(currentUser, { supabase }),
    loadScopedOperationalGraph(currentUser, { supabase }),
    supabase.from("coordenadores").select("*").eq("usuario_id", currentUser.id).maybeSingle()
  ]);
  const currentUnitId = scope.unitIds[0] ?? currentUser.unitId ?? null;

  if (
    scope.scopeKind === "none" ||
    (!currentUnitId && scope.offerIds.length === 0) ||
    (scope.restrictToCourse && scopedGraph.semesterRows.length === 0 && scope.offerIds.length === 0)
  ) {
    return buildCoordinatorEmptyState(
      "Contexto acadêmico não identificado",
      "O coordenador autenticado precisa estar vinculado a uma oferta, curso ou unidade válida para visualizar o painel."
    );
  }

  if (coordinatorRowResult.error) {
    return buildCoordinatorEmptyState(
      "Não foi possível carregar o cadastro do coordenador",
      formatSupabaseErrorMessage(
        "Houve um problema ao consultar public.coordenadores para esta conta.",
        coordinatorRowResult.error
      )
    );
  }

  const coordinatorRow = (coordinatorRowResult.data ?? null) as CoordinatorRow | null;

  if (!coordinatorRow) {
    return buildCoordinatorEmptyState(
      "Cadastro de coordenação ainda não disponível",
      "Seu usuário possui perfil de coordenador, mas ainda não existe um registro correspondente em public.coordenadores."
    );
  }

  const semesterRows = scopedGraph.semesterRows;
  const activeSemester = selectPrimarySemester(semesterRows);

  if (!activeSemester) {
    return buildCoordinatorEmptyState(
      "Nenhum semestre disponível",
      "Ainda não há semestres cadastrados com dados suficientes para montar o painel do coordenador."
    );
  }

  const classRows = scopedGraph.classRows.filter(
    (classGroup) => classGroup.semestre_id === activeSemester.id
  );

  if (!classRows.length) {
    return buildCoordinatorEmptyState(
      "Nenhuma turma encontrada para o semestre",
      "O semestre principal foi identificado, mas ainda não há turmas vinculadas para consolidar o painel."
    );
  }

  const classIds = classRows.map((classGroup) => classGroup.id);
  const classIdSet = new Set(classIds);
  const activeEnrollmentRows = scopedGraph.enrollmentRows.filter(
    (enrollment) =>
      classIdSet.has(enrollment.turma_id) && enrollment.status === "ativa"
  );

  if (!activeEnrollmentRows.length) {
    return buildCoordinatorEmptyState(
      "Nenhum aluno ativo no semestre atual",
      "Os vínculos do semestre existem, mas não há alunos com acesso ativo disponíveis na operação corrente."
    );
  }

  const areaIds = [
    ...new Set(
      classRows.map((classGroup) => classGroup.area_estagio_id).filter(Boolean)
    )
  ] as string[];
  const [blockRowsResult, areaRowsResult, auditRowsResult, professorLinksResult] =
    await Promise.all([
      supabase
        .from("blocos_estagio")
        .select("*")
        .order("ordem", { ascending: true }),
      areaIds.length
        ? supabase
            .from("areas_estagio")
            .select("*")
            .in("id", areaIds)
            .eq("ativa", true)
        : Promise.resolve({ data: [], error: null } as const),
      currentUnitId
        ? supabase
            .from("historico_alteracoes")
            .select("*")
            .eq("unidade_id", currentUnitId)
            .in("tabela", [
              "usuarios",
              "alunos",
              "professores",
              "turmas",
              "matriculas_turma",
              "professor_areas_estagio",
              "avaliacoes",
              "itens_avaliados",
              "ausencias",
              "vinculos_professor_aluno"
            ])
            .order("created_at", { ascending: false })
            .limit(48)
        : Promise.resolve({ data: [], error: null } as const),
      activeEnrollmentRows.length
        ? supabase
            .from("vinculos_professor_aluno")
            .select("*")
            .in(
              "matricula_turma_id",
              activeEnrollmentRows.map((enrollment) => enrollment.id)
            )
            .eq("ativo", true)
        : Promise.resolve({ data: [], error: null } as const)
    ]);

  if (blockRowsResult.error || areaRowsResult.error || professorLinksResult.error) {
    return buildCoordinatorEmptyState(
      "Não foi possível carregar a visão consolidada",
      formatSupabaseErrorMessage(
        "Houve um problema ao consultar turmas, áreas, blocos ou vínculos da coordenação.",
        blockRowsResult.error ?? areaRowsResult.error ?? professorLinksResult.error
      )
    );
  }

  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const areaRows = (areaRowsResult.data ?? []) as AreaRow[];
  if (auditRowsResult.error) {
    console.error(
      formatSupabaseErrorMessage(
        "A consulta do histórico recente da coordenação falhou.",
        auditRowsResult.error
      )
    );
  }

  const studentIds = [...new Set(activeEnrollmentRows.map((row) => row.aluno_id))];
  const [studentRowsResult, studentUsersResult] = await Promise.all([
    studentIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null } as const),
    studentIds.length
      ? supabase
          .from("usuarios")
          .select("*")
          .in("id", studentIds)
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null } as const)
  ]);

  if (studentRowsResult.error || studentUsersResult.error) {
    return buildCoordinatorEmptyState(
      "Não foi possível consolidar alunos e vínculos",
      "Houve um problema ao consultar os alunos matriculados ou os vínculos docentes deste semestre."
    );
  }

  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterActiveStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[]
  );
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollmentRows = filterEnrollmentsToStudentIds(
    activeEnrollmentRows,
    activeStudentIdSet
  );

  if (!visibleEnrollmentRows.length) {
    return buildCoordinatorEmptyState(
      "Nenhum aluno ativo no semestre atual",
      "Os vínculos do semestre existem, mas não há alunos com acesso ativo disponíveis na operação corrente."
    );
  }

  const enrollmentIds = visibleEnrollmentRows.map((enrollment) => enrollment.id);
  const visibleEnrollmentIdSet = new Set(enrollmentIds);
  const professorLinks = ((professorLinksResult.data ?? []) as ProfessorLinkRow[]).filter(
    (link) => visibleEnrollmentIdSet.has(link.matricula_turma_id)
  );
  const professorIds = [...new Set(professorLinks.map((link) => link.professor_id))];
  const [professorUsersResult, evaluationRowsResult, absenceRowsResult] =
    await Promise.all([
      professorIds.length
        ? supabase.from("usuarios").select("*").in("id", professorIds)
        : Promise.resolve({ data: [], error: null } as const),
      enrollmentIds.length
        ? supabase
            .from("avaliacoes")
            .select("*")
            .in("matricula_turma_id", enrollmentIds)
            .eq("status", "publicado")
            .order("avaliado_em", { ascending: true })
        : Promise.resolve({ data: [], error: null } as const),
      enrollmentIds.length
        ? supabase
            .from("ausencias")
            .select("*")
            .in("matricula_turma_id", enrollmentIds)
            .order("data_ausencia", { ascending: true })
        : Promise.resolve({ data: [], error: null } as const)
    ]);

  if (professorUsersResult.error || evaluationRowsResult.error || absenceRowsResult.error) {
    return buildCoordinatorEmptyState(
      "Não foi possível carregar os dados acadêmicos consolidados",
      formatSupabaseErrorMessage(
        "Houve um problema ao consultar professores, avaliações ou ausências do semestre ativo.",
        professorUsersResult.error ??
          evaluationRowsResult.error ??
          absenceRowsResult.error
      )
    );
  }

  const professorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const evaluationRows = (evaluationRowsResult.data ?? []) as EvaluationRow[];
  const absenceRows = (absenceRowsResult.data ?? []) as AbsenceRow[];
  const evaluationIds = [...new Set(evaluationRows.map((row) => row.id))];
  const [evaluationItemsResult, criterionRowsResult] = await Promise.all([
    evaluationIds.length
      ? supabase
          .from("itens_avaliados")
          .select("*")
          .in("avaliacao_id", evaluationIds)
      : Promise.resolve({ data: [], error: null } as const),
    supabase.from("criterios_avaliacao").select("*").eq("ativo", true)
  ]);

  if (evaluationItemsResult.error || criterionRowsResult.error) {
    return buildCoordinatorEmptyState(
      "Não foi possível carregar a rubrica de avaliação",
      "Os itens avaliados ou os critérios ativos não puderam ser consultados para consolidar o painel."
    );
  }

  const evaluationItemRows = (evaluationItemsResult.data ?? []) as EvaluationItemRow[];
  const criterionRows = (criterionRowsResult.data ?? []) as CriterionRow[];
  const auditRows = auditRowsResult.error
    ? []
    : ((auditRowsResult.data ?? []) as AuditHistoryRow[]);
  const visibleStudentIds = new Set(
    visibleEnrollmentRows.map((enrollment) => enrollment.aluno_id)
  );
  const visibleProfessorIds = new Set(professorIds);
  const visibleEvaluationIds = new Set(evaluationIds);
  const visibleEvaluationItemIds = new Set(evaluationItemRows.map((row) => row.id));
  const filteredAuditRows = auditRows
    .filter((entry) => {
      if (entry.usuario_id) {
        if (
          visibleStudentIds.has(entry.usuario_id) ||
          visibleProfessorIds.has(entry.usuario_id) ||
          entry.usuario_id === currentUser.id
        ) {
          return true;
        }
      }

      if (!entry.registro_id) {
        return false;
      }

      switch (entry.tabela) {
        case "usuarios":
          return (
            visibleStudentIds.has(entry.registro_id) ||
            visibleProfessorIds.has(entry.registro_id) ||
            entry.registro_id === currentUser.id
          );
        case "alunos":
          return visibleStudentIds.has(entry.registro_id);
        case "professores":
          return visibleProfessorIds.has(entry.registro_id);
        case "turmas":
          return classIdSet.has(entry.registro_id);
        case "matriculas_turma":
          return visibleEnrollmentIdSet.has(entry.registro_id);
        case "avaliacoes":
          return visibleEvaluationIds.has(entry.registro_id);
        case "itens_avaliados":
          return visibleEvaluationItemIds.has(entry.registro_id);
        default:
          return false;
      }
    })
    .slice(0, 8);
  const auditUserIds = [
    ...new Set(filteredAuditRows.map((entry) => entry.usuario_id).filter(Boolean))
  ] as string[];
  const auditUsersResult = auditUserIds.length
    ? await supabase.from("usuarios").select("*").in("id", auditUserIds)
    : { data: [], error: null };

  if (auditUsersResult.error) {
    console.error(
      formatSupabaseErrorMessage(
        "A consulta dos atores do histórico recente da coordenação falhou.",
        auditUsersResult.error
      )
    );
  }

  const auditUsers = auditUsersResult.error
    ? []
    : ((auditUsersResult.data ?? []) as UserRow[]);
  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const blockMap = new Map(blockRows.map((block) => [block.id, block]));
  const professorUserMap = new Map(professorUsers.map((row) => [row.id, row]));

  const linkedStudentDashboards = visibleEnrollmentRows
    .map((enrollment) => {
      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);

      if (!studentRow || !studentUser || !classGroup) {
        return null;
      }

      const enrollmentProfessorLinks = professorLinks.filter(
        (link) => link.matricula_turma_id === enrollment.id
      );
      const enrollmentProfessorUsers = enrollmentProfessorLinks
        .map((link) => professorUserMap.get(link.professor_id))
        .filter(Boolean) as UserRow[];
      const enrollmentEvaluations = evaluationRows.filter(
        (evaluation) => evaluation.matricula_turma_id === enrollment.id
      );
      const enrollmentEvaluationIds = new Set(
        enrollmentEvaluations.map((evaluation) => evaluation.id)
      );

      return buildStudentDashboardFromRows({
        studentUser,
        studentRow,
        enrollment,
        semester: activeSemester,
        classGroup,
        professorLinks: enrollmentProfessorLinks,
        linkedProfessorUsers: enrollmentProfessorUsers,
        evaluationRows: enrollmentEvaluations,
        evaluationItemRows: evaluationItemRows.filter((item) =>
          enrollmentEvaluationIds.has(item.avaliacao_id)
        ),
        criterionRows,
        absenceRows: absenceRows.filter(
          (absence) => absence.matricula_turma_id === enrollment.id
        )
      });
    })
    .filter(Boolean) as StudentDashboardData[];

  const linkedStudents = linkedStudentDashboards
    .map(buildProfessorStudentSummary)
    .sort((left, right) => {
      const statusWeight = (status: ProfessorStudentSummary["status"]) =>
        status === "critico" ? 2 : status === "atencao" ? 1 : 0;

      const statusDifference =
        statusWeight(right.status) - statusWeight(left.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return left.finalPercentage - right.finalPercentage;
    });

  const averageFinalPercentage = linkedStudents.length
    ? linkedStudents.reduce((sum, student) => sum + student.finalPercentage, 0) /
      linkedStudents.length
    : 0;

  const totalUnjustifiedAbsenceHours = absenceRows
    .filter((absence) => !absence.justificada)
    .reduce((sum, absence) => sum + numberValue(absence.horas), 0);
  const dashboardByEnrollmentId = new Map(
    linkedStudentDashboards.map((dashboard) => [dashboard.student.enrollmentId, dashboard])
  );
  const areaMetrics = areaRows
    .map((area) => {
      const block = blockMap.get(area.bloco_id);
      const areaEnrollments = visibleEnrollmentRows.filter((enrollment) => {
        const classGroup = classMap.get(enrollment.turma_id);

        return classGroup?.area_estagio_id === area.id;
      });

      if (!areaEnrollments.length) {
        return null;
      }

      const areaDashboards = areaEnrollments
        .map((enrollment) => dashboardByEnrollmentId.get(enrollment.id))
        .filter(Boolean) as StudentDashboardData[];
      const professorIdsByArea = new Set(
        professorLinks
          .filter((link) =>
            areaEnrollments.some(
              (enrollment) => enrollment.id === link.matricula_turma_id
            )
          )
          .map((link) => link.professor_id)
      );

      return {
        areaId: area.id,
        areaName: area.nome,
        blockName: block?.nome ?? "Bloco não identificado",
        studentCount: new Set(areaEnrollments.map((enrollment) => enrollment.aluno_id)).size,
        professorCount: professorIdsByArea.size,
        groups: rubricGroups.map((group) => ({
          groupId: group.id,
          groupName: group.name,
          averagePercentage: calculateGroupAverage(areaDashboards, group.id),
          weightPercentage: group.weightPercentage
        }))
      };
    })
    .filter(Boolean)
    .map((area) => area as NonNullable<typeof area>)
    .sort((left, right) => left.areaName.localeCompare(right.areaName, "pt-BR"));

  return {
    dashboard: {
      coordinator: {
        id: coordinatorRow.usuario_id,
        name: currentUser.name,
        email: currentUser.email
      },
      semester: {
        id: activeSemester.id,
        code: activeSemester.codigo,
        name: activeSemester.nome,
        startsAt: activeSemester.data_inicio,
        endsAt: activeSemester.data_fim
      },
      semesterStatus: activeSemester.status,
      totalStudents: new Set(visibleEnrollmentRows.map((row) => row.aluno_id)).size,
      totalProfessors: professorIds.length,
      averageFinalPercentage: Math.round(averageFinalPercentage * 100) / 100,
      totalUnjustifiedAbsenceHours:
        Math.round(totalUnjustifiedAbsenceHours * 100) / 100,
      areaGroupAverages: areaMetrics,
      areaCoverage: areaMetrics.map((area) => ({
        areaId: area.areaId,
        areaName: area.areaName,
        blockName: area.blockName,
        studentCount: area.studentCount,
        professorCount: area.professorCount
      })),
      criticalStudents: linkedStudents.filter((student) => student.status !== "bem"),
      recentAuditEntries: buildAuditEntriesFromRows(filteredAuditRows, auditUsers)
    },
    emptyState: null
  };
}

export function getCoordinatorDashboard(): CoordinatorDashboardData {
  const dashboards = students.map((student) => getStudentDashboard(student.id));
  const coordinator = coordinators[0];
  const professorDashboard = getProfessorDashboard();

  const averageFinalPercentage =
    dashboards.reduce((sum, dashboard) => sum + dashboard.finalPercentage, 0) /
    Math.max(dashboards.length, 1);

  const totalUnjustifiedAbsenceHours = absences
    .filter((absence) => !absence.justified)
    .reduce((sum, absence) => sum + absence.hours, 0);

  return {
    coordinator,
    semester: currentSemester,
    semesterStatus: "ativo",
    totalStudents: students.length,
    totalProfessors: professors.length,
    averageFinalPercentage: Math.round(averageFinalPercentage * 100) / 100,
    totalUnjustifiedAbsenceHours,
    areaGroupAverages: [],
    areaCoverage: [],
    criticalStudents: professorDashboard.linkedStudents.filter(
      (student) => student.status !== "bem"
    ),
    recentAuditEntries: auditEntries
  };
}

export function getAuditEntries() {
  return auditEntries;
}

export function getRoster() {
  return students.map((student) => {
    const dashboard = getStudentDashboard(student.id);

    return {
      id: student.id,
      enrollmentId: student.enrollmentId,
      name: student.name,
      registration: student.registration,
      className: currentClass.name,
      professors: dashboard.professors.map((professor) => professor.name).join(", "),
      finalPercentage: dashboard.finalPercentage,
      completionRate: dashboard.completionRate,
      missingCriteria: countMissingCriteria(
        evaluationLaunches.filter(
          (launch) => launch.enrollmentId === student.enrollmentId
        )
      )
    };
  });
}





