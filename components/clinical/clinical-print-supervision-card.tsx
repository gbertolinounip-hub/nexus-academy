import { formatClinicalRecordStatus } from "@/lib/utils/format";
import type { ClinicalRecordStatus } from "@/types/domain";

interface ClinicalPrintSupervisionCardProps {
  status?: ClinicalRecordStatus | null;
  feedback?: string | null;
  emptyStatusLabel?: string;
}

function resolveSupervisorMessage(
  status?: ClinicalRecordStatus | null,
  feedback?: string | null
) {
  if (feedback?.trim()) {
    return feedback;
  }

  switch (status) {
    case "aprovado":
      return "Registro aprovado sem observações adicionais do supervisor.";
    case "ajustes_solicitados":
      return "Há ajustes solicitados para este registro, sem comentário textual complementar do supervisor.";
    case "enviado":
      return "Registro enviado para supervisão e ainda sem parecer registrado.";
    case "rascunho":
      return "Registro ainda em rascunho, sem parecer do supervisor até o momento.";
    default:
      return "Ainda não há parecer do supervisor registrado.";
  }
}

export function ClinicalPrintSupervisionCard({
  status,
  feedback,
  emptyStatusLabel = "Ainda não iniciado"
}: ClinicalPrintSupervisionCardProps) {
  return (
    <div className="clinical-evaluation-feedback-card clinical-print-note-card clinical-print-supervision-card">
      <div className="clinical-evaluation-feedback-row">
        <span>Status do registro</span>
        <strong>
          {status ? formatClinicalRecordStatus(status) : emptyStatusLabel}
        </strong>
      </div>
      <div className="clinical-evaluation-feedback-block">
        <span>Parecer do supervisor</span>
        <p>{resolveSupervisorMessage(status, feedback)}</p>
      </div>
    </div>
  );
}
