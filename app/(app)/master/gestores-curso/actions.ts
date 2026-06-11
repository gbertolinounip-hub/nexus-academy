"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  CourseManagerActionState,
  CourseManagerFormValues,
  CourseManagerManagementActionState,
  NewCourseManagerActionState,
  NewCourseManagerFormValues
} from "@/app/(app)/master/gestores-curso/state";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UserInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type UserUpdate = Database["public"]["Tables"]["usuarios"]["Update"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type UserContextInsert = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Insert"];
type UserContextUpdate = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Update"];

type ManagedProfileCode = Extract<ProfileRow["codigo"], "coordenador" | "master_curso">;
type ManagedProfileRecord = Pick<ProfileRow, "id" | "codigo" | "nome">;

const courseManagerSchema = z.object({
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  curso_id: z.string().uuid("Selecione um curso valido."),
  usuario_id: z.string().uuid("Selecione um usuario valido."),
  ativo: z.enum(["true", "false"])
});

const newCourseManagerSchema = z.object({
  nome_completo: z
    .string()
    .trim()
    .min(3, "Informe o nome completo do Gestor do curso.")
    .max(160, "O nome deve ter no maximo 160 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Informe um e-mail valido para o Gestor do curso."),
  senha: z
    .string()
    .min(8, "A senha inicial deve ter ao menos 8 caracteres.")
    .max(72, "A senha inicial deve ter no maximo 72 caracteres."),
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  curso_id: z.string().uuid("Selecione um curso valido."),
  ativo: z.enum(["true", "false"])
});

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildFormValues(formData: FormData): CourseManagerFormValues {
  const activeValue = readStringField(formData, "ativo");

  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    curso_id: readStringField(formData, "curso_id"),
    usuario_id: readStringField(formData, "usuario_id"),
    ativo: activeValue === "false" ? "false" : "true"
  };
}

function buildNewCourseManagerFormValues(formData: FormData): NewCourseManagerFormValues {
  const activeValue = readStringField(formData, "ativo");

  return {
    nome_completo: readStringField(formData, "nome_completo"),
    email: readStringField(formData, "email").toLowerCase(),
    senha: readStringField(formData, "senha"),
    instituicao_id: readStringField(formData, "instituicao_id"),
    curso_id: readStringField(formData, "curso_id"),
    ativo: activeValue === "false" ? "false" : "true"
  };
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

function buildActionState<TFormValues>(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: TFormValues
): CourseManagerActionState<TFormValues> {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateCourseManagerPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/master");
  revalidatePath("/master/contextos");
  revalidatePath("/master/gestores-curso");
  revalidatePath("/master-curso");
}

async function loadManagedProfiles(
  profileCodes: ManagedProfileCode[]
): Promise<Map<ManagedProfileCode, ManagedProfileRecord>> {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("perfis")
    .select("id, codigo, nome")
    .in("codigo", profileCodes);

  if (error) {
    return new Map();
  }

  return new Map(
    ((data ?? []) as ManagedProfileRecord[]).map((profile) => [
      profile.codigo as ManagedProfileCode,
      profile
    ])
  );
}

async function loadMasterCourseProfile() {
  const profiles = await loadManagedProfiles(["master_curso"]);
  return profiles.get("master_curso") ?? null;
}

async function validateInstitutionAndCourse(input: {
  instituicaoId: string;
  cursoId: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [institutionResult, courseResult] = await Promise.all([
    adminClient
      .from("instituicoes")
      .select("id, nome, ativo")
      .eq("id", input.instituicaoId)
      .maybeSingle(),
    adminClient
      .from("cursos")
      .select("id, instituicao_id, nome, codigo, ativo")
      .eq("id", input.cursoId)
      .maybeSingle()
  ]);

  const fieldErrors: Record<string, string> = {};
  const institution = (institutionResult.data ?? null) as Pick<
    InstitutionRow,
    "id" | "nome" | "ativo"
  > | null;
  const course = (courseResult.data ?? null) as Pick<
    CourseRow,
    "id" | "instituicao_id" | "nome" | "codigo" | "ativo"
  > | null;

  if (institutionResult.error || !institution) {
    fieldErrors.instituicao_id = "Selecione uma instituicao valida.";
  }

  if (courseResult.error || !course) {
    fieldErrors.curso_id = "Selecione um curso valido.";
  }

  if (institution && course && course.instituicao_id !== institution.id) {
    fieldErrors.curso_id = "O curso precisa pertencer a instituicao selecionada.";
  }

  return {
    fieldErrors,
    institution,
    course
  };
}

async function validateDependencies(input: {
  instituicaoId: string;
  cursoId: string;
  usuarioId: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [{ fieldErrors, institution, course }, userResult, masterProfile] = await Promise.all([
    validateInstitutionAndCourse({
      instituicaoId: input.instituicaoId,
      cursoId: input.cursoId
    }),
    adminClient
      .from("usuarios")
      .select("id, nome_completo, email, ativo, contexto_padrao_id")
      .eq("id", input.usuarioId)
      .maybeSingle(),
    loadMasterCourseProfile()
  ]);

  const user = (userResult.data ?? null) as Pick<
    UserRow,
    "id" | "nome_completo" | "email" | "ativo" | "contexto_padrao_id"
  > | null;

  if (!masterProfile) {
    fieldErrors.usuario_id = "O perfil tecnico de Gestor do curso nao foi encontrado.";
  }

  if (userResult.error || !user) {
    fieldErrors.usuario_id = "Selecione um usuario valido.";
  } else if (!user.ativo) {
    fieldErrors.usuario_id = "Selecione um usuario ativo.";
  }

  return {
    fieldErrors,
    institution,
    course,
    user,
    masterProfile
  };
}

async function validateNewCourseManagerDependencies(input: {
  instituicaoId: string;
  cursoId: string;
  email: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [{ fieldErrors, institution, course }, existingUserResult, profileMap] =
    await Promise.all([
      validateInstitutionAndCourse({
        instituicaoId: input.instituicaoId,
        cursoId: input.cursoId
      }),
      adminClient
        .from("usuarios")
        .select("id, email")
        .eq("email", input.email)
        .maybeSingle(),
      loadManagedProfiles(["coordenador", "master_curso"])
    ]);

  const existingUser = (existingUserResult.data ?? null) as Pick<UserRow, "id" | "email"> | null;
  const masterProfile = profileMap.get("master_curso") ?? null;
  const legacyCoordinatorProfile = profileMap.get("coordenador") ?? null;

  if (!masterProfile) {
    fieldErrors.curso_id = "O perfil tecnico de Gestor do curso nao foi encontrado.";
  }

  if (!legacyCoordinatorProfile) {
    fieldErrors.email =
      "O perfil legado de coordenador nao foi encontrado para criar o novo acesso.";
  }

  if (existingUserResult.error) {
    fieldErrors.email = "Nao foi possivel validar a disponibilidade deste e-mail.";
  } else if (existingUser) {
    fieldErrors.email =
      "Este e-mail ja possui cadastro. Use o bloco de atribuicao para usuario existente.";
  }

  return {
    fieldErrors,
    institution,
    course,
    masterProfile,
    legacyCoordinatorProfile
  };
}

async function loadExistingCourseManagerContext(input: {
  usuarioId: string;
  perfilId: number;
  instituicaoId: string;
  cursoId: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("usuarios_papeis_contexto")
    .select("*")
    .eq("usuario_id", input.usuarioId)
    .eq("perfil_id", input.perfilId)
    .eq("instituicao_id", input.instituicaoId)
    .eq("curso_id", input.cursoId)
    .is("oferta_curso_unidade_id", null)
    .maybeSingle();

  if (error) {
    throw new Error("Nao foi possivel validar a duplicidade do Gestor do curso.");
  }

  return (data ?? null) as UserContextRow | null;
}

async function cleanupCreatedCourseManagerData(input: {
  authUserId: string | null;
  domainUserId: string | null;
  contextId: string | null;
}) {
  const adminClient = createSupabaseAdminClient();

  if (input.contextId) {
    await adminClient.from("usuarios_papeis_contexto").delete().eq("id", input.contextId);
  }

  if (input.domainUserId) {
    await adminClient.from("usuarios").delete().eq("id", input.domainUserId);
  }

  if (input.authUserId) {
    await adminClient.auth.admin.deleteUser(input.authUserId);
  }
}

function isDuplicateEmailMessage(message: string | undefined) {
  const normalizedMessage = (message ?? "").toLowerCase();
  return normalizedMessage.includes("already") || normalizedMessage.includes("duplicate");
}

export async function registerCourseManagerAction(
  _previousState: NewCourseManagerActionState,
  formData: FormData
): Promise<NewCourseManagerActionState> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildNewCourseManagerFormValues(formData);
  const parsedData = newCourseManagerSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios do novo Gestor do curso.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const dependencies = await validateNewCourseManagerDependencies({
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id,
    email: parsedData.data.email
  });

  if (Object.keys(dependencies.fieldErrors).length) {
    return buildActionState(
      "error",
      "Nao foi possivel cadastrar o novo Gestor do curso com os dados informados.",
      dependencies.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const shouldActivate = parsedData.data.ativo === "true";
  let authUserId: string | null = null;
  let domainUserId: string | null = null;
  let contextId: string | null = null;

  try {
    const { data: createdAuthUser, error: authError } = await adminClient.auth.admin.createUser({
      email: parsedData.data.email,
      password: parsedData.data.senha,
      email_confirm: true
    });

    if (authError || !createdAuthUser.user) {
      return buildActionState(
        "error",
        authError?.message ?? "Nao foi possivel criar o acesso no Auth.",
        {
          email: isDuplicateEmailMessage(authError?.message)
            ? "Este e-mail ja esta cadastrado. Use o bloco de atribuicao para usuario existente."
            : "Nao foi possivel criar este e-mail no sistema de autenticacao."
        },
        submittedFormValues
      );
    }

    authUserId = createdAuthUser.user.id;
    domainUserId = createdAuthUser.user.id;

    const userInsertPayload: UserInsert = {
      id: createdAuthUser.user.id,
      perfil_id: dependencies.legacyCoordinatorProfile!.id,
      unidade_id: null,
      contexto_padrao_id: null,
      email: parsedData.data.email,
      nome_completo: parsedData.data.nome_completo,
      ativo: true
    };

    const { error: userInsertError } = await adminClient
      .from("usuarios")
      .insert(userInsertPayload as never);

    if (userInsertError) {
      throw new Error(
        userInsertError.code === "23505"
          ? "Este e-mail ja possui cadastro. Use o bloco de atribuicao para usuario existente."
          : userInsertError.message
      );
    }

    const contextInsertPayload: UserContextInsert = {
      usuario_id: createdAuthUser.user.id,
      perfil_id: dependencies.masterProfile!.id,
      instituicao_id: parsedData.data.instituicao_id,
      curso_id: parsedData.data.curso_id,
      oferta_curso_unidade_id: null,
      principal: true,
      ativo: shouldActivate,
      metadata: {
        origem: "course-manager-registration",
        escopo: "curso_inteiro"
      }
    };

    const { data: createdContextData, error: contextInsertError } = await adminClient
      .from("usuarios_papeis_contexto")
      .insert(contextInsertPayload as never)
      .select("id")
      .single();
    const createdContext = (createdContextData ?? null) as Pick<UserContextRow, "id"> | null;

    if (contextInsertError || !createdContext) {
      throw new Error(
        contextInsertError?.code === "23505"
          ? "Ja existe um vinculo de Gestor do curso para este novo usuario."
          : contextInsertError?.message ??
              "Nao foi possivel criar o contexto do novo Gestor do curso."
      );
    }

    contextId = createdContext.id;

    const userUpdatePayload: UserUpdate = {
      contexto_padrao_id: contextId
    };

    const { error: userUpdateError } = await adminClient
      .from("usuarios")
      .update(userUpdatePayload as never)
      .eq("id", createdAuthUser.user.id);

    if (userUpdateError) {
      throw new Error("Nao foi possivel definir o contexto padrao do novo Gestor do curso.");
    }
  } catch (error) {
    await cleanupCreatedCourseManagerData({
      authUserId,
      domainUserId,
      contextId
    });

    return buildActionState(
      "error",
      error instanceof Error
        ? error.message
        : "Nao foi possivel concluir o cadastro do novo Gestor do curso.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseManagerPaths();

  return buildActionState(
    "success",
    `${parsedData.data.nome_completo} foi cadastrado e vinculado como Gestor do curso em ${dependencies.course!.nome}.`
  );
}

export async function createCourseManagerAction(
  _previousState: CourseManagerManagementActionState,
  formData: FormData
): Promise<CourseManagerManagementActionState> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildFormValues(formData);
  const parsedData = courseManagerSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios do Gestor do curso.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const dependencies = await validateDependencies({
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id,
    usuarioId: parsedData.data.usuario_id
  });

  if (Object.keys(dependencies.fieldErrors).length) {
    return buildActionState(
      "error",
      "Nao foi possivel atribuir o Gestor do curso com os dados informados.",
      dependencies.fieldErrors,
      submittedFormValues
    );
  }

  const existingContext = await loadExistingCourseManagerContext({
    usuarioId: parsedData.data.usuario_id,
    perfilId: dependencies.masterProfile!.id,
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id
  });

  const adminClient = createSupabaseAdminClient();
  const shouldActivate = parsedData.data.ativo === "true";

  if (existingContext?.ativo) {
    return buildActionState(
      "error",
      `${dependencies.user!.nome_completo} ja esta vinculado como Gestor do curso para ${dependencies.course!.nome}.`,
      { usuario_id: "Esse usuario ja e Gestor desse curso." },
      submittedFormValues
    );
  }

  if (existingContext) {
    const updatePayload: UserContextUpdate = {
      ativo: shouldActivate
    };

    const { error } = await adminClient
      .from("usuarios_papeis_contexto")
      .update(updatePayload as never)
      .eq("id", existingContext.id);

    if (error) {
      return buildActionState(
        "error",
        "Nao foi possivel atualizar o vinculo existente do Gestor do curso.",
        {},
        submittedFormValues
      );
    }

    revalidateCourseManagerPaths();

    return buildActionState(
      "success",
      shouldActivate
        ? `${dependencies.user!.nome_completo} foi reativado como Gestor do curso em ${dependencies.course!.nome}.`
        : `${dependencies.user!.nome_completo} ja possuia o vinculo e ele foi mantido inativo.`,
      {},
      submittedFormValues
    );
  }

  const insertPayload: UserContextInsert = {
    usuario_id: parsedData.data.usuario_id,
    perfil_id: dependencies.masterProfile!.id,
    instituicao_id: parsedData.data.instituicao_id,
    curso_id: parsedData.data.curso_id,
    oferta_curso_unidade_id: null,
    principal: false,
    ativo: shouldActivate,
    metadata: {
      origem: "course-manager-management",
      escopo: "curso_inteiro"
    }
  };

  const { error } = await adminClient
    .from("usuarios_papeis_contexto")
    .insert(insertPayload as never);

  if (error) {
    return buildActionState(
      "error",
      error.code === "23505"
        ? "Esse usuario ja possui esse vinculo de Gestor do curso."
        : "Nao foi possivel criar o vinculo de Gestor do curso.",
      {},
      submittedFormValues
    );
  }

  revalidateCourseManagerPaths();

  return buildActionState(
    "success",
    `${dependencies.user!.nome_completo} foi vinculado como Gestor do curso em ${dependencies.course!.nome}.`
  );
}

export async function toggleCourseManagerStatusAction(formData: FormData) {
  await requireRole(["coordenador_master"]);
  const contextId = readStringField(formData, "context_id");
  const nextStatusRaw = readStringField(formData, "ativo");

  if (!z.string().uuid().safeParse(contextId).success) {
    return;
  }

  if (!["true", "false"].includes(nextStatusRaw)) {
    return;
  }

  const masterProfile = await loadMasterCourseProfile();

  if (!masterProfile) {
    return;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: contextData, error: contextError } = await adminClient
    .from("usuarios_papeis_contexto")
    .select("*")
    .eq("id", contextId)
    .eq("perfil_id", masterProfile.id)
    .maybeSingle();

  const context = (contextData ?? null) as UserContextRow | null;

  if (contextError || !context) {
    return;
  }

  const nextActive = nextStatusRaw === "true";
  const updatePayload: UserContextUpdate = {
    ativo: nextActive
  };

  const { error: updateError } = await adminClient
    .from("usuarios_papeis_contexto")
    .update(updatePayload as never)
    .eq("id", contextId);

  if (updateError) {
    return;
  }

  if (!nextActive) {
    const { data: userData, error: userError } = await adminClient
      .from("usuarios")
      .select("id, contexto_padrao_id")
      .eq("id", context.usuario_id)
      .maybeSingle();

    const user = (userData ?? null) as Pick<UserRow, "id" | "contexto_padrao_id"> | null;

    if (!userError && user?.contexto_padrao_id === contextId) {
      const userUpdatePayload: UserUpdate = {
        contexto_padrao_id: null
      };

      await adminClient.from("usuarios").update(userUpdatePayload as never).eq("id", user.id);
    }
  }

  revalidateCourseManagerPaths();
}
