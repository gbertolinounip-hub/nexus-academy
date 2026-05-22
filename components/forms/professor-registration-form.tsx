"use client";

import { useActionState, useEffect, useState } from "react";
import { createProfessorRegistrationAction } from "@/app/(app)/gestao/alunos/actions";
import {
  initialProfessorRegistrationActionState,
  type ProfessorRegistrationFormValues
} from "@/app/(app)/gestao/alunos/state";
import type { ManagementAreaBlock } from "@/services/management";

interface ProfessorRegistrationFormProps {
  areaBlocks: ManagementAreaBlock[];
}

function buildInitialDraft(): ProfessorRegistrationFormValues {
  return {
    ...initialProfessorRegistrationActionState.formValues!,
    area_ids: []
  };
}

export function ProfessorRegistrationForm({
  areaBlocks
}: ProfessorRegistrationFormProps) {
  const [state, formAction] = useActionState(
    createProfessorRegistrationAction,
    initialProfessorRegistrationActionState
  );
  const safeState = state ?? initialProfessorRegistrationActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<ProfessorRegistrationFormValues>(buildInitialDraft);

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
    field: Exclude<keyof ProfessorRegistrationFormValues, "area_ids">,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function toggleArea(areaId: string) {
    setDraft((currentDraft) => {
      const nextAreaIds = currentDraft.area_ids.includes(areaId)
        ? currentDraft.area_ids.filter((currentAreaId) => currentAreaId !== areaId)
        : [...currentDraft.area_ids, areaId];

      return {
        ...currentDraft,
        area_ids: nextAreaIds
      };
    });
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

        <label className={getFieldClassName("funcional")}>
          <span>Funcional</span>
          <input
            className={getInputClassName("funcional")}
            name="funcional"
            value={draft.funcional}
            onChange={(event) => updateDraft("funcional", event.currentTarget.value)}
          />
          {fieldErrors.funcional ? (
            <span className="field-error">{fieldErrors.funcional}</span>
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

      <div className={getFieldClassName("area_ids")}>
        <span>Áreas supervisionadas</span>
        <div className="management-checkbox-grid">
          {areaBlocks.map((block) => (
            <div key={block.id} className="management-checkbox-card">
              <strong>{block.name}</strong>
              <div className="management-checkbox-list">
                {block.areas.map((area) => (
                  <label key={area.id} className="management-checkbox-item">
                    <input
                      type="checkbox"
                      name="area_ids"
                      value={area.id}
                      checked={draft.area_ids.includes(area.id)}
                      onChange={() => toggleArea(area.id)}
                    />
                    <span>{area.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {fieldErrors.area_ids ? (
          <span className="field-error">{fieldErrors.area_ids}</span>
        ) : null}
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Cadastrar professor e vincular áreas
        </button>
      </div>
    </form>
  );
}


