"use client";

import { useActionState, useEffect, useState } from "react";
import { copyFisioterapiaConfigurationAction } from "@/app/(app)/master/cursos/configuracoes/actions";
import {
  createEmptyCourseConfigurationCopyFormValues,
  initialCourseConfigurationCopyActionState,
  type CourseConfigurationCopyFormValues
} from "@/app/(app)/master/cursos/configuracoes/state";
import type { CourseConfigurationCopyTargetOption } from "@/services/course-configurations";

interface MasterCourseConfigurationCopyFormProps {
  destinationOptions: CourseConfigurationCopyTargetOption[];
}

export function MasterCourseConfigurationCopyForm({
  destinationOptions
}: MasterCourseConfigurationCopyFormProps) {
  const [state, formAction] = useActionState(
    copyFisioterapiaConfigurationAction,
    initialCourseConfigurationCopyActionState
  );
  const safeState = state ?? initialCourseConfigurationCopyActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<CourseConfigurationCopyFormValues>(() =>
    createEmptyCourseConfigurationCopyFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyCourseConfigurationCopyFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  return (
    <form action={formAction} className="form-stack">
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

      <label className={fieldErrors.destination_course_id ? "field field-invalid" : "field"}>
        <span>Curso destino</span>
        <select
          className={fieldErrors.destination_course_id ? "input input-invalid" : "input"}
          name="destination_course_id"
          value={draft.destination_course_id}
          onChange={(event) => {
            const value = event.currentTarget.value;

            setDraft((currentDraft) => ({
              ...currentDraft,
              destination_course_id: value
            }));
          }}
        >
          <option value="">Selecione</option>
          {destinationOptions.map((option) => (
            <option key={option.courseId} value={option.courseId}>
              {`${option.institutionName} - ${option.courseName} (${option.courseCode}) - ${option.status} - origem: ${option.sourceLabel}`}
            </option>
          ))}
        </select>
        <span className="field-help">
          O sistema usa primeiro a Fisioterapia configurada da mesma IES. Se ela nao existir,
          tenta a base padrao global ja consolidada. Se o curso destino ja tiver grupos,
          criterios ou documentos obrigatorios cadastrados, a duplicacao sera bloqueada.
        </span>
        {fieldErrors.destination_course_id ? (
          <span className="field-error">{fieldErrors.destination_course_id}</span>
        ) : null}
      </label>

      <div className="actions-row">
        <button className="button" type="submit" disabled={!destinationOptions.length}>
          Duplicar base da Fisioterapia
        </button>
      </div>
    </form>
  );
}
