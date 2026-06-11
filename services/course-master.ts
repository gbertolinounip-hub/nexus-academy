import type { PostgrestError } from "@supabase/supabase-js";
import {
  contextRoleLabels,
  getActiveMasterCourseContext,
  getContextRoleDisplayName
} from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ContextProfileCode, SessionUser } from "@/types/domain";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type ProfessorAreaRow = Database["public"]["Tables"]["professor_areas_estagio"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];

export interface CourseMasterPageData {
  institutionName: string;
  courseName: string;
  summary: {
    totalOffers: number;
    totalUnits: number;
    totalCoordinators: number;
    totalProfessors: number;
    totalStudents: number;
    totalClasses: number;
    totalSemesters: number;
  };
  offerEntries: CourseMasterOfferEntry[];
  contextEntries: CourseMasterContextEntry[];
}

export interface CourseMasterOfferEntry {
  offerId: string;
  unitId: string;
  unitName: string;
  offerName: string;
  isActive: boolean;
  studentCount: number;
  classCount: number;
  coordinatorCount: number;
  professorCount: number;
}

export interface CourseMasterContextEntry {
  contextId: string;
  userId: string;
  userName: string;
  userEmail: string;
  profileCode: ContextProfileCode;
  profileName: string;
  unitName: string | null;
  offerName: string | null;
  active: boolean;
  principal: boolean;
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

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function resolveSafeLegacyProfessorUnitIds(input: {
  unitIds: string[];
  currentCourseId: string;
  rows: Array<Pick<OfferRow, "unidade_id" | "curso_id">>;
}) {
  const courseIdsByUnit = new Map<string, Set<string>>();

  for (const row of input.rows) {
    const courseIds = courseIdsByUnit.get(row.unidade_id) ?? new Set<string>();
    courseIds.add(row.curso_id);
    courseIdsByUnit.set(row.unidade_id, courseIds);
  }

  return input.unitIds.filter((unitId) => {
    const courseIds = courseIdsByUnit.get(unitId) ?? new Set<string>();
    return courseIds.size === 1 && courseIds.has(input.currentCourseId);
  });
}

function buildMapById<T extends { id: string | number }>(rows: T[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function resolveContextProfileCode(value: string | null | undefined): ContextProfileCode | null {
  if (!value) {
    return null;
  }

  return value in contextRoleLabels ? (value as ContextProfileCode) : null;
}

export async function getCourseMasterPageData(
  currentUser: SessionUser
): Promise<CourseMasterPageData | null> {
  const activeContext = getActiveMasterCourseContext(currentUser);

  if (!activeContext) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { instituicaoId, cursoId } = activeContext;

  const [institutionResult, courseResult, offersResult, contextsResult] =
    await Promise.all([
      supabase.from("instituicoes").select("*").eq("id", instituicaoId).maybeSingle(),
      supabase.from("cursos").select("*").eq("id", cursoId).maybeSingle(),
      supabase
        .from("ofertas_curso_unidade")
        .select("*")
        .eq("instituicao_id", instituicaoId)
        .eq("curso_id", cursoId)
        .order("nome_exibicao", { ascending: true }),
      supabase
        .from("usuarios_papeis_contexto")
        .select("*")
        .eq("instituicao_id", instituicaoId)
        .eq("curso_id", cursoId)
        .order("principal", { ascending: false })
        .order("created_at", { ascending: true })
    ]);

  if (institutionResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar a instituicao do contexto ativo.",
        institutionResult.error
      )
    );
  }

  if (courseResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar o curso do contexto ativo.",
        courseResult.error
      )
    );
  }

  if (offersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as ofertas do curso por unidade.",
        offersResult.error
      )
    );
  }

  if (contextsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os contextos do curso.",
        contextsResult.error
      )
    );
  }

  const institutionRow = (institutionResult.data ?? null) as InstitutionRow | null;
  const courseRow = (courseResult.data ?? null) as CourseRow | null;
  const offerRows = (offersResult.data ?? []) as OfferRow[];
  const contextRows = (contextsResult.data ?? []) as UserContextRow[];

  if (!institutionRow || !courseRow) {
    return null;
  }

  const offerIds = offerRows.map((offerRow) => offerRow.id);
  const unitIds = uniqueStringValues(offerRows.map((offerRow) => offerRow.unidade_id));
  const userIds = uniqueStringValues(contextRows.map((contextRow) => contextRow.usuario_id));
  const profileIds = [...new Set(contextRows.map((contextRow) => contextRow.perfil_id))];

  const [unitsResult, usersResult, profilesResult, semestersResult, professorProfileResult, allUnitOffersResult] =
    await Promise.all([
      unitIds.length
        ? supabase.from("unidades").select("*").in("id", unitIds)
        : Promise.resolve({ data: [], error: null }),
      userIds.length
        ? supabase.from("usuarios").select("*").in("id", userIds)
        : Promise.resolve({ data: [], error: null }),
      profileIds.length
        ? supabase.from("perfis").select("*").in("id", profileIds)
        : Promise.resolve({ data: [], error: null }),
      offerIds.length
        ? supabase.from("semestres").select("*").in("oferta_curso_unidade_id", offerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("perfis").select("*").eq("codigo", "professor").maybeSingle(),
      unitIds.length
        ? supabase
            .from("ofertas_curso_unidade")
            .select("unidade_id, curso_id")
            .eq("instituicao_id", instituicaoId)
            .in("unidade_id", unitIds)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as unidades do curso.",
        unitsResult.error
      )
    );
  }

  if (usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os usuarios do curso.",
        usersResult.error
      )
    );
  }

  if (profilesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os perfis dos contextos do curso.",
        profilesResult.error
      )
    );
  }

  if (semestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os semestres do curso.",
        semestersResult.error
      )
    );
  }

  if (professorProfileResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar o perfil tecnico de professor.",
        professorProfileResult.error
      )
    );
  }

  if (allUnitOffersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel validar as unidades seguras para contagem de professores do curso.",
        allUnitOffersResult.error
      )
    );
  }

  const semesterRows = (semestersResult.data ?? []) as SemesterRow[];
  const professorProfile = (professorProfileResult.data ?? null) as ProfileRow | null;
  const safeLegacyUnitIds = resolveSafeLegacyProfessorUnitIds({
    unitIds,
    currentCourseId: cursoId,
    rows: ((allUnitOffersResult.data ?? []) as Array<
      Pick<OfferRow, "unidade_id" | "curso_id">
    >)
  });
  const semesterIds = semesterRows.map((semesterRow) => semesterRow.id);
  const classRowsResult = semesterIds.length
    ? await supabase.from("turmas").select("*").in("semestre_id", semesterIds)
    : { data: [], error: null };

  if (classRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as turmas do curso.",
        classRowsResult.error
      )
    );
  }

  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const classIds = classRows.map((classRow) => classRow.id);
  const enrollmentRowsResult = classIds.length
    ? await supabase.from("matriculas_turma").select("*").in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar as matriculas do curso.",
        enrollmentRowsResult.error
      )
    );
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const enrollmentStudentIds = uniqueStringValues(
    enrollmentRows.map((enrollmentRow) => enrollmentRow.aluno_id)
  );
  const [
    studentsByCourseResult,
    studentsByOfferResult,
    studentsByEnrollmentResult,
    professorLinksResult,
    legacyProfessorUsersResult,
    legacyProfessorRowsResult,
    legacyProfessorAreasResult
  ] =
    await Promise.all([
      supabase.from("alunos").select("*").eq("curso_id", cursoId).order("matricula"),
      offerIds.length
        ? supabase
            .from("alunos")
            .select("*")
            .in("oferta_curso_unidade_id", offerIds)
            .order("matricula")
        : Promise.resolve({ data: [], error: null }),
      enrollmentStudentIds.length
        ? supabase
            .from("alunos")
            .select("*")
            .in("usuario_id", enrollmentStudentIds)
            .order("matricula")
        : Promise.resolve({ data: [], error: null }),
      enrollmentRows.length
        ? supabase
            .from("vinculos_professor_aluno")
            .select("*")
            .eq("ativo", true)
            .in("matricula_turma_id", enrollmentRows.map((enrollmentRow) => enrollmentRow.id))
        : Promise.resolve({ data: [], error: null }),
      professorProfile && safeLegacyUnitIds.length
        ? supabase
            .from("usuarios")
            .select("*")
            .eq("perfil_id", professorProfile.id)
            .in("unidade_id", safeLegacyUnitIds)
        : Promise.resolve({ data: [], error: null }),
      professorProfile && safeLegacyUnitIds.length
        ? supabase
            .from("professores")
            .select("*")
        : Promise.resolve({ data: [], error: null }),
      professorProfile && safeLegacyUnitIds.length
        ? supabase
            .from("professor_areas_estagio")
            .select("*")
            .eq("ativo", true)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (
    studentsByCourseResult.error ||
    studentsByOfferResult.error ||
    studentsByEnrollmentResult.error ||
    professorLinksResult.error ||
    legacyProfessorUsersResult.error ||
    legacyProfessorRowsResult.error ||
    legacyProfessorAreasResult.error
  ) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Nao foi possivel carregar os alunos do curso.",
        studentsByCourseResult.error ??
          studentsByOfferResult.error ??
          studentsByEnrollmentResult.error ??
          professorLinksResult.error ??
          legacyProfessorUsersResult.error ??
          legacyProfessorRowsResult.error ??
          legacyProfessorAreasResult.error
      )
    );
  }

  const studentRows = Array.from(
    new Map(
      [
        ...((studentsByCourseResult.data ?? []) as StudentRow[]),
        ...((studentsByOfferResult.data ?? []) as StudentRow[]),
        ...((studentsByEnrollmentResult.data ?? []) as StudentRow[])
      ].map((studentRow) => [studentRow.usuario_id, studentRow])
    ).values()
  );
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const userRows = (usersResult.data ?? []) as UserRow[];
  const profileRows = (profilesResult.data ?? []) as ProfileRow[];
  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const legacyProfessorUsers = (legacyProfessorUsersResult.data ?? []) as UserRow[];
  const legacyProfessorRows = (legacyProfessorRowsResult.data ?? []) as ProfessorRow[];
  const legacyProfessorAreaRows = (legacyProfessorAreasResult.data ?? []) as ProfessorAreaRow[];

  const offersById = buildMapById(offerRows);
  const unitsById = buildMapById(unitRows);
  const usersById = buildMapById(userRows);
  const profilesById = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow]));
  const semesterMap = buildMapById(semesterRows);
  const enrollmentMap = buildMapById(enrollmentRows);
  const contextRowsById = new Map(contextRows.map((contextRow) => [contextRow.id, contextRow]));

  const contextEntries = contextRows
    .map<CourseMasterContextEntry | null>((contextRow) => {
      const userRow = usersById.get(contextRow.usuario_id) ?? null;
      const profileRow = profilesById.get(contextRow.perfil_id) ?? null;
      const profileCode = resolveContextProfileCode(profileRow?.codigo);

      if (!userRow || !profileRow || !profileCode) {
        return null;
      }

      const offerRow = contextRow.oferta_curso_unidade_id
        ? offersById.get(contextRow.oferta_curso_unidade_id) ?? null
        : null;
      const unitRow = offerRow?.unidade_id ? unitsById.get(offerRow.unidade_id) ?? null : null;

      return {
        contextId: contextRow.id,
        userId: userRow.id,
        userName: userRow.nome_completo,
        userEmail: userRow.email,
        profileCode,
        profileName: getContextRoleDisplayName(profileCode, profileRow.nome),
        unitName: unitRow?.nome ?? null,
        offerName:
          offerRow?.nome_exibicao ??
          (unitRow ? `${courseRow.nome} - ${unitRow.nome}` : null),
        active: contextRow.ativo,
        principal: contextRow.principal
      };
    })
    .filter((entry): entry is CourseMasterContextEntry => entry !== null)
    .sort((left, right) => {
      if (left.principal !== right.principal) {
        return left.principal ? -1 : 1;
      }

      const profileComparison = left.profileName.localeCompare(right.profileName, "pt-BR");

      if (profileComparison !== 0) {
        return profileComparison;
      }

      return left.userName.localeCompare(right.userName, "pt-BR");
    });

  const offerContextMap = new Map<string, CourseMasterContextEntry[]>();

  for (const contextEntry of contextEntries) {
    const contextRow = contextRowsById.get(contextEntry.contextId) ?? null;
    const offerId = contextRow?.oferta_curso_unidade_id ?? null;

    if (!offerId) {
      continue;
    }

    const currentEntries = offerContextMap.get(offerId) ?? [];
    currentEntries.push(contextEntry);
    offerContextMap.set(offerId, currentEntries);
  }

  const offerClassIdsMap = new Map<string, Set<string>>();
  const offerStudentIdsMap = new Map<string, Set<string>>();
  const offerProfessorIdsMap = new Map<string, Set<string>>();
  const legacyProfessorIdsByUnit = new Map<string, Set<string>>();

  const appendOfferValue = (
    registry: Map<string, Set<string>>,
    offerId: string | null | undefined,
    value: string | null | undefined
  ) => {
    if (!offerId || !value) {
      return;
    }

    const currentValues = registry.get(offerId) ?? new Set<string>();
    currentValues.add(value);
    registry.set(offerId, currentValues);
  };

  for (const studentRow of studentRows) {
    appendOfferValue(
      offerStudentIdsMap,
      studentRow.oferta_curso_unidade_id,
      studentRow.usuario_id
    );
  }

  const classOfferIdsByClassId = new Map<string, string>();

  for (const classRow of classRows) {
    const semesterRow = semesterMap.get(classRow.semestre_id) ?? null;
    const resolvedOfferId =
      classRow.oferta_curso_unidade_id ?? semesterRow?.oferta_curso_unidade_id ?? null;

    if (!resolvedOfferId || !offersById.has(resolvedOfferId)) {
      continue;
    }

    classOfferIdsByClassId.set(classRow.id, resolvedOfferId);
    appendOfferValue(offerClassIdsMap, resolvedOfferId, classRow.id);
  }

  for (const enrollmentRow of enrollmentRows) {
    const resolvedOfferId =
      classOfferIdsByClassId.get(enrollmentRow.turma_id) ??
      enrollmentRow.oferta_curso_unidade_id ??
      null;

    appendOfferValue(offerStudentIdsMap, resolvedOfferId, enrollmentRow.aluno_id);
  }

  for (const professorLink of professorLinks) {
    const enrollmentRow = enrollmentMap.get(professorLink.matricula_turma_id) ?? null;
    const resolvedOfferId = enrollmentRow
      ? classOfferIdsByClassId.get(enrollmentRow.turma_id) ??
        enrollmentRow.oferta_curso_unidade_id ??
        null
      : null;

    appendOfferValue(offerProfessorIdsMap, resolvedOfferId, professorLink.professor_id);
  }

  const legacyProfessorRowByUserId = new Map(
    legacyProfessorRows.map((professorRow) => [professorRow.usuario_id, professorRow])
  );
  const legacyProfessorAreaIds = new Set(
    legacyProfessorAreaRows.map((areaRow) => areaRow.professor_id)
  );

  for (const userRow of legacyProfessorUsers) {
    if (!legacyProfessorRowByUserId.has(userRow.id) || !legacyProfessorAreaIds.has(userRow.id)) {
      continue;
    }

    if (!userRow.unidade_id) {
      continue;
    }

    const currentProfessorIds = legacyProfessorIdsByUnit.get(userRow.unidade_id) ?? new Set<string>();
    currentProfessorIds.add(userRow.id);
    legacyProfessorIdsByUnit.set(userRow.unidade_id, currentProfessorIds);
  }

  const offerEntries = offerRows
    .map<CourseMasterOfferEntry>((offerRow) => {
      const unitRow = unitsById.get(offerRow.unidade_id) ?? null;
      const contextsForOffer = offerContextMap.get(offerRow.id) ?? [];
      const contextCoordinatorIds = new Set(
        contextsForOffer
          .filter((contextEntry) => contextEntry.profileCode === "coordenador")
          .map((contextEntry) => contextEntry.userId)
      );
      const contextProfessorIds = new Set(
        contextsForOffer
          .filter((contextEntry) => contextEntry.profileCode === "professor")
          .map((contextEntry) => contextEntry.userId)
      );
      const directStudentIds = offerStudentIdsMap.get(offerRow.id) ?? new Set<string>();
      const directProfessorIds = offerProfessorIdsMap.get(offerRow.id) ?? new Set<string>();
      const legacyProfessorIds = legacyProfessorIdsByUnit.get(offerRow.unidade_id) ?? new Set<string>();

      for (const professorId of directProfessorIds) {
        contextProfessorIds.add(professorId);
      }

      for (const professorId of legacyProfessorIds) {
        contextProfessorIds.add(professorId);
      }

      return {
        offerId: offerRow.id,
        unitId: offerRow.unidade_id,
        unitName: unitRow?.nome ?? "Unidade nao identificada",
        offerName:
          offerRow.nome_exibicao ??
          (unitRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome"),
        isActive: offerRow.ativo,
        studentCount: directStudentIds.size,
        classCount: (offerClassIdsMap.get(offerRow.id) ?? new Set<string>()).size,
        coordinatorCount: contextCoordinatorIds.size,
        professorCount: contextProfessorIds.size
      };
    })
    .sort((left, right) => left.unitName.localeCompare(right.unitName, "pt-BR"));

  const totalCoordinatorIds = new Set(
    contextEntries
      .filter((contextEntry) => contextEntry.profileCode === "coordenador")
      .map((contextEntry) => contextEntry.userId)
  );
  const totalProfessorIds = new Set(
    contextEntries
      .filter((contextEntry) => contextEntry.profileCode === "professor")
      .map((contextEntry) => contextEntry.userId)
  );

  for (const offerProfessorIds of offerProfessorIdsMap.values()) {
    for (const professorId of offerProfessorIds) {
      totalProfessorIds.add(professorId);
    }
  }

  for (const legacyProfessorIds of legacyProfessorIdsByUnit.values()) {
    for (const professorId of legacyProfessorIds) {
      totalProfessorIds.add(professorId);
    }
  }

  return {
    institutionName: institutionRow.nome,
    courseName: courseRow.nome,
    summary: {
      totalOffers: offerRows.length,
      totalUnits: new Set(offerRows.map((offerRow) => offerRow.unidade_id)).size,
      totalCoordinators: totalCoordinatorIds.size,
      totalProfessors: totalProfessorIds.size,
      totalStudents: studentRows.length,
      totalClasses: classRows.length,
      totalSemesters: semesterRows.length
    },
    offerEntries,
    contextEntries
  };
}
