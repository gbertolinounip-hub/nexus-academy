import { formatDate } from "@/lib/utils/format";
import type { ClinicalTreatmentPlanContent } from "@/types/domain";

interface ClinicalTreatmentPlanContentProps {
  content: ClinicalTreatmentPlanContent;
}

function renderValue(value: string) {
  return value.trim() ? value : "Não informado.";
}

export function ClinicalTreatmentPlanContentCard({
  content
}: ClinicalTreatmentPlanContentProps) {
  return (
    <div className="clinical-evaluation-content">
      <section className="clinical-evaluation-section">
        <h3>Plano de tratamento</h3>
        <p className="section-copy">
          Apresente seus objetivos e as condutas para cada objetivo.
        </p>
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item">
            <span>Data do plano</span>
            <strong>{formatDate(content.planDate)}</strong>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Objetivos</span>
            <p>{renderValue(content.objectives)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Condutas</span>
            <p>{renderValue(content.conducts)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Observações</span>
            <p>{renderValue(content.observations)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
