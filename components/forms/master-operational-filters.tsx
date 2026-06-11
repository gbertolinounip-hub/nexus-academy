"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";

interface InstitutionOptionLike {
  id: string;
  name: string;
}

interface UnitOptionLike {
  id: string;
  institutionId: string | null;
  name: string;
}

interface CourseOptionLike {
  id: string;
  institutionId: string;
  code: string;
  name: string;
}

interface OfferOptionLike {
  id: string;
  institutionId: string;
  unitId: string;
  courseId: string;
  unitName: string;
  displayName: string;
}

export interface MasterOperationalFilterValues {
  institutionId: string;
  unitId: string;
  courseId: string;
  offerId: string;
}

interface MasterOperationalFiltersProps {
  actionPath: Route;
  institutions: InstitutionOptionLike[];
  units: UnitOptionLike[];
  courses: CourseOptionLike[];
  offers: OfferOptionLike[];
  filters: MasterOperationalFilterValues;
  showOfferFilter?: boolean;
}

export function MasterOperationalFilters({
  actionPath,
  institutions,
  units,
  courses,
  offers,
  filters,
  showOfferFilter = true
}: MasterOperationalFiltersProps) {
  const [institutionId, setInstitutionId] = useState(filters.institutionId);
  const [unitId, setUnitId] = useState(filters.unitId);
  const [courseId, setCourseId] = useState(filters.courseId);
  const [offerId, setOfferId] = useState(filters.offerId);

  useEffect(() => {
    setInstitutionId(filters.institutionId);
    setUnitId(filters.unitId);
    setCourseId(filters.courseId);
    setOfferId(filters.offerId);
  }, [filters.courseId, filters.institutionId, filters.offerId, filters.unitId]);

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

        return offers.some(
          (offer) =>
            offer.courseId === course.id &&
            offer.unitId === effectiveUnitId &&
            (!institutionId || offer.institutionId === institutionId)
        );
      }),
    [courses, effectiveUnitId, institutionId, offers]
  );

  const effectiveCourseId = filteredCourses.some((course) => course.id === courseId)
    ? courseId
    : "";

  const filteredOffers = useMemo(
    () =>
      offers.filter((offer) => {
        const institutionMatches =
          !institutionId || offer.institutionId === institutionId;
        const unitMatches = !effectiveUnitId || offer.unitId === effectiveUnitId;
        const courseMatches = !effectiveCourseId || offer.courseId === effectiveCourseId;

        return institutionMatches && unitMatches && courseMatches;
      }),
    [effectiveCourseId, effectiveUnitId, institutionId, offers]
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

  useEffect(() => {
    if (offerId && !filteredOffers.some((offer) => offer.id === offerId)) {
      setOfferId("");
    }
  }, [filteredOffers, offerId]);

  return (
    <form method="get" className="master-filter-form master-filter-form-wide">
      <label className="field">
        <span>Instituicao / IES</span>
        <select
          className="input"
          name="instituicao"
          value={institutionId}
          onChange={(event) => setInstitutionId(event.currentTarget.value)}
        >
          <option value="">Todas as instituicoes</option>
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
              {course.code} - {course.name}
            </option>
          ))}
        </select>
      </label>

      {showOfferFilter ? (
        <label className="field">
          <span>Oferta</span>
          <select
            className="input"
            name="oferta"
            value={offerId}
            onChange={(event) => setOfferId(event.currentTarget.value)}
          >
            <option value="">Todas as ofertas</option>
            {filteredOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.unitName} - {offer.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="actions-row master-filter-actions">
        <button className="button button-secondary" type="submit">
          Aplicar filtros
        </button>
        <Link href={actionPath} className="button button-secondary">
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
