import type { PostgrestError } from "@supabase/supabase-js";
import type { NormalizedOperationalFilters } from "@/services/operational-filters";
import { normalizeOperationalFilters } from "@/services/operational-filters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];

export interface ClassManagementSummary {
  totalInstitutions: number;
  totalOffers: number;
  totalSemesters: number;
  totalClasses: number;
  totalActiveClasses: number;
}

export interface ClassManagementInstitutionOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface ClassManagementUnitOption {
  id: string;
  institutionId: string | null;
  name: string;
  isActive: boolean;
}

export interface ClassManagementCourseOption {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface ClassManagementOfferOption {
  id: string;
  institutionId: string;
  unitId: string;
  unitName: string;
  courseId: string;
  courseName: string;
  displayName: string;
  code: string | null;
  isActive: boolean;
  label: string;
}

export interface ClassManagementSemesterOption {
  id: string;
  offerId: string | null;
  institutionId: string | null;
  courseId: string | null;
  code: string;
  name: string;
  status: SemesterRow["status"];
  label: string;
}

export interface ClassManagementClassEntry {
  id: string;
  institutionId: string | null;
  unitId: string | null;
  courseId: string | null;
  offerId: string | null;
  institutionName: string;
  unitName: string;
  courseName: string | null;
  offerName: string | null;
  semesterCode: string;
  semesterName: string;
  classCode: string;
  className: string;
  stageArea: string;
  isActive: boolean;
  enrollmentCount: number;
}

export interface ClassManagementPageData {
  summary: ClassManagementSummary;
  institutions: ClassManagementInstitutionOption[];
  units: ClassManagementUnitOption[];
  courses: ClassManagementCourseOption[];
  offers: ClassManagementOfferOption[];
  semesters: ClassManagementSemesterOption[];
  classes: ClassManagementClassEntry[];
  filters: NormalizedOperationalFilters;
}

export interface ClassManagementFilters {
  instituicaoId?: string | null;
  unidadeId?: string | null;
  cursoId?: string | null;
  ofertaCursoUnidadeId?: string | null;
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

export async function getClassManagementPageData(
  filters: ClassManagementFilters = {}
): Promise<ClassManagementPageData> {
  const supabase = createSupabaseAdminClient();
  const [
    institutionsResult,
    unitsResult,
    coursesResult,
    offersResult,
    semestersResult,
    classesResult,
    enrollmentsResult
  ] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("unidades").select("*").order("nome", { ascending: true }),
    supabase.from("cursos").select("*").order("nome", { ascending: true }),
    supabase
      .from("ofertas_curso_unidade")
      .select("*")
      .order("nome_exibicao", { ascending: true }),
    supabase.from("semestres").select("*").order("data_inicio", { ascending: false }),
    supabase.from("turmas").select("*").order("created_at", { ascending: false }),
    supabase.from("matriculas_turma").select("id, turma_id")
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
        "Nao foi possivel carregar as ofertas de curso por unidade.",
        offersResult.error
      )
    );
  }

  if (semestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os semestres.", semestersResult.error)
    );
  }

  if (classesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar as turmas.", classesResult.error)
    );
  }

  if (enrollmentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as matriculas das turmas.",
        enrollmentsResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const offerRows = (offersResult.data ?? []) as OfferRow[];
  const semesterRows = (semestersResult.data ?? []) as SemesterRow[];
  const classRows = (classesResult.data ?? []) as ClassRow[];
  const enrollmentRows = (enrollmentsResult.data ?? []) as Pick<
    EnrollmentRow,
    "id" | "turma_id"
  >[];
  const institutionsById = buildMapById(institutionRows);
  const unitsById = buildMapById(unitRows);
  const coursesById = buildMapById(courseRows);
  const offersById = buildMapById(offerRows);
  const semestersById = buildMapById(semesterRows);
  const enrollmentCountByClassId = new Map<string, number>();

  for (const enrollmentRow of enrollmentRows) {
    enrollmentCountByClassId.set(
      enrollmentRow.turma_id,
      (enrollmentCountByClassId.get(enrollmentRow.turma_id) ?? 0) + 1
    );
  }

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
    isActive: unitRow.ativo
  }));

  const courses = courseRows.map((courseRow) => ({
    id: courseRow.id,
    institutionId: courseRow.instituicao_id,
    code: courseRow.codigo,
    name: courseRow.nome,
    isActive: courseRow.ativo
  }));

  const offers = offerRows
    .map((offerRow) => {
      const unitRow = unitsById.get(offerRow.unidade_id) ?? null;
      const courseRow = coursesById.get(offerRow.curso_id) ?? null;
      const institutionRow = institutionsById.get(offerRow.instituicao_id) ?? null;

      return {
        id: offerRow.id,
        institutionId: offerRow.instituicao_id,
        unitId: offerRow.unidade_id,
        unitName: unitRow?.nome ?? "Unidade nao identificada",
        courseId: offerRow.curso_id,
        courseName: courseRow?.nome ?? "Curso nao identificado",
        displayName:
          offerRow.nome_exibicao ??
          (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome"),
        code: offerRow.codigo,
        isActive: offerRow.ativo,
        label: institutionRow
          ? `${institutionRow.nome} / ${unitRow?.nome ?? "Unidade"} / ${
              offerRow.nome_exibicao ??
              (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome")
            }`
          : `${unitRow?.nome ?? "Unidade"} / ${
              offerRow.nome_exibicao ??
              (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome")
            }`
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const normalizedFilters = normalizeOperationalFilters({
    institutions,
    units,
    courses,
    offers,
    filters: {
      institutionId: filters.instituicaoId,
      unitId: filters.unidadeId,
      courseId: filters.cursoId,
      offerId: filters.ofertaCursoUnidadeId
    }
  });

  const semesters = semesterRows
    .map<ClassManagementSemesterOption>((semesterRow) => {
      const offerRow = semesterRow.oferta_curso_unidade_id
        ? offersById.get(semesterRow.oferta_curso_unidade_id) ?? null
        : null;
      const institutionRow = offerRow
        ? institutionsById.get(offerRow.instituicao_id) ?? null
        : null;
      const courseRow = offerRow ? coursesById.get(offerRow.curso_id) ?? null : null;

      return {
        id: semesterRow.id,
        offerId: semesterRow.oferta_curso_unidade_id,
        institutionId: offerRow?.instituicao_id ?? null,
        courseId: offerRow?.curso_id ?? null,
        code: semesterRow.codigo,
        name: semesterRow.nome,
        status: semesterRow.status,
        label: `${
          institutionRow?.nome ?? "Instituicao"
        } / ${courseRow?.nome ?? "Curso"} / ${semesterRow.codigo} - ${semesterRow.nome}`
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const classes = classRows
    .map<ClassManagementClassEntry>((classRow) => {
      const semesterRow = semestersById.get(classRow.semestre_id) ?? null;
      const offerRow = classRow.oferta_curso_unidade_id
        ? offersById.get(classRow.oferta_curso_unidade_id) ?? null
        : semesterRow?.oferta_curso_unidade_id
          ? offersById.get(semesterRow.oferta_curso_unidade_id) ?? null
          : null;
      const unitRow = offerRow ? unitsById.get(offerRow.unidade_id) ?? null : null;
      const courseRow = offerRow ? coursesById.get(offerRow.curso_id) ?? null : null;
      const institutionRow = offerRow
        ? institutionsById.get(offerRow.instituicao_id) ?? null
        : null;

      return {
        id: classRow.id,
        institutionId: institutionRow?.id ?? null,
        unitId: unitRow?.id ?? null,
        courseId: courseRow?.id ?? null,
        offerId: offerRow?.id ?? null,
        institutionName: institutionRow?.nome ?? "Instituicao nao identificada",
        unitName: unitRow?.nome ?? "Unidade nao identificada",
        courseName: courseRow?.nome ?? null,
        offerName: offerRow?.nome_exibicao ?? null,
        semesterCode: semesterRow?.codigo ?? "Sem semestre",
        semesterName: semesterRow?.nome ?? "Sem semestre vinculado",
        classCode: classRow.codigo,
        className: classRow.nome,
        stageArea: classRow.area_estagio,
        isActive: classRow.ativa,
        enrollmentCount: enrollmentCountByClassId.get(classRow.id) ?? 0
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

      const courseComparison = (left.courseName ?? "").localeCompare(
        right.courseName ?? "",
        "pt-BR"
      );

      if (courseComparison !== 0) {
        return courseComparison;
      }

      return left.className.localeCompare(right.className, "pt-BR");
    });

  const filteredClasses = classes.filter((classEntry) => {
    const institutionMatches =
      !normalizedFilters.institutionId ||
      classEntry.institutionId === normalizedFilters.institutionId;
    const unitMatches = !normalizedFilters.unitId || classEntry.unitId === normalizedFilters.unitId;
    const courseMatches =
      !normalizedFilters.courseId || classEntry.courseId === normalizedFilters.courseId;
    const offerMatches =
      !normalizedFilters.offerId || classEntry.offerId === normalizedFilters.offerId;

    return institutionMatches && unitMatches && courseMatches && offerMatches;
  });

  return {
    summary: {
      totalInstitutions: institutionRows.length,
      totalOffers: offerRows.length,
      totalSemesters: semesterRows.length,
      totalClasses: classRows.length,
      totalActiveClasses: classRows.filter((classRow) => classRow.ativa).length
    },
    institutions,
    units,
    courses,
    offers,
    semesters,
    classes: filteredClasses,
    filters: normalizedFilters
  };
}
