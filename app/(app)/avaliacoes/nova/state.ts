export interface EvaluationActionFormValues {
  avaliacao_id?: string;
  avaliacao_origem_id?: string;
  matricula_turma_id: string;
  tipo_lancamento: "parcial" | "revisao" | "fechamento" | "";
  avaliado_em: string;
  observacoes: string;
  intent: "rascunho" | "publicado" | "";
  criterionScores: Record<string, string>;
  criterionFeedbacks: Record<string, string>;
  criterionOptionSelections: Record<string, string>;
}

export interface EvaluationActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: EvaluationActionFormValues;
  savedEvaluationId?: string;
  savedStatus?: "rascunho" | "publicado";
  submittedAt?: number;
}

export const initialEvaluationActionState: EvaluationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    matricula_turma_id: "",
    tipo_lancamento: "",
    avaliado_em: "",
    observacoes: "",
    intent: "",
    criterionScores: {},
    criterionFeedbacks: {},
    criterionOptionSelections: {}
  }
};
