import type {
  ClinicalAttendanceEvolutionStatus,
  ClinicalAttendancePresenceStatus
} from "@/types/domain";

export interface ClinicalAttendanceActionFormValues {
  attendance_id?: string;
  case_id: string;
  attendance_date: string;
  schedule_id: string;
  presence_status: ClinicalAttendancePresenceStatus | "";
  administrative_note: string;
}

export interface ClinicalAttendanceActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalAttendanceActionFormValues;
  savedAttendanceId?: string;
  savedPresenceStatus?: ClinicalAttendancePresenceStatus;
  savedEvolutionStatus?: ClinicalAttendanceEvolutionStatus;
  submittedAt?: number;
}

export const initialClinicalAttendanceActionState: ClinicalAttendanceActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    case_id: "",
    attendance_date: "",
    schedule_id: "",
    presence_status: "",
    administrative_note: ""
  }
};
