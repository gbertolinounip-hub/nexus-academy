"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createCourseManagerAction } from "@/app/(app)/master/gestores-curso/actions";
import {
  createEmptyCourseManagerFormValues,
  initialCourseManagerActionState,
  type CourseManagerFormValues
} from "@/app/(app)/master/gestores-curso/state";
import type {
  CourseManagerCourseOption,
  CourseManagerInstitutionOption,
  CourseManagerUserOption
} from "@/services/course-manager-management";

interface CourseManagerFormProps {
  institutions: CourseManagerInstitutionOption[];
  courses: CourseManagerCourseOption[];
  users: CourseManagerUserOption[];
}

export function CourseManagerForm({
  institutions,
  courses,
  users
}: CourseManagerFormProps) {
  const [state, formAction] = useActionState(
    createCourseManagerAction,
    initialCourseManagerActionState
  );
  const safeState = state ?? initialCourseManagerActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseManagerFormValues>(() =>
    createEmptyCourseManagerFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyCourseManagerFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) => course.institutionId === draft.instituicao_id || !draft.instituicao_id
      ),
    [courses, draft.instituicao_id]
  );

  useEffect(() => {
    if (draft.curso_id && !filteredCourses.some((course) => course.id === draft.curso_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        curso_id: ""
      }));
    }
  }, [draft.curso_id, filteredCourses]);

  function updateDraft(field: keyof CourseManagerFormValues, value: string) {
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
          <span>Instituicao / IES</span>
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
                {course.code} - {course.name}
              </option>
            ))}
          </select>
          {fieldErrors.curso_id ? <span className="field-error">{fieldErrors.curso_id}</span> : null}
        </label>

        <label className={getFieldClassName("usuario_id")}>
          <span>Usuario existente</span>
          <select
            className={getInputClassName("usuario_id")}
            name="usuario_id"
            value={draft.usuario_id}
            onChange={(event) => updateDraft("usuario_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.label}
              </option>
            ))}
          </select>
          {fieldErrors.usuario_id ? (
            <span className="field-error">{fieldErrors.usuario_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("ativo")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) =>
              updateDraft("ativo", event.currentTarget.value as CourseManagerFormValues["ativo"])
            }
          >
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Atribuir Gestor do curso
        </button>
      </div>
    </form>
  );
}
