"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatClinicalWeekday, formatMaskedFirstName } from "@/lib/utils/format";
import type { ClinicalCaseSummary, ClinicalWeekday } from "@/types/domain";

interface ClinicalScheduleBoardProps {
  cases: ClinicalCaseSummary[];
  enableProfessorFilters?: boolean;
  maskPatientNames?: boolean;
}

const clinicalWeekdays: ClinicalWeekday[] = [
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado"
];

function isSchedulableClinicalCase(caseItem: ClinicalCaseSummary) {
  return (
    caseItem.active &&
    caseItem.status !== "alta" &&
    caseItem.status !== "encerrado"
  );
}

function sortTimeSlots(timeSlots: string[]) {
  return [...timeSlots].sort((left, right) => left.localeCompare(right, "pt-BR"));
}

export function ClinicalScheduleBoard({
  cases,
  enableProfessorFilters = false,
  maskPatientNames = false
}: ClinicalScheduleBoardProps) {
  const [selectedStudentId, setSelectedStudentId] = useState("todos");
  const [selectedWeekday, setSelectedWeekday] = useState<"todos" | ClinicalWeekday>(
    "todos"
  );
  const schedulableCases = cases.filter(isSchedulableClinicalCase);

  const studentOptions = Array.from(
    new Map(
      schedulableCases.map((caseItem) => [
        caseItem.studentId,
        { id: caseItem.studentId, name: caseItem.studentName }
      ])
    ).values()
  ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const filteredCases = schedulableCases.filter((caseItem) => {
    const matchesStudent =
      selectedStudentId === "todos" || caseItem.studentId === selectedStudentId;
    const matchesWeekday =
      selectedWeekday === "todos" ||
      caseItem.schedules.some((schedule) => schedule.weekday === selectedWeekday);

    return matchesStudent && matchesWeekday;
  });

  const visibleWeekdays =
    selectedWeekday === "todos" ? clinicalWeekdays : [selectedWeekday];

  const timeSlots = sortTimeSlots(
    [
      ...new Set(
        filteredCases.flatMap((caseItem) =>
          caseItem.schedules
            .filter((schedule) =>
              selectedWeekday === "todos" ? true : schedule.weekday === selectedWeekday
            )
            .map((schedule) => schedule.appointmentTime)
        )
      )
    ]
  );

  const appointmentsBySlot = new Map<
    string,
    Array<{ caseId: string; patientName: string }>
  >();

  for (const caseItem of filteredCases) {
    for (const schedule of caseItem.schedules) {
      if (selectedWeekday !== "todos" && schedule.weekday !== selectedWeekday) {
        continue;
      }

      const slotKey = `${schedule.weekday}:${schedule.appointmentTime}`;
      const currentSlotAppointments = appointmentsBySlot.get(slotKey) ?? [];
      currentSlotAppointments.push({
        caseId: caseItem.id,
        patientName: maskPatientNames
          ? formatMaskedFirstName(caseItem.patient.name)
          : caseItem.patient.name
      });
      appointmentsBySlot.set(slotKey, currentSlotAppointments);
    }
  }

  const hasActiveFilters =
    selectedStudentId !== "todos" || selectedWeekday !== "todos";

  if (!timeSlots.length) {
    return (
      <div className="clinical-schedule-board-panel">
        {enableProfessorFilters ? (
          <div
            className="clinical-schedule-board-filters"
            role="group"
            aria-label="Filtros da agenda"
          >
            <label className="field">
              <span>Aluno</span>
              <select
                className="input"
                value={selectedStudentId}
                onChange={(event) => setSelectedStudentId(event.target.value)}
              >
                <option value="todos">Todos</option>
                {studentOptions.map((studentOption) => (
                  <option key={studentOption.id} value={studentOption.id}>
                    {studentOption.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Dia</span>
              <select
                className="input"
                value={selectedWeekday}
                onChange={(event) =>
                  setSelectedWeekday(event.target.value as "todos" | ClinicalWeekday)
                }
              >
                <option value="todos">Todos</option>
                {clinicalWeekdays.map((weekday) => (
                  <option key={weekday} value={weekday}>
                    {formatClinicalWeekday(weekday)}
                  </option>
                ))}
              </select>
            </label>

            <div className="clinical-schedule-board-filter-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => {
                  setSelectedStudentId("todos");
                  setSelectedWeekday("todos");
                }}
                disabled={!hasActiveFilters}
              >
                Limpar filtros
              </button>
            </div>
          </div>
        ) : null}

        <p className="empty-message">
          {hasActiveFilters
            ? "Nenhum paciente agendado foi encontrado para os filtros selecionados."
            : "Ainda não há atendimentos semanais fixos configurados para montar a agenda."}
        </p>
      </div>
    );
  }

  return (
    <div className="clinical-schedule-board-panel">
      {enableProfessorFilters ? (
        <div
          className="clinical-schedule-board-filters"
          role="group"
          aria-label="Filtros da agenda"
        >
          <label className="field">
            <span>Aluno</span>
            <select
              className="input"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
            >
              <option value="todos">Todos</option>
              {studentOptions.map((studentOption) => (
                <option key={studentOption.id} value={studentOption.id}>
                  {studentOption.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Dia</span>
            <select
              className="input"
              value={selectedWeekday}
              onChange={(event) =>
                setSelectedWeekday(event.target.value as "todos" | ClinicalWeekday)
              }
            >
              <option value="todos">Todos</option>
              {clinicalWeekdays.map((weekday) => (
                <option key={weekday} value={weekday}>
                  {formatClinicalWeekday(weekday)}
                </option>
              ))}
            </select>
          </label>

          <div className="clinical-schedule-board-filter-actions">
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={() => {
                setSelectedStudentId("todos");
                setSelectedWeekday("todos");
              }}
              disabled={!hasActiveFilters}
            >
              Limpar filtros
            </button>
          </div>
        </div>
      ) : null}

      <div className="table-wrap clinical-schedule-board-wrap">
        <table className="table clinical-schedule-board">
          <thead>
            <tr>
              <th>Horário</th>
              {visibleWeekdays.map((weekday) => (
                <th key={weekday}>{formatClinicalWeekday(weekday)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeSlots.map((timeSlot) => (
              <tr key={timeSlot}>
                <th className="clinical-schedule-board-time-cell" scope="row">
                  {timeSlot}
                </th>
                {visibleWeekdays.map((weekday) => {
                  const slotKey = `${weekday}:${timeSlot}`;
                  const slotAppointments = appointmentsBySlot.get(slotKey) ?? [];

                  return (
                    <td key={slotKey} className="clinical-schedule-board-slot-cell">
                      {slotAppointments.length ? (
                        <div className="clinical-schedule-board-slot-list">
                          {slotAppointments.map((appointment) => (
                            <div
                              key={`${appointment.caseId}:${slotKey}`}
                              className="clinical-schedule-board-entry"
                            >
                              <strong>{appointment.patientName}</strong>
                              <Link
                                href={`/clinica-supervisionada/${appointment.caseId}` as Route}
                                className="button button-secondary button-small clinical-schedule-board-link"
                              >
                                Abrir caso
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="clinical-schedule-board-empty">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
