"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createCourseOfferAction } from "@/app/(app)/master/cursos/actions";
import {
  createEmptyCourseOfferFormValues,
  initialCourseOfferActionState,
  type CourseOfferFormValues
} from "@/app/(app)/master/cursos/state";
import type {
  CourseManagementCourseOption,
  CourseManagementInstitutionOption,
  CourseManagementUnitOption
} from "@/services/course-management";

interface MasterCourseOfferFormProps {
  institutions: CourseManagementInstitutionOption[];
  units: CourseManagementUnitOption[];
  courses: CourseManagementCourseOption[];
}

export function MasterCourseOfferForm({
  institutions,
  units,
  courses
}: MasterCourseOfferFormProps) {
  const [state, formAction] = useActionState(
    createCourseOfferAction,
    initialCourseOfferActionState
  );
  const safeState = state ?? initialCourseOfferActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseOfferFormValues>(() =>
    createEmptyCourseOfferFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyCourseOfferFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  const filteredUnits = useMemo(
    () =>
      units.filter(
        (unit) => unit.institutionId === draft.instituicao_id || !draft.instituicao_id
      ),
    [draft.instituicao_id, units]
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) => course.institutionId === draft.instituicao_id || !draft.instituicao_id
      ),
    [courses, draft.instituicao_id]
  );

  useEffect(() => {
    if (draft.unidade_id && !filteredUnits.some((unit) => unit.id === draft.unidade_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        unidade_id: ""
      }));
    }

    if (draft.curso_id && !filteredCourses.some((course) => course.id === draft.curso_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        curso_id: ""
      }));
    }
  }, [draft.curso_id, draft.unidade_id, filteredCourses, filteredUnits]);

  function updateDraft(field: keyof CourseOfferFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function getFieldClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  const selectedUnit = filteredUnits.find((unit) => unit.id === draft.unidade_id) ?? null;
  const selectedCourse = filteredCourses.find((course) => course.id === draft.curso_id) ?? null;
  const suggestedDisplayName =
    selectedCourse && selectedUnit
      ? `${selectedCourse.name} - ${selectedUnit.name}`
      : "";

  return (
    <form action={formAction} className="form-stack">
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

      <div className="form-grid">
        <label className={getFieldClassName("instituicao_id")}>
          <span>Instituicao</span>
          <select
            className={getInputClassName("instituicao_id")}
            name="instituicao_id"
            value={draft.instituicao_id}
            onChange={(event) => updateDraft("instituicao_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          {fieldErrors.instituicao_id ? (
            <span className="field-error">{fieldErrors.instituicao_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("unidade_id")}>
          <span>Unidade</span>
          <select
            className={getInputClassName("unidade_id")}
            name="unidade_id"
            value={draft.unidade_id}
            onChange={(event) => updateDraft("unidade_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          {fieldErrors.unidade_id ? (
            <span className="field-error">{fieldErrors.unidade_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("curso_id")}>
          <span>Curso</span>
          <select
            className={getInputClassName("curso_id")}
            name="curso_id"
            value={draft.curso_id}
            onChange={(event) => updateDraft("curso_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          {fieldErrors.curso_id ? (
            <span className="field-error">{fieldErrors.curso_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("codigo")}>
          <span>Codigo da oferta</span>
          <input
            className={getInputClassName("codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) =>
              updateDraft(
                "codigo",
                event.currentTarget.value.toUpperCase().replace(/[^A-Z0-9_-]+/g, "_")
              )
            }
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName("nome_exibicao")}>
          <span>Nome de exibicao</span>
          <input
            className={getInputClassName("nome_exibicao")}
            name="nome_exibicao"
            placeholder={suggestedDisplayName || "Ex.: Enfermagem - Ribeirao Preto"}
            value={draft.nome_exibicao}
            onChange={(event) => updateDraft("nome_exibicao", event.currentTarget.value)}
          />
          {fieldErrors.nome_exibicao ? (
            <span className="field-error">{fieldErrors.nome_exibicao}</span>
          ) : null}
          {!fieldErrors.nome_exibicao && suggestedDisplayName ? (
            <span className="field-help">Sugestao: {suggestedDisplayName}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Criar oferta
        </button>
      </div>
    </form>
  );
}
