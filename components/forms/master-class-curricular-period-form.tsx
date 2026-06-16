"use client";

import { useActionState, useEffect, useState } from "react";
import { updateMasterClassCurricularPeriodAction } from "@/app/(app)/master/turmas/actions";
import {
  createEmptyMasterClassCurricularPeriodFormValues,
  initialClassManagementCurricularPeriodActionState,
  type MasterClassCurricularPeriodFormValues
} from "@/app/(app)/master/turmas/state";

export function MasterClassCurricularPeriodForm({
  classId,
  className,
  curricularPeriod
}: {
  classId: string;
  className: string;
  curricularPeriod: number | null;
}) {
  const [state, formAction] = useActionState(
    updateMasterClassCurricularPeriodAction,
    initialClassManagementCurricularPeriodActionState
  );
  const safeState = state ?? initialClassManagementCurricularPeriodActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<MasterClassCurricularPeriodFormValues>(() =>
    createEmptyMasterClassCurricularPeriodFormValues(
      classId,
      curricularPeriod ? String(curricularPeriod) : ""
    )
  );

  useEffect(() => {
    setDraft(
      createEmptyMasterClassCurricularPeriodFormValues(
        classId,
        curricularPeriod ? String(curricularPeriod) : ""
      )
    );
  }, [classId, curricularPeriod]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <form action={formAction} className="form-stack" style={{ gap: "0.4rem" }}>
      <input type="hidden" name="turma_id" value={draft.turma_id} />
      <input
        className={fieldErrors.periodo_curricular ? "input input-invalid" : "input"}
        name="periodo_curricular"
        inputMode="numeric"
        aria-label={`Periodo curricular da turma ${className}`}
        placeholder="Ex.: 7"
        value={draft.periodo_curricular}
        onChange={(event) =>
          setDraft((currentDraft) => ({
            ...currentDraft,
            periodo_curricular: event.currentTarget.value.replace(/[^\d]/g, "")
          }))
        }
      />
      {fieldErrors.periodo_curricular ? (
        <span className="field-error">{fieldErrors.periodo_curricular}</span>
      ) : null}
      {safeState.message ? (
        <span className={safeState.status === "success" ? "field-help" : "field-error"}>
          {safeState.message}
        </span>
      ) : null}
      <button className="button button-secondary button-small" type="submit">
        Salvar
      </button>
    </form>
  );
}
