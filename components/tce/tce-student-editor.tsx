"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { saveStudentTceDataAction } from "@/app/(app)/tce/actions";
import {
  createStudentTceFormValuesFromData,
  initialStudentTceActionState,
  type StudentTceFormValues
} from "@/app/(app)/tce/state";
import { StudentTceForm } from "@/components/tce/student-tce-form";
import { TcePreview } from "@/components/tce/tce-preview";
import { formatDateTime } from "@/lib/utils/format";
import type { StudentTceAvailableEntry } from "@/services/tce";

interface TceStudentEditorProps {
  entry: StudentTceAvailableEntry;
}

export function TceStudentEditor({ entry }: TceStudentEditorProps) {
  const initialValues = useMemo(
    () =>
      createStudentTceFormValuesFromData({
        configurationId: entry.configuration.id,
        enrollmentId: entry.enrollmentId,
        areaId: entry.areaId,
        studentData: entry.initialStudentData
      }),
    [entry]
  );
  const [state, formAction] = useActionState(saveStudentTceDataAction, {
    ...initialStudentTceActionState,
    formValues: initialValues,
    savedAt: entry.savedTce?.updatedAt ?? null
  });
  const safeState = state ?? {
    ...initialStudentTceActionState,
    formValues: initialValues,
    savedAt: entry.savedTce?.updatedAt ?? null
  };
  const [draft, setDraft] = useState<StudentTceFormValues>(initialValues);

  useEffect(() => {
    setDraft(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft(safeState.formValues);
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof StudentTceFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  const effectiveSavedAt = safeState.savedAt ?? entry.savedTce?.updatedAt ?? null;

  return (
    <div className="stack">
      <div className="management-block-card student-tce-summary-card">
        <div className="student-tce-summary-header">
          <div>
            <h3>{entry.label}</h3>
            <p>{entry.helperText}</p>
          </div>
          {effectiveSavedAt ? (
            <span className="badge">
              Dados salvos em {formatDateTime(effectiveSavedAt)}
            </span>
          ) : (
            <span className="badge badge-muted">Sem salvamento anterior</span>
          )}
        </div>
      </div>

      <div className="split-grid student-tce-page-split">
        <div className="student-tce-form-column">
          <StudentTceForm
            entry={entry}
            draft={draft}
            state={safeState}
            formAction={formAction}
            onChange={updateDraft}
          />
        </div>

        <div className="student-tce-preview-column">
          <TcePreview entry={entry} draft={draft} />
        </div>
      </div>
    </div>
  );
}
