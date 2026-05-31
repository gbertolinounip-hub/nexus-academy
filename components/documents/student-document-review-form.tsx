"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { reviewStudentDocumentAction } from "@/app/(app)/documentos/actions";
import { initialStudentDocumentReviewActionState } from "@/app/(app)/documentos/state";
import { formatStudentDocumentStatus } from "@/lib/utils/format";
import type {
  StudentDocumentReviewerRole,
  StudentDocumentStatus
} from "@/types/domain";

interface StudentDocumentReviewFormProps {
  documentId: string;
  currentStatus: StudentDocumentStatus;
  currentReviewerRole: StudentDocumentReviewerRole | null;
  currentReason?: string | null;
  reviewerLabel: string;
  readOnly?: boolean;
}

export function StudentDocumentReviewForm({
  documentId,
  currentStatus,
  currentReviewerRole,
  currentReason,
  reviewerLabel,
  readOnly = false
}: StudentDocumentReviewFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    reviewStudentDocumentAction,
    initialStudentDocumentReviewActionState
  );
  const safeState = state ?? initialStudentDocumentReviewActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const resolvedReason =
    safeState.status === "error"
      ? safeState.formValues.rejection_reason
      : currentReason ?? "";

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  return (
    <form action={formAction} className="form-stack student-document-review-form">
      <input type="hidden" name="document_id" value={documentId} />

      <p className="form-notice">
        Status atual:{" "}
        <strong>{formatStudentDocumentStatus(currentStatus, currentReviewerRole)}</strong>
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

      <label
        className={fieldErrors.rejection_reason ? "field field-invalid" : "field"}
      >
        <span>Justificativa / observações da revisão</span>
        <textarea
          name="rejection_reason"
          rows={5}
          defaultValue={resolvedReason}
          className={fieldErrors.rejection_reason ? "input input-invalid textarea" : "input textarea"}
          placeholder={`Registre as orientações do ${reviewerLabel.toLowerCase()}. A justificativa é obrigatória na reprovação.`}
          disabled={readOnly}
        />
        <span className="field-help">
          Se o documento for reprovado, esta justificativa ficará visível para o aluno.
        </span>
        {fieldErrors.rejection_reason ? (
          <span className="field-error">{fieldErrors.rejection_reason}</span>
        ) : null}
      </label>

      {!readOnly ? (
        <div className="actions-row">
          <button type="submit" name="decision" value="aprovado" className="button">
            Aprovar
          </button>
          <button
            type="submit"
            name="decision"
            value="reprovado"
            className="button button-secondary"
          >
            Reprovar
          </button>
        </div>
      ) : null}
    </form>
  );
}
