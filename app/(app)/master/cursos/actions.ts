"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  CourseFormValues,
  CourseManagementActionState,
  CourseOfferFormValues
} from "@/app/(app)/master/cursos/state";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type CourseInsert = Database["public"]["Tables"]["cursos"]["Insert"];
type OfferInsert = Database["public"]["Tables"]["ofertas_curso_unidade"]["Insert"];

const courseSchema = z.object({
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  codigo: z
    .string()
    .trim()
    .min(2, "Informe o codigo do curso.")
    .max(24, "O codigo deve ter no maximo 24 caracteres."),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do curso.")
    .max(160, "O nome deve ter no maximo 160 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug do curso.")
    .max(120, "O slug deve ter no maximo 120 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens.")
});

const offerSchema = z.object({
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  unidade_id: z.string().uuid("Selecione uma unidade valida."),
  curso_id: z.string().uuid("Selecione um curso valido."),
  codigo: z
    .string()
    .trim()
    .max(40, "O codigo da oferta deve ter no maximo 40 caracteres."),
  nome_exibicao: z
    .string()
    .trim()
    .max(160, "O nome de exibicao deve ter no maximo 160 caracteres.")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
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

function normalizeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function buildCourseFormValues(formData: FormData): CourseFormValues {
  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    codigo: normalizeCode(readStringField(formData, "codigo")),
    nome: readStringField(formData, "nome"),
    slug: normalizeSlug(readStringField(formData, "slug"))
  };
}

function buildCourseOfferFormValues(formData: FormData): CourseOfferFormValues {
  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    unidade_id: readStringField(formData, "unidade_id"),
    curso_id: readStringField(formData, "curso_id"),
    codigo: normalizeCode(readStringField(formData, "codigo")),
    nome_exibicao: readStringField(formData, "nome_exibicao")
  };
}

function buildActionState<TFormValues>(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TFormValues
): CourseManagementActionState<TFormValues> {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateCourseManagementPaths() {
  revalidatePath("/master");
  revalidatePath("/master/cursos");
  revalidatePath("/master/contextos");
  revalidatePath("/master-curso");
}

async function loadInstitution(institutionId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("instituicoes")
    .select("id, nome")
    .eq("id", institutionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<InstitutionRow, "id" | "nome">;
}

async function ensureUniqueCourse(input: {
  instituicaoId: string;
  codigo: string;
  slug: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [sameCodeResult, sameSlugResult] = await Promise.all([
    adminClient
      .from("cursos")
      .select("id")
      .eq("instituicao_id", input.instituicaoId)
      .eq("codigo", input.codigo)
      .maybeSingle(),
    adminClient
      .from("cursos")
      .select("id")
      .eq("instituicao_id", input.instituicaoId)
      .eq("slug", input.slug)
      .maybeSingle()
  ]);

  if (sameCodeResult.error || sameSlugResult.error) {
    throw new Error("Nao foi possivel validar a unicidade do curso.");
  }

  const fieldErrors: Record<string, string> = {};

  if (sameCodeResult.data) {
    fieldErrors.codigo = "Ja existe um curso com este codigo nesta instituicao.";
  }

  if (sameSlugResult.data) {
    fieldErrors.slug = "Ja existe um curso com este slug nesta instituicao.";
  }

  return fieldErrors;
}

async function ensureOfferCreationSafety(input: {
  instituicaoId: string;
  unidadeId: string;
  cursoId: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [unitResult, courseResult, duplicateOfferResult] = await Promise.all([
    adminClient
      .from("unidades")
      .select("id, nome, instituicao_id")
      .eq("id", input.unidadeId)
      .maybeSingle(),
    adminClient
      .from("cursos")
      .select("id, nome, instituicao_id")
      .eq("id", input.cursoId)
      .maybeSingle(),
    adminClient
      .from("ofertas_curso_unidade")
      .select("id")
      .eq("unidade_id", input.unidadeId)
      .eq("curso_id", input.cursoId)
      .maybeSingle()
  ]);

  if (unitResult.error || courseResult.error || duplicateOfferResult.error) {
    throw new Error("Nao foi possivel validar a criacao da oferta.");
  }

  const unitRow = (unitResult.data ?? null) as Pick<
    UnitRow,
    "id" | "nome" | "instituicao_id"
  > | null;
  const courseRow = (courseResult.data ?? null) as Pick<
    CourseRow,
    "id" | "nome" | "instituicao_id"
  > | null;
  const fieldErrors: Record<string, string> = {};

  if (!unitRow) {
    fieldErrors.unidade_id = "Selecione uma unidade valida.";
  }

  if (!courseRow) {
    fieldErrors.curso_id = "Selecione um curso valido.";
  }

  if (unitRow && unitRow.instituicao_id !== input.instituicaoId) {
    fieldErrors.unidade_id = "A unidade precisa pertencer a instituicao selecionada.";
  }

  if (courseRow && courseRow.instituicao_id !== input.instituicaoId) {
    fieldErrors.curso_id = "O curso precisa pertencer a instituicao selecionada.";
  }

  if (duplicateOfferResult.data) {
    fieldErrors.curso_id = "Ja existe oferta deste curso para a unidade selecionada.";
  }

  return {
    fieldErrors,
    unitRow,
    courseRow
  };
}

export async function createCourseAction(
  _previousState: CourseManagementActionState<CourseFormValues>,
  formData: FormData
): Promise<CourseManagementActionState<CourseFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCourseFormValues(formData);
  const parsedData = courseSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios do curso.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const institution = await loadInstitution(parsedData.data.instituicao_id);

  if (!institution) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar a instituicao selecionada.",
      { instituicao_id: "Selecione uma instituicao valida." },
      submittedFormValues
    );
  }

  const uniqueFieldErrors = await ensureUniqueCourse({
    instituicaoId: parsedData.data.instituicao_id,
    codigo: parsedData.data.codigo,
    slug: parsedData.data.slug
  });

  if (Object.keys(uniqueFieldErrors).length) {
    return buildActionState(
      "error",
      "Ja existe um curso com os dados informados nesta instituicao.",
      uniqueFieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const courseInsertPayload: CourseInsert = {
    instituicao_id: parsedData.data.instituicao_id,
    codigo: parsedData.data.codigo,
    nome: parsedData.data.nome,
    slug: parsedData.data.slug,
    ativo: true,
    metadata: {}
  };

  const { error } = await adminClient.from("cursos").insert(courseInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.code === "23505"
        ? "Ja existe um curso com o codigo ou slug informado nesta instituicao."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateCourseManagementPaths();

  return buildActionState(
    "success",
    `Curso ${parsedData.data.nome} criado com sucesso em ${institution.nome}.`
  );
}

export async function createCourseOfferAction(
  _previousState: CourseManagementActionState<CourseOfferFormValues>,
  formData: FormData
): Promise<CourseManagementActionState<CourseOfferFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCourseOfferFormValues(formData);
  const parsedData = offerSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios da oferta.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const institution = await loadInstitution(parsedData.data.instituicao_id);

  if (!institution) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar a instituicao selecionada.",
      { instituicao_id: "Selecione uma instituicao valida." },
      submittedFormValues
    );
  }

  const safety = await ensureOfferCreationSafety({
    instituicaoId: parsedData.data.instituicao_id,
    unidadeId: parsedData.data.unidade_id,
    cursoId: parsedData.data.curso_id
  });

  if (Object.keys(safety.fieldErrors).length) {
    return buildActionState(
      "error",
      "Nao foi possivel criar a oferta com os dados informados.",
      safety.fieldErrors,
      submittedFormValues
    );
  }

  const displayName =
    parsedData.data.nome_exibicao ||
    `${safety.courseRow?.nome ?? "Curso"} - ${safety.unitRow?.nome ?? "Unidade"}`;
  const adminClient = createSupabaseAdminClient();
  const offerInsertPayload: OfferInsert = {
    instituicao_id: parsedData.data.instituicao_id,
    unidade_id: parsedData.data.unidade_id,
    curso_id: parsedData.data.curso_id,
    codigo: parsedData.data.codigo || null,
    nome_exibicao: displayName,
    ativo: true,
    metadata: {}
  };

  const { error } = await adminClient
    .from("ofertas_curso_unidade")
    .insert(offerInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.code === "23505"
        ? "Ja existe oferta deste curso para a unidade selecionada."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateCourseManagementPaths();

  return buildActionState(
    "success",
    `Oferta ${displayName} criada com sucesso em ${institution.nome}.`
  );
}

export async function toggleCourseStatusAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const courseId = readStringField(formData, "course_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(courseId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("cursos")
    .update({ ativo: nextStatusRaw === "true" } satisfies Pick<CourseRow, "ativo"> as never)
    .eq("id", courseId);

  if (!error) {
    revalidateCourseManagementPaths();
  }
}

export async function toggleCourseOfferStatusAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const offerId = readStringField(formData, "offer_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(offerId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("ofertas_curso_unidade")
    .update({ ativo: nextStatusRaw === "true" } satisfies Pick<OfferRow, "ativo"> as never)
    .eq("id", offerId);

  if (!error) {
    revalidateCourseManagementPaths();
  }
}
