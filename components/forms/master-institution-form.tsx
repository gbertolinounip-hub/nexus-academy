"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createInstitutionAction,
  updateInstitutionAction
} from "@/app/(app)/master/instituicoes/actions";
import {
  createEmptyInstitutionFormValues,
  initialInstitutionCreateActionState,
  initialInstitutionEditActionState,
  type InstitutionEditFormValues,
  type InstitutionFormValues
} from "@/app/(app)/master/instituicoes/state";
import type { InstitutionManagementEntry } from "@/services/institution-management";

function getFieldClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "field field-invalid" : "field";
}

function getInputClassName(fieldErrors: Record<string, string>, fieldName: string) {
  return fieldErrors[fieldName] ? "input input-invalid" : "input";
}

function buildEditDraft(institution: InstitutionManagementEntry): InstitutionEditFormValues {
  return {
    institution_id: institution.id,
    nome: institution.name,
    sigla: institution.acronym ?? "",
    slug: institution.slug,
    cnpj: institution.cnpj ?? "",
    ativo: institution.isActive ? "true" : "false"
  };
}

export function MasterInstitutionCreateForm() {
  const [state, formAction] = useActionState(
    createInstitutionAction,
    initialInstitutionCreateActionState
  );
  const safeState = state ?? initialInstitutionCreateActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<InstitutionFormValues>(() =>
    createEmptyInstitutionFormValues()
  );

  useEffect(() => {
    if (safeState.status === "error" && safeState.formValues) {
      setDraft({ ...safeState.formValues });
      return;
    }

    if (safeState.status === "success") {
      setDraft(createEmptyInstitutionFormValues());
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof InstitutionFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

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
        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "sigla")}>
          <span>Sigla</span>
          <input
            className={getInputClassName(fieldErrors, "sigla")}
            name="sigla"
            value={draft.sigla}
            onChange={(event) => updateDraft("sigla", event.currentTarget.value.toUpperCase())}
          />
          {fieldErrors.sigla ? <span className="field-error">{fieldErrors.sigla}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "slug")}>
          <span>Slug</span>
          <input
            className={getInputClassName(fieldErrors, "slug")}
            name="slug"
            value={draft.slug}
            onChange={(event) =>
              updateDraft("slug", event.currentTarget.value.toLowerCase().replace(/\s+/g, "-"))
            }
          />
          {fieldErrors.slug ? <span className="field-error">{fieldErrors.slug}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "cnpj")}>
          <span>CNPJ</span>
          <input
            className={getInputClassName(fieldErrors, "cnpj")}
            name="cnpj"
            value={draft.cnpj}
            onChange={(event) =>
              updateDraft("cnpj", event.currentTarget.value.replace(/\D+/g, ""))
            }
          />
          {fieldErrors.cnpj ? <span className="field-error">{fieldErrors.cnpj}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button" type="submit">
          Cadastrar instituição
        </button>
      </div>
    </form>
  );
}

export function MasterInstitutionEditForm({
  institution
}: {
  institution: InstitutionManagementEntry;
}) {
  const [state, formAction] = useActionState(
    updateInstitutionAction,
    initialInstitutionEditActionState
  );
  const safeState = state ?? initialInstitutionEditActionState;
  const fieldErrors = safeState.fieldErrors ?? {};
  const [draft, setDraft] = useState<InstitutionEditFormValues>(() => buildEditDraft(institution));

  useEffect(() => {
    setDraft(buildEditDraft(institution));
  }, [institution]);

  useEffect(() => {
    if (safeState.formValues) {
      setDraft({ ...safeState.formValues });
    }
  }, [safeState.formValues, safeState.status, safeState.submittedAt]);

  function updateDraft(field: keyof InstitutionEditFormValues, value: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: value
    }));
  }

  return (
    <form action={formAction} className="form-stack master-institution-edit-form">
      <input type="hidden" name="institution_id" value={draft.institution_id} />

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
        <label className={getFieldClassName(fieldErrors, "nome")}>
          <span>Nome</span>
          <input
            className={getInputClassName(fieldErrors, "nome")}
            name="nome"
            value={draft.nome}
            onChange={(event) => updateDraft("nome", event.currentTarget.value)}
          />
          {fieldErrors.nome ? <span className="field-error">{fieldErrors.nome}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "sigla")}>
          <span>Sigla</span>
          <input
            className={getInputClassName(fieldErrors, "sigla")}
            name="sigla"
            value={draft.sigla}
            onChange={(event) => updateDraft("sigla", event.currentTarget.value.toUpperCase())}
          />
          {fieldErrors.sigla ? <span className="field-error">{fieldErrors.sigla}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "slug")}>
          <span>Slug</span>
          <input
            className={getInputClassName(fieldErrors, "slug")}
            name="slug"
            value={draft.slug}
            onChange={(event) =>
              updateDraft("slug", event.currentTarget.value.toLowerCase().replace(/\s+/g, "-"))
            }
          />
          {fieldErrors.slug ? <span className="field-error">{fieldErrors.slug}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "cnpj")}>
          <span>CNPJ</span>
          <input
            className={getInputClassName(fieldErrors, "cnpj")}
            name="cnpj"
            value={draft.cnpj}
            onChange={(event) =>
              updateDraft("cnpj", event.currentTarget.value.replace(/\D+/g, ""))
            }
          />
          {fieldErrors.cnpj ? <span className="field-error">{fieldErrors.cnpj}</span> : null}
        </label>

        <label className={getFieldClassName(fieldErrors, "ativo")}>
          <span>Status</span>
          <select
            className={getInputClassName(fieldErrors, "ativo")}
            name="ativo"
            value={draft.ativo}
            onChange={(event) => updateDraft("ativo", event.currentTarget.value)}
          >
            <option value="true">Ativa</option>
            <option value="false">Inativa</option>
          </select>
          {fieldErrors.ativo ? <span className="field-error">{fieldErrors.ativo}</span> : null}
        </label>
      </div>

      <div className="actions-row">
        <button className="button button-secondary" type="submit">
          Salvar instituição
        </button>
      </div>
    </form>
  );
}
