"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reviewClinicalEvaluationAction } from "@/app/(app)/clinica-supervisionada/[caseId]/avaliacao/actions";
import {
  initialClinicalEvaluationReviewActionState,
  type ClinicalEvaluationReviewFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/avaliacao/state";
import type { ClinicalRecordStatus } from "@/types/domain";
import { formatClinicalRecordStatus } from "@/lib/utils/format";

interface ClinicalEvaluationReviewFormProps {
  caseId: string;
  recordId: string;
  initialStatus: ClinicalRecordStatus;
  initialFeedback?: string | null;
}

function buildResolvedValues(
  caseId: string,
  recordId: string,
  initialStatus: ClinicalRecordStatus,
  initialFeedback?: string | null,
  submittedValues?: ClinicalEvaluationReviewFormValues
) {
  return {
    case_id: submittedValues?.case_id ?? caseId,
    record_id: submittedValues?.record_id ?? recordId,
    status:
      submittedValues?.status ||
      (initialStatus === "enviado" ? "" : initialStatus),
    supervisor_feedback: submittedValues?.supervisor_feedback ?? initialFeedback ?? ""
  };
}

export function ClinicalEvaluationReviewForm({
  caseId,
  recordId,
  initialStatus,
  initialFeedback
}: ClinicalEvaluationReviewFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    reviewClinicalEvaluationAction,
    initialClinicalEvaluationReviewActionState
  );
  const safeState = state ?? initialClinicalEvaluationReviewActionState;
  const resolvedValues = buildResolvedValues(
    caseId,
    recordId,
    initialStatus,
    initialFeedback,
    safeState.status === "error" ? safeState.formValues : undefined
  );
  const fieldErrors = safeState.fieldErrors ?? {};

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  return (
    <form action={formAction} className="form-stack clinical-evaluation-review-form">
      <input type="hidden" name="case_id" value={resolvedValues.case_id} />
      <input type="hidden" name="record_id" value={resolvedValues.record_id} />

      <p className="form-notice">
        Status atual: <strong>{formatClinicalRecordStatus(initialStatus)}</strong>
      </p>

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

      <div className="clinical-review-status-panel">
        <div className="clinical-review-status-panel-copy">
          <strong>Status do registro</strong>
          <p>Selecione a decisão da supervisão antes de salvar o parecer.</p>
        </div>

        <div className="form-grid clinical-evaluation-form-grid">
          <label className={fieldErrors.status ? "field field-invalid" : "field"}>
            <span>Status do registro</span>
            <select
              className={fieldErrors.status ? "input input-invalid" : "input"}
              name="status"
              defaultValue={resolvedValues.status}
            >
              <option value="" disabled>
                Selecione uma decisão
              </option>
              <option value="rascunho">Rascunho</option>
              <option value="aprovado">Aprovado</option>
              <option value="ajustes_solicitados">Ajustes solicitados</option>
            </select>
            {fieldErrors.status ? (
              <span className="field-error">{fieldErrors.status}</span>
            ) : null}
          </label>

          <label className="field">
            <span>Fluxo de supervisão</span>
            <input className="input" value="Professor supervisor" readOnly disabled />
            <span className="field-help">
              Use o parecer para orientar o aluno e registrar a decisão desta revisão.
            </span>
          </label>
        </div>
      </div>

      <label
        className={fieldErrors.supervisor_feedback ? "field field-invalid" : "field"}
      >
        <span>Parecer do supervisor</span>
        <textarea
          className={`${
            fieldErrors.supervisor_feedback ? "input input-invalid" : "input"
          } textarea`}
          name="supervisor_feedback"
          rows={6}
          defaultValue={resolvedValues.supervisor_feedback}
          placeholder="Registre orientações, aprovação ou ajustes solicitados para esta avaliação."
        />
        {fieldErrors.supervisor_feedback ? (
          <span className="field-error">{fieldErrors.supervisor_feedback}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button type="submit" className="button">
          Salvar supervisão
        </button>
      </div>
    </form>
  );
}
