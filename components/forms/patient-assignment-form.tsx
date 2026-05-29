"use client";

import { useActionState, useEffect, useState } from "react";
import { createOrUpdateClinicalCaseAction } from "@/app/(app)/clinica-supervisionada/actions";
import {
  createEmptyClinicalCaseSchedule,
  initialClinicalCaseActionState,
  type ClinicalCaseActionState,
  type ClinicalCaseFormValues,
  type ClinicalCaseScheduleFormValue
} from "@/app/(app)/clinica-supervisionada/state";
import { formatClinicalCaseStatus, formatClinicalWeekday } from "@/lib/utils/format";
import type { ClinicalStudentOption } from "@/types/domain";

interface PatientAssignmentFormProps {
  mode: "create" | "edit";
  studentOptions: ClinicalStudentOption[];
  initialValues: ClinicalCaseFormValues;
  emptyHint?: string | null;
}

function createScheduleRowId() {
  return `clinical-schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureScheduleRows(
  schedules: ClinicalCaseScheduleFormValue[] | undefined
): ClinicalCaseScheduleFormValue[] {
  if (schedules && schedules.length > 0) {
    return schedules;
  }

  return [createEmptyClinicalCaseSchedule(createScheduleRowId())];
}

function getInputClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "input input-invalid" : "input";
}

function getFieldClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "field field-invalid" : "field";
}

function getScheduleFieldName(
  scheduleIndex: number,
  fieldName: keyof ClinicalCaseScheduleFormValue
) {
  return `schedules.${scheduleIndex}.${fieldName}`;
}

export function PatientAssignmentForm({
  mode,
  studentOptions,
  initialValues,
  emptyHint
}: PatientAssignmentFormProps) {
  const [state, formAction] = useActionState(
    createOrUpdateClinicalCaseAction,
    initialClinicalCaseActionState
  );
  const safeState: ClinicalCaseActionState =
    state ?? initialClinicalCaseActionState;
  const [draft, setDraft] = useState<ClinicalCaseFormValues>({
    ...initialValues,
    schedules: ensureScheduleRows(initialValues.schedules)
  });
  const fieldErrors = safeState.fieldErrors ?? {};
  const isSubmitDisabled = studentOptions.length === 0;
  const availableStatuses =
    mode === "create"
      ? (["atribuido", "ativo"] as const)
      : (["atribuido", "ativo", "alta", "encerrado"] as const);

  useEffect(() => {
    if (safeState.status !== "error" || !safeState.formValues) {
      return;
    }

    setDraft({
      ...safeState.formValues,
      schedules: ensureScheduleRows(safeState.formValues.schedules)
    });
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    setDraft({
      ...initialValues,
      schedules: ensureScheduleRows(initialValues.schedules)
    });
  }, [initialValues]);

  function updateDraft(
    field: Exclude<keyof ClinicalCaseFormValues, "schedules">,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function updateSchedule(
    rowId: string,
    field: keyof ClinicalCaseScheduleFormValue,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      schedules: currentDraft.schedules.map((schedule) =>
        schedule.row_id === rowId ? { ...schedule, [field]: value } : schedule
      )
    }));
  }

  function addSchedule() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      schedules: [
        ...currentDraft.schedules,
        createEmptyClinicalCaseSchedule(createScheduleRowId())
      ]
    }));
  }

  function removeSchedule(rowId: string) {
    setDraft((currentDraft) => {
      const remainingSchedules = currentDraft.schedules.filter(
        (schedule) => schedule.row_id !== rowId
      );

      return {
        ...currentDraft,
        schedules: ensureScheduleRows(remainingSchedules)
      };
    });
  }

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="case_id" value={draft.case_id} />
      <input type="hidden" name="patient_id" value={draft.patient_id} />
      <input
        type="hidden"
        name="schedules_payload"
        value={JSON.stringify(draft.schedules)}
      />

      {safeState.message ? (
        <div className="form-notice form-notice-error">{safeState.message}</div>
      ) : null}

      {emptyHint ? <p className="field-help">{emptyHint}</p> : null}
      {draft.patient_id ? (
        <p className="field-help">
          Cadastro-base reutilizado. Este novo caso clínico será aberto a partir do
          paciente já existente na base institucional.
        </p>
      ) : null}

      <div className="clinical-case-form-grid">
        <label className={getFieldClassName(fieldErrors, "patient_identifier")}>
          <span>Identificador do paciente</span>
          <input
            className={getInputClassName(fieldErrors, "patient_identifier")}
            name="patient_identifier"
            value={draft.patient_identifier}
            onChange={(event) =>
              updateDraft("patient_identifier", event.currentTarget.value)
            }
          />
          {fieldErrors.patient_identifier ? (
            <span className="field-error">{fieldErrors.patient_identifier}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "patient_name")}>
          <span>Nome do paciente</span>
          <input
            className={getInputClassName(fieldErrors, "patient_name")}
            name="patient_name"
            value={draft.patient_name}
            onChange={(event) => updateDraft("patient_name", event.currentTarget.value)}
          />
          {fieldErrors.patient_name ? (
            <span className="field-error">{fieldErrors.patient_name}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "patient_birth_date")}>
          <span>Data de nascimento</span>
          <input
            type="date"
            className={getInputClassName(fieldErrors, "patient_birth_date")}
            name="patient_birth_date"
            value={draft.patient_birth_date}
            onChange={(event) =>
              updateDraft("patient_birth_date", event.currentTarget.value)
            }
          />
        </label>

        <label className={getFieldClassName(fieldErrors, "patient_cpf")}>
          <span>CPF</span>
          <input
            className={getInputClassName(fieldErrors, "patient_cpf")}
            name="patient_cpf"
            value={draft.patient_cpf}
            onChange={(event) => updateDraft("patient_cpf", event.currentTarget.value)}
          />
          {fieldErrors.patient_cpf ? (
            <span className="field-error">{fieldErrors.patient_cpf}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "patient_contact")}>
          <span>Contato</span>
          <input
            className={getInputClassName(fieldErrors, "patient_contact")}
            name="patient_contact"
            value={draft.patient_contact}
            onChange={(event) => updateDraft("patient_contact", event.currentTarget.value)}
          />
          {fieldErrors.patient_contact ? (
            <span className="field-error">{fieldErrors.patient_contact}</span>
          ) : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "patient_companion")}>
          <span>Acompanhante</span>
          <input
            className={getInputClassName(fieldErrors, "patient_companion")}
            name="patient_companion"
            value={draft.patient_companion}
            onChange={(event) =>
              updateDraft("patient_companion", event.currentTarget.value)
            }
          />
          {fieldErrors.patient_companion ? (
            <span className="field-error">{fieldErrors.patient_companion}</span>
          ) : null}
        </label>
      </div>

      <div className="clinical-case-context-card">
        <div className="card-header">
          <div>
            <h3>Dados acadêmico-operacionais</h3>
            <p>
              Professor, unidade, semestre, turma e área são derivados do
              estagiário selecionado para manter a supervisão coerente desde a
              origem do caso.
            </p>
          </div>
        </div>

        <div className="clinical-case-form-grid">
          <label className={getFieldClassName(fieldErrors, "enrollment_id")}>
            <span>Estagiário</span>
            <select
              className={getInputClassName(fieldErrors, "enrollment_id")}
              name="enrollment_id"
              value={draft.enrollment_id}
              onChange={(event) => updateDraft("enrollment_id", event.currentTarget.value)}
            >
              <option value="">
                {studentOptions.length
                  ? "Selecione o estagiário vinculado"
                  : "Nenhum estagiário disponível"}
              </option>
              {studentOptions.map((studentOption) => (
                <option key={studentOption.enrollmentId} value={studentOption.enrollmentId}>
                  {studentOption.label}
                </option>
              ))}
            </select>
            {fieldErrors.enrollment_id ? (
              <span className="field-error">{fieldErrors.enrollment_id}</span>
            ) : null}
          </label>

          <label className={getFieldClassName(fieldErrors, "status")}>
            <span>Status do caso</span>
            <select
              className={getInputClassName(fieldErrors, "status")}
              name="status"
              value={draft.status}
              onChange={(event) => updateDraft("status", event.currentTarget.value)}
            >
              {availableStatuses.map((status) => (
                <option key={status} value={status}>
                  {formatClinicalCaseStatus(status)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="clinical-case-schedule-stack">
          <div className="management-slot-header">
            <div>
              <h3>Atendimentos semanais fixos</h3>
              <p className="field-help">
                Adicione os dias e horários recorrentes deste paciente. A agenda
                semanal do professor e do aluno será montada a partir desta
                lista.
              </p>
            </div>
          </div>

          {draft.schedules.map((schedule, scheduleIndex) => {
            const weekdayFieldName = getScheduleFieldName(scheduleIndex, "weekday");
            const appointmentTimeFieldName = getScheduleFieldName(
              scheduleIndex,
              "appointment_time"
            );

            return (
              <div key={schedule.row_id} className="clinical-case-schedule-card">
                <div className="clinical-case-schedule-card-header">
                  <div>
                    <h4>Atendimento {scheduleIndex + 1}</h4>
                    <p className="field-help">
                      Cada linha representa um encontro semanal fixo do mesmo caso.
                    </p>
                  </div>
                  {draft.schedules.length > 1 ? (
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => removeSchedule(schedule.row_id)}
                    >
                      Remover horário
                    </button>
                  ) : null}
                </div>

                <div className="clinical-case-schedule-grid">
                  <label className={getFieldClassName(fieldErrors, weekdayFieldName)}>
                    <span>Dia da semana</span>
                    <select
                      className={getInputClassName(fieldErrors, weekdayFieldName)}
                      value={schedule.weekday}
                      onChange={(event) =>
                        updateSchedule(
                          schedule.row_id,
                          "weekday",
                          event.currentTarget.value
                        )
                      }
                    >
                      {[
                        "segunda",
                        "terca",
                        "quarta",
                        "quinta",
                        "sexta",
                        "sabado"
                      ].map((weekday) => (
                        <option key={weekday} value={weekday}>
                          {formatClinicalWeekday(weekday)}
                        </option>
                      ))}
                    </select>
                    {fieldErrors[weekdayFieldName] ? (
                      <span className="field-error">{fieldErrors[weekdayFieldName]}</span>
                    ) : null}
                  </label>

                  <label className={getFieldClassName(fieldErrors, appointmentTimeFieldName)}>
                    <span>Horário de atendimento</span>
                    <input
                      type="time"
                      className={getInputClassName(fieldErrors, appointmentTimeFieldName)}
                      value={schedule.appointment_time}
                      onChange={(event) =>
                        updateSchedule(
                          schedule.row_id,
                          "appointment_time",
                          event.currentTarget.value
                        )
                      }
                    />
                    {fieldErrors[appointmentTimeFieldName] ? (
                      <span className="field-error">
                        {fieldErrors[appointmentTimeFieldName]}
                      </span>
                    ) : null}
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={addSchedule}
          disabled={draft.schedules.length >= 12}
        >
          Adicionar horário
        </button>
        <button className="button" type="submit" disabled={isSubmitDisabled}>
          {mode === "create" ? "Cadastrar e atribuir paciente" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
