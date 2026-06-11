"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createMasterEnrollmentAction } from "@/app/(app)/master/matriculas/actions";
import {
  createEmptyMasterEnrollmentFormValues,
  initialEnrollmentManagementActionState,
  type MasterEnrollmentFormValues
} from "@/app/(app)/master/matriculas/state";
import type {
  EnrollmentManagementClassOption,
  EnrollmentManagementCourseOption,
  EnrollmentManagementInstitutionOption,
  EnrollmentManagementOfferOption,
  EnrollmentManagementSemesterOption,
  EnrollmentManagementStudentOption
} from "@/services/enrollment-management";

interface MasterEnrollmentFormProps {
  institutions: EnrollmentManagementInstitutionOption[];
  courses: EnrollmentManagementCourseOption[];
  offers: EnrollmentManagementOfferOption[];
  semesters: EnrollmentManagementSemesterOption[];
  classes: EnrollmentManagementClassOption[];
  students: EnrollmentManagementStudentOption[];
}

export function MasterEnrollmentForm({
  institutions,
  courses,
  offers,
  semesters,
  classes,
  students
}: MasterEnrollmentFormProps) {
  const [state, formAction] = useActionState(
    createMasterEnrollmentAction,
    initialEnrollmentManagementActionState
  );
  const safeState = state ?? initialEnrollmentManagementActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<MasterEnrollmentFormValues>(() =>
    createEmptyMasterEnrollmentFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyMasterEnrollmentFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) => course.institutionId === draft.instituicao_id || !draft.instituicao_id
      ),
    [courses, draft.instituicao_id]
  );

  const filteredOffers = useMemo(
    () =>
      offers.filter((offer) => {
        const institutionMatches =
          offer.institutionId === draft.instituicao_id || !draft.instituicao_id;
        const courseMatches = offer.courseId === draft.curso_id || !draft.curso_id;

        return institutionMatches && courseMatches;
      }),
    [draft.curso_id, draft.instituicao_id, offers]
  );

  const filteredSemesters = useMemo(
    () =>
      semesters.filter((semester) => {
        if (!semester.offerId) {
          return false;
        }

        const offerMatches =
          semester.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id;
        const institutionMatches =
          semester.institutionId === draft.instituicao_id || !draft.instituicao_id;
        const courseMatches = semester.courseId === draft.curso_id || !draft.curso_id;

        return offerMatches && institutionMatches && courseMatches;
      }),
    [draft.curso_id, draft.instituicao_id, draft.oferta_curso_unidade_id, semesters]
  );

  const filteredClasses = useMemo(
    () =>
      classes.filter((classEntry) => {
        const semesterMatches = classEntry.semesterId === draft.semestre_id || !draft.semestre_id;
        const offerMatches = classEntry.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id;
        const institutionMatches =
          classEntry.institutionId === draft.instituicao_id || !draft.instituicao_id;
        const courseMatches = classEntry.courseId === draft.curso_id || !draft.curso_id;

        return semesterMatches && offerMatches && institutionMatches && courseMatches;
      }),
    [classes, draft.curso_id, draft.instituicao_id, draft.oferta_curso_unidade_id, draft.semestre_id]
  );

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        const courseMatches = !student.courseId || student.courseId === draft.curso_id || !draft.curso_id;
        const offerMatches =
          !student.offerId || student.offerId === draft.oferta_curso_unidade_id || !draft.oferta_curso_unidade_id;

        return courseMatches && offerMatches;
      }),
    [draft.curso_id, draft.oferta_curso_unidade_id, students]
  );

  useEffect(() => {
    if (draft.curso_id && !filteredCourses.some((course) => course.id === draft.curso_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        curso_id: "",
        oferta_curso_unidade_id: "",
        semestre_id: "",
        turma_id: ""
      }));
    }

    if (
      draft.oferta_curso_unidade_id &&
      !filteredOffers.some((offer) => offer.id === draft.oferta_curso_unidade_id)
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        oferta_curso_unidade_id: "",
        semestre_id: "",
        turma_id: ""
      }));
    }

    if (
      draft.semestre_id &&
      !filteredSemesters.some((semester) => semester.id === draft.semestre_id)
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        semestre_id: "",
        turma_id: ""
      }));
    }

    if (draft.turma_id && !filteredClasses.some((classEntry) => classEntry.id === draft.turma_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        turma_id: ""
      }));
    }

    if (draft.aluno_id && !filteredStudents.some((student) => student.id === draft.aluno_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        aluno_id: ""
      }));
    }
  }, [
    draft.aluno_id,
    draft.curso_id,
    draft.oferta_curso_unidade_id,
    draft.semestre_id,
    draft.turma_id,
    filteredClasses,
    filteredCourses,
    filteredOffers,
    filteredSemesters,
    filteredStudents
  ]);

  function updateDraft(field: keyof MasterEnrollmentFormValues, value: string) {
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

  const selectedStudent =
    filteredStudents.find((student) => student.id === draft.aluno_id) ?? null;

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

      <div className="form-grid">
        <label className={getFieldClassName("instituicao_id")}>
          <span>Instituicao</span>
          <select
            className={getInputClassName("instituicao_id")}
            name="instituicao_id"
            value={draft.instituicao_id}
            onChange={(event) => updateDraft("instituicao_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
          {fieldErrors.instituicao_id ? (
            <span className="field-error">{fieldErrors.instituicao_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("curso_id")}>
          <span>Curso</span>
          <select
            className={getInputClassName("curso_id")}
            name="curso_id"
            value={draft.curso_id}
            onChange={(event) => updateDraft("curso_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>
          {fieldErrors.curso_id ? <span className="field-error">{fieldErrors.curso_id}</span> : null}
        </label>

        <label className={getFieldClassName("oferta_curso_unidade_id")}>
          <span>Unidade / oferta</span>
          <select
            className={getInputClassName("oferta_curso_unidade_id")}
            name="oferta_curso_unidade_id"
            value={draft.oferta_curso_unidade_id}
            onChange={(event) =>
              updateDraft("oferta_curso_unidade_id", event.currentTarget.value)
            }
          >
            <option value="">Selecione</option>
            {filteredOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.unitName} - {offer.displayName}
              </option>
            ))}
          </select>
          {fieldErrors.oferta_curso_unidade_id ? (
            <span className="field-error">{fieldErrors.oferta_curso_unidade_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("semestre_id")}>
          <span>Semestre</span>
          <select
            className={getInputClassName("semestre_id")}
            name="semestre_id"
            value={draft.semestre_id}
            onChange={(event) => updateDraft("semestre_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.code} - {semester.name}
              </option>
            ))}
          </select>
          {fieldErrors.semestre_id ? (
            <span className="field-error">{fieldErrors.semestre_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("turma_id")}>
          <span>Turma</span>
          <select
            className={getInputClassName("turma_id")}
            name="turma_id"
            value={draft.turma_id}
            onChange={(event) => updateDraft("turma_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredClasses.map((classEntry) => (
              <option key={classEntry.id} value={classEntry.id}>
                {classEntry.code} - {classEntry.name}
              </option>
            ))}
          </select>
          {fieldErrors.turma_id ? <span className="field-error">{fieldErrors.turma_id}</span> : null}
        </label>

        <label className={getFieldClassName("aluno_id")}>
          <span>Aluno existente</span>
          <select
            className={getInputClassName("aluno_id")}
            name="aluno_id"
            value={draft.aluno_id}
            onChange={(event) => updateDraft("aluno_id", event.currentTarget.value)}
          >
            <option value="">Selecione</option>
            {filteredStudents.map((student) => (
              <option key={student.id} value={student.id}>
                {student.label}
              </option>
            ))}
          </select>
          {fieldErrors.aluno_id ? <span className="field-error">{fieldErrors.aluno_id}</span> : null}
          {!fieldErrors.aluno_id && selectedStudent ? (
            <span className="field-help">
              Curso atual: {selectedStudent.courseName ?? "nao definido"} | Oferta atual:{" "}
              {selectedStudent.offerName ?? "nao definida"}
            </span>
          ) : null}
        </label>

        <label className={getFieldClassName("status")}>
          <span>Status da matricula</span>
          <select
            className={getInputClassName("status")}
            name="status"
            value={draft.status}
            onChange={(event) =>
              updateDraft(
                "status",
                event.currentTarget.value as MasterEnrollmentFormValues["status"]
              )
            }
          >
            <option value="ativa">Ativa</option>
            <option value="concluida">Concluida</option>
            <option value="trancada">Trancada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          {fieldErrors.status ? <span className="field-error">{fieldErrors.status}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Vincular aluno a turma
        </button>
      </div>
    </form>
  );
}
