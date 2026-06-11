"use client";

import { useActionState, useEffect, useState } from "react";
import { createStageAreaAction } from "@/app/(app)/gestao/alunos/actions";
import {
  createInitialStageAreaRegistrationFormValues,
  initialStageAreaRegistrationActionState,
  type StageAreaRegistrationFormValues
} from "@/app/(app)/gestao/alunos/state";

function normalizeAreaCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function buildInitialDraft() {
  return createInitialStageAreaRegistrationFormValues();
}

export function StageAreaRegistrationForm() {
  const [state, formAction] = useActionState(
    createStageAreaAction,
    initialStageAreaRegistrationActionState
  );
  const safeState = state ?? initialStageAreaRegistrationActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<StageAreaRegistrationFormValues>(buildInitialDraft);
  const [codeSyncedWithName, setCodeSyncedWithName] = useState(true);

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
    setCodeSyncedWithName(true);
  }, [safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof StageAreaRegistrationFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
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
        <label className={fieldErrors.nome ? "field field-invalid" : "field"}>
          <span>Nome da área supervisionada</span>
          <input
            className={fieldErrors.nome ? "input input-invalid" : "input"}
            name="nome"
            value={draft.nome}
            onChange={(event) => {
              const value = event.currentTarget.value;
              const nextCode = normalizeAreaCode(value);

              setDraft((currentDraft) => ({
                ...currentDraft,
                nome: value,
                codigo: codeSyncedWithName ? nextCode : currentDraft.codigo
              }));
            }}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={fieldErrors.codigo ? "field field-invalid" : "field"}>
          <span>Código / slug</span>
          <input
            className={fieldErrors.codigo ? "input input-invalid" : "input"}
            name="codigo"
            value={draft.codigo}
            onChange={(event) => {
              const value = normalizeAreaCode(event.currentTarget.value);
              setCodeSyncedWithName(value.length === 0);
              updateDraft("codigo", value);
            }}
          />
          <span className="field-help">
            Se deixar em branco, o sistema gera automaticamente a partir do nome.
          </span>
          {fieldErrors.codigo ? (
            <span className="field-error">{fieldErrors.codigo}</span>
          ) : null}
        </label>

        <label className={fieldErrors.ativo ? "field field-invalid" : "field"}>
          <span>Status inicial</span>
          <select
            className={fieldErrors.ativo ? "input input-invalid" : "input"}
            name="ativo"
            value={draft.ativo}
            onChange={(event) =>
              updateDraft("ativo", event.currentTarget.value === "false" ? "false" : "true")
            }
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Adicionar área
        </button>
      </div>
    </form>
  );
}
