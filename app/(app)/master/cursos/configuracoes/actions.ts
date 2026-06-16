"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  CourseConfigurationActionState,
  CourseConfigurationCopyFormValues,
  CourseConfigurationCreateCriterionFormValues,
  CourseConfigurationCreateCriterionOptionFormValues,
  CourseConfigurationCreateGroupFormValues,
  CourseConfigurationCreateModelFormValues,
  CourseConfigurationCreateModelApplicationRuleFormValues,
  CourseConfigurationCreateRequiredDocumentFormValues,
  CourseConfigurationDeleteCriterionFormValues,
  CourseConfigurationDeleteGroupFormValues,
  CourseConfigurationDuplicateModelFormValues,
  CourseConfigurationDeleteRequiredDocumentFormValues,
  CourseConfigurationCriterionFormValues,
  CourseConfigurationCriterionOptionFormValues,
  CourseConfigurationGroupFormValues,
  CourseConfigurationInitializeFormValues,
  CourseConfigurationModelApplicationRuleFormValues,
  CourseConfigurationModelFormValues,
  CourseConfigurationSetLaunchDefaultFormValues,
  CourseConfigurationToggleModelApplicationRuleFormValues,
  CourseConfigurationRequiredDocumentFormValues
} from "@/app/(app)/master/cursos/configuracoes/state";

type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StageAreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ModelRow = Database["public"]["Tables"]["modelos_avaliacao_curso"]["Row"];
type GroupRow = Database["public"]["Tables"]["grupos_modelo_avaliacao"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_modelo_avaliacao"]["Row"];
type CriterionOptionRow =
  Database["public"]["Tables"]["opcoes_criterio_modelo_avaliacao"]["Row"];
type ModelApplicationRuleRow =
  Database["public"]["Tables"]["regras_aplicacao_modelo_avaliacao"]["Row"];
type DocumentTypeRow = Database["public"]["Tables"]["tipos_documento"]["Row"];
type RequiredDocumentRow =
  Database["public"]["Tables"]["documentos_obrigatorios_curso"]["Row"];
type ModelInsert = Database["public"]["Tables"]["modelos_avaliacao_curso"]["Insert"];
type GroupInsert = Database["public"]["Tables"]["grupos_modelo_avaliacao"]["Insert"];
type CriterionInsert = Database["public"]["Tables"]["criterios_modelo_avaliacao"]["Insert"];
type CriterionOptionInsert =
  Database["public"]["Tables"]["opcoes_criterio_modelo_avaliacao"]["Insert"];
type ModelApplicationRuleInsert =
  Database["public"]["Tables"]["regras_aplicacao_modelo_avaliacao"]["Insert"];
type RequiredDocumentInsert =
  Database["public"]["Tables"]["documentos_obrigatorios_curso"]["Insert"];
type FisioterapiaSourceScope = "same_institution" | "global_default";

const copyConfigurationSchema = z.object({
  destination_course_id: z.string().uuid("Selecione um curso valido.")
});

const initializeConfigurationSchema = z.object({
  course_id: z.string().uuid("Selecione um curso valido.")
});

const createModelConfigurationSchema = z.object({
  course_id: z.string().uuid("Curso invalido."),
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o codigo do modelo.")
    .max(120, "O codigo do modelo deve ter no maximo 120 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do modelo.")
    .max(160, "O nome do modelo deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  versao: z.coerce
    .number({ message: "Informe uma versao valida." })
    .int("A versao precisa ser um numero inteiro.")
    .gt(0, "A versao precisa ser maior que zero."),
  modalidade: z.enum(["descritiva", "rubrica"], {
    message: "Selecione uma modalidade valida."
  }),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const duplicateModelConfigurationSchema = z.object({
  model_id: z.string().uuid("Modelo invalido.")
});

const createGroupConfigurationSchema = z.object({
  course_id: z.string().uuid("Curso invalido."),
  model_id: z.string().uuid("Modelo invalido."),
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o codigo do grupo.")
    .max(120, "O codigo do grupo deve ter no maximo 120 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do grupo.")
    .max(160, "O nome do grupo deve ter no maximo 160 caracteres."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  peso_percentual: z.coerce
    .number({ message: "Informe um peso percentual valido." })
    .gt(0, "O peso precisa ser maior que zero.")
    .lte(100, "O peso precisa ser menor ou igual a 100."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const createCriterionConfigurationSchema = z.object({
  course_id: z.string().uuid("Curso invalido."),
  group_id: z.string().uuid("Grupo invalido."),
  codigo: z
    .string()
    .trim()
    .min(1, "Informe o codigo do criterio.")
    .max(120, "O codigo do criterio deve ter no maximo 120 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do criterio.")
    .max(160, "O nome do criterio deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  peso_percentual: z.coerce
    .number({ message: "Informe um peso percentual valido." })
    .gt(0, "O peso precisa ser maior que zero.")
    .lte(100, "O peso precisa ser menor ou igual a 100."),
  escala_maxima: z.coerce
    .number({ message: "Informe uma escala maxima valida." })
    .gt(0, "A escala maxima precisa ser maior que zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const createCriterionOptionConfigurationSchema = z.object({
  criterion_id: z.string().uuid("Criterio invalido."),
  rotulo: z
    .string()
    .trim()
    .min(1, "Informe o rotulo da opcao.")
    .max(160, "O rotulo da opcao deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  valor_nota: z.coerce
    .number({ message: "Informe uma nota valida." })
    .min(0, "A nota da rubrica precisa ser maior ou igual a zero.")
    .max(10, "A nota da rubrica precisa ser menor ou igual a 10."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const createRequiredDocumentConfigurationSchema = z.object({
  course_id: z.string().uuid("Curso invalido."),
  tipo_documento_id: z.string().uuid("Tipo documental invalido."),
  nome_exibicao: z
    .string()
    .trim()
    .min(3, "Informe o nome de exibicao.")
    .max(160, "O nome de exibicao deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  obrigatorio: z.enum(["true", "false"], {
    message: "Selecione se o documento e obrigatorio."
  }),
  ordem: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z
      .union([
        z.coerce
          .number({ message: "Informe uma ordem valida." })
          .int("A ordem precisa ser um numero inteiro.")
          .gt(0, "A ordem precisa ser maior que zero."),
        z.null()
      ])
      .nullable()
  ),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const deleteGroupConfigurationSchema = z.object({
  group_id: z.string().uuid("Grupo invalido.")
});

const deleteCriterionConfigurationSchema = z.object({
  criterion_id: z.string().uuid("Criterio invalido.")
});

const deleteRequiredDocumentConfigurationSchema = z.object({
  required_document_id: z.string().uuid("Documento obrigatorio invalido.")
});

const modelConfigurationSchema = z.object({
  model_id: z.string().uuid("Modelo invalido."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do modelo.")
    .max(160, "O nome do modelo deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  modalidade: z.enum(["descritiva", "rubrica"], {
    message: "Selecione uma modalidade valida."
  }),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const setLaunchDefaultConfigurationSchema = z.object({
  model_id: z.string().uuid("Modelo invalido.")
});

const optionalUuidSelectionSchema = (message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.union([z.string().uuid(message), z.null()])
  );

const optionalPositiveIntegerSelectionSchema = (
  invalidMessage: string,
  positiveMessage: string
) =>
  z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z.union([
      z.coerce
        .number({ message: invalidMessage })
        .int("Informe um numero inteiro valido.")
        .gt(0, positiveMessage),
      z.null()
    ])
  );

const createModelApplicationRuleConfigurationSchema = z.object({
  model_id: z.string().uuid("Modelo invalido."),
  oferta_curso_unidade_id: optionalUuidSelectionSchema("Selecione uma oferta valida."),
  periodo_curricular: optionalPositiveIntegerSelectionSchema(
    "Informe um periodo curricular valido.",
    "O periodo curricular deve ser maior que zero."
  ),
  semestre_id: optionalUuidSelectionSchema("Selecione um semestre academico valido."),
  turma_id: optionalUuidSelectionSchema("Selecione uma turma valida."),
  area_estagio_id: optionalUuidSelectionSchema("Selecione uma area de estagio valida."),
  prioridade: z.coerce
    .number({ message: "Informe uma prioridade valida." })
    .int("A prioridade precisa ser um numero inteiro.")
    .min(0, "A prioridade precisa ser maior ou igual a zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const modelApplicationRuleConfigurationSchema = z.object({
  rule_id: z.string().uuid("Regra invalida."),
  oferta_curso_unidade_id: optionalUuidSelectionSchema("Selecione uma oferta valida."),
  periodo_curricular: optionalPositiveIntegerSelectionSchema(
    "Informe um periodo curricular valido.",
    "O periodo curricular deve ser maior que zero."
  ),
  semestre_id: optionalUuidSelectionSchema("Selecione um semestre academico valido."),
  turma_id: optionalUuidSelectionSchema("Selecione uma turma valida."),
  area_estagio_id: optionalUuidSelectionSchema("Selecione uma area de estagio valida."),
  prioridade: z.coerce
    .number({ message: "Informe uma prioridade valida." })
    .int("A prioridade precisa ser um numero inteiro.")
    .min(0, "A prioridade precisa ser maior ou igual a zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const toggleModelApplicationRuleConfigurationSchema = z.object({
  rule_id: z.string().uuid("Regra invalida."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const groupConfigurationSchema = z.object({
  group_id: z.string().uuid("Grupo invalido."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do grupo.")
    .max(160, "O nome do grupo deve ter no maximo 160 caracteres."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  peso_percentual: z.coerce
    .number({ message: "Informe um peso percentual valido." })
    .gt(0, "O peso precisa ser maior que zero.")
    .lte(100, "O peso precisa ser menor ou igual a 100."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const criterionConfigurationSchema = z.object({
  criterion_id: z.string().uuid("Criterio invalido."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do criterio.")
    .max(160, "O nome do criterio deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  peso_percentual: z.coerce
    .number({ message: "Informe um peso percentual valido." })
    .gt(0, "O peso precisa ser maior que zero.")
    .lte(100, "O peso precisa ser menor ou igual a 100."),
  escala_maxima: z.coerce
    .number({ message: "Informe uma escala maxima valida." })
    .gt(0, "A escala maxima precisa ser maior que zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const criterionOptionConfigurationSchema = z.object({
  criterion_option_id: z.string().uuid("Opcao de rubrica invalida."),
  rotulo: z
    .string()
    .trim()
    .min(1, "Informe o rotulo da opcao.")
    .max(160, "O rotulo da opcao deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  valor_nota: z.coerce
    .number({ message: "Informe uma nota valida." })
    .min(0, "A nota da rubrica precisa ser maior ou igual a zero.")
    .max(10, "A nota da rubrica precisa ser menor ou igual a 10."),
  ordem: z.coerce
    .number({ message: "Informe uma ordem valida." })
    .int("A ordem precisa ser um numero inteiro.")
    .gt(0, "A ordem precisa ser maior que zero."),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

const requiredDocumentConfigurationSchema = z.object({
  required_document_id: z.string().uuid("Documento obrigatorio invalido."),
  nome_exibicao: z
    .string()
    .trim()
    .min(3, "Informe o nome de exibicao.")
    .max(160, "O nome de exibicao deve ter no maximo 160 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(2000, "A descricao deve ter no maximo 2000 caracteres."),
  obrigatorio: z.enum(["true", "false"], {
    message: "Selecione se o documento e obrigatorio."
  }),
  ordem: z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return null;
      }

      return value;
    },
    z
      .union([
        z.coerce
          .number({ message: "Informe uma ordem valida." })
          .int("A ordem precisa ser um numero inteiro.")
          .gt(0, "A ordem precisa ser maior que zero."),
        z.null()
      ])
      .nullable()
  ),
  ativo: z.enum(["true", "false"], {
    message: "Selecione um status valido."
  })
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildCopyFormValues(formData: FormData): CourseConfigurationCopyFormValues {
  return {
    destination_course_id: readStringField(formData, "destination_course_id")
  };
}

function buildInitializeFormValues(formData: FormData): CourseConfigurationInitializeFormValues {
  return {
    course_id: readStringField(formData, "course_id")
  };
}

function buildCreateModelFormValues(formData: FormData): CourseConfigurationCreateModelFormValues {
  return {
    course_id: readStringField(formData, "course_id"),
    codigo: readStringField(formData, "codigo"),
    nome: readStringField(formData, "nome"),
    descricao: readStringField(formData, "descricao"),
    versao: readStringField(formData, "versao"),
    modalidade: readStringField(formData, "modalidade") as
      | "descritiva"
      | "rubrica"
      | "",
    ativo: readStringField(formData, "ativo")
  };
}

function buildDuplicateModelFormValues(
  formData: FormData
): CourseConfigurationDuplicateModelFormValues {
  return {
    model_id: readStringField(formData, "model_id")
  };
}

function buildCreateGroupFormValues(formData: FormData): CourseConfigurationCreateGroupFormValues {
  return {
    course_id: readStringField(formData, "course_id"),
    model_id: readStringField(formData, "model_id"),
    codigo: readStringField(formData, "codigo"),
    nome: readStringField(formData, "nome"),
    ordem: readStringField(formData, "ordem"),
    peso_percentual: readStringField(formData, "peso_percentual"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildCreateCriterionFormValues(
  formData: FormData
): CourseConfigurationCreateCriterionFormValues {
  return {
    course_id: readStringField(formData, "course_id"),
    group_id: readStringField(formData, "group_id"),
    codigo: readStringField(formData, "codigo"),
    nome: readStringField(formData, "nome"),
    descricao: readStringField(formData, "descricao"),
    ordem: readStringField(formData, "ordem"),
    peso_percentual: readStringField(formData, "peso_percentual"),
    escala_maxima: readStringField(formData, "escala_maxima"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildCreateCriterionOptionFormValues(
  formData: FormData
): CourseConfigurationCreateCriterionOptionFormValues {
  return {
    criterion_id: readStringField(formData, "criterion_id"),
    rotulo: readStringField(formData, "rotulo"),
    descricao: readStringField(formData, "descricao"),
    valor_nota: readStringField(formData, "valor_nota"),
    ordem: readStringField(formData, "ordem"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildCreateRequiredDocumentFormValues(
  formData: FormData
): CourseConfigurationCreateRequiredDocumentFormValues {
  return {
    course_id: readStringField(formData, "course_id"),
    tipo_documento_id: readStringField(formData, "tipo_documento_id"),
    nome_exibicao: readStringField(formData, "nome_exibicao"),
    descricao: readStringField(formData, "descricao"),
    obrigatorio: readStringField(formData, "obrigatorio"),
    ordem: readStringField(formData, "ordem"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildDeleteGroupFormValues(formData: FormData): CourseConfigurationDeleteGroupFormValues {
  return {
    group_id: readStringField(formData, "group_id")
  };
}

function buildDeleteCriterionFormValues(
  formData: FormData
): CourseConfigurationDeleteCriterionFormValues {
  return {
    criterion_id: readStringField(formData, "criterion_id")
  };
}

function buildDeleteRequiredDocumentFormValues(
  formData: FormData
): CourseConfigurationDeleteRequiredDocumentFormValues {
  return {
    required_document_id: readStringField(formData, "required_document_id")
  };
}

function buildModelFormValues(formData: FormData): CourseConfigurationModelFormValues {
  return {
    model_id: readStringField(formData, "model_id"),
    nome: readStringField(formData, "nome"),
    descricao: readStringField(formData, "descricao"),
    modalidade: readStringField(formData, "modalidade") as
      | "descritiva"
      | "rubrica"
      | "",
    ativo: readStringField(formData, "ativo")
  };
}

function buildSetLaunchDefaultFormValues(
  formData: FormData
): CourseConfigurationSetLaunchDefaultFormValues {
  return {
    model_id: readStringField(formData, "model_id")
  };
}

function buildCreateModelApplicationRuleFormValues(
  formData: FormData
): CourseConfigurationCreateModelApplicationRuleFormValues {
  return {
    model_id: readStringField(formData, "model_id"),
    oferta_curso_unidade_id: readStringField(formData, "oferta_curso_unidade_id"),
    periodo_curricular: readStringField(formData, "periodo_curricular"),
    semestre_id: readStringField(formData, "semestre_id"),
    turma_id: readStringField(formData, "turma_id"),
    area_estagio_id: readStringField(formData, "area_estagio_id"),
    prioridade: readStringField(formData, "prioridade"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildModelApplicationRuleFormValues(
  formData: FormData
): CourseConfigurationModelApplicationRuleFormValues {
  return {
    rule_id: readStringField(formData, "rule_id"),
    oferta_curso_unidade_id: readStringField(formData, "oferta_curso_unidade_id"),
    periodo_curricular: readStringField(formData, "periodo_curricular"),
    semestre_id: readStringField(formData, "semestre_id"),
    turma_id: readStringField(formData, "turma_id"),
    area_estagio_id: readStringField(formData, "area_estagio_id"),
    prioridade: readStringField(formData, "prioridade"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildToggleModelApplicationRuleFormValues(
  formData: FormData
): CourseConfigurationToggleModelApplicationRuleFormValues {
  return {
    rule_id: readStringField(formData, "rule_id"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildGroupFormValues(formData: FormData): CourseConfigurationGroupFormValues {
  return {
    group_id: readStringField(formData, "group_id"),
    nome: readStringField(formData, "nome"),
    ordem: readStringField(formData, "ordem"),
    peso_percentual: readStringField(formData, "peso_percentual"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildCriterionFormValues(formData: FormData): CourseConfigurationCriterionFormValues {
  return {
    criterion_id: readStringField(formData, "criterion_id"),
    nome: readStringField(formData, "nome"),
    descricao: readStringField(formData, "descricao"),
    ordem: readStringField(formData, "ordem"),
    peso_percentual: readStringField(formData, "peso_percentual"),
    escala_maxima: readStringField(formData, "escala_maxima"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildCriterionOptionFormValues(
  formData: FormData
): CourseConfigurationCriterionOptionFormValues {
  return {
    criterion_option_id: readStringField(formData, "criterion_option_id"),
    rotulo: readStringField(formData, "rotulo"),
    descricao: readStringField(formData, "descricao"),
    valor_nota: readStringField(formData, "valor_nota"),
    ordem: readStringField(formData, "ordem"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildRequiredDocumentFormValues(
  formData: FormData
): CourseConfigurationRequiredDocumentFormValues {
  return {
    required_document_id: readStringField(formData, "required_document_id"),
    nome_exibicao: readStringField(formData, "nome_exibicao"),
    descricao: readStringField(formData, "descricao"),
    obrigatorio: readStringField(formData, "obrigatorio"),
    ordem: readStringField(formData, "ordem"),
    ativo: readStringField(formData, "ativo")
  };
}

function buildActionState<TFormValues>(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TFormValues
): CourseConfigurationActionState<TFormValues> {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function resolveAvailableModelCode(baseCode: string, excludedModelId?: string) {
  const adminClient = createSupabaseAdminClient();
  let candidateCode = baseCode;
  let suffix = 2;

  while (suffix < 1000) {
    const { data, error } = await adminClient
      .from("modelos_avaliacao_curso")
      .select("id")
      .eq("codigo", candidateCode)
      .maybeSingle();
    const existingModel = data as { id: string } | null;

    if (error) {
      throw new Error("Nao foi possivel validar a disponibilidade do codigo do modelo inicial.");
    }

    if (!existingModel || (excludedModelId && existingModel.id === excludedModelId)) {
      return candidateCode;
    }

    candidateCode = `${baseCode}_${suffix}`;
    suffix += 1;
  }

  throw new Error("Nao foi possivel gerar um codigo unico para o modelo inicial do curso.");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceCourseNameInText(
  value: string | null,
  sourceCourseName: string,
  destinationCourseName: string
) {
  if (!value) {
    return value;
  }

  return value.replace(new RegExp(escapeRegExp(sourceCourseName), "gi"), destinationCourseName);
}

function deriveCourseScopedCode(
  sourceCode: string | null,
  sourceCourseCode: string,
  destinationCourseCode: string
) {
  if (!sourceCode) {
    return null;
  }

  const normalizedSourceCode = normalizeCode(sourceCode);
  const normalizedSourceCourseCode = normalizeCode(sourceCourseCode);
  const normalizedDestinationCourseCode = normalizeCode(destinationCourseCode);
  const segments = normalizedSourceCode.split("_").filter(Boolean);
  let replaced = false;

  const nextSegments = segments.map((segment) => {
    if (segment === normalizedSourceCourseCode) {
      replaced = true;
      return normalizedDestinationCourseCode;
    }

    return segment;
  });

  if (!replaced) {
    nextSegments.push(normalizedDestinationCourseCode);
  }

  return nextSegments.join("_");
}

function mergeCopiedMetadata(
  sourceMetadata: unknown,
  copiedFrom: Record<string, unknown>
): Record<string, unknown> {
  const baseMetadata =
    sourceMetadata && typeof sourceMetadata === "object" && !Array.isArray(sourceMetadata)
      ? { ...(sourceMetadata as Record<string, unknown>) }
      : {};

  return {
    ...baseMetadata,
    copied_from: copiedFrom
  };
}

function toNullableText(value: string) {
  return value.trim() ? value.trim() : null;
}

function toBooleanValue(value: string) {
  return value === "true";
}

function revalidateCourseConfigurationPaths() {
  revalidatePath("/master");
  revalidatePath("/master/cursos");
  revalidatePath("/master/cursos/configuracoes");
}

async function loadCourse(courseId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("cursos")
    .select("id, instituicao_id, codigo, nome, slug, ativo")
    .eq("id", courseId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<CourseRow, "id" | "instituicao_id" | "codigo" | "nome" | "slug" | "ativo">;
}

function isCompleteCourseConfiguration(summary: Awaited<ReturnType<typeof loadCourseConfigurationSummary>>) {
  return (
    summary.modelCount > 0 &&
    summary.groupCount > 0 &&
    summary.criterionCount > 0 &&
    summary.requiredDocumentCount > 0
  );
}

function compareFisioterapiaSourceCandidates(
  left: Pick<CourseRow, "codigo" | "nome" | "instituicao_id" | "ativo"> & {
    institutionName: string;
    configurationSummary: Awaited<ReturnType<typeof loadCourseConfigurationSummary>>;
  },
  right: Pick<CourseRow, "codigo" | "nome" | "instituicao_id" | "ativo"> & {
    institutionName: string;
    configurationSummary: Awaited<ReturnType<typeof loadCourseConfigurationSummary>>;
  }
) {
  const leftPriority = left.institutionName.toUpperCase().includes("UNIP") ? 0 : 1;
  const rightPriority = right.institutionName.toUpperCase().includes("UNIP") ? 0 : 1;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  if (
    left.configurationSummary.requiredDocumentCount !==
    right.configurationSummary.requiredDocumentCount
  ) {
    return (
      right.configurationSummary.requiredDocumentCount -
      left.configurationSummary.requiredDocumentCount
    );
  }

  if (left.configurationSummary.criterionCount !== right.configurationSummary.criterionCount) {
    return right.configurationSummary.criterionCount - left.configurationSummary.criterionCount;
  }

  if (left.configurationSummary.groupCount !== right.configurationSummary.groupCount) {
    return right.configurationSummary.groupCount - left.configurationSummary.groupCount;
  }

  if (left.configurationSummary.modelCount !== right.configurationSummary.modelCount) {
    return right.configurationSummary.modelCount - left.configurationSummary.modelCount;
  }

  const institutionComparison = left.institutionName.localeCompare(
    right.institutionName,
    "pt-BR"
  );

  if (institutionComparison !== 0) {
    return institutionComparison;
  }

  return left.nome.localeCompare(right.nome, "pt-BR");
}

function buildFisioterapiaSourceLabel(
  institutionName: string,
  courseName: string,
  scope: FisioterapiaSourceScope
) {
  const suffix = scope === "same_institution" ? "mesma IES" : "base padrao global";

  return `${institutionName} / ${courseName} (${suffix})`;
}

async function loadPreferredFisioterapiaSourceCourse(institutionId: string) {
  const adminClient = createSupabaseAdminClient();
  const candidatesResult = await adminClient
    .from("cursos")
    .select(
      "id, instituicao_id, codigo, nome, slug, ativo, instituicoes!inner(nome)"
    )
    .eq("ativo", true)
    .or("codigo.eq.FISIO,slug.eq.fisioterapia");

  if (candidatesResult.error) {
    throw new Error("Nao foi possivel localizar uma base configurada de Fisioterapia.");
  }

  const rawCandidates =
    (candidatesResult.data ?? []) as Array<
      Pick<CourseRow, "id" | "instituicao_id" | "codigo" | "nome" | "slug" | "ativo"> & {
        instituicoes?: { nome: string } | { nome: string }[] | null;
      }
    >;
  const configuredCandidates: Array<
    Pick<CourseRow, "id" | "instituicao_id" | "codigo" | "nome" | "slug" | "ativo"> & {
      institutionName: string;
      configurationSummary: Awaited<ReturnType<typeof loadCourseConfigurationSummary>>;
    }
  > = [];

  for (const candidate of rawCandidates) {
    const institutionName = Array.isArray(candidate.instituicoes)
      ? candidate.instituicoes[0]?.nome ?? "Instituicao nao identificada"
      : candidate.instituicoes?.nome ?? "Instituicao nao identificada";
    const configurationSummary = await loadCourseConfigurationSummary(candidate.id);

    if (isCompleteCourseConfiguration(configurationSummary)) {
      configuredCandidates.push({
        id: candidate.id,
        instituicao_id: candidate.instituicao_id,
        codigo: candidate.codigo,
        nome: candidate.nome,
        slug: candidate.slug,
        ativo: candidate.ativo,
        institutionName,
        configurationSummary
      });
    }
  }

  if (!configuredCandidates.length) {
    return null;
  }

  const sameInstitutionSource = configuredCandidates.find(
    (candidate) => candidate.instituicao_id === institutionId
  );

  if (sameInstitutionSource) {
    return {
      course: sameInstitutionSource,
      scope: "same_institution" as const,
      label: buildFisioterapiaSourceLabel(
        sameInstitutionSource.institutionName,
        sameInstitutionSource.nome,
        "same_institution"
      )
    };
  }

  const globalSource = [...configuredCandidates].sort(compareFisioterapiaSourceCandidates)[0];

  return globalSource
    ? {
        course: globalSource,
        scope: "global_default" as const,
        label: buildFisioterapiaSourceLabel(
          globalSource.institutionName,
          globalSource.nome,
          "global_default"
        )
      }
    : null;
}

async function loadCourseConfigurationSummary(courseId: string) {
  const adminClient = createSupabaseAdminClient();
  const [modelsResult, requiredDocumentsResult] = await Promise.all([
    adminClient
      .from("modelos_avaliacao_curso")
      .select("id, codigo, nome, descricao, versao, modalidade, padrao_lancamento, ativo, metadata")
      .eq("curso_id", courseId)
      .order("versao", { ascending: true }),
    adminClient
      .from("documentos_obrigatorios_curso")
      .select("id", { count: "exact", head: true })
      .eq("curso_id", courseId)
  ]);

  if (modelsResult.error || requiredDocumentsResult.error) {
    throw new Error(
      "Nao foi possivel verificar se o curso destino ja possui configuracao academica."
    );
  }

  const modelRows = (modelsResult.data ?? []) as Array<
    Pick<
      ModelRow,
      | "id"
      | "codigo"
      | "nome"
      | "descricao"
      | "versao"
      | "modalidade"
      | "padrao_lancamento"
      | "ativo"
      | "metadata"
    >
  >;
  const modelIds = modelRows.map((modelRow) => modelRow.id);
  const groupsResult = modelIds.length
    ? await adminClient
        .from("grupos_modelo_avaliacao")
        .select("id, modelo_avaliacao_curso_id")
        .in("modelo_avaliacao_curso_id", modelIds)
    : { data: [], error: null };

  if (groupsResult.error) {
    throw new Error(
      "Nao foi possivel verificar se o curso destino ja possui configuracao academica."
    );
  }

  const groupRows = (groupsResult.data ?? []) as Array<
    Pick<GroupRow, "id" | "modelo_avaliacao_curso_id">
  >;
  const groupIds = groupRows.map((groupRow) => groupRow.id);
  const criteriaResult = groupIds.length
    ? await adminClient
        .from("criterios_modelo_avaliacao")
        .select("id")
        .in("grupo_modelo_avaliacao_id", groupIds)
    : { data: [], error: null };

  if (criteriaResult.error) {
    throw new Error(
      "Nao foi possivel verificar se o curso destino ja possui configuracao academica."
    );
  }

  return {
    modelCount: modelRows.length,
    groupCount: groupRows.length,
    criterionCount: (criteriaResult.data ?? []).length,
    requiredDocumentCount: requiredDocumentsResult.count ?? 0,
    models: modelRows
  };
}

async function loadModel(modelId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("modelos_avaliacao_curso")
    .select("id, codigo, curso_id, nome, descricao, versao, modalidade, padrao_lancamento, ativo, metadata")
    .eq("id", modelId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    ModelRow,
    | "id"
    | "codigo"
    | "curso_id"
    | "nome"
    | "descricao"
    | "versao"
    | "modalidade"
    | "padrao_lancamento"
    | "ativo"
    | "metadata"
  >;
}

async function resolveNextCourseModelVersion(courseId: string) {
  const configurationSummary = await loadCourseConfigurationSummary(courseId);
  const currentMaxVersion = configurationSummary.models.reduce((highestVersion, modelRow) => {
    return modelRow.versao > highestVersion ? modelRow.versao : highestVersion;
  }, 0);

  return currentMaxVersion + 1;
}

function resolveLaunchDefaultModelId(modelRows: Pick<ModelRow, "id" | "ativo" | "padrao_lancamento">[]) {
  const explicitLaunchDefault = modelRows.find(
    (modelRow) => modelRow.ativo && modelRow.padrao_lancamento
  );

  if (explicitLaunchDefault) {
    return explicitLaunchDefault.id;
  }

  const activeModels = modelRows.filter((modelRow) => modelRow.ativo);

  if (activeModels.length === 1) {
    return activeModels[0]?.id ?? null;
  }

  return null;
}

async function loadModelApplicationRule(ruleId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("regras_aplicacao_modelo_avaliacao")
    .select("*")
    .eq("id", ruleId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ModelApplicationRuleRow;
}

async function loadOffer(offerId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("ofertas_curso_unidade")
    .select("id, curso_id, nome_exibicao")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<OfferRow, "id" | "curso_id" | "nome_exibicao">;
}

async function loadSemester(semesterId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("semestres")
    .select("id, oferta_curso_unidade_id, codigo, nome")
    .eq("id", semesterId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<SemesterRow, "id" | "oferta_curso_unidade_id" | "codigo" | "nome">;
}

async function loadClass(classId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("turmas")
    .select("id, semestre_id, oferta_curso_unidade_id, periodo_curricular, codigo, nome")
    .eq("id", classId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    ClassRow,
    "id" | "semestre_id" | "oferta_curso_unidade_id" | "periodo_curricular" | "codigo" | "nome"
  >;
}

async function loadStageArea(areaId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("areas_estagio")
    .select("id, oferta_curso_unidade_id, nome")
    .eq("id", areaId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<StageAreaRow, "id" | "oferta_curso_unidade_id" | "nome">;
}

function hasAnyModelApplicationScope(input: {
  offerId: string | null;
  curricularPeriod: number | null;
  semesterId: string | null;
  classId: string | null;
  stageAreaId: string | null;
}) {
  return Boolean(
    input.offerId ??
      input.curricularPeriod ??
      input.semesterId ??
      input.classId ??
      input.stageAreaId
  );
}

async function validateModelApplicationRuleInput(input: {
  model: Pick<ModelRow, "id" | "curso_id" | "nome">;
  offerId: string | null;
  curricularPeriod: number | null;
  semesterId: string | null;
  classId: string | null;
  stageAreaId: string | null;
}) {
  const fieldErrors: Record<string, string> = {};

  if (!hasAnyModelApplicationScope(input)) {
    fieldErrors.oferta_curso_unidade_id =
      "Preencha pelo menos um escopo de aplicacao para a regra.";

    return { fieldErrors };
  }

  const [offerRow, semesterRow, classRow, stageAreaRow] = await Promise.all([
    input.offerId ? loadOffer(input.offerId) : Promise.resolve(null),
    input.semesterId ? loadSemester(input.semesterId) : Promise.resolve(null),
    input.classId ? loadClass(input.classId) : Promise.resolve(null),
    input.stageAreaId ? loadStageArea(input.stageAreaId) : Promise.resolve(null)
  ]);
  const resolvedOffersById = new Map<string, Pick<OfferRow, "id" | "curso_id" | "nome_exibicao">>();

  if (input.offerId) {
    if (!offerRow) {
      fieldErrors.oferta_curso_unidade_id = "Selecione uma oferta valida.";
    } else if (offerRow.curso_id !== input.model.curso_id) {
      fieldErrors.oferta_curso_unidade_id =
        "A oferta precisa pertencer ao mesmo curso do modelo.";
    } else {
      resolvedOffersById.set(offerRow.id, offerRow);
    }
  }

  let semesterOfferRow: Pick<OfferRow, "id" | "curso_id" | "nome_exibicao"> | null = null;

  if (input.semesterId) {
    if (!semesterRow) {
      fieldErrors.semestre_id = "Selecione um semestre academico valido.";
    } else if (!semesterRow.oferta_curso_unidade_id) {
      fieldErrors.semestre_id = "O semestre selecionado precisa estar vinculado a uma oferta.";
    } else {
      semesterOfferRow =
        resolvedOffersById.get(semesterRow.oferta_curso_unidade_id) ??
        (await loadOffer(semesterRow.oferta_curso_unidade_id));

      if (!semesterOfferRow || semesterOfferRow.curso_id !== input.model.curso_id) {
        fieldErrors.semestre_id = "O semestre precisa pertencer ao mesmo curso do modelo.";
      } else {
        resolvedOffersById.set(semesterOfferRow.id, semesterOfferRow);

        if (input.offerId && semesterOfferRow.id !== input.offerId) {
          fieldErrors.semestre_id = "O semestre precisa pertencer a oferta selecionada.";
        }
      }
    }
  }

  let classOfferRow: Pick<OfferRow, "id" | "curso_id" | "nome_exibicao"> | null = null;

  if (input.classId) {
    if (!classRow) {
      fieldErrors.turma_id = "Selecione uma turma valida.";
    } else {
      const classSemesterRow =
        semesterRow && semesterRow.id === classRow.semestre_id
          ? semesterRow
          : await loadSemester(classRow.semestre_id);
      const resolvedClassOfferId =
        classRow.oferta_curso_unidade_id ?? classSemesterRow?.oferta_curso_unidade_id ?? null;

      if (!resolvedClassOfferId) {
        fieldErrors.turma_id = "A turma selecionada precisa estar vinculada a uma oferta.";
      } else {
        classOfferRow =
          resolvedOffersById.get(resolvedClassOfferId) ?? (await loadOffer(resolvedClassOfferId));

        if (!classOfferRow || classOfferRow.curso_id !== input.model.curso_id) {
          fieldErrors.turma_id = "A turma precisa pertencer ao mesmo curso do modelo.";
        } else {
          resolvedOffersById.set(classOfferRow.id, classOfferRow);

          if (input.offerId && classOfferRow.id !== input.offerId) {
            fieldErrors.turma_id = "A turma precisa pertencer a oferta selecionada.";
          }

          if (input.semesterId && classRow.semestre_id !== input.semesterId) {
            fieldErrors.turma_id =
              "A turma precisa pertencer ao semestre academico selecionado.";
          }

          if (
            input.curricularPeriod !== null &&
            classRow.periodo_curricular !== input.curricularPeriod
          ) {
            fieldErrors.turma_id =
              "A turma precisa pertencer ao periodo curricular selecionado.";
          }
        }
      }
    }
  }

  if (input.stageAreaId) {
    if (!stageAreaRow) {
      fieldErrors.area_estagio_id = "Selecione uma area de estagio valida.";
    } else if (!stageAreaRow.oferta_curso_unidade_id) {
      fieldErrors.area_estagio_id =
        "A area selecionada precisa estar vinculada explicitamente a uma oferta.";
    } else {
      const stageAreaOfferRow =
        resolvedOffersById.get(stageAreaRow.oferta_curso_unidade_id) ??
        (await loadOffer(stageAreaRow.oferta_curso_unidade_id));

      if (!stageAreaOfferRow || stageAreaOfferRow.curso_id !== input.model.curso_id) {
        fieldErrors.area_estagio_id = "A area precisa pertencer ao mesmo curso do modelo.";
      } else {
        resolvedOffersById.set(stageAreaOfferRow.id, stageAreaOfferRow);

        if (input.offerId && stageAreaOfferRow.id !== input.offerId) {
          fieldErrors.area_estagio_id = "A area precisa pertencer a oferta selecionada.";
        }

        if (semesterOfferRow && stageAreaOfferRow.id !== semesterOfferRow.id) {
          fieldErrors.area_estagio_id =
            "A area precisa pertencer ao mesmo escopo do semestre selecionado.";
        }

        if (classOfferRow && stageAreaOfferRow.id !== classOfferRow.id) {
          fieldErrors.area_estagio_id =
            "A area precisa pertencer ao mesmo escopo da turma selecionada.";
        }
      }
    }
  }

  return { fieldErrors };
}

async function loadGroup(groupId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("grupos_modelo_avaliacao")
    .select("id, codigo, nome, ativo, modelo_avaliacao_curso_id")
    .eq("id", groupId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<GroupRow, "id" | "codigo" | "nome" | "ativo" | "modelo_avaliacao_curso_id">;
}

async function loadCriterion(criterionId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("criterios_modelo_avaliacao")
    .select("id, codigo, nome, ativo, grupo_modelo_avaliacao_id")
    .eq("id", criterionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    CriterionRow,
    "id" | "codigo" | "nome" | "ativo" | "grupo_modelo_avaliacao_id"
  >;
}

async function loadCriterionOption(criterionOptionId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("opcoes_criterio_modelo_avaliacao")
    .select("id, criterio_modelo_avaliacao_id, rotulo, ativo")
    .eq("id", criterionOptionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    CriterionOptionRow,
    "id" | "criterio_modelo_avaliacao_id" | "rotulo" | "ativo"
  >;
}

async function loadRequiredDocument(requiredDocumentId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("documentos_obrigatorios_curso")
    .select("id, codigo, curso_id, tipo_documento_id, nome_exibicao, ativo")
    .eq("id", requiredDocumentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    RequiredDocumentRow,
    "id" | "codigo" | "curso_id" | "tipo_documento_id" | "nome_exibicao" | "ativo"
  >;
}

async function loadDocumentType(documentTypeId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("tipos_documento")
    .select("id, codigo, nome, ativo")
    .eq("id", documentTypeId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<DocumentTypeRow, "id" | "codigo" | "nome" | "ativo">;
}

export async function initializeCourseConfigurationAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationInitializeFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationInitializeFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildInitializeFormValues(formData);
  const parsedData = initializeConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Selecione um curso valido para iniciar a configuracao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(parsedData.data.course_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso selecionado.",
      { course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  if (!targetCourse.ativo) {
    return buildActionState(
      "error",
      "O curso precisa estar ativo para iniciar a configuracao academica.",
      { course_id: "Ative o curso antes de iniciar a configuracao." },
      submittedFormValues
    );
  }

  const configurationSummary = await loadCourseConfigurationSummary(targetCourse.id);

  if (configurationSummary.modelCount > 0 || configurationSummary.requiredDocumentCount > 0) {
    return buildActionState(
      "error",
      "Este curso ja possui configuracao academica iniciada.",
      { course_id: "O curso ja possui modelo ou documentos obrigatorios cadastrados." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const modelCode = await resolveAvailableModelCode(
    `AVALIACAO_${normalizeCode(targetCourse.codigo)}`
  );
  const modelInsertPayload: ModelInsert = {
    curso_id: targetCourse.id,
    codigo: modelCode,
    nome: `Modelo de avaliacao - ${targetCourse.nome}`,
    descricao: `Modelo inicial de avaliacao academica do curso ${targetCourse.nome}.`,
    modalidade: "descritiva",
    padrao_lancamento: true,
    versao: 1,
    ativo: true,
    metadata: {
      origem: "initializeCourseConfigurationAction",
      curso_codigo: targetCourse.codigo,
      inicializado_em: new Date().toISOString()
    }
  };

  const { error } = await adminClient
    .from("modelos_avaliacao_curso")
    .insert(modelInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar o modelo inicial do curso.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Configuracao inicial criada para ${targetCourse.nome}. O curso agora possui um modelo base para continuar a parametrizacao.`,
    {},
    submittedFormValues
  );
}

export async function createCourseConfigurationModelAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateModelFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCreateModelFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateModelFormValues(formData);
  const parsedData = createModelConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do novo modelo.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(parsedData.data.course_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso informado.",
      { course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  if (!targetCourse.ativo) {
    return buildActionState(
      "error",
      "O curso precisa estar ativo para receber novos modelos.",
      { course_id: "Ative o curso antes de criar outro modelo." },
      submittedFormValues
    );
  }

  const normalizedCode = normalizeCode(parsedData.data.codigo);

  if (!normalizedCode) {
    return buildActionState(
      "error",
      "Informe um codigo valido para o modelo.",
      { codigo: "Use letras, numeros, hifen ou underline no codigo." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const [existingCodeResult, existingVersionResult, configurationSummary] = await Promise.all([
    adminClient
      .from("modelos_avaliacao_curso")
      .select("id")
      .eq("codigo", normalizedCode)
      .maybeSingle(),
    adminClient
      .from("modelos_avaliacao_curso")
      .select("id")
      .eq("curso_id", targetCourse.id)
      .eq("versao", parsedData.data.versao)
      .maybeSingle(),
    loadCourseConfigurationSummary(targetCourse.id)
  ]);

  if (existingCodeResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel validar a duplicidade do codigo do modelo.",
      {},
      submittedFormValues
    );
  }

  if (existingVersionResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel validar a duplicidade da versao do modelo.",
      {},
      submittedFormValues
    );
  }

  if (existingCodeResult.data) {
    return buildActionState(
      "error",
      "Ja existe um modelo com este codigo.",
      { codigo: "Escolha um codigo unico para o novo modelo." },
      submittedFormValues
    );
  }

  if (existingVersionResult.data) {
    return buildActionState(
      "error",
      "Ja existe um modelo com esta versao neste curso.",
      { versao: "Escolha uma versao ainda nao usada neste curso." },
      submittedFormValues
    );
  }

  const nextActive = toBooleanValue(parsedData.data.ativo);
  const shouldBecomeLaunchDefault =
    nextActive && !resolveLaunchDefaultModelId(configurationSummary.models);
  const modelInsertPayload: ModelInsert = {
    curso_id: targetCourse.id,
    codigo: normalizedCode,
    nome: parsedData.data.nome,
    descricao: toNullableText(parsedData.data.descricao),
    versao: parsedData.data.versao,
    modalidade: parsedData.data.modalidade,
    padrao_lancamento: shouldBecomeLaunchDefault,
    ativo: nextActive,
    metadata: {
      origem: "createCourseConfigurationModelAction",
      curso_codigo: targetCourse.codigo,
      criado_em: new Date().toISOString()
    }
  };

  const { error } = await adminClient
    .from("modelos_avaliacao_curso")
    .insert(modelInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar o novo modelo de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    shouldBecomeLaunchDefault
      ? `Modelo ${parsedData.data.nome} criado com sucesso e definido como padrao inicial do curso.`
      : `Modelo ${parsedData.data.nome} criado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function createCourseConfigurationGroupAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateGroupFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCreateGroupFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateGroupFormValues(formData);
  const parsedData = createGroupConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do novo grupo.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(parsedData.data.course_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso informado.",
      { course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  const targetModel = await loadModel(parsedData.data.model_id);

  if (!targetModel || targetModel.curso_id !== targetCourse.id) {
    return buildActionState(
      "error",
      "O modelo selecionado nao pertence ao curso informado.",
      { model_id: "Selecione um modelo valido para este curso." },
      submittedFormValues
    );
  }

  const normalizedCode = normalizeCode(parsedData.data.codigo);

  if (!normalizedCode) {
    return buildActionState(
      "error",
      "Informe um codigo valido para o grupo.",
      { codigo: "Use letras, numeros, hifen ou underline no codigo." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: existingGroup, error: existingGroupError } = await adminClient
    .from("grupos_modelo_avaliacao")
    .select("id")
    .eq("modelo_avaliacao_curso_id", targetModel.id)
    .eq("codigo", normalizedCode)
    .maybeSingle();

  if (existingGroupError) {
    return buildActionState(
      "error",
      "Nao foi possivel validar a duplicidade do codigo do grupo.",
      {},
      submittedFormValues
    );
  }

  if (existingGroup) {
    return buildActionState(
      "error",
      "Ja existe um grupo com esse codigo no modelo selecionado.",
      { codigo: "Escolha um codigo diferente para o grupo." },
      submittedFormValues
    );
  }

  const groupInsertPayload: GroupInsert = {
    modelo_avaliacao_curso_id: targetModel.id,
    codigo: normalizedCode,
    nome: parsedData.data.nome,
    ordem: parsedData.data.ordem,
    peso_percentual: parsedData.data.peso_percentual,
    ativo: toBooleanValue(parsedData.data.ativo),
    metadata: {
      origem: "createCourseConfigurationGroupAction",
      curso_id: targetCourse.id,
      modelo_id: targetModel.id,
      criado_em: new Date().toISOString()
    }
  };

  const { error } = await adminClient
    .from("grupos_modelo_avaliacao")
    .insert(groupInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar o grupo do modelo.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Grupo ${parsedData.data.nome} criado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function createCourseConfigurationCriterionAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateCriterionFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCreateCriterionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateCriterionFormValues(formData);
  const parsedData = createCriterionConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do novo criterio.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(parsedData.data.course_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso informado.",
      { course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  const targetGroup = await loadGroup(parsedData.data.group_id);

  if (!targetGroup) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o grupo informado.",
      { group_id: "Selecione um grupo valido." },
      submittedFormValues
    );
  }

  const targetModel = await loadModel(targetGroup.modelo_avaliacao_curso_id);

  if (!targetModel || targetModel.curso_id !== targetCourse.id) {
    return buildActionState(
      "error",
      "O grupo selecionado nao pertence ao curso informado.",
      { group_id: "Selecione um grupo valido para este curso." },
      submittedFormValues
    );
  }

  const normalizedCode = normalizeCode(parsedData.data.codigo);

  if (!normalizedCode) {
    return buildActionState(
      "error",
      "Informe um codigo valido para o criterio.",
      { codigo: "Use letras, numeros, hifen ou underline no codigo." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: existingCriterion, error: existingCriterionError } = await adminClient
    .from("criterios_modelo_avaliacao")
    .select("id")
    .eq("grupo_modelo_avaliacao_id", targetGroup.id)
    .eq("codigo", normalizedCode)
    .maybeSingle();

  if (existingCriterionError) {
    return buildActionState(
      "error",
      "Nao foi possivel validar a duplicidade do codigo do criterio.",
      {},
      submittedFormValues
    );
  }

  if (existingCriterion) {
    return buildActionState(
      "error",
      "Ja existe um criterio com esse codigo no grupo selecionado.",
      { codigo: "Escolha um codigo diferente para o criterio." },
      submittedFormValues
    );
  }

  const criterionInsertPayload: CriterionInsert = {
    grupo_modelo_avaliacao_id: targetGroup.id,
    codigo: normalizedCode,
    nome: parsedData.data.nome,
    descricao: toNullableText(parsedData.data.descricao),
    ordem: parsedData.data.ordem,
    peso_percentual: parsedData.data.peso_percentual,
    escala_maxima: parsedData.data.escala_maxima,
    ativo: toBooleanValue(parsedData.data.ativo),
    metadata: {
      origem: "createCourseConfigurationCriterionAction",
      curso_id: targetCourse.id,
      grupo_id: targetGroup.id,
      criado_em: new Date().toISOString()
    }
  };

  const { error } = await adminClient
    .from("criterios_modelo_avaliacao")
    .insert(criterionInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar o criterio de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Criterio ${parsedData.data.nome} criado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function createCourseConfigurationCriterionOptionAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateCriterionOptionFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCreateCriterionOptionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateCriterionOptionFormValues(formData);
  const parsedData = createCriterionOptionConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos da nova opcao de rubrica.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCriterion = await loadCriterion(parsedData.data.criterion_id);

  if (!targetCriterion) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o criterio informado.",
      { criterion_id: "Selecione um criterio valido." },
      submittedFormValues
    );
  }

  const targetGroup = await loadGroup(targetCriterion.grupo_modelo_avaliacao_id);
  const targetModel = targetGroup
    ? await loadModel(targetGroup.modelo_avaliacao_curso_id)
    : null;

  if (!targetGroup || !targetModel) {
    return buildActionState(
      "error",
      "Nao foi possivel validar o vinculo do criterio com o modelo de avaliacao.",
      { criterion_id: "Selecione um criterio valido." },
      submittedFormValues
    );
  }

  if (targetModel.modalidade !== "rubrica") {
    return buildActionState(
      "error",
      "Opcoes de rubrica so podem ser cadastradas em modelos com modalidade rubrica.",
      { criterion_id: "Altere o modelo para modalidade rubrica antes de criar opcoes." },
      submittedFormValues
    );
  }

  const criterionOptionInsertPayload: CriterionOptionInsert = {
    criterio_modelo_avaliacao_id: targetCriterion.id,
    rotulo: parsedData.data.rotulo,
    descricao: toNullableText(parsedData.data.descricao),
    valor_nota: parsedData.data.valor_nota,
    ordem: parsedData.data.ordem,
    ativo: toBooleanValue(parsedData.data.ativo)
  };

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("opcoes_criterio_modelo_avaliacao")
    .insert(criterionOptionInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar a opcao de rubrica.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Opcao ${parsedData.data.rotulo} criada com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function createCourseRequiredDocumentAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateRequiredDocumentFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCreateRequiredDocumentFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateRequiredDocumentFormValues(formData);
  const parsedData = createRequiredDocumentConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do novo documento obrigatorio.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(parsedData.data.course_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso informado.",
      { course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  const targetDocumentType = await loadDocumentType(parsedData.data.tipo_documento_id);

  if (!targetDocumentType) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o tipo documental informado.",
      { tipo_documento_id: "Selecione um tipo documental valido." },
      submittedFormValues
    );
  }

  if (!targetDocumentType.ativo) {
    return buildActionState(
      "error",
      "O tipo documental selecionado esta inativo.",
      { tipo_documento_id: "Selecione um tipo documental ativo." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: existingRequiredDocument, error: existingRequiredDocumentError } =
    await adminClient
      .from("documentos_obrigatorios_curso")
      .select("id")
      .eq("curso_id", targetCourse.id)
      .eq("tipo_documento_id", targetDocumentType.id)
      .maybeSingle();

  if (existingRequiredDocumentError) {
    return buildActionState(
      "error",
      "Nao foi possivel validar a duplicidade do tipo documental neste curso.",
      {},
      submittedFormValues
    );
  }

  if (existingRequiredDocument) {
    return buildActionState(
      "error",
      "Este curso ja possui um documento obrigatorio para o tipo documental selecionado.",
      { tipo_documento_id: "Escolha outro tipo documental ou edite o registro existente." },
      submittedFormValues
    );
  }

  const requiredDocumentInsertPayload: RequiredDocumentInsert = {
    curso_id: targetCourse.id,
    tipo_documento_id: targetDocumentType.id,
    codigo: normalizeCode(`${targetCourse.codigo}_${targetDocumentType.codigo}`),
    nome_exibicao: parsedData.data.nome_exibicao,
    descricao: toNullableText(parsedData.data.descricao),
    obrigatorio: toBooleanValue(parsedData.data.obrigatorio),
    ordem: parsedData.data.ordem,
    ativo: toBooleanValue(parsedData.data.ativo),
    metadata: {
      origem: "createCourseRequiredDocumentAction",
      curso_id: targetCourse.id,
      tipo_documento_id: targetDocumentType.id,
      criado_em: new Date().toISOString()
    }
  };

  const { error } = await adminClient
    .from("documentos_obrigatorios_curso")
    .insert(requiredDocumentInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar o documento obrigatorio do curso.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Documento obrigatorio ${parsedData.data.nome_exibicao} criado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function deleteCourseConfigurationGroupAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationDeleteGroupFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationDeleteGroupFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildDeleteGroupFormValues(formData);
  const parsedData = deleteGroupConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar o grupo informado.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingGroup = await loadGroup(parsedData.data.group_id);

  if (!existingGroup) {
    return buildActionState(
      "error",
      "O grupo informado nao foi encontrado.",
      { group_id: "Grupo invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { count: linkedCriteriaCount, error: linkedCriteriaError } = await adminClient
    .from("criterios_modelo_avaliacao")
    .select("id", { count: "exact", head: true })
    .eq("grupo_modelo_avaliacao_id", existingGroup.id);

  if (linkedCriteriaError) {
    return buildActionState(
      "error",
      "Nao foi possivel verificar se o grupo possui criterios vinculados.",
      {},
      submittedFormValues
    );
  }

  if ((linkedCriteriaCount ?? 0) > 0) {
    return buildActionState(
      "error",
      "Este grupo possui criterios vinculados. Remova os criterios antes de excluir o grupo.",
      {},
      submittedFormValues
    );
  }

  const { error } = await adminClient
    .from("grupos_modelo_avaliacao")
    .delete()
    .eq("id", existingGroup.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel excluir o grupo.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Grupo ${existingGroup.nome} excluido com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function deleteCourseConfigurationCriterionAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationDeleteCriterionFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationDeleteCriterionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildDeleteCriterionFormValues(formData);
  const parsedData = deleteCriterionConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar o criterio informado.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingCriterion = await loadCriterion(parsedData.data.criterion_id);

  if (!existingCriterion) {
    return buildActionState(
      "error",
      "O criterio informado nao foi encontrado.",
      { criterion_id: "Criterio invalido." },
      submittedFormValues
    );
  }

  const existingGroup = await loadGroup(existingCriterion.grupo_modelo_avaliacao_id);
  const existingModel = existingGroup
    ? await loadModel(existingGroup.modelo_avaliacao_curso_id)
    : null;

  if (!existingGroup || !existingModel) {
    return buildActionState(
      "error",
      "Nao foi possivel validar o vinculo do criterio com o modelo de avaliacao.",
      {},
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { count: evaluationUsageCount, error: evaluationUsageError } = await adminClient
    .from("avaliacoes")
    .select("id", { count: "exact", head: true })
    .eq("modelo_avaliacao_curso_id", existingModel.id);

  if (evaluationUsageError) {
    return buildActionState(
      "error",
      "Nao foi possivel verificar se o criterio ja possui uso em avaliacoes.",
      {},
      submittedFormValues
    );
  }

  if ((evaluationUsageCount ?? 0) > 0) {
    const { error } = await adminClient
      .from("criterios_modelo_avaliacao")
      .update({ ativo: false } satisfies Partial<CriterionRow> as never)
      .eq("id", existingCriterion.id);

    if (error) {
      return buildActionState(
        "error",
        error.message || "Nao foi possivel desativar o criterio com historico.",
        {},
        submittedFormValues
      );
    }

    revalidateCourseConfigurationPaths();

    return buildActionState(
      "success",
      "Este criterio ja possui uso em avaliacoes. Para preservar o historico, ele foi desativado em vez de excluido.",
      {},
      submittedFormValues
    );
  }

  const { error } = await adminClient
    .from("criterios_modelo_avaliacao")
    .delete()
    .eq("id", existingCriterion.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel excluir o criterio.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Criterio ${existingCriterion.nome} excluido com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function deleteCourseRequiredDocumentAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationDeleteRequiredDocumentFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationDeleteRequiredDocumentFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildDeleteRequiredDocumentFormValues(formData);
  const parsedData = deleteRequiredDocumentConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar o documento obrigatorio informado.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingRequiredDocument = await loadRequiredDocument(parsedData.data.required_document_id);

  if (!existingRequiredDocument) {
    return buildActionState(
      "error",
      "O documento obrigatorio informado nao foi encontrado.",
      { required_document_id: "Documento obrigatorio invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { count: linkedStudentDocumentsCount, error: linkedStudentDocumentsError } =
    await adminClient
      .from("documentos_aluno")
      .select("id", { count: "exact", head: true })
      .eq("documento_obrigatorio_curso_id", existingRequiredDocument.id);

  if (linkedStudentDocumentsError) {
    return buildActionState(
      "error",
      "Nao foi possivel verificar se o documento obrigatorio possui documentos de alunos vinculados.",
      {},
      submittedFormValues
    );
  }

  if ((linkedStudentDocumentsCount ?? 0) > 0) {
    const { error } = await adminClient
      .from("documentos_obrigatorios_curso")
      .update({ ativo: false } satisfies Partial<RequiredDocumentRow> as never)
      .eq("id", existingRequiredDocument.id);

    if (error) {
      return buildActionState(
        "error",
        error.message || "Nao foi possivel desativar o documento obrigatorio com historico.",
        {},
        submittedFormValues
      );
    }

    revalidateCourseConfigurationPaths();

    return buildActionState(
      "success",
      "Este documento obrigatorio ja possui documentos de alunos vinculados. Para preservar o historico, ele foi desativado em vez de excluido.",
      {},
      submittedFormValues
    );
  }

  const { error } = await adminClient
    .from("documentos_obrigatorios_curso")
    .delete()
    .eq("id", existingRequiredDocument.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel excluir o documento obrigatorio.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Documento obrigatorio ${existingRequiredDocument.nome_exibicao ?? existingRequiredDocument.codigo ?? "selecionado"} excluido com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationModelAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationModelFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationModelFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildModelFormValues(formData);
  const parsedData = modelConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do modelo de avaliacao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingModel = await loadModel(parsedData.data.model_id);

  if (!existingModel) {
    return buildActionState(
      "error",
      "O modelo de avaliacao informado nao foi encontrado.",
      { model_id: "Modelo invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const nextActive = toBooleanValue(parsedData.data.ativo);
  const { error } = await adminClient
    .from("modelos_avaliacao_curso")
    .update({
      nome: parsedData.data.nome,
      descricao: toNullableText(parsedData.data.descricao),
      modalidade: parsedData.data.modalidade,
      ativo: nextActive,
      padrao_lancamento: nextActive ? existingModel.padrao_lancamento : false
    } satisfies Partial<ModelRow> as never)
    .eq("id", existingModel.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar o modelo de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Modelo ${parsedData.data.nome} atualizado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function duplicateCourseConfigurationModelAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationDuplicateModelFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationDuplicateModelFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildDuplicateModelFormValues(formData);
  const parsedData = duplicateModelConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar o modelo que sera duplicado.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const sourceModel = await loadModel(parsedData.data.model_id);

  if (!sourceModel) {
    return buildActionState(
      "error",
      "O modelo de avaliacao informado nao foi encontrado.",
      { model_id: "Modelo invalido." },
      submittedFormValues
    );
  }

  const targetCourse = await loadCourse(sourceModel.curso_id);

  if (!targetCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso vinculado ao modelo original.",
      {},
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const sourceGroupsResult = await adminClient
    .from("grupos_modelo_avaliacao")
    .select("*")
    .eq("modelo_avaliacao_curso_id", sourceModel.id)
    .order("ordem", { ascending: true });

  if (sourceGroupsResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar os grupos do modelo original.",
      {},
      submittedFormValues
    );
  }

  const sourceGroups = (sourceGroupsResult.data ?? []) as GroupRow[];
  const sourceGroupIds = sourceGroups.map((groupRow) => groupRow.id);
  const sourceCriteriaResult = sourceGroupIds.length
    ? await adminClient
        .from("criterios_modelo_avaliacao")
        .select("*")
        .in("grupo_modelo_avaliacao_id", sourceGroupIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (sourceCriteriaResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar os criterios do modelo original.",
      {},
      submittedFormValues
    );
  }

  const sourceCriteria = (sourceCriteriaResult.data ?? []) as CriterionRow[];
  const sourceCriterionIds = sourceCriteria.map((criterionRow) => criterionRow.id);
  const sourceCriterionOptionsResult = sourceCriterionIds.length
    ? await adminClient
        .from("opcoes_criterio_modelo_avaliacao")
        .select("*")
        .in("criterio_modelo_avaliacao_id", sourceCriterionIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (sourceCriterionOptionsResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar as opcoes de rubrica do modelo original.",
      {},
      submittedFormValues
    );
  }

  const sourceCriterionOptions =
    (sourceCriterionOptionsResult.data ?? []) as CriterionOptionRow[];
  const nextVersion = await resolveNextCourseModelVersion(targetCourse.id);
  const duplicatedModelCode = await resolveAvailableModelCode(`${sourceModel.codigo}_COPIA`);
  const createdGroupIds: string[] = [];
  const createdCriterionIds: string[] = [];
  let createdModelId: string | null = null;

  try {
    const duplicatedModelPayload: ModelInsert = {
      curso_id: targetCourse.id,
      codigo: duplicatedModelCode,
      nome: `Copia de ${sourceModel.nome}`,
      descricao: sourceModel.descricao,
      versao: nextVersion,
      modalidade: sourceModel.modalidade,
      padrao_lancamento: false,
      ativo: sourceModel.ativo,
      metadata: mergeCopiedMetadata(sourceModel.metadata, {
        source_model_id: sourceModel.id,
        source_course_id: sourceModel.curso_id,
        duplicated_at: new Date().toISOString(),
        duplicated_by: "duplicateCourseConfigurationModelAction"
      })
    };

    const insertedModelResult = await adminClient
      .from("modelos_avaliacao_curso")
      .insert(duplicatedModelPayload as never)
      .select("id")
      .single();
    const insertedModelData = insertedModelResult.data as { id: string } | null;

    if (insertedModelResult.error || !insertedModelData) {
      throw new Error("Nao foi possivel criar o novo modelo duplicado.");
    }

    createdModelId = insertedModelData.id;
    const sourceCriteriaByGroupId = new Map<string, CriterionRow[]>();
    const sourceOptionsByCriterionId = new Map<string, CriterionOptionRow[]>();

    for (const sourceCriterion of sourceCriteria) {
      const currentCriteria = sourceCriteriaByGroupId.get(sourceCriterion.grupo_modelo_avaliacao_id);
      if (currentCriteria) {
        currentCriteria.push(sourceCriterion);
      } else {
        sourceCriteriaByGroupId.set(sourceCriterion.grupo_modelo_avaliacao_id, [sourceCriterion]);
      }
    }

    for (const sourceCriterionOption of sourceCriterionOptions) {
      const currentOptions = sourceOptionsByCriterionId.get(
        sourceCriterionOption.criterio_modelo_avaliacao_id
      );
      if (currentOptions) {
        currentOptions.push(sourceCriterionOption);
      } else {
        sourceOptionsByCriterionId.set(sourceCriterionOption.criterio_modelo_avaliacao_id, [
          sourceCriterionOption
        ]);
      }
    }

    for (const sourceGroup of sourceGroups) {
      const groupInsertPayload: GroupInsert = {
        modelo_avaliacao_curso_id: createdModelId,
        codigo: sourceGroup.codigo,
        nome: sourceGroup.nome,
        ordem: sourceGroup.ordem,
        peso_percentual: sourceGroup.peso_percentual,
        ativo: sourceGroup.ativo,
        metadata: mergeCopiedMetadata(sourceGroup.metadata, {
          source_group_id: sourceGroup.id,
          source_model_id: sourceModel.id,
          duplicated_at: new Date().toISOString(),
          duplicated_by: "duplicateCourseConfigurationModelAction"
        })
      };

      const insertedGroupResult = await adminClient
        .from("grupos_modelo_avaliacao")
        .insert(groupInsertPayload as never)
        .select("id")
        .single();
      const insertedGroupData = insertedGroupResult.data as { id: string } | null;

      if (insertedGroupResult.error || !insertedGroupData) {
        throw new Error("Nao foi possivel copiar um dos grupos do modelo original.");
      }

      createdGroupIds.push(insertedGroupData.id);

      for (const sourceCriterion of sourceCriteriaByGroupId.get(sourceGroup.id) ?? []) {
        const criterionInsertPayload: CriterionInsert = {
          grupo_modelo_avaliacao_id: insertedGroupData.id,
          codigo: sourceCriterion.codigo,
          nome: sourceCriterion.nome,
          descricao: sourceCriterion.descricao,
          ordem: sourceCriterion.ordem,
          peso_percentual: sourceCriterion.peso_percentual,
          escala_maxima: sourceCriterion.escala_maxima,
          ativo: sourceCriterion.ativo,
          metadata: mergeCopiedMetadata(sourceCriterion.metadata, {
            source_criterion_id: sourceCriterion.id,
            source_group_id: sourceGroup.id,
            source_model_id: sourceModel.id,
            duplicated_at: new Date().toISOString(),
            duplicated_by: "duplicateCourseConfigurationModelAction"
          })
        };

        const insertedCriterionResult = await adminClient
          .from("criterios_modelo_avaliacao")
          .insert(criterionInsertPayload as never)
          .select("id")
          .single();
        const insertedCriterionData =
          insertedCriterionResult.data as { id: string } | null;

        if (insertedCriterionResult.error || !insertedCriterionData) {
          throw new Error("Nao foi possivel copiar um dos criterios do modelo original.");
        }

        createdCriterionIds.push(insertedCriterionData.id);

        for (const sourceCriterionOption of sourceOptionsByCriterionId.get(sourceCriterion.id) ?? []) {
          const criterionOptionInsertPayload: CriterionOptionInsert = {
            criterio_modelo_avaliacao_id: insertedCriterionData.id,
            rotulo: sourceCriterionOption.rotulo,
            descricao: sourceCriterionOption.descricao,
            valor_nota: sourceCriterionOption.valor_nota,
            ordem: sourceCriterionOption.ordem,
            ativo: sourceCriterionOption.ativo
          };

          const insertedCriterionOptionResult = await adminClient
            .from("opcoes_criterio_modelo_avaliacao")
            .insert(criterionOptionInsertPayload as never)
            .select("id")
            .single();

          if (insertedCriterionOptionResult.error || !insertedCriterionOptionResult.data) {
            throw new Error(
              "Nao foi possivel copiar as opcoes de rubrica do modelo original."
            );
          }
        }
      }
    }
  } catch (error) {
    if (createdCriterionIds.length) {
      await adminClient.from("criterios_modelo_avaliacao").delete().in("id", createdCriterionIds);
    }

    if (createdGroupIds.length) {
      await adminClient.from("grupos_modelo_avaliacao").delete().in("id", createdGroupIds);
    }

    if (createdModelId) {
      await adminClient.from("modelos_avaliacao_curso").delete().eq("id", createdModelId);
    }

    return buildActionState(
      "error",
      error instanceof Error
        ? error.message
        : "Nao foi possivel duplicar o modelo de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Modelo ${sourceModel.nome} duplicado com sucesso. O clone foi criado sem regra de aplicacao e sem virar padrao automaticamente.`,
    {},
    submittedFormValues
  );
}

export async function setCourseConfigurationModelLaunchDefaultAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationSetLaunchDefaultFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationSetLaunchDefaultFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildSetLaunchDefaultFormValues(formData);
  const parsedData = setLaunchDefaultConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar o modelo selecionado.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingModel = await loadModel(parsedData.data.model_id);

  if (!existingModel) {
    return buildActionState(
      "error",
      "O modelo de avaliacao informado nao foi encontrado.",
      { model_id: "Modelo invalido." },
      submittedFormValues
    );
  }

  if (!existingModel.ativo) {
    return buildActionState(
      "error",
      "Somente modelos ativos podem ser definidos como padrao para lancamento.",
      { model_id: "Ative o modelo antes de defini-lo como padrao." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const clearDefaultsResult = await adminClient
    .from("modelos_avaliacao_curso")
    .update({ padrao_lancamento: false } satisfies Partial<ModelRow> as never)
    .eq("curso_id", existingModel.curso_id)
    .neq("id", existingModel.id);

  if (clearDefaultsResult.error) {
    return buildActionState(
      "error",
      clearDefaultsResult.error.message ||
        "Nao foi possivel limpar o modelo padrao atual antes da troca.",
      {},
      submittedFormValues
    );
  }

  const setDefaultResult = await adminClient
    .from("modelos_avaliacao_curso")
    .update({ padrao_lancamento: true } satisfies Partial<ModelRow> as never)
    .eq("id", existingModel.id);

  if (setDefaultResult.error) {
    return buildActionState(
      "error",
      setDefaultResult.error.message ||
        "Nao foi possivel definir o modelo selecionado como padrao para lancamento.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Modelo ${existingModel.nome} definido como padrao para lancamento.`,
    {},
    submittedFormValues
  );
}

export async function createCourseConfigurationModelApplicationRuleAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCreateModelApplicationRuleFormValues>,
  formData: FormData
): Promise<
  CourseConfigurationActionState<CourseConfigurationCreateModelApplicationRuleFormValues>
> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateModelApplicationRuleFormValues(formData);
  const parsedData =
    createModelApplicationRuleConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos da regra de aplicacao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingModel = await loadModel(parsedData.data.model_id);

  if (!existingModel) {
    return buildActionState(
      "error",
      "O modelo informado nao foi encontrado.",
      { model_id: "Modelo invalido." },
      submittedFormValues
    );
  }

  const validation = await validateModelApplicationRuleInput({
    model: existingModel,
    offerId: parsedData.data.oferta_curso_unidade_id,
    curricularPeriod: parsedData.data.periodo_curricular,
    semesterId: parsedData.data.semestre_id,
    classId: parsedData.data.turma_id,
    stageAreaId: parsedData.data.area_estagio_id
  });

  if (Object.keys(validation.fieldErrors).length > 0) {
    return buildActionState(
      "error",
      "Nao foi possivel salvar a regra de aplicacao com os dados informados.",
      validation.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const insertPayload: ModelApplicationRuleInsert = {
    modelo_avaliacao_curso_id: existingModel.id,
    oferta_curso_unidade_id: parsedData.data.oferta_curso_unidade_id,
    periodo_curricular: parsedData.data.periodo_curricular,
    semestre_id: parsedData.data.semestre_id,
    turma_id: parsedData.data.turma_id,
    area_estagio_id: parsedData.data.area_estagio_id,
    prioridade: parsedData.data.prioridade,
    ativo: toBooleanValue(parsedData.data.ativo),
    metadata: {}
  };

  const { error } = await adminClient
    .from("regras_aplicacao_modelo_avaliacao")
    .insert(insertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel criar a regra de aplicacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Regra de aplicacao criada com sucesso para o modelo ${existingModel.nome}.`,
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationModelApplicationRuleAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationModelApplicationRuleFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationModelApplicationRuleFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildModelApplicationRuleFormValues(formData);
  const parsedData = modelApplicationRuleConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos da regra de aplicacao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingRule = await loadModelApplicationRule(parsedData.data.rule_id);

  if (!existingRule) {
    return buildActionState(
      "error",
      "A regra de aplicacao informada nao foi encontrada.",
      { rule_id: "Regra invalida." },
      submittedFormValues
    );
  }

  const existingModel = await loadModel(existingRule.modelo_avaliacao_curso_id);

  if (!existingModel) {
    return buildActionState(
      "error",
      "O modelo vinculado a esta regra nao foi encontrado.",
      { rule_id: "Modelo nao identificado para a regra selecionada." },
      submittedFormValues
    );
  }

  const validation = await validateModelApplicationRuleInput({
    model: existingModel,
    offerId: parsedData.data.oferta_curso_unidade_id,
    curricularPeriod: parsedData.data.periodo_curricular,
    semesterId: parsedData.data.semestre_id,
    classId: parsedData.data.turma_id,
    stageAreaId: parsedData.data.area_estagio_id
  });

  if (Object.keys(validation.fieldErrors).length > 0) {
    return buildActionState(
      "error",
      "Nao foi possivel atualizar a regra de aplicacao com os dados informados.",
      validation.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("regras_aplicacao_modelo_avaliacao")
    .update({
      oferta_curso_unidade_id: parsedData.data.oferta_curso_unidade_id,
      periodo_curricular: parsedData.data.periodo_curricular,
      semestre_id: parsedData.data.semestre_id,
      turma_id: parsedData.data.turma_id,
      area_estagio_id: parsedData.data.area_estagio_id,
      prioridade: parsedData.data.prioridade,
      ativo: toBooleanValue(parsedData.data.ativo)
    } satisfies Partial<ModelApplicationRuleRow> as never)
    .eq("id", existingRule.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar a regra de aplicacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Regra de aplicacao do modelo ${existingModel.nome} atualizada com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function toggleCourseConfigurationModelApplicationRuleAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationToggleModelApplicationRuleFormValues>,
  formData: FormData
): Promise<
  CourseConfigurationActionState<CourseConfigurationToggleModelApplicationRuleFormValues>
> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildToggleModelApplicationRuleFormValues(formData);
  const parsedData =
    toggleModelApplicationRuleConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Nao foi possivel identificar a regra selecionada.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingRule = await loadModelApplicationRule(parsedData.data.rule_id);

  if (!existingRule) {
    return buildActionState(
      "error",
      "A regra de aplicacao informada nao foi encontrada.",
      { rule_id: "Regra invalida." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const nextActive = toBooleanValue(parsedData.data.ativo);
  const { error } = await adminClient
    .from("regras_aplicacao_modelo_avaliacao")
    .update({ ativo: nextActive } satisfies Partial<ModelApplicationRuleRow> as never)
    .eq("id", existingRule.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar o status da regra de aplicacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    nextActive
      ? "Regra de aplicacao reativada com sucesso."
      : "Regra de aplicacao inativada com sucesso.",
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationGroupAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationGroupFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationGroupFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildGroupFormValues(formData);
  const parsedData = groupConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do grupo de avaliacao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingGroup = await loadGroup(parsedData.data.group_id);

  if (!existingGroup) {
    return buildActionState(
      "error",
      "O grupo informado nao foi encontrado.",
      { group_id: "Grupo invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("grupos_modelo_avaliacao")
    .update({
      nome: parsedData.data.nome,
      ordem: parsedData.data.ordem,
      peso_percentual: parsedData.data.peso_percentual,
      ativo: toBooleanValue(parsedData.data.ativo)
    } satisfies Partial<GroupRow> as never)
    .eq("id", existingGroup.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar o grupo de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Grupo ${parsedData.data.nome} atualizado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationCriterionAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCriterionFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCriterionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCriterionFormValues(formData);
  const parsedData = criterionConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do criterio de avaliacao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingCriterion = await loadCriterion(parsedData.data.criterion_id);

  if (!existingCriterion) {
    return buildActionState(
      "error",
      "O criterio informado nao foi encontrado.",
      { criterion_id: "Criterio invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("criterios_modelo_avaliacao")
    .update({
      nome: parsedData.data.nome,
      descricao: toNullableText(parsedData.data.descricao),
      ordem: parsedData.data.ordem,
      peso_percentual: parsedData.data.peso_percentual,
      escala_maxima: parsedData.data.escala_maxima,
      ativo: toBooleanValue(parsedData.data.ativo)
    } satisfies Partial<CriterionRow> as never)
    .eq("id", existingCriterion.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar o criterio de avaliacao.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Criterio ${parsedData.data.nome} atualizado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationCriterionOptionAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCriterionOptionFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCriterionOptionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCriterionOptionFormValues(formData);
  const parsedData = criterionOptionConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos da opcao de rubrica.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingOption = await loadCriterionOption(parsedData.data.criterion_option_id);

  if (!existingOption) {
    return buildActionState(
      "error",
      "A opcao de rubrica informada nao foi encontrada.",
      { criterion_option_id: "Opcao de rubrica invalida." },
      submittedFormValues
    );
  }

  const existingCriterion = await loadCriterion(existingOption.criterio_modelo_avaliacao_id);
  const existingGroup = existingCriterion
    ? await loadGroup(existingCriterion.grupo_modelo_avaliacao_id)
    : null;
  const existingModel = existingGroup
    ? await loadModel(existingGroup.modelo_avaliacao_curso_id)
    : null;

  if (!existingCriterion || !existingGroup || !existingModel) {
    return buildActionState(
      "error",
      "Nao foi possivel validar o vinculo da opcao com o modelo de avaliacao.",
      { criterion_option_id: "Opcao de rubrica invalida." },
      submittedFormValues
    );
  }

  if (existingModel.modalidade !== "rubrica") {
    return buildActionState(
      "error",
      "Opcoes de rubrica so podem ser mantidas em modelos com modalidade rubrica.",
      { criterion_option_id: "Altere o modelo para modalidade rubrica antes de editar opcoes." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("opcoes_criterio_modelo_avaliacao")
    .update({
      rotulo: parsedData.data.rotulo,
      descricao: toNullableText(parsedData.data.descricao),
      valor_nota: parsedData.data.valor_nota,
      ordem: parsedData.data.ordem,
      ativo: toBooleanValue(parsedData.data.ativo)
    } satisfies Partial<CriterionOptionRow> as never)
    .eq("id", existingOption.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar a opcao de rubrica.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Opcao ${parsedData.data.rotulo} atualizada com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function updateCourseConfigurationRequiredDocumentAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationRequiredDocumentFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationRequiredDocumentFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildRequiredDocumentFormValues(formData);
  const parsedData = requiredDocumentConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos do documento obrigatorio.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const existingRequiredDocument = await loadRequiredDocument(
    parsedData.data.required_document_id
  );

  if (!existingRequiredDocument) {
    return buildActionState(
      "error",
      "O documento obrigatorio informado nao foi encontrado.",
      { required_document_id: "Documento obrigatorio invalido." },
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("documentos_obrigatorios_curso")
    .update({
      nome_exibicao: parsedData.data.nome_exibicao,
      descricao: toNullableText(parsedData.data.descricao),
      obrigatorio: toBooleanValue(parsedData.data.obrigatorio),
      ordem: parsedData.data.ordem,
      ativo: toBooleanValue(parsedData.data.ativo)
    } satisfies Partial<RequiredDocumentRow> as never)
    .eq("id", existingRequiredDocument.id);

  if (error) {
    return buildActionState(
      "error",
      error.message || "Nao foi possivel atualizar o documento obrigatorio.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Documento ${parsedData.data.nome_exibicao} atualizado com sucesso.`,
    {},
    submittedFormValues
  );
}

export async function copyFisioterapiaConfigurationAction(
  _previousState: CourseConfigurationActionState<CourseConfigurationCopyFormValues>,
  formData: FormData
): Promise<CourseConfigurationActionState<CourseConfigurationCopyFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCopyFormValues(formData);
  const parsedData = copyConfigurationSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Selecione um curso valido para receber a configuracao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const destinationCourse = await loadCourse(parsedData.data.destination_course_id);

  if (!destinationCourse) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar o curso destino.",
      { destination_course_id: "Selecione um curso valido." },
      submittedFormValues
    );
  }

  const sourceResolution = await loadPreferredFisioterapiaSourceCourse(
    destinationCourse.instituicao_id
  );

  if (!sourceResolution) {
    return buildActionState(
      "error",
      "Nenhuma base padrao de Fisioterapia configurada foi encontrada.",
      {
        destination_course_id:
          "Nao existe uma base configurada de Fisioterapia disponivel para duplicacao."
      },
      submittedFormValues
    );
  }

  const sourceCourse = sourceResolution.course;

  if (destinationCourse.id === sourceCourse.id) {
    return buildActionState(
      "error",
      "Nao e permitido copiar a configuracao da Fisioterapia para o proprio curso de origem.",
      {
        destination_course_id:
          "Escolha um curso destino diferente da base de Fisioterapia usada como origem."
      },
      submittedFormValues
    );
  }

  const destinationConfiguration = await loadCourseConfigurationSummary(destinationCourse.id);
  const canReuseInitialModel =
    destinationConfiguration.modelCount === 1 &&
    destinationConfiguration.groupCount === 0 &&
    destinationConfiguration.criterionCount === 0 &&
    destinationConfiguration.requiredDocumentCount === 0;
  const canCopyIntoDestination =
    destinationConfiguration.groupCount === 0 &&
    destinationConfiguration.criterionCount === 0 &&
    destinationConfiguration.requiredDocumentCount === 0 &&
    destinationConfiguration.modelCount <= 1;

  if (!canCopyIntoDestination) {
    return buildActionState(
      "error",
      "Este curso ja possui configuracao academica em andamento. Revise manualmente os grupos, criterios e documentos antes de duplicar a base da Fisioterapia.",
      {
        destination_course_id:
          "A duplicacao so e permitida para cursos sem grupos, criterios ou documentos obrigatorios cadastrados."
      },
      submittedFormValues
    );
  }
  const reusableInitialModel =
    canReuseInitialModel && destinationConfiguration.models.length === 1
      ? destinationConfiguration.models[0]
      : null;

  const adminClient = createSupabaseAdminClient();
  const sourceModelsResult = await adminClient
    .from("modelos_avaliacao_curso")
    .select("*")
    .eq("curso_id", sourceCourse.id)
    .order("versao", { ascending: true });

  const sourceRequiredDocumentsResult = await adminClient
    .from("documentos_obrigatorios_curso")
    .select("*")
    .eq("curso_id", sourceCourse.id)
    .order("ordem", { ascending: true });

  if (sourceModelsResult.error || sourceRequiredDocumentsResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar a configuracao base da Fisioterapia.",
      {},
      submittedFormValues
    );
  }

  const sourceModels = (sourceModelsResult.data ?? []) as ModelRow[];
  const sourceRequiredDocuments =
    (sourceRequiredDocumentsResult.data ?? []) as RequiredDocumentRow[];
  const sourceLaunchDefaultModelId = resolveLaunchDefaultModelId(sourceModels);

  if (!sourceModels.length && !sourceRequiredDocuments.length) {
    return buildActionState(
      "error",
      "A base de Fisioterapia localizada ainda nao possui configuracao completa para ser copiada.",
      {},
      submittedFormValues
    );
  }

  const sourceModelIds = sourceModels.map((modelRow) => modelRow.id);
  const sourceGroupsResult = sourceModelIds.length
    ? await adminClient
        .from("grupos_modelo_avaliacao")
        .select("*")
        .in("modelo_avaliacao_curso_id", sourceModelIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (sourceGroupsResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar os grupos do modelo base da Fisioterapia.",
      {},
      submittedFormValues
    );
  }

  const sourceGroups = (sourceGroupsResult.data ?? []) as GroupRow[];
  const sourceGroupIds = sourceGroups.map((groupRow) => groupRow.id);
  const sourceCriteriaResult = sourceGroupIds.length
    ? await adminClient
        .from("criterios_modelo_avaliacao")
        .select("*")
        .in("grupo_modelo_avaliacao_id", sourceGroupIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (sourceCriteriaResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar os criterios do modelo base da Fisioterapia.",
      {},
      submittedFormValues
    );
  }

  const sourceCriteria = (sourceCriteriaResult.data ?? []) as CriterionRow[];
  const sourceCriterionIds = sourceCriteria.map((criterionRow) => criterionRow.id);
  const sourceCriterionOptionsResult = sourceCriterionIds.length
    ? await adminClient
        .from("opcoes_criterio_modelo_avaliacao")
        .select("*")
        .in("criterio_modelo_avaliacao_id", sourceCriterionIds)
        .order("ordem", { ascending: true })
    : { data: [], error: null };

  if (sourceCriterionOptionsResult.error) {
    return buildActionState(
      "error",
      "Nao foi possivel carregar as opcoes de rubrica do modelo base da Fisioterapia.",
      {},
      submittedFormValues
    );
  }

  const sourceCriterionOptions =
    (sourceCriterionOptionsResult.data ?? []) as CriterionOptionRow[];
  const sourceGroupsByModelId = new Map<string, GroupRow[]>();
  const sourceCriteriaByGroupId = new Map<string, CriterionRow[]>();
  const sourceOptionsByCriterionId = new Map<string, CriterionOptionRow[]>();

  for (const sourceGroup of sourceGroups) {
    const currentGroups = sourceGroupsByModelId.get(sourceGroup.modelo_avaliacao_curso_id);

    if (currentGroups) {
      currentGroups.push(sourceGroup);
    } else {
      sourceGroupsByModelId.set(sourceGroup.modelo_avaliacao_curso_id, [sourceGroup]);
    }
  }

  for (const sourceCriterion of sourceCriteria) {
    const currentCriteria = sourceCriteriaByGroupId.get(sourceCriterion.grupo_modelo_avaliacao_id);

    if (currentCriteria) {
      currentCriteria.push(sourceCriterion);
    } else {
      sourceCriteriaByGroupId.set(sourceCriterion.grupo_modelo_avaliacao_id, [sourceCriterion]);
    }
  }

  for (const sourceCriterionOption of sourceCriterionOptions) {
    const currentOptions = sourceOptionsByCriterionId.get(
      sourceCriterionOption.criterio_modelo_avaliacao_id
    );

    if (currentOptions) {
      currentOptions.push(sourceCriterionOption);
    } else {
      sourceOptionsByCriterionId.set(sourceCriterionOption.criterio_modelo_avaliacao_id, [
        sourceCriterionOption
      ]);
    }
  }

  const createdModelIds: string[] = [];
  const createdGroupIds: string[] = [];
  const createdCriterionIds: string[] = [];
  const createdDocumentIds: string[] = [];
  const reusableInitialModelSnapshot = reusableInitialModel
    ? { ...reusableInitialModel }
    : null;
  let hasReusedInitialModel = false;

  try {
    for (const sourceModel of sourceModels) {
      const desiredModelCode =
        deriveCourseScopedCode(
          sourceModel.codigo,
          sourceCourse.codigo,
          destinationCourse.codigo
        ) ?? sourceModel.codigo;
      let destinationModelId: string;

      if (reusableInitialModel && !hasReusedInitialModel) {
        const reusableModelCode = await resolveAvailableModelCode(
          desiredModelCode,
          reusableInitialModel.id
        );
        const { error } = await adminClient
          .from("modelos_avaliacao_curso")
          .update({
            codigo: reusableModelCode,
            nome:
              replaceCourseNameInText(
                sourceModel.nome,
                sourceCourse.nome,
                destinationCourse.nome
              ) ?? sourceModel.nome,
            descricao: replaceCourseNameInText(
              sourceModel.descricao,
              sourceCourse.nome,
              destinationCourse.nome
            ),
            versao: sourceModel.versao,
            modalidade: sourceModel.modalidade,
            padrao_lancamento: sourceModel.id === sourceLaunchDefaultModelId,
            ativo: sourceModel.ativo,
            metadata: mergeCopiedMetadata(sourceModel.metadata, {
              source_course_id: sourceCourse.id,
              source_course_code: sourceCourse.codigo,
              source_model_id: sourceModel.id,
              copied_at: new Date().toISOString(),
              copied_by: "copyFisioterapiaConfigurationAction",
              reused_initial_model_id: reusableInitialModel.id
            })
          } satisfies Partial<ModelRow> as never)
          .eq("id", reusableInitialModel.id);

        if (error) {
          throw new Error(
            "Nao foi possivel reaproveitar o modelo inicial vazio ao copiar a base da Fisioterapia."
          );
        }

        destinationModelId = reusableInitialModel.id;
        hasReusedInitialModel = true;
      } else {
        const availableModelCode = await resolveAvailableModelCode(desiredModelCode);
        const modelInsertPayload: ModelInsert = {
          curso_id: destinationCourse.id,
          codigo: availableModelCode,
          nome:
            replaceCourseNameInText(
              sourceModel.nome,
              sourceCourse.nome,
              destinationCourse.nome
            ) ?? sourceModel.nome,
          descricao: replaceCourseNameInText(
            sourceModel.descricao,
            sourceCourse.nome,
            destinationCourse.nome
          ),
          versao: sourceModel.versao,
          modalidade: sourceModel.modalidade,
          padrao_lancamento: sourceModel.id === sourceLaunchDefaultModelId,
          ativo: sourceModel.ativo,
          metadata: mergeCopiedMetadata(sourceModel.metadata, {
            source_course_id: sourceCourse.id,
            source_course_code: sourceCourse.codigo,
            source_model_id: sourceModel.id,
            copied_at: new Date().toISOString(),
            copied_by: "copyFisioterapiaConfigurationAction"
          })
        };

        const insertedModelResult = await adminClient
          .from("modelos_avaliacao_curso")
          .insert(modelInsertPayload as never)
          .select("id")
          .single();
        const insertedModelData = insertedModelResult.data as { id: string } | null;

        if (insertedModelResult.error || !insertedModelData) {
          throw new Error(
            "Nao foi possivel copiar o modelo de avaliacao base para o curso destino."
          );
        }

        destinationModelId = insertedModelData.id;
        createdModelIds.push(destinationModelId);
      }

      for (const sourceGroup of sourceGroupsByModelId.get(sourceModel.id) ?? []) {
        const groupInsertPayload: GroupInsert = {
          modelo_avaliacao_curso_id: destinationModelId,
          codigo: sourceGroup.codigo,
          nome: sourceGroup.nome,
          ordem: sourceGroup.ordem,
          peso_percentual: sourceGroup.peso_percentual,
          ativo: sourceGroup.ativo,
          metadata: mergeCopiedMetadata(sourceGroup.metadata, {
            source_course_id: sourceCourse.id,
            source_course_code: sourceCourse.codigo,
            source_group_id: sourceGroup.id,
            source_model_id: sourceModel.id,
            copied_at: new Date().toISOString(),
            copied_by: "copyFisioterapiaConfigurationAction"
          })
        };

        const insertedGroupResult = await adminClient
          .from("grupos_modelo_avaliacao")
          .insert(groupInsertPayload as never)
          .select("id")
          .single();
        const insertedGroupData = insertedGroupResult.data as { id: string } | null;

        if (insertedGroupResult.error || !insertedGroupData) {
          throw new Error(
            "Nao foi possivel copiar os grupos do modelo base para o curso destino."
          );
        }

        const destinationGroupId = insertedGroupData.id;
        createdGroupIds.push(destinationGroupId);

        for (const sourceCriterion of sourceCriteriaByGroupId.get(sourceGroup.id) ?? []) {
          const criterionInsertPayload: CriterionInsert = {
            grupo_modelo_avaliacao_id: destinationGroupId,
            codigo: sourceCriterion.codigo,
            nome: sourceCriterion.nome,
            descricao: sourceCriterion.descricao,
            ordem: sourceCriterion.ordem,
            peso_percentual: sourceCriterion.peso_percentual,
            escala_maxima: sourceCriterion.escala_maxima,
            ativo: sourceCriterion.ativo,
            metadata: mergeCopiedMetadata(sourceCriterion.metadata, {
              source_course_id: sourceCourse.id,
              source_course_code: sourceCourse.codigo,
              source_group_id: sourceGroup.id,
              source_criterion_id: sourceCriterion.id,
              copied_at: new Date().toISOString(),
              copied_by: "copyFisioterapiaConfigurationAction"
            })
          };

          const insertedCriterionResult = await adminClient
            .from("criterios_modelo_avaliacao")
            .insert(criterionInsertPayload as never)
            .select("id")
            .single();
          const insertedCriterionData =
            insertedCriterionResult.data as { id: string } | null;

          if (insertedCriterionResult.error || !insertedCriterionData) {
            throw new Error(
              "Nao foi possivel copiar os criterios do modelo base para o curso destino."
            );
          }

          createdCriterionIds.push(insertedCriterionData.id);

          for (const sourceCriterionOption of sourceOptionsByCriterionId.get(sourceCriterion.id) ?? []) {
            const criterionOptionInsertPayload: CriterionOptionInsert = {
              criterio_modelo_avaliacao_id: insertedCriterionData.id,
              rotulo: sourceCriterionOption.rotulo,
              descricao: sourceCriterionOption.descricao,
              valor_nota: sourceCriterionOption.valor_nota,
              ordem: sourceCriterionOption.ordem,
              ativo: sourceCriterionOption.ativo
            };

            const insertedCriterionOptionResult = await adminClient
              .from("opcoes_criterio_modelo_avaliacao")
              .insert(criterionOptionInsertPayload as never)
              .select("id")
              .single();

            if (insertedCriterionOptionResult.error || !insertedCriterionOptionResult.data) {
              throw new Error(
                "Nao foi possivel copiar as opcoes de rubrica do modelo base para o curso destino."
              );
            }
          }
        }
      }
    }

    for (const sourceRequiredDocument of sourceRequiredDocuments) {
      const documentInsertPayload: RequiredDocumentInsert = {
        curso_id: destinationCourse.id,
        tipo_documento_id: sourceRequiredDocument.tipo_documento_id,
        codigo: deriveCourseScopedCode(
          sourceRequiredDocument.codigo,
          sourceCourse.codigo,
          destinationCourse.codigo
        ),
        nome_exibicao: replaceCourseNameInText(
          sourceRequiredDocument.nome_exibicao,
          sourceCourse.nome,
          destinationCourse.nome
        ),
        descricao: replaceCourseNameInText(
          sourceRequiredDocument.descricao,
          sourceCourse.nome,
          destinationCourse.nome
        ),
        obrigatorio: sourceRequiredDocument.obrigatorio,
        ordem: sourceRequiredDocument.ordem,
        ativo: sourceRequiredDocument.ativo,
        metadata: mergeCopiedMetadata(sourceRequiredDocument.metadata, {
          source_course_id: sourceCourse.id,
          source_course_code: sourceCourse.codigo,
          source_required_document_id: sourceRequiredDocument.id,
          copied_at: new Date().toISOString(),
          copied_by: "copyFisioterapiaConfigurationAction"
        })
      };

      const insertedRequiredDocumentResult = await adminClient
        .from("documentos_obrigatorios_curso")
        .insert(documentInsertPayload as never)
        .select("id")
        .single();
      const insertedRequiredDocumentData =
        insertedRequiredDocumentResult.data as { id: string } | null;

      if (insertedRequiredDocumentResult.error || !insertedRequiredDocumentData) {
        throw new Error(
          "Nao foi possivel copiar os documentos obrigatorios base para o curso destino."
        );
      }

      createdDocumentIds.push(insertedRequiredDocumentData.id);
    }
  } catch (error) {
    if (createdCriterionIds.length) {
      await adminClient.from("criterios_modelo_avaliacao").delete().in("id", createdCriterionIds);
    }

    if (createdGroupIds.length) {
      await adminClient.from("grupos_modelo_avaliacao").delete().in("id", createdGroupIds);
    }

    if (createdDocumentIds.length) {
      await adminClient.from("documentos_obrigatorios_curso").delete().in("id", createdDocumentIds);
    }

    if (createdModelIds.length) {
      await adminClient.from("modelos_avaliacao_curso").delete().in("id", createdModelIds);
    }

    if (reusableInitialModelSnapshot) {
      await adminClient
        .from("modelos_avaliacao_curso")
        .update({
          codigo: reusableInitialModelSnapshot.codigo,
          nome: reusableInitialModelSnapshot.nome,
          descricao: reusableInitialModelSnapshot.descricao,
          versao: reusableInitialModelSnapshot.versao,
          modalidade: reusableInitialModelSnapshot.modalidade,
          padrao_lancamento: reusableInitialModelSnapshot.padrao_lancamento,
          ativo: reusableInitialModelSnapshot.ativo,
          metadata: reusableInitialModelSnapshot.metadata
        } satisfies Partial<ModelRow> as never)
        .eq("id", reusableInitialModelSnapshot.id);
    }

    return buildActionState(
      "error",
      error instanceof Error
        ? error.message
        : "Nao foi possivel copiar a configuracao base da Fisioterapia.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseConfigurationPaths();

  return buildActionState(
    "success",
    `Base da Fisioterapia duplicada com sucesso para ${destinationCourse.nome} usando ${sourceResolution.label}.`
  );
}
