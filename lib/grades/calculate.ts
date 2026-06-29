import { rubricCriteria, rubricCriteriaById, rubricGroups } from "@/lib/grades/definitions";
import type {
  AbsenceRecord,
  EvaluationItemInput,
  EvaluationLaunch,
  StudentCriterionEvolutionPoint,
  ProfessorRecord,
  StudentCriterionSnapshot,
  StudentDashboardData,
  StudentGroupSnapshot,
  StudentProgressPoint,
  StudentRecord
} from "@/types/domain";

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function compareEvaluationLaunches(
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

function clampScore(value: number, maxScore = 10) {
  return Math.min(Math.max(value, 0), maxScore);
}

export function calculateWeightedPercentage(
  rawScore: number,
  weightPercentage: number,
  maxScore = 10
) {
  return round((clampScore(rawScore, maxScore) / maxScore) * weightPercentage);
}

function buildLatestCriterionMap(evaluations: EvaluationLaunch[]) {
  const latestMap = new Map<
    string,
    { item: EvaluationItemInput; publishedAt: string }
  >();

  const sortedEvaluations = [...evaluations].sort(compareEvaluationLaunches);

  for (const evaluation of sortedEvaluations) {
    for (const item of evaluation.items) {
      latestMap.set(item.criterionId, {
        item,
        publishedAt: evaluation.publishedAt
      });
    }
  }

  return latestMap;
}

function buildCriterionEvolutionMap(evaluations: EvaluationLaunch[]) {
  const evolutionMap = new Map<string, StudentCriterionEvolutionPoint[]>();
  const sortedEvaluations = [...evaluations].sort(compareEvaluationLaunches);

  for (const evaluation of sortedEvaluations) {
    for (const item of evaluation.items) {
      const criterion = rubricCriteriaById.get(item.criterionId);

      if (!criterion) {
        continue;
      }

      const currentPoints = evolutionMap.get(item.criterionId) ?? [];
      currentPoints.push({
        evaluationId: evaluation.id,
        evaluatedAt: evaluation.publishedAt,
        achievedPercentage: calculateWeightedPercentage(
          item.rawScore,
          criterion.weightPercentage,
          criterion.maxScore
        )
      });
      evolutionMap.set(item.criterionId, currentPoints);
    }
  }

  return evolutionMap;
}

function countCompletion(criteriaSnapshots: StudentCriterionSnapshot[]) {
  const completed = criteriaSnapshots.filter(
    (criterion) => criterion.latestRawScore !== null
  ).length;

  return round((completed / criteriaSnapshots.length) * 100);
}

function buildGroupSnapshots(
  evaluations: EvaluationLaunch[]
): StudentGroupSnapshot[] {
  const latestMap = buildLatestCriterionMap(evaluations);
  const evolutionMap = buildCriterionEvolutionMap(evaluations);

  return rubricGroups.map((group) => {
    const criteria = rubricCriteria
      .filter((criterion) => criterion.groupId === group.id)
      .sort((left, right) => left.order - right.order)
      .map((criterion) => {
        const latest = latestMap.get(criterion.id);
        const earnedPercentage = latest
          ? calculateWeightedPercentage(
              latest.item.rawScore,
              criterion.weightPercentage,
              criterion.maxScore
            )
          : 0;

        return {
          criterionId: criterion.id,
          groupId: criterion.groupId,
          name: criterion.name,
          weightPercentage: criterion.weightPercentage,
          latestRawScore: latest ? latest.item.rawScore : null,
          latestFeedback: latest?.item.feedback ?? null,
          latestRubricOptionLabel: latest?.item.rubricOptionLabel ?? null,
          latestRubricOptionDescription:
            latest?.item.rubricOptionDescription ?? null,
          earnedPercentage,
          evolution: evolutionMap.get(criterion.id) ?? [],
          updatedAt: latest ? latest.publishedAt : null
        };
      });

    return {
      groupId: group.id,
      name: group.name,
      weightPercentage: group.weightPercentage,
      earnedPercentage: round(
        criteria.reduce((sum, criterion) => sum + criterion.earnedPercentage, 0)
      ),
      criteria
    };
  });
}

function calculateAbsencePenalty(absences: AbsenceRecord[]) {
  return round(
    absences
      .filter((absence) => !absence.justified)
      .reduce((sum, absence) => sum + absence.hours, 0)
  );
}

function buildProgress(
  evaluations: EvaluationLaunch[],
  absences: AbsenceRecord[]
): StudentProgressPoint[] {
  const sortedEvaluations = [...evaluations].sort((left, right) =>
    compareEvaluationLaunches(left, right)
  );
  const currentMap = new Map<string, EvaluationItemInput>();

  return sortedEvaluations.map((evaluation) => {
    for (const item of evaluation.items) {
      currentMap.set(item.criterionId, item);
    }

    const subtotalPercentage = round(
      rubricCriteria.reduce((sum, criterion) => {
        const currentItem = currentMap.get(criterion.id);

        if (!currentItem) {
          return sum;
        }

        return (
          sum +
          calculateWeightedPercentage(
            currentItem.rawScore,
            criterion.weightPercentage,
            criterion.maxScore
          )
        );
      }, 0)
    );

    const publishedDate = evaluation.publishedAt.slice(0, 10);
    const currentAbsencePenalty = round(
      absences
        .filter((absence) => !absence.justified && absence.date <= publishedDate)
        .reduce((sum, absence) => sum + absence.hours, 0)
    );

    const currentSnapshots = rubricCriteria.map((criterion) => ({
      criterionId: criterion.id,
      groupId: criterion.groupId,
      name: criterion.name,
      weightPercentage: criterion.weightPercentage,
      latestRawScore: currentMap.get(criterion.id)?.rawScore ?? null,
      evolution: [],
      earnedPercentage: currentMap.has(criterion.id)
        ? calculateWeightedPercentage(
            currentMap.get(criterion.id)!.rawScore,
            criterion.weightPercentage,
            criterion.maxScore
          )
        : 0,
      updatedAt: evaluation.publishedAt
    }));

    return {
      evaluationId: evaluation.id,
      label: evaluation.reference,
      launchType: evaluation.launchType,
      publishedAt: evaluation.publishedAt,
      isLegacyRecord: evaluation.isLegacyRecord,
      subtotalPercentage,
      absencePenaltyPercentage: currentAbsencePenalty,
      finalPercentage: round(
        Math.max(subtotalPercentage - currentAbsencePenalty, 0)
      ),
      completionRate: countCompletion(currentSnapshots)
    };
  });
}

function resolveLatestFinalObservations(evaluations: EvaluationLaunch[]) {
  const latestEvaluation = [...evaluations].sort(compareEvaluationLaunches).at(-1);
  const notes = latestEvaluation?.notes?.trim();

  return notes ? notes : null;
}

export function buildStudentDashboardData(input: {
  student: StudentRecord;
  semester: StudentDashboardData["semester"];
  classGroup: StudentDashboardData["classGroup"];
  professors: ProfessorRecord[];
  evaluations: EvaluationLaunch[];
  effectiveEvaluations?: EvaluationLaunch[];
  absences: AbsenceRecord[];
}): StudentDashboardData {
  const effectiveEvaluations = input.effectiveEvaluations ?? input.evaluations;
  const groups = buildGroupSnapshots(effectiveEvaluations);
  const flatCriteria = groups.flatMap((group) => group.criteria);
  const subtotalPercentage = round(
    groups.reduce((sum, group) => sum + group.earnedPercentage, 0)
  );
  const absencePenaltyPercentage = calculateAbsencePenalty(input.absences);
  const finalPercentage = round(
    Math.max(subtotalPercentage - absencePenaltyPercentage, 0)
  );

  return {
    student: input.student,
    semester: input.semester,
    classGroup: input.classGroup,
    professors: input.professors,
    subtotalPercentage,
    absencePenaltyPercentage,
    finalPercentage,
    finalGradeOutOfTen: round(finalPercentage / 10),
    completionRate: countCompletion(flatCriteria),
    finalObservations: resolveLatestFinalObservations(effectiveEvaluations),
    groups,
    progress: buildProgress(input.evaluations, input.absences),
    absences: [...input.absences].sort((left, right) =>
      left.date.localeCompare(right.date)
    )
  };
}

export function countMissingCriteria(evaluations: EvaluationLaunch[]) {
  const latestMap = buildLatestCriterionMap(evaluations);
  return rubricCriteria.filter((criterion) => !latestMap.has(criterion.id)).length;
}

export function calculateGroupAverage(
  studentDashboards: StudentDashboardData[],
  groupId: string
) {
  const groups = studentDashboards
    .map((dashboard) => dashboard.groups.find((group) => group.groupId === groupId))
    .filter(Boolean);

  if (!groups.length) {
    return 0;
  }

  const total = groups.reduce((sum, group) => sum + group!.earnedPercentage, 0);
  return round(total / groups.length);
}

export function getCriterionWeight(criterionId: string) {
  return rubricCriteriaById.get(criterionId)?.weightPercentage ?? 0;
}

