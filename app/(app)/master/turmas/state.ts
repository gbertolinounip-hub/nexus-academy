export interface MasterClassFormValues {
  instituicao_id: string;
  curso_id: string;
  oferta_curso_unidade_id: string;
  semestre_id: string;
  codigo: string;
  nome: string;
  area_estagio: string;
  capacidade: string;
  ativa: "true" | "false";
}

export interface ClassManagementActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: MasterClassFormValues;
  submittedAt?: number;
}

export const initialClassManagementActionState: ClassManagementActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
  formValues: {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    semestre_id: "",
    codigo: "",
    nome: "",
    area_estagio: "",
    capacidade: "",
    ativa: "true"
  }
};

export function createEmptyMasterClassFormValues(): MasterClassFormValues {
  return {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    semestre_id: "",
    codigo: "",
    nome: "",
    area_estagio: "",
    capacidade: "",
    ativa: "true"
  };
}
