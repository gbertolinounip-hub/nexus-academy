import type { ClinicalRecordStatus } from "@/types/domain";

export interface ClinicalTreatmentPlanFormValues {
  record_id?: string;
  case_id: string;
  plan_date: string;
  objectives: string;
  conducts: string;
  observations: string;
  intent: "rascunho" | "enviado" | "";
}

export interface ClinicalTreatmentPlanActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalTreatmentPlanFormValues;
  savedRecordId?: string;
  savedStatus?: ClinicalRecordStatus;
  submittedAt?: number;
}

export interface ClinicalTreatmentPlanReviewFormValues {
  record_id: string;
  case_id: string;
  status: ClinicalRecordStatus | "";
  supervisor_feedback: string;
}

export interface ClinicalTreatmentPlanReviewActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalTreatmentPlanReviewFormValues;
  submittedAt?: number;
}

export const initialClinicalTreatmentPlanActionState: ClinicalTreatmentPlanActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    case_id: "",
    plan_date: "",
    objectives: "",
    conducts: "",
    observations: "",
    intent: ""
  }
};

export const initialClinicalTreatmentPlanReviewActionState: ClinicalTreatmentPlanReviewActionState =
  {
    status: "idle",
    message: null,
    fieldErrors: {},
    formValues: {
      record_id: "",
      case_id: "",
      status: "",
      supervisor_feedback: ""
    }
  };
