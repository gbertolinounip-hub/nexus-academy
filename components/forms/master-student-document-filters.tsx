"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type { StudentDocumentDirectoryPageData } from "@/services/student-documents";

interface MasterStudentDocumentFiltersProps {
  basePath: Route;
  filters: StudentDocumentDirectoryPageData["filters"];
  institutionOptions: StudentDocumentDirectoryPageData["institutionOptions"];
  unitOptions: StudentDocumentDirectoryPageData["unitOptions"];
  areaOptions: StudentDocumentDirectoryPageData["areaOptions"];
  statusOptions: StudentDocumentDirectoryPageData["statusOptions"];
}

export function MasterStudentDocumentFilters({
  basePath,
  filters,
  institutionOptions,
  unitOptions,
  areaOptions,
  statusOptions
}: MasterStudentDocumentFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
  }, [filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () =>
      institutionId
        ? unitOptions.filter((unit) => unit.institutionId === institutionId)
        : unitOptions,
    [institutionId, unitOptions]
  );

  useEffect(() => {
    if (unitId && !filteredUnits.some((unit) => unit.value === unitId)) {
      setUnitId("");
    }
  }, [filteredUnits, unitId]);

  return (
    <form method="get" className="student-document-filter-form">
      <label className="field">
        <span>Busca</span>
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={filters.search}
          placeholder="Nome, matrícula ou e-mail"
        />
      </label>

      <label className="field">
        <span>Instituição / IES</span>
        <select
          className="input"
          name="institution_id"
          value={institutionId}
          onChange={(event) => setInstitutionId(event.currentTarget.value)}
        >
          <option value="">Todas as instituições</option>
          {institutionOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Unidade</span>
        <select
          className="input"
          name="unit_id"
          value={unitId}
          onChange={(event) => setUnitId(event.currentTarget.value)}
        >
          <option value="">Todas</option>
          {filteredUnits.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Área</span>
        <select className="input" name="area_id" defaultValue={filters.areaId}>
          <option value="">Todas</option>
          {areaOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Status</span>
        <select className="input" name="status" defaultValue={filters.status}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="actions-row student-document-filter-actions">
        <button type="submit" className="button button-small">
          Aplicar filtros
        </button>
        <Link href={basePath} className="button button-secondary button-small">
          Limpar
        </Link>
      </div>
    </form>
  );
}
