"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitStudentDocumentAction } from "@/app/(app)/documentos/actions";
import {
  initialStudentGenericUploadState,
  initialStudentTceUploadState,
  initialStudentVaccinationUploadState
} from "@/app/(app)/documentos/state";
import { formatStageAssignmentLabel } from "@/lib/utils/format";
import type { StudentDocumentAreaOption, StudentDocumentType } from "@/types/domain";

interface StudentDocumentUploadFormProps {
  documentType: StudentDocumentType;
  requiredCourseDocumentId?: string | null;
  title: string;
  description: string;
  submitLabel: string;
  tceOptions?: StudentDocumentAreaOption[];
  disabledMessage?: string | null;
}

export function StudentDocumentUploadForm({
  documentType,
  requiredCourseDocumentId = null,
  title,
  description,
  submitLabel,
  tceOptions = [],
  disabledMessage
}: StudentDocumentUploadFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialState =
    documentType === "tce"
      ? {
          ...initialStudentTceUploadState,
          formValues: {
            ...initialStudentTceUploadState.formValues,
            required_course_document_id: requiredCourseDocumentId ?? ""
          }
        }
      : documentType === "obrigatorio_generico"
        ? {
            ...initialStudentGenericUploadState,
            formValues: {
              ...initialStudentGenericUploadState.formValues,
              required_course_document_id: requiredCourseDocumentId ?? ""
            }
          }
        : {
            ...initialStudentVaccinationUploadState,
            formValues: {
              ...initialStudentVaccinationUploadState.formValues,
              required_course_document_id: requiredCourseDocumentId ?? ""
            }
          };
  const [state, formAction] = useActionState(
    submitStudentDocumentAction,
    initialState
  );
  const safeState = state ?? initialState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const disableForm =
    Boolean(disabledMessage) ||
    (documentType === "tce" && !tceOptions.length) ||
    (documentType === "obrigatorio_generico" && !requiredCourseDocumentId);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  return (
    <form ref={formRef} action={formAction} className="form-stack student-document-upload-form">
      <input type="hidden" name="document_type" value={documentType} />
      <input
        type="hidden"
        name="required_course_document_id"
        value={requiredCourseDocumentId ?? ""}
      />

      <div className="management-block-card student-document-upload-card">
        <div className="management-block-header">
          <div>
            <h3>{title}</h3>
            <p className="field-help">{description}</p>
          </div>
        </div>

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

        {disabledMessage ? <p className="form-notice">{disabledMessage}</p> : null}

        {documentType === "tce" ? (
          <label className={fieldErrors.enrollment_id ? "field field-invalid" : "field"}>
            <span>Area operacional do TCE</span>
            <select
              name="enrollment_id"
              className={fieldErrors.enrollment_id ? "input input-invalid" : "input"}
              defaultValue={safeState.formValues.enrollment_id}
              disabled={disableForm}
            >
              <option value="">Selecione a area operacional</option>
              {tceOptions.map((option) => (
                <option key={option.enrollmentId} value={option.enrollmentId}>
                  {formatStageAssignmentLabel({
                    semesterCode: option.semesterCode,
                    areaName: option.areaName
                  })}
                </option>
              ))}
            </select>
            <span className="field-help">
              O TCE fica vinculado a area operacional escolhida neste seletor.
            </span>
            {fieldErrors.enrollment_id ? (
              <span className="field-error">{fieldErrors.enrollment_id}</span>
            ) : null}
          </label>
        ) : null}

        <label className={fieldErrors.document_file ? "field field-invalid" : "field"}>
          <span>Arquivo do documento</span>
          <input
            type="file"
            name="document_file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className={fieldErrors.document_file ? "input input-invalid" : "input"}
            disabled={disableForm}
          />
          <span className="field-help">
            Aceitamos PDF, JPG, JPEG e PNG com ate 10 MB.
          </span>
          {fieldErrors.document_file ? (
            <span className="field-error">{fieldErrors.document_file}</span>
          ) : null}
        </label>

        <div className="actions-row">
          <button type="submit" className="button" disabled={disableForm}>
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
