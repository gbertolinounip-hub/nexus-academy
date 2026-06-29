import { formatDate, formatPercentage } from "@/lib/utils/format";
import type { StudentCriterionEvolutionPoint } from "@/types/domain";

interface SparklineProps {
  label: string;
  points: StudentCriterionEvolutionPoint[];
  maxValue?: number;
}

const WIDTH = 188;
const HEIGHT = 64;
const AXIS_LEFT = 18;
const AXIS_RIGHT = 10;
const AXIS_TOP = 4;
const AXIS_BOTTOM = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildChartLabel(label: string, points: StudentCriterionEvolutionPoint[]) {
  const description = points
    .map(
      (point) =>
        `${formatDate(point.evaluatedAt)}: ${formatPercentage(point.achievedPercentage)}`
    )
    .join(" | ");

  return `Evolucao do criterio ${label}. ${description}`;
}

export function Sparkline({ label, points, maxValue }: SparklineProps) {
  if (!points.length) {
    return <span className="criteria-evolution-empty">-</span>;
  }

  const scaleMax = Math.max(
    maxValue ?? 0,
    ...points.map((point) => point.achievedPercentage),
    1
  );
  const chartWidth = WIDTH - AXIS_LEFT - AXIS_RIGHT;
  const chartHeight = HEIGHT - AXIS_TOP - AXIS_BOTTOM;
  const baselineY = HEIGHT - AXIS_BOTTOM;

  const positionedPoints = points.map((point, index) => {
    const x =
      points.length === 1
        ? AXIS_LEFT + chartWidth / 2
        : AXIS_LEFT + (chartWidth / (points.length - 1)) * index;
    const ratio = clamp(point.achievedPercentage, 0, scaleMax) / scaleMax;
    const y = baselineY - ratio * chartHeight;

    return {
      ...point,
      x,
      y
    };
  });

  const linePath = positionedPoints.reduce((path, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${path}${index === 0 ? "" : " "}${command}${point.x},${point.y}`;
  }, "");
  const ariaLabel = buildChartLabel(label, positionedPoints);

  return (
    <div className="criteria-evolution-sparkline" role="img" aria-label={ariaLabel}>
      <svg
        className="criteria-evolution-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          className="criteria-evolution-axis"
          x1={AXIS_LEFT}
          y1={AXIS_TOP}
          x2={AXIS_LEFT}
          y2={baselineY}
        />
        <line
          className="criteria-evolution-baseline"
          x1={AXIS_LEFT}
          y1={baselineY}
          x2={WIDTH - AXIS_RIGHT}
          y2={baselineY}
        />

        {positionedPoints.length > 1 ? (
          <path className="criteria-evolution-line" d={linePath} />
        ) : (
          <line
            className="criteria-evolution-line"
            x1={positionedPoints[0].x - 18}
            y1={positionedPoints[0].y}
            x2={positionedPoints[0].x + 18}
            y2={positionedPoints[0].y}
          />
        )}

        {positionedPoints.map((point) => (
          <circle
            key={`${point.evaluationId}-${point.evaluatedAt}`}
            className="criteria-evolution-point"
            cx={point.x}
            cy={point.y}
            r={4.25}
          >
            <title>
              {formatDate(point.evaluatedAt)} -{" "}
              {formatPercentage(point.achievedPercentage)}
            </title>
          </circle>
        ))}
      </svg>
      {points.length === 1 ? (
        <span className="criteria-evolution-caption">1 lançamento</span>
      ) : null}
    </div>
  );
}
