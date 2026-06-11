"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { registerCourseManagerAction } from "@/app/(app)/master/gestores-curso/actions";
import {
  createEmptyNewCourseManagerFormValues,
  initialNewCourseManagerActionState,
  type NewCourseManagerFormValues
} from "@/app/(app)/master/gestores-curso/state";
import type {
  CourseManagerCourseOption,
  CourseManagerInstitutionOption
} from "@/services/course-manager-management";

interface CourseManagerRegistrationFormProps {
  institutions: CourseManagerInstitutionOption[];
  courses: CourseManagerCourseOption[];
}

export function CourseManagerRegistrationForm({
  institutions,
  courses
}: CourseManagerRegistrationFormProps) {
  const [state, formAction] = useActionState(
    registerCourseManagerAction,
    initialNewCourseManagerActionState
  );
  const safeState = state ?? initialNewCourseManagerActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<NewCourseManagerFormValues>(() =>
    createEmptyNewCourseManagerFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyNewCourseManagerFormValues());
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

  function updateDraft(field: keyof NewCourseManagerFormValues, value: string) {
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
        <label className={getFieldClassName("nome_completo")}>
          <span>Nome completo</span>
          <input
            className={getInputClassName("nome_completo")}
            name="nome_completo"
            value={draft.nome_completo}
            onChange={(event) => updateDraft("nome_completo", event.currentTarget.value)}
          />
          {fieldErrors.nome_completo ? (
            <span className="field-error">{fieldErrors.nome_completo}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("email")}>
          <span>E-mail</span>
          <input
            className={getInputClassName("email")}
            type="email"
            name="email"
            value={draft.email}
            onChange={(event) => updateDraft("email", event.currentTarget.value)}
          />
          {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
        </label>

        <label className={getFieldClassName("senha")}>
          <span>Senha inicial</span>
          <input
            className={getInputClassName("senha")}
            type="password"
            name="senha"
            value={draft.senha}
            onChange={(event) => updateDraft("senha", event.currentTarget.value)}
          />
          {fieldErrors.senha ? <span className="field-error">{fieldErrors.senha}</span> : null}
        </label>

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

        <label className={getFieldClassName("ativo")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) =>
              updateDraft("ativo", event.currentTarget.value as NewCourseManagerFormValues["ativo"])
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
          Cadastrar Gestor do curso
        </button>
      </div>
    </form>
  );
}
