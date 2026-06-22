"use client";

import { useActionState, useEffect } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { saveClinicalEvolutionAction } from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/actions";
import {
  initialClinicalEvolutionActionState,
  type ClinicalEvolutionFormValues
} from "@/app/(app)/clinica-supervisionada/[caseId]/evolucao/state";
import type {
  ClinicalEvolutionContent,
  ClinicalRecordStatus
} from "@/types/domain";
import { formatClinicalRecordStatus } from "@/lib/utils/format";

interface ClinicalEvolutionFormProps {
  caseId: string;
  recordId?: string;
  attendanceId?: string | null;
  initialContent: ClinicalEvolutionContent;
  currentStatus?: ClinicalRecordStatus | null;
  canEdit: boolean;
  lockSessionDate?: boolean;
  readOnlyMessage?: string | null;
}

function buildResolvedFormValues(
  caseId: string,
  initialContent: ClinicalEvolutionContent,
  recordId?: string,
  attendanceId?: string | null,
  submittedValues?: ClinicalEvolutionFormValues
) {
  return {
    record_id: submittedValues?.record_id ?? recordId ?? "",
    case_id: submittedValues?.case_id ?? caseId,
    attendance_id: submittedValues?.attendance_id ?? attendanceId ?? "",
    session_date: submittedValues?.session_date ?? initialContent.sessionDate,
    progress_and_conduct:
      submittedValues?.progress_and_conduct ?? initialContent.progressAndConduct,
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

export function ClinicalEvolutionForm({
  caseId,
  recordId,
  attendanceId,
  initialContent,
  currentStatus,
  canEdit,
  lockSessionDate = false,
  readOnlyMessage
}: ClinicalEvolutionFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    saveClinicalEvolutionAction,
    initialClinicalEvolutionActionState
  );
  const safeState = state ?? initialClinicalEvolutionActionState;
  const resolvedValues = buildResolvedFormValues(
    caseId,
    initialContent,
    recordId,
    attendanceId,
    safeState.status === "error" ? safeState.formValues : undefined
  );
  const fieldErrors = safeState.fieldErrors ?? {};
  const formRenderKey =
    safeState.status === "error" && safeState.submittedAt
      ? `clinical-evolution-error-${safeState.submittedAt}`
      : `clinical-evolution-${recordId ?? "new"}`;

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    if (safeState.savedRecordId && safeState.savedRecordId !== recordId) {
      router.replace(
        `/clinica-supervisionada/${caseId}/evolucao/${safeState.savedRecordId}` as Route
      );
      return;
    }

    router.refresh();
  }, [caseId, router, safeState.savedRecordId, safeState.status, safeState.submittedAt]);

  function getFieldClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  return (
    <form action={formAction} className="form-stack" key={formRenderKey}>
      <input type="hidden" name="case_id" value={resolvedValues.case_id} />
      {resolvedValues.attendance_id ? (
        <input type="hidden" name="attendance_id" value={resolvedValues.attendance_id} />
      ) : null}
      {resolvedValues.record_id ? (
        <input type="hidden" name="record_id" value={resolvedValues.record_id} />
      ) : null}

      {currentStatus ? (
        <p className="form-notice">
          Status atual da evolução:{" "}
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
        <div className="form-grid clinical-evaluation-form-grid">
          <label className={getFieldClassName("session_date")}>
            <span>Data do atendimento</span>
            <input
              className={getInputClassName("session_date")}
              type="date"
              name="session_date"
              defaultValue={resolvedValues.session_date}
              disabled={!canEdit || lockSessionDate}
            />
            {lockSessionDate ? (
              <input
                type="hidden"
                name="session_date"
                value={resolvedValues.session_date}
              />
            ) : null}
            {lockSessionDate ? (
              <span className="field-help">
                Esta data foi definida pelo atendimento diário marcado como paciente
                presente.
              </span>
            ) : null}
            {fieldErrors.session_date ? (
              <span className="field-error">{fieldErrors.session_date}</span>
            ) : null}
          </label>

          <label
            className={`${getFieldClassName("progress_and_conduct")} clinical-evaluation-field-wide`}
          >
            <span>Registro da Evolução e Conduta</span>
            <textarea
              className={`${getInputClassName("progress_and_conduct")} textarea`}
              name="progress_and_conduct"
              rows={10}
              defaultValue={resolvedValues.progress_and_conduct}
              disabled={!canEdit}
            />
            {fieldErrors.progress_and_conduct ? (
              <span className="field-error">{fieldErrors.progress_and_conduct}</span>
            ) : null}
          </label>

          <label
            className={`${getFieldClassName("observations")} clinical-evaluation-field-wide`}
          >
            <span>Observações/Intercorrências</span>
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
