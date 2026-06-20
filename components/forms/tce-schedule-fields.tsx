"use client";

import type { TceConfigurationFormValues } from "@/app/(app)/gestao/tces/state";

const scheduleDays = [
  {
    key: "segunda",
    label: "Segunda-feira"
  },
  {
    key: "terca",
    label: "Terça-feira"
  },
  {
    key: "quarta",
    label: "Quarta-feira"
  },
  {
    key: "quinta",
    label: "Quinta-feira"
  },
  {
    key: "sexta",
    label: "Sexta-feira"
  },
  {
    key: "sabado",
    label: "Sábado"
  }
] as const;

type ScheduleFieldName =
  | "horario_segunda_inicio"
  | "horario_segunda_fim"
  | "horario_segunda_intervalo_inicio"
  | "horario_segunda_intervalo_fim"
  | "horario_terca_inicio"
  | "horario_terca_fim"
  | "horario_terca_intervalo_inicio"
  | "horario_terca_intervalo_fim"
  | "horario_quarta_inicio"
  | "horario_quarta_fim"
  | "horario_quarta_intervalo_inicio"
  | "horario_quarta_intervalo_fim"
  | "horario_quinta_inicio"
  | "horario_quinta_fim"
  | "horario_quinta_intervalo_inicio"
  | "horario_quinta_intervalo_fim"
  | "horario_sexta_inicio"
  | "horario_sexta_fim"
  | "horario_sexta_intervalo_inicio"
  | "horario_sexta_intervalo_fim"
  | "horario_sabado_inicio"
  | "horario_sabado_fim"
  | "horario_sabado_intervalo_inicio"
  | "horario_sabado_intervalo_fim";

export function TceScheduleFields({
  draft,
  fieldErrors,
  onChange
}: {
  draft: TceConfigurationFormValues;
  fieldErrors: Record<string, string>;
  onChange: (field: ScheduleFieldName, value: string) => void;
}) {
  function getInputClassName(fieldName: string) {
    return fieldErrors[fieldName] ? "input input-invalid" : "input";
  }

  return (
    <div className="stack">
      {scheduleDays.map((scheduleDay) => {
        const startField = `horario_${scheduleDay.key}_inicio` as ScheduleFieldName;
        const endField = `horario_${scheduleDay.key}_fim` as ScheduleFieldName;
        const breakStartField =
          `horario_${scheduleDay.key}_intervalo_inicio` as ScheduleFieldName;
        const breakEndField =
          `horario_${scheduleDay.key}_intervalo_fim` as ScheduleFieldName;

        return (
          <div key={scheduleDay.key} className="card">
            <div className="card-header">
              <div>
                <h3>{scheduleDay.label}</h3>
                <p>Preencha apenas os horários necessários para este dia.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className={fieldErrors[startField] ? "field field-invalid" : "field"}>
                <span>Horário inicial</span>
                <input
                  className={getInputClassName(startField)}
                  type="time"
                  name={startField}
                  value={draft[startField]}
                  onChange={(event) => onChange(startField, event.currentTarget.value)}
                />
                {fieldErrors[startField] ? (
                  <span className="field-error">{fieldErrors[startField]}</span>
                ) : null}
              </label>

              <label className={fieldErrors[endField] ? "field field-invalid" : "field"}>
                <span>Horário final</span>
                <input
                  className={getInputClassName(endField)}
                  type="time"
                  name={endField}
                  value={draft[endField]}
                  onChange={(event) => onChange(endField, event.currentTarget.value)}
                />
                {fieldErrors[endField] ? (
                  <span className="field-error">{fieldErrors[endField]}</span>
                ) : null}
              </label>

              <label
                className={fieldErrors[breakStartField] ? "field field-invalid" : "field"}
              >
                <span>Início do intervalo</span>
                <input
                  className={getInputClassName(breakStartField)}
                  type="time"
                  name={breakStartField}
                  value={draft[breakStartField]}
                  onChange={(event) =>
                    onChange(breakStartField, event.currentTarget.value)
                  }
                />
                {fieldErrors[breakStartField] ? (
                  <span className="field-error">{fieldErrors[breakStartField]}</span>
                ) : null}
              </label>

              <label
                className={fieldErrors[breakEndField] ? "field field-invalid" : "field"}
              >
                <span>Fim do intervalo</span>
                <input
                  className={getInputClassName(breakEndField)}
                  type="time"
                  name={breakEndField}
                  value={draft[breakEndField]}
                  onChange={(event) => onChange(breakEndField, event.currentTarget.value)}
                />
                {fieldErrors[breakEndField] ? (
                  <span className="field-error">{fieldErrors[breakEndField]}</span>
                ) : null}
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}
