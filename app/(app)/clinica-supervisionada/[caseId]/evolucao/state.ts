import type { ClinicalRecordStatus } from "@/types/domain";

export interface ClinicalEvolutionFormValues {
  record_id?: string;
  case_id: string;
  session_date: string;
  progress_and_conduct: string;
  observations: string;
  intent: "rascunho" | "enviado" | "";
}

export interface ClinicalEvolutionActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalEvolutionFormValues;
  savedRecordId?: string;
  savedStatus?: ClinicalRecordStatus;
  submittedAt?: number;
}

export interface ClinicalEvolutionReviewFormValues {
  record_id: string;
  case_id: string;
  status: ClinicalRecordStatus | "";
  supervisor_feedback: string;
}

export interface ClinicalEvolutionReviewActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalEvolutionReviewFormValues;
  submittedAt?: number;
}

export const initialClinicalEvolutionActionState: ClinicalEvolutionActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    case_id: "",
    session_date: "",
    progress_and_conduct: "",
    observations: "",
    intent: ""
  }
};

export const initialClinicalEvolutionReviewActionState: ClinicalEvolutionReviewActionState =
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
