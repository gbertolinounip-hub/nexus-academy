import { formatDate } from "@/lib/utils/format";
import type { ClinicalEvaluationContent } from "@/types/domain";

interface ClinicalEvaluationContentProps {
  content: ClinicalEvaluationContent;
}

function renderValue(value: string) {
  return value.trim() ? value : "Não informado.";
}

export function ClinicalEvaluationContentCard({
  content
}: ClinicalEvaluationContentProps) {
  return (
    <div className="clinical-evaluation-content">
      <section className="clinical-evaluation-section">
        <h3>Identificação</h3>
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item">
            <span>Data da avaliação</span>
            <strong>{formatDate(content.evaluationDate)}</strong>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Queixa principal</span>
            <p>{renderValue(content.chiefComplaint)}</p>
          </div>
        </div>
      </section>

      <section className="clinical-evaluation-section">
        <h3>História clínica</h3>
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>História da moléstia atual</span>
            <p>{renderValue(content.currentIllnessHistory)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Antecedentes relevantes</span>
            <p>{renderValue(content.relevantHistory)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Medicamentos e observações clínicas</span>
            <p>{renderValue(content.medicationsAndNotes)}</p>
          </div>
        </div>
      </section>

      <section className="clinical-evaluation-section">
        <h3>Avaliação físico-funcional</h3>
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item">
            <span>Inspeção e observações gerais</span>
            <p>{renderValue(content.inspectionNotes)}</p>
          </div>
          <div className="clinical-evaluation-reading-item">
            <span>Dor</span>
            <p>{renderValue(content.painNotes)}</p>
          </div>
          <div className="clinical-evaluation-reading-item">
            <span>Amplitude de movimento</span>
            <p>{renderValue(content.rangeOfMotion)}</p>
          </div>
          <div className="clinical-evaluation-reading-item">
            <span>Força muscular</span>
            <p>{renderValue(content.muscleStrength)}</p>
          </div>
          <div className="clinical-evaluation-reading-item">
            <span>Funcionalidade e limitações</span>
            <p>{renderValue(content.functionalityLimitations)}</p>
          </div>
          <div className="clinical-evaluation-reading-item">
            <span>Outros achados relevantes</span>
            <p>{renderValue(content.otherFindings)}</p>
          </div>
        </div>
      </section>

      <section className="clinical-evaluation-section">
        <h3>Síntese clínica</h3>
        <div className="clinical-evaluation-reading-grid">
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Diagnóstico cinético-funcional</span>
            <p>{renderValue(content.clinicalDiagnosis)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Objetivos iniciais</span>
            <p>{renderValue(content.initialObjectives)}</p>
          </div>
          <div className="clinical-evaluation-reading-item clinical-evaluation-reading-item-wide">
            <span>Observações finais</span>
            <p>{renderValue(content.finalObservations)}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
