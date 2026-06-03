"use client";

import { useActionState, useEffect, useState } from "react";
import { createSecretaryRegistrationAction } from "@/app/(app)/gestao/alunos/actions";
import {
  initialSecretaryRegistrationActionState,
  type SecretaryRegistrationFormValues
} from "@/app/(app)/gestao/alunos/state";

function buildInitialDraft(): SecretaryRegistrationFormValues {
  return {
    ...initialSecretaryRegistrationActionState.formValues!
  };
}

export function SecretaryRegistrationForm() {
  const [state, formAction] = useActionState(
    createSecretaryRegistrationAction,
    initialSecretaryRegistrationActionState
  );
  const safeState = state ?? initialSecretaryRegistrationActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<SecretaryRegistrationFormValues>(buildInitialDraft);

  useEffect(() => {
    if (safeState.status !== "error" || !safeState.formValues) {
      return;
    }

    setDraft(safeState.formValues);
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    setDraft(buildInitialDraft());
  }, [safeState.status, safeState.submittedAt]);

  function updateDraft(
    field: keyof SecretaryRegistrationFormValues,
    value: string
  ) {
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

        <label className={getFieldClassName("senha")}>
          <span>Senha de acesso</span>
          <input
            className={getInputClassName("senha")}
            type="password"
            name="senha"
            value={draft.senha}
            onChange={(event) => updateDraft("senha", event.currentTarget.value)}
          />
          {fieldErrors.senha ? (
            <span className="field-error">{fieldErrors.senha}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Cadastrar secretária
        </button>
      </div>
    </form>
  );
}
