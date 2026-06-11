"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import type {
  MasterGlobalAuditPageData,
  MasterInstitutionOption,
  MasterUnitOption
} from "@/services/master";

interface MasterAuditFiltersProps {
  institutions: MasterInstitutionOption[];
  units: MasterUnitOption[];
  filters: MasterGlobalAuditPageData["filters"];
}

export function MasterAuditFilters({
  institutions,
  units,
  filters
}: MasterAuditFiltersProps) {
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
        <Link href={"/master/auditoria" as Route} className="button button-secondary">
          Limpar
        </Link>
      </div>
    </form>
  );
}
