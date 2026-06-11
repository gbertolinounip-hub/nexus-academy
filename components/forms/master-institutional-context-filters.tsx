"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type {
  InstitutionalContextCourseOption,
  InstitutionalContextInstitutionOption,
  InstitutionalContextProfileOption,
  InstitutionalContextUnitOption,
  InstitutionalContextsFilters
} from "@/services/institutional-contexts";

interface MasterInstitutionalStructureFiltersProps {
  institutions: InstitutionalContextInstitutionOption[];
  units: InstitutionalContextUnitOption[];
  filters: InstitutionalContextsFilters;
}

interface MasterInstitutionalUserContextFiltersProps {
  institutions: InstitutionalContextInstitutionOption[];
  units: InstitutionalContextUnitOption[];
  courses: InstitutionalContextCourseOption[];
  contextProfiles: InstitutionalContextProfileOption[];
  filters: InstitutionalContextsFilters;
}

function getUnitsForInstitution(
  units: InstitutionalContextUnitOption[],
  institutionId: string
) {
  if (!institutionId) {
    return units;
  }

  return units.filter((unit) => unit.institutionId === institutionId);
}

function getCoursesForScope(
  courses: InstitutionalContextCourseOption[],
  institutionId: string,
  unitId: string
) {
  return courses.filter((course) => {
    if (institutionId && course.institutionId !== institutionId) {
      return false;
    }

    if (unitId && !course.unitIds.includes(unitId)) {
      return false;
    }

    return true;
  });
}

export function MasterInstitutionalStructureFilters({
  institutions,
  units,
  filters
}: MasterInstitutionalStructureFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
  }, [filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () => getUnitsForInstitution(units, institutionId),
    [institutionId, units]
  );

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.id === unitId)) {
      setUnitId("");
    }
  }, [filteredUnits, unitId]);

  return (
    <form method="get" className="master-filter-form master-filter-form-wide">
      <label className="field">
        <span>Instituição / IES</span>
        <select
          className="input"
          name="instituicao"
          value={institutionId}
          onChange={(event) => setInstitutionId(event.currentTarget.value)}
        >
          <option value="">Todas as instituições</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Unidade</span>
        <select
          className="input"
          name="unidade"
          value={unitId}
          onChange={(event) => setUnitId(event.currentTarget.value)}
        >
          <option value="">Todas as unidades</option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="curso" value={filters.courseId} />
      <input type="hidden" name="perfil_contexto" value={filters.contextProfile} />

      <div className="actions-row master-filter-actions">
        <button className="button button-secondary" type="submit">
          Aplicar filtros
        </button>
        <Link href={"/master/contextos" as Route} className="button button-secondary">
          Limpar
        </Link>
      </div>
    </form>
  );
}

export function MasterInstitutionalUserContextFilters({
  institutions,
  units,
  courses,
  contextProfiles,
  filters
}: MasterInstitutionalUserContextFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);
  const [courseId, setCourseId] = useState(filters.courseId);
  const [contextProfile, setContextProfile] = useState(filters.contextProfile);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
    setCourseId(filters.courseId);
    setContextProfile(filters.contextProfile);
  }, [filters.contextProfile, filters.courseId, filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () => getUnitsForInstitution(units, institutionId),
    [institutionId, units]
  );
  const effectiveUnitId = filteredUnits.some((unit) => unit.id === unitId) ? unitId : "";
  const filteredCourses = useMemo(
    () => getCoursesForScope(courses, institutionId, effectiveUnitId),
    [courses, effectiveUnitId, institutionId]
  );

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.id === unitId)) {
      setUnitId("");
    }
  }, [filteredUnits, unitId]);

  useEffect(() => {
    if (courseId && !filteredCourses.some((course) => course.id === courseId)) {
      setCourseId("");
    }
  }, [courseId, filteredCourses]);

  return (
    <form method="get" className="master-filter-form master-filter-form-wide">
      <label className="field">
        <span>Instituição / IES</span>
        <select
          className="input"
          name="instituicao"
          value={institutionId}
          onChange={(event) => setInstitutionId(event.currentTarget.value)}
        >
          <option value="">Todas as instituições</option>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Unidade</span>
        <select
          className="input"
          name="unidade"
          value={unitId}
          onChange={(event) => setUnitId(event.currentTarget.value)}
        >
          <option value="">Todas as unidades</option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Curso</span>
        <select
          className="input"
          name="curso"
          value={courseId}
          onChange={(event) => setCourseId(event.currentTarget.value)}
        >
          <option value="">Todos os cursos</option>
          {filteredCourses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Perfil de contexto</span>
        <select
          className="input"
          name="perfil_contexto"
          value={contextProfile}
          onChange={(event) => setContextProfile(event.currentTarget.value)}
        >
          <option value="">Todos os perfis</option>
          {contextProfiles.map((profile) => (
            <option key={profile.code} value={profile.code}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>

      <div className="actions-row master-filter-actions">
        <button className="button button-secondary" type="submit">
          Aplicar filtros
        </button>
        <Link href={"/master/contextos" as Route} className="button button-secondary">
          Limpar
        </Link>
      </div>
    </form>
  );
}
