export interface ClinicalCaseScheduleFormValue {
  row_id: string;
  weekday: "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado";
  appointment_time: string;
}

export interface ClinicalCaseFormValues {
  case_id: string;
  patient_id: string;
  patient_identifier: string;
  patient_name: string;
  patient_birth_date: string;
  patient_cpf: string;
  patient_contact: string;
  patient_companion: string;
  enrollment_id: string;
  schedules: ClinicalCaseScheduleFormValue[];
  status: "atribuido" | "ativo" | "encerrado" | "alta";
}

export interface ClinicalCaseActionState {
  status: "idle" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ClinicalCaseFormValues;
  submittedAt: number;
}

export const initialClinicalCaseActionState: ClinicalCaseActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  submittedAt: Date.now()
};

export function createEmptyClinicalCaseSchedule(
  rowId = "clinical-schedule-initial"
): ClinicalCaseScheduleFormValue {
  return {
    row_id: rowId,
    weekday: "segunda",
    appointment_time: ""
  };
}
