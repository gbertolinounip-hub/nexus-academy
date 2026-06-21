"use client";

import type {
  StudentTceActionState,
  StudentTceFormValues
} from "@/app/(app)/tce/state";
import type { StudentTceAvailableEntry } from "@/services/tce";

interface StudentTceFormProps {
  entry: StudentTceAvailableEntry;
  draft: StudentTceFormValues;
  state: StudentTceActionState;
  formAction: (formData: FormData) => void;
  onChange: (field: keyof StudentTceFormValues, value: string) => void;
  savePending?: boolean;
}

export function StudentTceForm({
  entry,
  draft,
  state,
  formAction,
  onChange,
  savePending = false
}: StudentTceFormProps) {
  const fieldErrors = state.fieldErrors ?? {};

  function getFieldClassName(fieldName: keyof StudentTceFormValues) {
    return fieldErrors[fieldName] ? "field field-invalid" : "field";
  }

  function getInputClassName(fieldName: keyof StudentTceFormValues) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  return (
    <form action={formAction} className="form-stack">
      <input type="hidden" name="configuration_id" value={draft.configuration_id} />
      <input type="hidden" name="enrollment_id" value={draft.enrollment_id} />
      <input type="hidden" name="area_estagio_id" value={draft.area_estagio_id} />

      {state.message ? (
        <div
          className={
            state.status === "success"
              ? "form-notice form-notice-success"
              : "form-notice form-notice-error"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <div>
            <h3>Dados do estagiário</h3>
            <p>
              Revise os campos abaixo. Sempre que possível, o sistema já
              pré-preenche os dados básicos do seu cadastro acadêmico.
            </p>
          </div>
        </div>

        <div className="management-tag-list">
          <span className="badge badge-muted">TCE: {entry.label}</span>
          <span className="badge badge-muted">Área: {entry.areaName}</span>
          <span className="badge badge-muted">Semestre: {entry.semesterCode}</span>
        </div>
      </div>

      <div className="form-grid">
        <label className={getFieldClassName("full_name")}>
          <span>Nome</span>
          <input
            className={getInputClassName("full_name")}
            name="full_name"
            value={draft.full_name}
            onChange={(event) => onChange("full_name", event.currentTarget.value)}
          />
          {fieldErrors.full_name ? (
            <span className="field-error">{fieldErrors.full_name}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("registration")}>
          <span>RA</span>
          <input
            className={getInputClassName("registration")}
            name="registration"
            value={draft.registration}
            onChange={(event) => onChange("registration", event.currentTarget.value)}
          />
          {fieldErrors.registration ? (
            <span className="field-error">{fieldErrors.registration}</span>
          ) : null}
        </label>

        <label className={getFieldClassName("campus")}>
          <span>Campus/Polo</span>
          <input
            className={getInputClassName("campus")}
            name="campus"
            value={draft.campus}
            onChange={(event) => onChange("campus", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("course_name")}>
          <span>Curso</span>
          <input
            className={getInputClassName("course_name")}
            name="course_name"
            value={draft.course_name}
            onChange={(event) => onChange("course_name", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("semester_label")}>
          <span>Semestre</span>
          <input
            className={getInputClassName("semester_label")}
            name="semester_label"
            value={draft.semester_label}
            onChange={(event) => onChange("semester_label", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("shift")}>
          <span>Turno</span>
          <input
            className={getInputClassName("shift")}
            name="shift"
            value={draft.shift}
            onChange={(event) => onChange("shift", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("address")}>
          <span>Endereço</span>
          <input
            className={getInputClassName("address")}
            name="address"
            value={draft.address}
            onChange={(event) => onChange("address", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("address_number")}>
          <span>Número</span>
          <input
            className={getInputClassName("address_number")}
            name="address_number"
            value={draft.address_number}
            onChange={(event) =>
              onChange("address_number", event.currentTarget.value)
            }
          />
        </label>

        <label className={getFieldClassName("address_complement")}>
          <span>Complemento</span>
          <input
            className={getInputClassName("address_complement")}
            name="address_complement"
            value={draft.address_complement}
            onChange={(event) =>
              onChange("address_complement", event.currentTarget.value)
            }
          />
        </label>

        <label className={getFieldClassName("neighborhood")}>
          <span>Bairro</span>
          <input
            className={getInputClassName("neighborhood")}
            name="neighborhood"
            value={draft.neighborhood}
            onChange={(event) => onChange("neighborhood", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("city")}>
          <span>Município</span>
          <input
            className={getInputClassName("city")}
            name="city"
            value={draft.city}
            onChange={(event) => onChange("city", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("state")}>
          <span>UF</span>
          <input
            className={getInputClassName("state")}
            name="state"
            maxLength={2}
            value={draft.state}
            onChange={(event) => onChange("state", event.currentTarget.value.toUpperCase())}
          />
          {fieldErrors.state ? <span className="field-error">{fieldErrors.state}</span> : null}
        </label>

        <label className={getFieldClassName("postal_code")}>
          <span>CEP</span>
          <input
            className={getInputClassName("postal_code")}
            name="postal_code"
            value={draft.postal_code}
            onChange={(event) => onChange("postal_code", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("phone")}>
          <span>Telefone</span>
          <input
            className={getInputClassName("phone")}
            name="phone"
            value={draft.phone}
            onChange={(event) => onChange("phone", event.currentTarget.value)}
          />
        </label>

        <label className={getFieldClassName("email")}>
          <span>E-mail</span>
          <input
            className={getInputClassName("email")}
            name="email"
            type="email"
            value={draft.email}
            onChange={(event) => onChange("email", event.currentTarget.value)}
          />
          {fieldErrors.email ? <span className="field-error">{fieldErrors.email}</span> : null}
        </label>
      </div>

      <p className="field-help">
        Salve os dados do estagiário antes de gerar a versão final do TCE em Word.
      </p>

      <div className="actions-row">
        <button className="button" type="submit" disabled={savePending}>
          {savePending ? "Salvando..." : "Salvar dados"}
        </button>
      </div>
    </form>
  );
}
