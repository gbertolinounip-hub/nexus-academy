"use client";

import { useActionState, useEffect, useState } from "react";
import {
  copyFisioterapiaConfigurationAction,
  initializeCourseConfigurationAction
} from "@/app/(app)/master/cursos/configuracoes/actions";
import {
  initialCourseConfigurationCopyActionState,
  initialCourseConfigurationInitializeActionState
} from "@/app/(app)/master/cursos/configuracoes/state";
import {
  MasterCourseConfigurationCreateModelForm,
  MasterCourseConfigurationCreateCriterionForm,
  MasterCourseConfigurationCreateGroupForm,
  MasterCourseConfigurationCreateRequiredDocumentForm,
  MasterCourseConfigurationCriterionForm,
  MasterCourseConfigurationGroupForm,
  MasterCourseConfigurationModelForm,
  MasterCourseConfigurationRequiredDocumentForm
} from "@/components/forms/master-course-configuration-edit-forms";
import type {
  CourseConfigurationCourseEntry,
  CourseConfigurationDocumentTypeOption,
  CourseConfigurationStatus,
  CourseConfigurationWeightDiagnostic
} from "@/services/course-configurations";

function getStatusClassName(status: CourseConfigurationStatus) {
  if (status === "Configurado") {
    return "status-bem";
  }

  if (status === "Parcial") {
    return "status-atencao";
  }

  return "status-critico";
}

function renderBooleanPill(value: boolean, activeLabel = "Ativo", inactiveLabel = "Inativo") {
  return (
    <span className={`status-pill ${value ? "status-ativo" : "status-inativo"}`}>
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

function getWeightDiagnosticClassName(diagnostic: CourseConfigurationWeightDiagnostic) {
  if (diagnostic.status === "OK") {
    return "status-bem";
  }

  if (diagnostic.status === "Atencao") {
    return "status-atencao";
  }

  return "status-critico";
}

function formatWeightValue(value: number) {
  return value.toFixed(2);
}

function renderWeightDiagnostic(
  label: string,
  itemLabel: string,
  diagnostic: CourseConfigurationWeightDiagnostic
) {
  return (
    <div className="master-course-configuration-weight-diagnostic">
      <span className={`status-pill ${getWeightDiagnosticClassName(diagnostic)}`}>
        {diagnostic.statusLabel}
      </span>
      <div className="master-course-configuration-weight-copy">
        <strong>
          {label}: {formatWeightValue(diagnostic.totalWeight)}% de{" "}
          {formatWeightValue(diagnostic.expectedWeight)}%
        </strong>
        <span className="field-help">
          {diagnostic.activeItemCount} {itemLabel} ativos entram na soma.
        </span>
      </div>
    </div>
  );
}

function renderNotice(message: string, status: "success" | "error") {
  return (
    <div
      className={
        status === "success"
          ? "form-notice form-notice-success"
          : "form-notice form-notice-error"
      }
    >
      {message}
    </div>
  );
}

function getPrimaryOpenLabel(status: CourseConfigurationStatus) {
  if (status === "Configurado") {
    return "Editar configuracao";
  }

  if (status === "Parcial") {
    return "Continuar configuracao";
  }

  return "Ver configuracoes do curso";
}

function resolveFocusedModelId(course: CourseConfigurationCourseEntry) {
  return (
    course.models.find((model) => model.isLaunchDefault)?.id ??
    course.models[0]?.id ??
    ""
  );
}

export function MasterCourseConfigurationCourseCard({
  course,
  documentTypeOptions
}: {
  course: CourseConfigurationCourseEntry;
  documentTypeOptions: CourseConfigurationDocumentTypeOption[];
}) {
  const availableDocumentTypeOptions = documentTypeOptions.filter(
    (documentTypeOption) =>
      !course.requiredDocuments.some(
        (requiredDocument) => requiredDocument.typeId === documentTypeOption.id
      )
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreatingModel, setIsCreatingModel] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isCreatingCriterion, setIsCreatingCriterion] = useState(false);
  const [isCreatingRequiredDocument, setIsCreatingRequiredDocument] = useState(false);
  const [focusedModelId, setFocusedModelId] = useState(() => resolveFocusedModelId(course));
  const [initializeState, initializeFormAction] = useActionState(
    initializeCourseConfigurationAction,
    initialCourseConfigurationInitializeActionState
  );
  const [copyState, copyFormAction] = useActionState(
    copyFisioterapiaConfigurationAction,
    initialCourseConfigurationCopyActionState
  );
  const shouldShowInitializeAction = course.status === "Sem configuracao";
  const shouldShowCopyAction = course.canDuplicateFromFisioterapia;
  const focusedModel =
    course.models.find((model) => model.id === focusedModelId) ?? course.models[0] ?? null;
  const visibleGroups = focusedModel
    ? course.groups.filter((group) => group.modelId === focusedModel.id)
    : course.groups;
  const visibleGroupIds = new Set(visibleGroups.map((group) => group.id));
  const visibleCriteria = focusedModel
    ? course.criteria.filter((criterion) => visibleGroupIds.has(criterion.groupId))
    : course.criteria;

  useEffect(() => {
    setFocusedModelId((currentFocusedModelId) => {
      if (currentFocusedModelId && course.models.some((model) => model.id === currentFocusedModelId)) {
        return currentFocusedModelId;
      }

      return resolveFocusedModelId(course);
    });
  }, [course]);

  return (
    <article className="management-block-card">
      <div className="management-block-header">
        <div>
          <h3>{course.courseName}</h3>
          <p className="field-help">
            {course.institutionName} - {course.courseCode} - slug {course.courseSlug}
          </p>
        </div>
        <div className="master-course-configuration-status-stack">
          <span className={`status-pill ${getStatusClassName(course.status)}`}>
            {course.status}
          </span>
          {renderBooleanPill(course.isActive)}
        </div>
      </div>

      <div className="report-mini-grid master-course-configuration-summary-grid">
        <div className="report-mini-card">
          <span>Modelos</span>
          <strong>{course.modelCount}</strong>
        </div>
        <div className="report-mini-card">
          <span>Grupos</span>
          <strong>{course.groupCount}</strong>
        </div>
        <div className="report-mini-card">
          <span>Criterios</span>
          <strong>{course.criterionCount}</strong>
        </div>
        <div className="report-mini-card">
          <span>Documentos</span>
          <strong>{course.requiredDocumentCount}</strong>
        </div>
      </div>

      <div className="actions-row master-course-configuration-card-actions">
        {shouldShowInitializeAction ? (
          <form action={initializeFormAction}>
            <input type="hidden" name="course_id" value={course.id} />
            <button className="button" type="submit" disabled={!course.isActive}>
              Iniciar configuracao vazia
            </button>
          </form>
        ) : (
          <button className="button" type="button" onClick={() => setIsExpanded(true)}>
            {getPrimaryOpenLabel(course.status)}
          </button>
        )}

        <button
          className="button button-secondary"
          type="button"
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          {isExpanded ? "Ocultar configuracoes do curso" : "Ver configuracoes do curso"}
        </button>

        {shouldShowCopyAction ? (
          <form action={copyFormAction}>
            <input type="hidden" name="destination_course_id" value={course.id} />
            <button className="button button-secondary" type="submit" disabled={!course.isActive}>
              Duplicar base da Fisioterapia
            </button>
          </form>
        ) : null}
      </div>
      {shouldShowCopyAction && course.duplicateBaseSourceLabel ? (
        <p className="field-help">
          Base encontrada: {course.duplicateBaseSourceLabel}.
        </p>
      ) : null}
      {!shouldShowCopyAction && course.duplicateBaseBlockedReason ? (
        <p className="field-help">{course.duplicateBaseBlockedReason}</p>
      ) : null}
      {shouldShowCopyAction && course.hasReusableInitialModel ? (
        <p className="field-help">
          A duplicacao vai reaproveitar o modelo inicial vazio deste curso e preencher grupos,
          criterios e documentos com base na Fisioterapia.
        </p>
      ) : null}

      {initializeState.message && initializeState.status !== "idle"
        ? renderNotice(initializeState.message, initializeState.status)
        : null}
      {copyState.message && copyState.status !== "idle"
        ? renderNotice(copyState.message, copyState.status)
        : null}

      {isExpanded ? (
        <div className="stack master-course-configuration-card-content">
          <div>
            <div className="management-block-header">
              <div>
                <h4>Modelos de avaliacao</h4>
                <p className="field-help">
                  Cada modelo tem modalidade, grupos, criterios e regras proprias. Use este
                  bloco para criar um modelo novo do zero ou duplicar um modelo existente.
                </p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setIsCreatingModel((currentValue) => !currentValue)}
              >
                {course.models.length ? "Adicionar novo modelo" : "Adicionar modelo"}
              </button>
            </div>
            {isCreatingModel ? (
              <div className="master-inline-action-panel">
                <MasterCourseConfigurationCreateModelForm
                  courseId={course.id}
                  models={course.models}
                />
              </div>
            ) : null}
            {course.models.length ? (
              <div className="management-block-grid master-course-configuration-editor-grid">
                {course.models.map((model) => (
                  <div key={model.id} className="management-block-card">
                    <div className="management-block-header">
                      <div>
                        <h5>{model.name}</h5>
                        <p className="field-help">
                          Codigo e versao ficam bloqueados nesta etapa.
                        </p>
                      </div>
                      {renderBooleanPill(model.isActive)}
                    </div>
                    {renderWeightDiagnostic("Grupos", "grupos", model.groupWeightDiagnostic)}
                    <MasterCourseConfigurationModelForm
                      model={model}
                      ruleOptions={course.applicationRuleOptions}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">Nenhum modelo de avaliacao cadastrado.</p>
            )}
          </div>

          <div>
            <div className="management-block-header">
              <div>
                <h4>Grupos do modelo</h4>
                <p className="field-help">
                  {focusedModel
                    ? `Edite apenas os grupos ligados ao modelo em foco: ${focusedModel.name}.`
                    : "Selecione ou crie um modelo para começar a organizar grupos."}
                </p>
              </div>
              {course.models.length > 1 ? (
                <label className="field">
                  <span>Modelo em foco</span>
                  <select
                    className="input"
                    value={focusedModelId}
                    onChange={(event) => setFocusedModelId(event.currentTarget.value)}
                  >
                    {course.models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.code})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button
                className="button button-secondary"
                type="button"
                disabled={!course.models.length}
                onClick={() => setIsCreatingGroup((currentValue) => !currentValue)}
              >
                {course.groups.length ? "Adicionar novo grupo" : "Adicionar grupo"}
              </button>
            </div>
            {!course.models.length ? (
              <p className="field-help">
                Crie um modelo inicial antes de cadastrar grupos para este curso.
              </p>
            ) : null}
            {isCreatingGroup ? (
              <div className="master-inline-action-panel">
                <MasterCourseConfigurationCreateGroupForm
                  courseId={course.id}
                  models={course.models}
                  groups={course.groups}
                  preferredModelId={focusedModel?.id}
                />
              </div>
            ) : null}
            {visibleGroups.length ? (
              <div className="management-block-grid master-course-configuration-editor-grid">
                {visibleGroups.map((group) => (
                  <div key={group.id} className="management-block-card">
                    <div className="management-block-header">
                      <div>
                        <h5>{group.name}</h5>
                        <p className="field-help">
                          O codigo e o modelo vinculado ficam bloqueados nesta etapa.
                        </p>
                      </div>
                      {renderBooleanPill(group.isActive)}
                    </div>
                    {renderWeightDiagnostic(
                      "Criterios",
                      "criterios",
                      group.criterionWeightDiagnostic
                    )}
                    <MasterCourseConfigurationGroupForm group={group} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">
                {focusedModel
                  ? "Nenhum grupo cadastrado para o modelo em foco."
                  : "Nenhum grupo cadastrado para este curso."}
              </p>
            )}
          </div>

          <div>
            <div className="management-block-header">
              <div>
                <h4>Criterios de avaliacao</h4>
                <p className="field-help">
                  {focusedModel
                    ? `Cada criterio exibido aqui pertence somente ao modelo ${focusedModel.name}.`
                    : "Cada criterio precisa estar vinculado a um grupo existente do curso."}
                </p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                disabled={!visibleGroups.length}
                onClick={() => setIsCreatingCriterion((currentValue) => !currentValue)}
              >
                {visibleCriteria.length ? "Adicionar novo criterio" : "Adicionar criterio"}
              </button>
            </div>
            {!visibleGroups.length ? (
              <p className="field-help">
                Cadastre ao menos um grupo no modelo em foco antes de adicionar criterios.
              </p>
            ) : null}
            {isCreatingCriterion ? (
              <div className="master-inline-action-panel">
                <MasterCourseConfigurationCreateCriterionForm
                  courseId={course.id}
                  groups={visibleGroups}
                  criteria={visibleCriteria}
                />
              </div>
            ) : null}
            {visibleCriteria.length ? (
              <div className="management-block-grid master-course-configuration-editor-grid">
                {visibleCriteria.map((criterion) => (
                  <div key={criterion.id} className="management-block-card">
                    <div className="management-block-header">
                      <div>
                        <h5>{criterion.name}</h5>
                        <p className="field-help">
                          O codigo e o grupo vinculado ficam bloqueados nesta etapa.
                        </p>
                      </div>
                      {renderBooleanPill(criterion.isActive)}
                    </div>
                    <MasterCourseConfigurationCriterionForm criterion={criterion} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">
                {focusedModel
                  ? "Nenhum criterio cadastrado para o modelo em foco."
                  : "Nenhum criterio cadastrado para este curso."}
              </p>
            )}
          </div>

          <div>
            <div className="management-block-header">
              <div>
                <h4>Documentos obrigatorios</h4>
                <p className="field-help">
                  Selecione apenas tipos documentais ja cadastrados para iniciar a base do curso.
                </p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                disabled={!availableDocumentTypeOptions.length}
                onClick={() => setIsCreatingRequiredDocument((currentValue) => !currentValue)}
              >
                {course.requiredDocuments.length
                  ? "Adicionar novo documento obrigatorio"
                  : "Adicionar documento obrigatorio"}
              </button>
            </div>
            {!availableDocumentTypeOptions.length ? (
              <p className="field-help">
                Nenhum tipo documental adicional esta disponivel para criar documentos obrigatorios neste curso.
              </p>
            ) : null}
            {isCreatingRequiredDocument ? (
              <div className="master-inline-action-panel">
                <MasterCourseConfigurationCreateRequiredDocumentForm
                  courseId={course.id}
                  requiredDocuments={course.requiredDocuments}
                  documentTypeOptions={documentTypeOptions}
                />
              </div>
            ) : null}
            {course.requiredDocuments.length ? (
              <div className="management-block-grid master-course-configuration-editor-grid">
                {course.requiredDocuments.map((requiredDocument) => (
                  <div key={requiredDocument.id} className="management-block-card">
                    <div className="management-block-header">
                      <div>
                        <h5>{requiredDocument.displayName ?? requiredDocument.typeName}</h5>
                        <p className="field-help">
                          O curso, o tipo documental e o codigo ficam bloqueados nesta etapa.
                        </p>
                      </div>
                      {renderBooleanPill(requiredDocument.isActive)}
                    </div>
                    <MasterCourseConfigurationRequiredDocumentForm
                      requiredDocument={requiredDocument}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-message">
                Nenhum documento obrigatorio cadastrado para este curso.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
