"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateCoordinatorClassCurricularPeriodAction } from "@/app/(app)/gestao/alunos/actions";
import {
  initialClassCurricularPeriodActionState
} from "@/app/(app)/gestao/alunos/state";
import type { ManagementCurricularPeriodOption } from "@/services/management";

export function CoordinatorClassCurricularPeriodForm({
  classId,
  className,
  curricularPeriod,
  options,
  selectionMessage,
  selectionBlocked
}: {
  classId: string;
  className: string;
  curricularPeriod: number | null;
  options: ManagementCurricularPeriodOption[];
  selectionMessage: string | null;
  selectionBlocked: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    updateCoordinatorClassCurricularPeriodAction,
    initialClassCurricularPeriodActionState
  );
  const safeState = state ?? initialClassCurricularPeriodActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const persistedValue = curricularPeriod ? String(curricularPeriod) : "";
  const [selectedValue, setSelectedValue] = useState(persistedValue);

  useEffect(() => {
    setSelectedValue(persistedValue);
  }, [persistedValue]);

  useEffect(() => {
    if (safeState.status !== "success" || !safeState.submittedAt) {
      return;
    }

    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  const currentValue = selectedValue;
  const currentValueIsAllowed = !currentValue
    ? true
    : options.some((option) => String(option.value) === currentValue);
  const effectiveOptions = currentValue && !currentValueIsAllowed
    ? [
        {
          value: Number(currentValue),
          label: `${currentValue} periodo - valor atual fora das regras liberadas`,
          modelNames: [],
          hasMultipleModels: false
        } satisfies ManagementCurricularPeriodOption,
        ...options
      ]
    : options;
  const isSelectionDisabled = selectionBlocked && !currentValue;

  return (
    <form action={formAction} className="form-stack" style={{ gap: "0.4rem" }}>
      <input type="hidden" name="turma_id" value={classId} />
      <select
        className={fieldErrors.periodo_curricular ? "input input-invalid" : "input"}
        name="periodo_curricular"
        aria-label={`Periodo curricular da turma ${className}`}
        value={selectedValue}
        disabled={isSelectionDisabled}
        onChange={(event) => setSelectedValue(event.currentTarget.value)}
      >
        <option value="">Selecione o periodo curricular</option>
        {effectiveOptions.map((option) => (
          <option key={`${classId}-${option.value}`} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="field-help">
        Selecione o periodo curricular liberado pelo Master. Essa escolha define quais
        regras de avaliacao serao aplicadas a turma.
      </span>
      {selectionMessage ? <span className="field-error">{selectionMessage}</span> : null}
      {!currentValueIsAllowed && currentValue ? (
        <span className="field-help">
          O valor atual desta turma nao esta mais entre os periodos liberados. Selecione
          um periodo valido ou limpe o campo antes de salvar.
        </span>
      ) : null}
      {fieldErrors.periodo_curricular ? (
        <span className="field-error">{fieldErrors.periodo_curricular}</span>
      ) : null}
      {safeState.message ? (
        <span className={safeState.status === "success" ? "field-help" : "field-error"}>
          {safeState.message}
        </span>
      ) : null}
      <button
        className="button button-secondary button-small"
        type="submit"
        disabled={isSelectionDisabled}
      >
        Salvar periodo
      </button>
    </form>
  );
}
