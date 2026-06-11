import type { PostgrestError } from "@supabase/supabase-js";
import { contextRoleLabels, getContextRoleDisplayName } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ContextProfileCode } from "@/types/domain";
import type { Database } from "@/types/database";

type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type CourseRow = Database["public"]["Tables"]["cursos"]["Row"];
type OfferRow = Database["public"]["Tables"]["ofertas_curso_unidade"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type UserContextRow = Database["public"]["Tables"]["usuarios_papeis_contexto"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type StudentDocumentRow = Database["public"]["Tables"]["documentos_aluno"]["Row"];

export interface InstitutionalContextSummary {
  totalInstitutions: number;
  totalUnits: number;
  totalCourses: number;
  totalOffers: number;
  totalUsersWithContext: number;
  totalUsersWithoutContext: number;
  totalUsersWithMultipleContexts: number;
  totalUsersWithDefaultContext: number;
  totalMasterCourseUsers: number;
}

export interface InstitutionalStructureEntry {
  institutionId: string | null;
  institutionName: string;
  unitId: string;
  unitName: string;
  courseId: string | null;
  courseName: string | null;
  offerId: string | null;
  offerName: string | null;
  isActive: boolean;
  statusLabel: string;
}

export interface InstitutionalUserContextEntry {
  userId: string;
  userName: string;
  userEmail: string;
  userActive: boolean;
  legacyProfileCode: ContextProfileCode | null;
  legacyProfileName: string;
  legacyUnitId: string | null;
  legacyUnitName: string | null;
  contextId: string;
  contextProfileCode: ContextProfileCode;
  contextProfileName: string;
  institutionId: string | null;
  institutionName: string | null;
  courseId: string | null;
  courseName: string | null;
  offerId: string | null;
  offerName: string | null;
  unitId: string | null;
  unitName: string | null;
  principal: boolean;
  ativo: boolean;
  isDefaultContext: boolean;
}

export interface InstitutionalMasterCourseEntry {
  userId: string;
  userName: string;
  userEmail: string;
  institutionId: string | null;
  institutionName: string | null;
  courseId: string | null;
  courseName: string | null;
  principal: boolean;
  ativo: boolean;
}

export interface InstitutionalContextInstitutionOption {
  id: string;
  name: string;
  active: boolean;
}

export interface InstitutionalContextUnitOption {
  id: string;
  name: string;
  institutionId: string | null;
}

export interface InstitutionalContextCourseOption {
  id: string;
  name: string;
  institutionId: string | null;
  unitIds: string[];
}

export interface InstitutionalContextProfileOption {
  code: ContextProfileCode;
  name: string;
}

export interface InstitutionalContextsFilters {
  institutionId: string;
  unitId: string;
  courseId: string;
  contextProfile: string;
}

export interface InstitutionalContextsPageInput {
  institutionId?: string | null;
  unitId?: string | null;
  courseId?: string | null;
  contextProfile?: string | null;
}

export interface InstitutionalDiagnosticAlert {
  key:
    | "active_users_without_context"
    | "users_with_multiple_contexts_without_default"
    | "units_without_institution"
    | "semesters_without_offer"
    | "classes_without_offer"
    | "students_without_offer"
    | "evaluations_without_model"
    | "documents_without_requirement";
  title: string;
  description: string;
  count: number;
  tone: "default" | "alert" | "positive";
  sampleItems: string[];
}

export interface InstitutionalContextsPageData {
  summary: InstitutionalContextSummary;
  structureEntries: InstitutionalStructureEntry[];
  userContextEntries: InstitutionalUserContextEntry[];
  masterCourseEntries: InstitutionalMasterCourseEntry[];
  alerts: InstitutionalDiagnosticAlert[];
  institutions: InstitutionalContextInstitutionOption[];
  units: InstitutionalContextUnitOption[];
  courses: InstitutionalContextCourseOption[];
  contextProfiles: InstitutionalContextProfileOption[];
  filters: InstitutionalContextsFilters;
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

function resolveContextProfileCode(profileCode: string | null | undefined): ContextProfileCode | null {
  if (!profileCode) {
    return null;
  }

  return profileCode in contextRoleLabels ? (profileCode as ContextProfileCode) : null;
}

function buildDiagnosticAlert(input: {
  key: InstitutionalDiagnosticAlert["key"];
  title: string;
  description: string;
  count: number;
  sampleItems: string[];
}) {
  return {
    ...input,
    tone: input.count > 0 ? "alert" : "positive"
  } satisfies InstitutionalDiagnosticAlert;
}

export async function getInstitutionalContextsPageData(
  input: InstitutionalContextsPageInput = {}
): Promise<InstitutionalContextsPageData> {
  const supabase = createSupabaseAdminClient();

  const [
    institutionsResult,
    unitsResult,
    coursesResult,
    offersResult,
    usersResult,
    profilesResult,
    userContextsResult,
    semestersResult,
    classesResult,
    studentsResult,
    evaluationsResult,
    documentsResult
  ] = await Promise.all([
    supabase.from("instituicoes").select("*").order("nome", { ascending: true }),
    supabase.from("unidades").select("*").order("nome", { ascending: true }),
    supabase.from("cursos").select("*").order("nome", { ascending: true }),
    supabase
      .from("ofertas_curso_unidade")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase.from("usuarios").select("*").order("nome_completo", { ascending: true }),
    supabase.from("perfis").select("*"),
    supabase
      .from("usuarios_papeis_contexto")
      .select("*")
      .order("usuario_id", { ascending: true })
      .order("principal", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase.from("semestres").select("*").order("codigo", { ascending: true }),
    supabase.from("turmas").select("*").order("codigo", { ascending: true }),
    supabase.from("alunos").select("*").order("matricula", { ascending: true }),
    supabase.from("avaliacoes").select("id, oferta_curso_unidade_id, modelo_avaliacao_curso_id, referencia"),
    supabase
      .from("documentos_aluno")
      .select("id, aluno_id, tipo, oferta_curso_unidade_id, documento_obrigatorio_curso_id")
  ]);

  if (institutionsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as instituições.",
        institutionsResult.error
      )
    );
  }

  if (unitsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar as unidades.", unitsResult.error)
    );
  }

  if (coursesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar os cursos.", coursesResult.error)
    );
  }

  if (offersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar as ofertas de curso por unidade.",
        offersResult.error
      )
    );
  }

  if (usersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar os usuários.", usersResult.error)
    );
  }

  if (profilesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar os perfis.", profilesResult.error)
    );
  }

  if (userContextsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os contextos de usuários.",
        userContextsResult.error
      )
    );
  }

  if (semestersResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar os semestres.", semestersResult.error)
    );
  }

  if (classesResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar as turmas.", classesResult.error)
    );
  }

  if (studentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar os alunos.", studentsResult.error)
    );
  }

  if (evaluationsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage("Não foi possível carregar as avaliações.", evaluationsResult.error)
    );
  }

  if (documentsResult.error) {
    throw new Error(
      formatSupabaseErrorMessage(
        "Não foi possível carregar os documentos dos alunos.",
        documentsResult.error
      )
    );
  }

  const institutionRows = (institutionsResult.data ?? []) as InstitutionRow[];
  const unitRows = (unitsResult.data ?? []) as UnitRow[];
  const courseRows = (coursesResult.data ?? []) as CourseRow[];
  const offerRows = (offersResult.data ?? []) as OfferRow[];
  const userRows = (usersResult.data ?? []) as UserRow[];
  const profileRows = (profilesResult.data ?? []) as ProfileRow[];
  const userContextRows = (userContextsResult.data ?? []) as UserContextRow[];
  const semesterRows = (semestersResult.data ?? []) as SemesterRow[];
  const classRows = (classesResult.data ?? []) as ClassRow[];
  const studentRows = (studentsResult.data ?? []) as StudentRow[];
  const evaluationRows = (evaluationsResult.data ?? []) as Pick<
    EvaluationRow,
    "id" | "oferta_curso_unidade_id" | "modelo_avaliacao_curso_id" | "referencia"
  >[];
  const documentRows = (documentsResult.data ?? []) as Pick<
    StudentDocumentRow,
    "id" | "aluno_id" | "tipo" | "oferta_curso_unidade_id" | "documento_obrigatorio_curso_id"
  >[];

  const institutionsById = buildMapById(institutionRows);
  const unitsById = buildMapById(unitRows);
  const coursesById = buildMapById(courseRows);
  const offersById = buildMapById(offerRows);
  const usersById = buildMapById(userRows);
  const profilesById = new Map(profileRows.map((profileRow) => [profileRow.id, profileRow]));
  const semestersById = buildMapById(semesterRows);
  const contextsByUserId = new Map<string, UserContextRow[]>();

  for (const contextRow of userContextRows) {
    const currentRows = contextsByUserId.get(contextRow.usuario_id) ?? [];
    currentRows.push(contextRow);
    contextsByUserId.set(contextRow.usuario_id, currentRows);
  }

  const institutions = institutionRows
    .map((institutionRow) => ({
      id: institutionRow.id,
      name: institutionRow.nome,
      active: institutionRow.ativo
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const units = unitRows
    .map((unitRow) => ({
      id: unitRow.id,
      name: unitRow.nome,
      institutionId: unitRow.instituicao_id ?? null
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const unitIdsByCourseId = new Map<string, string[]>();

  for (const offerRow of offerRows) {
    const currentUnitIds = unitIdsByCourseId.get(offerRow.curso_id) ?? [];

    if (!currentUnitIds.includes(offerRow.unidade_id)) {
      currentUnitIds.push(offerRow.unidade_id);
      unitIdsByCourseId.set(offerRow.curso_id, currentUnitIds);
    }
  }

  const courses = courseRows
    .map((courseRow) => ({
      id: courseRow.id,
      name: courseRow.nome,
      institutionId: courseRow.instituicao_id ?? null,
      unitIds: [...(unitIdsByCourseId.get(courseRow.id) ?? [])].sort((left, right) => {
        const leftUnitName = unitsById.get(left)?.nome ?? "";
        const rightUnitName = unitsById.get(right)?.nome ?? "";
        return leftUnitName.localeCompare(rightUnitName, "pt-BR");
      })
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const requestedInstitutionId = input.institutionId?.trim() ?? "";
  const requestedUnitId = input.unitId?.trim() ?? "";
  const requestedCourseId = input.courseId?.trim() ?? "";
  const requestedContextProfile = input.contextProfile?.trim() ?? "";

  const validInstitutionId = institutionsById.has(requestedInstitutionId)
    ? requestedInstitutionId
    : "";
  const requestedUnitRow = requestedUnitId ? unitsById.get(requestedUnitId) ?? null : null;
  const validUnitId =
    requestedUnitRow &&
    (!validInstitutionId || requestedUnitRow.instituicao_id === validInstitutionId)
      ? requestedUnitId
      : "";
  const requestedCourseRow = requestedCourseId ? coursesById.get(requestedCourseId) ?? null : null;
  const validCourseId =
    requestedCourseRow &&
    (!validInstitutionId || requestedCourseRow.instituicao_id === validInstitutionId) &&
    (!validUnitId ||
      offerRows.some(
        (offerRow) => offerRow.curso_id === requestedCourseId && offerRow.unidade_id === validUnitId
      ))
      ? requestedCourseId
      : "";

  const structureEntries = unitRows
    .flatMap<InstitutionalStructureEntry>((unitRow) => {
      const offerRowsForUnit = offerRows.filter((offerRow) => offerRow.unidade_id === unitRow.id);
      const institution = unitRow.instituicao_id
        ? institutionsById.get(unitRow.instituicao_id) ?? null
        : null;

      if (!offerRowsForUnit.length) {
        return [
          {
            institutionId: institution?.id ?? null,
            institutionName: institution?.nome ?? "Instituição não vinculada",
            unitId: unitRow.id,
            unitName: unitRow.nome,
            courseId: null,
            courseName: null,
            offerId: null,
            offerName: null,
            isActive: unitRow.ativo,
            statusLabel: "Sem oferta"
          }
        ];
      }

      return offerRowsForUnit.map((offerRow) => {
        const courseRow = coursesById.get(offerRow.curso_id) ?? null;
        const offerInstitution = institutionsById.get(offerRow.instituicao_id) ?? institution ?? null;

        return {
          institutionId: offerInstitution?.id ?? null,
          institutionName: offerInstitution?.nome ?? "Instituição não vinculada",
          unitId: unitRow.id,
          unitName: unitRow.nome,
          courseId: courseRow?.id ?? null,
          courseName: courseRow?.nome ?? null,
          offerId: offerRow.id,
          offerName:
            offerRow.nome_exibicao ??
            (courseRow ? `${courseRow.nome} - ${unitRow.nome}` : "Oferta sem nome"),
          isActive: offerRow.ativo,
          statusLabel: offerRow.ativo ? "Ativa" : "Inativa"
        };
      });
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

      return (left.offerName ?? left.courseName ?? "").localeCompare(
        right.offerName ?? right.courseName ?? "",
        "pt-BR"
      );
    });

  const userContextEntries: InstitutionalUserContextEntry[] = userContextRows
    .map((contextRow) => {
      const userRow = usersById.get(contextRow.usuario_id) ?? null;
      const contextProfileRow = profilesById.get(contextRow.perfil_id) ?? null;
      const contextProfileCode = resolveContextProfileCode(contextProfileRow?.codigo);

      if (!userRow || !contextProfileRow || !contextProfileCode) {
        return null;
      }

      const legacyProfileRow = profilesById.get(userRow.perfil_id) ?? null;
      const legacyProfileCode = resolveContextProfileCode(legacyProfileRow?.codigo);
      const offerRow = contextRow.oferta_curso_unidade_id
        ? offersById.get(contextRow.oferta_curso_unidade_id) ?? null
        : null;
      const unitRow = offerRow?.unidade_id
        ? unitsById.get(offerRow.unidade_id) ?? null
        : userRow.unidade_id
          ? unitsById.get(userRow.unidade_id) ?? null
          : null;
      const courseId = contextRow.curso_id ?? offerRow?.curso_id ?? null;
      const courseRow = courseId ? coursesById.get(courseId) ?? null : null;
      const institutionId =
        contextRow.instituicao_id ??
        offerRow?.instituicao_id ??
        courseRow?.instituicao_id ??
        unitRow?.instituicao_id ??
        null;
      const institutionRow = institutionId
        ? institutionsById.get(institutionId) ?? null
        : null;

      return {
        userId: userRow.id,
        userName: userRow.nome_completo,
        userEmail: userRow.email,
        userActive: userRow.ativo,
        legacyProfileCode,
        legacyProfileName:
          (legacyProfileCode ? contextRoleLabels[legacyProfileCode] : null) ??
          legacyProfileRow?.nome ??
          "Perfil não identificado",
        legacyUnitId: userRow.unidade_id,
        legacyUnitName: userRow.unidade_id
          ? (unitsById.get(userRow.unidade_id)?.nome ?? null)
          : null,
        contextId: contextRow.id,
        contextProfileCode,
        contextProfileName: getContextRoleDisplayName(
          contextProfileCode,
          contextProfileRow.nome
        ),
        institutionId,
        institutionName: institutionRow?.nome ?? null,
        courseId,
        courseName: courseRow?.nome ?? null,
        offerId: contextRow.oferta_curso_unidade_id,
        offerName:
          offerRow?.nome_exibicao ??
          (courseRow && unitRow ? `${courseRow.nome} - ${unitRow.nome}` : null),
        unitId: offerRow?.unidade_id ?? null,
        unitName: offerRow?.unidade_id ? (unitsById.get(offerRow.unidade_id)?.nome ?? null) : null,
        principal: contextRow.principal,
        ativo: contextRow.ativo,
        isDefaultContext: userRow.contexto_padrao_id === contextRow.id
      } satisfies InstitutionalUserContextEntry;
    })
    .filter((entry): entry is InstitutionalUserContextEntry => entry !== null)
    .sort((left, right) => {
      const nameComparison = left.userName.localeCompare(right.userName, "pt-BR");

      if (nameComparison !== 0) {
        return nameComparison;
      }

      if (left.principal !== right.principal) {
        return left.principal ? -1 : 1;
      }

      return left.contextProfileName.localeCompare(right.contextProfileName, "pt-BR");
    });

  const masterCourseEntries: InstitutionalMasterCourseEntry[] = userContextEntries
    .filter((entry) => entry.contextProfileCode === "master_curso")
    .map((entry) => ({
      userId: entry.userId,
      userName: entry.userName,
      userEmail: entry.userEmail,
      institutionId: entry.institutionId,
      institutionName: entry.institutionName,
      courseId: entry.courseId,
      courseName: entry.courseName,
      principal: entry.principal,
      ativo: entry.ativo
    }));

  const contextProfiles = [
    ...new Map(
      userContextEntries.map((entry) => [entry.contextProfileCode, entry.contextProfileName])
    ).entries()
  ]
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const validContextProfile = contextProfiles.some(
    (profileOption) => profileOption.code === requestedContextProfile
  )
    ? requestedContextProfile
    : "";

  const usersWithContext = new Set(userContextRows.map((contextRow) => contextRow.usuario_id));
  const activeUsersWithoutContext = userRows.filter(
    (userRow) => userRow.ativo && !usersWithContext.has(userRow.id)
  );
  const activeContextsGroupedByUser = [...contextsByUserId.entries()]
    .map(([userId, rows]) => ({
      userId,
      activeContexts: rows.filter((row) => row.ativo),
      hasDefaultContext: (usersById.get(userId)?.contexto_padrao_id ?? null) !== null
    }))
    .filter((group) => group.activeContexts.length > 1);

  const alerts: InstitutionalDiagnosticAlert[] = [
    buildDiagnosticAlert({
      key: "active_users_without_context",
      title: "Usuários ativos sem contexto novo",
      description:
        "Acessos que continuam dependentes apenas do perfil e da unidade legados.",
      count: activeUsersWithoutContext.length,
      sampleItems: activeUsersWithoutContext.slice(0, 6).map((userRow) => {
        const profileCode = resolveContextProfileCode(profilesById.get(userRow.perfil_id)?.codigo);
        const legacyUnitName = userRow.unidade_id
          ? (unitsById.get(userRow.unidade_id)?.nome ?? "Unidade não identificada")
          : "Sem unidade";

        return `${userRow.nome_completo} · ${profileCode ? contextRoleLabels[profileCode] : "Perfil não identificado"} · ${legacyUnitName}`;
      })
    }),
    buildDiagnosticAlert({
      key: "users_with_multiple_contexts_without_default",
      title: "Múltiplos contextos sem contexto padrão",
      description:
        "Usuários com mais de um contexto ativo e sem definição explícita do contexto principal da sessão.",
      count: activeContextsGroupedByUser.filter((group) => !group.hasDefaultContext).length,
      sampleItems: activeContextsGroupedByUser
        .filter((group) => !group.hasDefaultContext)
        .slice(0, 6)
        .map((group) => {
          const userRow = usersById.get(group.userId);
          return `${userRow?.nome_completo ?? "Usuário não identificado"} · ${group.activeContexts.length} contexto(s) ativo(s)`;
        })
    }),
    buildDiagnosticAlert({
      key: "units_without_institution",
      title: "Unidades sem instituição",
      description: "Campi ou unidades que ainda não foram vinculados à camada institucional.",
      count: unitRows.filter((unitRow) => !unitRow.instituicao_id).length,
      sampleItems: unitRows
        .filter((unitRow) => !unitRow.instituicao_id)
        .slice(0, 6)
        .map((unitRow) => unitRow.nome)
    }),
    buildDiagnosticAlert({
      key: "semesters_without_offer",
      title: "Semestres sem oferta de curso",
      description:
        "Períodos letivos ainda sem vínculo explícito com uma oferta de curso/unidade.",
      count: semesterRows.filter((semesterRow) => !semesterRow.oferta_curso_unidade_id).length,
      sampleItems: semesterRows
        .filter((semesterRow) => !semesterRow.oferta_curso_unidade_id)
        .slice(0, 6)
        .map((semesterRow) => {
          const unitName = semesterRow.unidade_id
            ? (unitsById.get(semesterRow.unidade_id)?.nome ?? "Unidade não identificada")
            : "Sem unidade";
          return `${semesterRow.codigo} · ${unitName}`;
        })
    }),
    buildDiagnosticAlert({
      key: "classes_without_offer",
      title: "Turmas sem oferta de curso",
      description:
        "Turmas que ainda não herdaram a oferta vinculada ao semestre ou precisam de ajuste manual.",
      count: classRows.filter((classRow) => !classRow.oferta_curso_unidade_id).length,
      sampleItems: classRows
        .filter((classRow) => !classRow.oferta_curso_unidade_id)
        .slice(0, 6)
        .map((classRow) => {
          const semesterCode = semestersById.get(classRow.semestre_id)?.codigo ?? "Sem semestre";
          return `${classRow.codigo} · ${semesterCode}`;
        })
    }),
    buildDiagnosticAlert({
      key: "students_without_offer",
      title: "Alunos sem oferta de curso",
      description:
        "Cadastros de aluno que ainda dependem apenas do curso textual legado ou da unidade.",
      count: studentRows.filter((studentRow) => !studentRow.oferta_curso_unidade_id).length,
      sampleItems: studentRows
        .filter((studentRow) => !studentRow.oferta_curso_unidade_id)
        .slice(0, 6)
        .map((studentRow) => {
          const studentName =
            usersById.get(studentRow.usuario_id)?.nome_completo ?? "Aluno não identificado";
          return `${studentName} · ${studentRow.matricula}`;
        })
    }),
    buildDiagnosticAlert({
      key: "evaluations_without_model",
      title: "Avaliações sem modelo configurável",
      description:
        "Lançamentos acadêmicos que ainda não apontam para um modelo de avaliação por curso.",
      count: evaluationRows.filter((evaluationRow) => !evaluationRow.modelo_avaliacao_curso_id).length,
      sampleItems: evaluationRows
        .filter((evaluationRow) => !evaluationRow.modelo_avaliacao_curso_id)
        .slice(0, 6)
        .map((evaluationRow) => {
          const offerName = evaluationRow.oferta_curso_unidade_id
            ? (offersById.get(evaluationRow.oferta_curso_unidade_id)?.nome_exibicao ??
              "Oferta não identificada")
            : "Sem oferta";
          return `${evaluationRow.referencia} · ${offerName}`;
        })
    }),
    buildDiagnosticAlert({
      key: "documents_without_requirement",
      title: "Documentos sem exigência de curso",
      description:
        "Arquivos de alunos que ainda não foram vinculados a um documento obrigatório configurável do curso.",
      count: documentRows.filter((documentRow) => !documentRow.documento_obrigatorio_curso_id).length,
      sampleItems: documentRows
        .filter((documentRow) => !documentRow.documento_obrigatorio_curso_id)
        .slice(0, 6)
        .map((documentRow) => {
          const studentName =
            usersById.get(documentRow.aluno_id)?.nome_completo ?? "Aluno não identificado";
          return `${studentName} · ${documentRow.tipo}`;
        })
    })
  ];

  return {
    summary: {
      totalInstitutions: institutionRows.length,
      totalUnits: unitRows.length,
      totalCourses: courseRows.length,
      totalOffers: offerRows.length,
      totalUsersWithContext: usersWithContext.size,
      totalUsersWithoutContext: userRows.filter((userRow) => !usersWithContext.has(userRow.id)).length,
      totalUsersWithMultipleContexts: activeContextsGroupedByUser.length,
      totalUsersWithDefaultContext: userRows.filter((userRow) => !!userRow.contexto_padrao_id).length,
      totalMasterCourseUsers: new Set(masterCourseEntries.map((entry) => entry.userId)).size
    },
    structureEntries,
    userContextEntries,
    masterCourseEntries,
    alerts,
    institutions,
    units,
    courses,
    contextProfiles,
    filters: {
      institutionId: validInstitutionId,
      unitId: validUnitId,
      courseId: validCourseId,
      contextProfile: validContextProfile
    }
  };
}
