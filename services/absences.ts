import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type AbsenceRow = Database["public"]["Tables"]["ausencias"]["Row"];

export interface AbsenceStudentOption {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  registration: string;
  className: string;
  semesterCode: string;
  label: string;
}

export type AbsenceFormMode = "create" | "edit";

export interface AbsenceFormInitialValues {
  absenceId: string;
  matriculaTurmaId: string;
  date: string;
  hours: string;
  justified: boolean;
  reason: string;
  observations: string;
}

export interface ProfessorAbsenceListItem {
  id: string;
  studentName: string;
  registration: string;
  className: string;
  semesterCode: string;
  date: string;
  hours: number;
  justified: boolean;
  reason: string | null;
  observations: string | null;
}

export interface AbsenceFormPageData {
  professor: {
    id: string;
    name: string;
    email: string;
  };
  studentOptions: AbsenceStudentOption[];
  mode: AbsenceFormMode;
  initialValues?: AbsenceFormInitialValues;
}

export interface AbsenceManagementPageData extends AbsenceFormPageData {
  absences: ProfessorAbsenceListItem[];
}

export interface AbsenceManagementLoadResult {
  pageData: AbsenceManagementPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface AbsenceEditorLoadResult {
  formData: AbsenceFormPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

interface EmptyState {
  title: string;
  description: string;
}

interface ProfessorAbsenceContext {
  professor: AbsenceFormPageData["professor"];
  studentOptions: AbsenceStudentOption[];
  studentOptionMap: Map<string, AbsenceStudentOption>;
}

function buildManagementEmptyState(
  title: string,
  description: string
): AbsenceManagementLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function buildEditorEmptyState(
  title: string,
  description: string
): AbsenceEditorLoadResult {
  return {
    formData: null,
    emptyState: {
      title,
      description
    }
  };
}

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function filterSemestersToCurrentUnit(
  semesters: SemesterRow[],
  currentUser: SessionUser
) {
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

function filterActiveStudentUsers(studentUsers: UserRow[]) {
  return studentUsers.filter((studentUser) => studentUser.ativo);
}

function filterEnrollmentsToStudentIds(
  enrollments: EnrollmentRow[],
  studentIds: Set<string>
) {
  return enrollments.filter((enrollment) => studentIds.has(enrollment.aluno_id));
}

async function loadProfessorAbsenceContext(
  currentUser: SessionUser
): Promise<{
  context: ProfessorAbsenceContext | null;
  emptyState: EmptyState | null;
}> {
  if (currentUser.role !== "professor") {
    return {
      context: null,
      emptyState: {
        title: "Fluxo disponível apenas para professores",
        description:
          "Nesta versão, apenas professores com vínculo docente podem acessar o lançamento de faltas por esta área."
      }
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: professorRowData, error: professorError } = await supabase
    .from("professores")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar o professor autenticado",
        description:
          "Houve um problema ao consultar o cadastro docente vinculado a esta sessão."
      }
    };
  }

  const professorRow = (professorRowData ?? null) as ProfessorRow | null;

  if (!professorRow) {
    return {
      context: null,
      emptyState: {
        title: "Cadastro docente ainda não disponível",
        description:
          "Seu usuário esta autenticado como professor, mas ainda não existe registro correspondente em public.professores."
      }
    };
  }

  const { data: professorLinksData, error: linksError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("professor_id", currentUser.id)
    .eq("ativo", true);

  if (linksError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar os vínculos do professor",
        description:
          "Houve um problema ao consultar os alunos vinculados ao professor autenticado."
      }
    };
  }

  const today = getTodayInSaoPaulo();
  const professorLinks = ((professorLinksData ?? []) as ProfessorLinkRow[]).filter(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!professorLinks.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno vinculado",
        description:
          "Ainda não há alunos vinculados a este professor para lançamento de faltas."
      }
    };
  }

  const enrollmentIds = [
    ...new Set(professorLinks.map((link) => link.matricula_turma_id))
  ];

  const { data: enrollmentRowsData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar as matrículas vinculadas",
        description:
          "Os vínculos foram encontrados, mas as matrículas dos alunos não puderam ser consultadas."
      }
    };
  }

  const enrollmentRows = ((enrollmentRowsData ?? []) as EnrollmentRow[]).filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!enrollmentRows.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhuma matrícula ativa encontrada",
        description:
          "Os vínculos existem, mas não há matrículas ativas disponíveis para este professor."
      }
    };
  }

  const studentIds = [...new Set(enrollmentRows.map((row) => row.aluno_id))];
  const classIds = [...new Set(enrollmentRows.map((row) => row.turma_id))];

  const [studentRowsResult, studentUsersResult, classRowsResult] = await Promise.all([
    supabase.from("alunos").select("*").in("usuario_id", studentIds),
    currentUser.unitId
      ? supabase
          .from("usuarios")
          .select("*")
          .in("id", studentIds)
          .eq("unidade_id", currentUser.unitId)
          .eq("ativo", true)
      : supabase.from("usuarios").select("*").in("id", studentIds).eq("ativo", true),
    supabase.from("turmas").select("*").in("id", classIds)
  ]);

  if (studentRowsResult.error || studentUsersResult.error || classRowsResult.error) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível consolidar os alunos vinculados",
        description:
          "Faltaram dados de aluno, usuário ou turma para montar as opcoes de faltas."
      }
    };
  }

  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterActiveStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[]
  );
  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const semesterIds = [...new Set(classRows.map((row) => row.semestre_id))];

  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await supabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterError) {
    return {
      context: null,
      emptyState: {
        title: "Não foi possível carregar os semestres vinculados",
        description:
          "Faltaram dados de semestre para montar o fluxo de faltas."
      }
    };
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterRowsData ?? []) as SemesterRow[],
    currentUser
  );
  classRows = filterClassesToSemesters(classRows, semesterRows);
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollmentRows = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(enrollmentRows, classRows),
    activeStudentIdSet
  );

  if (!visibleEnrollmentRows.length || !classRows.length || !semesterRows.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno vinculado",
        description:
          "Ainda não há alunos vinculados a este professor para lançamento de faltas."
      }
    };
  }

  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));

  const studentOptions = visibleEnrollmentRows
    .map((enrollment) => {
      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup
        ? semesterMap.get(classGroup.semestre_id)
        : undefined;

      if (!studentRow || !studentUser || !classGroup || !semester) {
        return null;
      }

      const studentName = studentRow.nome_social ?? studentUser.nome_completo;
      const label = `${studentName} · ${studentRow.matricula} · ${classGroup.nome} · ${semester.codigo}`;

      return {
        enrollmentId: enrollment.id,
        studentId: studentUser.id,
        studentName,
        registration: studentRow.matricula,
        className: classGroup.nome,
        semesterCode: semester.codigo,
        label
      } satisfies AbsenceStudentOption;
    })
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as AbsenceStudentOption[];

  if (!studentOptions.length) {
    return {
      context: null,
      emptyState: {
        title: "Nenhum aluno apto para lançamento",
        description:
          "Os vínculos existem, mas faltam dados de aluno, turma ou semestre para montar as opcoes de faltas."
      }
    };
  }

  return {
    context: {
      professor: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      studentOptions,
      studentOptionMap: new Map(
        studentOptions.map((studentOption) => [
          studentOption.enrollmentId,
          studentOption
        ])
      )
    },
    emptyState: null
  };
}

export async function getProfessorAbsenceManagementPageData(
  currentUser: SessionUser
): Promise<AbsenceManagementLoadResult> {
  const { context, emptyState } = await loadProfessorAbsenceContext(currentUser);

  if (!context || emptyState) {
    return buildManagementEmptyState(
      emptyState?.title ?? "Fluxo de faltas indisponível",
      emptyState?.description ??
        "Não foi possível montar a gestao de faltas deste professor."
    );
  }

  const supabase = await createSupabaseServerClient();
  const enrollmentIds = context.studentOptions.map((student) => student.enrollmentId);
  const { data: absenceRowsData, error: absenceError } = await supabase
    .from("ausencias")
    .select("*")
    .in("matricula_turma_id", enrollmentIds)
    .order("data_ausencia", { ascending: false })
    .order("created_at", { ascending: false });

  if (absenceError) {
    return buildManagementEmptyState(
      "Não foi possível carregar as faltas registradas",
      "Os alunos vinculados foram encontrados, mas as faltas não puderam ser consultadas."
    );
  }

  const absences = ((absenceRowsData ?? []) as AbsenceRow[])
    .map((absence) => {
      const studentOption = context.studentOptionMap.get(absence.matricula_turma_id);

      if (!studentOption) {
        return null;
      }

      return {
        id: absence.id,
        studentName: studentOption.studentName,
        registration: studentOption.registration,
        className: studentOption.className,
        semesterCode: studentOption.semesterCode,
        date: absence.data_ausencia,
        hours: Number(absence.horas),
        justified: absence.justificada,
        reason: absence.motivo,
        observations: absence.observacoes
      } satisfies ProfessorAbsenceListItem;
    })
    .filter(Boolean) as ProfessorAbsenceListItem[];

  return {
    pageData: {
      professor: context.professor,
      studentOptions: context.studentOptions,
      mode: "create",
      absences
    },
    emptyState: null
  };
}

export async function getAbsenceEditorPageData(
  currentUser: SessionUser,
  absenceId: string
): Promise<AbsenceEditorLoadResult> {
  const { context, emptyState } = await loadProfessorAbsenceContext(currentUser);

  if (!context || emptyState) {
    return buildEditorEmptyState(
      emptyState?.title ?? "Falta indisponível",
      emptyState?.description ??
        "Não foi possível carregar os dados necessarios para revisar esta falta."
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: absenceRowData, error: absenceError } = await supabase
    .from("ausencias")
    .select("*")
    .eq("id", absenceId)
    .maybeSingle();

  if (absenceError || !absenceRowData) {
    return buildEditorEmptyState(
      "Falta não encontrada",
      "Não encontramos uma falta visivel para este professor com o identificador informado."
    );
  }

  const absenceRow = absenceRowData as AbsenceRow;
  const studentOption = context.studentOptionMap.get(absenceRow.matricula_turma_id);

  if (!studentOption) {
    return buildEditorEmptyState(
      "Falta sem vínculo disponível",
      "A falta foi encontrada, mas os dados atuais da matrícula do aluno não estão disponíveis para esta sessão."
    );
  }

  return {
    formData: {
      professor: context.professor,
      studentOptions: context.studentOptions,
      mode: "edit",
      initialValues: {
        absenceId: absenceRow.id,
        matriculaTurmaId: absenceRow.matricula_turma_id,
        date: absenceRow.data_ausencia,
        hours: String(Number(absenceRow.horas)),
        justified: absenceRow.justificada,
        reason: absenceRow.motivo ?? "",
        observations: absenceRow.observacoes ?? ""
      }
    },
    emptyState: null
  };
}



