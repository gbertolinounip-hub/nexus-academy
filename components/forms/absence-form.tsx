"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { submitAbsenceAction } from "@/app/(app)/ausencias/actions";
import { ExceptionalReleaseNotice } from "@/components/common/exceptional-release-notice";
import type { AbsenceActionFormValues } from "@/app/(app)/ausencias/state";
import { initialAbsenceActionState } from "@/app/(app)/ausencias/state";
import type {
  AbsenceFormInitialValues,
  AbsenceFormMode,
  AbsenceStudentOption
} from "@/services/absences";

interface AbsenceFormProps {
  studentOptions: AbsenceStudentOption[];
  mode?: AbsenceFormMode;
  initialValues?: AbsenceFormInitialValues;
}

function SubmitButton({ children }: { children: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Processando..." : children}
    </button>
  );
}

function buildDraftValues(
  studentOptions: AbsenceStudentOption[],
  initialValues?: AbsenceFormInitialValues,
  submittedValues?: AbsenceActionFormValues
): AbsenceActionFormValues {
  const fallbackEnrollmentId =
    initialValues?.matriculaTurmaId ?? studentOptions[0]?.enrollmentId ?? "";

  return {
    ausencia_id: submittedValues?.ausencia_id ?? initialValues?.absenceId,
    matricula_turma_id:
      submittedValues?.matricula_turma_id || fallbackEnrollmentId,
    data_ausencia: submittedValues?.data_ausencia ?? initialValues?.date ?? "",
    horas: submittedValues?.horas ?? initialValues?.hours ?? "",
    justificada:
      submittedValues?.justificada ??
      (initialValues?.justified ? "true" : "false"),
    motivo: submittedValues?.motivo ?? initialValues?.reason ?? "",
    observacoes:
      submittedValues?.observacoes ?? initialValues?.observations ?? ""
  };
}

export function AbsenceForm({
  studentOptions,
  mode = "create",
  initialValues
}: AbsenceFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    submitAbsenceAction,
    initialAbsenceActionState
  );
  const safeState = state ?? initialAbsenceActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const isEditing = mode === "edit";
  const [draft, setDraft] = useState<AbsenceActionFormValues>(() =>
    buildDraftValues(studentOptions, initialValues)
  );

  useEffect(() => {
    setDraft(buildDraftValues(studentOptions, initialValues));
  }, [initialValues?.absenceId, initialValues?.matriculaTurmaId, studentOptions]);

  useEffect(() => {
    if (safeState.status !== "error") {
      return;
    }

    setDraft(buildDraftValues(studentOptions, initialValues, safeState.formValues));
  }, [
    initialValues,
    safeState.formValues,
    safeState.status,
    safeState.submittedAt,
    studentOptions
  ]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    if (mode === "create") {
      setDraft(buildDraftValues(studentOptions));
    } else {
      setDraft(buildDraftValues(studentOptions, initialValues));
    }

    router.refresh();
  }, [
    initialValues,
    mode,
    router,
    safeState.status,
    safeState.submittedAt,
    studentOptions
  ]);

  function updateDraft(
    field: keyof AbsenceActionFormValues,
    value: string | undefined
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function getFieldClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: keyof typeof fieldErrors) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  const selectedStudentOption = studentOptions.find(
    (studentOption) => studentOption.enrollmentId === draft.matricula_turma_id
  );
  const exceptionalReleaseNotice = selectedStudentOption?.exceptionalReleaseNotice ?? null;

  return (
    <form action={formAction} className="form-stack absence-form" noValidate>
      {exceptionalReleaseNotice ? (
        <ExceptionalReleaseNotice notice={exceptionalReleaseNotice} compact />
      ) : null}

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

      {draft.ausencia_id ? (
        <input type="hidden" name="ausencia_id" value={draft.ausencia_id} />
      ) : null}

      {mode !== "create" ? (
        <input type="hidden" name="matricula_turma_id" value={draft.matricula_turma_id} />
      ) : null}

      <div className="form-grid absence-form-grid">
        <label className={getFieldClassName("matricula_turma_id")}>
          <span>Aluno</span>
          <select
            className={getInputClassName("matricula_turma_id")}
            name="matricula_turma_id"
            value={draft.matricula_turma_id}
            disabled={mode !== "create"}
            aria-invalid={Boolean(fieldErrors.matricula_turma_id)}
            onChange={(event) =>
              updateDraft("matricula_turma_id", event.currentTarget.value)
            }
          >
            {studentOptions.map((student) => (
              <option key={student.enrollmentId} value={student.enrollmentId}>
                {student.label}
              </option>
            ))}
          </select>
          {fieldErrors.matricula_turma_id ? (
            <span className="field-error">{fieldErrors.matricula_turma_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("data_ausencia")}>
          <span>Data da falta</span>
          <input
            className={getInputClassName("data_ausencia")}
            type="date"
            name="data_ausencia"
            value={draft.data_ausencia}
            aria-invalid={Boolean(fieldErrors.data_ausencia)}
            onChange={(event) => updateDraft("data_ausencia", event.currentTarget.value)}
          />
          {fieldErrors.data_ausencia ? (
            <span className="field-error">{fieldErrors.data_ausencia}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("horas")}>
          <span>Horas</span>
          <input
            className={getInputClassName("horas")}
            type="text"
            inputMode="decimal"
            name="horas"
            placeholder="Ex.: 1"
            value={draft.horas}
            aria-invalid={Boolean(fieldErrors.horas)}
            onChange={(event) => updateDraft("horas", event.currentTarget.value)}
          />
          {fieldErrors.horas ? (
            <span className="field-error">{fieldErrors.horas}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("justificada")}>
          <span>Situação</span>
          <select
            className={getInputClassName("justificada")}
            name="justificada"
            value={draft.justificada}
            aria-invalid={Boolean(fieldErrors.justificada)}
            onChange={(event) => updateDraft("justificada", event.currentTarget.value)}
          >
            <option value="false">Não justificada</option>
            <option value="true">Justificada</option>
          </select>
          {fieldErrors.justificada ? (
            <span className="field-error">{fieldErrors.justificada}</span>
          ) : null}
        </label>
      </div>

      <label className={getFieldClassName("motivo")}>
        <span>Motivo</span>
        <input
          className={getInputClassName("motivo")}
          name="motivo"
          placeholder="Ex.: ausência parcial em prática clínica"
          value={draft.motivo}
          aria-invalid={Boolean(fieldErrors.motivo)}
          onChange={(event) => updateDraft("motivo", event.currentTarget.value)}
        />
        {fieldErrors.motivo ? (
          <span className="field-error">{fieldErrors.motivo}</span>
        ) : null}
      </label>

      <label className={getFieldClassName("observacoes")}>
        <span>Observações</span>
        <textarea
          className={`${getInputClassName("observacoes")} textarea`}
          name="observacoes"
          placeholder="Observações complementares para a coordenação e para o histórico do aluno."
          rows={4}
          value={draft.observacoes}
          aria-invalid={Boolean(fieldErrors.observacoes)}
          onChange={(event) => updateDraft("observacoes", event.currentTarget.value)}
        />
        {fieldErrors.observacoes ? (
          <span className="field-error">{fieldErrors.observacoes}</span>
        ) : null}
      </label>

      <div className="actions-row absence-form-actions">
        <SubmitButton>
          {isEditing ? "Salvar alterações da falta" : "Registrar falta"}
        </SubmitButton>
      </div>
    </form>
  );
}


