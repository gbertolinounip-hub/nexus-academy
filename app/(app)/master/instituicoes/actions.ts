"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildInstitutionBrandingStoragePath,
  getInstitutionBrandingFileExtension,
  INSTITUTION_BRANDING_ACCEPTED_EXTENSIONS,
  INSTITUTION_BRANDING_MAX_BYTES,
  removeInstitutionBrandingBinary,
  resolveAcceptedInstitutionBrandingMimeType,
  uploadInstitutionBrandingBinary
} from "@/services/institution-branding";
import type { Database } from "@/types/database";
import type {
  InstitutionBrandingFormValues,
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
    .min(3, "Informe o nome da instituição.")
    .max(160, "O nome da instituição deve ter no máximo 160 caracteres."),
  sigla: z
    .string()
    .trim()
    .max(30, "A sigla deve ter no máximo 30 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug da instituição.")
    .max(120, "O slug deve ter no máximo 120 caracteres.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hifens."),
  cnpj: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{14}$/.test(value), {
      message: "Informe um CNPJ com 14 dígitos ou deixe em branco."
    })
});

const institutionEditSchema = institutionSchema.extend({
  institution_id: z.string().uuid("Instituição inválida."),
  ativo: z.enum(["true", "false"])
});

const institutionBrandingSchema = z.object({
  institution_id: z.string().uuid("Selecione uma instituição válida."),
  nome_exibicao: z
    .string()
    .trim()
    .max(160, "O nome de exibição deve ter no máximo 160 caracteres."),
  remove_logo_principal: z.enum(["true", "false"]).default("false"),
  remove_logo_compacta: z.enum(["true", "false"]).default("false")
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readBooleanFlagField(formData: FormData, name: string) {
  return readStringField(formData, name) === "true";
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

function buildBrandingFormValues(formData: FormData): InstitutionBrandingFormValues {
  return {
    institution_id: readStringField(formData, "institution_id"),
    nome_exibicao: readStringField(formData, "nome_exibicao"),
    remove_logo_principal: readBooleanFlagField(formData, "remove_logo_principal")
      ? "true"
      : "false",
    remove_logo_compacta: readBooleanFlagField(formData, "remove_logo_compacta")
      ? "true"
      : "false"
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
    .select(
      "id, nome, slug, ativo, nome_exibicao, logo_principal_path, logo_compacta_path"
    )
    .eq("id", institutionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    InstitutionRow,
    | "id"
    | "nome"
    | "slug"
    | "ativo"
    | "nome_exibicao"
    | "logo_principal_path"
    | "logo_compacta_path"
  >;
}

async function ensureUniqueInstitutionSlug(slug: string, currentInstitutionId?: string) {
  const adminClient = createSupabaseAdminClient();
  let query = adminClient.from("instituicoes").select("id").eq("slug", slug);

  if (currentInstitutionId) {
    query = query.neq("id", currentInstitutionId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error("Não foi possível validar a unicidade do slug da instituição.");
  }

  const fieldErrors: Record<string, string> = {};

  if (data) {
    fieldErrors.slug = "Já existe uma instituição com este slug.";
  }

  return fieldErrors;
}

function validateInstitutionBrandingFile(file: File | null) {
  if (!file || file.size <= 0) {
    return {
      extension: "",
      mimeType: ""
    };
  }

  if (file.size > INSTITUTION_BRANDING_MAX_BYTES) {
    return {
      extension: "",
      mimeType: "",
      fieldError: "Use uma imagem com até 1 MB."
    };
  }

  const extension = getInstitutionBrandingFileExtension(file.name);

  if (!INSTITUTION_BRANDING_ACCEPTED_EXTENSIONS.includes(extension as never)) {
    return {
      extension: "",
      mimeType: "",
      fieldError: "Use apenas PNG, JPG, JPEG ou WEBP."
    };
  }

  const mimeType = resolveAcceptedInstitutionBrandingMimeType(file, extension);

  if (!mimeType) {
    return {
      extension,
      mimeType: "",
      fieldError: "A imagem enviada não pode ser validada com segurança."
    };
  }

  return {
    extension,
    mimeType
  };
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
      "Revise os campos obrigatórios da instituição.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const uniqueFieldErrors = await ensureUniqueInstitutionSlug(parsedData.data.slug);

  if (Object.keys(uniqueFieldErrors).length) {
    return buildActionState(
      "error",
      "Já existe uma instituição com o slug informado.",
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
        ? "Já existe uma instituição com o slug informado."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateInstitutionManagementPaths();

  return buildActionState(
    "success",
    `Instituição ${parsedData.data.nome} criada com sucesso.`
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
      "Revise os campos obrigatórios da instituição.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const institution = await loadInstitution(parsedData.data.institution_id);

  if (!institution) {
    return buildActionState(
      "error",
      "Não foi possível localizar a instituição selecionada.",
      { institution_id: "Instituição inválida." },
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
      "Já existe outra instituição com o slug informado.",
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
        ? "Já existe outra instituição com o slug informado."
        : error.message,
      {},
      submittedFormValues
    );
  }

  revalidateInstitutionManagementPaths();

  return buildActionState(
    "success",
    `Instituição ${parsedData.data.nome} atualizada com sucesso.`,
    {},
    {
      ...submittedFormValues,
      ativo: parsedData.data.ativo
    }
  );
}

export async function updateInstitutionBrandingAction(
  _previousState: InstitutionManagementActionState<InstitutionBrandingFormValues>,
  formData: FormData
): Promise<InstitutionManagementActionState<InstitutionBrandingFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildBrandingFormValues(formData);
  const parsedData = institutionBrandingSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos da identidade visual da instituição.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const institution = await loadInstitution(parsedData.data.institution_id);

  if (!institution) {
    return buildActionState(
      "error",
      "Não foi possível localizar a instituição selecionada.",
      { institution_id: "Instituição inválida." },
      submittedFormValues
    );
  }

  const primaryLogoFileValue = formData.get("logo_principal_file");
  const compactLogoFileValue = formData.get("logo_compacta_file");
  const primaryLogoFile =
    primaryLogoFileValue instanceof File && primaryLogoFileValue.size > 0
      ? primaryLogoFileValue
      : null;
  const compactLogoFile =
    compactLogoFileValue instanceof File && compactLogoFileValue.size > 0
      ? compactLogoFileValue
      : null;

  const primaryLogoValidation = validateInstitutionBrandingFile(primaryLogoFile);
  const compactLogoValidation = validateInstitutionBrandingFile(compactLogoFile);

  const fieldErrors: Record<string, string> = {};

  if (primaryLogoValidation.fieldError) {
    fieldErrors.logo_principal_file = primaryLogoValidation.fieldError;
  }

  if (compactLogoValidation.fieldError) {
    fieldErrors.logo_compacta_file = compactLogoValidation.fieldError;
  }

  if (Object.keys(fieldErrors).length) {
    return buildActionState(
      "error",
      "Revise os arquivos enviados para a identidade visual.",
      fieldErrors,
      submittedFormValues
    );
  }

  const uploadedStoragePaths: string[] = [];
  let nextPrimaryLogoPath = institution.logo_principal_path ?? null;
  let nextCompactLogoPath = institution.logo_compacta_path ?? null;
  const staleStoragePaths: string[] = [];

  try {
    if (primaryLogoFile) {
      const primaryLogoStoragePath = buildInstitutionBrandingStoragePath({
        institutionId: institution.id,
        variant: "principal",
        fileName:
          primaryLogoFile.name ||
          `logo-principal-${randomUUID()}.${primaryLogoValidation.extension}`
      });

      await uploadInstitutionBrandingBinary({
        storagePath: primaryLogoStoragePath,
        fileBuffer: Buffer.from(await primaryLogoFile.arrayBuffer()),
        contentType: primaryLogoValidation.mimeType
      });

      uploadedStoragePaths.push(primaryLogoStoragePath);

      if (
        institution.logo_principal_path &&
        institution.logo_principal_path !== primaryLogoStoragePath
      ) {
        staleStoragePaths.push(institution.logo_principal_path);
      }

      nextPrimaryLogoPath = primaryLogoStoragePath;
    } else if (
      parsedData.data.remove_logo_principal === "true" &&
      institution.logo_principal_path
    ) {
      staleStoragePaths.push(institution.logo_principal_path);
      nextPrimaryLogoPath = null;
    }

    if (compactLogoFile) {
      const compactLogoStoragePath = buildInstitutionBrandingStoragePath({
        institutionId: institution.id,
        variant: "compacta",
        fileName:
          compactLogoFile.name ||
          `logo-compacta-${randomUUID()}.${compactLogoValidation.extension}`
      });

      await uploadInstitutionBrandingBinary({
        storagePath: compactLogoStoragePath,
        fileBuffer: Buffer.from(await compactLogoFile.arrayBuffer()),
        contentType: compactLogoValidation.mimeType
      });

      uploadedStoragePaths.push(compactLogoStoragePath);

      if (
        institution.logo_compacta_path &&
        institution.logo_compacta_path !== compactLogoStoragePath
      ) {
        staleStoragePaths.push(institution.logo_compacta_path);
      }

      nextCompactLogoPath = compactLogoStoragePath;
    } else if (
      parsedData.data.remove_logo_compacta === "true" &&
      institution.logo_compacta_path
    ) {
      staleStoragePaths.push(institution.logo_compacta_path);
      nextCompactLogoPath = null;
    }
  } catch (error) {
    for (const uploadedStoragePath of uploadedStoragePaths) {
      try {
        await removeInstitutionBrandingBinary(uploadedStoragePath);
      } catch {}
    }

    return buildActionState(
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível enviar as imagens da identidade visual.",
      {},
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const updatePayload: InstitutionUpdate = {
    nome_exibicao: parsedData.data.nome_exibicao || null,
    logo_principal_path: nextPrimaryLogoPath,
    logo_compacta_path: nextCompactLogoPath,
    identidade_visual_atualizada_em: new Date().toISOString()
  };

  const { error } = await adminClient
    .from("instituicoes")
    .update(updatePayload as never)
    .eq("id", institution.id);

  if (error) {
    for (const uploadedStoragePath of uploadedStoragePaths) {
      try {
        await removeInstitutionBrandingBinary(uploadedStoragePath);
      } catch {}
    }

    return buildActionState(
      "error",
      "Não foi possível salvar a identidade visual da instituição.",
      {},
      submittedFormValues
    );
  }

  for (const staleStoragePath of staleStoragePaths) {
    try {
      await removeInstitutionBrandingBinary(staleStoragePath);
    } catch {}
  }

  revalidateInstitutionManagementPaths();

  return buildActionState(
    "success",
    `Identidade visual da instituição ${institution.nome} atualizada com sucesso.`,
    {},
    submittedFormValues
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
