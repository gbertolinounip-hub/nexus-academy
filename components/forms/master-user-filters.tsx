"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type {
  MasterInstitutionOption,
  MasterUsersPageData,
  MasterUnitOption
} from "@/services/master";

interface MasterUserFiltersProps {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  filters: MasterUsersPageData["filters"];
}

export function MasterUserFilters({
  institutions,
  units,
  filters
}: MasterUserFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
  }, [filters.institutionId, filters.unitId]);

  const filteredUnits = useMemo(
    () =>
      institutionId
        ? units.filter((unit) => unit.institutionId === institutionId)
        : units,
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
        <span>Status</span>
        <select className="input" name="status" defaultValue={filters.status}>
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </label>

      <div className="actions-row master-filter-actions">
        <button className="button button-secondary" type="submit">
          Aplicar filtros
        </button>
        <Link href={"/master/usuarios" as Route} className="button button-secondary">
          Limpar
        </Link>
      </div>
    </form>
  );
}
