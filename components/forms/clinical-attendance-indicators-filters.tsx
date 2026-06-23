"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type { ClinicalAttendanceIndicatorsPageData } from "@/services/clinical-indicators";

interface ClinicalAttendanceIndicatorsFiltersProps {
  actionPath: Route;
  clearHref: Route;
  exportHref: Route;
  filters: ClinicalAttendanceIndicatorsPageData["filters"];
  filterOptions: ClinicalAttendanceIndicatorsPageData["filterOptions"];
  visibility: ClinicalAttendanceIndicatorsPageData["visibility"];
}

export function ClinicalAttendanceIndicatorsFilters({
  actionPath,
  clearHref,
  exportHref,
  filters,
  filterOptions,
  visibility
}: ClinicalAttendanceIndicatorsFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [courseId, setCourseId] = useState(filters.courseId);
  const [unitId, setUnitId] = useState(filters.unitId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setCourseId(filters.courseId);
    setUnitId(filters.unitId);
  }, [filters.courseId, filters.institutionId, filters.unitId]);

  const filteredCourses = useMemo(
    () =>
      institutionId
        ? filterOptions.courses.filter((course) => course.institutionId === institutionId)
        : filterOptions.courses,
    [filterOptions.courses, institutionId]
  );

  const filteredUnits = useMemo(() => {
    return filterOptions.units.filter((unit) => {
      if (institutionId && unit.institutionId !== institutionId) {
        return false;
      }

      if (courseId && !unit.courseIds.includes(courseId)) {
        return false;
      }

      return true;
    });
  }, [courseId, filterOptions.units, institutionId]);

  useEffect(() => {
    if (courseId && !filteredCourses.some((course) => course.id === courseId)) {
      setCourseId("");
    }
  }, [courseId, filteredCourses]);

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.id === unitId)) {
      setUnitId("");
    }
  }, [filteredUnits, unitId]);

  return (
    <form method="get" className="clinical-indicators-filter-form">
      <label className="field">
        <span>Data inicial</span>
        <input className="input" type="date" name="dateFrom" defaultValue={filters.dateFrom} />
      </label>

      <label className="field">
        <span>Data final</span>
        <input className="input" type="date" name="dateTo" defaultValue={filters.dateTo} />
      </label>

      {visibility.showInstitutionFilter ? (
        <label className="field">
          <span>Instituição / IES</span>
          <select
            className="input"
            name="institutionId"
            value={institutionId}
            onChange={(event) => setInstitutionId(event.currentTarget.value)}
          >
            <option value="">Todas</option>
            {filterOptions.institutions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showCourseFilter ? (
        <label className="field">
          <span>Curso</span>
          <select
            className="input"
            name="courseId"
            value={courseId}
            onChange={(event) => setCourseId(event.currentTarget.value)}
          >
            <option value="">Todos</option>
            {filteredCourses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showUnitFilter ? (
        <label className="field">
          <span>Unidade</span>
          <select
            className="input"
            name="unitId"
            value={unitId}
            onChange={(event) => setUnitId(event.currentTarget.value)}
          >
            <option value="">Todas</option>
            {filteredUnits.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showAreaFilter ? (
        <label className="field">
          <span>Área de estágio</span>
          <select className="input" name="areaId" defaultValue={filters.areaId}>
            <option value="">Todas</option>
            {filterOptions.areas.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showProfessorFilter ? (
        <label className="field">
          <span>Professor</span>
          <select className="input" name="professorId" defaultValue={filters.professorId}>
            <option value="">Todos</option>
            {filterOptions.professors.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showStudentFilter ? (
        <label className="field">
          <span>Aluno</span>
          <select className="input" name="studentId" defaultValue={filters.studentId}>
            <option value="">Todos</option>
            {filterOptions.students.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} · {option.registration}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {visibility.showStatusFilter ? (
        <label className="field">
          <span>Status da evolução</span>
          <select
            className="input"
            name="statusEvolucao"
            defaultValue={filters.statusEvolucao}
          >
            {filterOptions.statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="actions-row clinical-indicators-filter-actions">
        <button type="submit" className="button button-small">
          Aplicar filtros
        </button>
        <Link href={clearHref} className="button button-secondary button-small">
          Limpar filtros
        </Link>
        <Link href={actionPath} className="button button-secondary button-small">
          Período atual
        </Link>
        <Link href={exportHref} className="button button-secondary button-small">
          Exportar Excel
        </Link>
      </div>
    </form>
  );
}
