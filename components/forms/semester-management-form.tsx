"use client";

import { useActionState, useEffect, useState } from "react";
import { createSemesterAction } from "@/app/(app)/gestao/alunos/actions";
import {
  initialSemesterManagementActionState,
  type SemesterManagementFormValues
} from "@/app/(app)/gestao/alunos/state";

export function SemesterManagementForm() {
  const [state, formAction] = useActionState(
    createSemesterAction,
    initialSemesterManagementActionState
  );
  const safeState = state ?? initialSemesterManagementActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<SemesterManagementFormValues>(
    initialSemesterManagementActionState.formValues!
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft(safeState.formValues);
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (safeState.status === "success") {
      setDraft(initialSemesterManagementActionState.formValues!);
    }
  }, [safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof SemesterManagementFormValues, value: string) {
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
        <label className={getFieldClassName("codigo")}>
          <span>Código</span>
          <input
            className={getInputClassName("codigo")}
            name="codigo"
            placeholder="2027/1"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", event.currentTarget.value)}
          />
          {fieldErrors.codigo ? (
            <span className="field-error">{fieldErrors.codigo}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            placeholder="1º Semestre de 2027"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? (
            <span className="field-error">{fieldErrors.nome}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("data_inicio")}>
          <span>Data de início</span>
          <input
            className={getInputClassName("data_inicio")}
            type="date"
            name="data_inicio"
            value={draft.data_inicio}
            onChange={(event) => updateDraft("data_inicio", event.currentTarget.value)}
          />
          {fieldErrors.data_inicio ? (
            <span className="field-error">{fieldErrors.data_inicio}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("data_fim")}>
          <span>Data de fim</span>
          <input
            className={getInputClassName("data_fim")}
            type="date"
            name="data_fim"
            value={draft.data_fim}
            onChange={(event) => updateDraft("data_fim", event.currentTarget.value)}
          />
          {fieldErrors.data_fim ? (
            <span className="field-error">{fieldErrors.data_fim}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("status")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("status")}
            name="status"
            value={draft.status}
            onChange={(event) =>
              updateDraft(
                "status",
                event.currentTarget.value as SemesterManagementFormValues["status"]
              )
            }
          >
            <option value="planejado">Planejado</option>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
          </select>
          {fieldErrors.status ? (
            <span className="field-error">{fieldErrors.status}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Cadastrar semestre
        </button>
      </div>
    </form>
  );
}


