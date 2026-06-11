"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";
import type {
  EnrollmentManagementActionState,
  MasterEnrollmentFormValues
} from "@/app/(app)/master/matriculas/state";

type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type EnrollmentInsert = Database["public"]["Tables"]["matriculas_turma"]["Insert"];
type StudentUpdate = Database["public"]["Tables"]["alunos"]["Update"];

const enrollmentSchema = z.object({
  instituicao_id: z.string().uuid("Selecione uma instituicao valida."),
  curso_id: z.string().uuid("Selecione um curso valido."),
  oferta_curso_unidade_id: z.string().uuid("Selecione uma oferta valida."),
  semestre_id: z.string().uuid("Selecione um semestre valido."),
  turma_id: z.string().uuid("Selecione uma turma valida."),
  aluno_id: z.string().uuid("Selecione um aluno valido."),
  status: z.enum(["ativa", "concluida", "trancada", "cancelada"])
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

function buildEnrollmentFormValues(formData: FormData): MasterEnrollmentFormValues {
  const status = readStringField(formData, "status");

  return {
    instituicao_id: readStringField(formData, "instituicao_id"),
    curso_id: readStringField(formData, "curso_id"),
    oferta_curso_unidade_id: readStringField(formData, "oferta_curso_unidade_id"),
    semestre_id: readStringField(formData, "semestre_id"),
    turma_id: readStringField(formData, "turma_id"),
    aluno_id: readStringField(formData, "aluno_id"),
    status:
      status === "concluida" || status === "trancada" || status === "cancelada"
        ? status
        : "ativa"
  };
}

function buildActionState(
  status: "success" | "error",
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: MasterEnrollmentFormValues
): EnrollmentManagementActionState {
  return {
    status,
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
  };
}

function revalidateEnrollmentManagementPaths(studentId?: string) {
  revalidatePath("/master");
  revalidatePath("/master/contextos");
  revalidatePath("/master/semestres");
  revalidatePath("/master/turmas");
  revalidatePath("/master/matriculas");
  revalidatePath("/master-curso");
  revalidatePath("/gestao/alunos");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");

  if (studentId) {
    revalidatePath(`/gestao/alunos/${studentId}`);
  }
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

async function loadClass(classId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("turmas")
    .select("id, semestre_id, oferta_curso_unidade_id, codigo, nome, ativa")
    .eq("id", classId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    ClassRow,
    "id" | "semestre_id" | "oferta_curso_unidade_id" | "codigo" | "nome" | "ativa"
  >;
}

async function loadStudent(studentId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("alunos")
    .select("usuario_id, unidade_id, matricula, curso, curso_id, oferta_curso_unidade_id")
    .eq("usuario_id", studentId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Pick<
    StudentRow,
    "usuario_id" | "unidade_id" | "matricula" | "curso" | "curso_id" | "oferta_curso_unidade_id"
  >;
}

async function validateEnrollmentCreation(input: {
  instituicaoId: string;
  cursoId: string;
  offerId: string;
  semesterId: string;
  classId: string;
  studentId: string;
}) {
  const adminClient = createSupabaseAdminClient();
  const [offerRow, semesterRow, classRow, studentRow, duplicateEnrollmentResult] =
    await Promise.all([
      loadOffer(input.offerId),
      loadSemester(input.semesterId),
      loadClass(input.classId),
      loadStudent(input.studentId),
      adminClient
        .from("matriculas_turma")
        .select("id")
        .eq("turma_id", input.classId)
        .eq("aluno_id", input.studentId)
        .limit(1)
    ]);

  if (duplicateEnrollmentResult.error) {
    throw new Error("Nao foi possivel validar a matricula do aluno.");
  }

  const fieldErrors: Record<string, string> = {};

  if (!offerRow) {
    fieldErrors.oferta_curso_unidade_id = "Selecione uma oferta valida.";
  }

  if (!semesterRow) {
    fieldErrors.semestre_id = "Selecione um semestre valido.";
  }

  if (!classRow) {
    fieldErrors.turma_id = "Selecione uma turma valida.";
  }

  if (!studentRow) {
    fieldErrors.aluno_id = "Selecione um aluno valido.";
  }

  if (!offerRow || !semesterRow || !classRow || !studentRow) {
    return {
      fieldErrors,
      offerRow,
      semesterRow,
      classRow,
      studentRow,
      effectiveOfferId: null as string | null
    };
  }

  if (offerRow.instituicao_id !== input.instituicaoId) {
    fieldErrors.instituicao_id =
      "A oferta precisa pertencer a instituicao selecionada.";
  }

  if (offerRow.curso_id !== input.cursoId) {
    fieldErrors.curso_id = "A oferta precisa pertencer ao curso selecionado.";
  }

  if (semesterRow.id !== input.semesterId) {
    fieldErrors.semestre_id = "Selecione um semestre valido.";
  }

  if (classRow.semestre_id !== semesterRow.id) {
    fieldErrors.turma_id = "A turma precisa pertencer ao semestre selecionado.";
  }

  const effectiveOfferId =
    classRow.oferta_curso_unidade_id ?? semesterRow.oferta_curso_unidade_id ?? null;

  if (!effectiveOfferId || effectiveOfferId !== offerRow.id) {
    fieldErrors.turma_id = "A turma precisa pertencer a oferta selecionada.";
  }

  if (studentRow.curso_id && studentRow.curso_id !== offerRow.curso_id) {
    fieldErrors.aluno_id = "O aluno ja esta vinculado a outro curso.";
  }

  if (studentRow.oferta_curso_unidade_id && studentRow.oferta_curso_unidade_id !== effectiveOfferId) {
    fieldErrors.aluno_id = "O aluno ja esta vinculado a outra oferta.";
  }

  if ((duplicateEnrollmentResult.data ?? []).length > 0) {
    fieldErrors.aluno_id = "Este aluno ja esta matriculado na turma selecionada.";
  }

  return {
    fieldErrors,
    offerRow,
    semesterRow,
    classRow,
    studentRow,
    effectiveOfferId
  };
}

export async function createMasterEnrollmentAction(
  _previousState: EnrollmentManagementActionState,
  formData: FormData
): Promise<EnrollmentManagementActionState> {
  await requireRole(["coordenador_master"]);
  const submittedFormValues = buildEnrollmentFormValues(formData);
  const parsedData = enrollmentSchema.safeParse(submittedFormValues);

  if (!parsedData.success) {
    return buildActionState(
      "error",
      "Revise os campos obrigatorios da matricula.",
      normalizeFieldErrors(parsedData.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const validation = await validateEnrollmentCreation({
    instituicaoId: parsedData.data.instituicao_id,
    cursoId: parsedData.data.curso_id,
    offerId: parsedData.data.oferta_curso_unidade_id,
    semesterId: parsedData.data.semestre_id,
    classId: parsedData.data.turma_id,
    studentId: parsedData.data.aluno_id
  });

  if (
    Object.keys(validation.fieldErrors).length ||
    !validation.offerRow ||
    !validation.semesterRow ||
    !validation.classRow ||
    !validation.studentRow ||
    !validation.effectiveOfferId
  ) {
    return buildActionState(
      "error",
      "Nao foi possivel criar a matricula com os dados informados.",
      validation.fieldErrors,
      submittedFormValues
    );
  }

  const adminClient = createSupabaseAdminClient();
  const studentUpdatePayload: StudentUpdate = {};

  if (!validation.studentRow.curso_id) {
    studentUpdatePayload.curso_id = validation.offerRow.curso_id;
  }

  if (!validation.studentRow.oferta_curso_unidade_id) {
    studentUpdatePayload.oferta_curso_unidade_id = validation.effectiveOfferId;
  }

  if (
    validation.studentRow.unidade_id === null &&
    validation.offerRow.unidade_id
  ) {
    studentUpdatePayload.unidade_id = validation.offerRow.unidade_id;
  }

  if (Object.keys(studentUpdatePayload).length > 0) {
    const { error: studentUpdateError } = await adminClient
      .from("alunos")
      .update(studentUpdatePayload as never)
      .eq("usuario_id", validation.studentRow.usuario_id);

    if (studentUpdateError) {
      return buildActionState(
        "error",
        studentUpdateError.message,
        {},
        submittedFormValues
      );
    }
  }

  const insertPayload: EnrollmentInsert = {
    turma_id: validation.classRow.id,
    aluno_id: validation.studentRow.usuario_id,
    oferta_curso_unidade_id: validation.effectiveOfferId,
    status: parsedData.data.status
  };

  const { error } = await adminClient
    .from("matriculas_turma")
    .insert(insertPayload as never);

  if (error) {
    const isDuplicate =
      error.code === "23505" || /duplicate key|unique/i.test(error.message);

    return buildActionState(
      "error",
      isDuplicate
        ? "Este aluno ja esta matriculado na turma selecionada."
        : error.message,
      isDuplicate ? { aluno_id: "Evite duplicar a matricula na mesma turma." } : {},
      submittedFormValues
    );
  }

  revalidateEnrollmentManagementPaths(validation.studentRow.usuario_id);

  return buildActionState(
    "success",
    `Matricula criada com sucesso para ${validation.studentRow.matricula} em ${validation.classRow.nome}.`
  );
}
