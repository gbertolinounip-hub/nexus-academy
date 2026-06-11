export interface NormalizedOperationalFilters {
  institutionId: string;
  unitId: string;
  courseId: string;
  offerId: string;
}

interface NormalizeOperationalFiltersInput<
  TInstitution extends { id: string },
  TUnit extends { id: string; institutionId: string | null },
  TCourse extends { id: string; institutionId: string },
  TOffer extends { id: string; institutionId: string; unitId: string; courseId: string }
> {
  institutions: TInstitution[];
  units: TUnit[];
  courses: TCourse[];
  offers: TOffer[];
  filters: {
    institutionId?: string | null;
    unitId?: string | null;
    courseId?: string | null;
    offerId?: string | null;
  };
}

function normalizeFilterValue(value?: string | null) {
  return value?.trim() ?? "";
}

export function normalizeOperationalFilters<
  TInstitution extends { id: string },
  TUnit extends { id: string; institutionId: string | null },
  TCourse extends { id: string; institutionId: string },
  TOffer extends { id: string; institutionId: string; unitId: string; courseId: string }
>({
  institutions,
  units,
  courses,
  offers,
  filters
}: NormalizeOperationalFiltersInput<TInstitution, TUnit, TCourse, TOffer>): NormalizedOperationalFilters {
  const requestedInstitutionId = normalizeFilterValue(filters.institutionId);
  const requestedUnitId = normalizeFilterValue(filters.unitId);
  const requestedCourseId = normalizeFilterValue(filters.courseId);
  const requestedOfferId = normalizeFilterValue(filters.offerId);

  const validInstitutionId = institutions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";

  const requestedUnit = units.find((unit) => unit.id === requestedUnitId) ?? null;
  const validUnitId =
    requestedUnit &&
    (!validInstitutionId || requestedUnit.institutionId === validInstitutionId)
      ? requestedUnitId
      : "";

  const requestedCourse = courses.find((course) => course.id === requestedCourseId) ?? null;
  const validCourseId =
    requestedCourse &&
    (!validInstitutionId || requestedCourse.institutionId === validInstitutionId) &&
    (!validUnitId ||
      offers.some(
        (offer) =>
          offer.courseId === requestedCourseId &&
          offer.unitId === validUnitId &&
          (!validInstitutionId || offer.institutionId === validInstitutionId)
      ))
      ? requestedCourseId
      : "";

  const requestedOffer = offers.find((offer) => offer.id === requestedOfferId) ?? null;
  const validOfferId =
    requestedOffer &&
    (!validInstitutionId || requestedOffer.institutionId === validInstitutionId) &&
    (!validUnitId || requestedOffer.unitId === validUnitId) &&
    (!validCourseId || requestedOffer.courseId === validCourseId)
      ? requestedOfferId
      : "";

  return {
    institutionId: validInstitutionId,
    unitId: validUnitId,
    courseId: validCourseId,
    offerId: validOfferId
  };
}
