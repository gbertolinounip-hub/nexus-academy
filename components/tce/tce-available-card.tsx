import { formatDateTime } from "@/lib/utils/format";
import type { StudentTceAvailableEntry } from "@/services/tce";

interface TceAvailableCardProps {
  entry: StudentTceAvailableEntry;
  selected: boolean;
  onSelect: (entryKey: string) => void;
}

export function TceAvailableCard({
  entry,
  selected,
  onSelect
}: TceAvailableCardProps) {
  const savedAt = entry.savedTce?.updatedAt ?? null;

  return (
    <button
      type="button"
      className={`student-tce-available-card${selected ? " student-tce-available-card-selected" : ""}`}
      onClick={() => onSelect(entry.entryKey)}
    >
      <div className="student-tce-available-card-header">
        <div>
          <strong>{entry.label}</strong>
          <p>{entry.helperText}</p>
        </div>
        <span className={entry.savedTce ? "badge" : "badge badge-muted"}>
          {entry.savedTce ? "Dados salvos" : "Disponível"}
        </span>
      </div>

      <div className="management-tag-list">
        <span className="badge badge-muted">Área: {entry.areaName}</span>
        <span className="badge badge-muted">Semestre: {entry.semesterCode}</span>
        <span className="badge badge-muted">Modelo: {entry.model.name}</span>
      </div>

      {savedAt ? (
        <p className="field-help">
          Última atualização: {formatDateTime(savedAt)}
        </p>
      ) : (
        <p className="field-help">
          Nenhum dado preenchido foi salvo ainda para este TCE.
        </p>
      )}
    </button>
  );
}
