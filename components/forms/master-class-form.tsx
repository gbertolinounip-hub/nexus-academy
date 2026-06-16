"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createMasterClassAction } from "@/app/(app)/master/turmas/actions";
import {
  createEmptyMasterClassFormValues,
  initialClassManagementActionState,
  type MasterClassFormValues
} from "@/app/(app)/master/turmas/state";
import type {
  ClassManagementCourseOption,
  ClassManagementInstitutionOption,
  ClassManagementOfferOption,
  ClassManagementSemesterOption
} from "@/services/class-management";

interface MasterClassFormProps {
  institutions: ClassManagementInstitutionOption[];
  courses: ClassManagementCourseOption[];
  offers: ClassManagementOfferOption[];
  semesters: ClassManagementSemesterOption[];
}

export function MasterClassForm({
  institutions,
  courses,
  offers,
  semesters
}: MasterClassFormProps) {
  const [state, formAction] = useActionState(
    createMasterClassAction,
    initialClassManagementActionState
  );
  const safeState = state ?? initialClassManagementActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<MasterClassFormValues>(() =>
    createEmptyMasterClassFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyMasterClassFormValues());
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

  useEffect(() => {
    if (draft.curso_id && !filteredCourses.some((course) => course.id === draft.curso_id)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        curso_id: "",
        oferta_curso_unidade_id: "",
        semestre_id: ""
      }));
    }

    if (
      draft.oferta_curso_unidade_id &&
      !filteredOffers.some((offer) => offer.id === draft.oferta_curso_unidade_id)
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        oferta_curso_unidade_id: "",
        semestre_id: ""
      }));
    }

    if (
      draft.semestre_id &&
      !filteredSemesters.some((semester) => semester.id === draft.semestre_id)
    ) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        semestre_id: ""
      }));
    }
  }, [
    draft.curso_id,
    draft.oferta_curso_unidade_id,
    draft.semestre_id,
    filteredCourses,
    filteredOffers,
    filteredSemesters
  ]);

  function updateDraft(field: keyof MasterClassFormValues, value: string) {
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

  const selectedSemester =
    filteredSemesters.find((semester) => semester.id === draft.semestre_id) ?? null;

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
          <span>Semestre da oferta</span>
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
          {!fieldErrors.semestre_id && selectedSemester ? (
            <span className="field-help">
              A oferta da turma sera herdada do semestre selecionado.
            </span>
          ) : null}
        </label>

        <label className={getFieldClassName("codigo")}>
          <span>Codigo da turma</span>
          <input
            className={getInputClassName("codigo")}
            name="codigo"
            value={draft.codigo}
            onChange={(event) =>
              updateDraft("codigo", event.currentTarget.value.toUpperCase())
            }
          />
          {fieldErrors.codigo ? <span className="field-error">{fieldErrors.codigo}</span> : null}
        </label>

        <label className={getFieldClassName("periodo_curricular")}>
          <span>Periodo curricular</span>
          <input
            className={getInputClassName("periodo_curricular")}
            name="periodo_curricular"
            inputMode="numeric"
            placeholder="Ex.: 6, 7 ou 8"
            value={draft.periodo_curricular}
            onChange={(event) =>
              updateDraft(
                "periodo_curricular",
                event.currentTarget.value.replace(/[^\d]/g, "")
              )
            }
          />
          <span className="field-help">
            Informe o periodo/semestre curricular do curso, por exemplo: 6, 7 ou 8.
          </span>
          {fieldErrors.periodo_curricular ? (
            <span className="field-error">{fieldErrors.periodo_curricular}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("nome")}>
          <span>Nome da turma</span>
          <input
            className={getInputClassName("nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName("area_estagio")}>
          <span>Area / descricao operacional</span>
          <input
            className={getInputClassName("area_estagio")}
            name="area_estagio"
            placeholder="Ex.: Enfermagem Hospitalar"
            value={draft.area_estagio}
            onChange={(event) => updateDraft("area_estagio", event.currentTarget.value)}
          />
          {fieldErrors.area_estagio ? (
            <span className="field-error">{fieldErrors.area_estagio}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("capacidade")}>
          <span>Capacidade</span>
          <input
            className={getInputClassName("capacidade")}
            name="capacidade"
            inputMode="numeric"
            value={draft.capacidade}
            onChange={(event) =>
              updateDraft("capacidade", event.currentTarget.value.replace(/[^\d]/g, ""))
            }
          />
          {fieldErrors.capacidade ? (
            <span className="field-error">{fieldErrors.capacidade}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("ativa")}>
          <span>Status inicial</span>
          <select
            className={getInputClassName("ativa")}
            name="ativa"
            value={draft.ativa}
            onChange={(event) =>
              updateDraft("ativa", event.currentTarget.value as MasterClassFormValues["ativa"])
            }
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativa ? <span className="field-error">{fieldErrors.ativa}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Criar turma
        </button>
      </div>
    </form>
  );
}
