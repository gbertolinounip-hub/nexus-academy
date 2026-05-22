"use client";
import { useActionState, useEffect, useState } from "react";
import { createUnitCoordinatorAction } from "@/app/(app)/master/actions";
import {
  createEmptyCoordinatorFormValues,
  initialCoordinatorActionState,
  type UnitCoordinatorFormValues
} from "@/app/(app)/master/state";

interface MasterCoordinatorFormProps {
  unitId: string;
  initialValues?: Partial<UnitCoordinatorFormValues>;
  submitLabel?: string;
  action?: (
    previousState: Awaited<typeof initialCoordinatorActionState>,
    formData: FormData
  ) => Promise<Awaited<typeof initialCoordinatorActionState>>;
}

function buildCoordinatorDraft(
  unitId: string,
  initialValues?: Partial<UnitCoordinatorFormValues>
) {
  return createEmptyCoordinatorFormValues(unitId, initialValues);
}

export function MasterCoordinatorForm({
  unitId,
  initialValues,
  submitLabel = "Cadastrar coordenador da unidade",
  action = createUnitCoordinatorAction
}: MasterCoordinatorFormProps) {
  const [state, formAction] = useActionState(
    action,
    initialCoordinatorActionState
  );
  const safeState = state ?? initialCoordinatorActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<UnitCoordinatorFormValues>(() =>
    buildCoordinatorDraft(unitId, initialValues)
  );

  useEffect(() => {
    setDraft(buildCoordinatorDraft(unitId, initialValues));
  }, [initialValues, unitId]);

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(buildCoordinatorDraft(unitId, initialValues));
    }
  }, [initialValues, safeState.formValues, safeState.status, safeState.submittedAt, unitId]);

  function updateDraft(field: keyof UnitCoordinatorFormValues, value: string) {
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
      <input type="hidden" name="coordinator_id" value={draft.coordinator_id ?? ""} />
      <input type="hidden" name="unit_id" value={draft.unit_id} />
      <input
        type="hidden"
        name="replace_existing"
        value={draft.replace_existing ?? "false"}
      />

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

        <label className={getFieldClassName("email")}>
          <span>E-mail institucional</span>
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
          <span>Senha inicial</span>
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
        <button className="button" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
