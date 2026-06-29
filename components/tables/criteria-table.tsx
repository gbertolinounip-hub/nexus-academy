import { Sparkline } from "@/components/charts/sparkline";
import { formatDate, formatPercentage } from "@/lib/utils/format";
import type { StudentGroupSnapshot } from "@/types/domain";

interface CriteriaTableProps {
  groups: StudentGroupSnapshot[];
  collapsibleFeedback?: boolean;
  displayMode?: "default" | "student";
}

function hasCriterionNarrative(criterion: StudentGroupSnapshot["criteria"][number]) {
  return Boolean(
    criterion.latestRubricOptionLabel ||
      criterion.latestRubricOptionDescription ||
      criterion.latestFeedback
  );
}

function renderCriterionNarrative(
  criterion: StudentGroupSnapshot["criteria"][number],
  collapsibleFeedback: boolean
) {
  const content = (
    <div className="criteria-justification-box">
      {criterion.latestRubricOptionLabel ? (
        <div className="criteria-feedback-section">
          <span className="criteria-justification-label">
            Consideracao do supervisor:
          </span>
          <span className="criteria-justification-text">
            {criterion.latestRubricOptionLabel}
          </span>
        </div>
      ) : null}

      {criterion.latestRubricOptionDescription ? (
        <div className="criteria-feedback-section">
          <span className="criteria-justification-label">Detalhamento:</span>
          <span className="criteria-justification-text">
            {criterion.latestRubricOptionDescription}
          </span>
        </div>
      ) : null}

      {criterion.latestFeedback ? (
        <div className="criteria-feedback-section">
          <span className="criteria-justification-label">
            Comentario do supervisor:
          </span>
          <span className="criteria-justification-text">
            {criterion.latestFeedback}
          </span>
        </div>
      ) : null}
    </div>
  );

  if (!collapsibleFeedback) {
    return content;
  }

  return (
    <details className="criteria-feedback-details">
      <summary className="criteria-feedback-summary">Ver devolutiva</summary>
      {content}
    </details>
  );
}

export function CriteriaTable({
  groups,
  collapsibleFeedback = false,
  displayMode = "default"
}: CriteriaTableProps) {
  const isStudentMode = displayMode === "student";
  const hideRawScore = isStudentMode;
  const columnCount = 5;

  return (
    <div className="table-wrap">
      <table
        className={`table criteria-table${isStudentMode ? " criteria-table-student" : ""}`}
      >
        <thead>
          <tr>
            <th>Critério</th>
            <th>{hideRawScore ? "% do critério" : "Peso"}</th>
            {hideRawScore ? null : <th>Nota lançada</th>}
            <th>{hideRawScore ? "% atingido" : "Pontuação"}</th>
            {isStudentMode ? <th>Evolução</th> : null}
            <th>Última atualização</th>
          </tr>
        </thead>
        {groups.map((group, groupIndex) => {
          const blockClassName =
            groupIndex % 2 === 0 ? "criteria-block-even" : "criteria-block-odd";

          return (
            <tbody key={group.groupId} className={`criteria-block ${blockClassName}`}>
              <tr className="criteria-group-heading-row">
                <th colSpan={columnCount} className="criteria-group-heading-cell">
                  <div className="criteria-group-heading-content">
                    <span className="criteria-group-heading-kicker">Bloco</span>
                    <strong className="criteria-group-heading-title">{group.name}</strong>
                  </div>
                </th>
              </tr>
              {group.criteria.flatMap((criterion, criterionIndex) => {
                const isLastCriterion = criterionIndex === group.criteria.length - 1;
                const hasNarrative = hasCriterionNarrative(criterion);
                const rows = [
                  <tr
                    key={criterion.criterionId}
                    className={`criteria-block-row criteria-main-row${
                      hasNarrative ? " criteria-main-row-with-justification" : ""
                    }${isLastCriterion && !hasNarrative ? " criteria-block-row-end" : ""}`}
                  >
                    <td>{criterion.name}</td>
                    <td>{formatPercentage(criterion.weightPercentage)}</td>
                    {hideRawScore ? null : (
                      <td>
                        {criterion.latestRawScore === null
                          ? "Pendente"
                          : criterion.latestRawScore.toFixed(1).replace(".", ",")}
                      </td>
                    )}
                    <td>{formatPercentage(criterion.earnedPercentage)}</td>
                    {isStudentMode ? (
                      <td className="criteria-evolution-cell">
                        <Sparkline
                          label={criterion.name}
                          points={criterion.evolution}
                          maxValue={criterion.weightPercentage}
                        />
                      </td>
                    ) : null}
                    <td>
                      {criterion.updatedAt
                        ? formatDate(criterion.updatedAt)
                        : "Sem lançamento"}
                    </td>
                  </tr>
                ];

                if (hasNarrative) {
                  rows.push(
                    <tr
                      key={`${criterion.criterionId}-feedback`}
                      className={`criteria-block-row criteria-justification-row${
                        isLastCriterion ? " criteria-block-row-end" : ""
                      }`}
                    >
                      <td colSpan={columnCount} className="criteria-justification-cell">
                        {renderCriterionNarrative(criterion, collapsibleFeedback)}
                      </td>
                    </tr>
                  );
                }

                return rows;
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
