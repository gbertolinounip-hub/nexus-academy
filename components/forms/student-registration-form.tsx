"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createStudentRegistrationAction } from "@/app/(app)/gestao/alunos/actions";
import {
  createEmptyStudentAssignment,
  createInitialStudentRegistrationFormValues,
  initialStudentRegistrationActionState,
  type StudentRegistrationAssignmentFormValue,
  type StudentRegistrationFormValues
} from "@/app/(app)/gestao/alunos/state";
import type {
  ManagementAreaBlock,
  ManagementProfessorOption,
  ManagementSemesterOption
} from "@/services/management";

interface StudentRegistrationFormProps {
  semesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
}

function createAssignmentRowId() {
  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildInitialDraft(
  _semesters: ManagementSemesterOption[]
): StudentRegistrationFormValues {
  return {
    ...createInitialStudentRegistrationFormValues(),
    semestre_id: "",
    assignments: [createEmptyStudentAssignment(createAssignmentRowId())]
  };
}

function ensureAssignmentRows(
  assignments: StudentRegistrationAssignmentFormValue[] | undefined
) {
  if (assignments && assignments.length > 0) {
    return assignments;
  }

  return [createEmptyStudentAssignment(createAssignmentRowId())];
}

export function StudentRegistrationForm({
  semesters,
  areaBlocks,
  professorOptions
}: StudentRegistrationFormProps) {
  const [state, formAction] = useActionState(
    createStudentRegistrationAction,
    initialStudentRegistrationActionState
  );
  const safeState = state ?? initialStudentRegistrationActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<StudentRegistrationFormValues>(() =>
    buildInitialDraft(semesters)
  );
  const [isConflictDismissed, setIsConflictDismissed] = useState(false);

  const allAreas = useMemo(() => areaBlocks.flatMap((block) => block.areas), [areaBlocks]);
  const conflictInfo = safeState.status === "conflict" ? safeState.conflictInfo ?? null : null;
  const shouldShowConflictResolution = Boolean(conflictInfo && !isConflictDismissed);

  useEffect(() => {
    setDraft(buildInitialDraft(semesters));
  }, [semesters]);

  useEffect(() => {
    if (
      (safeState.status !== "error" && safeState.status !== "conflict") ||
      !safeState.formValues
    ) {
      return;
    }

    setDraft({
      ...safeState.formValues,
      assignments: ensureAssignmentRows(safeState.formValues.assignments)
    });
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    setDraft(buildInitialDraft(semesters));
  }, [safeState.status, safeState.submittedAt, semesters]);

  useEffect(() => {
    setIsConflictDismissed(false);
  }, [safeState.status, safeState.submittedAt]);

  function updateDraft(
    field: Exclude<keyof StudentRegistrationFormValues, "assignments">,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  function updateAssignment(
    rowId: string,
    field: keyof StudentRegistrationAssignmentFormValue,
    value: string
  ) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      assignments: currentDraft.assignments.map((assignment) =>
        assignment.row_id === rowId ? { ...assignment, [field]: value } : assignment
      )
    }));
  }

  function addAssignment() {
    setDraft((currentDraft) => ({
      ...currentDraft,
      assignments: [
        ...currentDraft.assignments,
        createEmptyStudentAssignment(createAssignmentRowId())
      ]
    }));
  }

  function removeAssignment(rowId: string) {
    setDraft((currentDraft) => {
      const remainingAssignments = currentDraft.assignments.filter(
        (assignment) => assignment.row_id !== rowId
      );

      return {
        ...currentDraft,
        assignments: ensureAssignmentRows(remainingAssignments)
      };
    });
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

    return draft.assignments.some(
      (assignment) => assignment.row_id !== rowId && assignment.area_id === areaId
    );
  }

  function getAssignmentFieldName(
    assignmentIndex: number,
    fieldName: keyof StudentRegistrationAssignmentFormValue
  ) {
    return `assignments.${assignmentIndex}.${fieldName}`;
  }

  return (
    <form action={formAction} className="form-stack">
      <input
        type="hidden"
        name="assignments_payload"
        value={JSON.stringify(draft.assignments)}
      />
      <input
        type="hidden"
        name="existing_student_user_id"
        value={conflictInfo?.userId ?? ""}
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

      {shouldShowConflictResolution && conflictInfo ? (
        <div className="management-block-card student-registration-resolution-card">
          <div className="management-block-header">
            <div>
              <h3>Cadastro-base já encontrado</h3>
              <p className="field-help">
                O e-mail informado já pertence a um aluno desta unidade. Escolha
                como deseja reaproveitar o histórico sem duplicar a pessoa.
              </p>
            </div>
          </div>

          <div className="report-mini-grid student-registration-resolution-grid">
            <div className="report-mini-card">
              <span>Aluno localizado</span>
              <strong>{conflictInfo.name}</strong>
            </div>
            <div className="report-mini-card">
              <span>RA atual</span>
              <strong>{conflictInfo.registration}</strong>
            </div>
            <div className="report-mini-card">
              <span>Status operacional</span>
              <strong>{conflictInfo.isActive ? "Ativo" : "Arquivado"}</strong>
            </div>
            <div className="report-mini-card">
              <span>Acesso acadêmico</span>
              <strong>
                {conflictInfo.hasOperationalActiveSemester
                  ? "Há vínculo ativo"
                  : "Sem vínculo ativo"}
              </strong>
            </div>
            <div className="report-mini-card">
              <span>Semestre selecionado</span>
              <strong>{conflictInfo.selectedSemesterLabel ?? "Não informado"}</strong>
            </div>
          </div>

          <div className="stack student-registration-resolution-copy">
            <p className="field-help">
              <strong>Reativar cadastro existente</strong> atualiza os dados-base,
              redefine a senha informada e reavalia o acesso operacional do aluno.
            </p>
            <p className="field-help">
              <strong>Vincular ao semestre atual</strong> reaproveita a mesma
              pessoa e cria ou reativa somente os vínculos do semestre e das áreas
              informadas, sem duplicar matrícula.
            </p>
            {conflictInfo.selectedSemesterLinked ? (
              <p className="field-help">
                Este aluno já possui vínculo no semestre selecionado. A operação
                vai reaproveitar esse histórico e evitar duplicações indevidas.
              </p>
            ) : null}
            {!conflictInfo.canLinkCurrentSemester && conflictInfo.linkDisabledReason ? (
              <p className="field-help">{conflictInfo.linkDisabledReason}</p>
            ) : null}
          </div>

          <div className="actions-row">
            <button
              className="button"
              type="submit"
              name="existing_student_resolution"
              value="reactivate"
            >
              Reativar cadastro existente
            </button>
            <button
              className="button button-secondary"
              type="submit"
              name="existing_student_resolution"
              value="link"
              disabled={!conflictInfo.canLinkCurrentSemester}
            >
              Vincular ao semestre atual
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setIsConflictDismissed(true)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      <div className="form-grid">
        <label className={getFieldClassName("nome_completo")}>
          <span>Nome completo</span>
          <input
            className={getInputClassName("nome_completo")}
            name="nome_completo"
            value={draft.nome_completo}
            onChange={(event) => updateDraft("nome_completo", event.currentTarget.value)}
          />
          {fieldErrors.nome_completo ? (
            <span className="field-error">{fieldErrors.nome_completo}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("ra")}>
          <span>RA</span>
          <input
            className={getInputClassName("ra")}
            name="ra"
            value={draft.ra}
            onChange={(event) => updateDraft("ra", event.currentTarget.value)}
          />
          {fieldErrors.ra ? <span className="field-error">{fieldErrors.ra}</span> : null}
        </label>

        <label className={getFieldClassName("celular")}>
          <span>Celular</span>
          <input
            className={getInputClassName("celular")}
            name="celular"
            value={draft.celular}
            onChange={(event) => updateDraft("celular", event.currentTarget.value)}
          />
          {fieldErrors.celular ? (
            <span className="field-error">{fieldErrors.celular}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("email")}>
          <span>E-mail de acesso</span>
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
          <span>Senha de acesso</span>
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

        <label className={getFieldClassName("semestre_id")}>
          <span>Semestre inicial (opcional)</span>
          <select
            className={getInputClassName("semestre_id")}
            name="semestre_id"
            value={draft.semestre_id}
            onChange={(event) => updateDraft("semestre_id", event.currentTarget.value)}
          >
            <option value="">Cadastrar aluno sem vínculo inicial</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.label}
              </option>
            ))}
          </select>
          {fieldErrors.semestre_id ? (
            <span className="field-error">{fieldErrors.semestre_id}</span>
          ) : null}
        </label>
      </div>

      <div className="management-slots">
        {draft.assignments.map((assignment, assignmentIndex) => {
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
                  <h3>Área vinculada {assignmentIndex + 1}</h3>
                  <p className="field-help">
                    Cada área pode ter nenhum, um ou dois supervisores neste momento.
                  </p>
                </div>
                {draft.assignments.length > 1 ? (
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
                    disabled={!draft.semestre_id}
                  >
                    <option value="">
                      {draft.semestre_id
                        ? "Selecione uma área"
                        : "Escolha o semestre inicial primeiro"}
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
                  {!draft.semestre_id ? (
                    <span className="field-help">
                      Sem semestre inicial, o aluno será cadastrado sem vínculos de estágio.
                    </span>
                  ) : null}
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
                    disabled={!assignment.area_id || !draft.semestre_id}
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
                    disabled={!assignment.area_id || !draft.semestre_id}
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
          disabled={!draft.semestre_id || draft.assignments.length >= allAreas.length}
        >
          Adicionar área
        </button>
        <button className="button" type="submit">
          Cadastrar aluno
        </button>
      </div>
    </form>
  );
}




