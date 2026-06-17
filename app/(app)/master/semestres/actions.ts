"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  MasterSemesterFormValues,
  SemesterManagementActionState
} from "@/app/(app)/master/semestres/state";

type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterInsert = Database["public"]["Tables"]["semestres"]["Insert"];

const semesterSchema = z
  .object({
    instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
    curso_id: z.string().uuid("Selecione um curso valido."),
    oferta_curso_unidade_id: z.string().uuid("Selecione uma oferta valida."),
    codigo: z
      .string()
      .trim()
      .regex(/^\d{4}\/[12]$/, "Use o formato AAAA/1 ou AAAA/2."),
    nome: z
      .string()
      .trim()
      .min(3, "Informe um nome para o semestre.")
      .max(80, "O nome do semestre deve ter no maximo 80 caracteres."),
    data_inicio: z.iso.date("Informe uma data de inicio valida."),
    data_fim: z.iso.date("Informe uma data de fim valida."),
    status: z.enum(["planejado", "ativo", "encerrado"])
  })
  .refine((value) => value.data_inicio < value.data_fim, {
    path: ["data_fim"],
    message: "A data de fim deve ser posterior a data de inicio."
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

function buildSemesterFormValues(formData: FormData): MasterSemesterFormValues {
  const status = readStringField(formData, "status");

  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    curso_id: readStringField(formData, "curso_id"),
    oferta_curso_unidade_id: readStringField(formData, "oferta_curso_unidade_id"),
    codigo: readStringField(formData, "codigo"),
    nome: readStringField(formData, "nome"),
    data_inicio: readStringField(formData, "data_inicio"),
    data_fim: readStringField(formData, "data_fim"),
    status:
      status === "ativo" || status === "encerrado" ? status : "planejado"
  };
}

function buildActionState(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: MasterSemesterFormValues
): SemesterManagementActionState {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateSemesterManagementPaths() {
  revalidatePath("/master");
  revalidatePath("/master/contextos");
  revalidatePath("/master/unidades");
  revalidatePath("/master/semestres");
  revalidatePath("/master-curso");
  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
}

async function loadOffer(offerId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("ofertas_curso_unidade")
    .select("id, instituicao_id, unidade_id, curso_id, nome_exibicao, ativo")
    .eq("id", offerId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    OfferRow,
    "id" | "instituicao_id" | "unidade_id" | "curso_id" | "nome_exibicao" | "ativo"
  >;
}

async function validateSemesterCreation(input: {
  instituicaoId: string;
  cursoId: string;
  offerId: string;
  code: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [offerRow, duplicateCodeResult] = await Promise.all([
    loadOffer(input.offerId),
    adminClient
      .from("semestres")
      .select("id")
      .eq("oferta_curso_unidade_id", input.offerId)
      .eq("codigo", input.code)
      .limit(1)
  ]);

  if (duplicateCodeResult.error) {
    throw new Error("Nao foi possivel validar a criacao do semestre.");
  }

  const fieldErrors: Record<string, string> = {};

  if (!offerRow) {
    fieldErrors.oferta_curso_unidade_id = "Selecione uma oferta valida.";
    return {
      fieldErrors,
      offerRow: null
    };
  }

  if (offerRow.instituicao_id !== input.instituicaoId) {
    fieldErrors.instituicao_id =
      "A oferta precisa pertencer a instituicao selecionada.";
  }

  if (offerRow.curso_id !== input.cursoId) {
    fieldErrors.curso_id = "A oferta precisa pertencer ao curso selecionado.";
  }

  if ((duplicateCodeResult.data ?? []).length > 0) {
    fieldErrors.codigo = "Ja existe um semestre cadastrado com este codigo nesta oferta.";
  }

  return {
    fieldErrors,
    offerRow
  };
}

export async function createMasterSemesterAction(
  _previousState: SemesterManagementActionState,
  formData: FormData
): Promise<SemesterManagementActionState> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildSemesterFormValues(formData);
  const parsedData = semesterSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios do semestre.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const validation = await validateSemesterCreation({
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id,
    offerId: parsedData.data.oferta_curso_unidade_id,
    code: parsedData.data.codigo
  });

  if (Object.keys(validation.fieldErrors).length || !validation.offerRow) {
    return buildActionState(
      "error",
      "Nao foi possivel criar o semestre com os dados informados.",
      validation.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const insertPayload: SemesterInsert = {
    unidade_id: validation.offerRow.unidade_id,
    oferta_curso_unidade_id: validation.offerRow.id,
    codigo: parsedData.data.codigo,
    nome: parsedData.data.nome,
    data_inicio: parsedData.data.data_inicio,
    data_fim: parsedData.data.data_fim,
    status: parsedData.data.status
  };

  const { error } = await adminClient.from("semestres").insert(insertPayload as never);

  if (error) {
    const isDuplicateCode =
      error.code === "23505" || /duplicate key|unique/i.test(error.message);

    return buildActionState(
      "error",
      isDuplicateCode
        ? "Ja existe um semestre cadastrado com este codigo nesta oferta."
        : error.message,
      isDuplicateCode
        ? { codigo: "Use um codigo de semestre ainda nao cadastrado nesta oferta." }
        : {},
      submittedFormValues
    );
  }

  revalidateSemesterManagementPaths();

  return buildActionState(
    "success",
    `Semestre ${parsedData.data.codigo} criado com sucesso para ${
      validation.offerRow.nome_exibicao ?? "a oferta selecionada"
    }.`
  );
}
