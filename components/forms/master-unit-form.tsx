"use client";

import { useActionState, useEffect, useState } from "react";
import { upsertUnitAction } from "@/app/(app)/master/actions";
import {
  createEmptyUnitFormValues,
  initialUnitActionState,
  type UnitFormValues
} from "@/app/(app)/master/state";

interface MasterUnitFormProps {
  initialValues?: UnitFormValues;
  submitLabel: string;
}

function cloneUnitFormValues(values?: UnitFormValues): UnitFormValues {
  return values
    ? { ...values }
    : createEmptyUnitFormValues();
}

export function MasterUnitForm({
  initialValues,
  submitLabel
}: MasterUnitFormProps) {
  const [state, formAction] = useActionState(
    upsertUnitAction,
    initialUnitActionState
  );
  const safeState = state ?? initialUnitActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<UnitFormValues>(() =>
    cloneUnitFormValues(initialValues)
  );

  useEffect(() => {
    setDraft(cloneUnitFormValues(initialValues));
  }, [initialValues]);

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success" && !initialValues) {
      setDraft(createEmptyUnitFormValues());
    }
  }, [initialValues, safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof UnitFormValues, value: string) {
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
        <label className={getFieldClassName("nome")}>
          <span>Nome da unidade</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName("sigla")}>
          <span>Sigla</span>
          <input
            className={getInputClassName("sigla")}
            name="sigla"
            value={draft.sigla}
            onChange={(event) => updateDraft("sigla", event.currentTarget.value.toUpperCase())}
          />
          {fieldErrors.sigla ? (
            <span className="field-error">{fieldErrors.sigla}</span>
          ) : null}
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
                event.currentTarget.value
                  .toLowerCase()
                  .replace(/\s+/g, "-")
              )
            }
          />
          {fieldErrors.slug ? <span className="field-error">{fieldErrors.slug}</span> : null}
        </label>

        <label className={getFieldClassName("cidade")}>
          <span>Cidade</span>
          <input
            className={getInputClassName("cidade")}
            name="cidade"
            value={draft.cidade}
            onChange={(event) => updateDraft("cidade", event.currentTarget.value)}
          />
          {fieldErrors.cidade ? (
            <span className="field-error">{fieldErrors.cidade}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("estado")}>
          <span>UF</span>
          <input
            className={getInputClassName("estado")}
            name="estado"
            maxLength={2}
            value={draft.estado}
            onChange={(event) => updateDraft("estado", event.currentTarget.value.toUpperCase())}
          />
          {fieldErrors.estado ? (
            <span className="field-error">{fieldErrors.estado}</span>
          ) : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
