import type { CSSProperties } from "react";

interface ProgressBarItem {
  label: string;
  current: number;
  max: number;
}

interface ProgressBarsProps {
  items: ProgressBarItem[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function interpolate(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function buildProgressToneStyle(current: number, max: number) {
  const normalized = max > 0 ? clamp(current / max, 0, 1) : 0;
  const hue =
    normalized <= 0.7
      ? interpolate(12, 44, normalized / 0.7)
      : interpolate(44, 132, (normalized - 0.7) / 0.3);
  const roundedHue = Math.round(hue);
  const trackAlpha = normalized >= 0.7 ? 0.2 : 0.14;

  return {
    ["--bar-track-tint" as "--bar-track-tint"]: `hsla(${roundedHue} 34% 30% / ${trackAlpha})`,
    ["--bar-fill-start" as "--bar-fill-start"]: `hsl(${roundedHue} 46% 30%)`,
    ["--bar-fill-end" as "--bar-fill-end"]: `hsl(${Math.min(roundedHue + 8, 140)} 52% 40%)`
  } as CSSProperties;
}

export function ProgressBars({ items }: ProgressBarsProps) {
  return (
    <div className="bar-list">
      {items.map((item) => {
        const width = item.max > 0 ? Math.min((item.current / item.max) * 100, 100) : 0;
        const toneStyle = buildProgressToneStyle(item.current, item.max);

        return (
          <div className="bar-row" key={item.label} style={toneStyle}>
            <div className="bar-meta">
              <span>{item.label}</span>
              <strong>
                {item.current.toFixed(2).replace(".", ",")} / {item.max}
              </strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
