"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createExceptionalReleaseAction } from "@/app/(app)/coordenador/liberacoes-excepcionais/actions";
import {
  createInitialExceptionalReleaseFormValues,
  initialExceptionalReleaseActionState,
  type ExceptionalReleaseFormValues
} from "@/app/(app)/coordenador/liberacoes-excepcionais/state";
import type {
  ExceptionalReleaseClassOption,
  ExceptionalReleaseRecipientOption,
  ExceptionalReleaseSemesterOption,
  ExceptionalReleaseStudentOption
} from "@/services/exceptional-releases";

interface ExceptionalReleaseFormProps {
  semesterOptions: ExceptionalReleaseSemesterOption[];
  classOptions: ExceptionalReleaseClassOption[];
  studentOptions: ExceptionalReleaseStudentOption[];
  recipientOptions: ExceptionalReleaseRecipientOption[];
}

export function ExceptionalReleaseForm({
  semesterOptions,
  classOptions,
  studentOptions,
  recipientOptions
}: ExceptionalReleaseFormProps) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    createExceptionalReleaseAction,
    initialExceptionalReleaseActionState
  );
  const safeState = state ?? initialExceptionalReleaseActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<ExceptionalReleaseFormValues>(
    createInitialExceptionalReleaseFormValues
  );
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (safeState.status !== "error") {
      return;
    }

    setDraft(safeState.formValues);
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  useEffect(() => {
    if (safeState.status !== "success") {
      return;
    }

    setDraft(createInitialExceptionalReleaseFormValues());
    setStudentSearch("");
    startTransition(() => {
      router.refresh();
    });
  }, [router, safeState.status, safeState.submittedAt]);

  const filteredClasses = useMemo(
    () =>
      classOptions.filter((classOption) => classOption.semesterId === draft.semestre_id),
    [classOptions, draft.semestre_id]
  );

  const filteredStudents = useMemo(() => {
    const normalizedSearch = studentSearch.trim().toLocaleLowerCase("pt-BR");

    return studentOptions.filter((studentOption) => {
      if (studentOption.semesterId !== draft.semestre_id) {
        return false;
      }

      if (draft.turma_id && !studentOption.classIds.includes(draft.turma_id)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${studentOption.name} ${studentOption.registration} ${studentOption.classLabel} ${studentOption.email}`
        .toLocaleLowerCase("pt-BR");

      return haystack.includes(normalizedSearch);
    });
  }, [draft.semestre_id, draft.turma_id, studentOptions, studentSearch]);

  useEffect(() => {
    if (draft.turma_id && !filteredClasses.some((classOption) => classOption.id === draft.turma_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        turma_id: "",
        aluno_id: ""
      }));
    }
  }, [draft.turma_id, filteredClasses]);

  useEffect(() => {
    if (draft.aluno_id && !filteredStudents.some((studentOption) => studentOption.id === draft.aluno_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        aluno_id: ""
      }));
    }
  }, [draft.aluno_id, filteredStudents]);

  function updateDraft(
    field: keyof ExceptionalReleaseFormValues,
    value: string
  ) {
    setDraft((currentDraft) => {
      if (field === "escopo") {
        if (value === "semestre") {
          return {
            ...currentDraft,
            escopo: "semestre",
            turma_id: "",
            aluno_id: ""
          };
        }

        if (value === "turma") {
          return {
            ...currentDraft,
            escopo: "turma",
            aluno_id: ""
          };
        }
      }

      if (field === "semestre_id") {
        return {
          ...currentDraft,
          semestre_id: value,
          turma_id: "",
          aluno_id: ""
        };
      }

      if (field === "turma_id") {
        return {
          ...currentDraft,
          turma_id: value,
          aluno_id: ""
        };
      }

      return {
        ...currentDraft,
        [field]: value
      };
    });
  }

  function getFieldClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  const creationDisabled = !semesterOptions.length || !recipientOptions.length;

  return (
    <form action={formAction} className="form-stack exceptional-release-form">
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

      <div className="form-grid exceptional-release-form-grid">
        <label className={getFieldClassName("tipo")}>
          <span>Tipo da liberação</span>
          <select
            className={getInputClassName("tipo")}
            name="tipo"
            value={draft.tipo}
            onChange={(event) => updateDraft("tipo", event.currentTarget.value)}
          >
            <option value="avaliacao">Avaliação</option>
            <option value="ausencia">Ausência</option>
            <option value="clinica_supervisionada">Clínica supervisionada</option>
          </select>
          {fieldErrors.tipo ? <span className="field-error">{fieldErrors.tipo}</span> : null}
        </label>

        <label className={getFieldClassName("escopo")}>
          <span>Escopo</span>
          <select
            className={getInputClassName("escopo")}
            name="escopo"
            value={draft.escopo}
            onChange={(event) => updateDraft("escopo", event.currentTarget.value)}
          >
            <option value="semestre">Semestre</option>
            <option value="turma">Turma</option>
            <option value="aluno">Aluno</option>
          </select>
          <span className="field-help">
            O escopo define se a liberação vale para todo o semestre, uma turma ou um aluno específico.
          </span>
          {fieldErrors.escopo ? <span className="field-error">{fieldErrors.escopo}</span> : null}
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
            {semesterOptions.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {semester.label}
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
            disabled={!draft.semestre_id || draft.escopo === "semestre"}
            onChange={(event) => updateDraft("turma_id", event.currentTarget.value)}
          >
            <option value="">
              {draft.escopo === "semestre" ? "Não se aplica" : "Selecione"}
            </option>
            {filteredClasses.map((classOption) => (
              <option key={classOption.id} value={classOption.id}>
                {classOption.label}
              </option>
            ))}
          </select>
          <span className="field-help">
            Para escopo por turma, selecione a turma liberada. Para escopo por aluno, a turma é opcional e ajuda a localizar o vínculo certo.
          </span>
          {fieldErrors.turma_id ? <span className="field-error">{fieldErrors.turma_id}</span> : null}
        </label>

        <label className={getFieldClassName("usuario_autorizado_id")}>
          <span>Usuário liberado</span>
          <select
            className={getInputClassName("usuario_autorizado_id")}
            name="usuario_autorizado_id"
            value={draft.usuario_autorizado_id}
            onChange={(event) =>
              updateDraft("usuario_autorizado_id", event.currentTarget.value)
            }
          >
            <option value="">Selecione</option>
            {recipientOptions.map((recipient) => (
              <option key={recipient.id} value={recipient.id}>
                {recipient.label}
              </option>
            ))}
          </select>
          {fieldErrors.usuario_autorizado_id ? (
            <span className="field-error">{fieldErrors.usuario_autorizado_id}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("inicio_em")}>
          <span>Início da vigência</span>
          <input
            className={getInputClassName("inicio_em")}
            type="datetime-local"
            name="inicio_em"
            value={draft.inicio_em}
            onChange={(event) => updateDraft("inicio_em", event.currentTarget.value)}
          />
          {fieldErrors.inicio_em ? (
            <span className="field-error">{fieldErrors.inicio_em}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("expira_em")}>
          <span>Expiração da vigência</span>
          <input
            className={getInputClassName("expira_em")}
            type="datetime-local"
            name="expira_em"
            value={draft.expira_em}
            onChange={(event) => updateDraft("expira_em", event.currentTarget.value)}
          />
          {fieldErrors.expira_em ? (
            <span className="field-error">{fieldErrors.expira_em}</span>
          ) : null}
        </label>
      </div>

      {draft.escopo === "aluno" ? (
        <div className="form-grid exceptional-release-form-grid">
          <label className="field">
            <span>Buscar aluno</span>
            <input
              className="input"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.currentTarget.value)}
              placeholder="Nome, matrícula, turma ou e-mail"
            />
            <span className="field-help">
              Filtre os alunos do semestre selecionado antes de escolher o aluno liberado.
            </span>
          </label>

          <label className={getFieldClassName("aluno_id")}>
            <span>Aluno</span>
            <select
              className={getInputClassName("aluno_id")}
              name="aluno_id"
              value={draft.aluno_id}
              disabled={!draft.semestre_id}
              onChange={(event) => updateDraft("aluno_id", event.currentTarget.value)}
            >
              <option value="">Selecione</option>
              {filteredStudents.map((student) => (
                <option key={`${student.semesterId}-${student.id}`} value={student.id}>
                  {student.label}
                </option>
              ))}
            </select>
            <span className="field-help">
              {filteredStudents.length
                ? `${filteredStudents.length} aluno(s) compatíveis com o filtro atual.`
                : "Nenhum aluno encontrado para o semestre, turma e busca informados."}
            </span>
            {fieldErrors.aluno_id ? <span className="field-error">{fieldErrors.aluno_id}</span> : null}
          </label>
        </div>
      ) : null}

      <label className={getFieldClassName("motivo")}>
        <span>Motivo obrigatório</span>
        <textarea
          className={`${getInputClassName("motivo")} textarea`}
          name="motivo"
          rows={4}
          value={draft.motivo}
          onChange={(event) => updateDraft("motivo", event.currentTarget.value)}
          placeholder="Explique por que a edição precisa ficar disponível após o encerramento do período."
        />
        <span className="field-help">
          Esse motivo ficará registrado junto da liberação e do histórico auditável da unidade.
        </span>
        {fieldErrors.motivo ? <span className="field-error">{fieldErrors.motivo}</span> : null}
      </label>

      {!semesterOptions.length ? (
        <p className="empty-message">
          Ainda não há semestres encerrados na unidade para receber liberação excepcional.
        </p>
      ) : null}

      {!recipientOptions.length ? (
        <p className="empty-message">
          Não há usuários elegíveis ativos na unidade para receber liberação excepcional.
        </p>
      ) : null}

      <div className="actions-row">
        <button className="button" type="submit" disabled={creationDisabled}>
          Criar liberação excepcional
        </button>
      </div>
    </form>
  );
}
