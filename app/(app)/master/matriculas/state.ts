export interface MasterEnrollmentFormValues {
  instituicao_id: string;
  curso_id: string;
  oferta_curso_unidade_id: string;
  semestre_id: string;
  turma_id: string;
  aluno_id: string;
  status: "ativa" | "concluida" | "trancada" | "cancelada";
}

export interface EnrollmentManagementActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: MasterEnrollmentFormValues;
  submittedAt?: number;
}

export const initialEnrollmentManagementActionState: EnrollmentManagementActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  formValues: {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    semestre_id: "",
    turma_id: "",
    aluno_id: "",
    status: "ativa"
  }
};

export function createEmptyMasterEnrollmentFormValues(): MasterEnrollmentFormValues {
  return {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    semestre_id: "",
    turma_id: "",
    aluno_id: "",
    status: "ativa"
  };
}
