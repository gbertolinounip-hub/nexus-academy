"use client";

import { useActionState, useEffect, useState } from "react";
import { updateInstitutionalUserBasicAction } from "@/app/(app)/master/actions";
import {
  initialMasterUserProfileActionState,
  type MasterUserProfileFormValues
} from "@/app/(app)/master/state";

interface MasterUserProfileFormProps {
  initialValues: MasterUserProfileFormValues;
}

export function MasterUserProfileForm({ initialValues }: MasterUserProfileFormProps) {
  const [state, formAction] = useActionState(
    updateInstitutionalUserBasicAction,
    initialMasterUserProfileActionState
  );
  const safeState = state ?? initialMasterUserProfileActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<MasterUserProfileFormValues>({
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

  function updateDraft(value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      nome_completo: value
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
      <input type="hidden" name="user_id" value={draft.user_id} />

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

      <label className={getFieldClassName("nome_completo")}>
        <span>Nome completo</span>
        <input
          className={getInputClassName("nome_completo")}
          name="nome_completo"
          value={draft.nome_completo}
          onChange={(event) => updateDraft(event.currentTarget.value)}
        />
        {fieldErrors.nome_completo ? (
          <span className="field-error">{fieldErrors.nome_completo}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar usuário
        </button>
      </div>
    </form>
  );
}
