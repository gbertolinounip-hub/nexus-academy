import type { StudentDocumentStatus, StudentDocumentType } from "@/types/domain";

export interface StudentDocumentUploadFormValues {
  document_type: StudentDocumentType;
  enrollment_id: string;
}

export interface StudentDocumentUploadActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues: StudentDocumentUploadFormValues;
  savedDocumentId?: string | null;
  submittedAt?: number;
}

export interface StudentDocumentReviewFormValues {
  document_id: string;
  decision: StudentDocumentStatus;
  rejection_reason: string;
}

export interface StudentDocumentReviewActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues: StudentDocumentReviewFormValues;
  submittedAt?: number;
}

export const initialStudentVaccinationUploadState: StudentDocumentUploadActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    document_type: "carteira_vacinacao",
    enrollment_id: ""
  },
  savedDocumentId: null
};

export const initialStudentTceUploadState: StudentDocumentUploadActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    document_type: "tce",
    enrollment_id: ""
  },
  savedDocumentId: null
};

export const initialStudentDocumentReviewActionState: StudentDocumentReviewActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    document_id: "",
    decision: "aprovado",
    rejection_reason: ""
  }
};
