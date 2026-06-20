export interface TceConfigurationFormValues {
  configuration_id: string;
  modelo_tce_id: string;
  nome: string;
  area_estagio_id: string;
  semestre_id: string;
  turma_id: string;
  ativo: "true" | "false";
  concedente_razao_social: string;
  concedente_documento: string;
  concedente_endereco: string;
  concedente_numero: string;
  concedente_complemento: string;
  concedente_bairro: string;
  concedente_municipio: string;
  concedente_uf: string;
  concedente_cep: string;
  concedente_telefone: string;
  concedente_email: string;
  local_estagio_nome: string;
  local_estagio_endereco: string;
  local_estagio_numero: string;
  local_estagio_complemento: string;
  local_estagio_bairro: string;
  local_estagio_municipio: string;
  local_estagio_uf: string;
  local_estagio_cep: string;
  local_estagio_telefone: string;
  local_estagio_email: string;
  responsavel_nome: string;
  responsavel_documento: string;
  responsavel_conselho: string;
  vigencia_data_inicial: string;
  vigencia_data_final: string;
  horario_segunda_inicio: string;
  horario_segunda_fim: string;
  horario_segunda_intervalo_inicio: string;
  horario_segunda_intervalo_fim: string;
  horario_terca_inicio: string;
  horario_terca_fim: string;
  horario_terca_intervalo_inicio: string;
  horario_terca_intervalo_fim: string;
  horario_quarta_inicio: string;
  horario_quarta_fim: string;
  horario_quarta_intervalo_inicio: string;
  horario_quarta_intervalo_fim: string;
  horario_quinta_inicio: string;
  horario_quinta_fim: string;
  horario_quinta_intervalo_inicio: string;
  horario_quinta_intervalo_fim: string;
  horario_sexta_inicio: string;
  horario_sexta_fim: string;
  horario_sexta_intervalo_inicio: string;
  horario_sexta_intervalo_fim: string;
  horario_sabado_inicio: string;
  horario_sabado_fim: string;
  horario_sabado_intervalo_inicio: string;
  horario_sabado_intervalo_fim: string;
  jornada_diaria: string;
  jornada_semanal: string;
  jornada_semestral: string;
  plano_atividades: string;
  cidade_assinatura: string;
  data_assinatura: string;
}

export interface TceConfigurationActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: TceConfigurationFormValues;
  submittedAt?: number;
}

export interface TceConfigurationToggleActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  submittedAt?: number;
}

export function createInitialTceConfigurationFormValues(
  input?: Partial<TceConfigurationFormValues>
): TceConfigurationFormValues {
  return {
    configuration_id: input?.configuration_id ?? "",
    modelo_tce_id: input?.modelo_tce_id ?? "",
    nome: input?.nome ?? "",
    area_estagio_id: input?.area_estagio_id ?? "",
    semestre_id: input?.semestre_id ?? "",
    turma_id: input?.turma_id ?? "",
    ativo: input?.ativo ?? "true",
    concedente_razao_social: input?.concedente_razao_social ?? "",
    concedente_documento: input?.concedente_documento ?? "",
    concedente_endereco: input?.concedente_endereco ?? "",
    concedente_numero: input?.concedente_numero ?? "",
    concedente_complemento: input?.concedente_complemento ?? "",
    concedente_bairro: input?.concedente_bairro ?? "",
    concedente_municipio: input?.concedente_municipio ?? "",
    concedente_uf: input?.concedente_uf ?? "",
    concedente_cep: input?.concedente_cep ?? "",
    concedente_telefone: input?.concedente_telefone ?? "",
    concedente_email: input?.concedente_email ?? "",
    local_estagio_nome: input?.local_estagio_nome ?? "",
    local_estagio_endereco: input?.local_estagio_endereco ?? "",
    local_estagio_numero: input?.local_estagio_numero ?? "",
    local_estagio_complemento: input?.local_estagio_complemento ?? "",
    local_estagio_bairro: input?.local_estagio_bairro ?? "",
    local_estagio_municipio: input?.local_estagio_municipio ?? "",
    local_estagio_uf: input?.local_estagio_uf ?? "",
    local_estagio_cep: input?.local_estagio_cep ?? "",
    local_estagio_telefone: input?.local_estagio_telefone ?? "",
    local_estagio_email: input?.local_estagio_email ?? "",
    responsavel_nome: input?.responsavel_nome ?? "",
    responsavel_documento: input?.responsavel_documento ?? "",
    responsavel_conselho: input?.responsavel_conselho ?? "",
    vigencia_data_inicial: input?.vigencia_data_inicial ?? "",
    vigencia_data_final: input?.vigencia_data_final ?? "",
    horario_segunda_inicio: input?.horario_segunda_inicio ?? "",
    horario_segunda_fim: input?.horario_segunda_fim ?? "",
    horario_segunda_intervalo_inicio: input?.horario_segunda_intervalo_inicio ?? "",
    horario_segunda_intervalo_fim: input?.horario_segunda_intervalo_fim ?? "",
    horario_terca_inicio: input?.horario_terca_inicio ?? "",
    horario_terca_fim: input?.horario_terca_fim ?? "",
    horario_terca_intervalo_inicio: input?.horario_terca_intervalo_inicio ?? "",
    horario_terca_intervalo_fim: input?.horario_terca_intervalo_fim ?? "",
    horario_quarta_inicio: input?.horario_quarta_inicio ?? "",
    horario_quarta_fim: input?.horario_quarta_fim ?? "",
    horario_quarta_intervalo_inicio: input?.horario_quarta_intervalo_inicio ?? "",
    horario_quarta_intervalo_fim: input?.horario_quarta_intervalo_fim ?? "",
    horario_quinta_inicio: input?.horario_quinta_inicio ?? "",
    horario_quinta_fim: input?.horario_quinta_fim ?? "",
    horario_quinta_intervalo_inicio: input?.horario_quinta_intervalo_inicio ?? "",
    horario_quinta_intervalo_fim: input?.horario_quinta_intervalo_fim ?? "",
    horario_sexta_inicio: input?.horario_sexta_inicio ?? "",
    horario_sexta_fim: input?.horario_sexta_fim ?? "",
    horario_sexta_intervalo_inicio: input?.horario_sexta_intervalo_inicio ?? "",
    horario_sexta_intervalo_fim: input?.horario_sexta_intervalo_fim ?? "",
    horario_sabado_inicio: input?.horario_sabado_inicio ?? "",
    horario_sabado_fim: input?.horario_sabado_fim ?? "",
    horario_sabado_intervalo_inicio: input?.horario_sabado_intervalo_inicio ?? "",
    horario_sabado_intervalo_fim: input?.horario_sabado_intervalo_fim ?? "",
    jornada_diaria: input?.jornada_diaria ?? "",
    jornada_semanal: input?.jornada_semanal ?? "",
    jornada_semestral: input?.jornada_semestral ?? "",
    plano_atividades: input?.plano_atividades ?? "",
    cidade_assinatura: input?.cidade_assinatura ?? "",
    data_assinatura: input?.data_assinatura ?? ""
  };
}

export const initialTceConfigurationActionState: TceConfigurationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: createInitialTceConfigurationFormValues()
};

export const initialTceConfigurationToggleActionState: TceConfigurationToggleActionState = {
  status: "idle",
  message: null
};
