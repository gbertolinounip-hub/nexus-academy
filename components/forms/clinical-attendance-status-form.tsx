"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { saveClinicalAttendanceStatusAction } from "@/app/(app)/clinica-supervisionada/atendimentos/actions";
import {
  initialClinicalAttendanceActionState,
  type ClinicalAttendanceActionFormValues
} from "@/app/(app)/clinica-supervisionada/atendimentos/state";
import type { ClinicalAttendanceSummary } from "@/types/domain";

interface ClinicalAttendanceStatusFormProps {
  item: ClinicalAttendanceSummary;
}

function SubmitButton({
  presenceStatus,
  children,
  secondary = false,
  disabled = false
}: {
  presenceStatus: "presente" | "ausente";
  children: string;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="presence_status"
      value={presenceStatus}
      className={secondary ? "button button-secondary button-small" : "button button-small"}
      disabled={pending || disabled}
    >
      {pending ? "Salvando..." : children}
    </button>
  );
}

function buildDraftValues(
  item: ClinicalAttendanceSummary,
  submittedValues?: ClinicalAttendanceActionFormValues
): ClinicalAttendanceActionFormValues {
  return {
    attendance_id: submittedValues?.attendance_id ?? item.attendanceId ?? "",
    case_id: submittedValues?.case_id ?? item.caseItem.id,
    attendance_date: submittedValues?.attendance_date ?? item.appointmentDate,
    schedule_id: submittedValues?.schedule_id ?? item.scheduleId ?? "",
    presence_status: submittedValues?.presence_status ?? "",
    administrative_note:
      submittedValues?.administrative_note ?? item.administrativeNote ?? ""
  };
}

export function ClinicalAttendanceStatusForm({
  item
}: ClinicalAttendanceStatusFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    saveClinicalAttendanceStatusAction,
    initialClinicalAttendanceActionState
  );
  const safeState = state ?? initialClinicalAttendanceActionState;
  const [draft, setDraft] = useState<ClinicalAttendanceActionFormValues>(() =>
    buildDraftValues(item)
  );

  useEffect(() => {
    setDraft(buildDraftValues(item));
  }, [item]);

  useEffect(() => {
    if (safeState.status !== "error") {
      return;
    }

    setDraft(buildDraftValues(item, safeState.formValues));
  }, [item, safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    router.refresh();
  }, [router, safeState.status, safeState.submittedAt]);

  return (
    <form action={formAction} className="clinical-attendance-status-form">
      <input type="hidden" name="attendance_id" value={draft.attendance_id ?? ""} />
      <input type="hidden" name="case_id" value={draft.case_id} />
      <input type="hidden" name="attendance_date" value={draft.attendance_date} />
      <input type="hidden" name="schedule_id" value={draft.schedule_id} />

      <label className="field clinical-attendance-status-form-note">
        <span>Observação administrativa</span>
        <textarea
          className="input textarea"
          name="administrative_note"
          rows={3}
          value={draft.administrative_note}
          onChange={(event) =>
            setDraft((currentDraft) => ({
              ...currentDraft,
              administrative_note: event.currentTarget.value
            }))
          }
          placeholder="Opcional. Registre contexto operacional da presença ou ausência."
        />
      </label>

      {safeState.message ? (
        <p
          className={
            safeState.status === "success"
              ? "form-notice form-notice-success"
              : "form-notice form-notice-error"
          }
        >
          {safeState.message}
        </p>
      ) : null}

      <div className="clinical-attendance-status-form-actions">
        <SubmitButton presenceStatus="presente">Paciente presente</SubmitButton>
        <SubmitButton
          presenceStatus="ausente"
          secondary
          disabled={Boolean(item.evolutionRecordId)}
        >
          Paciente ausente
        </SubmitButton>
      </div>
    </form>
  );
}
