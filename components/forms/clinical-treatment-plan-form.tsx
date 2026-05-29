"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { saveClinicalTreatmentPlanAction } from "@/app/(app)/clinica-supervisionada/[caseId]/plano-tratamento/actions";
import {
  initialClinicalTreatmentPlanActionState,
  type ClinicalTreatmentPlanFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/plano-tratamento/state";
import type {
  ClinicalRecordStatus,
  ClinicalTreatmentPlanContent
} from "@/types/domain";
import { formatClinicalRecordStatus } from "@/lib/utils/format";

interface ClinicalTreatmentPlanFormProps {
  caseId: string;
  recordId?: string;
  initialContent: ClinicalTreatmentPlanContent;
  currentStatus?: ClinicalRecordStatus | null;
  canEdit: boolean;
  readOnlyMessage?: string | null;
}

function buildResolvedFormValues(
  caseId: string,
  initialContent: ClinicalTreatmentPlanContent,
  recordId?: string,
  submittedValues?: ClinicalTreatmentPlanFormValues
) {
  return {
    record_id: submittedValues?.record_id ?? recordId ?? "",
    case_id: submittedValues?.case_id ?? caseId,
    plan_date: submittedValues?.plan_date ?? initialContent.planDate,
    objectives: submittedValues?.objectives ?? initialContent.objectives,
    conducts: submittedValues?.conducts ?? initialContent.conducts,
    observations: submittedValues?.observations ?? initialContent.observations
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

export function ClinicalTreatmentPlanForm({
  caseId,
  recordId,
  initialContent,
  currentStatus,
  canEdit,
  readOnlyMessage
}: ClinicalTreatmentPlanFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    saveClinicalTreatmentPlanAction,
    initialClinicalTreatmentPlanActionState
  );
  const safeState = state ?? initialClinicalTreatmentPlanActionState;
  const resolvedValues = buildResolvedFormValues(
    caseId,
    initialContent,
    recordId,
    safeState.status === "error" ? safeState.formValues : undefined
  );
  const fieldErrors = safeState.fieldErrors ?? {};
  const formRenderKey =
    safeState.status === "error" && safeState.submittedAt
      ? `clinical-treatment-plan-error-${safeState.submittedAt}`
      : `clinical-treatment-plan-${recordId ?? "new"}`;

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
          Status atual do plano:{" "}
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

      <section className="clinical-evaluation-form-section">
        <h3>Plano de Tratamento</h3>
        <p className="section-copy">
          Apresente seus objetivos e as condutas para cada objetivo.
        </p>

        <div className="form-grid clinical-evaluation-form-grid">
          <label className={getFieldClassName("plan_date")}>
            <span>Data do plano</span>
            <input
              className={getInputClassName("plan_date")}
              type="date"
              name="plan_date"
              defaultValue={resolvedValues.plan_date}
              disabled={!canEdit}
            />
            {fieldErrors.plan_date ? (
              <span className="field-error">{fieldErrors.plan_date}</span>
            ) : null}
          </label>

          <label
            className={`${getFieldClassName("objectives")} clinical-evaluation-field-wide`}
          >
            <span>Objetivos</span>
            <textarea
              className={`${getInputClassName("objectives")} textarea`}
              name="objectives"
              rows={6}
              defaultValue={resolvedValues.objectives}
              disabled={!canEdit}
            />
            {fieldErrors.objectives ? (
              <span className="field-error">{fieldErrors.objectives}</span>
            ) : null}
          </label>

          <label
            className={`${getFieldClassName("conducts")} clinical-evaluation-field-wide`}
          >
            <span>Condutas</span>
            <textarea
              className={`${getInputClassName("conducts")} textarea`}
              name="conducts"
              rows={6}
              defaultValue={resolvedValues.conducts}
              disabled={!canEdit}
            />
            {fieldErrors.conducts ? (
              <span className="field-error">{fieldErrors.conducts}</span>
            ) : null}
          </label>

          <label
            className={`${getFieldClassName("observations")} clinical-evaluation-field-wide`}
          >
            <span>Observações</span>
            <textarea
              className={`${getInputClassName("observations")} textarea`}
              name="observations"
              rows={5}
              defaultValue={resolvedValues.observations}
              disabled={!canEdit}
            />
            {fieldErrors.observations ? (
              <span className="field-error">{fieldErrors.observations}</span>
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
