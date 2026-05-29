import { formatDate } from "@/lib/utils/format";
import type { ClinicalEvolutionContent } from "@/types/domain";

interface ClinicalEvolutionContentProps {
  content: ClinicalEvolutionContent;
}

function renderValue(value: string) {
  return value.trim() ? value : "Não informado.";
}

export function ClinicalEvolutionContentCard({
  content
}: ClinicalEvolutionContentProps) {
  return (
    <div className="clinical-evaluation-content">
      <section className="clinical-evaluation-section">
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item">
            <span>Data do atendimento</span>
            <strong>{formatDate(content.sessionDate)}</strong>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Registro de Evolução e Conduta</span>
            <p>{renderValue(content.progressAndConduct)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Observações e intercorrências</span>
            <p>{renderValue(content.observations)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
