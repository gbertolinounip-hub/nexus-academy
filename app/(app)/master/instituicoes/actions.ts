"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  InstitutionEditFormValues,
  InstitutionFormValues,
  InstitutionManagementActionState
} from "@/app/(app)/master/instituicoes/state";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type InstitutionInsert = Database["public"]["Tables"]["instituicoes"]["Insert"];
type InstitutionUpdate = Database["public"]["Tables"]["instituicoes"]["Update"];

const institutionSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da instituicao.")
    .max(160, "O nome da instituicao deve ter no maximo 160 caracteres."),
  sigla: z
    .string()
    .trim()
    .max(30, "A sigla deve ter no maximo 30 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug da instituicao.")
    .max(120, "O slug deve ter no maximo 120 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minusculas, numeros e hifens."),
  cnpj: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{14}$/.test(value), {
      message: "Informe um CNPJ com 14 digitos ou deixe em branco."
    })
});

const institutionEditSchema = institutionSchema.extend({
  institution_id: z.string().uuid("Instituicao invalida."),
  ativo: z.enum(["true", "false"])
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
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

function normalizeAcronym(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function normalizeCnpj(value: string) {
  return value.replace(/\D+/g, "");
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

function buildCreateFormValues(formData: FormData): InstitutionFormValues {
  return {
    nome: readStringField(formData, "nome"),
    sigla: normalizeAcronym(readStringField(formData, "sigla")),
    slug: normalizeSlug(readStringField(formData, "slug")),
    cnpj: normalizeCnpj(readStringField(formData, "cnpj"))
  };
}

function buildEditFormValues(formData: FormData): InstitutionEditFormValues {
  const activeValue = readStringField(formData, "ativo");

  return {
    institution_id: readStringField(formData, "institution_id"),
    nome: readStringField(formData, "nome"),
    sigla: normalizeAcronym(readStringField(formData, "sigla")),
    slug: normalizeSlug(readStringField(formData, "slug")),
    cnpj: normalizeCnpj(readStringField(formData, "cnpj")),
    ativo: activeValue === "false" ? "false" : "true"
  };
}

function buildActionState<TFormValues>(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TFormValues
): InstitutionManagementActionState<TFormValues> {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateInstitutionManagementPaths() {
  revalidatePath("/master");
  revalidatePath("/master/contextos");
  revalidatePath("/master/instituicoes");
  revalidatePath("/master/cursos");
  revalidatePath("/master/semestres");
  revalidatePath("/master/turmas");
  revalidatePath("/master/matriculas");
  revalidatePath("/master/unidades");
  revalidatePath("/master-curso");
}

async function loadInstitution(institutionId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("instituicoes")
    .select("id, nome, slug, ativo")
    .eq("id", institutionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<InstitutionRow, "id" | "nome" | "slug" | "ativo">;
}

async function ensureUniqueInstitutionSlug(slug: string, currentInstitutionId?: string) {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient.from("instituicoes").select("id").eq("slug", slug);

  if (currentInstitutionId) {
    query = query.neq("id", currentInstitutionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error("Nao foi possivel validar a unicidade do slug da instituicao.");
  }

  const fieldErrors: Record<string, string> = {};

  if (data) {
    fieldErrors.slug = "Ja existe uma instituicao com este slug.";
  }

  return fieldErrors;
}

export async function createInstitutionAction(
  _previousState: InstitutionManagementActionState<InstitutionFormValues>,
  formData: FormData
): Promise<InstitutionManagementActionState<InstitutionFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCreateFormValues(formData);
  const parsedData = institutionSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios da instituicao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const uniqueFieldErrors = await ensureUniqueInstitutionSlug(parsedData.data.slug);

  if (Object.keys(uniqueFieldErrors).length) {
    return buildActionState(
      "error",
      "Ja existe uma instituicao com o slug informado.",
      uniqueFieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const institutionInsertPayload: InstitutionInsert = {
    nome: parsedData.data.nome,
    sigla: parsedData.data.sigla || null,
    slug: parsedData.data.slug,
    cnpj: parsedData.data.cnpj || null,
    ativo: true,
    metadata: {}
  };

  const { error } = await adminClient
    .from("instituicoes")
    .insert(institutionInsertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.code === "23505"
        ? "Ja existe uma instituicao com o slug informado."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateInstitutionManagementPaths();

  return buildActionState(
    "success",
    `Instituicao ${parsedData.data.nome} criada com sucesso.`
  );
}

export async function updateInstitutionAction(
  _previousState: InstitutionManagementActionState<InstitutionEditFormValues>,
  formData: FormData
): Promise<InstitutionManagementActionState<InstitutionEditFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildEditFormValues(formData);
  const parsedData = institutionEditSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios da instituicao.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const institution = await loadInstitution(parsedData.data.institution_id);

  if (!institution) {
    return buildActionState(
      "error",
      "Nao foi possivel localizar a instituicao selecionada.",
      { institution_id: "Instituicao invalida." },
      submittedFormValues
    );
  }

  const uniqueFieldErrors = await ensureUniqueInstitutionSlug(
    parsedData.data.slug,
    parsedData.data.institution_id
  );

  if (Object.keys(uniqueFieldErrors).length) {
    return buildActionState(
      "error",
      "Ja existe outra instituicao com o slug informado.",
      uniqueFieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const updatePayload: InstitutionUpdate = {
    nome: parsedData.data.nome,
    sigla: parsedData.data.sigla || null,
    slug: parsedData.data.slug,
    cnpj: parsedData.data.cnpj || null,
    ativo: parsedData.data.ativo === "true"
  };

  const { error } = await adminClient
    .from("instituicoes")
    .update(updatePayload as never)
    .eq("id", parsedData.data.institution_id);

  if (error) {
    return buildActionState(
      "error",
      error.code === "23505"
        ? "Ja existe outra instituicao com o slug informado."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateInstitutionManagementPaths();

  return buildActionState(
    "success",
    `Instituicao ${parsedData.data.nome} atualizada com sucesso.`,
    {},
    {
      ...submittedFormValues,
      ativo: parsedData.data.ativo
    }
  );
}

export async function toggleInstitutionStatusAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const institutionId = readStringField(formData, "institution_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(institutionId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const institution = await loadInstitution(institutionId);

  if (!institution) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("instituicoes")
    .update({ ativo: nextStatusRaw === "true" } as never)
    .eq("id", institutionId);

  if (error) {
    return;
  }

  revalidateInstitutionManagementPaths();
}
