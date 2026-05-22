"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  MasterActionState,
  MasterUserProfileFormValues,
  UnitCoordinatorFormValues,
  UnitCoordinatorProfileFormValues,
  UnitFormValues
} from "@/app/(app)/master/state";

type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type CoordinatorRow = Database["public"]["Tables"]["coordenadores"]["Row"];
type UserInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type UnitInsert = Database["public"]["Tables"]["unidades"]["Insert"];
type UnitUpdate = Database["public"]["Tables"]["unidades"]["Update"];
type CoordinatorInsert = Database["public"]["Tables"]["coordenadores"]["Insert"];

const unitSchema = z.object({
  unit_id: z.string().trim(),
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da unidade.")
    .max(120, "O nome da unidade deve ter no máximo 120 caracteres."),
  sigla: z
    .string()
    .trim()
    .min(2, "Informe a sigla da unidade.")
    .max(20, "A sigla da unidade deve ter no máximo 20 caracteres."),
  slug: z
    .string()
    .trim()
    .min(3, "Informe o slug da unidade.")
    .max(80, "O slug da unidade deve ter no máximo 80 caracteres.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use apenas letras minúsculas, números e hífens no slug."
    ),
  cidade: z
    .string()
    .trim()
    .max(80, "A cidade deve ter no máximo 80 caracteres."),
  estado: z
    .string()
    .trim()
    .max(2, "Use apenas a sigla do estado.")
});

const coordinatorSchema = z.object({
  coordinator_id: z.string().trim().optional(),
  unit_id: z.string().uuid("Unidade inválida."),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do coordenador.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail válido para o coordenador."),
  senha: z
    .string()
    .min(8, "A senha deve ter ao menos 8 caracteres.")
    .max(72, "A senha deve ter no máximo 72 caracteres."),
  cargo: z
    .string()
    .trim()
    .min(3, "Informe o cargo do coordenador.")
    .max(120, "O cargo deve ter no máximo 120 caracteres."),
  replace_existing: z.enum(["true", "false"]).default("false")
});

const coordinatorProfileSchema = z.object({
  coordinator_id: z.string().uuid("Coordenador inválido."),
  unit_id: z.string().uuid("Unidade inválida."),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do coordenador.")
    .max(160, "O nome deve ter no máximo 160 caracteres."),
  cargo: z
    .string()
    .trim()
    .min(3, "Informe o cargo do coordenador.")
    .max(120, "O cargo deve ter no máximo 120 caracteres.")
});

const masterUserProfileSchema = z.object({
  user_id: z.string().uuid("Usuário inválido."),
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do usuário.")
    .max(160, "O nome deve ter no máximo 160 caracteres.")
});

function normalizeFieldErrors(
  fieldErrors: Record<string, string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([field, errors]) => [field, errors?.[0]])
      .filter((entry): entry is [string, string] => Boolean(entry[1]))
  );
}

function buildMasterActionState<TFormValues>(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TFormValues
): MasterActionState<TFormValues> {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildUnitFormValues(formData: FormData): UnitFormValues {
  return {
    unit_id: readStringField(formData, "unit_id"),
    nome: readStringField(formData, "nome"),
    sigla: readStringField(formData, "sigla"),
    slug: readStringField(formData, "slug").toLowerCase(),
    cidade: readStringField(formData, "cidade"),
    estado: readStringField(formData, "estado").toUpperCase()
  };
}

function buildCoordinatorFormValues(formData: FormData): UnitCoordinatorFormValues {
  return {
    coordinator_id: readStringField(formData, "coordinator_id"),
    unit_id: readStringField(formData, "unit_id"),
    nome_completo: readStringField(formData, "nome_completo"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha"),
    cargo: readStringField(formData, "cargo"),
    replace_existing: readStringField(formData, "replace_existing") || "false"
  };
}

function buildCoordinatorProfileFormValues(
  formData: FormData
): UnitCoordinatorProfileFormValues {
  return {
    coordinator_id: readStringField(formData, "coordinator_id"),
    unit_id: readStringField(formData, "unit_id"),
    nome_completo: readStringField(formData, "nome_completo"),
    cargo: readStringField(formData, "cargo")
  };
}

function buildMasterUserProfileFormValues(formData: FormData): MasterUserProfileFormValues {
  return {
    user_id: readStringField(formData, "user_id"),
    nome_completo: readStringField(formData, "nome_completo")
  };
}

function revalidateMasterPaths(unitId?: string) {
  revalidatePath("/master");
  revalidatePath("/master/unidades");
  revalidatePath("/master/coordenadores");
  revalidatePath("/master/usuarios");
  revalidatePath("/master/auditoria");

  if (unitId) {
    revalidatePath(`/master/unidades/${unitId}`);
  }
}

async function loadProfileMap() {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await (adminClient.from("perfis") as any).select("*");

  if (error) {
    throw new Error("Não foi possível carregar os perfis de acesso.");
  }

  return new Map(
    ((data ?? []) as ProfileRow[]).map((profile) => [profile.codigo, profile])
  );
}

async function cleanupCreatedCoordinatorData(input: {
  authUserId: string | null;
  domainUserId: string | null;
}) {
  const adminClient = createSupabaseAdminClient();

  if (input.domainUserId) {
    await (adminClient.from("coordenadores") as any)
      .delete()
      .eq("usuario_id", input.domainUserId);
    await (adminClient.from("usuarios") as any)
      .delete()
      .eq("id", input.domainUserId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

async function ensureUniqueUnitFields(input: {
  unitId: string;
  slug: string;
  sigla: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [slugResult, siglaResult] = await Promise.all([
    adminClient
      .from("unidades")
      .select("id")
      .eq("slug", input.slug)
      .maybeSingle(),
    adminClient
      .from("unidades")
      .select("id")
      .eq("sigla", input.sigla)
      .maybeSingle()
  ]);

  if (slugResult.error || siglaResult.error) {
    throw new Error("Não foi possível validar a unicidade da unidade.");
  }

  const slugUnit = (slugResult.data ?? null) as Pick<UnitRow, "id"> | null;
  const siglaUnit = (siglaResult.data ?? null) as Pick<UnitRow, "id"> | null;
  const fieldErrors: Record<string, string> = {};

  if (slugUnit && slugUnit.id !== input.unitId) {
    fieldErrors.slug = "Já existe uma unidade com este slug.";
  }

  if (siglaUnit && siglaUnit.id !== input.unitId) {
    fieldErrors.sigla = "Já existe uma unidade com esta sigla.";
  }

  return fieldErrors;
}

async function loadUnitCoordinatorRoster(unitId: string) {
  const adminClient = createSupabaseAdminClient();
  const coordinatorsResult = await adminClient
    .from("coordenadores")
    .select("*")
    .eq("unidade_id", unitId)
    .order("created_at", { ascending: false });

  if (coordinatorsResult.error) {
    throw new Error("Não foi possível consultar os coordenadores da unidade.");
  }

  const coordinators = (coordinatorsResult.data ?? []) as CoordinatorRow[];
  const coordinatorIds = coordinators.map((coordinator) => coordinator.usuario_id);
  const usersResult = coordinatorIds.length
    ? await adminClient
        .from("usuarios")
        .select("id, ativo, nome_completo, email")
        .in("id", coordinatorIds)
    : { data: [], error: null };

  if (usersResult.error) {
    throw new Error("Não foi possível consultar os acessos dos coordenadores.");
  }

  const userMap = new Map(
    (((usersResult.data ?? []) as Array<
      Pick<UserRow, "id" | "ativo" | "nome_completo" | "email">
    >)).map((user) => [user.id, user])
  );

  const sortedCoordinators = [...coordinators].sort((left, right) => {
    const leftActive = userMap.get(left.usuario_id)?.ativo ? 1 : 0;
    const rightActive = userMap.get(right.usuario_id)?.ativo ? 1 : 0;

    if (leftActive !== rightActive) {
      return rightActive - leftActive;
    }

    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });

  return {
    coordinators: sortedCoordinators,
    userMap
  };
}

async function ensureUnitExists(unitId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("unidades")
    .select("id, nome")
    .eq("id", unitId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<UnitRow, "id" | "nome">;
}

async function createCoordinatorAccount(input: {
  values: UnitCoordinatorFormValues;
  replaceExisting: boolean;
}) {
  const adminClient = createSupabaseAdminClient();
  const [profileMap, unitRow, roster] = await Promise.all([
    loadProfileMap(),
    ensureUnitExists(input.values.unit_id),
    loadUnitCoordinatorRoster(input.values.unit_id)
  ]);

  if (!unitRow) {
    return {
      ok: false as const,
      state: buildMasterActionState<UnitCoordinatorFormValues>(
        "error",
        "Não foi possível localizar a unidade selecionada.",
        { unit_id: "Selecione uma unidade válida." },
        input.values
      )
    };
  }

  const activeCoordinatorIds = roster.coordinators
    .filter((coordinator) => roster.userMap.get(coordinator.usuario_id)?.ativo)
    .map((coordinator) => coordinator.usuario_id);

  if (!input.replaceExisting && activeCoordinatorIds.length > 0) {
    return {
      ok: false as const,
      state: buildMasterActionState<UnitCoordinatorFormValues>(
        "error",
        "Esta unidade já possui coordenador responsável ativo.",
        { unit_id: "A unidade já possui coordenador responsável ativo." },
        input.values
      )
    };
  }

  const coordinatorProfile = profileMap.get("coordenador");

  if (!coordinatorProfile) {
    return {
      ok: false as const,
      state: buildMasterActionState<UnitCoordinatorFormValues>(
        "error",
        "O perfil de coordenador não está configurado no banco.",
        {},
        input.values
      )
    };
  }

  let authUserId: string | null = null;
  let domainUserId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: input.values.email,
        password: input.values.senha,
        email_confirm: true
      });

    if (authError || !createdAuthUser.user) {
      return {
        ok: false as const,
        state: buildMasterActionState<UnitCoordinatorFormValues>(
          "error",
          authError?.message ?? "Não foi possível criar o acesso do coordenador no Auth.",
          {
            email: "Não foi possível criar este e-mail no sistema de autenticação."
          },
          input.values
        )
      };
    }

    authUserId = createdAuthUser.user.id;
    domainUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: coordinatorProfile.id,
      unidade_id: input.values.unit_id,
      email: input.values.email,
      nome_completo: input.values.nome_completo,
      ativo: true
    };

    const { error: userInsertError } = await (adminClient.from("usuarios") as any).insert(
      userInsertPayload
    );

    if (userInsertError) {
      throw new Error(userInsertError.message);
    }

    const coordinatorInsertPayload: CoordinatorInsert = {
      usuario_id: createdAuthUser.user.id,
      unidade_id: input.values.unit_id,
      cargo: input.values.cargo
    };

    const { error: coordinatorInsertError } = await (adminClient
      .from("coordenadores") as any)
      .insert(coordinatorInsertPayload);

    if (coordinatorInsertError) {
      throw new Error(coordinatorInsertError.message);
    }

    if (input.replaceExisting && activeCoordinatorIds.length) {
      const { error: deactivateError } = await (adminClient.from("usuarios") as any)
        .update({ ativo: false } satisfies Pick<UserRow, "ativo">)
        .in("id", activeCoordinatorIds);

      if (deactivateError) {
        throw new Error(deactivateError.message);
      }
    }
  } catch (error) {
    await cleanupCreatedCoordinatorData({
      authUserId,
      domainUserId
    });

    return {
      ok: false as const,
      state: buildMasterActionState<UnitCoordinatorFormValues>(
        "error",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o coordenador da unidade.",
        {},
        input.values
      )
    };
  }

  revalidateMasterPaths(input.values.unit_id);

  return {
    ok: true as const,
    state: buildMasterActionState<UnitCoordinatorFormValues>(
      "success",
      input.replaceExisting
        ? `Coordenador responsável da unidade ${unitRow.nome} substituído com sucesso.`
        : `Coordenador da unidade ${unitRow.nome} cadastrado com sucesso.`
    )
  };
}

export async function upsertUnitAction(
  _previousState: MasterActionState<UnitFormValues>,
  formData: FormData
): Promise<MasterActionState<UnitFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildUnitFormValues(formData);
  const parsedData = unitSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildMasterActionState(
      "error",
      "Revise os campos obrigatórios da unidade.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  if (parsedData.data.estado && !/^[A-Z]{2}$/.test(parsedData.data.estado)) {
    return buildMasterActionState(
      "error",
      "Informe uma UF válida com duas letras.",
      { estado: "Use a sigla da UF com duas letras." },
      submittedFormValues
    );
  }

  const uniqueFieldErrors = await ensureUniqueUnitFields({
    unitId: parsedData.data.unit_id,
    slug: parsedData.data.slug,
    sigla: parsedData.data.sigla.toUpperCase()
  });

  if (Object.keys(uniqueFieldErrors).length) {
    return buildMasterActionState(
      "error",
      "Já existe uma unidade com os dados informados.",
      uniqueFieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();

  try {
    if (parsedData.data.unit_id) {
      const { data: existingUnit, error: existingUnitError } = await adminClient
        .from("unidades")
        .select("id")
        .eq("id", parsedData.data.unit_id)
        .maybeSingle();

      if (existingUnitError || !existingUnit) {
        return buildMasterActionState(
          "error",
          "Não foi possível localizar a unidade para edição.",
          {},
          submittedFormValues
        );
      }

      const unitUpdatePayload: UnitUpdate = {
        nome: parsedData.data.nome,
        sigla: parsedData.data.sigla.toUpperCase(),
        slug: parsedData.data.slug,
        cidade: parsedData.data.cidade || null,
        estado: parsedData.data.estado || null
      };

      const { error: updateError } = await (adminClient.from("unidades") as any)
        .update(unitUpdatePayload)
        .eq("id", parsedData.data.unit_id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      revalidateMasterPaths(parsedData.data.unit_id);

      return buildMasterActionState(
        "success",
        "Unidade atualizada com sucesso.",
        {},
        submittedFormValues
      );
    }

    const unitInsertPayload: UnitInsert = {
      nome: parsedData.data.nome,
      sigla: parsedData.data.sigla.toUpperCase(),
      slug: parsedData.data.slug,
      cidade: parsedData.data.cidade || null,
      estado: parsedData.data.estado || null,
      ativo: true
    };

    const { error: insertError } = await (adminClient.from("unidades") as any).insert(
      unitInsertPayload
    );

    if (insertError) {
      throw new Error(insertError.message);
    }

    revalidateMasterPaths();

    return buildMasterActionState("success", "Unidade cadastrada com sucesso.");
  } catch (error) {
    return buildMasterActionState(
      "error",
      error instanceof Error
        ? error.message
        : "Não foi possível salvar a unidade.",
      {},
      submittedFormValues
    );
  }
}

export async function toggleUnitStatusAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const unitId = readStringField(formData, "unit_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(unitId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await (adminClient.from("unidades") as any)
    .update({ ativo: nextStatusRaw === "true" } satisfies Pick<UnitRow, "ativo">)
    .eq("id", unitId);

  if (!error) {
    revalidateMasterPaths(unitId);
  }
}

export async function createUnitCoordinatorAction(
  _previousState: MasterActionState<UnitCoordinatorFormValues>,
  formData: FormData
): Promise<MasterActionState<UnitCoordinatorFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCoordinatorFormValues(formData);
  const parsedData = coordinatorSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildMasterActionState(
      "error",
      "Revise os campos obrigatórios do coordenador da unidade.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const result = await createCoordinatorAccount({
    values: submittedFormValues,
    replaceExisting: false
  });

  return result.state;
}

export async function replaceUnitCoordinatorAction(
  _previousState: MasterActionState<UnitCoordinatorFormValues>,
  formData: FormData
): Promise<MasterActionState<UnitCoordinatorFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCoordinatorFormValues(formData);
  const parsedData = coordinatorSchema.safeParse({
    ...submittedFormValues,
    replace_existing: "true"
  });

  if (!parsedData.success) {
    return buildMasterActionState(
      "error",
      "Revise os campos obrigatórios do novo coordenador responsável.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      {
        ...submittedFormValues,
        replace_existing: "true"
      }
    );
  }

  const result = await createCoordinatorAccount({
    values: {
      ...submittedFormValues,
      replace_existing: "true"
    },
    replaceExisting: true
  });

  return result.state;
}

export async function updateUnitCoordinatorProfileAction(
  _previousState: MasterActionState<UnitCoordinatorProfileFormValues>,
  formData: FormData
): Promise<MasterActionState<UnitCoordinatorProfileFormValues>> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildCoordinatorProfileFormValues(formData);
  const parsedData = coordinatorProfileSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildMasterActionState(
      "error",
      "Revise os dados do coordenador.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: coordinatorRow, error: coordinatorError } = await adminClient
    .from("coordenadores")
    .select("usuario_id, unidade_id")
    .eq("usuario_id", parsedData.data.coordinator_id)
    .maybeSingle();

  if (coordinatorError || !coordinatorRow) {
    return buildMasterActionState(
      "error",
      "Não foi possível localizar o coordenador informado.",
      {},
      submittedFormValues
    );
  }

  const [userUpdateResult, coordinatorUpdateResult] = await Promise.all([
    (adminClient.from("usuarios") as any)
      .update({ nome_completo: parsedData.data.nome_completo } satisfies Pick<
        UserRow,
        "nome_completo"
      >)
      .eq("id", parsedData.data.coordinator_id),
    (adminClient.from("coordenadores") as any)
      .update({ cargo: parsedData.data.cargo } satisfies Pick<CoordinatorRow, "cargo">)
      .eq("usuario_id", parsedData.data.coordinator_id)
  ]);

  if (userUpdateResult.error || coordinatorUpdateResult.error) {
    return buildMasterActionState(
      "error",
      userUpdateResult.error?.message ??
        coordinatorUpdateResult.error?.message ??
        "Não foi possível atualizar o coordenador.",
      {},
      submittedFormValues
    );
  }

  revalidateMasterPaths(parsedData.data.unit_id);

  return buildMasterActionState(
    "success",
    "Dados do coordenador atualizados com sucesso.",
    {},
    submittedFormValues
  );
}

export async function toggleCoordinatorAccessAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const coordinatorId = readStringField(formData, "coordinator_id");
  const unitId = readStringField(formData, "unit_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(coordinatorId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await (adminClient.from("usuarios") as any)
    .update({ ativo: nextStatusRaw === "true" } satisfies Pick<UserRow, "ativo">)
    .eq("id", coordinatorId);

  if (!error) {
    revalidateMasterPaths(unitId || undefined);
  }
}

export async function updateInstitutionalUserBasicAction(
  _previousState: MasterActionState<MasterUserProfileFormValues>,
  formData: FormData
): Promise<MasterActionState<MasterUserProfileFormValues>> {
  const currentUser = await requireRole(["coordenador_master"]);
  const submittedFormValues = buildMasterUserProfileFormValues(formData);
  const parsedData = masterUserProfileSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildMasterActionState(
      "error",
      "Revise o nome do usuário.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  if (parsedData.data.user_id === currentUser.id) {
    return buildMasterActionState(
      "error",
      "Use o fluxo próprio de conta para alterar o usuário master atual.",
      {},
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const { data: userRow, error: userError } = await adminClient
    .from("usuarios")
    .select("id, perfil_id")
    .eq("id", parsedData.data.user_id)
    .maybeSingle();
  const safeUserRow = (userRow ?? null) as Pick<UserRow, "id" | "perfil_id"> | null;

  if (userError || !safeUserRow) {
    return buildMasterActionState(
      "error",
      "Não foi possível localizar o usuário informado.",
      {},
      submittedFormValues
    );
  }

  const profileMap = await loadProfileMap();
  const masterProfileId = profileMap.get("coordenador_master")?.id ?? null;

  if (masterProfileId && safeUserRow.perfil_id === masterProfileId) {
    return buildMasterActionState(
      "error",
      "A edição administrativa desta fase não altera contas master.",
      {},
      submittedFormValues
    );
  }

  const { error } = await (adminClient.from("usuarios") as any)
    .update({ nome_completo: parsedData.data.nome_completo } satisfies Pick<
      UserRow,
      "nome_completo"
    >)
    .eq("id", parsedData.data.user_id);

  if (error) {
    return buildMasterActionState(
      "error",
      error.message,
      {},
      submittedFormValues
    );
  }

  revalidateMasterPaths();

  return buildMasterActionState(
    "success",
    "Cadastro básico do usuário atualizado com sucesso.",
    {},
    submittedFormValues
  );
}

export async function toggleInstitutionalUserAccessAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador_master"]);
  const userId = readStringField(formData, "user_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(userId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  if (userId === currentUser.id) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: userRow, error: userError } = await adminClient
    .from("usuarios")
    .select("id, perfil_id")
    .eq("id", userId)
    .maybeSingle();
  const safeUserRow = (userRow ?? null) as Pick<UserRow, "id" | "perfil_id"> | null;

  if (userError || !safeUserRow) {
    return;
  }

  const profileMap = await loadProfileMap();
  const masterProfileId = profileMap.get("coordenador_master")?.id ?? null;

  if (masterProfileId && safeUserRow.perfil_id === masterProfileId) {
    return;
  }

  const { error } = await (adminClient.from("usuarios") as any)
    .update({ ativo: nextStatusRaw === "true" } satisfies Pick<UserRow, "ativo">)
    .eq("id", userId);

  if (!error) {
    revalidateMasterPaths();
  }
}
