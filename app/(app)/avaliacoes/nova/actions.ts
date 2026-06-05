"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  attachExceptionalReleaseToAuditRecords,
  resolveExceptionalReleaseGate
} from "@/services/exceptional-releases";
import type {
  EvaluationActionFormValues,
  EvaluationActionState
} from "@/app/(app)/avaliacoes/nova/state";
import type { Database } from "@/types/database";

type RubricCriterionRow = Database["public"]["Tables"]["criterios_avaliacao"]["Row"];
type ProfessorLinkValidationRow = Pick<
  Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"],
  "id" | "data_fim"
>;
type EnrollmentRow = Pick<
  Database["public"]["Tables"]["matriculas_turma"]["Row"],
  "id" | "aluno_id" | "turma_id"
>;
type ClassRow = Pick<
  Database["public"]["Tables"]["turmas"]["Row"],
  "id" | "semestre_id"
>;
type SemesterRow = Pick<
  Database["public"]["Tables"]["semestres"]["Row"],
  "id" | "status"
>;
type EvaluationValidationRow = Pick<
  Database["public"]["Tables"]["avaliacoes"]["Row"],
  | "id"
  | "matricula_turma_id"
  | "status"
  | "professor_id"
  | "avaliacao_origem_id"
  | "avaliacao_raiz_id"
  | "avaliado_em"
  | "created_at"
>;

interface ReviewBaselineState {
  scoreByCriterionId: Map<string, number>;
  feedbackByCriterionId: Map<string, string>;
}

const baseEvaluationSchema = z.object({
  avaliacao_id: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().uuid().safeParse(value).success, {
      message: "O identificador do lançamento é inválido."
    }),
  avaliacao_origem_id: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().uuid().safeParse(value).success, {
      message: "O identificador da avaliação de origem é inválido."
    }),
  matricula_turma_id: z.string().uuid("Selecione um aluno valido."),
  tipo_lancamento: z.enum(["parcial", "revisao", "fechamento"], {
    error: "Selecione um tipo de lançamento válido."
  }),
  avaliado_em: z.iso.date("Informe uma data de lançamento válida."),
  observacoes: z
    .string()
    .trim()
    .max(4000, "As observacoes devem ter no maximo 4000 caracteres.")
    .optional()
    .or(z.literal("")),
  intent: z.enum(["rascunho", "publicado"], {
    error: "A acao do formulario e obrigatoria."
  })
});

function buildErrorState(
  message: string,
  fieldErrors: Record<string, string> = {},
  formValues?: EvaluationActionFormValues
): EvaluationActionState {
  return {
    status: "error",
    message,
    fieldErrors,
    formValues,
    submittedAt: Date.now()
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

function buildSuccessState(
  message: string,
  evaluationId: string,
  savedStatus: "rascunho" | "publicado"
): EvaluationActionState {
  return {
    status: "success",
    message,
    fieldErrors: {},
    savedEvaluationId: evaluationId,
    savedStatus,
    submittedAt: Date.now()
  };
}

function readStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function buildSubmittedFormValues(formData: FormData): EvaluationActionFormValues {
  const criterionScores = Object.fromEntries(
    [...formData.entries()]
      .filter(
        (entry): entry is [string, string] =>
          entry[0].startsWith("criterion__") && typeof entry[1] === "string"
      )
      .map(([fieldName, value]) => [fieldName.replace("criterion__", ""), value.trim()])
  );
  const criterionFeedbacks = Object.fromEntries(
    [...formData.entries()]
      .filter(
        (entry): entry is [string, string] =>
          entry[0].startsWith("feedback__") && typeof entry[1] === "string"
      )
      .map(([fieldName, value]) => [fieldName.replace("feedback__", ""), value.trim()])
  );

  const rawTipoLançamento = readStringField(formData, "tipo_lancamento");
  const rawIntent = readStringField(formData, "intent");
  const rawAvaliacaoId = readStringField(formData, "avaliacao_id");
  const rawAvaliacaoOrigemId = readStringField(formData, "avaliacao_origem_id");

  return {
    avaliacao_id: rawAvaliacaoId || undefined,
    avaliacao_origem_id: rawAvaliacaoOrigemId || undefined,
    matricula_turma_id: readStringField(formData, "matricula_turma_id"),
    tipo_lancamento:
      rawTipoLançamento === "parcial" ||
      rawTipoLançamento === "revisao" ||
      rawTipoLançamento === "fechamento"
        ? rawTipoLançamento
        : "",
    avaliado_em: readStringField(formData, "avaliado_em"),
    observacoes: readStringField(formData, "observacoes"),
    intent: rawIntent === "rascunho" || rawIntent === "publicado" ? rawIntent : "",
    criterionScores,
    criterionFeedbacks
  };
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function launchTypeLabel(type: "parcial" | "revisao" | "fechamento") {
  switch (type) {
    case "parcial":
      return "Parcial";
    case "revisao":
      return "Revisão";
    case "fechamento":
      return "Fechamento";
    default:
      return type;
  }
}

function formatDateFromInput(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function buildGeneratedReference(
  launchType: "parcial" | "revisao" | "fechamento",
  evaluatedAt: string
) {
  return `${launchTypeLabel(launchType)} - ${formatDateFromInput(evaluatedAt)}`;
}

function buildEvaluatedAtTimestamp(evaluatedAt: string) {
  return `${evaluatedAt}T12:00:00-03:00`;
}

function appendExceptionalReleaseNotice(message: string, noticeMessage?: string | null) {
  return noticeMessage ? `${message} ${noticeMessage}` : message;
}

async function loadEvaluationOperationalScope(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  enrollmentId: string
) {
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("id, aluno_id, turma_id")
    .eq("id", enrollmentId)
    .maybeSingle();

  const enrollment = (enrollmentData ?? null) as EnrollmentRow | null;

  if (enrollmentError || !enrollment) {
    throw new Error(
      "Nao foi possivel localizar a matricula vinculada a este lancamento."
    );
  }

  const { data: classData, error: classError } = await supabase
    .from("turmas")
    .select("id, semestre_id")
    .eq("id", enrollment.turma_id)
    .maybeSingle();

  const classGroup = (classData ?? null) as ClassRow | null;

  if (classError || !classGroup) {
    throw new Error(
      "Nao foi possivel localizar a turma vinculada a este lancamento."
    );
  }

  const { data: semesterData, error: semesterError } = await supabase
    .from("semestres")
    .select("id, status")
    .eq("id", classGroup.semestre_id)
    .maybeSingle();

  const semester = (semesterData ?? null) as SemesterRow | null;

  if (semesterError || !semester) {
    throw new Error(
      "Nao foi possivel localizar o semestre vinculado a este lancamento."
    );
  }

  return {
    semesterId: semester.id,
    semesterStatus: semester.status,
    classId: classGroup.id,
    studentId: enrollment.aluno_id
  };
}

async function validateProfessorLink(
  professorId: string,
  enrollmentId: string
): Promise<
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }
> {
  const supabase = await createSupabaseServerClient();
  const { data: professorLinkRows, error: linkError } = await supabase
    .from("vinculos_professor_aluno")
    .select("id, data_fim")
    .eq("professor_id", professorId)
    .eq("matricula_turma_id", enrollmentId)
    .eq("ativo", true);

  const typedProfessorLinks = (professorLinkRows ?? []) as ProfessorLinkValidationRow[];

  if (linkError || !typedProfessorLinks.length) {
    return {
      ok: false,
      message: "O aluno selecionado nao esta vinculado ao professor autenticado.",
      fieldErrors: {
        matricula_turma_id: "Selecione um aluno vinculado ao professor autenticado."
      }
    };
  }

  const today = getTodayInSaoPaulo();
  const hasActiveLink = typedProfessorLinks.some(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!hasActiveLink) {
    return {
      ok: false,
      message: "O vinculo do professor com a matricula selecionada nao esta mais ativo.",
      fieldErrors: {
        matricula_turma_id: "Escolha uma matricula com vinculo ativo."
      }
    };
  }

  return { ok: true };
}

function buildItemsPayload(
  criterionScores: Record<string, string>,
  criterionFeedbacks: Record<string, string>,
  criterionRows: Array<Pick<RubricCriterionRow, "id" | "escala_maxima">>,
  reviewBaseline?: ReviewBaselineState | null
) {
  const itemsPayload: Array<{
    criterio_id: string;
    nota_bruta: number;
    feedback?: string | null;
  }> = [];
  const fieldErrors: Record<string, string> = {};

  for (const criterion of criterionRows) {
    const fieldName = `criterion__${criterion.id}`;
    const rawValue = criterionScores[criterion.id]?.trim() ?? "";
    const feedbackFieldName = `feedback__${criterion.id}`;
    const feedbackValue = criterionFeedbacks[criterion.id]?.trim() ?? "";
    const hasScoreInput = rawValue !== "";
    const hasFeedbackInput = feedbackValue !== "";

    if (!reviewBaseline) {
      if (!hasScoreInput) {
        if (hasFeedbackInput) {
          fieldErrors[feedbackFieldName] =
            "Informe a nota antes de registrar a justificativa deste item.";
        }
        continue;
      }

      const parsedScore = Number(rawValue);

      if (Number.isNaN(parsedScore)) {
        fieldErrors[fieldName] = "Informe uma nota numerica valida.";
        continue;
      }

      if (parsedScore < 0 || parsedScore > Number(criterion.escala_maxima)) {
        fieldErrors[fieldName] = `A nota deve estar entre 0 e ${criterion.escala_maxima}.`;
        continue;
      }

      itemsPayload.push({
        criterio_id: criterion.id,
        nota_bruta: Math.round(parsedScore * 100) / 100,
        feedback: hasFeedbackInput ? feedbackValue : null
      });
      continue;
    }

    if (!hasScoreInput && !hasFeedbackInput) {
      continue;
    }

    const baselineScore = reviewBaseline.scoreByCriterionId.get(criterion.id);
    const baselineFeedback =
      reviewBaseline.feedbackByCriterionId.get(criterion.id) ?? null;

    let resolvedScore = baselineScore ?? null;

    if (hasScoreInput) {
      const parsedScore = Number(rawValue);

      if (Number.isNaN(parsedScore)) {
        fieldErrors[fieldName] = "Informe uma nota numerica valida.";
        continue;
      }

      if (parsedScore < 0 || parsedScore > Number(criterion.escala_maxima)) {
        fieldErrors[fieldName] = `A nota deve estar entre 0 e ${criterion.escala_maxima}.`;
        continue;
      }

      resolvedScore = Math.round(parsedScore * 100) / 100;
    }

    if (resolvedScore === null) {
      fieldErrors[feedbackFieldName] =
        "Este critério ainda não possui nota anterior. Informe a nota para registrar a justificativa nesta revisão.";
      continue;
    }

    const scoreChanged =
      baselineScore === undefined ? hasScoreInput : resolvedScore !== baselineScore;
    const feedbackChanged = hasFeedbackInput
      ? feedbackValue !== (baselineFeedback ?? "")
      : false;

    if (!scoreChanged && !feedbackChanged) {
      continue;
    }

    itemsPayload.push({
      criterio_id: criterion.id,
      nota_bruta: resolvedScore,
      feedback: hasFeedbackInput ? feedbackValue : baselineFeedback
    });
  }

  if (!itemsPayload.length) {
    fieldErrors.criteria = "Preencha ao menos um criterio avaliado.";
  }

  return { itemsPayload, fieldErrors };
}

function compareEvaluationRows(
  left: Pick<EvaluationValidationRow, "id" | "avaliado_em" | "created_at">,
  right: Pick<EvaluationValidationRow, "id" | "avaliado_em" | "created_at">
) {
  const evaluatedDifference = (left.avaliado_em ?? "").localeCompare(
    right.avaliado_em ?? ""
  );

  if (evaluatedDifference !== 0) {
    return evaluatedDifference;
  }

  const createdDifference = (left.created_at ?? "").localeCompare(
    right.created_at ?? ""
  );

  if (createdDifference !== 0) {
    return createdDifference;
  }

  return left.id.localeCompare(right.id);
}

async function loadReviewBaselineState(
  originEvaluationId: string,
  professorId: string
): Promise<
  | { ok: true; baseline: ReviewBaselineState }
  | { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data: originEvaluationData, error: originEvaluationError } = await supabase
    .from("avaliacoes")
    .select(
      "id, professor_id, matricula_turma_id, status, avaliacao_origem_id, avaliacao_raiz_id, avaliado_em, created_at"
    )
    .eq("id", originEvaluationId)
    .eq("professor_id", professorId)
    .maybeSingle();

  const originEvaluation =
    (originEvaluationData ?? null) as EvaluationValidationRow | null;

  if (originEvaluationError || !originEvaluation) {
    return {
      ok: false,
      message:
        "Não foi possível localizar a avaliação publicada que serve de base para esta revisão."
    };
  }

  const rootEvaluationId = originEvaluation.avaliacao_raiz_id ?? originEvaluation.id;
  const { data: chainEvaluationRowsData, error: chainEvaluationRowsError } =
    await supabase
      .from("avaliacoes")
      .select(
        "id, professor_id, matricula_turma_id, status, avaliacao_origem_id, avaliacao_raiz_id, avaliado_em, created_at"
      )
      .or(`id.eq.${rootEvaluationId},avaliacao_raiz_id.eq.${rootEvaluationId}`);

  if (chainEvaluationRowsError) {
    return {
      ok: false,
      message:
        "Não foi possível carregar o histórico da avaliação para validar a revisão incremental."
    };
  }

  const chainEvaluationRows = ((chainEvaluationRowsData ?? []) as EvaluationValidationRow[])
    .filter(
      (evaluation) =>
        evaluation.professor_id === professorId &&
        evaluation.matricula_turma_id === originEvaluation.matricula_turma_id
    )
    .sort(compareEvaluationRows);

  const chainEvaluationIds = chainEvaluationRows.map((evaluation) => evaluation.id);
  const { data: chainItemsData, error: chainItemsError } = chainEvaluationIds.length
    ? await supabase
        .from("itens_avaliados")
        .select("avaliacao_id, criterio_id, nota_bruta, feedback")
        .in("avaliacao_id", chainEvaluationIds)
    : { data: [], error: null };

  if (chainItemsError) {
    return {
      ok: false,
      message:
        "Não foi possível carregar os itens avaliados da versão publicada usada como base da revisão."
    };
  }

  const itemsByEvaluationId = new Map<
    string,
    Array<
      Pick<
        Database["public"]["Tables"]["itens_avaliados"]["Row"],
        "avaliacao_id" | "criterio_id" | "nota_bruta" | "feedback"
      >
    >
  >();

  for (const item of (chainItemsData ?? []) as Array<
    Pick<
      Database["public"]["Tables"]["itens_avaliados"]["Row"],
      "avaliacao_id" | "criterio_id" | "nota_bruta" | "feedback"
    >
  >) {
    const currentItems = itemsByEvaluationId.get(item.avaliacao_id) ?? [];
    currentItems.push(item);
    itemsByEvaluationId.set(item.avaliacao_id, currentItems);
  }

  const scoreByCriterionId = new Map<string, number>();
  const feedbackByCriterionId = new Map<string, string>();

  for (const evaluation of chainEvaluationRows) {
    if (evaluation.status !== "publicado") {
      if (evaluation.id === originEvaluation.id) {
        break;
      }
      continue;
    }

    for (const item of itemsByEvaluationId.get(evaluation.id) ?? []) {
      scoreByCriterionId.set(item.criterio_id, Number(item.nota_bruta));

      if (item.feedback && item.feedback.trim() !== "") {
        feedbackByCriterionId.set(item.criterio_id, item.feedback);
      } else {
        feedbackByCriterionId.delete(item.criterio_id);
      }
    }

    if (evaluation.id === originEvaluation.id) {
      break;
    }
  }

  return {
    ok: true,
    baseline: {
      scoreByCriterionId,
      feedbackByCriterionId
    }
  };
}

export async function submitEvaluationAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const submittedFormValues = buildSubmittedFormValues(formData);
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.role !== "professor") {
    return buildErrorState(
      "Nesta versão, apenas professores podem registrar avaliações por esta tela.",
      {},
      submittedFormValues
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: professorRow, error: professorError } = await supabase
    .from("professores")
    .select("usuario_id")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError || !professorRow) {
    return buildErrorState(
      "Não encontramos um cadastro docente valido para o usuario autenticado.",
      {},
      submittedFormValues
    );
  }

  const parsedBase = baseEvaluationSchema.safeParse(submittedFormValues);

  if (!parsedBase.success) {
    return buildErrorState(
      "Revise os campos obrigatórios do lançamento.",
      normalizeFieldErrors(parsedBase.error.flatten().fieldErrors),
      submittedFormValues
    );
  }

  const {
    avaliacao_id,
    avaliacao_origem_id,
    matricula_turma_id,
    tipo_lancamento,
    avaliado_em,
    observacoes,
    intent
  } = parsedBase.data;
  const generatedReference = buildGeneratedReference(tipo_lancamento, avaliado_em);
  const evaluatedAtTimestamp = buildEvaluatedAtTimestamp(avaliado_em);

  if (avaliacao_origem_id && tipo_lancamento !== "revisao") {
    return buildErrorState(
      "Lançamentos vinculados a uma avaliação publicada devem usar o tipo revisão.",
      {
        tipo_lancamento:
          "A revisão incremental só pode ser criada com o tipo de lançamento revisão."
      },
      submittedFormValues
    );
  }

  let targetEnrollmentId = matricula_turma_id;
  let isEditing = false;
  let existingEvaluation: EvaluationValidationRow | null = null;

  if (avaliacao_id) {
    const { data: existingEvaluationData, error: existingEvaluationError } = await supabase
      .from("avaliacoes")
      .select(
        "id, matricula_turma_id, status, professor_id, avaliacao_origem_id, avaliacao_raiz_id, avaliado_em, created_at"
      )
      .eq("id", avaliacao_id)
      .eq("professor_id", currentUser.id)
      .maybeSingle();

    existingEvaluation =
      (existingEvaluationData ?? null) as EvaluationValidationRow | null;

    if (existingEvaluationError || !existingEvaluation) {
      return buildErrorState(
        "Não encontramos um lançamento deste professor com o identificador informado.",
        {},
        submittedFormValues
      );
    }

    if (existingEvaluation.status !== "rascunho") {
      return buildErrorState(
        "Apenas lançamentos em rascunho podem ser editados por esta tela.",
        {},
        submittedFormValues
      );
    }

    targetEnrollmentId = existingEvaluation.matricula_turma_id;
    isEditing = true;
  }

  const linkValidation = await validateProfessorLink(currentUser.id, targetEnrollmentId);

  if (!linkValidation.ok) {
    return buildErrorState(
      linkValidation.message,
      linkValidation.fieldErrors ?? {},
      submittedFormValues
    );
  }

  let evaluationScope;

  try {
    evaluationScope = await loadEvaluationOperationalScope(supabase, targetEnrollmentId);
  } catch (error) {
    return buildErrorState(
      error instanceof Error
        ? error.message
        : "Nao foi possivel identificar o contexto academico deste lancamento.",
      {},
      submittedFormValues
    );
  }

  const exceptionalReleaseGate = await resolveExceptionalReleaseGate(
    {
      type: "avaliacao",
      semesterId: evaluationScope.semesterId,
      classId: evaluationScope.classId,
      studentId: evaluationScope.studentId,
      unitId: currentUser.unitId ?? null,
      authorizedUserId: currentUser.id
    },
    {
      currentUser,
      semesterStatus: evaluationScope.semesterStatus,
      blockedMessage:
        "O semestre selecionado ja esta encerrado. Este lancamento so pode ser realizado com liberacao excepcional ativa."
    }
  );

  if (!exceptionalReleaseGate.allowed) {
    return buildErrorState(
      exceptionalReleaseGate.blockedMessage ??
        "O semestre selecionado ja esta encerrado e nao permite novos ajustes.",
      {},
      submittedFormValues
    );
  }

  const previousItemIds =
    exceptionalReleaseGate.viaExceptionalRelease && avaliacao_id
      ? (
          (
            await supabase
              .from("itens_avaliados")
              .select("id")
              .eq("avaliacao_id", avaliacao_id)
          ).data as Array<Pick<Database["public"]["Tables"]["itens_avaliados"]["Row"], "id">> | null ?? []
        ).map((item) => item.id)
      : [];

  const { data: criterionRowsData, error: criterionError } = await supabase
    .from("criterios_avaliacao")
    .select("id, escala_maxima")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (criterionError) {
    return buildErrorState(
      "Não foi possível carregar os critérios de avaliação para validar o formulário.",
      {},
      submittedFormValues
    );
  }

  const criterionRows = (criterionRowsData ?? []) as Pick<
    RubricCriterionRow,
    "id" | "escala_maxima"
  >[];
  const isIncrementalReview =
    Boolean(avaliacao_origem_id) ||
    (isEditing && Boolean(existingEvaluation?.avaliacao_origem_id));
  let reviewBaseline: ReviewBaselineState | null = null;

  if (isIncrementalReview) {
    const reviewOriginId =
      avaliacao_origem_id ?? existingEvaluation?.avaliacao_origem_id ?? null;

    if (!reviewOriginId) {
      return buildErrorState(
        "Não foi possível identificar a avaliação publicada que serve de base para esta revisão.",
        {},
        submittedFormValues
      );
    }

    const reviewBaselineState = await loadReviewBaselineState(
      reviewOriginId,
      currentUser.id
    );

    if (!reviewBaselineState.ok) {
      return buildErrorState(
        reviewBaselineState.message,
        {},
        submittedFormValues
      );
    }

    reviewBaseline = reviewBaselineState.baseline;
  }

  const { itemsPayload, fieldErrors } = buildItemsPayload(
    submittedFormValues.criterionScores,
    submittedFormValues.criterionFeedbacks,
    criterionRows,
    reviewBaseline
  );

  if (Object.keys(fieldErrors).length > 0) {
    const missingChangedCriteria = itemsPayload.length === 0;

    if (isIncrementalReview && missingChangedCriteria) {
      const reviewMessage =
        intent === "publicado"
          ? "Para publicar a revisão, altere ao menos a nota ou a justificativa de um critério."
          : "Para salvar a revisão, altere ao menos a nota ou a justificativa de um critério.";

      return buildErrorState(
        reviewMessage,
        {
          ...fieldErrors,
          criteria: reviewMessage
        },
        submittedFormValues
      );
    }

    return buildErrorState(
      "Revise as notas informadas antes de salvar o lançamento.",
      fieldErrors,
      submittedFormValues
    );
  }

  if (!isEditing && avaliacao_origem_id) {
    const rpcClient = supabase as unknown as {
      rpc: (
        fn: "criar_revisao_avaliacao_com_itens",
        args: Database["public"]["Functions"]["criar_revisao_avaliacao_com_itens"]["Args"]
      ) => Promise<{
        data:
          | Database["public"]["Functions"]["criar_revisao_avaliacao_com_itens"]["Returns"]
          | null;
        error: { message: string } | null;
      }>;
    };

    const { data: evaluationId, error: saveError } = await rpcClient.rpc(
      "criar_revisao_avaliacao_com_itens",
      {
        p_avaliacao_origem_id: avaliacao_origem_id,
        p_referencia: generatedReference,
        p_observacoes: observacoes || null,
        p_status: intent,
        p_itens: itemsPayload,
        p_avaliado_em: evaluatedAtTimestamp
      }
    );

    if (saveError || !evaluationId) {
      return buildErrorState(
        saveError?.message ??
          "Não foi possível criar a revisão incremental vinculada.",
        {},
        submittedFormValues
      );
    }

    if (exceptionalReleaseGate.release) {
      const { data: currentItemsData } = await supabase
        .from("itens_avaliados")
        .select("id")
        .eq("avaliacao_id", evaluationId);

      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "avaliacoes",
        recordIds: [evaluationId]
      });
      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "itens_avaliados",
        recordIds: (
          ((currentItemsData ?? []) as Array<
            Pick<Database["public"]["Tables"]["itens_avaliados"]["Row"], "id">
          >)
        ).map((item) => item.id)
      });
    }

    revalidatePath("/avaliacoes");
    revalidatePath("/avaliacoes/nova");
    revalidatePath(`/avaliacoes/${avaliacao_origem_id}`);
    revalidatePath(`/avaliacoes/${avaliacao_origem_id}/revisao`);
    revalidatePath(`/avaliacoes/${evaluationId}`);
    revalidatePath("/professor");
    revalidatePath("/aluno");
    revalidatePath("/coordenador");
    revalidatePath("/relatorios");
    revalidatePath("/auditoria");
    revalidatePath("/auditoria");

    return buildSuccessState(
      appendExceptionalReleaseNotice(
        intent === "publicado"
          ? "Revisão publicada com sucesso."
          : "Rascunho de revisão salvo com sucesso.",
        exceptionalReleaseGate.noticeMessage
      ),
      evaluationId,
      intent
    );
  }

  if (isEditing && avaliacao_id) {
    const rpcClient = supabase as unknown as {
      rpc: (
        fn: "atualizar_avaliacao_com_itens",
        args: Database["public"]["Functions"]["atualizar_avaliacao_com_itens"]["Args"]
      ) => Promise<{
        data:
          | Database["public"]["Functions"]["atualizar_avaliacao_com_itens"]["Returns"]
          | null;
        error: { message: string } | null;
      }>;
    };

    const { data: evaluationId, error: saveError } = await rpcClient.rpc(
      "atualizar_avaliacao_com_itens",
      {
        p_avaliacao_id: avaliacao_id,
        p_tipo_lancamento: tipo_lancamento,
        p_referencia: generatedReference,
        p_observacoes: observacoes || null,
        p_status: intent,
        p_itens: itemsPayload,
        p_avaliado_em: evaluatedAtTimestamp
      }
    );

    if (saveError || !evaluationId) {
      return buildErrorState(
        saveError?.message ??
          "Não foi possível atualizar o lançamento de avaliação no banco.",
        {},
        submittedFormValues
      );
    }

    if (exceptionalReleaseGate.release) {
      const { data: currentItemsData } = await supabase
        .from("itens_avaliados")
        .select("id")
        .eq("avaliacao_id", evaluationId);

      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "avaliacoes",
        recordIds: [evaluationId]
      });
      await attachExceptionalReleaseToAuditRecords({
        supabase,
        releaseId: exceptionalReleaseGate.release.releaseId,
        tableName: "itens_avaliados",
        recordIds: [
          ...previousItemIds,
          ...(
            ((currentItemsData ?? []) as Array<
              Pick<Database["public"]["Tables"]["itens_avaliados"]["Row"], "id">
            >)
          ).map((item) => item.id)
        ]
      });
    }

    revalidatePath("/avaliacoes");
    revalidatePath("/avaliacoes/nova");
    revalidatePath(`/avaliacoes/${evaluationId}`);
    revalidatePath("/professor");
    revalidatePath("/aluno");
    revalidatePath("/coordenador");
    revalidatePath("/relatorios");
    revalidatePath("/auditoria");

    return buildSuccessState(
      appendExceptionalReleaseNotice(
        intent === "publicado"
          ? "Lançamento publicado com sucesso."
          : "Rascunho atualizado com sucesso.",
        exceptionalReleaseGate.noticeMessage
      ),
      evaluationId,
      intent
    );
  }

  const rpcClient = supabase as unknown as {
    rpc: (
      fn: "criar_avaliacao_com_itens",
      args: Database["public"]["Functions"]["criar_avaliacao_com_itens"]["Args"]
    ) => Promise<{
      data: Database["public"]["Functions"]["criar_avaliacao_com_itens"]["Returns"] | null;
      error: { message: string } | null;
    }>;
  };

  const { data: evaluationId, error: saveError } = await rpcClient.rpc(
    "criar_avaliacao_com_itens",
    {
      p_matricula_turma_id: targetEnrollmentId,
      p_tipo_lancamento: tipo_lancamento,
      p_referencia: generatedReference,
      p_observacoes: observacoes || null,
      p_status: intent,
      p_itens: itemsPayload,
      p_avaliado_em: evaluatedAtTimestamp
    }
  );

  if (saveError || !evaluationId) {
    return buildErrorState(
      saveError?.message ??
        "Não foi possível salvar o lançamento de avaliação no banco.",
      {},
      submittedFormValues
    );
  }

  if (exceptionalReleaseGate.release) {
    const { data: currentItemsData } = await supabase
      .from("itens_avaliados")
      .select("id")
      .eq("avaliacao_id", evaluationId);

    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "avaliacoes",
      recordIds: [evaluationId]
    });
    await attachExceptionalReleaseToAuditRecords({
      supabase,
      releaseId: exceptionalReleaseGate.release.releaseId,
      tableName: "itens_avaliados",
      recordIds: (
        ((currentItemsData ?? []) as Array<
          Pick<Database["public"]["Tables"]["itens_avaliados"]["Row"], "id">
        >)
      ).map((item) => item.id)
    });
  }

  revalidatePath("/avaliacoes");
  revalidatePath("/avaliacoes/nova");
  revalidatePath(`/avaliacoes/${evaluationId}`);
  revalidatePath("/professor");
  revalidatePath("/aluno");
  revalidatePath("/coordenador");
  revalidatePath("/relatorios");
  revalidatePath("/auditoria");

  return buildSuccessState(
    appendExceptionalReleaseNotice(
      intent === "publicado"
        ? "Lançamento publicado com sucesso."
        : "Rascunho salvo com sucesso.",
      exceptionalReleaseGate.noticeMessage
    ),
    evaluationId,
    intent
  );
}


