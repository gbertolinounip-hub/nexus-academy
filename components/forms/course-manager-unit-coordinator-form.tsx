"use client";

import { useActionState, useEffect, useState } from "react";
import { createCourseManagerUnitCoordinatorAction } from "@/app/(app)/gestao/alunos/actions";
import {
  createInitialCourseManagerUnitCoordinatorFormValues,
  initialCourseManagerUnitCoordinatorActionState,
  type CourseManagerUnitCoordinatorFormValues
} from "@/app/(app)/gestao/alunos/state";
import type { ManagementUnitOption } from "@/services/management";

interface CourseManagerUnitCoordinatorFormProps {
  units: ManagementUnitOption[];
}

export function CourseManagerUnitCoordinatorForm({
  units
}: CourseManagerUnitCoordinatorFormProps) {
  const [state, formAction] = useActionState(
    createCourseManagerUnitCoordinatorAction,
    initialCourseManagerUnitCoordinatorActionState
  );
  const safeState = state ?? initialCourseManagerUnitCoordinatorActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseManagerUnitCoordinatorFormValues>(() =>
    createInitialCourseManagerUnitCoordinatorFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createInitialCourseManagerUnitCoordinatorFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (draft.unidade_id && !units.some((unit) => unit.id === draft.unidade_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        unidade_id: ""
      }));
    }
  }, [draft.unidade_id, units]);

  function updateDraft(
    field: keyof CourseManagerUnitCoordinatorFormValues,
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
        <label className={getFieldClassName("unidade_id")}>
          <span>Unidade</span>
          <select
            className={getInputClassName("unidade_id")}
            name="unidade_id"
            value={draft.unidade_id}
            onChange={(event) => updateDraft("unidade_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
          {fieldErrors.unidade_id ? (
            <span className="field-error">{fieldErrors.unidade_id}</span>
          ) : null}
        </label>

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

        <label className={getFieldClassName("cargo")}>
          <span>Cargo</span>
          <input
            className={getInputClassName("cargo")}
            name="cargo"
            value={draft.cargo}
            onChange={(event) => updateDraft("cargo", event.currentTarget.value)}
          />
          {fieldErrors.cargo ? <span className="field-error">{fieldErrors.cargo}</span> : null}
        </label>

        <label className={getFieldClassName("ativo")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) =>
              updateDraft(
                "ativo",
                event.currentTarget.value as CourseManagerUnitCoordinatorFormValues["ativo"]
              )
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
          Cadastrar Coordenador de Unidade
        </button>
      </div>
    </form>
  );
}
