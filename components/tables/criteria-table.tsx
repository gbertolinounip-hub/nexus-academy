import { formatDate, formatPercentage } from "@/lib/utils/format";
import type { StudentGroupSnapshot } from "@/types/domain";

interface CriteriaTableProps {
  groups: StudentGroupSnapshot[];
}

export function CriteriaTable({ groups }: CriteriaTableProps) {
  return (
    <div className="table-wrap">
      <table className="table criteria-table">
        <thead>
          <tr>
            <th>Critério</th>
            <th>Peso</th>
            <th>Nota lançada</th>
            <th>Pontuação</th>
            <th>Última atualização</th>
          </tr>
        </thead>
        {groups.map((group, groupIndex) => {
          const blockClassName =
            groupIndex % 2 === 0 ? "criteria-block-even" : "criteria-block-odd";

          return (
            <tbody key={group.groupId} className={`criteria-block ${blockClassName}`}>
              <tr className="criteria-group-heading-row">
                <th colSpan={5} className="criteria-group-heading-cell">
                  <div className="criteria-group-heading-content">
                    <span className="criteria-group-heading-kicker">Bloco</span>
                    <strong className="criteria-group-heading-title">{group.name}</strong>
                  </div>
                </th>
              </tr>
              {group.criteria.flatMap((criterion, criterionIndex) => {
                const isLastCriterion = criterionIndex === group.criteria.length - 1;
                const rows = [
                  <tr
                    key={criterion.criterionId}
                    className={`criteria-block-row criteria-main-row${
                      criterion.latestFeedback ? " criteria-main-row-with-justification" : ""
                    }${isLastCriterion && !criterion.latestFeedback ? " criteria-block-row-end" : ""}`}
                  >
                    <td>{criterion.name}</td>
                    <td>{formatPercentage(criterion.weightPercentage)}</td>
                    <td>
                      {criterion.latestRawScore === null
                        ? "Pendente"
                        : criterion.latestRawScore.toFixed(1).replace(".", ",")}
                    </td>
                    <td>{formatPercentage(criterion.earnedPercentage)}</td>
                    <td>{criterion.updatedAt ? formatDate(criterion.updatedAt) : "Sem lançamento"}</td>
                  </tr>
                ];

                if (criterion.latestFeedback) {
                  rows.push(
                    <tr
                      key={`${criterion.criterionId}-feedback`}
                      className={`criteria-block-row criteria-justification-row${
                        isLastCriterion ? " criteria-block-row-end" : ""
                      }`}
                    >
                      <td colSpan={5} className="criteria-justification-cell">
                        <div className="criteria-justification-box">
                          <span className="criteria-justification-label">
                            Justificativa do supervisor:
                          </span>{" "}
                          <span className="criteria-justification-text">
                            {criterion.latestFeedback}
                          </span>
                        </div>
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


