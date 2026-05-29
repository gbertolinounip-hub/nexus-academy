import type { ClinicalRecordStatus } from "@/types/domain";

export interface ClinicalEvaluationFormValues {
  record_id?: string;
  case_id: string;
  evaluation_date: string;
  chief_complaint: string;
  current_illness_history: string;
  relevant_history: string;
  medications_and_notes: string;
  inspection_notes: string;
  pain_notes: string;
  range_of_motion: string;
  muscle_strength: string;
  functionality_limitations: string;
  other_findings: string;
  clinical_diagnosis: string;
  initial_objectives: string;
  final_observations: string;
  intent: "rascunho" | "enviado" | "";
}

export interface ClinicalEvaluationActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalEvaluationFormValues;
  savedRecordId?: string;
  savedStatus?: ClinicalRecordStatus;
  submittedAt?: number;
}

export interface ClinicalEvaluationReviewFormValues {
  record_id: string;
  case_id: string;
  status: ClinicalRecordStatus | "";
  supervisor_feedback: string;
}

export interface ClinicalEvaluationReviewActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalEvaluationReviewFormValues;
  submittedAt?: number;
}

export const initialClinicalEvaluationActionState: ClinicalEvaluationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    case_id: "",
    evaluation_date: "",
    chief_complaint: "",
    current_illness_history: "",
    relevant_history: "",
    medications_and_notes: "",
    inspection_notes: "",
    pain_notes: "",
    range_of_motion: "",
    muscle_strength: "",
    functionality_limitations: "",
    other_findings: "",
    clinical_diagnosis: "",
    initial_objectives: "",
    final_observations: "",
    intent: ""
  }
};

export const initialClinicalEvaluationReviewActionState: ClinicalEvaluationReviewActionState =
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
