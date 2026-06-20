"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import {
  createTceConfiguration,
  setTceConfigurationActive,
  TceServiceError,
  updateTceConfiguration
} from "@/services/tce";
import type {
  TceConfigurationActionState,
  TceConfigurationFormValues,
  TceConfigurationToggleActionState
} from "@/app/(app)/gestao/tces/state";

const emailSchema = z.string().email();

const optionalTextSchema = (maxLength: number) =>
  z.string().trim().max(maxLength, `O campo deve ter no máximo ${maxLength} caracteres.`);

const optionalUuidSchema = (message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.union([z.string().uuid(message), z.null()])
  );

const optionalDateSchema = () =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.union([z.iso.date("Informe uma data válida."), z.null()])
  );

const optionalTimeSchema = () =>
  z
    .string()
    .trim()
    .refine((value) => !value || /^\d{2}:\d{2}$/.test(value), {
      message: "Informe um horário válido no formato HH:MM."
    });

const tceConfigurationBaseObject = z.object({
  modelo_tce_id: z.string().uuid("Selecione um modelo de TCE válido."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da configuração.")
    .max(160, "O nome da configuração deve ter no máximo 160 caracteres."),
  area_estagio_id: z.string().uuid("Selecione uma área de estágio válida."),
  semestre_id: optionalUuidSchema("Selecione um semestre válido."),
  turma_id: optionalUuidSchema("Selecione uma turma válida."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status válido."
  }),
  concedente_razao_social: optionalTextSchema(160),
  concedente_documento: optionalTextSchema(80),
  concedente_endereco: optionalTextSchema(160),
  concedente_numero: optionalTextSchema(30),
  concedente_complemento: optionalTextSchema(80),
  concedente_bairro: optionalTextSchema(120),
  concedente_municipio: optionalTextSchema(120),
  concedente_uf: z.string().trim().max(2, "A UF deve ter no máximo 2 caracteres."),
  concedente_cep: optionalTextSchema(20),
  concedente_telefone: optionalTextSchema(30),
  concedente_email: z
    .string()
    .trim()
    .max(160, "O e-mail da concedente deve ter no máximo 160 caracteres.")
    .refine((value) => !value || emailSchema.safeParse(value).success, {
      message: "Informe um e-mail válido para a concedente."
    }),
  local_estagio_nome: optionalTextSchema(160),
  local_estagio_endereco: optionalTextSchema(160),
  local_estagio_numero: optionalTextSchema(30),
  local_estagio_complemento: optionalTextSchema(80),
  local_estagio_bairro: optionalTextSchema(120),
  local_estagio_municipio: optionalTextSchema(120),
  local_estagio_uf: z
    .string()
    .trim()
    .max(2, "A UF do local deve ter no máximo 2 caracteres."),
  local_estagio_cep: optionalTextSchema(20),
  local_estagio_telefone: optionalTextSchema(30),
  local_estagio_email: z
    .string()
    .trim()
    .max(160, "O e-mail do local deve ter no máximo 160 caracteres.")
    .refine((value) => !value || emailSchema.safeParse(value).success, {
      message: "Informe um e-mail válido para o local de estágio."
    }),
  responsavel_nome: optionalTextSchema(160),
  responsavel_documento: optionalTextSchema(80),
  responsavel_conselho: optionalTextSchema(120),
  vigencia_data_inicial: optionalDateSchema(),
  vigencia_data_final: optionalDateSchema(),
  horario_segunda_inicio: optionalTimeSchema(),
  horario_segunda_fim: optionalTimeSchema(),
  horario_segunda_intervalo_inicio: optionalTimeSchema(),
  horario_segunda_intervalo_fim: optionalTimeSchema(),
  horario_terca_inicio: optionalTimeSchema(),
  horario_terca_fim: optionalTimeSchema(),
  horario_terca_intervalo_inicio: optionalTimeSchema(),
  horario_terca_intervalo_fim: optionalTimeSchema(),
  horario_quarta_inicio: optionalTimeSchema(),
  horario_quarta_fim: optionalTimeSchema(),
  horario_quarta_intervalo_inicio: optionalTimeSchema(),
  horario_quarta_intervalo_fim: optionalTimeSchema(),
  horario_quinta_inicio: optionalTimeSchema(),
  horario_quinta_fim: optionalTimeSchema(),
  horario_quinta_intervalo_inicio: optionalTimeSchema(),
  horario_quinta_intervalo_fim: optionalTimeSchema(),
  horario_sexta_inicio: optionalTimeSchema(),
  horario_sexta_fim: optionalTimeSchema(),
  horario_sexta_intervalo_inicio: optionalTimeSchema(),
  horario_sexta_intervalo_fim: optionalTimeSchema(),
  horario_sabado_inicio: optionalTimeSchema(),
  horario_sabado_fim: optionalTimeSchema(),
  horario_sabado_intervalo_inicio: optionalTimeSchema(),
  horario_sabado_intervalo_fim: optionalTimeSchema(),
  jornada_diaria: optionalTextSchema(80),
  jornada_semanal: optionalTextSchema(80),
  jornada_semestral: optionalTextSchema(80),
  plano_atividades: optionalTextSchema(5000),
  cidade_assinatura: optionalTextSchema(120),
  data_assinatura: optionalDateSchema()
});

function applyTceConfigurationRefinements<TSchema extends z.ZodObject<z.ZodRawShape>>(
  schema: TSchema
) {
  return schema.superRefine((value, context) => {
    if (
      value.vigencia_data_inicial &&
      value.vigencia_data_final &&
      value.vigencia_data_inicial > value.vigencia_data_final
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["vigencia_data_final"],
        message: "A data final da vigência deve ser igual ou posterior à data inicial."
      });
    }
  });
}

const baseTceConfigurationSchema = applyTceConfigurationRefinements(
  tceConfigurationBaseObject
);

const createTceConfigurationSchema = applyTceConfigurationRefinements(
  tceConfigurationBaseObject.extend({
    configuration_id: z.string().trim().optional().default("")
  })
);

const updateTceConfigurationSchema = applyTceConfigurationRefinements(
  tceConfigurationBaseObject.extend({
    configuration_id: z.string().uuid("Configuração inválida.")
  })
);

const toggleTceConfigurationSchema = z.object({
  configuration_id: z.string().uuid("Configuração inválida."),
  active: z.enum(["true", "false"], {
    message: "Informe um status válido."
  })
});

function normalizeFieldErrors(fieldErrors: Record<string, string[] | undefined>) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TceConfigurationFormValues
): TceConfigurationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildSuccessState(
  message: string,
  formValues?: TceConfigurationFormValues
): TceConfigurationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    formValues,
    submittedAt: Date.now()
  };
}

function buildToggleState(
  status: "success" | "error",
  message: string
): TceConfigurationToggleActionState {
  return {
    status,
    message,
    submittedAt: Date.now()
  };
}

function extractFormValues(formData: FormData): TceConfigurationFormValues {
  const getValue = (fieldName: string) => String(formData.get(fieldName) ?? "");

  return {
    configuration_id: getValue("configuration_id"),
    modelo_tce_id: getValue("modelo_tce_id"),
    nome: getValue("nome"),
    area_estagio_id: getValue("area_estagio_id"),
    semestre_id: getValue("semestre_id"),
    turma_id: getValue("turma_id"),
    ativo: getValue("ativo") === "false" ? "false" : "true",
    concedente_razao_social: getValue("concedente_razao_social"),
    concedente_documento: getValue("concedente_documento"),
    concedente_endereco: getValue("concedente_endereco"),
    concedente_numero: getValue("concedente_numero"),
    concedente_complemento: getValue("concedente_complemento"),
    concedente_bairro: getValue("concedente_bairro"),
    concedente_municipio: getValue("concedente_municipio"),
    concedente_uf: getValue("concedente_uf"),
    concedente_cep: getValue("concedente_cep"),
    concedente_telefone: getValue("concedente_telefone"),
    concedente_email: getValue("concedente_email"),
    local_estagio_nome: getValue("local_estagio_nome"),
    local_estagio_endereco: getValue("local_estagio_endereco"),
    local_estagio_numero: getValue("local_estagio_numero"),
    local_estagio_complemento: getValue("local_estagio_complemento"),
    local_estagio_bairro: getValue("local_estagio_bairro"),
    local_estagio_municipio: getValue("local_estagio_municipio"),
    local_estagio_uf: getValue("local_estagio_uf"),
    local_estagio_cep: getValue("local_estagio_cep"),
    local_estagio_telefone: getValue("local_estagio_telefone"),
    local_estagio_email: getValue("local_estagio_email"),
    responsavel_nome: getValue("responsavel_nome"),
    responsavel_documento: getValue("responsavel_documento"),
    responsavel_conselho: getValue("responsavel_conselho"),
    vigencia_data_inicial: getValue("vigencia_data_inicial"),
    vigencia_data_final: getValue("vigencia_data_final"),
    horario_segunda_inicio: getValue("horario_segunda_inicio"),
    horario_segunda_fim: getValue("horario_segunda_fim"),
    horario_segunda_intervalo_inicio: getValue("horario_segunda_intervalo_inicio"),
    horario_segunda_intervalo_fim: getValue("horario_segunda_intervalo_fim"),
    horario_terca_inicio: getValue("horario_terca_inicio"),
    horario_terca_fim: getValue("horario_terca_fim"),
    horario_terca_intervalo_inicio: getValue("horario_terca_intervalo_inicio"),
    horario_terca_intervalo_fim: getValue("horario_terca_intervalo_fim"),
    horario_quarta_inicio: getValue("horario_quarta_inicio"),
    horario_quarta_fim: getValue("horario_quarta_fim"),
    horario_quarta_intervalo_inicio: getValue("horario_quarta_intervalo_inicio"),
    horario_quarta_intervalo_fim: getValue("horario_quarta_intervalo_fim"),
    horario_quinta_inicio: getValue("horario_quinta_inicio"),
    horario_quinta_fim: getValue("horario_quinta_fim"),
    horario_quinta_intervalo_inicio: getValue("horario_quinta_intervalo_inicio"),
    horario_quinta_intervalo_fim: getValue("horario_quinta_intervalo_fim"),
    horario_sexta_inicio: getValue("horario_sexta_inicio"),
    horario_sexta_fim: getValue("horario_sexta_fim"),
    horario_sexta_intervalo_inicio: getValue("horario_sexta_intervalo_inicio"),
    horario_sexta_intervalo_fim: getValue("horario_sexta_intervalo_fim"),
    horario_sabado_inicio: getValue("horario_sabado_inicio"),
    horario_sabado_fim: getValue("horario_sabado_fim"),
    horario_sabado_intervalo_inicio: getValue("horario_sabado_intervalo_inicio"),
    horario_sabado_intervalo_fim: getValue("horario_sabado_intervalo_fim"),
    jornada_diaria: getValue("jornada_diaria"),
    jornada_semanal: getValue("jornada_semanal"),
    jornada_semestral: getValue("jornada_semestral"),
    plano_atividades: getValue("plano_atividades"),
    cidade_assinatura: getValue("cidade_assinatura"),
    data_assinatura: getValue("data_assinatura")
  };
}

function mapParsedDataToServiceInput(
  parsedData: z.infer<typeof baseTceConfigurationSchema>
) {
  return {
    modelId: parsedData.modelo_tce_id,
    name: parsedData.nome,
    areaId: parsedData.area_estagio_id,
    semesterId: parsedData.semestre_id,
    classId: parsedData.turma_id,
    active: parsedData.ativo === "true",
    concedingPartyData: {
      corporateName: parsedData.concedente_razao_social || null,
      documentNumber: parsedData.concedente_documento || null,
      address: parsedData.concedente_endereco || null,
      addressNumber: parsedData.concedente_numero || null,
      addressComplement: parsedData.concedente_complemento || null,
      neighborhood: parsedData.concedente_bairro || null,
      city: parsedData.concedente_municipio || null,
      state: parsedData.concedente_uf || null,
      postalCode: parsedData.concedente_cep || null,
      phone: parsedData.concedente_telefone || null,
      email: parsedData.concedente_email || null,
      internshipLocation: parsedData.local_estagio_nome || null,
      internshipLocationAddress: parsedData.local_estagio_endereco || null,
      internshipLocationNumber: parsedData.local_estagio_numero || null,
      internshipLocationComplement: parsedData.local_estagio_complemento || null,
      internshipLocationNeighborhood: parsedData.local_estagio_bairro || null,
      internshipLocationCity: parsedData.local_estagio_municipio || null,
      internshipLocationState: parsedData.local_estagio_uf || null,
      internshipLocationPostalCode: parsedData.local_estagio_cep || null,
      internshipLocationPhone: parsedData.local_estagio_telefone || null,
      internshipLocationEmail: parsedData.local_estagio_email || null,
      responsibleName: parsedData.responsavel_nome || null,
      responsibleDocument: parsedData.responsavel_documento || null,
      professionalCouncil: parsedData.responsavel_conselho || null
    },
    termData: {
      startsAt: parsedData.vigencia_data_inicial,
      endsAt: parsedData.vigencia_data_final
    },
    scheduleData: {
      monday: {
        startTime: parsedData.horario_segunda_inicio || null,
        endTime: parsedData.horario_segunda_fim || null,
        breakStartTime: parsedData.horario_segunda_intervalo_inicio || null,
        breakEndTime: parsedData.horario_segunda_intervalo_fim || null
      },
      tuesday: {
        startTime: parsedData.horario_terca_inicio || null,
        endTime: parsedData.horario_terca_fim || null,
        breakStartTime: parsedData.horario_terca_intervalo_inicio || null,
        breakEndTime: parsedData.horario_terca_intervalo_fim || null
      },
      wednesday: {
        startTime: parsedData.horario_quarta_inicio || null,
        endTime: parsedData.horario_quarta_fim || null,
        breakStartTime: parsedData.horario_quarta_intervalo_inicio || null,
        breakEndTime: parsedData.horario_quarta_intervalo_fim || null
      },
      thursday: {
        startTime: parsedData.horario_quinta_inicio || null,
        endTime: parsedData.horario_quinta_fim || null,
        breakStartTime: parsedData.horario_quinta_intervalo_inicio || null,
        breakEndTime: parsedData.horario_quinta_intervalo_fim || null
      },
      friday: {
        startTime: parsedData.horario_sexta_inicio || null,
        endTime: parsedData.horario_sexta_fim || null,
        breakStartTime: parsedData.horario_sexta_intervalo_inicio || null,
        breakEndTime: parsedData.horario_sexta_intervalo_fim || null
      },
      saturday: {
        startTime: parsedData.horario_sabado_inicio || null,
        endTime: parsedData.horario_sabado_fim || null,
        breakStartTime: parsedData.horario_sabado_intervalo_inicio || null,
        breakEndTime: parsedData.horario_sabado_intervalo_fim || null
      }
    },
    dailyWorkload: parsedData.jornada_diaria || null,
    weeklyWorkload: parsedData.jornada_semanal || null,
    semesterWorkload: parsedData.jornada_semestral || null,
    activityPlan: parsedData.plano_atividades || null,
    signatureCity: parsedData.cidade_assinatura || null,
    signatureDate: parsedData.data_assinatura
  };
}

export async function createTceConfigurationAction(
  _previousState: TceConfigurationActionState,
  formData: FormData
): Promise<TceConfigurationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const formValues = extractFormValues(formData);
  const parsedData = createTceConfigurationSchema.safeParse(formValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos obrigatórios da configuração de TCE.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      formValues
    );
  }

  try {
    await createTceConfiguration(currentUser, mapParsedDataToServiceInput(parsedData.data));
    revalidatePath("/gestao/tces");

    return buildSuccessState("Configuração criada com sucesso.");
  } catch (error) {
    if (error instanceof TceServiceError) {
      return buildErrorState(error.message, error.fieldErrors, formValues);
    }

    return buildErrorState(
      "Não foi possível criar a configuração de TCE no momento.",
      {},
      formValues
    );
  }
}

export async function updateTceConfigurationAction(
  _previousState: TceConfigurationActionState,
  formData: FormData
): Promise<TceConfigurationActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const formValues = extractFormValues(formData);
  const parsedData = updateTceConfigurationSchema.safeParse(formValues);

  if (!parsedData.success) {
    return buildErrorState(
      "Revise os campos da configuração antes de salvar.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      formValues
    );
  }

  try {
    await updateTceConfiguration(
      currentUser,
      parsedData.data.configuration_id,
      mapParsedDataToServiceInput(parsedData.data)
    );
    revalidatePath("/gestao/tces");

    return buildSuccessState("Configuração atualizada.", formValues);
  } catch (error) {
    if (error instanceof TceServiceError) {
      return buildErrorState(error.message, error.fieldErrors, formValues);
    }

    return buildErrorState(
      "Não foi possível atualizar a configuração de TCE no momento.",
      {},
      formValues
    );
  }
}

export async function toggleTceConfigurationActiveAction(
  _previousState: TceConfigurationToggleActionState,
  formData: FormData
): Promise<TceConfigurationToggleActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const parsedData = toggleTceConfigurationSchema.safeParse({
    configuration_id: String(formData.get("configuration_id") ?? ""),
    active: String(formData.get("active") ?? "")
  });

  if (!parsedData.success) {
    return buildToggleState("error", "Não foi possível identificar a configuração de TCE.");
  }

  try {
    await setTceConfigurationActive(currentUser, {
      configurationId: parsedData.data.configuration_id,
      active: parsedData.data.active === "true"
    });
    revalidatePath("/gestao/tces");

    return buildToggleState(
      "success",
      parsedData.data.active === "true"
        ? "Configuração ativada com sucesso."
        : "Configuração inativada com sucesso."
    );
  } catch (error) {
    if (error instanceof TceServiceError) {
      return buildToggleState("error", error.message);
    }

    return buildToggleState(
      "error",
      "Não foi possível alterar o status da configuração de TCE."
    );
  }
}
