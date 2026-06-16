export interface MasterClassFormValues {
  instituicao_id: string;
  curso_id: string;
  oferta_curso_unidade_id: string;
  semestre_id: string;
  periodo_curricular: string;
  codigo: string;
  nome: string;
  area_estagio: string;
  capacidade: string;
  ativa: "true" | "false";
}

export interface MasterClassCurricularPeriodFormValues {
  turma_id: string;
  periodo_curricular: string;
}

export interface ClassManagementActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: MasterClassFormValues;
  submittedAt?: number;
}

export interface ClassManagementCurricularPeriodActionState {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: MasterClassCurricularPeriodFormValues;
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
    periodo_curricular: "",
    codigo: "",
    nome: "",
    area_estagio: "",
    capacidade: "",
    ativa: "true"
  }
};

export const initialClassManagementCurricularPeriodActionState:
  ClassManagementCurricularPeriodActionState = {
    status: "idle",
    message: "",
    fieldErrors: {},
    formValues: {
      turma_id: "",
      periodo_curricular: ""
    }
  };

export function createEmptyMasterClassFormValues(): MasterClassFormValues {
  return {
    instituicao_id: "",
    curso_id: "",
    oferta_curso_unidade_id: "",
    semestre_id: "",
    periodo_curricular: "",
    codigo: "",
    nome: "",
    area_estagio: "",
    capacidade: "",
    ativa: "true"
  };
}

export function createEmptyMasterClassCurricularPeriodFormValues(
  classId = "",
  curricularPeriod = ""
): MasterClassCurricularPeriodFormValues {
  return {
    turma_id: classId,
    periodo_curricular: curricularPeriod
  };
}
