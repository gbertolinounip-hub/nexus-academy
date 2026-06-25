"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  MasterCourseOption,
  MasterGlobalAuditPageData,
  MasterInstitutionOption,
  MasterUnitOption
} from "@/services/master";

interface MasterAuditFiltersProps {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  courses: MasterCourseOption[];
  filters: MasterGlobalAuditPageData["filters"];
  exportHref: string;
}

export function MasterAuditFilters({
  institutions,
  units,
  courses,
  filters,
  exportHref
}: MasterAuditFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);
  const [courseId, setCourseId] = useState(filters.courseId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
    setCourseId(filters.courseId);
  }, [filters.courseId, filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () =>
      institutionId
        ? units.filter((unit) => unit.institutionId === institutionId)
        : units,
    [institutionId, units]
  );

  const effectiveUnitId = filteredUnits.some((unit) => unit.id === unitId) ? unitId : "";

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (institutionId && course.institutionId !== institutionId) {
          return false;
        }

        if (!effectiveUnitId) {
          return true;
        }

        return course.unitIds.includes(effectiveUnitId);
      }),
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
    <form
      method="get"
      className="master-filter-form master-filter-form-wide master-audit-filter-form"
    >
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
              {course.code ? `${course.code} - ${course.name}` : course.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Perfil</span>
        <select className="input" name="perfil" defaultValue={filters.role}>
          <option value="todos">Todos</option>
          <option value="coordenador">Coordenadores</option>
          <option value="professor">Professores</option>
          <option value="aluno">Alunos</option>
        </select>
      </label>

      <label className="field">
        <span>Período</span>
        <select className="input" name="periodo" defaultValue={filters.period}>
          <option value="all">Todo o histórico recente</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="365">Últimos 365 dias</option>
        </select>
      </label>

      <div className="actions-row master-filter-actions master-audit-filter-actions">
        <button className="button button-secondary" type="submit">
          Aplicar filtros
        </button>
        <Link href="/master/auditoria" className="button button-secondary">
          Limpar
        </Link>
        <a href={exportHref} className="button button-secondary">
          Exportar Excel
        </a>
      </div>
    </form>
  );
}
