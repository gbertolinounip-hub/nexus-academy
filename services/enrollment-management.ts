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
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];

export interface EnrollmentManagementSummary {
  totalInstitutions: number;
  totalOffers: number;
  totalClasses: number;
  totalStudents: number;
  totalEnrollments: number;
  totalEnrollmentsWithOffer: number;
}

export interface EnrollmentManagementInstitutionOption {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface EnrollmentManagementUnitOption {
  id: string;
  institutionId: string | null;
  name: string;
  isActive: boolean;
}

export interface EnrollmentManagementCourseOption {
  id: string;
  institutionId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface EnrollmentManagementOfferOption {
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

export interface EnrollmentManagementSemesterOption {
  id: string;
  offerId: string | null;
  institutionId: string | null;
  courseId: string | null;
  code: string;
  name: string;
  status: SemesterRow["status"];
  label: string;
}

export interface EnrollmentManagementClassOption {
  id: string;
  offerId: string | null;
  semesterId: string;
  institutionId: string | null;
  courseId: string | null;
  code: string;
  name: string;
  label: string;
  isActive: boolean;
}

export interface EnrollmentManagementStudentOption {
  id: string;
  unitId: string | null;
  offerId: string | null;
  courseId: string | null;
  registration: string;
  name: string;
  email: string;
  courseName: string | null;
  offerName: string | null;
  label: string;
}

export interface EnrollmentManagementEntry {
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
  studentName: string;
  studentEmail: string;
  registration: string;
  status: EnrollmentRow["status"];
  studentCourseName: string | null;
  studentOfferName: string | null;
}

export interface EnrollmentManagementPageData {
  summary: EnrollmentManagementSummary;
  institutions: EnrollmentManagementInstitutionOption[];
  units: EnrollmentManagementUnitOption[];
  courses: EnrollmentManagementCourseOption[];
  offers: EnrollmentManagementOfferOption[];
  semesters: EnrollmentManagementSemesterOption[];
  classes: EnrollmentManagementClassOption[];
  students: EnrollmentManagementStudentOption[];
  enrollments: EnrollmentManagementEntry[];
  filters: NormalizedOperationalFilters;
}

export interface EnrollmentManagementFilters {
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

export async function getEnrollmentManagementPageData(
  filters: EnrollmentManagementFilters = {}
): Promise<EnrollmentManagementPageData> {
  const supabase = createSupabaseAdminClient();
  const [
    institutionsResult,
    unitsResult,
    coursesResult,
    offersResult,
    semestersResult,
    classesResult,
    studentsResult,
    usersResult,
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
    supabase.from("turmas").select("*").order("nome", { ascending: true }),
    supabase.from("alunos").select("*"),
    supabase.from("usuarios").select("id, email, nome_completo, ativo"),
    supabase.from("matriculas_turma").select("*").order("created_at", { ascending: false })
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

  if (studentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os alunos.", studentsResult.error)
    );
  }

  if (usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar os usuarios dos alunos.", usersResult.error)
    );
  }

  if (enrollmentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Nao foi possivel carregar as matriculas.", enrollmentsResult.error)
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const offerRows = (offersResult.data ?? []) as OfferRow[];
  const semesterRows = (semestersResult.data ?? []) as SemesterRow[];
  const classRows = (classesResult.data ?? []) as ClassRow[];
  const studentRows = (studentsResult.data ?? []) as StudentRow[];
  const userRows = (usersResult.data ?? []) as Pick<
    UserRow,
    "id" | "email" | "nome_completo" | "ativo"
  >[];
  const enrollmentRows = (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const institutionsById = buildMapById(institutionRows);
  const unitsById = buildMapById(unitRows);
  const coursesById = buildMapById(courseRows);
  const offersById = buildMapById(offerRows);
  const semestersById = buildMapById(semesterRows);
  const classesById = buildMapById(classRows);
  const studentsById = new Map(studentRows.map((studentRow) => [studentRow.usuario_id, studentRow]));
  const usersById = new Map(userRows.map((userRow) => [userRow.id, userRow]));

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
    .map<EnrollmentManagementSemesterOption>((semesterRow) => {
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
    .map<EnrollmentManagementClassOption>((classRow) => {
      const semesterRow = semestersById.get(classRow.semestre_id) ?? null;
      const offerRow = classRow.oferta_curso_unidade_id
        ? offersById.get(classRow.oferta_curso_unidade_id) ?? null
        : semesterRow?.oferta_curso_unidade_id
          ? offersById.get(semesterRow.oferta_curso_unidade_id) ?? null
          : null;
      const institutionRow = offerRow
        ? institutionsById.get(offerRow.instituicao_id) ?? null
        : null;
      const courseRow = offerRow ? coursesById.get(offerRow.curso_id) ?? null : null;

      return {
        id: classRow.id,
        offerId: offerRow?.id ?? null,
        semesterId: classRow.semestre_id,
        institutionId: institutionRow?.id ?? null,
        courseId: courseRow?.id ?? null,
        code: classRow.codigo,
        name: classRow.nome,
        label: `${
          institutionRow?.nome ?? "Instituicao"
        } / ${courseRow?.nome ?? "Curso"} / ${semesterRow?.codigo ?? "Sem semestre"} / ${
          classRow.codigo
        } - ${classRow.nome}`,
        isActive: classRow.ativa
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  const students = studentRows
    .map<EnrollmentManagementStudentOption | null>((studentRow) => {
      const userRow = usersById.get(studentRow.usuario_id) ?? null;

      if (!userRow) {
        return null;
      }

      const courseRow = studentRow.curso_id ? coursesById.get(studentRow.curso_id) ?? null : null;
      const offerRow = studentRow.oferta_curso_unidade_id
        ? offersById.get(studentRow.oferta_curso_unidade_id) ?? null
        : null;

      return {
        id: studentRow.usuario_id,
        unitId: studentRow.unidade_id,
        offerId: studentRow.oferta_curso_unidade_id,
        courseId: studentRow.curso_id,
        registration: studentRow.matricula,
        name: studentRow.nome_social ?? userRow.nome_completo,
        email: userRow.email,
        courseName: courseRow?.nome ?? null,
        offerName: offerRow?.nome_exibicao ?? null,
        label: `${studentRow.matricula} - ${studentRow.nome_social ?? userRow.nome_completo} (${userRow.email})`
      };
    })
    .filter(Boolean)
    .sort((left, right) => left!.label.localeCompare(right!.label, "pt-BR")) as EnrollmentManagementStudentOption[];

  const enrollments = enrollmentRows
    .map<EnrollmentManagementEntry | null>((enrollmentRow) => {
      const classRow = classesById.get(enrollmentRow.turma_id) ?? null;
      const semesterRow = classRow ? semestersById.get(classRow.semestre_id) ?? null : null;
      const offerRow = enrollmentRow.oferta_curso_unidade_id
        ? offersById.get(enrollmentRow.oferta_curso_unidade_id) ?? null
        : classRow?.oferta_curso_unidade_id
          ? offersById.get(classRow.oferta_curso_unidade_id) ?? null
          : semesterRow?.oferta_curso_unidade_id
            ? offersById.get(semesterRow.oferta_curso_unidade_id) ?? null
            : null;
      const unitRow = offerRow ? unitsById.get(offerRow.unidade_id) ?? null : null;
      const institutionRow = offerRow
        ? institutionsById.get(offerRow.instituicao_id) ?? null
        : null;
      const courseRow = offerRow ? coursesById.get(offerRow.curso_id) ?? null : null;
      const studentRow = studentsById.get(enrollmentRow.aluno_id) ?? null;
      const studentUser = usersById.get(enrollmentRow.aluno_id) ?? null;

      if (!classRow || !studentRow || !studentUser) {
        return null;
      }

      const studentCourseRow = studentRow.curso_id
        ? coursesById.get(studentRow.curso_id) ?? null
        : null;
      const studentOfferRow = studentRow.oferta_curso_unidade_id
        ? offersById.get(studentRow.oferta_curso_unidade_id) ?? null
        : null;

      return {
        id: enrollmentRow.id,
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
        studentName: studentRow.nome_social ?? studentUser.nome_completo,
        studentEmail: studentUser.email,
        registration: studentRow.matricula,
        status: enrollmentRow.status,
        studentCourseName: studentCourseRow?.nome ?? null,
        studentOfferName: studentOfferRow?.nome_exibicao ?? null
      };
    })
    .filter(Boolean)
    .sort((left, right) => left!.studentName.localeCompare(right!.studentName, "pt-BR")) as EnrollmentManagementEntry[];

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const institutionMatches =
      !normalizedFilters.institutionId ||
      enrollment.institutionId === normalizedFilters.institutionId;
    const unitMatches = !normalizedFilters.unitId || enrollment.unitId === normalizedFilters.unitId;
    const courseMatches =
      !normalizedFilters.courseId || enrollment.courseId === normalizedFilters.courseId;
    const offerMatches =
      !normalizedFilters.offerId || enrollment.offerId === normalizedFilters.offerId;

    return institutionMatches && unitMatches && courseMatches && offerMatches;
  });

  return {
    summary: {
      totalInstitutions: institutionRows.length,
      totalOffers: offerRows.length,
      totalClasses: classRows.length,
      totalStudents: studentRows.length,
      totalEnrollments: enrollmentRows.length,
      totalEnrollmentsWithOffer: enrollmentRows.filter(
        (enrollmentRow) => enrollmentRow.oferta_curso_unidade_id
      ).length
    },
    institutions,
    units,
    courses,
    offers,
    semesters,
    classes,
    students,
    enrollments: filteredEnrollments,
    filters: normalizedFilters
  };
}
