"use client";

import type { Dispatch, SetStateAction } from "react";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createCourseConfigurationModelApplicationRuleAction,
  toggleCourseConfigurationModelApplicationRuleAction,
  updateCourseConfigurationModelApplicationRuleAction
} from "@/app/(app)/master/cursos/configuracoes/actions";
import {
  createEmptyCourseConfigurationCreateModelApplicationRuleFormValues,
  initialCourseConfigurationCreateModelApplicationRuleActionState,
  initialCourseConfigurationModelApplicationRuleActionState,
  initialCourseConfigurationToggleModelApplicationRuleActionState,
  type CourseConfigurationActionState,
  type CourseConfigurationCreateModelApplicationRuleFormValues,
  type CourseConfigurationModelApplicationRuleFormValues,
  type CourseConfigurationToggleModelApplicationRuleFormValues
} from "@/app/(app)/master/cursos/configuracoes/state";
import type {
  CourseConfigurationModelApplicationClassOption,
  CourseConfigurationModelApplicationRuleEntry,
  CourseConfigurationModelApplicationRuleOptions
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

function buildApplicationRuleDraft(
  applicationRule: CourseConfigurationModelApplicationRuleEntry
): CourseConfigurationModelApplicationRuleFormValues {
  return {
    rule_id: applicationRule.id,
    oferta_curso_unidade_id: applicationRule.offerId ?? "",
    periodo_curricular: applicationRule.curricularPeriod
      ? String(applicationRule.curricularPeriod)
      : "",
    semestre_id: applicationRule.semesterId ?? "",
    turma_id: applicationRule.classId ?? "",
    area_estagio_id: applicationRule.stageAreaId ?? "",
    prioridade: String(applicationRule.priority),
    ativo: applicationRule.active ? "true" : "false"
  };
}

function getScopeOptions(
  ruleOptions: CourseConfigurationModelApplicationRuleOptions,
  draft: {
    oferta_curso_unidade_id: string;
    semestre_id: string;
  }
) {
  const filteredSemesters = ruleOptions.semesters.filter(
    (semesterOption) =>
      semesterOption.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id
  );
  const filteredClasses = ruleOptions.classes.filter((classOption) => {
    const offerMatches =
      classOption.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id;
    const semesterMatches =
      classOption.semesterId === draft.semestre_id || !draft.semestre_id;

    return offerMatches && semesterMatches;
  });
  const filteredAreas = ruleOptions.areas.filter(
    (areaOption) =>
      areaOption.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id
  );

  return {
    filteredSemesters,
    filteredClasses,
    filteredAreas
  };
}

function syncDependentFields<TDraft extends {
  oferta_curso_unidade_id: string;
  semestre_id: string;
  turma_id: string;
  area_estagio_id: string;
}>(
  draft: TDraft,
  filteredOptions: {
    filteredSemesters: CourseConfigurationModelApplicationRuleOptions["semesters"];
    filteredClasses: CourseConfigurationModelApplicationRuleOptions["classes"];
    filteredAreas: CourseConfigurationModelApplicationRuleOptions["areas"];
  },
  setDraft: Dispatch<SetStateAction<TDraft>>
) {
  if (
    draft.semestre_id &&
    !filteredOptions.filteredSemesters.some((semesterOption) => semesterOption.id === draft.semestre_id)
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      semestre_id: "",
      turma_id: ""
    }));

    return;
  }

  if (
    draft.turma_id &&
    !filteredOptions.filteredClasses.some((classOption) => classOption.id === draft.turma_id)
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      turma_id: ""
    }));

    return;
  }

  if (
    draft.area_estagio_id &&
    !filteredOptions.filteredAreas.some((areaOption) => areaOption.id === draft.area_estagio_id)
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      area_estagio_id: ""
    }));
  }
}

function getClassPeriodHelper(
  filteredClasses: CourseConfigurationModelApplicationClassOption[],
  classId: string
) {
  const selectedClass = filteredClasses.find((classOption) => classOption.id === classId) ?? null;

  if (!selectedClass?.curricularPeriod) {
    return null;
  }

  return `${selectedClass.curricularPeriod}o periodo`;
}

function ModelApplicationRuleFields<TDraft extends {
  oferta_curso_unidade_id: string;
  periodo_curricular: string;
  semestre_id: string;
  turma_id: string;
  area_estagio_id: string;
  prioridade: string;
  ativo: string;
}>({
  draft,
  fieldErrors,
  ruleOptions,
  updateDraft
}: {
  draft: TDraft;
  fieldErrors: Record<string, string>;
  ruleOptions: CourseConfigurationModelApplicationRuleOptions;
  updateDraft: (field: keyof TDraft, value: string) => void;
}) {
  const filteredOptions = useMemo(
    () => getScopeOptions(ruleOptions, draft),
    [draft, ruleOptions]
  );
  const selectedClassHelper = getClassPeriodHelper(
    filteredOptions.filteredClasses,
    draft.turma_id
  );

  return (
    <>
      <div className="form-grid">
        <label className={getFieldClassName(fieldErrors, "oferta_curso_unidade_id")}>
          <span>Oferta do curso na unidade</span>
          <select
            className={getInputClassName(fieldErrors, "oferta_curso_unidade_id")}
            name="oferta_curso_unidade_id"
            value={draft.oferta_curso_unidade_id}
            onChange={(event) =>
              updateDraft("oferta_curso_unidade_id" as keyof TDraft, event.currentTarget.value)
            }
          >
            <option value="">Nao restringir por oferta</option>
            {ruleOptions.offers.map((offerOption) => (
              <option key={offerOption.id} value={offerOption.id}>
                {offerOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.oferta_curso_unidade_id ? (
            <span className="field-error">{fieldErrors.oferta_curso_unidade_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "periodo_curricular")}>
          <span>Periodo curricular</span>
          <input
            className={getInputClassName(fieldErrors, "periodo_curricular")}
            name="periodo_curricular"
            inputMode="numeric"
            placeholder="Ex.: 6, 7 ou 8"
            value={draft.periodo_curricular}
            onChange={(event) =>
              updateDraft(
                "periodo_curricular" as keyof TDraft,
                event.currentTarget.value.replace(/[^\d]/g, "")
              )
            }
          />
          <span className="field-help">
            Campo opcional. Use quando o modelo variar por periodo do curso.
          </span>
          {fieldErrors.periodo_curricular ? (
            <span className="field-error">{fieldErrors.periodo_curricular}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "semestre_id")}>
          <span>Semestre academico</span>
          <select
            className={getInputClassName(fieldErrors, "semestre_id")}
            name="semestre_id"
            value={draft.semestre_id}
            onChange={(event) => updateDraft("semestre_id" as keyof TDraft, event.currentTarget.value)}
          >
            <option value="">Nao restringir por semestre</option>
            {filteredOptions.filteredSemesters.map((semesterOption) => (
              <option key={semesterOption.id} value={semesterOption.id}>
                {semesterOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.semestre_id ? (
            <span className="field-error">{fieldErrors.semestre_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "turma_id")}>
          <span>Turma</span>
          <select
            className={getInputClassName(fieldErrors, "turma_id")}
            name="turma_id"
            value={draft.turma_id}
            onChange={(event) => updateDraft("turma_id" as keyof TDraft, event.currentTarget.value)}
          >
            <option value="">Nao restringir por turma</option>
            {filteredOptions.filteredClasses.map((classOption) => (
              <option key={classOption.id} value={classOption.id}>
                {classOption.label}
              </option>
            ))}
          </select>
          {selectedClassHelper ? <span className="field-help">{selectedClassHelper}</span> : null}
          {fieldErrors.turma_id ? <span className="field-error">{fieldErrors.turma_id}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "area_estagio_id")}>
          <span>Area de estagio</span>
          <select
            className={getInputClassName(fieldErrors, "area_estagio_id")}
            name="area_estagio_id"
            value={draft.area_estagio_id}
            onChange={(event) =>
              updateDraft("area_estagio_id" as keyof TDraft, event.currentTarget.value)
            }
          >
            <option value="">Nao restringir por area</option>
            {filteredOptions.filteredAreas.map((areaOption) => (
              <option key={areaOption.id} value={areaOption.id}>
                {areaOption.label}
              </option>
            ))}
          </select>
          {fieldErrors.area_estagio_id ? (
            <span className="field-error">{fieldErrors.area_estagio_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "prioridade")}>
          <span>Prioridade</span>
          <input
            className={getInputClassName(fieldErrors, "prioridade")}
            name="prioridade"
            type="number"
            min="0"
            step="1"
            value={draft.prioridade}
            onChange={(event) => updateDraft("prioridade" as keyof TDraft, event.currentTarget.value)}
          />
          <span className="field-help">
            Quanto maior a prioridade, mais forte fica a preferencia da regra.
          </span>
          {fieldErrors.prioridade ? (
            <span className="field-error">{fieldErrors.prioridade}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo" as keyof TDraft, event.currentTarget.value)}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <p className="field-help">
        Preencha pelo menos um escopo. O runtime futuro vai preferir regras mais especificas e com
        maior prioridade.
      </p>
    </>
  );
}

export function MasterCourseConfigurationCreateModelApplicationRuleForm({
  modelId,
  ruleOptions
}: {
  modelId: string;
  ruleOptions: CourseConfigurationModelApplicationRuleOptions;
}) {
  const [state, formAction] = useActionState(
    createCourseConfigurationModelApplicationRuleAction,
    initialCourseConfigurationCreateModelApplicationRuleActionState
  );
  const safeState = state ?? initialCourseConfigurationCreateModelApplicationRuleActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCreateModelApplicationRuleFormValues>(() =>
    createEmptyCourseConfigurationCreateModelApplicationRuleFormValues(modelId, "100")
  );
  const filteredOptions = useMemo(() => getScopeOptions(ruleOptions, draft), [draft, ruleOptions]);

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyCourseConfigurationCreateModelApplicationRuleFormValues(modelId, "100"));
      return;
    }

    setDraft((currentDraft) => ({ ...currentDraft, model_id: modelId }));
  }, [modelId, safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    syncDependentFields(draft, filteredOptions, setDraft);
  }, [draft, filteredOptions]);

  function updateDraft(
    field: keyof CourseConfigurationCreateModelApplicationRuleFormValues,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  return (
    <form action={formAction} className="form-stack master-course-configuration-edit-form">
      <input type="hidden" name="model_id" value={draft.model_id} />
      {renderNotice(safeState)}
      <div>
        <strong>Adicionar regra</strong>
        <p className="field-help">
          Regras podem ser portaveis por periodo curricular ou mais especificas por oferta,
          semestre, turma e area.
        </p>
      </div>
      <ModelApplicationRuleFields
        draft={draft}
        fieldErrors={fieldErrors}
        ruleOptions={ruleOptions}
        updateDraft={updateDraft}
      />
      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar nova regra
        </button>
      </div>
    </form>
  );
}

export function MasterCourseConfigurationModelApplicationRuleForm({
  applicationRule,
  ruleOptions
}: {
  applicationRule: CourseConfigurationModelApplicationRuleEntry;
  ruleOptions: CourseConfigurationModelApplicationRuleOptions;
}) {
  const [state, formAction] = useActionState(
    updateCourseConfigurationModelApplicationRuleAction,
    initialCourseConfigurationModelApplicationRuleActionState
  );
  const [toggleState, toggleFormAction] = useActionState(
    toggleCourseConfigurationModelApplicationRuleAction,
    initialCourseConfigurationToggleModelApplicationRuleActionState
  );
  const safeState =
    state ?? initialCourseConfigurationModelApplicationRuleActionState;
  const safeToggleState =
    toggleState ?? initialCourseConfigurationToggleModelApplicationRuleActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationModelApplicationRuleFormValues>(() =>
    buildApplicationRuleDraft(applicationRule)
  );
  const filteredOptions = useMemo(() => getScopeOptions(ruleOptions, draft), [draft, ruleOptions]);

  useEffect(() => {
    setDraft(buildApplicationRuleDraft(applicationRule));
  }, [applicationRule]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    syncDependentFields(draft, filteredOptions, setDraft);
  }, [draft, filteredOptions]);

  function updateDraft(field: keyof CourseConfigurationModelApplicationRuleFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  const nextActiveValue = applicationRule.active ? "false" : "true";

  return (
    <>
      <form action={formAction} className="form-stack master-course-configuration-edit-form">
        <input type="hidden" name="rule_id" value={draft.rule_id} />
        {renderNotice(safeState)}
        {renderNotice(safeToggleState)}

        <div className="management-block-header">
          <div>
            <strong>{applicationRule.summary}</strong>
            <p className="field-help">
              Prioridade {applicationRule.priority} - Especificidade {applicationRule.specificity}
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

        <ModelApplicationRuleFields
          draft={draft}
          fieldErrors={fieldErrors}
          ruleOptions={ruleOptions}
          updateDraft={updateDraft}
        />

        <div className="actions-row">
          <button className="button button-secondary" type="submit">
            Salvar regra
          </button>
        </div>
      </form>

      <form action={toggleFormAction} className="actions-row">
        <input type="hidden" name="rule_id" value={applicationRule.id} />
        <input type="hidden" name="ativo" value={nextActiveValue} />
        <button className="button button-secondary button-small" type="submit">
          {applicationRule.active ? "Inativar regra" : "Ativar regra"}
        </button>
      </form>
    </>
  );
}
