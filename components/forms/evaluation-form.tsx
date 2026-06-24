"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { submitEvaluationAction } from "@/app/(app)/avaliacoes/nova/actions";
import { ExceptionalReleaseNotice } from "@/components/common/exceptional-release-notice";
import type { EvaluationActionFormValues } from "@/app/(app)/avaliacoes/nova/state";
import { initialEvaluationActionState } from "@/app/(app)/avaliacoes/nova/state";
import { formatDate } from "@/lib/utils/format";
import type {
  EvaluationCriterionPreviousSubmission,
  EvaluationFormInitialValues,
  EvaluationFormMode,
  EvaluationFormPageData,
  EvaluationRuntimeFormContext,
  EvaluationRubricCriterion
} from "@/services/evaluations";

interface EvaluationFormProps {
  studentOptions: EvaluationFormPageData["studentOptions"];
  rubricGroups: EvaluationFormPageData["rubricGroups"];
  evaluationMode: EvaluationFormPageData["evaluationMode"];
  evaluationModelName: EvaluationFormPageData["evaluationModelName"];
  runtimeContextsByEnrollmentId: EvaluationFormPageData["runtimeContextsByEnrollmentId"];
  mode?: EvaluationFormMode;
  initialValues?: EvaluationFormInitialValues;
  readOnlyMessage?: string | null;
  contextMessage?: string | null;
}

function buildResolvedFormValues(
  studentOptions: EvaluationFormPageData["studentOptions"],
  initialValues?: EvaluationFormInitialValues,
  submittedValues?: EvaluationActionFormValues
) {
  const fallbackEnrollmentId =
    initialValues?.matriculaTurmaId ?? studentOptions[0]?.enrollmentId ?? "";

  return {
    avaliacaoId: submittedValues?.avaliacao_id ?? initialValues?.evaluationId,
    avaliacaoOrigemId:
      submittedValues?.avaliacao_origem_id ?? initialValues?.evaluationOriginId,
    matriculaTurmaId: submittedValues?.matricula_turma_id || fallbackEnrollmentId,
    tipoLançamento:
      submittedValues?.tipo_lancamento || initialValues?.tipoLançamento || "parcial",
    avaliadoEm:
      submittedValues?.avaliado_em ?? initialValues?.avaliadoEm?.slice(0, 10) ?? "",
    observacoes: submittedValues?.observacoes ?? initialValues?.observacoes ?? "",
    criterionScores:
      Object.keys(submittedValues?.criterionScores ?? {}).length > 0
        ? submittedValues!.criterionScores
        : initialValues?.criterionScores ?? {},
    criterionFeedbacks:
      Object.keys(submittedValues?.criterionFeedbacks ?? {}).length > 0
        ? submittedValues!.criterionFeedbacks
        : initialValues?.criterionFeedbacks ?? {},
    criterionOptionSelections:
      Object.keys(submittedValues?.criterionOptionSelections ?? {}).length > 0
        ? submittedValues!.criterionOptionSelections
        : initialValues?.criterionOptionSelections ?? {}
  };
}

function SubmitButton({
  intent,
  children,
  secondary = false
}: {
  intent: "publicado" | "rascunho";
  children: string;
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={secondary ? "button button-secondary" : "button"}
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
    >
      {pending ? "Processando..." : children}
    </button>
  );
}

function formatScoreLabel(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(".", ",");
}

function formatOptionScoreLabel(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function resolveCriterionOptionLabel(
  criterion: EvaluationRubricCriterion,
  optionId?: string | null
) {
  if (!optionId) {
    return null;
  }

  const option = criterion.options.find((currentOption) => currentOption.id === optionId);

  if (!option) {
    return null;
  }

  return `${option.label} — ${formatOptionScoreLabel(option.scoreValue)} pontos`;
}

function formatPreviousCriterionScore(score: number) {
  return score.toFixed(1).replace(".", ",");
}

function buildPreviousSubmissionSummary(
  previousSubmission: EvaluationCriterionPreviousSubmission
) {
  if (previousSubmission.optionLabel) {
    return previousSubmission.optionLabel;
  }

  return "Lançamento anterior registrado sem opção textual.";
}

function buildPreviousSubmissionMeta(previousSubmission: EvaluationCriterionPreviousSubmission) {
  return `Nota: ${formatPreviousCriterionScore(previousSubmission.score)} · Data: ${formatDate(previousSubmission.evaluationDate)}`;
}

function CriterionPreviousSubmissionNotice({
  previousSubmission
}: {
  previousSubmission?: EvaluationCriterionPreviousSubmission | null;
}) {
  if (!previousSubmission) {
    return null;
  }

  return (
    <div className="criterion-previous-submission">
      <span className="criterion-previous-submission-summary">
        <strong>Último lançamento:</strong> {buildPreviousSubmissionSummary(previousSubmission)}
      </span>
      <span className="criterion-previous-submission-meta">
        {buildPreviousSubmissionMeta(previousSubmission)}
      </span>
      {previousSubmission.observation ? (
        <span
          className="criterion-previous-submission-feedback"
          title={previousSubmission.observation}
        >
          <strong>Devolutiva anterior:</strong> {previousSubmission.observation}
        </span>
      ) : null}
    </div>
  );
}

type CriterionFieldProps = {
  criterion: EvaluationRubricCriterion;
  error?: string;
  feedbackError?: string;
  defaultValue?: string;
  feedbackValue?: string;
  baselineValue?: string;
  baselineFeedback?: string;
  effectiveValue?: string;
  effectiveFeedback?: string;
  selectedOptionId?: string;
  baselineSelectedOptionId?: string;
  effectiveSelectedOptionId?: string;
  changedInCurrent?: boolean;
  disabled?: boolean;
  showReviewContext?: boolean;
};

function DescriptiveCriterionField({
  criterion,
  error,
  feedbackError,
  defaultValue,
  feedbackValue,
  baselineValue,
  baselineFeedback,
  effectiveValue,
  effectiveFeedback,
  changedInCurrent = false,
  disabled = false,
  showReviewContext = false
}: CriterionFieldProps) {
  const formattedBaselineValue = formatScoreLabel(baselineValue);
  const formattedEffectiveValue = formatScoreLabel(effectiveValue);
  const formattedDefaultValue = formatScoreLabel(defaultValue);

  return (
    <label
      className={`field criterion-field${
        error || feedbackError ? " criterion-field-invalid" : ""
      }${changedInCurrent ? " criterion-field-changed" : ""}`}
    >
      <span className="criterion-field-title">{criterion.name}</span>
      <span className="field-help">
        Peso {criterion.weightPercentage}% · escala de 0 a {criterion.maxScore}
      </span>
      <CriterionPreviousSubmissionNotice previousSubmission={criterion.previousSubmission} />
      {showReviewContext && formattedBaselineValue ? (
        <span className="field-help">
          Valor vigente antes desta revisão: {formattedBaselineValue}
        </span>
      ) : null}
      {!showReviewContext && disabled && formattedEffectiveValue ? (
        <span className="field-help">
          {changedInCurrent && formattedBaselineValue
            ? `Anterior: ${formattedBaselineValue} · Nesta versão: ${formattedEffectiveValue}`
            : `Valor considerado nesta versão: ${formattedEffectiveValue}`}
        </span>
      ) : null}
      {showReviewContext && formattedDefaultValue ? (
        <span className="field-help">
          Novo valor informado nesta revisão: {formattedDefaultValue}
        </span>
      ) : null}
      <input
        className={error ? "input input-invalid" : "input"}
        type="number"
        min={0}
        max={criterion.maxScore}
        step={0.1}
        name={`criterion__${criterion.id}`}
        placeholder={showReviewContext ? "Alterar apenas se necessário" : `0 a ${criterion.maxScore}`}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
      />
      {error ? <span className="field-error">{error}</span> : null}
      {showReviewContext && baselineFeedback ? (
        <span className="field-help">Justificativa vigente: {baselineFeedback}</span>
      ) : null}
      {!showReviewContext && disabled && effectiveFeedback ? (
        <span className="field-help">Justificativa desta versão: {effectiveFeedback}</span>
      ) : null}
      <textarea
        className={`${feedbackError ? "input input-invalid" : "input"} textarea criterion-feedback`}
        name={`feedback__${criterion.id}`}
        placeholder="Justificativa da perda de ponto (opcional)"
        rows={3}
        defaultValue={feedbackValue ?? ""}
        disabled={disabled}
      />
      {feedbackError ? <span className="field-error">{feedbackError}</span> : null}
    </label>
  );
}

function RubricCriterionField({
  criterion,
  error,
  feedbackError,
  feedbackValue,
  baselineFeedback,
  effectiveFeedback,
  selectedOptionId,
  baselineSelectedOptionId,
  effectiveSelectedOptionId,
  changedInCurrent = false,
  disabled = false,
  showReviewContext = false
}: CriterionFieldProps) {
  const [currentOptionId, setCurrentOptionId] = useState(selectedOptionId ?? "");

  useEffect(() => {
    setCurrentOptionId(selectedOptionId ?? "");
  }, [selectedOptionId]);

  const currentSelectedOption = criterion.options.find((option) => option.id === currentOptionId) ?? null;
  const baselineOptionLabel = resolveCriterionOptionLabel(criterion, baselineSelectedOptionId);
  const effectiveOptionLabel = resolveCriterionOptionLabel(criterion, effectiveSelectedOptionId);
  const visibleOptions = criterion.options
    .filter(
      (option) =>
        option.active ||
        option.id === selectedOptionId ||
        option.id === baselineSelectedOptionId ||
        option.id === effectiveSelectedOptionId
    )
    .sort((left, right) => left.order - right.order);

  return (
    <label
      className={`field criterion-field${
        error || feedbackError ? " criterion-field-invalid" : ""
      }${changedInCurrent ? " criterion-field-changed" : ""}`}
    >
      <span className="criterion-field-title">{criterion.name}</span>
      <span className="field-help">
        Peso {criterion.weightPercentage}% · nota definida pela opção selecionada
      </span>
      <CriterionPreviousSubmissionNotice previousSubmission={criterion.previousSubmission} />
      {showReviewContext && baselineOptionLabel ? (
        <span className="field-help">
          Opção vigente antes desta revisão: {baselineOptionLabel}
        </span>
      ) : null}
      {!showReviewContext && disabled && effectiveOptionLabel ? (
        <span className="field-help">
          {changedInCurrent && baselineOptionLabel
            ? `Anterior: ${baselineOptionLabel} · Nesta versão: ${effectiveOptionLabel}`
            : `Opção considerada nesta versão: ${effectiveOptionLabel}`}
        </span>
      ) : null}
      <select
        className={error ? "input input-invalid" : "input"}
        name={`option__${criterion.id}`}
        value={currentOptionId}
        disabled={disabled}
        onChange={(event) => setCurrentOptionId(event.currentTarget.value)}
      >
        <option value="">
          {showReviewContext ? "Manter valor atual" : "Selecione uma opção"}
        </option>
        {visibleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label} — {formatOptionScoreLabel(option.scoreValue)} pontos
            {!option.active ? " (inativa)" : ""}
          </option>
        ))}
      </select>
      {currentSelectedOption ? (
        <span className="field-help">
          Nota aplicada automaticamente: {formatOptionScoreLabel(currentSelectedOption.scoreValue)}
        </span>
      ) : null}
      {currentSelectedOption?.description ? (
        <span className="field-help">{currentSelectedOption.description}</span>
      ) : null}
      {error ? <span className="field-error">{error}</span> : null}
      {showReviewContext && baselineFeedback ? (
        <span className="field-help">Justificativa vigente: {baselineFeedback}</span>
      ) : null}
      {!showReviewContext && disabled && effectiveFeedback ? (
        <span className="field-help">Justificativa desta versão: {effectiveFeedback}</span>
      ) : null}
      <textarea
        className={`${feedbackError ? "input input-invalid" : "input"} textarea criterion-feedback`}
        name={`feedback__${criterion.id}`}
        placeholder="Observação complementar (opcional)"
        rows={3}
        defaultValue={feedbackValue ?? ""}
        disabled={disabled}
      />
      {feedbackError ? <span className="field-error">{feedbackError}</span> : null}
    </label>
  );
}

export function EvaluationForm({
  studentOptions,
  rubricGroups,
  evaluationMode,
  evaluationModelName,
  runtimeContextsByEnrollmentId,
  mode = "create",
  initialValues,
  readOnlyMessage,
  contextMessage
}: EvaluationFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    submitEvaluationAction,
    initialEvaluationActionState
  );
  const safeState = state ?? initialEvaluationActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const isReadOnly = mode === "readonly";
  const isEditing = mode === "edit";
  const isReviewFlow = mode === "review" || Boolean(initialValues?.evaluationOriginId);
  const resolvedFormValues = buildResolvedFormValues(
    studentOptions,
    initialValues,
    safeState.status === "error" ? safeState.formValues : undefined
  );
  const formRenderKey =
    safeState.status === "error" && safeState.submittedAt
      ? `evaluation-error-${safeState.submittedAt}`
      : `evaluation-${mode}-${
          resolvedFormValues.avaliacaoId ?? resolvedFormValues.avaliacaoOrigemId ?? "new"
        }`;
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(
    resolvedFormValues.matriculaTurmaId
  );
  const selectedRuntimeContext: EvaluationRuntimeFormContext = (() => {
    return (
      runtimeContextsByEnrollmentId[selectedEnrollmentId] ?? {
        enrollmentId: selectedEnrollmentId,
        courseId: null,
        offerId: null,
        modelId: null,
        modelCode: null,
        modelName: evaluationModelName ?? null,
        modality: evaluationMode,
        source: "legacy_global",
        applicationRuleId: null,
        applicationRuleSummary: null,
        rubricGroups
      }
    );
  })();
  const activeRubricGroups = selectedRuntimeContext.rubricGroups.length
    ? selectedRuntimeContext.rubricGroups
    : rubricGroups;
  const activeEvaluationMode = selectedRuntimeContext.modality;
  const selectedStudentLabel =
    studentOptions.find((student) => student.enrollmentId === selectedEnrollmentId)?.label ??
    "Aluno vinculado";
  const selectedStudentOption = studentOptions.find(
    (student) => student.enrollmentId === selectedEnrollmentId
  );
  const exceptionalReleaseNotice =
    !isReadOnly ? selectedStudentOption?.exceptionalReleaseNotice ?? null : null;
  const hasCriteriaError = Boolean(fieldErrors.criteria);

  function getFieldClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  useEffect(() => {
    setSelectedEnrollmentId(resolvedFormValues.matriculaTurmaId);
  }, [resolvedFormValues.matriculaTurmaId]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    if (mode === "review" && safeState.savedEvaluationId) {
      router.replace(`/avaliacoes/${safeState.savedEvaluationId}`);
      return;
    }

    if (mode === "create") {
      formRef.current?.reset();
    }

    router.refresh();
  }, [mode, router, safeState.savedEvaluationId, safeState.status, safeState.submittedAt]);

  return (
    <form ref={formRef} action={formAction} className="form-stack" key={formRenderKey}>
      {readOnlyMessage ? <div className="form-notice">{readOnlyMessage}</div> : null}
      {contextMessage ? <div className="form-notice">{contextMessage}</div> : null}
      {exceptionalReleaseNotice ? (
        <ExceptionalReleaseNotice notice={exceptionalReleaseNotice} compact />
      ) : null}
      <div className="management-tag-list">
        <span className="badge badge-muted">
          Modalidade:{" "}
          {activeEvaluationMode === "rubrica"
            ? "Avaliação por rubrica"
            : "Avaliação descritiva"}
        </span>
        {selectedRuntimeContext.modelName ? (
          <span className="badge badge-muted">Modelo: {selectedRuntimeContext.modelName}</span>
        ) : null}
      </div>

      {safeState.message ? (
        <div
          className={
            safeState.status === "success"
              ? "form-notice form-notice-success"
              : "form-notice form-notice-error"
          }
        >
          {safeState.message}
        </div>
      ) : null}

      {resolvedFormValues.avaliacaoId ? (
        <input type="hidden" name="avaliacao_id" value={resolvedFormValues.avaliacaoId} />
      ) : null}

      {mode === "review" && resolvedFormValues.avaliacaoOrigemId ? (
        <input
          type="hidden"
          name="avaliacao_origem_id"
          value={resolvedFormValues.avaliacaoOrigemId}
        />
      ) : null}

      {mode !== "create" ? (
        <input type="hidden" name="matricula_turma_id" value={selectedEnrollmentId} />
      ) : null}

      {isReviewFlow ? (
        <input type="hidden" name="tipo_lancamento" value="revisao" />
      ) : null}

      <div className="form-grid">
        <label className={getFieldClassName("matricula_turma_id")}>
          <span>Aluno</span>
          <select
            className={getInputClassName("matricula_turma_id")}
            name="matricula_turma_id"
            value={selectedEnrollmentId}
            disabled={mode !== "create"}
            aria-invalid={Boolean(fieldErrors.matricula_turma_id)}
            onChange={(event) => setSelectedEnrollmentId(event.currentTarget.value)}
          >
            {studentOptions.map((student) => (
              <option key={student.enrollmentId} value={student.enrollmentId}>
                {student.label}
              </option>
            ))}
          </select>
          {mode !== "create" ? <span className="field-help">{selectedStudentLabel}</span> : null}
          {fieldErrors.matricula_turma_id ? (
            <span className="field-error">{fieldErrors.matricula_turma_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("tipo_lancamento")}>
          <span>Tipo de lançamento</span>
          {isReviewFlow ? (
            <>
              <input
                className={getInputClassName("tipo_lancamento")}
                value="Revisão incremental vinculada"
                disabled
                readOnly
              />
              <span className="field-help">
                A avaliação publicada original permanece intacta. Esta revisão registra
                apenas os itens alterados.
              </span>
            </>
          ) : (
            <select
              className={getInputClassName("tipo_lancamento")}
              name="tipo_lancamento"
              defaultValue={resolvedFormValues.tipoLançamento}
              disabled={isReadOnly}
              aria-invalid={Boolean(fieldErrors.tipo_lancamento)}
            >
              <option value="parcial">Parcial</option>
              <option value="revisao">Revisão</option>
              <option value="fechamento">Fechamento</option>
            </select>
          )}
          {fieldErrors.tipo_lancamento ? (
            <span className="field-error">{fieldErrors.tipo_lancamento}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("avaliado_em")}>
          <span>Data do lançamento</span>
          <input
            className={getInputClassName("avaliado_em")}
            type="date"
            name="avaliado_em"
            defaultValue={resolvedFormValues.avaliadoEm}
            disabled={isReadOnly}
            aria-invalid={Boolean(fieldErrors.avaliado_em)}
          />
          <span className="field-help">
            Esta data identifica o lançamento no histórico acadêmico.
          </span>
          {fieldErrors.avaliado_em ? (
            <span className="field-error">{fieldErrors.avaliado_em}</span>
          ) : null}
        </label>
      </div>

      {activeRubricGroups.map((group) => (
        <div
          key={group.id}
          className={`criteria-form-group${
            hasCriteriaError ? " criteria-form-group-invalid" : ""
          }`}
        >
          <div className="criteria-form-group-header">
            <h3>{group.name}</h3>
            <span className="badge">{group.weightPercentage}% do semestre</span>
          </div>

          <div className="criteria-input-grid">
            {group.criteria.map((criterion) => (
              activeEvaluationMode === "rubrica" ? (
                <RubricCriterionField
                  key={`${selectedEnrollmentId}-${criterion.id}`}
                  criterion={criterion}
                  feedbackValue={resolvedFormValues.criterionFeedbacks[criterion.id] ?? ""}
                  selectedOptionId={
                    resolvedFormValues.criterionOptionSelections[criterion.id] ?? ""
                  }
                  baselineSelectedOptionId={
                    initialValues?.baselineCriterionOptionSelections[criterion.id]
                  }
                  baselineFeedback={initialValues?.baselineCriterionFeedbacks[criterion.id]}
                  effectiveSelectedOptionId={
                    initialValues?.effectiveCriterionOptionSelections[criterion.id]
                  }
                  effectiveFeedback={initialValues?.effectiveCriterionFeedbacks[criterion.id]}
                  changedInCurrent={
                    initialValues?.changedCriterionIds.includes(criterion.id) ?? false
                  }
                  error={fieldErrors[`option__${criterion.id}`]}
                  feedbackError={fieldErrors[`feedback__${criterion.id}`]}
                  disabled={isReadOnly}
                  showReviewContext={isReviewFlow && !isReadOnly}
                />
              ) : (
                <DescriptiveCriterionField
                  key={`${selectedEnrollmentId}-${criterion.id}`}
                  criterion={criterion}
                  defaultValue={resolvedFormValues.criterionScores[criterion.id] ?? ""}
                  feedbackValue={resolvedFormValues.criterionFeedbacks[criterion.id] ?? ""}
                  baselineValue={initialValues?.baselineCriterionScores[criterion.id]}
                  baselineFeedback={initialValues?.baselineCriterionFeedbacks[criterion.id]}
                  effectiveValue={initialValues?.effectiveCriterionScores[criterion.id]}
                  effectiveFeedback={initialValues?.effectiveCriterionFeedbacks[criterion.id]}
                  changedInCurrent={
                    initialValues?.changedCriterionIds.includes(criterion.id) ?? false
                  }
                  error={fieldErrors[`criterion__${criterion.id}`]}
                  feedbackError={fieldErrors[`feedback__${criterion.id}`]}
                  disabled={isReadOnly}
                  showReviewContext={isReviewFlow && !isReadOnly}
                />
              )
            ))}
          </div>
        </div>
      ))}

      {fieldErrors.criteria ? (
        <div className="form-notice form-notice-error">{fieldErrors.criteria}</div>
      ) : null}

      <label className={getFieldClassName("observacoes")}>
        <span>Observações finais</span>
        <textarea
          className={`${getInputClassName("observacoes")} textarea`}
          name="observacoes"
          placeholder="Registre observações finais sobre o desempenho do aluno, orientações e encaminhamentos."
          rows={5}
          defaultValue={resolvedFormValues.observacoes}
          disabled={isReadOnly}
          aria-invalid={Boolean(fieldErrors.observacoes)}
        />
        {fieldErrors.observacoes ? (
          <span className="field-error">{fieldErrors.observacoes}</span>
        ) : null}
      </label>

      {!isReadOnly ? (
        <div className="actions-row">
          <SubmitButton intent="publicado">
            {isReviewFlow ? "Publicar revisão" : "Publicar lançamento"}
          </SubmitButton>
          <SubmitButton intent="rascunho" secondary>
            {isReviewFlow
              ? isEditing
                ? "Salvar revisão novamente"
                : "Salvar revisão como rascunho"
              : isEditing
                ? "Salvar rascunho novamente"
                : "Salvar rascunho"}
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}


