"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type { ClinicalInstitutionalDashboardPageData } from "@/services/clinical-supervision";

interface ClinicalInstitutionalDashboardFiltersProps {
  actionPath: Route;
  printHref: Route;
  filters: ClinicalInstitutionalDashboardPageData["filters"];
  filterOptions: ClinicalInstitutionalDashboardPageData["filterOptions"];
  showInstitutionFilter: boolean;
  showSearchFilter: boolean;
  showUnitFilter: boolean;
}

export function ClinicalInstitutionalDashboardFilters({
  actionPath,
  printHref,
  filters,
  filterOptions,
  showInstitutionFilter,
  showSearchFilter,
  showUnitFilter
}: ClinicalInstitutionalDashboardFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
  }, [filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () =>
      institutionId
        ? filterOptions.units.filter((unit) => unit.institutionId === institutionId)
        : filterOptions.units,
    [filterOptions.units, institutionId]
  );

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.id === unitId)) {
      setUnitId("");
    }
  }, [filteredUnits, unitId]);

  return (
    <form method="get" className="clinical-institutional-filter-form">
      {showSearchFilter ? (
        <label className="field">
          <span>Busca</span>
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={filters.query}
            placeholder="Paciente ou identificador"
          />
        </label>
      ) : null}

      {showInstitutionFilter ? (
        <label className="field">
          <span>Instituição / IES</span>
          <select
            className="input"
            name="institution_id"
            value={institutionId}
            onChange={(event) => setInstitutionId(event.currentTarget.value)}
          >
            <option value="">Todas as instituições</option>
            {filterOptions.institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {showUnitFilter ? (
        <label className="field">
          <span>Unidade</span>
          <select
            className="input"
            name="unit_id"
            value={unitId}
            onChange={(event) => setUnitId(event.currentTarget.value)}
          >
            <option value="">Todas</option>
            {filteredUnits.map((unitOption) => (
              <option key={unitOption.id} value={unitOption.id}>
                {unitOption.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="field">
        <span>Semestre</span>
        <select className="input" name="semester_id" defaultValue={filters.semesterId}>
          <option value="">Todos</option>
          {filterOptions.semesters.map((semesterOption) => (
            <option key={semesterOption.id} value={semesterOption.id}>
              {semesterOption.code}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Área</span>
        <select className="input" name="area_id" defaultValue={filters.areaId}>
          <option value="">Todas</option>
          {filterOptions.areas.map((areaOption) => (
            <option key={areaOption.id} value={areaOption.id}>
              {areaOption.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Professor</span>
        <select className="input" name="professor_id" defaultValue={filters.professorId}>
          <option value="">Todos</option>
          {filterOptions.professors.map((professorOption) => (
            <option key={professorOption.id} value={professorOption.id}>
              {professorOption.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Aluno</span>
        <select className="input" name="student_id" defaultValue={filters.studentId}>
          <option value="">Todos</option>
          {filterOptions.students.map((studentOption) => (
            <option key={studentOption.id} value={studentOption.id}>
              {studentOption.name} · {studentOption.registration}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Status do caso</span>
        <select className="input" name="status" defaultValue={filters.status}>
          <option value="todos">Todos</option>
          <option value="atribuido">Atribuído</option>
          <option value="ativo">Ativo</option>
          <option value="alta">Alta</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </label>

      <div className="actions-row clinical-institutional-filter-actions">
        <button type="submit" className="button button-small">
          Aplicar filtros
        </button>
        <Link href={actionPath} className="button button-secondary button-small">
          Limpar
        </Link>
        <Link
          href={printHref}
          className="button button-secondary button-small"
          target="_blank"
          rel="noreferrer"
        >
          Imprimir
        </Link>
      </div>
    </form>
  );
}
