import type { PostgrestError } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];

export interface CourseManagementSummary {
  totalInstitutions: number;
  totalCourses: number;
  totalOffers: number;
  totalActiveCourses: number;
  totalActiveOffers: number;
}

export interface CourseManagementInstitutionOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CourseManagementUnitOption {
  id: string;
  institutionId: string | null;
  name: string;
  acronym: string;
  isActive: boolean;
}

export interface CourseManagementCourseOption {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  slug: string;
  isActive: boolean;
}

export interface CourseManagementCourseEntry {
  id: string;
  institutionId: string;
  institutionName: string;
  code: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface CourseManagementOfferEntry {
  id: string;
  institutionId: string;
  institutionName: string;
  unitId: string;
  unitName: string;
  courseId: string;
  courseName: string;
  displayName: string;
  code: string | null;
  isActive: boolean;
}

export interface CourseManagementPageData {
  summary: CourseManagementSummary;
  institutions: CourseManagementInstitutionOption[];
  units: CourseManagementUnitOption[];
  courses: CourseManagementCourseEntry[];
  courseOptions: CourseManagementCourseOption[];
  offers: CourseManagementOfferEntry[];
}

function formatSupabaseErrorMessage(context: string, error: PostgrestError | null) {
  if (!error) {
    return context;
  }

  const details = [
    error.message ? `message=${error.message}` : null,
    error.code ? `code=${error.code}` : null,
    error.details ? `details=${error.details}` : null,
    error.hint ? `hint=${error.hint}` : null
  ].filter(Boolean);

  return details.length ? `${context} (${details.join(" | ")})` : context;
}

function buildMapById<T extends { id: string | number }>(rows: T[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

export async function getCourseManagementPageData(): Promise<CourseManagementPageData> {
  const supabase = createSupabaseAdminClient();
  const [institutionsResult, unitsResult, coursesResult, offersResult] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("unidades").select("*").order("nome", { ascending: true }),
    supabase.from("cursos").select("*").order("nome", { ascending: true }),
    supabase
      .from("ofertas_curso_unidade")
      .select("*")
      .order("created_at", { ascending: true })
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as instituicoes.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar as unidades.", unitsResult.error)
    );
  }

  if (coursesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os cursos.", coursesResult.error)
    );
  }

  if (offersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as ofertas de curso.",
        offersResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const offerRows = (offersResult.data ?? []) as OfferRow[];
  const institutionsById = buildMapById(institutionRows);
  const unitsById = buildMapById(unitRows);
  const coursesById = buildMapById(courseRows);

  const institutions = institutionRows.map((institutionRow) => ({
    id: institutionRow.id,
    name: institutionRow.nome,
    slug: institutionRow.slug,
    isActive: institutionRow.ativo
  }));

  const units = unitRows.map((unitRow) => ({
    id: unitRow.id,
    institutionId: unitRow.instituicao_id,
    name: unitRow.nome,
    acronym: unitRow.sigla,
    isActive: unitRow.ativo
  }));

  const courseOptions = courseRows.map((courseRow) => ({
    id: courseRow.id,
    institutionId: courseRow.instituicao_id,
    name: courseRow.nome,
    code: courseRow.codigo,
    slug: courseRow.slug,
    isActive: courseRow.ativo
  }));

  const courses = courseRows
    .map((courseRow) => ({
      id: courseRow.id,
      institutionId: courseRow.instituicao_id,
      institutionName:
        institutionsById.get(courseRow.instituicao_id)?.nome ?? "Instituicao nao identificada",
      code: courseRow.codigo,
      name: courseRow.nome,
      slug: courseRow.slug,
      isActive: courseRow.ativo
    }))
    .sort((left, right) => {
      const institutionComparison = left.institutionName.localeCompare(
        right.institutionName,
        "pt-BR"
      );

      if (institutionComparison !== 0) {
        return institutionComparison;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });

  const offers = offerRows
    .map((offerRow) => {
      const institutionRow = institutionsById.get(offerRow.instituicao_id) ?? null;
      const unitRow = unitsById.get(offerRow.unidade_id) ?? null;
      const courseRow = coursesById.get(offerRow.curso_id) ?? null;

      return {
        id: offerRow.id,
        institutionId: offerRow.instituicao_id,
        institutionName: institutionRow?.nome ?? "Instituicao nao identificada",
        unitId: offerRow.unidade_id,
        unitName: unitRow?.nome ?? "Unidade nao identificada",
        courseId: offerRow.curso_id,
        courseName: courseRow?.nome ?? "Curso nao identificado",
        displayName:
          offerRow.nome_exibicao ??
          (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome"),
        code: offerRow.codigo,
        isActive: offerRow.ativo
      };
    })
    .sort((left, right) => {
      const institutionComparison = left.institutionName.localeCompare(
        right.institutionName,
        "pt-BR"
      );

      if (institutionComparison !== 0) {
        return institutionComparison;
      }

      const unitComparison = left.unitName.localeCompare(right.unitName, "pt-BR");

      if (unitComparison !== 0) {
        return unitComparison;
      }

      return left.courseName.localeCompare(right.courseName, "pt-BR");
    });

  return {
    summary: {
      totalInstitutions: institutionRows.length,
      totalCourses: courseRows.length,
      totalOffers: offerRows.length,
      totalActiveCourses: courseRows.filter((courseRow) => courseRow.ativo).length,
      totalActiveOffers: offerRows.filter((offerRow) => offerRow.ativo).length
    },
    institutions,
    units,
    courses,
    courseOptions,
    offers
  };
}
