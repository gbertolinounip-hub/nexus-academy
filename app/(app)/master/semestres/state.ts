export interface MasterSemesterFormValues {
  instituicao_id: string;
  curso_id: string;
  oferta_curso_unidade_id: string;
  codigo: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: "planejado" | "ativo" | "encerrado";
}

export interface SemesterManagementActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: MasterSemesterFormValues;
  submittedAt?: number;
}

export const initialSemesterManagementActionState: SemesterManagementActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  formValues: {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    codigo: "",
    nome: "",
    data_inicio: "",
    data_fim: "",
    status: "planejado"
  }
};

export function createEmptyMasterSemesterFormValues(): MasterSemesterFormValues {
  return {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    codigo: "",
    nome: "",
    data_inicio: "",
    data_fim: "",
    status: "planejado"
  };
}
