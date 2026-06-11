"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createMasterSemesterAction } from "@/app/(app)/master/semestres/actions";
import {
  createEmptyMasterSemesterFormValues,
  initialSemesterManagementActionState,
  type MasterSemesterFormValues
} from "@/app/(app)/master/semestres/state";
import type {
  SemesterManagementCourseOption,
  SemesterManagementInstitutionOption,
  SemesterManagementOfferOption
} from "@/services/semester-management";

interface MasterSemesterFormProps {
  institutions: SemesterManagementInstitutionOption[];
  courses: SemesterManagementCourseOption[];
  offers: SemesterManagementOfferOption[];
}

export function MasterSemesterForm({
  institutions,
  courses,
  offers
}: MasterSemesterFormProps) {
  const [state, formAction] = useActionState(
    createMasterSemesterAction,
    initialSemesterManagementActionState
  );
  const safeState = state ?? initialSemesterManagementActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<MasterSemesterFormValues>(() =>
    createEmptyMasterSemesterFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyMasterSemesterFormValues());
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

  useEffect(() => {
    if (draft.curso_id && !filteredCourses.some((course) => course.id === draft.curso_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        curso_id: "",
        oferta_curso_unidade_id: ""
      }));
    }

    if (
      draft.oferta_curso_unidade_id &&
      !filteredOffers.some((offer) => offer.id === draft.oferta_curso_unidade_id)
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        oferta_curso_unidade_id: ""
      }));
    }
  }, [draft.curso_id, draft.oferta_curso_unidade_id, filteredCourses, filteredOffers]);

  function updateDraft(field: keyof MasterSemesterFormValues, value: string) {
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

  const selectedOffer =
    filteredOffers.find((offer) => offer.id === draft.oferta_curso_unidade_id) ?? null;

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
          {!fieldErrors.oferta_curso_unidade_id && selectedOffer ? (
            <span className="field-help">
              O sistema preenchera a unidade legada automaticamente a partir desta oferta.
            </span>
          ) : null}
        </label>

        <label className={getFieldClassName("codigo")}>
          <span>Codigo</span>
          <input
            className={getInputClassName("codigo")}
            name="codigo"
            placeholder="2027/1"
            value={draft.codigo}
            onChange={(event) => updateDraft("codigo", event.currentTarget.value)}
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName("nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            placeholder="1o Semestre de 2027"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName("data_inicio")}>
          <span>Data de inicio</span>
          <input
            className={getInputClassName("data_inicio")}
            type="date"
            name="data_inicio"
            value={draft.data_inicio}
            onChange={(event) => updateDraft("data_inicio", event.currentTarget.value)}
          />
          {fieldErrors.data_inicio ? (
            <span className="field-error">{fieldErrors.data_inicio}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("data_fim")}>
          <span>Data de fim</span>
          <input
            className={getInputClassName("data_fim")}
            type="date"
            name="data_fim"
            value={draft.data_fim}
            onChange={(event) => updateDraft("data_fim", event.currentTarget.value)}
          />
          {fieldErrors.data_fim ? <span className="field-error">{fieldErrors.data_fim}</span> : null}
        </label>

        <label className={getFieldClassName("status")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("status")}
            name="status"
            value={draft.status}
            onChange={(event) =>
              updateDraft(
                "status",
                event.currentTarget.value as MasterSemesterFormValues["status"]
              )
            }
          >
            <option value="planejado">Planejado</option>
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
          </select>
          {fieldErrors.status ? <span className="field-error">{fieldErrors.status}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Criar semestre
        </button>
      </div>
    </form>
  );
}
