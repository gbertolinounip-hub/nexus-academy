import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveLaunchIdentity } from "@/lib/utils/format";
import { loadScopedOperationalGraph } from "@/lib/auth/data-scope";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import {
  buildProfessorStudentSummary,
  buildStudentDashboardFromRows
} from "@/services/dashboard";
import type { Database } from "@/types/database";
import type {
  ProfessorStudentSummary,
  SessionUser,
  StudentDashboardData
} from "@/types/domain";

type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type EvaluationRow = Database["public"]["Tables"]["avaliacoes"]["Row"];
type EvaluationItemRow = Database["public"]["Tables"]["itens_avaliados"]["Row"];
type CriterionRow = Database["public"]["Tables"]["criterios_avaliacao"]["Row"];
type AbsenceRow = Database["public"]["Tables"]["ausencias"]["Row"];
type SupabaseReadClient = SupabaseClient<Database>;
type ReportViewerRole = "coordenador" | "professor" | "coordenador_master";

interface ReportEmptyState {
  title: string;
  description: string;
}

interface ReportsFilterOption {
  value: string;
  label: string;
}

interface ReportScope {
  role: ReportViewerRole;
  description: string;
  accessibleEnrollmentIds: Set<string> | null;
  scopedGraph: Awaited<ReturnType<typeof loadScopedOperationalGraph>> | null;
  usesCourseManagerScope: boolean;
  isGlobalMaster: boolean;
}

interface StudentSemesterAssignmentSummary {
  enrollmentId: string;
  classId: string;
  classCode: string;
  className: string;
  areaName: string;
  blockName: string;
  supervisors: string[];
}

interface StudentSemesterRollup {
  studentId: string;
  studentName: string;
  registration: string;
  email: string;
  cellphone?: string | null;
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  areaCount: number;
  areaNames: string[];
  blockNames: string[];
  supervisorNames: string[];
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  finalGradeOutOfTen: number;
  completionRate: number;
  status: ProfessorStudentSummary["status"];
  assignments: StudentSemesterAssignmentSummary[];
  reportContext: "consolidado" | "area";
  reportEnrollmentId: string | null;
  reportAreaName: string | null;
  reportBlockName: string | null;
  reportClassCode: string | null;
  reportClassName: string | null;
}

interface HubClassReportSummary {
  classId: string;
  classCode: string;
  className: string;
  semesterId: string;
  semesterCode: string;
  areaName: string;
  blockName: string;
  studentCount: number;
  averageFinalPercentage: number;
  totalPublishedEvaluations: number;
  totalUnjustifiedAbsenceHours: number;
  studentsAtRisk: number;
  professorNames: string[];
}

interface HubAreaSummary {
  areaId: string;
  areaName: string;
  blockId: number | null;
  blockName: string;
  studentCount: number;
  averageFinalPercentage: number;
  totalPublishedEvaluations: number;
  totalUnjustifiedAbsenceHours: number;
}

interface HubBlockSummary {
  blockId: number | null;
  blockName: string;
  areaCount: number;
  studentCount: number;
  averageFinalPercentage: number;
}

export interface ReportsHubData {
  viewerRole: ReportViewerRole;
  viewerName: string;
  viewerDescription: string;
  semesters: ReportsFilterOption[];
  selectedSemester: {
    id: string;
    code: string;
    name: string;
  };
  summary: {
    totalStudents: number;
    totalClasses: number;
    totalAreas: number;
    totalProfessors: number;
    totalPublishedEvaluations: number;
    totalUnjustifiedAbsenceHours: number;
  };
  blockSummaries: HubBlockSummary[];
  areaSummaries: HubAreaSummary[];
  classReports: HubClassReportSummary[];
  studentReports: StudentSemesterRollup[];
  priorityStudents: StudentSemesterRollup[];
}

export interface ReportsPageLoadResult {
  reports: ReportsHubData | null;
  emptyState: ReportEmptyState | null;
}

interface StudentFinalAreaReport {
  enrollmentId: string;
  classId: string;
  classCode: string;
  className: string;
  areaName: string;
  blockName: string;
  supervisors: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  finalGradeOutOfTen: number;
  completionRate: number;
  status: ProfessorStudentSummary["status"];
  groups: StudentDashboardData["groups"];
  progress: StudentDashboardData["progress"];
  absences: StudentDashboardData["absences"];
  launchHistory: Array<{
    id: string;
    reference: string;
    isLegacyRecord: boolean;
    launchType: EvaluationRow["tipo_lancamento"];
    publishedAt: string;
    notes: string | null;
    itemCount: number;
  }>;
}

export interface StudentFinalReportData {
  viewerRole: ReportViewerRole;
  viewerDescription: string;
  reportContext: {
    kind: "consolidado" | "area";
    enrollmentId: string | null;
    areaName: string | null;
    blockName: string | null;
    classCode: string | null;
    className: string | null;
  };
  student: {
    id: string;
    name: string;
    registration: string;
    cellphone?: string | null;
    email: string;
  };
  availableSemesters: Array<
    ReportsFilterOption & {
      enrollmentId?: string | null;
    }
  >;
  selectedSemester: {
    id: string;
    code: string;
    name: string;
  };
  summary: {
    subtotalPercentage: number;
    absencePenaltyPercentage: number;
    finalPercentage: number;
    finalGradeOutOfTen: number;
    completionRate: number;
    status: ProfessorStudentSummary["status"];
    statusSummary: string;
  };
  assignments: StudentSemesterAssignmentSummary[];
  areaReports: StudentFinalAreaReport[];
  absences: StudentDashboardData["absences"];
  totalPublishedEvaluations: number;
  totalRevisionLaunches: number;
  totalJustifiedAbsenceHours: number;
  totalUnjustifiedAbsenceHours: number;
}

export interface StudentFinalReportLoadResult {
  report: StudentFinalReportData | null;
  emptyState: ReportEmptyState | null;
}

export interface ClassFinalReportData {
  viewerRole: ReportViewerRole;
  viewerDescription: string;
  classGroup: {
    id: string;
    code: string;
    name: string;
    semesterCode: string;
    semesterName: string;
    areaName: string;
    blockName: string;
  };
  summary: {
    totalStudents: number;
    averageFinalPercentage: number;
    totalPublishedEvaluations: number;
    totalUnjustifiedAbsenceHours: number;
    studentsAtRisk: number;
    completionAverage: number;
    panorama: string;
  };
  supervisors: Array<{
    id: string;
    name: string;
    email: string;
    linkedStudents: number;
  }>;
  students: Array<
    ProfessorStudentSummary & {
      studentId: string;
      semesterId: string;
      semesterCode: string;
      areaName: string;
      blockName: string;
    }
  >;
}

export interface ClassFinalReportLoadResult {
  report: ClassFinalReportData | null;
  emptyState: ReportEmptyState | null;
}

interface AcademicBundle {
  enrollments: EnrollmentRow[];
  classes: ClassRow[];
  semesters: SemesterRow[];
  areas: AreaRow[];
  blocks: BlockRow[];
  studentRows: StudentRow[];
  studentUsers: UserRow[];
  professorLinks: ProfessorLinkRow[];
  professorUsers: UserRow[];
  evaluations: EvaluationRow[];
  evaluationItems: EvaluationItemRow[];
  absences: AbsenceRow[];
  dashboardsByEnrollmentId: Map<string, StudentDashboardData>;
  summariesByEnrollmentId: Map<string, ProfessorStudentSummary>;
  classById: Map<string, ClassRow>;
  semesterById: Map<string, SemesterRow>;
  areaById: Map<string, AreaRow>;
  blockById: Map<number, BlockRow>;
  studentById: Map<string, StudentRow>;
  studentUserById: Map<string, UserRow>;
  professorUserById: Map<string, UserRow>;
  linksByEnrollmentId: Map<string, ProfessorLinkRow[]>;
  evaluationsByEnrollmentId: Map<string, EvaluationRow[]>;
  absencesByEnrollmentId: Map<string, AbsenceRow[]>;
  evaluationItemsByEvaluationId: Map<string, EvaluationItemRow[]>;
}

interface AcademicBundleOptions {
  includeInactiveStudents?: boolean;
}

interface ClassFinalReportOptions {
  semesterId?: string | null;
  includeHistoricalStudents?: boolean;
}

interface StudentFinalReportOptions {
  includeHistoricalStudents?: boolean;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sortSemesters(semesters: SemesterRow[]) {
  return [...semesters].sort((left, right) => {
    const statusWeight = (semester: SemesterRow) =>
      semester.status === "ativo" ? 2 : semester.status === "planejado" ? 1 : 0;

    const statusDifference = statusWeight(right) - statusWeight(left);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return (
      new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime()
    );
  });
}

function selectSemester(
  semesters: SemesterRow[],
  requestedSemesterId?: string | null
) {
  if (!semesters.length) {
    return null;
  }

  if (requestedSemesterId) {
    const requestedSemester = semesters.find(
      (semester) => semester.id === requestedSemesterId
    );

    if (requestedSemester) {
      return requestedSemester;
    }
  }

  return sortSemesters(semesters)[0];
}

function statusWeight(status: ProfessorStudentSummary["status"]) {
  return status === "critico" ? 2 : status === "atencao" ? 1 : 0;
}

function aggregateStatus(statuses: ProfessorStudentSummary["status"][]) {
  if (statuses.some((status) => status === "critico")) {
    return "critico" as const;
  }

  if (statuses.some((status) => status === "atencao")) {
    return "atencao" as const;
  }

  return "bem" as const;
}

function statusLabel(status: ProfessorStudentSummary["status"]) {
  switch (status) {
    case "critico":
      return "Crítico";
    case "atencao":
      return "Em atenção";
    default:
      return "Bom andamento";
  }
}

function fallbackAreaName(classGroup: ClassRow, areaMap: Map<string, AreaRow>) {
  if (classGroup.area_estagio_id) {
    return areaMap.get(classGroup.area_estagio_id)?.nome ?? classGroup.area_estagio;
  }

  return classGroup.area_estagio;
}

function fallbackBlockName(classGroup: ClassRow, areaMap: Map<string, AreaRow>, blockMap: Map<number, BlockRow>) {
  if (classGroup.area_estagio_id) {
    const área = areaMap.get(classGroup.area_estagio_id);
    const block = área ? blockMap.get(área.bloco_id) : null;
    return block?.nome ?? "Bloco não identificado";
  }

  return "Bloco não identificado";
}

function buildReportsEmptyState(
  title: string,
  description: string
): ReportsPageLoadResult {
  return {
    reports: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildCoordinatorUnitRequiredEmptyState(): ReportEmptyState {
  return {
    title: "Unidade operacional não identificada",
    description:
      "O coordenador autenticado precisa estar vinculado a uma unidade para acessar os relatórios."
  };
}

function buildCourseManagerInsufficientDataEmptyState(): ReportEmptyState {
  return {
    title: "Ainda não há dados acadêmicos suficientes para consolidar os relatórios finais deste curso.",
    description:
      "Assim que houver semestres, turmas, alunos e lançamentos avaliativos nas ofertas deste curso, os relatórios finais serão exibidos."
  };
}

function buildCoordinatorReportEmptyState(
  scope: ReportScope,
  title: string,
  description: string
): ReportEmptyState {
  return scope.usesCourseManagerScope
    ? buildCourseManagerInsufficientDataEmptyState()
    : {
        title,
        description
      };
}

function buildStudentReportEmptyState(
  title: string,
  description: string
): StudentFinalReportLoadResult {
  return {
    report: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildClassReportEmptyState(
  title: string,
  description: string
): ClassFinalReportLoadResult {
  return {
    report: null,
    emptyState: {
      title,
      description
    }
  };
}

function filterSemestersToCurrentUnit(
  semesters: SemesterRow[],
  currentUser: SessionUser
) {
  if (getActiveMasterCourseContext(currentUser)) {
    return semesters;
  }

  if (!currentUser.unitId) {
    return semesters;
  }

  return semesters.filter((semester) => semester.unidade_id === currentUser.unitId);
}

function filterClassesToSemesters(classRows: ClassRow[], semesters: SemesterRow[]) {
  const visibleSemesterIds = new Set(semesters.map((semester) => semester.id));
  return classRows.filter((classGroup) => visibleSemesterIds.has(classGroup.semestre_id));
}

function filterEnrollmentsToClasses(enrollments: EnrollmentRow[], classRows: ClassRow[]) {
  const visibleClassIds = new Set(classRows.map((classGroup) => classGroup.id));
  return enrollments.filter((enrollment) => visibleClassIds.has(enrollment.turma_id));
}

function filterVisibleStudentUsers(
  studentUsers: UserRow[],
  includeInactiveStudents = false
) {
  return includeInactiveStudents
    ? studentUsers
    : studentUsers.filter((studentUser) => studentUser.ativo);
}

function filterEnrollmentsToStudentIds(
  enrollments: EnrollmentRow[],
  studentIds: Set<string>
) {
  return enrollments.filter((enrollment) => studentIds.has(enrollment.aluno_id));
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function isCoordinatorLikeViewer(role: ReportViewerRole) {
  return role !== "professor";
}

async function resolveReportScope(
  currentUser: SessionUser
): Promise<{ scope: ReportScope | null; emptyState: ReportEmptyState | null }> {
  if (currentUser.role === "coordenador_master") {
    return {
      scope: {
        role: "coordenador_master",
        description: "Visão institucional global do Master para leitura histórica e relatórios preservados.",
        accessibleEnrollmentIds: null,
        scopedGraph: null,
        usesCourseManagerScope: false,
        isGlobalMaster: true
      },
      emptyState: null
    };
  }

  if (currentUser.role === "coordenador") {
    const activeCourseManagerContext = getActiveMasterCourseContext(currentUser);
    const usesCourseManagerScope = Boolean(activeCourseManagerContext);

    if (!usesCourseManagerScope && !currentUser.unitId) {
      return {
        scope: null,
        emptyState: buildCoordinatorUnitRequiredEmptyState()
      };
    }

    const supabase = await createSupabaseServerClient();
    const scopedGraph = await loadScopedOperationalGraph(currentUser, {
      supabase
    });

    if (
      usesCourseManagerScope &&
      (scopedGraph.scope.scopeKind === "none" ||
        scopedGraph.scope.offerIds.length === 0 ||
        scopedGraph.scope.unitIds.length === 0)
    ) {
      return {
        scope: null,
        emptyState: buildCourseManagerInsufficientDataEmptyState()
      };
    }

    const courseName =
      activeCourseManagerContext?.cursoNome ?? currentUser.cursoNome ?? "curso";

    return {
      scope: {
        role: "coordenador",
        description: usesCourseManagerScope
          ? `Visão consolidada de ${courseName}, restrita a ${scopedGraph.scope.offerIds.length} oferta(s) em ${scopedGraph.scope.unitIds.length} unidade(s) da IES atual.`
          : "Visão da coordenação restrita à unidade e ao semestre selecionados.",
        accessibleEnrollmentIds: null,
        scopedGraph,
        usesCourseManagerScope,
        isGlobalMaster: false
      },
      emptyState: null
    };
  }

  if (currentUser.role !== "professor") {
    return {
      scope: null,
      emptyState: {
        title: "Relatórios indisponíveis para este perfil",
        description:
          "Esta área final de relatórios está disponível apenas para coordenação e supervisores."
      }
    };
  }

  const supabase = await createSupabaseServerClient();
  const today = getTodayInSaoPaulo();
  const { data: professorLinksData, error: professorLinksError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("professor_id", currentUser.id)
    .eq("ativo", true)
    .or(`data_fim.is.null,data_fim.gte.${today}`);

  if (professorLinksError) {
    return {
      scope: null,
      emptyState: {
        title: "Não foi possível carregar seus relatorios finais",
        description:
          "Houve um problema ao consultar os vínculos acadêmicos deste supervisor."
      }
    };
  }

  const professorLinks = (professorLinksData ?? []) as ProfessorLinkRow[];

  if (!professorLinks.length) {
    return {
      scope: null,
      emptyState: {
        title: "Nenhum vínculo encontrado para relatorios",
        description:
          "Este supervisor ainda não possui alunos ou áreas vinculadas para compor relatórios finais."
      }
    };
  }

    return {
      scope: {
        role: "professor",
        description: "Escopo restrito aos alunos, áreas e turmas sob sua supervisão.",
        accessibleEnrollmentIds: new Set(
          professorLinks.map((link) => link.matricula_turma_id)
        ),
        scopedGraph: null,
        usesCourseManagerScope: false,
        isGlobalMaster: false
      },
      emptyState: null
    };
}

async function loadClassesForEnrollments(
  enrollmentRows: EnrollmentRow[],
  client?: SupabaseReadClient
) {
  const supabase = client ?? (await createSupabaseServerClient());
  const classIds = [...new Set(enrollmentRows.map((enrollment) => enrollment.turma_id))];

  if (!classIds.length) {
    return [] as ClassRow[];
  }

  const { data, error } = await supabase.from("turmas").select("*").in("id", classIds);

  if (error) {
    throw new Error("class-load-failed");
  }

  return (data ?? []) as ClassRow[];
}

async function loadSemestersForClasses(
  classRows: ClassRow[],
  client?: SupabaseReadClient
) {
  const supabase = client ?? (await createSupabaseServerClient());
  const semesterIds = [...new Set(classRows.map((classGroup) => classGroup.semestre_id))];

  if (!semesterIds.length) {
    return [] as SemesterRow[];
  }

  const { data, error } = await supabase
    .from("semestres")
    .select("*")
    .in("id", semesterIds);

  if (error) {
    throw new Error("semester-load-failed");
  }

  return (data ?? []) as SemesterRow[];
}

async function loadAcademicBundle(
  enrollments: EnrollmentRow[],
  preloadedClasses?: ClassRow[],
  preloadedSemesters?: SemesterRow[],
  options?: AcademicBundleOptions,
  client?: SupabaseReadClient
): Promise<AcademicBundle> {
  const supabase = client ?? (await createSupabaseServerClient());
  const classes =
    preloadedClasses ??
    (enrollments.length ? await loadClassesForEnrollments(enrollments, supabase) : []);
  const semesters =
    preloadedSemesters ??
    (classes.length ? await loadSemestersForClasses(classes, supabase) : []);
  const classById = new Map(classes.map((classGroup) => [classGroup.id, classGroup]));
  const semesterById = new Map(semesters.map((semester) => [semester.id, semester]));
  const areaIds = [
    ...new Set(classes.map((classGroup) => classGroup.area_estagio_id).filter(Boolean))
  ] as string[];
  const studentIds = [...new Set(enrollments.map((enrollment) => enrollment.aluno_id))];
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);

  const [
    areaRowsResult,
    studentRowsResult,
    studentUsersResult,
    professorLinksResult,
    evaluationRowsResult,
    absenceRowsResult
  ] = await Promise.all([
    areaIds.length
      ? supabase.from("areas_estagio").select("*").in("id", areaIds)
      : Promise.resolve({ data: [], error: null as null }),
    studentIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null as null }),
    studentIds.length
      ? options?.includeInactiveStudents
        ? supabase.from("usuarios").select("*").in("id", studentIds)
        : supabase.from("usuarios").select("*").in("id", studentIds).eq("ativo", true)
      : Promise.resolve({ data: [], error: null as null }),
    enrollmentIds.length
      ? supabase
          .from("vinculos_professor_aluno")
          .select("*")
          .in("matricula_turma_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null as null }),
    enrollmentIds.length
      ? supabase
          .from("avaliacoes")
          .select("*")
          .in("matricula_turma_id", enrollmentIds)
          .eq("status", "publicado")
          .order("avaliado_em", { ascending: true })
      : Promise.resolve({ data: [], error: null as null }),
    enrollmentIds.length
      ? supabase
          .from("ausencias")
          .select("*")
          .in("matricula_turma_id", enrollmentIds)
          .order("data_ausencia", { ascending: true })
      : Promise.resolve({ data: [], error: null as null })
  ]);

  if (
    areaRowsResult.error ||
    studentRowsResult.error ||
    studentUsersResult.error ||
    professorLinksResult.error ||
    evaluationRowsResult.error ||
    absenceRowsResult.error
  ) {
    throw new Error("bundle-load-failed");
  }

  const areas = (areaRowsResult.data ?? []) as AreaRow[];
  const areaById = new Map(areas.map((area) => [area.id, area]));
  const blockIds = [...new Set(areas.map((area) => area.bloco_id))];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterVisibleStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[],
    options?.includeInactiveStudents ?? false
  );
  const visibleStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollments = filterEnrollmentsToStudentIds(
    enrollments,
    visibleStudentIdSet
  );
  const visibleEnrollmentIdSet = new Set(
    visibleEnrollments.map((enrollment) => enrollment.id)
  );
  const professorLinks = ((professorLinksResult.data ?? []) as ProfessorLinkRow[]).filter(
    (link) => visibleEnrollmentIdSet.has(link.matricula_turma_id)
  );
  const professorIds = [...new Set(professorLinks.map((link) => link.professor_id))];
  const evaluations = ((evaluationRowsResult.data ?? []) as EvaluationRow[]).filter(
    (evaluation) => visibleEnrollmentIdSet.has(evaluation.matricula_turma_id)
  );
  const evaluationIds = [...new Set(evaluations.map((evaluation) => evaluation.id))];
  const absences = ((absenceRowsResult.data ?? []) as AbsenceRow[]).filter(
    (absence) => visibleEnrollmentIdSet.has(absence.matricula_turma_id)
  );

  const [blockRowsResult, professorUsersResult, evaluationItemsResult] =
    await Promise.all([
      blockIds.length
        ? supabase.from("blocos_estagio").select("*").in("id", blockIds)
        : Promise.resolve({ data: [], error: null as null }),
      professorIds.length
        ? supabase.from("usuarios").select("*").in("id", professorIds)
        : Promise.resolve({ data: [], error: null as null }),
      evaluationIds.length
        ? supabase
            .from("itens_avaliados")
            .select("*")
            .in("avaliacao_id", evaluationIds)
        : Promise.resolve({ data: [], error: null as null })
    ]);

  if (
    blockRowsResult.error ||
    professorUsersResult.error ||
    evaluationItemsResult.error
  ) {
    throw new Error("bundle-detail-load-failed");
  }

  const evaluationItems = (evaluationItemsResult.data ?? []) as EvaluationItemRow[];
  const criterionIds = [
    ...new Set(evaluationItems.map((item) => item.criterio_id))
  ] as string[];
  const criteriaResult = criterionIds.length
    ? await supabase
        .from("criterios_avaliacao")
        .select("*")
        .in("id", criterionIds)
    : { data: [], error: null as null };

  if (criteriaResult.error) {
    throw new Error("criteria-load-failed");
  }

  const blocks = (blockRowsResult.data ?? []) as BlockRow[];
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const professorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const criterionRows = (criteriaResult.data ?? []) as CriterionRow[];
  const studentById = new Map(studentRows.map((student) => [student.usuario_id, student]));
  const studentUserById = new Map(studentUsers.map((user) => [user.id, user]));
  const professorUserById = new Map(professorUsers.map((user) => [user.id, user]));
  const linksByEnrollmentId = new Map<string, ProfessorLinkRow[]>();
  const evaluationsByEnrollmentId = new Map<string, EvaluationRow[]>();
  const absencesByEnrollmentId = new Map<string, AbsenceRow[]>();
  const evaluationItemsByEvaluationId = new Map<string, EvaluationItemRow[]>();

  for (const link of professorLinks) {
    const currentLinks = linksByEnrollmentId.get(link.matricula_turma_id) ?? [];
    currentLinks.push(link);
    linksByEnrollmentId.set(link.matricula_turma_id, currentLinks);
  }

  for (const evaluation of evaluations) {
    const currentEvaluations =
      evaluationsByEnrollmentId.get(evaluation.matricula_turma_id) ?? [];
    currentEvaluations.push(evaluation);
    evaluationsByEnrollmentId.set(evaluation.matricula_turma_id, currentEvaluations);
  }

  for (const absence of absences) {
    const currentAbsences = absencesByEnrollmentId.get(absence.matricula_turma_id) ?? [];
    currentAbsences.push(absence);
    absencesByEnrollmentId.set(absence.matricula_turma_id, currentAbsences);
  }

  for (const item of evaluationItems) {
    const currentItems = evaluationItemsByEvaluationId.get(item.avaliacao_id) ?? [];
    currentItems.push(item);
    evaluationItemsByEvaluationId.set(item.avaliacao_id, currentItems);
  }

  const dashboardsByEnrollmentId = new Map<string, StudentDashboardData>();
  const summariesByEnrollmentId = new Map<string, ProfessorStudentSummary>();

  for (const enrollment of visibleEnrollments) {
    const classGroup = classById.get(enrollment.turma_id);
    const semester = classGroup ? semesterById.get(classGroup.semestre_id) : undefined;
    const studentRow = studentById.get(enrollment.aluno_id);
    const studentUser = studentUserById.get(enrollment.aluno_id);

    if (!classGroup || !semester || !studentRow || !studentUser) {
      continue;
    }

    const enrollmentProfessorLinks = linksByEnrollmentId.get(enrollment.id) ?? [];
    const linkedProfessorUsers = enrollmentProfessorLinks
      .map((link) => professorUserById.get(link.professor_id))
      .filter(Boolean) as UserRow[];
    const enrollmentEvaluations = evaluationsByEnrollmentId.get(enrollment.id) ?? [];
    const enrollmentEvaluationItems = enrollmentEvaluations.flatMap(
      (evaluation) => evaluationItemsByEvaluationId.get(evaluation.id) ?? []
    );
    const dashboard = buildStudentDashboardFromRows({
      studentUser,
      studentRow,
      enrollment,
      semester,
      classGroup,
      professorLinks: enrollmentProfessorLinks,
      linkedProfessorUsers,
      evaluationRows: enrollmentEvaluations,
      evaluationItemRows: enrollmentEvaluationItems,
      criterionRows,
      absenceRows: absencesByEnrollmentId.get(enrollment.id) ?? []
    });

    dashboardsByEnrollmentId.set(enrollment.id, dashboard);
    summariesByEnrollmentId.set(
      enrollment.id,
      buildProfessorStudentSummary(dashboard)
    );
  }

  return {
    enrollments: visibleEnrollments,
    classes,
    semesters,
    areas,
    blocks,
    studentRows,
    studentUsers,
    professorLinks,
    professorUsers,
    evaluations,
    evaluationItems,
    absences,
    dashboardsByEnrollmentId,
    summariesByEnrollmentId,
    classById,
    semesterById,
    areaById,
    blockById,
    studentById,
    studentUserById,
    professorUserById,
    linksByEnrollmentId,
    evaluationsByEnrollmentId,
    absencesByEnrollmentId,
    evaluationItemsByEvaluationId
  };
}

function buildStudentSemesterRollup(input: {
  studentId: string;
  semester: SemesterRow;
  dashboards: StudentDashboardData[];
  bundle: AcademicBundle;
}): StudentSemesterRollup | null {
  const studentUser = input.bundle.studentUserById.get(input.studentId);
  const studentRow = input.bundle.studentById.get(input.studentId);

  if (!studentUser || !studentRow || !input.dashboards.length) {
    return null;
  }

  const areaNames = new Set<string>();
  const blockNames = new Set<string>();
  const supervisorNames = new Set<string>();
  const assignments = input.dashboards
    .map((dashboard) => {
      const classGroup = input.bundle.classById.get(dashboard.student.classId);

      if (!classGroup) {
        return null;
      }

      const areaName = fallbackAreaName(classGroup, input.bundle.areaById);
      const blockName = fallbackBlockName(
        classGroup,
        input.bundle.areaById,
        input.bundle.blockById
      );
      const supervisors = dashboard.professors.map((professor) => professor.name);

      areaNames.add(areaName);
      blockNames.add(blockName);
      supervisors.forEach((supervisor) => supervisorNames.add(supervisor));

      return {
        enrollmentId: dashboard.student.enrollmentId,
        classId: classGroup.id,
        classCode: classGroup.codigo,
        className: classGroup.nome,
        areaName,
        blockName,
        supervisors
      };
    })
    .filter(Boolean) as StudentSemesterAssignmentSummary[];
  const areaStatuses = input.dashboards.map((dashboard) =>
    buildProfessorStudentSummary(dashboard).status
  );

  return {
    studentId: studentUser.id,
    studentName: studentRow.nome_social ?? studentUser.nome_completo,
    registration: studentRow.matricula,
    email: studentUser.email,
    cellphone: studentRow.celular,
    semesterId: input.semester.id,
    semesterCode: input.semester.codigo,
    semesterName: input.semester.nome,
    areaCount: input.dashboards.length,
    areaNames: [...areaNames],
    blockNames: [...blockNames],
    supervisorNames: [...supervisorNames],
    subtotalPercentage: average(
      input.dashboards.map((dashboard) => dashboard.subtotalPercentage)
    ),
    absencePenaltyPercentage: average(
      input.dashboards.map((dashboard) => dashboard.absencePenaltyPercentage)
    ),
    finalPercentage: average(
      input.dashboards.map((dashboard) => dashboard.finalPercentage)
    ),
    finalGradeOutOfTen: average(
      input.dashboards.map((dashboard) => dashboard.finalGradeOutOfTen)
    ),
    completionRate: average(
      input.dashboards.map((dashboard) => dashboard.completionRate)
    ),
    status: aggregateStatus(areaStatuses),
    assignments,
    reportContext: "consolidado",
    reportEnrollmentId: null,
    reportAreaName: null,
    reportBlockName: null,
    reportClassCode: null,
    reportClassName: null
  };
}

function buildProfessorStudentAreaReportRowsForSemester(
  semester: SemesterRow,
  bundle: AcademicBundle
) {
  return [...bundle.dashboardsByEnrollmentId.entries()]
    .map(([enrollmentId, dashboard]) => {
      const studentUser = bundle.studentUserById.get(dashboard.student.id);
      const studentRow = bundle.studentById.get(dashboard.student.id);
      const classGroup = bundle.classById.get(dashboard.student.classId);

      if (!studentUser || !studentRow || !classGroup) {
        return null;
      }

      const summary = buildProfessorStudentSummary(dashboard);
      const areaName = fallbackAreaName(classGroup, bundle.areaById);
      const blockName = fallbackBlockName(
        classGroup,
        bundle.areaById,
        bundle.blockById
      );
      const supervisors = dashboard.professors.map((professor) => professor.name);

      return {
        studentId: studentUser.id,
        studentName: studentRow.nome_social ?? studentUser.nome_completo,
        registration: studentRow.matricula,
        email: studentUser.email,
        cellphone: studentRow.celular,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        semesterName: semester.nome,
        areaCount: 1,
        areaNames: [areaName],
        blockNames: [blockName],
        supervisorNames: supervisors,
        subtotalPercentage: dashboard.subtotalPercentage,
        absencePenaltyPercentage: dashboard.absencePenaltyPercentage,
        finalPercentage: dashboard.finalPercentage,
        finalGradeOutOfTen: dashboard.finalGradeOutOfTen,
        completionRate: dashboard.completionRate,
        status: summary.status,
        assignments: [
          {
            enrollmentId,
            classId: classGroup.id,
            classCode: classGroup.codigo,
            className: classGroup.nome,
            areaName,
            blockName,
            supervisors
          }
        ],
        reportContext: "area" as const,
        reportEnrollmentId: enrollmentId,
        reportAreaName: areaName,
        reportBlockName: blockName,
        reportClassCode: classGroup.codigo,
        reportClassName: classGroup.nome
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const statusDifference = statusWeight(right!.status) - statusWeight(left!.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      const areaDifference = left!.reportAreaName!.localeCompare(
        right!.reportAreaName!,
        "pt-BR"
      );

      if (areaDifference !== 0) {
        return areaDifference;
      }

      return left!.studentName.localeCompare(right!.studentName, "pt-BR");
    }) as StudentSemesterRollup[];
}

function buildStudentSemesterSummaryText(input: {
  rollup: StudentSemesterRollup;
  viewerRole: ReportViewerRole;
}) {
  const rolePhrase =
    isCoordinatorLikeViewer(input.viewerRole)
      ? "no fechamento semestral"
      : input.rollup.reportContext === "area"
        ? "na área acompanhada por este supervisor"
        : "no escopo acompanhado por este supervisor";

  if (input.rollup.status === "critico") {
    return `O aluno encerra ${rolePhrase} com situação crítica, exigindo acompanhamento próximo por nota, completude ou penalidade de faltas.`;
  }

  if (input.rollup.status === "atencao") {
    return `O aluno encerra ${rolePhrase} em atenção, com pontos que merecem monitoramento antes do fechamento acadêmico.`;
  }

  return `O aluno apresenta bom andamento ${rolePhrase}, com desempenho consolidado e histórico preservado por área.`;
}

function buildClassPanorama(input: {
  averageFinalPercentage: number;
  studentsAtRisk: number;
  totalStudents: number;
  totalUnjustifiedAbsenceHours: number;
}) {
  if (input.totalStudents === 0) {
    return "A turma ainda não possui alunos suficientes para consolidacao final.";
  }

  if (input.studentsAtRisk > 0) {
    return `Há ${input.studentsAtRisk} aluno(s) em atenção ou risco, com ${input.totalUnjustifiedAbsenceHours}h de faltas não justificadas neste semestre.`;
  }

  if (input.averageFinalPercentage >= 80) {
    return "O desempenho medio da turma esta consistente, sem alunos sinalizados como prioritarios no recorte atual.";
  }

  return "A turma apresenta desempenho estavel, mas ainda demanda acompanhamento de media e frequencia para o fechamento final.";
}

function buildClassProfessorList(
  classEnrollments: EnrollmentRow[],
  bundle: AcademicBundle
) {
  const professorCountMap = new Map<string, number>();

  classEnrollments.forEach((enrollment) => {
    const professorIds = new Set(
      (bundle.linksByEnrollmentId.get(enrollment.id) ?? []).map(
        (link) => link.professor_id
      )
    );

    professorIds.forEach((professorId) => {
      professorCountMap.set(
        professorId,
        (professorCountMap.get(professorId) ?? 0) + 1
      );
    });
  });

  return [...professorCountMap.entries()]
    .map(([professorId, linkedStudents]) => {
      const professorUser = bundle.professorUserById.get(professorId);

      if (!professorUser) {
        return null;
      }

      return {
        id: professorId,
        name: professorUser.nome_completo,
        email: professorUser.email,
        linkedStudents
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      left!.name.localeCompare(right!.name, "pt-BR")
    ) as ClassFinalReportData["supervisors"];
}

export async function getAuthenticatedReportsPageData(
  currentUser: SessionUser,
  requestedSemesterId?: string | null
): Promise<ReportsPageLoadResult> {
  const { scope, emptyState } = await resolveReportScope(currentUser);

  if (!scope || emptyState) {
    return buildReportsEmptyState(
      emptyState?.title ?? "Relatórios indisponíveis",
      emptyState?.description ??
        "Não foi possível consolidar o escopo de acesso para os relatorios finais."
    );
  }

  const supabase = await createSupabaseServerClient();
  let semesters: SemesterRow[] = [];
  let classRows: ClassRow[] = [];
  let enrollmentRows: EnrollmentRow[] = [];

  if (scope.role === "coordenador") {
    if (!scope.scopedGraph) {
      const scopedState = buildCoordinatorReportEmptyState(
        scope,
        "Relatórios indisponíveis",
        "Não foi possível consolidar o escopo institucional de relatórios."
      );

      return buildReportsEmptyState(scopedState.title, scopedState.description);
    }

    semesters = sortSemesters(scope.scopedGraph.semesterRows);
    const selectedSemester = selectSemester(semesters, requestedSemesterId);

    if (!selectedSemester) {
      const noSemesterState = buildCoordinatorReportEmptyState(
        scope,
        "Nenhum semestre disponível para relatorios",
        "Ainda não ha semestres cadastrados com dados suficientes para os relatorios finais."
      );

      return buildReportsEmptyState(noSemesterState.title, noSemesterState.description);
    }

    classRows = [...scope.scopedGraph.classRows]
      .filter((classGroup) => classGroup.semestre_id === selectedSemester.id)
      .sort((left, right) => left.nome.localeCompare(right.nome, "pt-BR"));
    const visibleClassIds = new Set(classRows.map((classGroup) => classGroup.id));
    enrollmentRows = scope.scopedGraph.enrollmentRows.filter((enrollment) =>
      visibleClassIds.has(enrollment.turma_id)
    );

    const bundle = await loadAcademicBundle(enrollmentRows, classRows, [selectedSemester]);

    if (!bundle.enrollments.length) {
      const noStudentState = buildCoordinatorReportEmptyState(
        scope,
        "Nenhum aluno ativo disponível para este semestre",
        "Os vínculos do semestre foram encontrados, mas não há alunos ativos disponíveis para compor os relatórios correntes."
      );

      return buildReportsEmptyState(noStudentState.title, noStudentState.description);
    }

    const classIdsWithVisibleStudents = new Set(
      bundle.enrollments.map((enrollment) => enrollment.turma_id)
    );
    classRows = classRows.filter((classGroup) =>
      classIdsWithVisibleStudents.has(classGroup.id)
    );
    return {
      reports: buildReportsHubData({
        scope,
        currentUser,
        selectedSemester,
        semesters,
        classRows,
        bundle
      }),
      emptyState: null
    };
  }

  const accessibleEnrollmentIds = [...(scope.accessibleEnrollmentIds ?? new Set())];

  const enrollmentRowsResult = accessibleEnrollmentIds.length
    ? await supabase
        .from("matriculas_turma")
        .select("*")
        .in("id", accessibleEnrollmentIds)
    : { data: [], error: null as null };

  if (enrollmentRowsResult.error) {
    return buildReportsEmptyState(
      "Não foi possível carregar as matrículas vinculadas",
      "Houve um problema ao consultar os alunos e áreas acompanhados por este supervisor."
    );
  }

  enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];

  if (!enrollmentRows.length) {
    return buildReportsEmptyState(
      "Nenhum vínculo disponível para relatorios",
      "Este supervisor não possui matrículas acessíveis para consolidação final."
    );
  }

  classRows = await loadClassesForEnrollments(enrollmentRows);
  semesters = sortSemesters(
    filterSemestersToCurrentUnit(await loadSemestersForClasses(classRows), currentUser)
  );
  classRows = filterClassesToSemesters(classRows, semesters);
  enrollmentRows = filterEnrollmentsToClasses(enrollmentRows, classRows);
  const selectedSemester = selectSemester(semesters, requestedSemesterId);

  if (!selectedSemester) {
    return buildReportsEmptyState(
      "Nenhum semestre disponível para este supervisor",
      "Ainda não há semestres associados aos vínculos acadêmicos deste supervisor."
    );
  }

  classRows = classRows.filter((classGroup) => classGroup.semestre_id === selectedSemester.id);
  const visibleClassIds = new Set(classRows.map((classGroup) => classGroup.id));
  enrollmentRows = enrollmentRows.filter((enrollment) =>
    visibleClassIds.has(enrollment.turma_id)
  );

  const bundle = await loadAcademicBundle(enrollmentRows, classRows, [selectedSemester]);

  if (!bundle.enrollments.length) {
    return buildReportsEmptyState(
      "Nenhum aluno ativo disponível para este supervisor",
      "Os vínculos acadêmicos existem, mas não há alunos ativos disponíveis na operação corrente deste supervisor."
    );
  }

  const activeStudentClassIds = new Set(
    bundle.enrollments.map((enrollment) => enrollment.turma_id)
  );
  classRows = classRows.filter((classGroup) => activeStudentClassIds.has(classGroup.id));
  return {
    reports: buildReportsHubData({
      scope,
      currentUser,
      selectedSemester,
      semesters,
      classRows,
      bundle
    }),
    emptyState: null
  };
}

function buildReportsHubData(input: {
  scope: ReportScope;
  currentUser: SessionUser;
  selectedSemester: SemesterRow;
  semesters: SemesterRow[];
  classRows: ClassRow[];
  bundle: AcademicBundle;
}): ReportsHubData {
  const areaSummaries = buildAreaSummaries(input.classRows, input.bundle);
  const classReports = buildHubClassReports(input.classRows, input.selectedSemester, input.bundle);
  const studentReports =
    input.scope.role === "professor"
      ? buildProfessorStudentAreaReportRowsForSemester(
          input.selectedSemester,
          input.bundle
        )
      : buildStudentReportsForSemester(input.selectedSemester, input.bundle);
  const priorityStudents = [...studentReports]
    .filter((student) => student.status !== "bem")
    .sort((left, right) => {
      const statusDifference = statusWeight(right.status) - statusWeight(left.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return left.finalPercentage - right.finalPercentage;
    });

  return {
    viewerRole: input.scope.role,
    viewerName: input.currentUser.name,
    viewerDescription: input.scope.description,
    semesters: input.semesters.map((semester) => ({
      value: semester.id,
      label: `${semester.codigo} - ${semester.nome}`
    })),
    selectedSemester: {
      id: input.selectedSemester.id,
      code: input.selectedSemester.codigo,
      name: input.selectedSemester.nome
    },
    summary: {
      totalStudents: new Set(
        input.bundle.enrollments.map((enrollment) => enrollment.aluno_id)
      ).size,
      totalClasses: input.classRows.length,
      totalAreas: new Set(
        input.classRows
          .map((classGroup) => classGroup.area_estagio_id ?? classGroup.area_estagio)
          .filter(Boolean)
      ).size,
      totalProfessors: new Set(
        input.bundle.professorLinks.map((link) => link.professor_id)
      ).size,
      totalPublishedEvaluations: input.bundle.evaluations.length,
      totalUnjustifiedAbsenceHours: round(
        input.bundle.absences
          .filter((absence) => !absence.justificada)
          .reduce((sum, absence) => sum + numberValue(absence.horas), 0)
      )
    },
    blockSummaries: buildBlockSummaries(input.classRows, input.bundle, areaSummaries),
    areaSummaries,
    classReports,
    studentReports,
    priorityStudents
  };
}

function buildAreaSummaries(classRows: ClassRow[], bundle: AcademicBundle) {
  const classIdsByArea = new Map<string, string[]>();

  classRows.forEach((classGroup) => {
    const areaKey = classGroup.area_estagio_id ?? classGroup.area_estagio;
    const currentClassIds = classIdsByArea.get(areaKey) ?? [];
    currentClassIds.push(classGroup.id);
    classIdsByArea.set(areaKey, currentClassIds);
  });

  return [...classIdsByArea.entries()]
    .map(([areaKey, classIds]) => {
      const areaReferenceClass = classRows.find(
        (classGroup) =>
          (classGroup.area_estagio_id ?? classGroup.area_estagio) === areaKey
      );

      if (!areaReferenceClass) {
        return null;
      }

      const relevantEnrollments = bundle.enrollments.filter((enrollment) =>
        classIds.includes(enrollment.turma_id)
      );
      const dashboards = relevantEnrollments
        .map((enrollment) => bundle.dashboardsByEnrollmentId.get(enrollment.id))
        .filter(Boolean) as StudentDashboardData[];
      const relevantEvaluations = bundle.evaluations.filter((evaluation) =>
        relevantEnrollments.some(
          (enrollment) => enrollment.id === evaluation.matricula_turma_id
        )
      );
      const relevantAbsences = bundle.absences.filter((absence) =>
        relevantEnrollments.some(
          (enrollment) => enrollment.id === absence.matricula_turma_id
        )
      );
      const areaName = fallbackAreaName(areaReferenceClass, bundle.areaById);
      const areaRow = areaReferenceClass.area_estagio_id
        ? bundle.areaById.get(areaReferenceClass.area_estagio_id)
        : null;
      const blockRow = areaRow ? bundle.blockById.get(areaRow.bloco_id) : null;

      return {
        areaId: areaRow?.id ?? areaKey,
        areaName,
        blockId: areaRow?.bloco_id ?? null,
        blockName: blockRow?.nome ?? "Bloco não identificado",
        studentCount: new Set(
          relevantEnrollments.map((enrollment) => enrollment.aluno_id)
        ).size,
        averageFinalPercentage: average(
          dashboards.map((dashboard) => dashboard.finalPercentage)
        ),
        totalPublishedEvaluations: relevantEvaluations.length,
        totalUnjustifiedAbsenceHours: round(
          relevantAbsences
            .filter((absence) => !absence.justificada)
            .reduce((sum, absence) => sum + numberValue(absence.horas), 0)
        )
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const blockNameDifference = left!.blockName.localeCompare(
        right!.blockName,
        "pt-BR"
      );

      if (blockNameDifference !== 0) {
        return blockNameDifference;
      }

      return left!.areaName.localeCompare(right!.areaName, "pt-BR");
    }) as HubAreaSummary[];
}

function buildBlockSummaries(
  classRows: ClassRow[],
  bundle: AcademicBundle,
  areaSummaries: HubAreaSummary[]
) {
  const areaSummariesByBlockId = new Map<number | null, HubAreaSummary[]>();
  const classIdsByBlockId = new Map<number | null, string[]>();
  const blockNameById = new Map<number | null, string>();

  areaSummaries.forEach((areaSummary) => {
    const currentAreas = areaSummariesByBlockId.get(areaSummary.blockId) ?? [];
    currentAreas.push(areaSummary);
    areaSummariesByBlockId.set(areaSummary.blockId, currentAreas);

    if (!blockNameById.has(areaSummary.blockId)) {
      blockNameById.set(areaSummary.blockId, areaSummary.blockName);
    }
  });

  classRows.forEach((classGroup) => {
    const blockId = classGroup.area_estagio_id
      ? (bundle.areaById.get(classGroup.area_estagio_id)?.bloco_id ?? null)
      : null;
    const currentClassIds = classIdsByBlockId.get(blockId) ?? [];
    currentClassIds.push(classGroup.id);
    classIdsByBlockId.set(blockId, currentClassIds);

    if (!blockNameById.has(blockId)) {
      blockNameById.set(
        blockId,
        fallbackBlockName(classGroup, bundle.areaById, bundle.blockById)
      );
    }
  });

  const blockIds = new Set<number | null>([
    ...areaSummariesByBlockId.keys(),
    ...classIdsByBlockId.keys()
  ]);

  return [...blockIds]
    .map((blockId) => {
      const areas = areaSummariesByBlockId.get(blockId) ?? [];
      const relevantClassIds = new Set(classIdsByBlockId.get(blockId) ?? []);
      const relevantEnrollments = bundle.enrollments.filter((enrollment) =>
        relevantClassIds.has(enrollment.turma_id)
      );
      const dashboards = relevantEnrollments
        .map((enrollment) => bundle.dashboardsByEnrollmentId.get(enrollment.id))
        .filter(Boolean) as StudentDashboardData[];

      return {
        blockId,
        blockName: blockNameById.get(blockId) ?? "Bloco não identificado",
        areaCount: areas.length,
        studentCount: new Set(
          relevantEnrollments.map((enrollment) => enrollment.aluno_id)
        ).size,
        averageFinalPercentage: average(
          dashboards.map((dashboard) => dashboard.finalPercentage)
        )
      };
    })
    .sort((left, right) => left.blockName.localeCompare(right.blockName, "pt-BR"));
}

function buildHubClassReports(
  classRows: ClassRow[],
  semester: SemesterRow,
  bundle: AcademicBundle
) {
  return classRows
    .map((classGroup) => {
      const classEnrollments = bundle.enrollments.filter(
        (enrollment) => enrollment.turma_id === classGroup.id
      );
      const dashboards = classEnrollments
        .map((enrollment) => bundle.dashboardsByEnrollmentId.get(enrollment.id))
        .filter(Boolean) as StudentDashboardData[];
      const professorNames = [...new Set(
        classEnrollments.flatMap(
          (enrollment) =>
            (bundle.linksByEnrollmentId.get(enrollment.id) ?? [])
              .map((link) => bundle.professorUserById.get(link.professor_id)?.nome_completo)
              .filter(Boolean) as string[]
        )
      )].sort((left, right) => left.localeCompare(right, "pt-BR"));
      const summaries = dashboards.map((dashboard) =>
        buildProfessorStudentSummary(dashboard)
      );
      const classEvaluations = bundle.evaluations.filter(
        (evaluation) => evaluation.matricula_turma_id && classEnrollments.some(
          (enrollment) => enrollment.id === evaluation.matricula_turma_id
        )
      );
      const classAbsences = bundle.absences.filter((absence) =>
        classEnrollments.some((enrollment) => enrollment.id === absence.matricula_turma_id)
      );

      return {
        classId: classGroup.id,
        classCode: classGroup.codigo,
        className: classGroup.nome,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        areaName: fallbackAreaName(classGroup, bundle.areaById),
        blockName: fallbackBlockName(classGroup, bundle.areaById, bundle.blockById),
        studentCount: new Set(classEnrollments.map((enrollment) => enrollment.aluno_id)).size,
        averageFinalPercentage: average(
          dashboards.map((dashboard) => dashboard.finalPercentage)
        ),
        totalPublishedEvaluations: classEvaluations.length,
        totalUnjustifiedAbsenceHours: round(
          classAbsences
            .filter((absence) => !absence.justificada)
            .reduce((sum, absence) => sum + numberValue(absence.horas), 0)
        ),
        studentsAtRisk: summaries.filter((summary) => summary.status !== "bem").length,
        professorNames
      };
    })
    .sort((left, right) => {
      const areaDifference = left.areaName.localeCompare(right.areaName, "pt-BR");

      if (areaDifference !== 0) {
        return areaDifference;
      }

      return left.className.localeCompare(right.className, "pt-BR");
    });
}

function buildStudentReportsForSemester(semester: SemesterRow, bundle: AcademicBundle) {
  const dashboardsByStudentId = new Map<string, StudentDashboardData[]>();

  bundle.dashboardsByEnrollmentId.forEach((dashboard) => {
    const currentDashboards = dashboardsByStudentId.get(dashboard.student.id) ?? [];
    currentDashboards.push(dashboard);
    dashboardsByStudentId.set(dashboard.student.id, currentDashboards);
  });

  return [...dashboardsByStudentId.entries()]
    .map(([studentId, dashboards]) =>
      buildStudentSemesterRollup({
        studentId,
        semester,
        dashboards,
        bundle
      })
    )
    .filter(Boolean)
    .sort((left, right) => {
      const statusDifference = statusWeight(right!.status) - statusWeight(left!.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return left!.studentName.localeCompare(right!.studentName, "pt-BR");
    }) as StudentSemesterRollup[];
}

export async function getAuthenticatedStudentFinalReport(
  currentUser: SessionUser,
  studentId: string,
  requestedSemesterId?: string | null,
  requestedEnrollmentId?: string | null,
  options?: StudentFinalReportOptions
): Promise<StudentFinalReportLoadResult> {
  const { scope, emptyState } = await resolveReportScope(currentUser);

  if (!scope || emptyState) {
    return buildStudentReportEmptyState(
      emptyState?.title ?? "Relatório indisponível",
      emptyState?.description ??
        "Não foi possível consolidar o escopo de acesso ao relatorio final do aluno."
    );
  }

  const supabase =
    currentUser.role === "coordenador_master"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let enrollmentRows: EnrollmentRow[] = [];
  let allAccessibleEnrollments: EnrollmentRow[] = [];
  let classRows: ClassRow[] = [];

  if (scope.role === "coordenador") {
    if (!scope.scopedGraph) {
      return buildStudentReportEmptyState(
        "Relatório indisponível",
        "Não foi possível consolidar o escopo institucional deste aluno."
      );
    }

    enrollmentRows = scope.scopedGraph.enrollmentRows.filter(
      (enrollment) => enrollment.aluno_id === studentId
    );
    allAccessibleEnrollments = [...enrollmentRows];
    const visibleClassIds = new Set(enrollmentRows.map((enrollment) => enrollment.turma_id));
    classRows = scope.scopedGraph.classRows.filter((classGroup) =>
      visibleClassIds.has(classGroup.id)
    );
  } else if (scope.role === "coordenador_master") {
    const enrollmentRowsResult = await supabase
      .from("matriculas_turma")
      .select("*")
      .eq("aluno_id", studentId);

    if (enrollmentRowsResult.error) {
      return buildStudentReportEmptyState(
        "Não foi possível carregar os vínculos do aluno",
        "Houve um problema ao consultar as matrículas históricas deste aluno para a visão institucional."
      );
    }

    enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
    allAccessibleEnrollments = [...enrollmentRows];
    classRows = await loadClassesForEnrollments(enrollmentRows, supabase);
  } else {
    const enrollmentQuery =
      (scope.accessibleEnrollmentIds?.size ?? 0) > 0
        ? supabase
            .from("matriculas_turma")
            .select("*")
            .eq("aluno_id", studentId)
            .in("id", [...(scope.accessibleEnrollmentIds ?? new Set<string>())])
        : Promise.resolve({ data: [], error: null as null });
    const enrollmentRowsResult = await enrollmentQuery;

    if (enrollmentRowsResult.error) {
      return buildStudentReportEmptyState(
        "Não foi possível carregar os vínculos do aluno",
        "Houve um problema ao consultar as matrículas do aluno para o relatorio final."
      );
    }

    enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
    allAccessibleEnrollments = [...enrollmentRows];
    classRows = await loadClassesForEnrollments(enrollmentRows, supabase);
  }

  if (!enrollmentRows.length) {
    return buildStudentReportEmptyState(
      "Nenhum vínculo encontrado para este aluno",
      "O aluno não possui matrículas acessíveis no escopo deste relatório."
    );
  }

  const classById = new Map(classRows.map((classGroup) => [classGroup.id, classGroup]));
  const preferredSemesterId =
    requestedEnrollmentId
      ? (() => {
          const requestedEnrollment = allAccessibleEnrollments.find(
            (enrollment) => enrollment.id === requestedEnrollmentId
          );

          if (!requestedEnrollment) {
            return null;
          }

          return classById.get(requestedEnrollment.turma_id)?.semestre_id ?? null;
        })()
      : null;
  const semesters =
    scope.role === "coordenador" && scope.scopedGraph
      ? sortSemesters(
          scope.scopedGraph.semesterRows.filter((semester) =>
            classRows.some((classGroup) => classGroup.semestre_id === semester.id)
          )
        )
      : scope.role === "coordenador_master"
        ? sortSemesters(await loadSemestersForClasses(classRows, supabase))
        : sortSemesters(
            filterSemestersToCurrentUnit(
              await loadSemestersForClasses(classRows, supabase),
              currentUser
            )
          );
  const selectedSemester = selectSemester(
    semesters,
    requestedSemesterId ?? preferredSemesterId
  );

  if (!selectedSemester) {
    return buildStudentReportEmptyState(
      "Semestre não disponível para este aluno",
      "Não foi possível determinar o semestre do relatorio final deste aluno."
    );
  }

  const shouldIncludeHistoricalStudents =
    Boolean(options?.includeHistoricalStudents) &&
    currentUser.role !== "professor" &&
    selectedSemester.status === "encerrado";
  const shouldUseAreaScopedHistoricalView =
    shouldIncludeHistoricalStudents && Boolean(requestedEnrollmentId);

  const visibleClassRows = filterClassesToSemesters(classRows, semesters);
  const selectedClassIds = new Set(
    visibleClassRows
      .filter((classGroup) => classGroup.semestre_id === selectedSemester.id)
      .map((classGroup) => classGroup.id)
  );
  enrollmentRows = filterEnrollmentsToClasses(enrollmentRows, visibleClassRows).filter((enrollment) =>
    selectedClassIds.has(enrollment.turma_id)
  );

  if (!enrollmentRows.length) {
    return buildStudentReportEmptyState(
      "Sem dados no semestre selecionado",
      "Este aluno não possui áreas vinculadas no semestre escolhido para composição do relatório."
    );
  }

  if (requestedEnrollmentId) {
    const requestedEnrollment = enrollmentRows.find(
      (enrollment) => enrollment.id === requestedEnrollmentId
    );

    if (!requestedEnrollment) {
      return buildStudentReportEmptyState(
        shouldUseAreaScopedHistoricalView
          ? "Relatório histórico da área não encontrado"
          : "Relatório da área não encontrado",
        shouldUseAreaScopedHistoricalView
          ? "A matrícula/área solicitada não foi localizada no semestre arquivado selecionado."
          : "A matrícula/área solicitada não está acessível para este supervisor no semestre selecionado."
      );
    }

    if (scope.role === "professor" || shouldUseAreaScopedHistoricalView) {
      enrollmentRows = [requestedEnrollment];
    }
  } else if (scope.role === "professor" && enrollmentRows.length > 1) {
      return buildStudentReportEmptyState(
        "Selecione a área do relatório",
        "Este aluno possui mais de uma área no escopo deste supervisor. Abra o relatório a partir da área desejada."
      );
  }

  const selectedClasses = visibleClassRows.filter((classGroup) =>
    selectedClassIds.has(classGroup.id)
  );
  const bundle = await loadAcademicBundle(
    enrollmentRows,
    selectedClasses,
    [selectedSemester],
    {
      includeInactiveStudents: shouldIncludeHistoricalStudents
    },
    supabase
  );

  if (!bundle.enrollments.length) {
    return buildStudentReportEmptyState(
      shouldIncludeHistoricalStudents
        ? "Aluno indisponível no contexto histórico"
        : "Aluno indisponível na operação corrente",
      shouldIncludeHistoricalStudents
        ? "Este aluno não possui vínculo histórico suficiente no semestre arquivado selecionado."
        : "Este aluno não possui vínculo operacional ativo acessível neste contexto de relatório."
    );
  }

  const shouldUseAreaScopedReport =
    (scope.role === "professor" && Boolean(requestedEnrollmentId)) ||
    shouldUseAreaScopedHistoricalView;
  const studentRollup =
    shouldUseAreaScopedReport
      ? buildProfessorStudentAreaReportRowsForSemester(selectedSemester, bundle).find(
          (student) =>
            student.studentId === studentId &&
            student.reportEnrollmentId === enrollmentRows[0]?.id
        )
      : buildStudentReportsForSemester(selectedSemester, bundle).find(
          (student) => student.studentId === studentId
        );

  if (!studentRollup) {
    return buildStudentReportEmptyState(
      "Não foi possível consolidar o relatorio do aluno",
      "Os dados básicos foram encontrados, mas faltou contexto suficiente para montar o fechamento acadêmico."
    );
  }

  const areaReports = enrollmentRows
    .map((enrollment) => {
      const dashboard = bundle.dashboardsByEnrollmentId.get(enrollment.id);
      const classGroup = bundle.classById.get(enrollment.turma_id);

      if (!dashboard || !classGroup) {
        return null;
      }

      const summary = bundle.summariesByEnrollmentId.get(enrollment.id);
      const evaluations = bundle.evaluationsByEnrollmentId.get(enrollment.id) ?? [];
      const evaluationHistory = evaluations.map((evaluation) => {
        const identity = resolveLaunchIdentity({
          launchType: evaluation.tipo_lancamento,
          evaluatedAt: evaluation.avaliado_em,
          reference: evaluation.referencia,
          createdAt: evaluation.created_at
        });

        return {
          id: evaluation.id,
          reference: identity.label,
          isLegacyRecord: identity.isLegacyRecord,
          launchType: evaluation.tipo_lancamento,
          publishedAt:
            identity.effectiveDateValue ?? evaluation.created_at ?? evaluation.avaliado_em,
          notes: evaluation.observacoes,
          itemCount: (
            bundle.evaluationItemsByEvaluationId.get(evaluation.id) ?? []
          ).length
        };
      });

      return {
        enrollmentId: enrollment.id,
        classId: classGroup.id,
        classCode: classGroup.codigo,
        className: classGroup.nome,
        areaName: fallbackAreaName(classGroup, bundle.areaById),
        blockName: fallbackBlockName(classGroup, bundle.areaById, bundle.blockById),
        supervisors: dashboard.professors.map((professor) => ({
          id: professor.id,
          name: professor.name,
          email: professor.email
        })),
        subtotalPercentage: dashboard.subtotalPercentage,
        absencePenaltyPercentage: dashboard.absencePenaltyPercentage,
        finalPercentage: dashboard.finalPercentage,
        finalGradeOutOfTen: dashboard.finalGradeOutOfTen,
        completionRate: dashboard.completionRate,
        status: summary?.status ?? "bem",
        groups: dashboard.groups,
        progress: dashboard.progress,
        absences: dashboard.absences,
        launchHistory: evaluationHistory
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const blockDifference = left!.blockName.localeCompare(right!.blockName, "pt-BR");

      if (blockDifference !== 0) {
        return blockDifference;
      }

      return left!.areaName.localeCompare(right!.areaName, "pt-BR");
    }) as StudentFinalAreaReport[];
  const allAbsences = areaReports.flatMap((areaReport) => areaReport.absences);
  const semesterEnrollmentOptions = semesters.map((semester) => {
    if (scope.role !== "professor" && !shouldUseAreaScopedHistoricalView) {
      return {
        value: semester.id,
        label: `${semester.codigo} - ${semester.nome}`,
        enrollmentId: null
      };
    }

    const enrollmentForSemester = allAccessibleEnrollments.find((enrollment) => {
      const classGroup = classById.get(enrollment.turma_id);
      return classGroup?.semestre_id === semester.id;
    });

    return {
      value: semester.id,
      label: `${semester.codigo} - ${semester.nome}`,
      enrollmentId:
        semester.id === selectedSemester.id
          ? studentRollup?.reportEnrollmentId ?? enrollmentForSemester?.id ?? null
          : enrollmentForSemester?.id ?? null
    };
  });

  return {
    report: {
      viewerRole: scope.role,
      viewerDescription: scope.description,
      reportContext: {
        kind: studentRollup.reportContext,
        enrollmentId: studentRollup.reportEnrollmentId,
        areaName: studentRollup.reportAreaName,
        blockName: studentRollup.reportBlockName,
        classCode: studentRollup.reportClassCode,
        className: studentRollup.reportClassName
      },
      student: {
        id: studentRollup.studentId,
        name: studentRollup.studentName,
        registration: studentRollup.registration,
        cellphone: studentRollup.cellphone,
        email: studentRollup.email
      },
      availableSemesters: semesterEnrollmentOptions,
      selectedSemester: {
        id: selectedSemester.id,
        code: selectedSemester.codigo,
        name: selectedSemester.nome
      },
      summary: {
        subtotalPercentage: studentRollup.subtotalPercentage,
        absencePenaltyPercentage: studentRollup.absencePenaltyPercentage,
        finalPercentage: studentRollup.finalPercentage,
        finalGradeOutOfTen: studentRollup.finalGradeOutOfTen,
        completionRate: studentRollup.completionRate,
        status: studentRollup.status,
        statusSummary: buildStudentSemesterSummaryText({
          rollup: studentRollup,
          viewerRole: scope.role
        })
      },
      assignments: studentRollup.assignments,
      areaReports,
      absences: [...allAbsences].sort((left, right) => left.date.localeCompare(right.date)),
      totalPublishedEvaluations: bundle.evaluations.length,
      totalRevisionLaunches: bundle.evaluations.filter(
        (evaluation) => evaluation.tipo_lancamento === "revisao"
      ).length,
      totalJustifiedAbsenceHours: round(
        allAbsences
          .filter((absence) => absence.justified)
          .reduce((sum, absence) => sum + absence.hours, 0)
      ),
      totalUnjustifiedAbsenceHours: round(
        allAbsences
          .filter((absence) => !absence.justified)
          .reduce((sum, absence) => sum + absence.hours, 0)
      )
    },
    emptyState: null
  };
}

export async function getAuthenticatedClassFinalReport(
  currentUser: SessionUser,
  classId: string,
  options?: ClassFinalReportOptions
): Promise<ClassFinalReportLoadResult> {
  const { scope, emptyState } = await resolveReportScope(currentUser);

  if (!scope || emptyState) {
    return buildClassReportEmptyState(
      emptyState?.title ?? "Relatório indisponível",
      emptyState?.description ??
        "Não foi possível consolidar o escopo de acesso ao relatorio da turma."
    );
  }

  const supabase =
    currentUser.role === "coordenador_master"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let classGroup: ClassRow | null = null;
  let enrollmentRows: EnrollmentRow[] = [];
  let semesterRows: SemesterRow[] = [];

  if (scope.role === "coordenador") {
    if (!scope.scopedGraph) {
      return buildClassReportEmptyState(
        "Relatório indisponível",
        "Não foi possível consolidar o escopo institucional desta turma."
      );
    }

    classGroup =
      scope.scopedGraph.classRows.find((classEntry) => classEntry.id === classId) ?? null;
    enrollmentRows = scope.scopedGraph.enrollmentRows.filter(
      (enrollment) => enrollment.turma_id === classId
    );
    semesterRows = classGroup
      ? scope.scopedGraph.semesterRows.filter((semester) => semester.id === classGroup?.semestre_id)
      : [];
  } else if (scope.role === "coordenador_master") {
    const { data: classRowData, error: classError } = await supabase
      .from("turmas")
      .select("*")
      .eq("id", classId)
      .maybeSingle();

    if (!classError && classRowData) {
      classGroup = classRowData as ClassRow;
      semesterRows = await loadSemestersForClasses([classGroup], supabase);
    }
  } else {
    const { data: classRowData, error: classError } = await supabase
      .from("turmas")
      .select("*")
      .eq("id", classId)
      .maybeSingle();

    if (!classError && classRowData) {
      classGroup = classRowData as ClassRow;
      semesterRows = await loadSemestersForClasses([classGroup], supabase);
    }
  }

  if (!classGroup) {
    return buildClassReportEmptyState(
      "Turma não encontrada",
      "A turma solicitada não foi encontrada ou não esta acessivel neste contexto."
    );
  }
  const requestedSemesterId = options?.semesterId?.trim() || null;

  if (requestedSemesterId && classGroup.semestre_id !== requestedSemesterId) {
    return buildClassReportEmptyState(
      "Turma fora do semestre solicitado",
      "A turma informada não pertence ao semestre histórico selecionado."
    );
  }

  if (scope.role !== "coordenador") {
    const enrollmentQuery =
      scope.role === "coordenador_master"
        ? supabase.from("matriculas_turma").select("*").eq("turma_id", classId)
        : (scope.accessibleEnrollmentIds?.size ?? 0) > 0
          ? supabase
              .from("matriculas_turma")
              .select("*")
              .eq("turma_id", classId)
              .in("id", [...(scope.accessibleEnrollmentIds ?? new Set<string>())])
          : Promise.resolve({ data: [], error: null as null });
    const enrollmentRowsResult = await enrollmentQuery;

    if (enrollmentRowsResult.error) {
      return buildClassReportEmptyState(
        "Não foi possível carregar as matrículas da turma",
        "Houve um problema ao consultar as matrículas usadas no relatorio final da turma."
      );
    }

    enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  }

  if (!enrollmentRows.length) {
    return buildClassReportEmptyState(
      "Nenhum aluno encontrado no escopo da turma",
      scope.role === "professor"
        ? "Esta turma não possui alunos vinculados a este supervisor no recorte atual."
        : "Esta turma ainda não possui alunos suficientes para o relatorio final."
    );
  }

  const visibleSemesterRows =
    scope.role === "coordenador" || scope.role === "coordenador_master"
      ? semesterRows
      : filterSemestersToCurrentUnit(semesterRows, currentUser);

  if (!visibleSemesterRows.length) {
    return buildClassReportEmptyState(
      "Turma fora do escopo desta unidade",
      "A turma solicitada não pertence à unidade operacional acessível neste contexto."
    );
  }

  const semester =
    visibleSemesterRows.find((row) => row.id === classGroup.semestre_id) ??
    visibleSemesterRows[0];
  const shouldIncludeHistoricalStudents =
    Boolean(options?.includeHistoricalStudents) &&
    currentUser.role !== "professor" &&
    semester?.status === "encerrado" &&
    (!requestedSemesterId || semester.id === requestedSemesterId);

  const bundle = await loadAcademicBundle(
    enrollmentRows,
    [classGroup],
    semesterRows,
    {
      includeInactiveStudents: shouldIncludeHistoricalStudents
    },
    supabase
  );

  if (!bundle.enrollments.length) {
    return buildClassReportEmptyState(
      shouldIncludeHistoricalStudents
        ? "Nenhum aluno arquivado encontrado no escopo da turma"
        : "Nenhum aluno ativo encontrado no escopo da turma",
      shouldIncludeHistoricalStudents
        ? "A turma foi localizada no semestre encerrado, mas não há vínculos históricos suficientes para montar o fechamento arquivado."
        : scope.role === "professor"
          ? "Esta turma não possui alunos ativos vinculados a este supervisor no contexto atual."
          : "Esta turma não possui alunos ativos suficientes para o relatório corrente."
    );
  }
  const areaName = fallbackAreaName(classGroup, bundle.areaById);
  const blockName = fallbackBlockName(classGroup, bundle.areaById, bundle.blockById);
  const students = enrollmentRows
    .map((enrollment) => {
      const summary = bundle.summariesByEnrollmentId.get(enrollment.id);

      if (!summary) {
        return null;
      }

      return {
        ...summary,
        semesterId: semester?.id ?? classGroup.semestre_id,
        semesterCode: semester?.codigo ?? "N/A",
        areaName,
        blockName
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const statusDifference = statusWeight(right!.status) - statusWeight(left!.status);

      if (statusDifference !== 0) {
        return statusDifference;
      }

      return left!.studentName.localeCompare(right!.studentName, "pt-BR");
    }) as ClassFinalReportData["students"];
  const totalUnjustifiedAbsenceHours = round(
    bundle.absences
      .filter((absence) => !absence.justificada)
      .reduce((sum, absence) => sum + numberValue(absence.horas), 0)
  );
  const averageFinalPercentage = average(
    students.map((student) => student.finalPercentage)
  );
  const completionAverage = average(students.map((student) => student.completionRate));
  const studentsAtRisk = students.filter((student) => student.status !== "bem").length;

  return {
    report: {
      viewerRole: scope.role,
      viewerDescription: scope.description,
      classGroup: {
        id: classGroup.id,
        code: classGroup.codigo,
        name: classGroup.nome,
        semesterCode: semester?.codigo ?? "N/A",
        semesterName: semester?.nome ?? "Sem semestre identificado",
        areaName,
        blockName
      },
      summary: {
        totalStudents: students.length,
        averageFinalPercentage,
        totalPublishedEvaluations: bundle.evaluations.length,
        totalUnjustifiedAbsenceHours,
        studentsAtRisk,
        completionAverage,
        panorama: buildClassPanorama({
          averageFinalPercentage,
          studentsAtRisk,
          totalStudents: students.length,
          totalUnjustifiedAbsenceHours
        })
      },
      supervisors: buildClassProfessorList(enrollmentRows, bundle),
      students
    },
    emptyState: null
  };
}




