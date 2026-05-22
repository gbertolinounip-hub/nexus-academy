"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { updateStudentSemesterAction } from "@/app/(app)/gestao/alunos/actions";
import {
  createEmptyStudentAssignment,
  createInitialStudentStageManagementFormValues,
  initialStudentStageManagementActionState,
  type StudentRegistrationAssignmentFormValue
} from "@/app/(app)/gestao/alunos/state";
import type {
  ManagementAreaBlock,
  ManagementProfessorOption,
  ManagementSemesterOption,
  ManagementStudentSemesterRecord
} from "@/services/management";

interface StudentStageManagementFormProps {
  studentId: string;
  studentIsActive: boolean;
  manageableSemesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
  semesterHistory: ManagementStudentSemesterRecord[];
  defaultSemesterId: string;
}

function createAssignmentRowId() {
  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAssignmentRowsFromHistory(
  semesterRecord?: ManagementStudentSemesterRecord
): StudentRegistrationAssignmentFormValue[] {
  const activeAssignments =
    semesterRecord?.assignments.filter(
      (assignment) => assignment.enrollmentStatus === "ativa"
    ) ?? [];

  if (!activeAssignments.length) {
    return [createEmptyStudentAssignment(createAssignmentRowId())];
  }

  return activeAssignments.map((assignment) => ({
    row_id: createAssignmentRowId(),
    area_id: assignment.areaId ?? "",
    supervisor_1_id: assignment.currentSupervisorIds[0] ?? "",
    supervisor_2_id: assignment.currentSupervisorIds[1] ?? ""
  }));
}

function ensureAssignmentRows(
  assignments: StudentRegistrationAssignmentFormValue[] | undefined
) {
  if (assignments && assignments.length > 0) {
    return assignments;
  }

  return [createEmptyStudentAssignment(createAssignmentRowId())];
}

export function StudentStageManagementForm({
  studentId,
  studentIsActive,
  manageableSemesters,
  areaBlocks,
  professorOptions,
  semesterHistory,
  defaultSemesterId
}: StudentStageManagementFormProps) {
  const [state, formAction] = useActionState(
    updateStudentSemesterAction,
    initialStudentStageManagementActionState
  );
  const safeState = state ?? initialStudentStageManagementActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const historyMap = useMemo(
    () => new Map(semesterHistory.map((semesterRecord) => [semesterRecord.semesterId, semesterRecord])),
    [semesterHistory]
  );
  const [selectedSemesterId, setSelectedSemesterId] = useState(
    defaultSemesterId || manageableSemesters[0]?.id || ""
  );
  const [draftAssignments, setDraftAssignments] = useState<
    StudentRegistrationAssignmentFormValue[]
  >(() =>
    buildAssignmentRowsFromHistory(historyMap.get(defaultSemesterId || manageableSemesters[0]?.id))
  );

  const allAreas = useMemo(() => areaBlocks.flatMap((block) => block.areas), [areaBlocks]);

  const selectedSemester = manageableSemesters.find(
    (semester) => semester.id === selectedSemesterId
  );

  useEffect(() => {
    const nextSemesterId = defaultSemesterId || manageableSemesters[0]?.id || "";
    setSelectedSemesterId(nextSemesterId);
    setDraftAssignments(buildAssignmentRowsFromHistory(historyMap.get(nextSemesterId)));
  }, [defaultSemesterId, historyMap, manageableSemesters]);

  useEffect(() => {
    if (!safeState.formValues) {
      return;
    }

    setSelectedSemesterId(safeState.formValues.semestre_id);
    setDraftAssignments(ensureAssignmentRows(safeState.formValues.assignments));
  }, [safeState.formValues, safeState.submittedAt]);

  function updateAssignment(
    rowId: string,
    field: keyof StudentRegistrationAssignmentFormValue,
    value: string
  ) {
    setDraftAssignments((currentAssignments) =>
      currentAssignments.map((assignment) =>
        assignment.row_id === rowId ? { ...assignment, [field]: value } : assignment
      )
    );
  }

  function addAssignment() {
    setDraftAssignments((currentAssignments) => [
      ...currentAssignments,
      createEmptyStudentAssignment(createAssignmentRowId())
    ]);
  }

  function removeAssignment(rowId: string) {
    setDraftAssignments((currentAssignments) =>
      ensureAssignmentRows(
        currentAssignments.filter((assignment) => assignment.row_id !== rowId)
      )
    );
  }

  function handleSemesterChange(nextSemesterId: string) {
    setSelectedSemesterId(nextSemesterId);
    setDraftAssignments(buildAssignmentRowsFromHistory(historyMap.get(nextSemesterId)));
  }

  function handlePrepareNewSemester() {
    const usedSemesterIds = new Set(semesterHistory.map((semesterRecord) => semesterRecord.semesterId));
    const nextSemester =
      manageableSemesters.find((semester) => !usedSemesterIds.has(semester.id)) ??
      manageableSemesters.find((semester) => semester.id !== selectedSemesterId);

    if (!nextSemester) {
      return;
    }

    setSelectedSemesterId(nextSemester.id);
    setDraftAssignments([createEmptyStudentAssignment(createAssignmentRowId())]);
  }

  function handleCopyPreviousSemester() {
    const selectedIndex = manageableSemesters.findIndex(
      (semester) => semester.id === selectedSemesterId
    );

    if (selectedIndex <= 0) {
      return;
    }

    const previousSemester = manageableSemesters.slice(selectedIndex + 1).find((semester) => {
      const semesterRecord = historyMap.get(semester.id);
      return Boolean(semesterRecord?.assignments.length);
    });

    if (!previousSemester) {
      return;
    }

    setDraftAssignments(buildAssignmentRowsFromHistory(historyMap.get(previousSemester.id)));
  }

  function getFieldClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  function getAvailableProfessorOptions(areaId: string) {
    if (!areaId) {
      return [];
    }

    return professorOptions.filter((professor) => professor.areaIds.includes(areaId));
  }

  function isAreaTakenByAnotherAssignment(areaId: string, rowId: string) {
    if (!areaId) {
      return false;
    }

    return draftAssignments.some(
      (assignment) => assignment.row_id !== rowId && assignment.area_id === areaId
    );
  }

  function getAssignmentFieldName(
    assignmentIndex: number,
    fieldName: keyof StudentRegistrationAssignmentFormValue
  ) {
    return `assignments.${assignmentIndex}.${fieldName}`;
  }

  const hasAvailableAdditionalSemester = manageableSemesters.some(
    (semester) => semester.id !== selectedSemesterId
  );
  const canCopyPreviousSemester = manageableSemesters.some((semester) => {
    if (semester.id === selectedSemesterId) {
      return false;
    }

    return Boolean(historyMap.get(semester.id)?.assignments.length);
  });

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="semestre_id" value={selectedSemesterId} />
      <input
        type="hidden"
        name="assignments_payload"
        value={JSON.stringify(draftAssignments)}
      />

      {!studentIsActive ? (
        <div className="form-notice form-notice-error">
          O cadastro do aluno está inativo. Reative o aluno antes de criar ou editar
          vínculos de estágio.
        </div>
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

      <div className="management-student-toolbar">
        <label className={getFieldClassName("semestre_id")}>
          <span>Semestre do estágio</span>
          <select
            className={getInputClassName("semestre_id")}
            value={selectedSemesterId}
            onChange={(event) => handleSemesterChange(event.currentTarget.value)}
            disabled={!manageableSemesters.length}
          >
            {manageableSemesters.length ? null : (
              <option value="">Não há semestres abertos para gestão</option>
            )}
            {manageableSemesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.label}
              </option>
            ))}
          </select>
          {fieldErrors.semestre_id ? (
            <span className="field-error">{fieldErrors.semestre_id}</span>
          ) : null}
        </label>

        <div className="actions-row">
          <button
            type="button"
            className="button button-secondary"
            onClick={handlePrepareNewSemester}
            disabled={!hasAvailableAdditionalSemester}
          >
            Adicionar novo semestre
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={handleCopyPreviousSemester}
            disabled={!canCopyPreviousSemester}
          >
            Copiar semestre anterior
          </button>
        </div>
      </div>

      {selectedSemester ? (
        <div className="management-stage-summary">
          <strong>{selectedSemester.label}</strong>
          <span>
            Use este bloco para criar o semestre pela primeira vez ou ajustar áreas e
            supervisores sem recadastrar o aluno.
          </span>
        </div>
      ) : null}

      <div className="management-slots">
        {draftAssignments.map((assignment, assignmentIndex) => {
          const areaFieldName = getAssignmentFieldName(assignmentIndex, "area_id");
          const supervisor1FieldName = getAssignmentFieldName(
            assignmentIndex,
            "supervisor_1_id"
          );
          const supervisor2FieldName = getAssignmentFieldName(
            assignmentIndex,
            "supervisor_2_id"
          );
          const availableProfessors = getAvailableProfessorOptions(assignment.area_id);

          return (
            <div key={assignment.row_id} className="management-slot-card">
              <div className="management-slot-header">
                <div>
                  <h3>Área do semestre {assignmentIndex + 1}</h3>
                  <p className="field-help">
                    Cada área pode ter zero, um ou dois supervisores responsáveis.
                  </p>
                </div>
                {draftAssignments.length > 1 ? (
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => removeAssignment(assignment.row_id)}
                  >
                    Remover área
                  </button>
                ) : null}
              </div>

              <div className="form-grid">
                <label className={getFieldClassName(areaFieldName)}>
                  <span>Área de estágio</span>
                  <select
                    className={getInputClassName(areaFieldName)}
                    value={assignment.area_id}
                    onChange={(event) => {
                      const newAreaId = event.currentTarget.value;
                      const validProfessors = getAvailableProfessorOptions(newAreaId);

                      updateAssignment(assignment.row_id, "area_id", newAreaId);

                      if (
                        !validProfessors.some(
                          (professor) => professor.id === assignment.supervisor_1_id
                        )
                      ) {
                        updateAssignment(assignment.row_id, "supervisor_1_id", "");
                      }

                      if (
                        !validProfessors.some(
                          (professor) => professor.id === assignment.supervisor_2_id
                        )
                      ) {
                        updateAssignment(assignment.row_id, "supervisor_2_id", "");
                      }
                    }}
                    disabled={!selectedSemesterId || !studentIsActive}
                  >
                    <option value="">
                      {selectedSemesterId ? "Selecione uma área" : "Escolha o semestre primeiro"}
                    </option>
                    {areaBlocks.map((block) => (
                      <optgroup key={block.id} label={block.name}>
                        {block.areas.map((área) => (
                          <option
                            key={área.id}
                            value={área.id}
                            disabled={isAreaTakenByAnotherAssignment(área.id, assignment.row_id)}
                          >
                            {área.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  {fieldErrors[areaFieldName] ? (
                    <span className="field-error">{fieldErrors[areaFieldName]}</span>
                  ) : null}
                </label>

                <label className={getFieldClassName(supervisor1FieldName)}>
                  <span>Supervisor principal</span>
                  <select
                    className={getInputClassName(supervisor1FieldName)}
                    value={assignment.supervisor_1_id}
                    onChange={(event) => {
                      const nextSupervisorId = event.currentTarget.value;
                      updateAssignment(assignment.row_id, "supervisor_1_id", nextSupervisorId);

                      if (nextSupervisorId && nextSupervisorId === assignment.supervisor_2_id) {
                        updateAssignment(assignment.row_id, "supervisor_2_id", "");
                      }
                    }}
                    disabled={!assignment.area_id || !studentIsActive}
                  >
                    <option value="">
                      {assignment.area_id ? "Supervisor opcional" : "Escolha a área primeiro"}
                    </option>
                    {availableProfessors.map((professor) => (
                      <option key={professor.id} value={professor.id}>
                        {professor.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors[supervisor1FieldName] ? (
                    <span className="field-error">{fieldErrors[supervisor1FieldName]}</span>
                  ) : null}
                </label>

                <label className={getFieldClassName(supervisor2FieldName)}>
                  <span>Supervisor adicional</span>
                  <select
                    className={getInputClassName(supervisor2FieldName)}
                    value={assignment.supervisor_2_id}
                    onChange={(event) =>
                      updateAssignment(
                        assignment.row_id,
                        "supervisor_2_id",
                        event.currentTarget.value
                      )
                    }
                    disabled={!assignment.area_id || !studentIsActive}
                  >
                    <option value="">
                      {assignment.area_id
                        ? "Supervisor adicional opcional"
                        : "Escolha a área primeiro"}
                    </option>
                    {availableProfessors.map((professor) => (
                      <option
                        key={professor.id}
                        value={professor.id}
                        disabled={professor.id === assignment.supervisor_1_id}
                      >
                        {professor.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors[supervisor2FieldName] ? (
                    <span className="field-error">{fieldErrors[supervisor2FieldName]}</span>
                  ) : null}
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="button button-secondary"
          onClick={addAssignment}
          disabled={
            !studentIsActive ||
            !selectedSemesterId ||
            draftAssignments.length >= allAreas.length
          }
        >
          Adicionar área
        </button>
        <button className="button" type="submit" disabled={!studentIsActive || !selectedSemesterId}>
          Salvar vínculos do semestre
        </button>
      </div>
    </form>
  );
}





