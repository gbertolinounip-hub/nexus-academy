export interface AbsenceActionFormValues {
  ausencia_id?: string;
  matricula_turma_id: string;
  data_ausencia: string;
  horas: string;
  justificada: "true" | "false";
  motivo: string;
  observacoes: string;
}

export interface AbsenceActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: AbsenceActionFormValues;
  savedAbsenceId?: string;
  submittedAt?: number;
}

export const initialAbsenceActionState: AbsenceActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    matricula_turma_id: "",
    data_ausencia: "",
    horas: "",
    justificada: "false",
    motivo: "",
    observacoes: ""
  }
};
