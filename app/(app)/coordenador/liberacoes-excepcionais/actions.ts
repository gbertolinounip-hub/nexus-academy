"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { ExceptionalReleaseActionState, ExceptionalReleaseFormValues } from "@/app/(app)/coordenador/liberacoes-excepcionais/state";
import { createInitialExceptionalReleaseFormValues } from "@/app/(app)/coordenador/liberacoes-excepcionais/state";

type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type ReleaseInsert = Database["public"]["Tables"]["liberacoes_excepcionais"]["Insert"];
type ReleaseRow = Database["public"]["Tables"]["liberacoes_excepcionais"]["Row"];

const pagePath = "/coordenador/liberacoes-excepcionais";

const exceptionalReleaseSchema = z.object({
  tipo: z.enum(["avaliacao", "ausencia"]),
  semestre_id: z.string().uuid("Selecione um semestre válido."),
  turma_id: z.string().uuid("Selecione uma turma válida."),
  aluno_id: z.string().uuid("Selecione um aluno válido."),
  usuario_autorizado_id: z.string().uuid("Selecione o usuário que receberá a liberação."),
  motivo: z
    .string()
    .trim()
    .min(8, "Descreva o motivo da liberação com ao menos 8 caracteres.")
    .max(1200, "O motivo deve ter no máximo 1200 caracteres."),
  inicio_em: z.string().trim().min(1, "Informe o início da vigência."),
  expira_em: z.string().trim().min(1, "Informe a expiração da vigência.")
});

const closeExceptionalReleaseSchema = z.object({
  release_id: z.string().uuid("Liberação inválida.")
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

function buildFormValues(formData: FormData): ExceptionalReleaseFormValues {
  return {
    tipo:
      formData.get("tipo") === "ausencia"
        ? "ausencia"
        : "avaliacao",
    semestre_id: String(formData.get("semestre_id") ?? ""),
    turma_id: String(formData.get("turma_id") ?? ""),
    aluno_id: String(formData.get("aluno_id") ?? ""),
    usuario_autorizado_id: String(formData.get("usuario_autorizado_id") ?? ""),
    motivo: String(formData.get("motivo") ?? ""),
    inicio_em: String(formData.get("inicio_em") ?? ""),
    expira_em: String(formData.get("expira_em") ?? "")
  };
}

function buildErrorState(
  message: string,
  formValues: ExceptionalReleaseFormValues,
  fieldErrors: Record<string, string> = {}
): ExceptionalReleaseActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function buildSuccessState(message: string): ExceptionalReleaseActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    formValues: createInitialExceptionalReleaseFormValues(),
    submittedAt: Date.now()
  };
}

function parseDateTimeInput(value: string) {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
}

function buildNoticeRedirect(message: string, type: "success" | "error") {
  const query = new URLSearchParams({
    notice: message,
    notice_type: type
  });

  return `${pagePath}?${query.toString()}` as Route;
}

export async function createExceptionalReleaseAction(
  _previousState: ExceptionalReleaseActionState,
  formData: FormData
): Promise<ExceptionalReleaseActionState> {
  const currentUser = await requireRole(["coordenador"]);
  const currentUnitId = currentUser.unitId ?? null;
  const formValues = buildFormValues(formData);

  if (!currentUnitId) {
    return buildErrorState(
      "O coordenador autenticado precisa estar vinculado a uma unidade para criar liberações excepcionais.",
      formValues
    );
  }

  const parsedForm = exceptionalReleaseSchema.safeParse(formValues);

  if (!parsedForm.success) {
    return buildErrorState(
      "Revise os campos obrigatórios da liberação excepcional.",
      formValues,
      normalizeFieldErrors(parsedForm.error.flatten().fieldErrors)
    );
  }

  const values = parsedForm.data;
  const startsAt = parseDateTimeInput(values.inicio_em);
  const expiresAt = parseDateTimeInput(values.expira_em);

  if (!startsAt) {
    return buildErrorState(
      "Informe um início de vigência válido.",
      formValues,
      {
        inicio_em: "Informe uma data e hora válidas para o início."
      }
    );
  }

  if (!expiresAt) {
    return buildErrorState(
      "Informe uma expiração de vigência válida.",
      formValues,
      {
        expira_em: "Informe uma data e hora válidas para a expiração."
      }
    );
  }

  if (new Date(startsAt).getTime() >= new Date(expiresAt).getTime()) {
    return buildErrorState(
      "A expiração deve ser posterior ao início da vigência.",
      formValues,
      {
        expira_em: "A expiração deve acontecer depois do início da vigência."
      }
    );
  }

  const supabase = await createSupabaseServerClient();
  const [semesterResult, authorizedUserResult] = await Promise.all([
    supabase
      .from("semestres")
      .select("*")
      .eq("id", values.semestre_id)
      .eq("unidade_id", currentUnitId)
      .maybeSingle(),
    supabase
      .from("usuarios")
      .select("id, unidade_id, ativo, perfil_id")
      .eq("id", values.usuario_autorizado_id)
      .eq("unidade_id", currentUnitId)
      .maybeSingle()
  ]);

  if (semesterResult.error || !semesterResult.data) {
    return buildErrorState(
      "Não foi possível localizar o semestre selecionado na unidade do coordenador.",
      formValues,
      {
        semestre_id: "Selecione um semestre válido da sua unidade."
      }
    );
  }

  const semester = semesterResult.data as SemesterRow;

  if (semester.status !== "encerrado") {
    return buildErrorState(
      "Liberações excepcionais só podem ser criadas para semestres encerrados.",
      formValues,
      {
        semestre_id: "Selecione um semestre já encerrado."
      }
    );
  }

  if (authorizedUserResult.error || !authorizedUserResult.data) {
    return buildErrorState(
      "Não foi possível localizar o usuário liberado na unidade do coordenador.",
      formValues,
      {
        usuario_autorizado_id: "Selecione um usuário ativo e válido da unidade."
      }
    );
  }

  const authorizedUser = authorizedUserResult.data as Pick<
    UserRow,
    "id" | "unidade_id" | "ativo" | "perfil_id"
  >;

  if (!authorizedUser.ativo || authorizedUser.unidade_id !== currentUnitId) {
    return buildErrorState(
      "O usuário liberado precisa estar ativo e vinculado à unidade.",
      formValues,
      {
        usuario_autorizado_id: "Selecione um usuário ativo da sua unidade."
      }
    );
  }

  const authorizedUserProfileResult = await supabase
    .from("perfis")
    .select("codigo")
    .eq("id", authorizedUser.perfil_id)
    .maybeSingle();

  const authorizedUserProfile =
    (authorizedUserProfileResult.data as Pick<ProfileRow, "codigo"> | null) ?? null;

  if (
    authorizedUserProfileResult.error ||
    !authorizedUserProfile ||
    !["professor", "secretaria", "coordenador"].includes(authorizedUserProfile.codigo)
  ) {
    return buildErrorState(
      "O usuário liberado precisa ser um perfil operacional elegível da unidade.",
      formValues,
      {
        usuario_autorizado_id:
          "Selecione um professor, uma secretária ou um coordenador ativo da unidade."
      }
    );
  }

  const classResult = await supabase
    .from("turmas")
    .select("id, semestre_id")
    .eq("id", values.turma_id)
    .eq("semestre_id", semester.id)
    .maybeSingle();

  if (classResult.error || !classResult.data) {
    return buildErrorState(
      "A turma selecionada não pertence ao semestre informado.",
      formValues,
      {
        turma_id: "Selecione uma turma válida dentro do semestre escolhido."
      }
    );
  }

  const classGroup = classResult.data as Pick<ClassRow, "id" | "semestre_id">;
  const studentId = values.aluno_id;
  const [studentUserResult, studentRecordResult, enrollmentResult] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, unidade_id")
      .eq("id", studentId)
      .eq("unidade_id", currentUnitId)
      .maybeSingle(),
    supabase
      .from("alunos")
      .select("usuario_id")
      .eq("usuario_id", studentId)
      .maybeSingle(),
    supabase
      .from("matriculas_turma")
      .select("id, turma_id")
      .eq("aluno_id", studentId)
      .eq("turma_id", classGroup.id)
  ]);

  if (
    studentUserResult.error ||
    !studentUserResult.data ||
    studentRecordResult.error ||
    !studentRecordResult.data
  ) {
    return buildErrorState(
      "O aluno selecionado não pertence à unidade do coordenador.",
      formValues,
      {
        aluno_id: "Selecione um aluno válido da sua unidade."
      }
    );
  }

  const matchingEnrollment =
    ((enrollmentResult.data ?? []) as Array<Pick<EnrollmentRow, "id" | "turma_id">>)[0] ??
    null;

  if (enrollmentResult.error || !matchingEnrollment) {
    return buildErrorState(
      "O aluno selecionado não possui vínculo compatível com o semestre e a turma informados.",
      formValues,
      {
        aluno_id: "Selecione um aluno vinculado à turma escolhida."
      }
    );
  }

  const payload: ReleaseInsert = {
    unidade_id: currentUnitId,
    semestre_id: semester.id,
    turma_id: classGroup.id,
    aluno_id: studentId,
    usuario_autorizado_id: values.usuario_autorizado_id,
    tipo: values.tipo,
    escopo: "aluno",
    motivo: values.motivo.trim(),
    criado_por: currentUser.id,
    inicio_em: startsAt,
    expira_em: expiresAt,
    ativo: true,
    encerrado_manualmente_em: null,
    utilizado_em: null,
    utilizado_por: null
  };

  const { error } = await (supabase.from("liberacoes_excepcionais") as any).insert(
    payload
  );

  if (error) {
    return buildErrorState(
      "Não foi possível criar a liberação excepcional com os dados informados.",
      formValues
    );
  }

  revalidatePath(pagePath);

  return buildSuccessState("Liberação excepcional criada com sucesso.");
}

export async function closeExceptionalReleaseAction(formData: FormData) {
  const currentUser = await requireRole(["coordenador"]);
  const currentUnitId = currentUser.unitId ?? null;

  if (!currentUnitId) {
    redirect(
      buildNoticeRedirect(
        "O coordenador autenticado precisa estar vinculado a uma unidade para encerrar liberações excepcionais.",
        "error"
      )
    );
  }

  const parsedForm = closeExceptionalReleaseSchema.safeParse({
    release_id: String(formData.get("release_id") ?? "")
  });

  if (!parsedForm.success) {
    redirect(
      buildNoticeRedirect("A liberação excepcional informada é inválida.", "error")
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("liberacoes_excepcionais")
    .select("*")
    .eq("id", parsedForm.data.release_id)
    .eq("unidade_id", currentUnitId)
    .maybeSingle();

  if (error || !data) {
    redirect(
      buildNoticeRedirect(
        "Não foi possível localizar a liberação excepcional selecionada na sua unidade.",
        "error"
      )
    );
  }

  const release = data as ReleaseRow;
  const now = new Date();

  if (release.utilizado_em) {
    redirect(
      buildNoticeRedirect(
        "Essa liberação já foi utilizada e não pode mais ser encerrada manualmente.",
        "error"
      )
    );
  }

  if (!release.ativo || release.encerrado_manualmente_em) {
    redirect(
      buildNoticeRedirect("Essa liberação já foi encerrada manualmente.", "error")
    );
  }

  if (new Date(release.expira_em).getTime() < now.getTime()) {
    redirect(
      buildNoticeRedirect(
        "Essa liberação já expirou e não precisa de encerramento manual.",
        "error"
      )
    );
  }

  const { error: updateError } = await (supabase.from(
    "liberacoes_excepcionais"
  ) as any)
    .update({
      ativo: false,
      encerrado_manualmente_em: now.toISOString()
    })
    .eq("id", release.id)
    .eq("unidade_id", currentUnitId);

  if (updateError) {
    redirect(
      buildNoticeRedirect(
        "Não foi possível encerrar manualmente a liberação excepcional.",
        "error"
      )
    );
  }

  revalidatePath(pagePath);
  redirect(buildNoticeRedirect("Liberação excepcional encerrada com sucesso.", "success"));
}
