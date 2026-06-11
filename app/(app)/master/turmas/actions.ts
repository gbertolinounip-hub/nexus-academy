"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  ClassManagementActionState,
  MasterClassFormValues
} from "@/app/(app)/master/turmas/state";

type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassInsert = Database["public"]["Tables"]["turmas"]["Insert"];

const classSchema = z.object({
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  curso_id: z.string().uuid("Selecione um curso valido."),
  oferta_curso_unidade_id: z.string().uuid("Selecione uma oferta valida."),
  semestre_id: z.string().uuid("Selecione um semestre valido."),
  codigo: z
    .string()
    .trim()
    .min(2, "Informe o codigo da turma.")
    .max(30, "O codigo da turma deve ter no maximo 30 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da turma.")
    .max(160, "O nome da turma deve ter no maximo 160 caracteres."),
  area_estagio: z
    .string()
    .trim()
    .min(2, "Informe a area ou descricao operacional da turma.")
    .max(160, "A area da turma deve ter no maximo 160 caracteres."),
  capacidade: z
    .string()
    .trim()
    .refine((value) => !value || /^\d+$/.test(value), {
      message: "Informe uma capacidade numerica valida."
    })
    .refine((value) => !value || Number(value) > 0, {
      message: "A capacidade deve ser maior que zero."
    }),
  ativa: z.enum(["true", "false"])
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

function buildClassFormValues(formData: FormData): MasterClassFormValues {
  const activeValue = readStringField(formData, "ativa");

  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    curso_id: readStringField(formData, "curso_id"),
    oferta_curso_unidade_id: readStringField(formData, "oferta_curso_unidade_id"),
    semestre_id: readStringField(formData, "semestre_id"),
    codigo: readStringField(formData, "codigo").toUpperCase(),
    nome: readStringField(formData, "nome"),
    area_estagio: readStringField(formData, "area_estagio"),
    capacidade: readStringField(formData, "capacidade"),
    ativa: activeValue === "false" ? "false" : "true"
  };
}

function buildActionState(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: MasterClassFormValues
): ClassManagementActionState {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateClassManagementPaths() {
  revalidatePath("/master");
  revalidatePath("/master/contextos");
  revalidatePath("/master/semestres");
  revalidatePath("/master/turmas");
  revalidatePath("/master-curso");
  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
}

async function loadOffer(offerId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("ofertas_curso_unidade")
    .select("id, instituicao_id, unidade_id, curso_id, nome_exibicao")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    OfferRow,
    "id" | "instituicao_id" | "unidade_id" | "curso_id" | "nome_exibicao"
  >;
}

async function loadSemester(semesterId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("semestres")
    .select("id, unidade_id, oferta_curso_unidade_id, codigo, nome, status")
    .eq("id", semesterId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    SemesterRow,
    "id" | "unidade_id" | "oferta_curso_unidade_id" | "codigo" | "nome" | "status"
  >;
}

async function validateClassCreation(input: {
  instituicaoId: string;
  cursoId: string;
  offerId: string;
  semesterId: string;
  code: string;
  name: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [offerRow, semesterRow, duplicateCodeResult, duplicateNameResult] = await Promise.all([
    loadOffer(input.offerId),
    loadSemester(input.semesterId),
    adminClient
      .from("turmas")
      .select("id")
      .eq("semestre_id", input.semesterId)
      .eq("codigo", input.code)
      .limit(1),
    adminClient
      .from("turmas")
      .select("id")
      .eq("semestre_id", input.semesterId)
      .eq("nome", input.name)
      .limit(1)
  ]);

  if (duplicateCodeResult.error || duplicateNameResult.error) {
    throw new Error("Nao foi possivel validar a criacao da turma.");
  }

  const fieldErrors: Record<string, string> = {};

  if (!offerRow) {
    fieldErrors.oferta_curso_unidade_id = "Selecione uma oferta valida.";
  }

  if (!semesterRow) {
    fieldErrors.semestre_id = "Selecione um semestre valido.";
  }

  if (!offerRow || !semesterRow) {
    return {
      fieldErrors,
      offerRow,
      semesterRow
    };
  }

  if (offerRow.instituicao_id !== input.instituicaoId) {
    fieldErrors.instituicao_id =
      "A oferta precisa pertencer a instituicao selecionada.";
  }

  if (offerRow.curso_id !== input.cursoId) {
    fieldErrors.curso_id = "A oferta precisa pertencer ao curso selecionado.";
  }

  if (semesterRow.oferta_curso_unidade_id !== offerRow.id) {
    fieldErrors.semestre_id = "O semestre precisa pertencer a oferta selecionada.";
  }

  if ((duplicateCodeResult.data ?? []).length > 0) {
    fieldErrors.codigo = "Ja existe uma turma com este codigo no semestre selecionado.";
  }

  if ((duplicateNameResult.data ?? []).length > 0) {
    fieldErrors.nome = "Ja existe uma turma com este nome no semestre selecionado.";
  }

  return {
    fieldErrors,
    offerRow,
    semesterRow
  };
}

export async function createMasterClassAction(
  _previousState: ClassManagementActionState,
  formData: FormData
): Promise<ClassManagementActionState> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildClassFormValues(formData);
  const parsedData = classSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios da turma.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const validation = await validateClassCreation({
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id,
    offerId: parsedData.data.oferta_curso_unidade_id,
    semesterId: parsedData.data.semestre_id,
    code: parsedData.data.codigo,
    name: parsedData.data.nome
  });

  if (
    Object.keys(validation.fieldErrors).length ||
    !validation.offerRow ||
    !validation.semesterRow
  ) {
    return buildActionState(
      "error",
      "Nao foi possivel criar a turma com os dados informados.",
      validation.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const insertPayload: ClassInsert = {
    semestre_id: validation.semesterRow.id,
    oferta_curso_unidade_id: validation.semesterRow.oferta_curso_unidade_id,
    codigo: parsedData.data.codigo,
    nome: parsedData.data.nome,
    area_estagio: parsedData.data.area_estagio,
    area_estagio_id: null,
    coordenador_id: null,
    capacidade: parsedData.data.capacidade ? Number(parsedData.data.capacidade) : null,
    ativa: parsedData.data.ativa === "true"
  };

  const { error } = await adminClient.from("turmas").insert(insertPayload as never);

  if (error) {
    const isDuplicate =
      error.code === "23505" || /duplicate key|unique/i.test(error.message);

    return buildActionState(
      "error",
      isDuplicate
        ? "Ja existe uma turma com este codigo ou nome no semestre selecionado."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateClassManagementPaths();

  return buildActionState(
    "success",
    `Turma ${parsedData.data.nome} criada com sucesso em ${validation.semesterRow.codigo}.`
  );
}
