"use client";

import { useActionState, useEffect, useState } from "react";
import { createCourseAction } from "@/app/(app)/master/cursos/actions";
import {
  createEmptyCourseFormValues,
  initialCourseActionState,
  type CourseFormValues
} from "@/app/(app)/master/cursos/state";
import type { CourseManagementInstitutionOption } from "@/services/course-management";

interface MasterCourseFormProps {
  institutions: CourseManagementInstitutionOption[];
}

export function MasterCourseForm({ institutions }: MasterCourseFormProps) {
  const [state, formAction] = useActionState(createCourseAction, initialCourseActionState);
  const safeState = state ?? initialCourseActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseFormValues>(() => createEmptyCourseFormValues());

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyCourseFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof CourseFormValues, value: string) {
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

        <label className={getFieldClassName("codigo")}>
          <span>Codigo</span>
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

        <label className={getFieldClassName("nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName("slug")}>
          <span>Slug</span>
          <input
            className={getInputClassName("slug")}
            name="slug"
            value={draft.slug}
            onChange={(event) =>
              updateDraft(
                "slug",
                event.currentTarget.value.toLowerCase().replace(/\s+/g, "-")
              )
            }
          />
          {fieldErrors.slug ? <span className="field-error">{fieldErrors.slug}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Criar curso
        </button>
      </div>
    </form>
  );
}
