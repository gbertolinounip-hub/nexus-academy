"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { saveClinicalEvaluationAction } from "@/app/(app)/clinica-supervisionada/[caseId]/avaliacao/actions";
import {
  initialClinicalEvaluationActionState,
  type ClinicalEvaluationFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/avaliacao/state";
import type { ClinicalEvaluationContent, ClinicalRecordStatus } from "@/types/domain";
import { formatClinicalRecordStatus } from "@/lib/utils/format";

interface ClinicalEvaluationFormProps {
  caseId: string;
  recordId?: string;
  initialContent: ClinicalEvaluationContent;
  currentStatus?: ClinicalRecordStatus | null;
  canEdit: boolean;
  readOnlyMessage?: string | null;
}

function buildResolvedFormValues(
  caseId: string,
  initialContent: ClinicalEvaluationContent,
  recordId?: string,
  submittedValues?: ClinicalEvaluationFormValues
) {
  return {
    record_id: submittedValues?.record_id ?? recordId ?? "",
    case_id: submittedValues?.case_id ?? caseId,
    evaluation_date: submittedValues?.evaluation_date ?? initialContent.evaluationDate,
    chief_complaint: submittedValues?.chief_complaint ?? initialContent.chiefComplaint,
    current_illness_history:
      submittedValues?.current_illness_history ?? initialContent.currentIllnessHistory,
    relevant_history: submittedValues?.relevant_history ?? initialContent.relevantHistory,
    medications_and_notes:
      submittedValues?.medications_and_notes ?? initialContent.medicationsAndNotes,
    inspection_notes: submittedValues?.inspection_notes ?? initialContent.inspectionNotes,
    pain_notes: submittedValues?.pain_notes ?? initialContent.painNotes,
    range_of_motion: submittedValues?.range_of_motion ?? initialContent.rangeOfMotion,
    muscle_strength: submittedValues?.muscle_strength ?? initialContent.muscleStrength,
    functionality_limitations:
      submittedValues?.functionality_limitations ??
      initialContent.functionalityLimitations,
    other_findings: submittedValues?.other_findings ?? initialContent.otherFindings,
    clinical_diagnosis:
      submittedValues?.clinical_diagnosis ?? initialContent.clinicalDiagnosis,
    initial_objectives:
      submittedValues?.initial_objectives ?? initialContent.initialObjectives,
    final_observations:
      submittedValues?.final_observations ?? initialContent.finalObservations
  };
}

function SubmitButton({
  intent,
  children,
  secondary = false
}: {
  intent: "rascunho" | "enviado";
  children: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      className={secondary ? "button button-secondary" : "button"}
      disabled={pending}
    >
      {pending ? "Salvando..." : children}
    </button>
  );
}

export function ClinicalEvaluationForm({
  caseId,
  recordId,
  initialContent,
  currentStatus,
  canEdit,
  readOnlyMessage
}: ClinicalEvaluationFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveClinicalEvaluationAction,
    initialClinicalEvaluationActionState
  );
  const safeState = state ?? initialClinicalEvaluationActionState;
  const resolvedValues = buildResolvedFormValues(
    caseId,
    initialContent,
    recordId,
    safeState.status === "error" ? safeState.formValues : undefined
  );
  const fieldErrors = safeState.fieldErrors ?? {};
  const formRenderKey =
    safeState.status === "error" && safeState.submittedAt
      ? `clinical-evaluation-error-${safeState.submittedAt}`
      : `clinical-evaluation-${recordId ?? "new"}`;

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  function getFieldClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  return (
    <form ref={formRef} action={formAction} className="form-stack" key={formRenderKey}>
      <input type="hidden" name="case_id" value={resolvedValues.case_id} />
      {resolvedValues.record_id ? (
        <input type="hidden" name="record_id" value={resolvedValues.record_id} />
      ) : null}

      {currentStatus ? (
        <p className="form-notice">
          Status atual da avaliação:{" "}
          <strong>{formatClinicalRecordStatus(currentStatus)}</strong>
        </p>
      ) : null}

      {readOnlyMessage ? <p className="form-notice">{readOnlyMessage}</p> : null}

      {safeState.message ? (
        <p
          className={
            safeState.status === "success"
              ? "form-notice form-notice-success"
              : "form-notice form-notice-error"
          }
        >
          {safeState.message}
        </p>
      ) : null}

      <div className="form-grid clinical-evaluation-form-grid">
        <label className={getFieldClassName("evaluation_date")}>
          <span>Data da avaliação</span>
          <input
            className={getInputClassName("evaluation_date")}
            type="date"
            name="evaluation_date"
            defaultValue={resolvedValues.evaluation_date}
            disabled={!canEdit}
          />
          {fieldErrors.evaluation_date ? (
            <span className="field-error">{fieldErrors.evaluation_date}</span>
          ) : null}
        </label>

        <label className={`${getFieldClassName("chief_complaint")} clinical-evaluation-field-wide`}>
          <span>Queixa principal</span>
          <textarea
            className={`${getInputClassName("chief_complaint")} textarea`}
            name="chief_complaint"
            rows={3}
            defaultValue={resolvedValues.chief_complaint}
            disabled={!canEdit}
          />
          {fieldErrors.chief_complaint ? (
            <span className="field-error">{fieldErrors.chief_complaint}</span>
          ) : null}
        </label>
      </div>

      <section className="clinical-evaluation-form-section">
        <h3>História clínica</h3>
        <div className="form-grid clinical-evaluation-form-grid">
          <label className={`${getFieldClassName("current_illness_history")} clinical-evaluation-field-wide`}>
            <span>História da moléstia atual</span>
            <textarea
              className={`${getInputClassName("current_illness_history")} textarea`}
              name="current_illness_history"
              rows={4}
              defaultValue={resolvedValues.current_illness_history}
              disabled={!canEdit}
            />
            {fieldErrors.current_illness_history ? (
              <span className="field-error">{fieldErrors.current_illness_history}</span>
            ) : null}
          </label>

          <label className={`${getFieldClassName("relevant_history")} clinical-evaluation-field-wide`}>
            <span>Antecedentes relevantes</span>
            <textarea
              className={`${getInputClassName("relevant_history")} textarea`}
              name="relevant_history"
              rows={4}
              defaultValue={resolvedValues.relevant_history}
              disabled={!canEdit}
            />
            {fieldErrors.relevant_history ? (
              <span className="field-error">{fieldErrors.relevant_history}</span>
            ) : null}
          </label>

          <label className={`${getFieldClassName("medications_and_notes")} clinical-evaluation-field-wide`}>
            <span>Medicamentos / observações clínicas relevantes</span>
            <textarea
              className={`${getInputClassName("medications_and_notes")} textarea`}
              name="medications_and_notes"
              rows={4}
              defaultValue={resolvedValues.medications_and_notes}
              disabled={!canEdit}
            />
            {fieldErrors.medications_and_notes ? (
              <span className="field-error">{fieldErrors.medications_and_notes}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="clinical-evaluation-form-section">
        <h3>Avaliação físico-funcional</h3>
        <div className="form-grid clinical-evaluation-form-grid">
          <label className={getFieldClassName("inspection_notes")}>
            <span>Inspeção / observações gerais</span>
            <textarea
              className={`${getInputClassName("inspection_notes")} textarea`}
              name="inspection_notes"
              rows={4}
              defaultValue={resolvedValues.inspection_notes}
              disabled={!canEdit}
            />
            {fieldErrors.inspection_notes ? (
              <span className="field-error">{fieldErrors.inspection_notes}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("pain_notes")}>
            <span>Dor</span>
            <textarea
              className={`${getInputClassName("pain_notes")} textarea`}
              name="pain_notes"
              rows={4}
              defaultValue={resolvedValues.pain_notes}
              disabled={!canEdit}
            />
            {fieldErrors.pain_notes ? (
              <span className="field-error">{fieldErrors.pain_notes}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("range_of_motion")}>
            <span>Amplitude de movimento</span>
            <textarea
              className={`${getInputClassName("range_of_motion")} textarea`}
              name="range_of_motion"
              rows={4}
              defaultValue={resolvedValues.range_of_motion}
              disabled={!canEdit}
            />
            {fieldErrors.range_of_motion ? (
              <span className="field-error">{fieldErrors.range_of_motion}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("muscle_strength")}>
            <span>Força muscular</span>
            <textarea
              className={`${getInputClassName("muscle_strength")} textarea`}
              name="muscle_strength"
              rows={4}
              defaultValue={resolvedValues.muscle_strength}
              disabled={!canEdit}
            />
            {fieldErrors.muscle_strength ? (
              <span className="field-error">{fieldErrors.muscle_strength}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("functionality_limitations")}>
            <span>Funcionalidade / limitações</span>
            <textarea
              className={`${getInputClassName("functionality_limitations")} textarea`}
              name="functionality_limitations"
              rows={4}
              defaultValue={resolvedValues.functionality_limitations}
              disabled={!canEdit}
            />
            {fieldErrors.functionality_limitations ? (
              <span className="field-error">{fieldErrors.functionality_limitations}</span>
            ) : null}
          </label>

          <label className={getFieldClassName("other_findings")}>
            <span>Outros achados relevantes</span>
            <textarea
              className={`${getInputClassName("other_findings")} textarea`}
              name="other_findings"
              rows={4}
              defaultValue={resolvedValues.other_findings}
              disabled={!canEdit}
            />
            {fieldErrors.other_findings ? (
              <span className="field-error">{fieldErrors.other_findings}</span>
            ) : null}
          </label>
        </div>
      </section>

      <section className="clinical-evaluation-form-section">
        <h3>Síntese clínica</h3>
        <div className="form-grid clinical-evaluation-form-grid">
          <label className={`${getFieldClassName("clinical_diagnosis")} clinical-evaluation-field-wide`}>
            <span>Diagnóstico cinético-funcional / hipótese funcional</span>
            <textarea
              className={`${getInputClassName("clinical_diagnosis")} textarea`}
              name="clinical_diagnosis"
              rows={4}
              defaultValue={resolvedValues.clinical_diagnosis}
              disabled={!canEdit}
            />
            {fieldErrors.clinical_diagnosis ? (
              <span className="field-error">{fieldErrors.clinical_diagnosis}</span>
            ) : null}
          </label>

          <label className={`${getFieldClassName("initial_objectives")} clinical-evaluation-field-wide`}>
            <span>Objetivos iniciais</span>
            <textarea
              className={`${getInputClassName("initial_objectives")} textarea`}
              name="initial_objectives"
              rows={4}
              defaultValue={resolvedValues.initial_objectives}
              disabled={!canEdit}
            />
            {fieldErrors.initial_objectives ? (
              <span className="field-error">{fieldErrors.initial_objectives}</span>
            ) : null}
          </label>

          <label className={`${getFieldClassName("final_observations")} clinical-evaluation-field-wide`}>
            <span>Observações finais</span>
            <textarea
              className={`${getInputClassName("final_observations")} textarea`}
              name="final_observations"
              rows={4}
              defaultValue={resolvedValues.final_observations}
              disabled={!canEdit}
            />
            {fieldErrors.final_observations ? (
              <span className="field-error">{fieldErrors.final_observations}</span>
            ) : null}
          </label>
        </div>
      </section>

      {canEdit ? (
        <div className="actions-row">
          <SubmitButton intent="enviado">Enviar para supervisão</SubmitButton>
          <SubmitButton intent="rascunho" secondary>
            Salvar rascunho
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}
