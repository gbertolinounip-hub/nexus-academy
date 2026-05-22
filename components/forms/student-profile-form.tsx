"use client";

import { useActionState, useEffect, useState } from "react";
import { updateStudentProfileAction } from "@/app/(app)/gestao/alunos/actions";
import {
  createInitialStudentProfileFormValues,
  initialStudentProfileActionState,
  type StudentProfileFormValues
} from "@/app/(app)/gestao/alunos/state";

interface StudentProfileFormProps {
  initialValues: StudentProfileFormValues;
}

export function StudentProfileForm({ initialValues }: StudentProfileFormProps) {
  const [state, formAction] = useActionState(
    updateStudentProfileAction,
    initialStudentProfileActionState
  );
  const safeState = state ?? initialStudentProfileActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<StudentProfileFormValues>(() =>
    createInitialStudentProfileFormValues(initialValues)
  );

  useEffect(() => {
    setDraft(createInitialStudentProfileFormValues(initialValues));
  }, [initialValues]);

  useEffect(() => {
    if (!safeState.formValues) {
      return;
    }

    setDraft(createInitialStudentProfileFormValues(safeState.formValues));
  }, [safeState.formValues, safeState.submittedAt]);

  function updateDraft(field: keyof StudentProfileFormValues, value: string) {
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
      <input type="hidden" name="student_id" value={draft.student_id} />

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

        <label className={getFieldClassName("ra")}>
          <span>RA</span>
          <input
            className={getInputClassName("ra")}
            name="ra"
            value={draft.ra}
            onChange={(event) => updateDraft("ra", event.currentTarget.value)}
          />
          {fieldErrors.ra ? <span className="field-error">{fieldErrors.ra}</span> : null}
        </label>

        <label className={getFieldClassName("celular")}>
          <span>Celular</span>
          <input
            className={getInputClassName("celular")}
            name="celular"
            value={draft.celular}
            onChange={(event) => updateDraft("celular", event.currentTarget.value)}
          />
          {fieldErrors.celular ? (
            <span className="field-error">{fieldErrors.celular}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("email")}>
          <span>E-mail de acesso</span>
          <input
            className={getInputClassName("email")}
            type="email"
            name="email"
            value={draft.email}
            onChange={(event) => updateDraft("email", event.currentTarget.value)}
          />
          {fieldErrors.email ? (
            <span className="field-error">{fieldErrors.email}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Salvar cadastro
        </button>
      </div>
    </form>
  );
}
