"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  MasterCourseConfigurationCreateModelApplicationRuleForm,
  MasterCourseConfigurationModelApplicationRuleForm
} from "@/components/forms/master-course-configuration-application-rule-forms";
import {
  createCourseConfigurationModelAction,
  createCourseConfigurationCriterionAction,
  createCourseConfigurationCriterionOptionAction,
  createCourseConfigurationGroupAction,
  createCourseRequiredDocumentAction,
  duplicateCourseConfigurationModelAction,
  importCourseConfigurationModelFromBaseAction,
  setCourseConfigurationModelLaunchDefaultAction,
  deleteCourseConfigurationCriterionAction,
  deleteCourseConfigurationGroupAction,
  deleteCourseRequiredDocumentAction,
  updateCourseConfigurationCriterionAction,
  updateCourseConfigurationCriterionOptionAction,
  updateCourseConfigurationGroupAction,
  updateCourseConfigurationModelAction,
  updateCourseConfigurationRequiredDocumentAction
} from "@/app/(app)/master/cursos/configuracoes/actions";
import {
  createEmptyCourseConfigurationCreateModelFormValues,
  createEmptyCourseConfigurationDuplicateModelFormValues,
  createEmptyCourseConfigurationImportModelFormValues,
  createEmptyCourseConfigurationCreateCriterionFormValues,
  createEmptyCourseConfigurationCreateCriterionOptionFormValues,
  createEmptyCourseConfigurationCreateGroupFormValues,
  createEmptyCourseConfigurationCreateRequiredDocumentFormValues,
  createInitialCourseConfigurationActionState,
  initialCourseConfigurationCreateModelActionState,
  initialCourseConfigurationDeleteCriterionActionState,
  initialCourseConfigurationDeleteGroupActionState,
  initialCourseConfigurationDeleteRequiredDocumentActionState,
  initialCourseConfigurationCreateCriterionActionState,
  initialCourseConfigurationCreateCriterionOptionActionState,
  initialCourseConfigurationCreateGroupActionState,
  initialCourseConfigurationDuplicateModelActionState,
  initialCourseConfigurationImportModelActionState,
  initialCourseConfigurationCreateRequiredDocumentActionState,
  initialCourseConfigurationSetLaunchDefaultActionState,
  type CourseConfigurationActionState,
  type CourseConfigurationCreateModelFormValues,
  type CourseConfigurationCreateCriterionFormValues,
  type CourseConfigurationCreateCriterionOptionFormValues,
  type CourseConfigurationCreateGroupFormValues,
  type CourseConfigurationImportModelFormValues,
  type CourseConfigurationCreateRequiredDocumentFormValues,
  type CourseConfigurationDeleteCriterionFormValues,
  type CourseConfigurationDuplicateModelFormValues,
  type CourseConfigurationDeleteGroupFormValues,
  type CourseConfigurationDeleteRequiredDocumentFormValues,
  type CourseConfigurationCriterionFormValues,
  type CourseConfigurationCriterionOptionFormValues,
  type CourseConfigurationGroupFormValues,
  type CourseConfigurationModelFormValues,
  type CourseConfigurationRequiredDocumentFormValues
} from "@/app/(app)/master/cursos/configuracoes/state";
import type {
  CourseConfigurationCriterionEntry,
  CourseConfigurationCriterionOptionEntry,
  CourseConfigurationDocumentTypeOption,
  CourseConfigurationGroupEntry,
  CourseConfigurationImportableModelOption,
  CourseConfigurationModelApplicationRuleEntry,
  CourseConfigurationModelEntry,
  CourseConfigurationModelApplicationRuleOptions,
  CourseConfigurationRequiredDocumentEntry
} from "@/services/course-configurations";

function getFieldClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "field field-invalid" : "field";
}

function getInputClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "input input-invalid" : "input";
}

function renderNotice<TFormValues>(state: CourseConfigurationActionState<TFormValues>) {
  if (!state.message) {
    return null;
  }

  return (
    <div
      className={
        state.status === "success"
          ? "form-notice form-notice-success"
          : "form-notice form-notice-error"
      }
    >
      {state.message}
    </div>
  );
}

function normalizeCodeInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getNextOrderValue(values: Array<number | null | undefined>) {
  let maxValue = 0;

  for (const value of values) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      continue;
    }

    if (value > maxValue) {
      maxValue = value;
    }
  }

  return String(maxValue + 1);
}

function getNextModelVersionValue(models: CourseConfigurationModelEntry[]) {
  return getNextOrderValue(models.map((model) => model.version));
}

function buildCreateModelDraft(
  courseId: string,
  models: CourseConfigurationModelEntry[]
): CourseConfigurationCreateModelFormValues {
  return createEmptyCourseConfigurationCreateModelFormValues(
    courseId,
    getNextModelVersionValue(models)
  );
}

function buildImportedModelCode(sourceModel: CourseConfigurationImportableModelOption) {
  return normalizeCodeInput(`${sourceModel.code}_IMP`);
}

function buildImportModelDraft(
  courseId: string,
  sourceModels: CourseConfigurationImportableModelOption[],
  preferredSourceModelId?: string
): CourseConfigurationImportModelFormValues {
  const fallbackSourceModel =
    (preferredSourceModelId
      ? sourceModels.find((sourceModel) => sourceModel.id === preferredSourceModelId)
      : null) ??
    sourceModels[0] ??
    null;

  return createEmptyCourseConfigurationImportModelFormValues(
    courseId,
    fallbackSourceModel?.id ?? "",
    fallbackSourceModel?.name ?? "",
    fallbackSourceModel ? buildImportedModelCode(fallbackSourceModel) : "",
    "true"
  );
}

function buildModelDraft(model: CourseConfigurationModelEntry): CourseConfigurationModelFormValues {
  return {
    model_id: model.id,
    nome: model.name,
    descricao: model.description ?? "",
    modalidade: model.modality,
    ativo: model.isActive ? "true" : "false"
  };
}

function getModelModalityLabel(modality: CourseConfigurationModelEntry["modality"]) {
  return modality === "rubrica" ? "Avaliacao por rubrica" : "Avaliacao descritiva";
}

function getCourseConfigurationModelBadgeTone(modality: CourseConfigurationModelEntry["modality"]) {
  return modality === "rubrica" ? "status-bem" : "status-atencao";
}

function renderModelApplicationRuleSummary(
  applicationRule: CourseConfigurationModelApplicationRuleEntry
) {
  return (
    <div key={applicationRule.id} className="management-block-card">
      <div className="management-block-header">
        <div>
          <strong>{applicationRule.summary}</strong>
          <p className="field-help">
            Prioridade {applicationRule.priority} · Especificidade {applicationRule.specificity}
          </p>
        </div>
        <span
          className={`status-pill ${
            applicationRule.active ? "status-ativo" : "status-inativo"
          }`}
        >
          {applicationRule.active ? "Ativa" : "Inativa"}
        </span>
      </div>
      <div className="management-tag-list">
        {applicationRule.classLabel ? (
          <span className="badge badge-muted">{applicationRule.classLabel}</span>
        ) : null}
        {applicationRule.areaName ? (
          <span className="badge badge-muted">Area: {applicationRule.areaName}</span>
        ) : null}
        {applicationRule.curricularPeriod ? (
          <span className="badge badge-muted">
            {applicationRule.curricularPeriod}º periodo
          </span>
        ) : null}
        {applicationRule.semesterLabel ? (
          <span className="badge badge-muted">{applicationRule.semesterLabel}</span>
        ) : null}
        {applicationRule.offerName ? (
          <span className="badge badge-muted">{applicationRule.offerName}</span>
        ) : null}
      </div>
    </div>
  );
}

function renderRubricOptionsSummary(options: CourseConfigurationCriterionOptionEntry[]) {
  if (!options.length) {
    return (
      <div className="form-notice form-notice-error">
        Nenhuma opcao de rubrica cadastrada para este criterio ainda.
      </div>
    );
  }

  return (
    <div className="stack">
      {options.map((option) => (
        <div key={option.id} className="management-block-card">
          <div className="management-block-header">
            <div>
              <strong>{option.label}</strong>
              <p className="field-help">
                Ordem {option.order} · Nota automatica {option.scoreValue.toFixed(2)}
              </p>
            </div>
            <span className={`status-pill ${option.isActive ? "status-ativo" : "status-inativo"}`}>
              {option.isActive ? "Ativa" : "Inativa"}
            </span>
          </div>
          {option.description ? <p className="field-help">{option.description}</p> : null}
        </div>
      ))}
    </div>
  );
}

function buildGroupDraft(group: CourseConfigurationGroupEntry): CourseConfigurationGroupFormValues {
  return {
    group_id: group.id,
    nome: group.name,
    ordem: String(group.order),
    peso_percentual: String(group.weightPercent),
    ativo: group.isActive ? "true" : "false"
  };
}

function buildCriterionDraft(
  criterion: CourseConfigurationCriterionEntry
): CourseConfigurationCriterionFormValues {
  return {
    criterion_id: criterion.id,
    nome: criterion.name,
    descricao: criterion.description ?? "",
    ordem: String(criterion.order),
    peso_percentual: String(criterion.weightPercent),
    escala_maxima: String(criterion.maxScale),
    ativo: criterion.isActive ? "true" : "false"
  };
}

function buildCriterionOptionDraft(
  option: CourseConfigurationCriterionOptionEntry
): CourseConfigurationCriterionOptionFormValues {
  return {
    criterion_option_id: option.id,
    rotulo: option.label,
    descricao: option.description ?? "",
    valor_nota: String(option.scoreValue),
    ordem: String(option.order),
    ativo: option.isActive ? "true" : "false"
  };
}

function buildCreateCriterionOptionDraft(
  criterion: CourseConfigurationCriterionEntry
): CourseConfigurationCreateCriterionOptionFormValues {
  return createEmptyCourseConfigurationCreateCriterionOptionFormValues(
    criterion.id,
    getNextOrderValue(criterion.rubricOptions.map((option) => option.order)),
    "0"
  );
}

function formatRubricOptionScoreValue(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function buildRequiredDocumentDraft(
  requiredDocument: CourseConfigurationRequiredDocumentEntry
): CourseConfigurationRequiredDocumentFormValues {
  return {
    required_document_id: requiredDocument.id,
    nome_exibicao: requiredDocument.displayName ?? "",
    descricao: requiredDocument.description ?? "",
    obrigatorio: requiredDocument.isRequired ? "true" : "false",
    ordem: requiredDocument.order ? String(requiredDocument.order) : "",
    ativo: requiredDocument.isActive ? "true" : "false"
  };
}

function normalizeDocumentLabelComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveRequiredDocumentDisplayNameWarning(
  displayName: string,
  documentTypeName: string | null
) {
  const normalizedDisplayName = normalizeDocumentLabelComparison(displayName);
  const normalizedDocumentTypeName = normalizeDocumentLabelComparison(documentTypeName ?? "");

  if (!normalizedDisplayName || !normalizedDocumentTypeName) {
    return null;
  }

  if (
    normalizedDisplayName === normalizedDocumentTypeName ||
    normalizedDisplayName.includes(normalizedDocumentTypeName) ||
    normalizedDocumentTypeName.includes(normalizedDisplayName)
  ) {
    return null;
  }

  const displayTokens = new Set(normalizedDisplayName.split(/\s+/).filter(Boolean));
  const documentTypeTokens = normalizedDocumentTypeName.split(/\s+/).filter(Boolean);
  const sharedTokenCount = documentTypeTokens.filter((token) => displayTokens.has(token)).length;

  if (sharedTokenCount > 0) {
    return null;
  }

  return "Atencao: o nome de exibicao esta diferente do tipo documental selecionado. Confirme se esta diferenca e intencional.";
}

function buildCreateGroupDraft(
  courseId: string,
  models: CourseConfigurationModelEntry[],
  groups: CourseConfigurationGroupEntry[],
  preferredModelId?: string
) {
  const fallbackModelId =
    preferredModelId && models.some((model) => model.id === preferredModelId)
      ? preferredModelId
      : (models[0]?.id ?? "");
  const groupsForModel = groups.filter((group) => group.modelId === fallbackModelId);

  return createEmptyCourseConfigurationCreateGroupFormValues(
    courseId,
    fallbackModelId,
    getNextOrderValue(groupsForModel.map((group) => group.order)),
    groupsForModel.length ? "" : "100"
  );
}

function buildCreateCriterionDraft(
  courseId: string,
  groups: CourseConfigurationGroupEntry[],
  criteria: CourseConfigurationCriterionEntry[],
  preferredGroupId?: string
) {
  const fallbackGroupId =
    preferredGroupId && groups.some((group) => group.id === preferredGroupId)
      ? preferredGroupId
      : (groups[0]?.id ?? "");
  const criteriaForGroup = criteria.filter((criterion) => criterion.groupId === fallbackGroupId);

  return createEmptyCourseConfigurationCreateCriterionFormValues(
    courseId,
    fallbackGroupId,
    getNextOrderValue(criteriaForGroup.map((criterion) => criterion.order)),
    criteriaForGroup.length ? "" : "100",
    "10"
  );
}

function buildCreateRequiredDocumentDraft(
  courseId: string,
  availableDocumentTypes: CourseConfigurationDocumentTypeOption[],
  requiredDocuments: CourseConfigurationRequiredDocumentEntry[],
  preferredDocumentTypeId?: string
) {
  const fallbackDocumentTypeId =
    preferredDocumentTypeId &&
    availableDocumentTypes.some((documentType) => documentType.id === preferredDocumentTypeId)
      ? preferredDocumentTypeId
      : (availableDocumentTypes[0]?.id ?? "");

  return createEmptyCourseConfigurationCreateRequiredDocumentFormValues(
    courseId,
    fallbackDocumentTypeId,
    getNextOrderValue(requiredDocuments.map((requiredDocument) => requiredDocument.order)),
    fallbackDocumentTypeId ? "existente" : "novo"
  );
}

export function MasterCourseConfigurationModelForm({
  model,
  ruleOptions
}: {
  model: CourseConfigurationModelEntry;
  ruleOptions: CourseConfigurationModelApplicationRuleOptions;
}) {
  const [duplicateState, duplicateFormAction] = useActionState(
    duplicateCourseConfigurationModelAction,
    initialCourseConfigurationDuplicateModelActionState
  );
  const [state, formAction] = useActionState(
    updateCourseConfigurationModelAction,
    createInitialCourseConfigurationActionState<CourseConfigurationModelFormValues>()
  );
  const [setLaunchDefaultState, setLaunchDefaultFormAction] = useActionState(
    setCourseConfigurationModelLaunchDefaultAction,
    initialCourseConfigurationSetLaunchDefaultActionState
  );
  const safeState =
    state ?? createInitialCourseConfigurationActionState<CourseConfigurationModelFormValues>();
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationModelFormValues>(() =>
    buildModelDraft(model)
  );

  useEffect(() => {
    setDraft(buildModelDraft(model));
  }, [model]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <>
      <form action={formAction} className="form-stack master-course-configuration-edit-form">
        <input type="hidden" name="model_id" value={draft.model_id} />
        {renderNotice(safeState)}
        {renderNotice(setLaunchDefaultState)}
        {renderNotice(duplicateState)}

        <div className="management-tag-list">
          <span className="badge badge-muted">Codigo fixo: {model.code}</span>
          <span className="badge badge-muted">Versao fixa: {model.version}</span>
          <span
            className={`status-pill ${getCourseConfigurationModelBadgeTone(model.modality)}`}
          >
            {getModelModalityLabel(model.modality)}
          </span>
          {model.isLaunchDefault ? (
            <span className="status-pill status-bem">Padrao para lancamento</span>
          ) : (
            <span className="badge badge-muted">Modelo complementar</span>
          )}
        </div>

        <div className="form-grid">
          <label className={getFieldClassName(fieldErrors, "nome")}>
            <span>Nome</span>
            <input
              className={getInputClassName(fieldErrors, "nome")}
              name="nome"
              value={draft.nome}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, nome: value }));
              }}
            />
            {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "modalidade")}>
            <span>Modalidade</span>
            <select
              className={getInputClassName(fieldErrors, "modalidade")}
              name="modalidade"
              value={draft.modalidade}
              onChange={(event) => {
                const value = event.currentTarget.value as "descritiva" | "rubrica";

                setDraft((currentDraft) => ({ ...currentDraft, modalidade: value }));
              }}
            >
              <option value="descritiva">Avaliacao descritiva</option>
              <option value="rubrica">Avaliacao por rubrica</option>
            </select>
            {fieldErrors.modalidade ? (
              <span className="field-error">{fieldErrors.modalidade}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ativo")}>
            <span>Status</span>
            <select
              className={getInputClassName(fieldErrors, "ativo")}
              name="ativo"
              value={draft.ativo}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ativo: value }));
              }}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
          </label>
        </div>

        <label className={getFieldClassName(fieldErrors, "descricao")}>
          <span>Descricao</span>
          <textarea
            className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
            name="descricao"
            rows={3}
            value={draft.descricao}
            onChange={(event) => {
              const value = event.currentTarget.value;

              setDraft((currentDraft) => ({
                ...currentDraft,
                descricao: value
              }));
            }}
          />
          {fieldErrors.descricao ? (
            <span className="field-error">{fieldErrors.descricao}</span>
          ) : null}
        </label>

        <div className="actions-row">
          <button className="button button-secondary" type="submit">
            Salvar modelo
          </button>
          <button
            className="button button-secondary"
            formAction={setLaunchDefaultFormAction}
            type="submit"
            disabled={!model.isActive || model.isLaunchDefault}
          >
            {model.isLaunchDefault ? "Padrao atual" : "Definir como padrao"}
          </button>
        </div>
      </form>

      <form action={duplicateFormAction} className="actions-row">
        <input type="hidden" name="model_id" value={model.id} />
        <button className="button button-secondary button-small" type="submit">
          Duplicar modelo
        </button>
        <span className="field-help">
          O clone copia grupos, criterios e opcoes de rubrica, mas nasce sem regra de
          aplicacao e sem virar padrao automaticamente.
        </span>
      </form>

      <div className="stack">
        <div>
          <strong>Regras de aplicacao</strong>
          <p className="field-help">
            Defina onde este modelo deve ser usado. Para modelos por 6o, 7o ou 8o periodo,
            prefira regras por periodo curricular. Regras mais especificas e com maior
            prioridade vencem no runtime futuro.
          </p>
        </div>
        {model.applicationRuleConflictWarning ? (
          <div className="form-notice">{model.applicationRuleConflictWarning}</div>
        ) : null}
        {model.applicationRules.length ? (
          <div className="stack">
            {model.applicationRules.map((applicationRule) => (
              <MasterCourseConfigurationModelApplicationRuleForm
                key={applicationRule.id}
                applicationRule={applicationRule}
                ruleOptions={ruleOptions}
              />
            ))}
          </div>
        ) : (
          <p className="field-help">
            Nenhuma regra especifica cadastrada. Neste caso, o modelo depende do padrao geral
            do curso ou do fallback legado.
          </p>
        )}
        <MasterCourseConfigurationCreateModelApplicationRuleForm
          modelId={model.id}
          ruleOptions={ruleOptions}
        />
      </div>
    </>
  );
}

export function MasterCourseConfigurationCreateModelForm({
  courseId,
  models
}: {
  courseId: string;
  models: CourseConfigurationModelEntry[];
}) {
  const [state, formAction] = useActionState(
    createCourseConfigurationModelAction,
    initialCourseConfigurationCreateModelActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateModelActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCreateModelFormValues>(() =>
    buildCreateModelDraft(courseId, models)
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    setDraft(buildCreateModelDraft(courseId, models));
  }, [courseId, models, safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof CourseConfigurationCreateModelFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="course_id" value={draft.course_id} />
      {renderNotice(safeState)}

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "codigo")}>
          <span>Codigo</span>
          <input
            className={getInputClassName(fieldErrors, "codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", normalizeCodeInput(event.currentTarget.value))}
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "versao")}>
          <span>Versao</span>
          <input
            className={getInputClassName(fieldErrors, "versao")}
            name="versao"
            type="number"
            min="1"
            step="1"
            value={draft.versao}
            onChange={(event) => updateDraft("versao", event.currentTarget.value)}
          />
          {fieldErrors.versao ? <span className="field-error">{fieldErrors.versao}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "modalidade")}>
          <span>Modalidade</span>
          <select
            className={getInputClassName(fieldErrors, "modalidade")}
            name="modalidade"
            value={draft.modalidade}
            onChange={(event) =>
              updateDraft(
                "modalidade",
                event.currentTarget.value as CourseConfigurationCreateModelFormValues["modalidade"]
              )
            }
          >
            <option value="descritiva">Avaliacao descritiva</option>
            <option value="rubrica">Avaliacao por rubrica</option>
          </select>
          {fieldErrors.modalidade ? (
            <span className="field-error">{fieldErrors.modalidade}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <label className={getFieldClassName(fieldErrors, "descricao")}>
        <span>Descricao</span>
        <textarea
          className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
          name="descricao"
          rows={3}
          value={draft.descricao}
          onChange={(event) => updateDraft("descricao", event.currentTarget.value)}
        />
        {fieldErrors.descricao ? (
          <span className="field-error">{fieldErrors.descricao}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar novo modelo
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationImportModelForm({
  courseId,
  sourceLabel,
  sourceModels
}: {
  courseId: string;
  sourceLabel: string;
  sourceModels: CourseConfigurationImportableModelOption[];
}) {
  const [state, formAction] = useActionState(
    importCourseConfigurationModelFromBaseAction,
    initialCourseConfigurationImportModelActionState
  );
  const safeState = state ?? initialCourseConfigurationImportModelActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationImportModelFormValues>(() =>
    buildImportModelDraft(courseId, sourceModels)
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    setDraft(buildImportModelDraft(courseId, sourceModels, draft.source_model_id));
  }, [
    courseId,
    draft.source_model_id,
    safeState.formValues,
    safeState.status,
    safeState.submittedAt,
    sourceModels
  ]);

  function updateDraft(field: keyof CourseConfigurationImportModelFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleSourceModelChange(nextSourceModelId: string) {
    const nextDraft = buildImportModelDraft(courseId, sourceModels, nextSourceModelId);

    setDraft((currentDraft) => ({
      ...currentDraft,
      source_model_id: nextDraft.source_model_id,
      nome: nextDraft.nome,
      codigo: nextDraft.codigo
    }));
  }

  const selectedSourceModel =
    sourceModels.find((sourceModel) => sourceModel.id === draft.source_model_id) ??
    sourceModels[0] ??
    null;

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="destination_course_id" value={draft.destination_course_id} />
      {renderNotice(safeState)}

      <div className="form-notice">
        <strong>Origem da base padrao</strong>
        <p className="field-help">{sourceLabel}</p>
      </div>

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "source_model_id")}>
          <span>Modelo de origem</span>
          <select
            className={getInputClassName(fieldErrors, "source_model_id")}
            name="source_model_id"
            value={draft.source_model_id}
            onChange={(event) => handleSourceModelChange(event.currentTarget.value)}
          >
            {sourceModels.map((sourceModel) => (
              <option key={sourceModel.id} value={sourceModel.id}>
                {sourceModel.name} ({sourceModel.code})
              </option>
            ))}
          </select>
          {fieldErrors.source_model_id ? (
            <span className="field-error">{fieldErrors.source_model_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome do novo modelo</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "codigo")}>
          <span>Codigo sugerido</span>
          <input
            className={getInputClassName(fieldErrors, "codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", normalizeCodeInput(event.currentTarget.value))}
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "copiar_regras_portateis")}>
          <span>Regras por periodo curricular</span>
          <select
            className={getInputClassName(fieldErrors, "copiar_regras_portateis")}
            name="copiar_regras_portateis"
            value={draft.copiar_regras_portateis}
            onChange={(event) =>
              updateDraft("copiar_regras_portateis", event.currentTarget.value)
            }
          >
            <option value="true">Copiar regras portaveis</option>
            <option value="false">Nao copiar regras</option>
          </select>
          {fieldErrors.copiar_regras_portateis ? (
            <span className="field-error">{fieldErrors.copiar_regras_portateis}</span>
          ) : null}
        </label>
      </div>

      {selectedSourceModel ? (
        <div className="management-block-card">
          <div className="management-block-header">
            <div>
              <strong>{selectedSourceModel.name}</strong>
              <p className="field-help">
                {getModelModalityLabel(selectedSourceModel.modality)} · versao{" "}
                {selectedSourceModel.version}
              </p>
            </div>
            <span
              className={`status-pill ${getCourseConfigurationModelBadgeTone(selectedSourceModel.modality)}`}
            >
              {getModelModalityLabel(selectedSourceModel.modality)}
            </span>
          </div>
          <div className="management-tag-list">
            <span className="badge badge-muted">
              {selectedSourceModel.groupCount} grupo(s)
            </span>
            <span className="badge badge-muted">
              {selectedSourceModel.criterionCount} criterio(s)
            </span>
            <span className="badge badge-muted">
              {selectedSourceModel.rubricOptionCount} opcao(oes) de rubrica
            </span>
            <span className="badge badge-muted">
              {selectedSourceModel.portableCurricularRuleCount} regra(s) portavel(is)
            </span>
          </div>
          <p className="field-help">
            A importacao cria um novo modelo local com grupos, criterios e opcoes de rubrica
            remapeados. Regras com turma, semestre, area ou oferta nao sao copiadas
            automaticamente. O modelo importado nasce como complementar e nao vira padrao
            para lancamento sozinho.
          </p>
        </div>
      ) : null}

      <div className="actions-row">
        <button className="button button-secondary" type="submit" disabled={!sourceModels.length}>
          Importar modelo da base padrao
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationCreateGroupForm({
  courseId,
  models,
  groups,
  preferredModelId
}: {
  courseId: string;
  models: CourseConfigurationModelEntry[];
  groups: CourseConfigurationGroupEntry[];
  preferredModelId?: string;
}) {
  const [state, formAction] = useActionState(
    createCourseConfigurationGroupAction,
    initialCourseConfigurationCreateGroupActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateGroupActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCreateGroupFormValues>(() =>
    buildCreateGroupDraft(courseId, models, groups, preferredModelId)
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    setDraft(
      buildCreateGroupDraft(
        courseId,
        models,
        groups,
        draft.model_id || preferredModelId
      )
    );
  }, [
    courseId,
    groups,
    models,
    preferredModelId,
    safeState.formValues,
    safeState.status,
    safeState.submittedAt
  ]);

  function updateDraft(field: keyof CourseConfigurationCreateGroupFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleModelChange(nextModelId: string) {
    const nextDraft = buildCreateGroupDraft(courseId, models, groups, nextModelId);

    setDraft((currentDraft) => ({
      ...currentDraft,
      model_id: nextDraft.model_id,
      ordem: nextDraft.ordem,
      peso_percentual: nextDraft.peso_percentual
    }));
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="course_id" value={draft.course_id} />
      {renderNotice(safeState)}

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "model_id")}>
          <span>Modelo</span>
          <select
            className={getInputClassName(fieldErrors, "model_id")}
            name="model_id"
            value={draft.model_id}
            onChange={(event) => handleModelChange(event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} ({model.code})
              </option>
            ))}
          </select>
          {fieldErrors.model_id ? (
            <span className="field-error">{fieldErrors.model_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "codigo")}>
          <span>Codigo</span>
          <input
            className={getInputClassName(fieldErrors, "codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", normalizeCodeInput(event.currentTarget.value))}
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ordem")}>
          <span>Ordem</span>
          <input
            className={getInputClassName(fieldErrors, "ordem")}
            name="ordem"
            type="number"
            min="1"
            step="1"
            value={draft.ordem}
            onChange={(event) => updateDraft("ordem", event.currentTarget.value)}
          />
          {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "peso_percentual")}>
          <span>Peso percentual</span>
          <input
            className={getInputClassName(fieldErrors, "peso_percentual")}
            name="peso_percentual"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={draft.peso_percentual}
            onChange={(event) => updateDraft("peso_percentual", event.currentTarget.value)}
          />
          {fieldErrors.peso_percentual ? (
            <span className="field-error">{fieldErrors.peso_percentual}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button button-secondary" type="submit" disabled={!models.length}>
          Salvar novo grupo
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationGroupForm({
  group
}: {
  group: CourseConfigurationGroupEntry;
}) {
  const [state, formAction] = useActionState(
    updateCourseConfigurationGroupAction,
    createInitialCourseConfigurationActionState<CourseConfigurationGroupFormValues>()
  );
  const [deleteState, deleteFormAction] = useActionState(
    deleteCourseConfigurationGroupAction,
    initialCourseConfigurationDeleteGroupActionState
  );
  const safeState =
    state ?? createInitialCourseConfigurationActionState<CourseConfigurationGroupFormValues>();
  const safeDeleteState = deleteState ?? initialCourseConfigurationDeleteGroupActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationGroupFormValues>(() =>
    buildGroupDraft(group)
  );

  useEffect(() => {
    setDraft(buildGroupDraft(group));
  }, [group]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <>
      <form action={formAction} className="form-stack master-course-configuration-edit-form">
        <input type="hidden" name="group_id" value={draft.group_id} />
        {renderNotice(safeState)}
        {renderNotice(safeDeleteState)}

        <div className="management-tag-list">
          <span className="badge badge-muted">Codigo fixo: {group.code}</span>
          <span className="badge badge-muted">Modelo fixo: {group.modelCode}</span>
        </div>

        <div className="form-grid">
          <label className={getFieldClassName(fieldErrors, "nome")}>
            <span>Nome</span>
            <input
              className={getInputClassName(fieldErrors, "nome")}
              name="nome"
              value={draft.nome}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, nome: value }));
              }}
            />
            {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ordem")}>
            <span>Ordem</span>
            <input
              className={getInputClassName(fieldErrors, "ordem")}
              name="ordem"
              type="number"
              min="1"
              step="1"
              value={draft.ordem}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ordem: value }));
              }}
            />
            {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "peso_percentual")}>
            <span>Peso percentual</span>
            <input
              className={getInputClassName(fieldErrors, "peso_percentual")}
              name="peso_percentual"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={draft.peso_percentual}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({
                  ...currentDraft,
                  peso_percentual: value
                }));
              }}
            />
            {fieldErrors.peso_percentual ? (
              <span className="field-error">{fieldErrors.peso_percentual}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ativo")}>
            <span>Status</span>
            <select
              className={getInputClassName(fieldErrors, "ativo")}
              name="ativo"
              value={draft.ativo}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ativo: value }));
              }}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
          </label>
        </div>

        <div className="actions-row">
          <button className="button button-secondary" type="submit">
            Salvar grupo
          </button>
        </div>
      </form>
      <form
        action={deleteFormAction}
        className="actions-row"
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Excluir o grupo ${group.name}? Se ele tiver criterios vinculados, a exclusao sera bloqueada.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="group_id" value={group.id} />
        <button className="button button-danger button-small" type="submit">
          Excluir grupo
        </button>
      </form>
    </>
  );
}

export function MasterCourseConfigurationCreateCriterionForm({
  courseId,
  groups,
  criteria
}: {
  courseId: string;
  groups: CourseConfigurationGroupEntry[];
  criteria: CourseConfigurationCriterionEntry[];
}) {
  const [state, formAction] = useActionState(
    createCourseConfigurationCriterionAction,
    initialCourseConfigurationCreateCriterionActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateCriterionActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCreateCriterionFormValues>(() =>
    buildCreateCriterionDraft(courseId, groups, criteria)
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    setDraft(buildCreateCriterionDraft(courseId, groups, criteria, draft.group_id));
  }, [
    courseId,
    criteria,
    draft.group_id,
    groups,
    safeState.formValues,
    safeState.status,
    safeState.submittedAt
  ]);

  function updateDraft(field: keyof CourseConfigurationCreateCriterionFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleGroupChange(nextGroupId: string) {
    const nextDraft = buildCreateCriterionDraft(courseId, groups, criteria, nextGroupId);

    setDraft((currentDraft) => ({
      ...currentDraft,
      group_id: nextDraft.group_id,
      ordem: nextDraft.ordem,
      peso_percentual: nextDraft.peso_percentual
    }));
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="course_id" value={draft.course_id} />
      {renderNotice(safeState)}

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "group_id")}>
          <span>Grupo</span>
          <select
            className={getInputClassName(fieldErrors, "group_id")}
            name="group_id"
            value={draft.group_id}
            onChange={(event) => handleGroupChange(event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.modelCode})
              </option>
            ))}
          </select>
          {fieldErrors.group_id ? (
            <span className="field-error">{fieldErrors.group_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "codigo")}>
          <span>Codigo</span>
          <input
            className={getInputClassName(fieldErrors, "codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", normalizeCodeInput(event.currentTarget.value))}
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ordem")}>
          <span>Ordem</span>
          <input
            className={getInputClassName(fieldErrors, "ordem")}
            name="ordem"
            type="number"
            min="1"
            step="1"
            value={draft.ordem}
            onChange={(event) => updateDraft("ordem", event.currentTarget.value)}
          />
          {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "peso_percentual")}>
          <span>Peso percentual</span>
          <input
            className={getInputClassName(fieldErrors, "peso_percentual")}
            name="peso_percentual"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={draft.peso_percentual}
            onChange={(event) => updateDraft("peso_percentual", event.currentTarget.value)}
          />
          {fieldErrors.peso_percentual ? (
            <span className="field-error">{fieldErrors.peso_percentual}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "escala_maxima")}>
          <span>Escala maxima</span>
          <input
            className={getInputClassName(fieldErrors, "escala_maxima")}
            name="escala_maxima"
            type="number"
            min="0.01"
            step="0.01"
            value={draft.escala_maxima}
            onChange={(event) => updateDraft("escala_maxima", event.currentTarget.value)}
          />
          {fieldErrors.escala_maxima ? (
            <span className="field-error">{fieldErrors.escala_maxima}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <label className={getFieldClassName(fieldErrors, "descricao")}>
        <span>Descricao</span>
        <textarea
          className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
          name="descricao"
          rows={3}
          value={draft.descricao}
          onChange={(event) => updateDraft("descricao", event.currentTarget.value)}
        />
        {fieldErrors.descricao ? (
          <span className="field-error">{fieldErrors.descricao}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit" disabled={!groups.length}>
          Salvar novo criterio
        </button>
      </div>
    </form>
  );
}

function MasterCourseConfigurationCriterionOptionForm({
  option
}: {
  option: CourseConfigurationCriterionOptionEntry;
}) {
  const [state, formAction] = useActionState(
    updateCourseConfigurationCriterionOptionAction,
    createInitialCourseConfigurationActionState<CourseConfigurationCriterionOptionFormValues>()
  );
  const safeState =
    state ??
    createInitialCourseConfigurationActionState<CourseConfigurationCriterionOptionFormValues>();
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCriterionOptionFormValues>(() =>
    buildCriterionOptionDraft(option)
  );

  useEffect(() => {
    setDraft(buildCriterionOptionDraft(option));
  }, [option]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(
    field: keyof CourseConfigurationCriterionOptionFormValues,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  return (
    <form action={formAction} className="form-stack management-block-card">
      <input type="hidden" name="criterion_option_id" value={draft.criterion_option_id} />
      {renderNotice(safeState)}

      <div className="management-block-header">
        <div>
          <strong>{option.label}</strong>
          <p className="field-help">
            Ordem {option.order} · Nota automática {formatRubricOptionScoreValue(option.scoreValue)}
          </p>
        </div>
        <span className={`status-pill ${option.isActive ? "status-ativo" : "status-inativo"}`}>
          {option.isActive ? "Ativa" : "Inativa"}
        </span>
      </div>

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "rotulo")}>
          <span>Rótulo</span>
          <input
            className={getInputClassName(fieldErrors, "rotulo")}
            name="rotulo"
            value={draft.rotulo}
            onChange={(event) => updateDraft("rotulo", event.currentTarget.value)}
          />
          {fieldErrors.rotulo ? <span className="field-error">{fieldErrors.rotulo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "valor_nota")}>
          <span>Nota</span>
          <input
            className={getInputClassName(fieldErrors, "valor_nota")}
            name="valor_nota"
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={draft.valor_nota}
            onChange={(event) => updateDraft("valor_nota", event.currentTarget.value)}
          />
          {fieldErrors.valor_nota ? (
            <span className="field-error">{fieldErrors.valor_nota}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ordem")}>
          <span>Ordem</span>
          <input
            className={getInputClassName(fieldErrors, "ordem")}
            name="ordem"
            type="number"
            min="1"
            step="1"
            value={draft.ordem}
            onChange={(event) => updateDraft("ordem", event.currentTarget.value)}
          />
          {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <label className={getFieldClassName(fieldErrors, "descricao")}>
        <span>Descrição</span>
        <textarea
          className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
          name="descricao"
          rows={2}
          value={draft.descricao}
          onChange={(event) => updateDraft("descricao", event.currentTarget.value)}
        />
        {fieldErrors.descricao ? (
          <span className="field-error">{fieldErrors.descricao}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar opção
        </button>
      </div>
    </form>
  );
}

function MasterCourseConfigurationCreateCriterionOptionForm({
  criterion
}: {
  criterion: CourseConfigurationCriterionEntry;
}) {
  const [state, formAction] = useActionState(
    createCourseConfigurationCriterionOptionAction,
    initialCourseConfigurationCreateCriterionOptionActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateCriterionOptionActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCreateCriterionOptionFormValues>(() =>
    buildCreateCriterionOptionDraft(criterion)
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    setDraft(buildCreateCriterionOptionDraft(criterion));
  }, [criterion, safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(
    field: keyof CourseConfigurationCreateCriterionOptionFormValues,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="criterion_id" value={draft.criterion_id} />
      {renderNotice(safeState)}

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "rotulo")}>
          <span>Rótulo</span>
          <input
            className={getInputClassName(fieldErrors, "rotulo")}
            name="rotulo"
            value={draft.rotulo}
            onChange={(event) => updateDraft("rotulo", event.currentTarget.value)}
          />
          {fieldErrors.rotulo ? <span className="field-error">{fieldErrors.rotulo}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "valor_nota")}>
          <span>Nota</span>
          <input
            className={getInputClassName(fieldErrors, "valor_nota")}
            name="valor_nota"
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={draft.valor_nota}
            onChange={(event) => updateDraft("valor_nota", event.currentTarget.value)}
          />
          {fieldErrors.valor_nota ? (
            <span className="field-error">{fieldErrors.valor_nota}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ordem")}>
          <span>Ordem</span>
          <input
            className={getInputClassName(fieldErrors, "ordem")}
            name="ordem"
            type="number"
            min="1"
            step="1"
            value={draft.ordem}
            onChange={(event) => updateDraft("ordem", event.currentTarget.value)}
          />
          {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <label className={getFieldClassName(fieldErrors, "descricao")}>
        <span>Descrição</span>
        <textarea
          className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
          name="descricao"
          rows={2}
          value={draft.descricao}
          onChange={(event) => updateDraft("descricao", event.currentTarget.value)}
        />
        {fieldErrors.descricao ? (
          <span className="field-error">{fieldErrors.descricao}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Adicionar opção
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationCriterionForm({
  criterion
}: {
  criterion: CourseConfigurationCriterionEntry;
}) {
  const [state, formAction] = useActionState(
    updateCourseConfigurationCriterionAction,
    createInitialCourseConfigurationActionState<CourseConfigurationCriterionFormValues>()
  );
  const [deleteState, deleteFormAction] = useActionState(
    deleteCourseConfigurationCriterionAction,
    initialCourseConfigurationDeleteCriterionActionState
  );
  const safeState =
    state ?? createInitialCourseConfigurationActionState<CourseConfigurationCriterionFormValues>();
  const safeDeleteState = deleteState ?? initialCourseConfigurationDeleteCriterionActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCriterionFormValues>(() =>
    buildCriterionDraft(criterion)
  );

  useEffect(() => {
    setDraft(buildCriterionDraft(criterion));
  }, [criterion]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <>
      <form action={formAction} className="form-stack master-course-configuration-edit-form">
        <input type="hidden" name="criterion_id" value={draft.criterion_id} />
        {renderNotice(safeState)}
        {renderNotice(safeDeleteState)}

        <div className="management-tag-list">
          <span className="badge badge-muted">Codigo fixo: {criterion.code}</span>
          <span className="badge badge-muted">Grupo fixo: {criterion.groupName}</span>
          <span className="badge badge-muted">
            {getModelModalityLabel(criterion.modelModality)}
          </span>
        </div>

        <div className="form-grid">
          <label className={getFieldClassName(fieldErrors, "nome")}>
            <span>Nome</span>
            <input
              className={getInputClassName(fieldErrors, "nome")}
              name="nome"
              value={draft.nome}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, nome: value }));
              }}
            />
            {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ordem")}>
            <span>Ordem</span>
            <input
              className={getInputClassName(fieldErrors, "ordem")}
              name="ordem"
              type="number"
              min="1"
              step="1"
              value={draft.ordem}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ordem: value }));
              }}
            />
            {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "peso_percentual")}>
            <span>Peso percentual</span>
            <input
              className={getInputClassName(fieldErrors, "peso_percentual")}
              name="peso_percentual"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={draft.peso_percentual}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({
                  ...currentDraft,
                  peso_percentual: value
                }));
              }}
            />
            {fieldErrors.peso_percentual ? (
              <span className="field-error">{fieldErrors.peso_percentual}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "escala_maxima")}>
            <span>Escala maxima</span>
            <input
              className={getInputClassName(fieldErrors, "escala_maxima")}
              name="escala_maxima"
              type="number"
              min="0.01"
              step="0.01"
              value={draft.escala_maxima}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({
                  ...currentDraft,
                  escala_maxima: value
                }));
              }}
            />
            {fieldErrors.escala_maxima ? (
              <span className="field-error">{fieldErrors.escala_maxima}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ativo")}>
            <span>Status</span>
            <select
              className={getInputClassName(fieldErrors, "ativo")}
              name="ativo"
              value={draft.ativo}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ativo: value }));
              }}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
          </label>
        </div>

        <label className={getFieldClassName(fieldErrors, "descricao")}>
          <span>Descricao</span>
          <textarea
            className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
            name="descricao"
            rows={3}
            value={draft.descricao}
            onChange={(event) => {
              const value = event.currentTarget.value;

              setDraft((currentDraft) => ({
                ...currentDraft,
                descricao: value
              }));
            }}
          />
          {fieldErrors.descricao ? (
            <span className="field-error">{fieldErrors.descricao}</span>
          ) : null}
        </label>

        <div className="actions-row">
          <button className="button button-secondary" type="submit">
            Salvar criterio
          </button>
        </div>
      </form>
      {criterion.modelModality === "rubrica" ? (
        <div className="form-stack master-course-configuration-edit-form">
          <div className="management-block-header">
            <div>
              <h6>Opcoes da rubrica</h6>
              <p className="field-help">
                Configure os rótulos, notas automáticas e a ordem de exibição usadas pelo
                professor na avaliação por rubrica.
              </p>
            </div>
          </div>
          {criterion.rubricOptions.length ? (
            <div className="stack">
              {criterion.rubricOptions.map((option) => (
                <MasterCourseConfigurationCriterionOptionForm
                  key={option.id}
                  option={option}
                />
              ))}
            </div>
          ) : (
            <div className="form-notice form-notice-error">
              Nenhuma opcao de rubrica cadastrada para este criterio ainda.
            </div>
          )}
          <MasterCourseConfigurationCreateCriterionOptionForm criterion={criterion} />
        </div>
      ) : (
        <div className="form-stack master-course-configuration-edit-form">
          <div className="form-notice">
            Opcoes de rubrica disponiveis apenas para modelos do tipo Avaliacao por rubrica.
          </div>
        </div>
      )}
      <form
        action={deleteFormAction}
        className="actions-row"
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Excluir o criterio ${criterion.name}? Se ele ja tiver historico de avaliacoes, sera desativado para preservar os registros.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="criterion_id" value={criterion.id} />
        <button className="button button-danger button-small" type="submit">
          Excluir criterio
        </button>
      </form>
    </>
  );
}

export function MasterCourseConfigurationCreateRequiredDocumentForm({
  courseId,
  requiredDocuments,
  documentTypeOptions
}: {
  courseId: string;
  requiredDocuments: CourseConfigurationRequiredDocumentEntry[];
  documentTypeOptions: CourseConfigurationDocumentTypeOption[];
}) {
  const [state, formAction] = useActionState(
    createCourseRequiredDocumentAction,
    initialCourseConfigurationCreateRequiredDocumentActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateRequiredDocumentActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const activeUsedTypeIds = useMemo(
    () =>
      new Set(
        requiredDocuments
          .filter((requiredDocument) => requiredDocument.isActive)
          .map((requiredDocument) => requiredDocument.typeId)
      ),
    [requiredDocuments]
  );
  const availableDocumentTypes = useMemo(() => {
    return documentTypeOptions.filter(
      (documentType) => !activeUsedTypeIds.has(documentType.id)
    );
  }, [activeUsedTypeIds, documentTypeOptions]);
  const documentTypesById = useMemo(
    () => new Map(documentTypeOptions.map((documentType) => [documentType.id, documentType])),
    [documentTypeOptions]
  );
  const [draft, setDraft] = useState<CourseConfigurationCreateRequiredDocumentFormValues>(() =>
    buildCreateRequiredDocumentDraft(courseId, availableDocumentTypes, requiredDocuments)
  );
  const [documentTypeSearch, setDocumentTypeSearch] = useState("");

  const filteredAvailableDocumentTypes = useMemo(() => {
    const normalizedSearch = normalizeDocumentLabelComparison(documentTypeSearch);

    if (!normalizedSearch) {
      return availableDocumentTypes;
    }

    const filteredDocumentTypes = availableDocumentTypes.filter((documentType) => {
      const searchableText = `${documentType.name} ${documentType.code}`;

      return normalizeDocumentLabelComparison(searchableText).includes(normalizedSearch);
    });

    if (
      draft.tipo_documento_id &&
      !filteredDocumentTypes.some((documentType) => documentType.id === draft.tipo_documento_id)
    ) {
      const selectedDocumentType = availableDocumentTypes.find(
        (documentType) => documentType.id === draft.tipo_documento_id
      );

      if (selectedDocumentType) {
        return [selectedDocumentType, ...filteredDocumentTypes];
      }
    }

    return filteredDocumentTypes;
  }, [availableDocumentTypes, documentTypeSearch, draft.tipo_documento_id]);

  function resolveSuggestedDisplayName(
    formValues: CourseConfigurationCreateRequiredDocumentFormValues
  ) {
    if (formValues.tipo_documental_modo === "novo") {
      return formValues.novo_tipo_documental_nome.trim();
    }

    return documentTypesById.get(formValues.tipo_documento_id)?.name ?? "";
  }

  function syncDisplayNameWithType(
    currentDraft: CourseConfigurationCreateRequiredDocumentFormValues,
    nextDraft: CourseConfigurationCreateRequiredDocumentFormValues,
    forceSync = false
  ) {
    const currentSuggestedDisplayName = resolveSuggestedDisplayName(currentDraft);
    const shouldSyncDisplayName =
      forceSync ||
      !currentDraft.nome_exibicao.trim() ||
      normalizeDocumentLabelComparison(currentDraft.nome_exibicao) ===
        normalizeDocumentLabelComparison(currentSuggestedDisplayName);

    if (!shouldSyncDisplayName) {
      return nextDraft;
    }

    return {
      ...nextDraft,
      nome_exibicao: resolveSuggestedDisplayName(nextDraft)
    };
  }

  const selectedDocumentTypeName =
    draft.tipo_documental_modo === "novo"
      ? draft.novo_tipo_documental_nome.trim()
      : (documentTypesById.get(draft.tipo_documento_id)?.name ?? "");
  const newDocumentTypeCodePreview =
    draft.tipo_documental_modo === "novo" && draft.novo_tipo_documental_nome.trim()
      ? normalizeCodeInput(draft.novo_tipo_documental_nome)
      : "";
  const displayNameWarning = resolveRequiredDocumentDisplayNameWarning(
    draft.nome_exibicao,
    selectedDocumentTypeName || null
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });

      if (safeState.formValues.tipo_documental_modo === "existente") {
        setDocumentTypeSearch(
          documentTypesById.get(safeState.formValues.tipo_documento_id)?.name ?? ""
        );
      }

      return;
    }

    if (safeState.status === "success") {
      const resetDraft = buildCreateRequiredDocumentDraft(
        courseId,
        availableDocumentTypes,
        requiredDocuments
      );

      setDraft(syncDisplayNameWithType(resetDraft, resetDraft, true));
      setDocumentTypeSearch("");
      return;
    }

    setDraft((currentDraft) => {
      const fallbackDraft = buildCreateRequiredDocumentDraft(
        courseId,
        availableDocumentTypes,
        requiredDocuments,
        currentDraft.tipo_documento_id
      );
      const resolvedMode =
        currentDraft.tipo_documental_modo === "novo" || !availableDocumentTypes.length
          ? "novo"
          : "existente";
      const nextDraft: CourseConfigurationCreateRequiredDocumentFormValues = {
        ...currentDraft,
        course_id: courseId,
        tipo_documental_modo: resolvedMode,
        tipo_documento_id:
          resolvedMode === "existente" ? fallbackDraft.tipo_documento_id : "",
        novo_tipo_documental_nome:
          resolvedMode === "novo" ? currentDraft.novo_tipo_documental_nome : "",
        ordem: fallbackDraft.ordem
      };

      return syncDisplayNameWithType(currentDraft, nextDraft);
    });
  }, [
    availableDocumentTypes,
    courseId,
    documentTypesById,
    requiredDocuments,
    safeState.formValues,
    safeState.status,
    safeState.submittedAt
  ]);

  function updateDraft(field: keyof CourseConfigurationCreateRequiredDocumentFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function handleDocumentTypeModeChange(value: "existente" | "novo") {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        tipo_documental_modo: value,
        tipo_documento_id:
          value === "existente"
            ? currentDraft.tipo_documento_id || availableDocumentTypes[0]?.id || ""
            : "",
        novo_tipo_documental_nome: value === "novo" ? currentDraft.novo_tipo_documental_nome : ""
      };

      return syncDisplayNameWithType(currentDraft, nextDraft, true);
    });

    if (value === "existente") {
      setDocumentTypeSearch("");
    }
  }

  function handleExistingDocumentTypeChange(value: string) {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        tipo_documental_modo: "existente" as const,
        tipo_documento_id: value,
        novo_tipo_documental_nome: ""
      };

      return syncDisplayNameWithType(currentDraft, nextDraft, true);
    });

    setDocumentTypeSearch(documentTypesById.get(value)?.name ?? "");
  }

  function handleNewDocumentTypeNameChange(value: string) {
    setDraft((currentDraft) => {
      const nextDraft = {
        ...currentDraft,
        tipo_documental_modo: "novo" as const,
        tipo_documento_id: "",
        novo_tipo_documental_nome: value
      };

      return syncDisplayNameWithType(currentDraft, nextDraft);
    });
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="course_id" value={draft.course_id} />
      <input type="hidden" name="tipo_documental_modo" value={draft.tipo_documental_modo} />
      {renderNotice(safeState)}

      <div className="form-stack management-block-card">
        <div className="management-block-header">
          <div>
            <h6>Tipo documental</h6>
            <p className="field-help">
              Selecione um tipo existente ou crie rapidamente um novo tipo documental para este curso.
            </p>
          </div>
        </div>

        <div className="actions-row">
          <button
            className={`button button-small ${
              draft.tipo_documental_modo === "existente" ? "" : "button-secondary"
            }`}
            type="button"
            onClick={() => handleDocumentTypeModeChange("existente")}
            disabled={!availableDocumentTypes.length}
          >
            Usar tipo existente
          </button>
          <button
            className={`button button-small ${
              draft.tipo_documental_modo === "novo" ? "" : "button-secondary"
            }`}
            type="button"
            onClick={() => handleDocumentTypeModeChange("novo")}
          >
            Criar novo tipo
          </button>
        </div>

        {draft.tipo_documental_modo === "existente" ? (
          <div className="form-grid">
            <label className="field">
              <span>Pesquisar tipo documental</span>
              <input
                className="input"
                type="search"
                value={documentTypeSearch}
                onChange={(event) => setDocumentTypeSearch(event.currentTarget.value)}
                placeholder="Busque por nome ou codigo"
                disabled={!availableDocumentTypes.length}
              />
              {!availableDocumentTypes.length ? (
                <span className="field-help">
                  Todos os tipos ativos ja estao vinculados. Voce ainda pode criar um novo tipo documental.
                </span>
              ) : (
                <span className="field-help">
                  Pesquise por nome ou codigo para localizar um tipo documental existente.
                </span>
              )}
            </label>

            <label className={getFieldClassName(fieldErrors, "tipo_documento_id")}>
              <span>Tipo documental existente</span>
              <select
                className={getInputClassName(fieldErrors, "tipo_documento_id")}
                name="tipo_documento_id"
                value={draft.tipo_documento_id}
                onChange={(event) => handleExistingDocumentTypeChange(event.currentTarget.value)}
                disabled={!availableDocumentTypes.length}
              >
                <option value="">Selecione</option>
                {filteredAvailableDocumentTypes.map((documentType) => (
                  <option key={documentType.id} value={documentType.id}>
                    {documentType.name} ({documentType.code})
                  </option>
                ))}
              </select>
              {fieldErrors.tipo_documento_id ? (
                <span className="field-error">{fieldErrors.tipo_documento_id}</span>
              ) : filteredAvailableDocumentTypes.length ? (
                <span className="field-help">
                  Nao encontrou? Troque para &quot;Criar novo tipo&quot; e cadastre rapidamente.
                </span>
              ) : (
                <span className="field-help">
                  Nenhum tipo existente corresponde ao filtro atual.
                </span>
              )}
            </label>
          </div>
        ) : (
          <div className="form-grid">
            <label className={getFieldClassName(fieldErrors, "novo_tipo_documental_nome")}>
              <span>Novo tipo documental</span>
              <input
                className={getInputClassName(fieldErrors, "novo_tipo_documental_nome")}
                name="novo_tipo_documental_nome"
                value={draft.novo_tipo_documental_nome}
                onChange={(event) => handleNewDocumentTypeNameChange(event.currentTarget.value)}
                placeholder="Ex.: Identidade"
              />
              {fieldErrors.novo_tipo_documental_nome ? (
                <span className="field-error">{fieldErrors.novo_tipo_documental_nome}</span>
              ) : (
                <span className="field-help">
                  O codigo sera gerado automaticamente a partir do nome informado.
                </span>
              )}
            </label>

            <label className="field">
              <span>Codigo gerado</span>
              <input
                className="input"
                value={newDocumentTypeCodePreview}
                readOnly
                placeholder="Sera gerado automaticamente"
              />
            </label>
          </div>
        )}
      </div>

      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "nome_exibicao")}>
          <span>Nome de exibicao</span>
          <input
            className={getInputClassName(fieldErrors, "nome_exibicao")}
            name="nome_exibicao"
            value={draft.nome_exibicao}
            onChange={(event) => updateDraft("nome_exibicao", event.currentTarget.value)}
          />
          {fieldErrors.nome_exibicao ? (
            <span className="field-error">{fieldErrors.nome_exibicao}</span>
          ) : selectedDocumentTypeName ? (
            <span className="field-help">
              Sugestao baseada no tipo documental: {selectedDocumentTypeName}
            </span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ordem")}>
          <span>Ordem</span>
          <input
            className={getInputClassName(fieldErrors, "ordem")}
            name="ordem"
            type="number"
            min="1"
            step="1"
            value={draft.ordem}
            onChange={(event) => updateDraft("ordem", event.currentTarget.value)}
          />
          <span className="field-help">Deixe vazio se o documento nao tiver ordem fixa.</span>
          {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "obrigatorio")}>
          <span>Obrigatoriedade</span>
          <select
            className={getInputClassName(fieldErrors, "obrigatorio")}
            name="obrigatorio"
            value={draft.obrigatorio}
            onChange={(event) => updateDraft("obrigatorio", event.currentTarget.value)}
          >
            <option value="true">Obrigatorio</option>
            <option value="false">Opcional</option>
          </select>
          {fieldErrors.obrigatorio ? (
            <span className="field-error">{fieldErrors.obrigatorio}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      {displayNameWarning ? <div className="form-notice">{displayNameWarning}</div> : null}

      <label className={getFieldClassName(fieldErrors, "descricao")}>
        <span>Descricao</span>
        <textarea
          className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
          name="descricao"
          rows={3}
          value={draft.descricao}
          onChange={(event) => updateDraft("descricao", event.currentTarget.value)}
        />
        {fieldErrors.descricao ? (
          <span className="field-error">{fieldErrors.descricao}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar novo documento
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationRequiredDocumentForm({
  requiredDocument
}: {
  requiredDocument: CourseConfigurationRequiredDocumentEntry;
}) {
  const [state, formAction] = useActionState(
    updateCourseConfigurationRequiredDocumentAction,
    createInitialCourseConfigurationActionState<CourseConfigurationRequiredDocumentFormValues>()
  );
  const [deleteState, deleteFormAction] = useActionState(
    deleteCourseRequiredDocumentAction,
    initialCourseConfigurationDeleteRequiredDocumentActionState
  );
  const safeState =
    state ??
    createInitialCourseConfigurationActionState<CourseConfigurationRequiredDocumentFormValues>();
  const safeDeleteState =
    deleteState ?? initialCourseConfigurationDeleteRequiredDocumentActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationRequiredDocumentFormValues>(() =>
    buildRequiredDocumentDraft(requiredDocument)
  );
  const displayNameWarning = resolveRequiredDocumentDisplayNameWarning(
    draft.nome_exibicao,
    requiredDocument.typeName
  );

  useEffect(() => {
    setDraft(buildRequiredDocumentDraft(requiredDocument));
  }, [requiredDocument]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <>
      <form action={formAction} className="form-stack master-course-configuration-edit-form">
        <input type="hidden" name="required_document_id" value={draft.required_document_id} />
        {renderNotice(safeState)}
        {renderNotice(safeDeleteState)}

        <div className="management-tag-list">
          <span className="badge badge-muted">
            Tipo fixo: {requiredDocument.typeName} ({requiredDocument.typeCode})
          </span>
          {requiredDocument.code ? (
            <span className="badge badge-muted">Codigo fixo: {requiredDocument.code}</span>
          ) : null}
        </div>

        <div className="form-grid">
          <label className={getFieldClassName(fieldErrors, "nome_exibicao")}>
            <span>Nome de exibicao</span>
            <input
              className={getInputClassName(fieldErrors, "nome_exibicao")}
              name="nome_exibicao"
              value={draft.nome_exibicao}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({
                  ...currentDraft,
                  nome_exibicao: value
                }));
              }}
            />
            {fieldErrors.nome_exibicao ? (
              <span className="field-error">{fieldErrors.nome_exibicao}</span>
            ) : (
              <span className="field-help">
                Tipo documental vinculado: {requiredDocument.typeName}
              </span>
            )}
          </label>

          <label className={getFieldClassName(fieldErrors, "ordem")}>
            <span>Ordem</span>
            <input
              className={getInputClassName(fieldErrors, "ordem")}
              name="ordem"
              type="number"
              min="1"
              step="1"
              value={draft.ordem}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ordem: value }));
              }}
            />
            <span className="field-help">Deixe vazio se o documento nao tiver ordem fixa.</span>
            {fieldErrors.ordem ? <span className="field-error">{fieldErrors.ordem}</span> : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "obrigatorio")}>
            <span>Obrigatoriedade</span>
            <select
              className={getInputClassName(fieldErrors, "obrigatorio")}
              name="obrigatorio"
              value={draft.obrigatorio}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({
                  ...currentDraft,
                  obrigatorio: value
                }));
              }}
            >
              <option value="true">Obrigatorio</option>
              <option value="false">Opcional</option>
            </select>
            {fieldErrors.obrigatorio ? (
              <span className="field-error">{fieldErrors.obrigatorio}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "ativo")}>
            <span>Status</span>
            <select
              className={getInputClassName(fieldErrors, "ativo")}
              name="ativo"
              value={draft.ativo}
              onChange={(event) => {
                const value = event.currentTarget.value;

                setDraft((currentDraft) => ({ ...currentDraft, ativo: value }));
              }}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
            {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
          </label>
        </div>

        {displayNameWarning ? <div className="form-notice">{displayNameWarning}</div> : null}

        <label className={getFieldClassName(fieldErrors, "descricao")}>
          <span>Descricao</span>
          <textarea
            className={`${getInputClassName(fieldErrors, "descricao")} textarea`}
            name="descricao"
            rows={3}
            value={draft.descricao}
            onChange={(event) => {
              const value = event.currentTarget.value;

              setDraft((currentDraft) => ({
                ...currentDraft,
                descricao: value
              }));
            }}
          />
          {fieldErrors.descricao ? (
            <span className="field-error">{fieldErrors.descricao}</span>
          ) : null}
        </label>

        <div className="actions-row">
          <button className="button button-secondary" type="submit">
            Salvar documento
          </button>
        </div>
      </form>
      <form
        action={deleteFormAction}
        className="actions-row"
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Excluir o documento obrigatorio ${requiredDocument.displayName ?? requiredDocument.typeName}? Se ele ja tiver documentos de alunos vinculados, sera desativado para preservar o historico.`
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="required_document_id" value={requiredDocument.id} />
        <button className="button button-danger button-small" type="submit">
          Excluir documento
        </button>
      </form>
    </>
  );
}
