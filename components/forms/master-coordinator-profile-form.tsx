"use client";

import { useActionState, useEffect, useState } from "react";
import { updateUnitCoordinatorProfileAction } from "@/app/(app)/master/actions";
import {
  initialCoordinatorProfileActionState,
  type UnitCoordinatorProfileFormValues
} from "@/app/(app)/master/state";

interface MasterCoordinatorProfileFormProps {
  initialValues: UnitCoordinatorProfileFormValues;
}

export function MasterCoordinatorProfileForm({
  initialValues
}: MasterCoordinatorProfileFormProps) {
  const [state, formAction] = useActionState(
    updateUnitCoordinatorProfileAction,
    initialCoordinatorProfileActionState
  );
  const safeState = state ?? initialCoordinatorProfileActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<UnitCoordinatorProfileFormValues>({
    ...initialValues
  });

  useEffect(() => {
    setDraft({ ...initialValues });
  }, [initialValues]);

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft({ ...initialValues });
    }
  }, [initialValues, safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof UnitCoordinatorProfileFormValues, value: string) {
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
      <input type="hidden" name="coordinator_id" value={draft.coordinator_id} />
      <input type="hidden" name="unit_id" value={draft.unit_id} />

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
            onChange={(event) =>
              updateDraft("nome_completo", event.currentTarget.value)
            }
          />
          {fieldErrors.nome_completo ? (
            <span className="field-error">{fieldErrors.nome_completo}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("cargo")}>
          <span>Cargo</span>
          <input
            className={getInputClassName("cargo")}
            name="cargo"
            value={draft.cargo}
            onChange={(event) => updateDraft("cargo", event.currentTarget.value)}
          />
          {fieldErrors.cargo ? (
            <span className="field-error">{fieldErrors.cargo}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar coordenador
        </button>
      </div>
    </form>
  );
}
