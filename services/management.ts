import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SessionUser } from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type ProfileRow = Database["public"]["Tables"]["perfis"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type BlockRow = Database["public"]["Tables"]["blocos_estagio"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ProfessorAreaRow = Database["public"]["Tables"]["professor_areas_estagio"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];

export interface ManagementSemesterOption {
  id: string;
  label: string;
  code: string;
  name: string;
  status: SemesterRow["status"];
  startsAt: string;
  endsAt: string;
}

export interface ManagementAreaOption {
  id: string;
  code: string;
  name: string;
  blockId: number;
  blockCode: string;
  blockName: string;
}

export interface ManagementAreaBlock {
  id: number;
  code: string;
  name: string;
  areas: ManagementAreaOption[];
}

export interface ManagementProfessorOption {
  id: string;
  name: string;
  email: string;
  functional: string | null;
  areaIds: string[];
  label: string;
}

export interface ManagementStudentAssignment {
  enrollmentId: string;
  semesterId: string;
  semesterCode: string;
  className: string;
  areaName: string;
  blockName: string;
  supervisorNames: string[];
  supervisorIds: string[];
}

export interface ManagementStudentListItem {
  id: string;
  name: string;
  registration: string;
  cellphone: string | null;
  email: string;
  isActive: boolean;
  assignments: ManagementStudentAssignment[];
}

export interface ManagementProfessorListItem {
  id: string;
  name: string;
  email: string;
  functional: string | null;
  isActive: boolean;
  areas: string[];
}

export interface ManagementSecretaryListItem {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

export interface ManagementPageData {
  coordinator: {
    id: string;
    name: string;
    email: string;
  };
  semesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
  students: ManagementStudentListItem[];
  professors: ManagementProfessorListItem[];
  secretaries: ManagementSecretaryListItem[];
}

export interface ManagementStudentSemesterAssignmentRecord {
  enrollmentId: string;
  areaId: string | null;
  areaName: string;
  blockName: string;
  className: string;
  enrollmentStatus: EnrollmentRow["status"];
  currentSupervisorIds: string[];
  currentSupervisorNames: string[];
  allSupervisorNames: string[];
}

export interface ManagementStudentSemesterRecord {
  semesterId: string;
  semesterCode: string;
  semesterName: string;
  semesterStatus: SemesterRow["status"];
  startsAt: string;
  endsAt: string;
  assignments: ManagementStudentSemesterAssignmentRecord[];
}

export interface StudentManagementDetailData {
  coordinator: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    name: string;
    fullName: string;
    registration: string;
    cellphone: string | null;
    email: string;
    isActive: boolean;
  };
  semesters: ManagementSemesterOption[];
  manageableSemesters: ManagementSemesterOption[];
  areaBlocks: ManagementAreaBlock[];
  professorOptions: ManagementProfessorOption[];
  semesterHistory: ManagementStudentSemesterRecord[];
  defaultManagementSemesterId: string;
}

export interface ManagementPageLoadResult {
  pageData: ManagementPageData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

export interface StudentManagementDetailLoadResult {
  studentData: StudentManagementDetailData | null;
  emptyState: {
    title: string;
    description: string;
  } | null;
}

function buildEmptyState(title: string, description: string): ManagementPageLoadResult {
  return {
    pageData: null,
    emptyState: {
      title,
      description
    }
  };
}

function sortSemesters(semesters: SemesterRow[]) {
  return [...semesters].sort((left, right) => {
    const statusWeight = (semester: SemesterRow) =>
      semester.status === "ativo" ? 2 : semester.status === "planejado" ? 1 : 0;

    const statusDifference = statusWeight(right) - statusWeight(left);

    if (statusDifference !== 0) {
      return statusDifference;
    }

    return new Date(right.data_inicio).getTime() - new Date(left.data_inicio).getTime();
  });
}

function getRequiredManagementUnitId(currentUser: SessionUser) {
  return currentUser.unitId ?? null;
}

export async function getCoordinatorManagementPageData(
  currentUser: SessionUser
): Promise<ManagementPageLoadResult> {
  const currentUnitId = getRequiredManagementUnitId(currentUser);

  if (!currentUnitId) {
    return buildEmptyState(
      "Unidade operacional não identificada",
      "O coordenador autenticado precisa estar vinculado a uma unidade para acessar a gestão acadêmica."
    );
  }

  const supabase = await createSupabaseServerClient();

  const [semesterRowsResult, blockRowsResult, areaRowsResult, profileRowsResult, unitUsersResult] =
    await Promise.all([
    supabase.from("semestres").select("*").eq("unidade_id", currentUnitId),
    supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true }),
    supabase
      .from("areas_estagio")
      .select("*")
      .eq("ativa", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("perfis")
      .select("*")
      .in("codigo", ["aluno", "professor", "secretaria"]),
    supabase.from("usuarios").select("*").eq("unidade_id", currentUnitId)
  ]);

  if (
    semesterRowsResult.error ||
    blockRowsResult.error ||
    areaRowsResult.error ||
    profileRowsResult.error ||
    unitUsersResult.error
  ) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os dados reais de semestres, áreas, alunos, professores ou vínculos."
    );
  }

  const semesterRows = sortSemesters((semesterRowsResult.data ?? []) as SemesterRow[]);
  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const areaRows = (areaRowsResult.data ?? []) as AreaRow[];
  const profileRows = (profileRowsResult.data ?? []) as ProfileRow[];
  const unitUsers = (unitUsersResult.data ?? []) as UserRow[];

  if (!blockRows.length || !areaRows.length) {
    return buildEmptyState(
      "Estrutura academica incompleta",
      "Cadastre semestres e aplique o seed das áreas de estagio para liberar o fluxo de cadastro."
    );
  }

  const profileMap = new Map(profileRows.map((profile) => [profile.codigo, profile.id]));
  const professorUsers = unitUsers.filter(
    (user) => user.perfil_id === profileMap.get("professor")
  );
  const secretaryUsers = unitUsers.filter(
    (user) => user.perfil_id === profileMap.get("secretaria")
  );
  const studentUsers = unitUsers.filter(
    (user) => user.perfil_id === profileMap.get("aluno")
  );
  const professorUserIds = professorUsers.map((user) => user.id);
  const studentUserIds = studentUsers.map((user) => user.id);
  const semesterIds = semesterRows.map((semester) => semester.id);

  const [
    professorRowsResult,
    professorAreaRowsResult,
    studentRowsResult,
    classRowsResult
  ] = await Promise.all([
    professorUserIds.length
      ? supabase.from("professores").select("*").in("usuario_id", professorUserIds)
      : Promise.resolve({ data: [], error: null }),
    professorUserIds.length
      ? supabase
          .from("professor_areas_estagio")
          .select("*")
          .in("professor_id", professorUserIds)
          .eq("ativo", true)
      : Promise.resolve({ data: [], error: null }),
    studentUserIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", studentUserIds)
      : Promise.resolve({ data: [], error: null }),
    semesterIds.length
      ? supabase
          .from("turmas")
          .select("*")
          .in("semestre_id", semesterIds)
          .eq("ativa", true)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    professorRowsResult.error ||
    professorAreaRowsResult.error ||
    studentRowsResult.error ||
    classRowsResult.error
  ) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar professores, alunos ou turmas da unidade."
    );
  }

  const professorRows = (professorRowsResult.data ?? []) as ProfessorRow[];
  const professorAreaRows = (professorAreaRowsResult.data ?? []) as ProfessorAreaRow[];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const classIds = classRows.map((classGroup) => classGroup.id);

  const enrollmentRowsResult = classIds.length
    ? await supabase.from("matriculas_turma").select("*").in("turma_id", classIds)
    : { data: [], error: null };

  if (enrollmentRowsResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar as matrículas da unidade."
    );
  }

  const enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const professorLinksResult = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .eq("ativo", true)
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (professorLinksResult.error) {
    return buildEmptyState(
      "Não foi possível carregar a gestao academica",
      "Houve um problema ao consultar os vínculos de supervisão da unidade."
    );
  }

  const professorLinks = (professorLinksResult.data ?? []) as ProfessorLinkRow[];
  const blockMap = new Map(blockRows.map((block) => [block.id, block]));
  const areaMap = new Map(areaRows.map((área) => [área.id, área]));
  const semesterMap = new Map(semesterRows.map((semester) => [semester.id, semester]));
  const classMap = new Map(classRows.map((classGroup) => [classGroup.id, classGroup]));
  const professorMap = new Map(professorRows.map((professor) => [professor.usuario_id, professor]));
  const professorUserMap = new Map(professorUsers.map((user) => [user.id, user]));
  const studentMap = new Map(studentRows.map((student) => [student.usuario_id, student]));

  const areaBlocks = blockRows.map((block) => ({
    id: block.id,
    code: block.codigo,
    name: block.nome,
    areas: areaRows
      .filter((área) => área.bloco_id === block.id)
      .map((área) => ({
        id: área.id,
        code: área.codigo,
        name: área.nome,
        blockId: block.id,
        blockCode: block.codigo,
        blockName: block.nome
      }))
  }));

  const professorOptions = professorUsers
    .filter((user) => user.ativo)
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areaIds = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => link.area_estagio_id);
      const areaNames = areaIds
        .map((areaId) => areaMap.get(areaId)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        areaIds,
        label: `${user.nome_completo} - ${professor.registro_funcional ?? "Sem funcional"}${areaNames.length ? ` - ${areaNames.join(", ")}` : ""}`
      } satisfies ManagementProfessorOption;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementProfessorOption[];

  const students = studentUsers
    .map((user) => {
      const student = studentMap.get(user.id);

      if (!student) {
        return null;
      }

      const studentAssignments = enrollmentRows
        .filter((enrollment) => enrollment.aluno_id === user.id && enrollment.status === "ativa")
        .map((enrollment) => {
          const classGroup = classMap.get(enrollment.turma_id);

          if (!classGroup) {
            return null;
          }

          const semester = semesterMap.get(classGroup.semestre_id);
          const área = classGroup.area_estagio_id
            ? areaMap.get(classGroup.area_estagio_id)
            : null;
          const block = área ? blockMap.get(área.bloco_id) : null;
          const linkedProfessors = professorLinks
            .filter((link) => link.matricula_turma_id === enrollment.id)
            .sort(
              (left, right) =>
                Number(right.responsavel_principal) - Number(left.responsavel_principal)
            );
          const supervisorNames = linkedProfessors
            .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
            .filter(Boolean) as string[];
          const supervisorIds = linkedProfessors.map((link) => link.professor_id);

          if (!semester) {
            return null;
          }

          return {
            enrollmentId: enrollment.id,
            semesterId: semester.id,
            semesterCode: semester.codigo,
            className: classGroup.nome,
            areaName: área?.nome ?? classGroup.area_estagio,
            blockName: block?.nome ?? "Bloco não identificado",
            supervisorNames,
            supervisorIds
          } satisfies ManagementStudentAssignment;
        })
        .filter(Boolean)
        .sort((left, right) => {
          const semesterDifference = right!.semesterCode.localeCompare(left!.semesterCode);

          if (semesterDifference !== 0) {
            return semesterDifference;
          }

          return left!.areaName.localeCompare(right!.areaName, "pt-BR");
        }) as ManagementStudentAssignment[];

      return {
        id: user.id,
        name: student.nome_social ?? user.nome_completo,
        registration: student.matricula,
        cellphone: student.celular,
        email: user.email,
        isActive: user.ativo,
        assignments: studentAssignments
      } satisfies ManagementStudentListItem;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementStudentListItem[];

  const professors = professorUsers
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areas = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => areaMap.get(link.area_estagio_id)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        isActive: user.ativo,
        areas
      } satisfies ManagementProfessorListItem;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementProfessorListItem[];

  const secretaries = secretaryUsers
    .map((user) => ({
      id: user.id,
      name: user.nome_completo,
      email: user.email,
      isActive: user.ativo
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return {
    pageData: {
      coordinator: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email
      },
      semesters: semesterRows.map((semester) => ({
        id: semester.id,
        code: semester.codigo,
        name: semester.nome,
        status: semester.status,
        startsAt: semester.data_inicio,
        endsAt: semester.data_fim,
        label: `${semester.codigo} - ${semester.nome}`
      })),
      areaBlocks,
      professorOptions,
      students,
      professors,
      secretaries
    },
    emptyState: null
  };
}

export async function getStudentManagementDetailData(
  currentUser: SessionUser,
  studentId: string
): Promise<StudentManagementDetailLoadResult> {
  const currentUnitId = getRequiredManagementUnitId(currentUser);

  if (!currentUnitId) {
    return {
      studentData: null,
      emptyState: {
        title: "Unidade operacional não identificada",
        description:
          "O coordenador autenticado precisa estar vinculado a uma unidade para acessar a gestão do aluno."
      }
    };
  }

  const supabase = await createSupabaseServerClient();

  const [
    semesterRowsResult,
    blockRowsResult,
    areaRowsResult,
    profileRowsResult,
    studentUserResult,
    studentRowResult
  ] = await Promise.all([
    supabase.from("semestres").select("*").eq("unidade_id", currentUnitId),
    supabase.from("blocos_estagio").select("*").order("ordem", { ascending: true }),
    supabase.from("areas_estagio").select("*").order("ordem", { ascending: true }),
    supabase.from("perfis").select("*").in("codigo", ["aluno", "professor"]),
    supabase
      .from("usuarios")
      .select("*")
      .eq("id", studentId)
      .eq("unidade_id", currentUnitId)
      .maybeSingle(),
    supabase.from("alunos").select("*").eq("usuario_id", studentId).maybeSingle()
  ]);

  if (
    semesterRowsResult.error ||
    blockRowsResult.error ||
    areaRowsResult.error ||
    profileRowsResult.error ||
    studentUserResult.error ||
    studentRowResult.error
  ) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar o cadastro permanente e o histórico de estagio deste aluno."
      }
    };
  }

  const studentUser = (studentUserResult.data ?? null) as UserRow | null;
  const studentRow = (studentRowResult.data ?? null) as StudentRow | null;

  if (!studentUser || !studentRow) {
    return {
      studentData: null,
      emptyState: {
        title: "Aluno não encontrado",
        description:
          "O cadastro solicitado não foi localizado nas tabelas de dominio do sistema."
      }
    };
  }

  const semesterRows = sortSemesters((semesterRowsResult.data ?? []) as SemesterRow[]);
  const blockRows = (blockRowsResult.data ?? []) as BlockRow[];
  const areaRows = (areaRowsResult.data ?? []) as AreaRow[];
  const profileRows = (profileRowsResult.data ?? []) as ProfileRow[];
  const profileMap = new Map(profileRows.map((profile) => [profile.codigo, profile.id]));
  const professorProfileId = profileMap.get("professor");
  const semesterIds = semesterRows.map((semester) => semester.id);

  const [unitUsersResult, professorRowsResult, classRowsResult] = await Promise.all([
    supabase.from("usuarios").select("*").eq("unidade_id", currentUnitId),
    professorProfileId
      ? supabase.from("professores").select("*")
      : Promise.resolve({ data: [], error: null }),
    semesterIds.length
      ? supabase.from("turmas").select("*").in("semestre_id", semesterIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (unitUsersResult.error || professorRowsResult.error || classRowsResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar usuários, professores ou turmas da unidade."
      }
    };
  }

  const unitUsers = (unitUsersResult.data ?? []) as UserRow[];
  const professorUsers = unitUsers.filter((user) => user.perfil_id === professorProfileId);
  const professorUserIds = professorUsers.map((user) => user.id);
  const professorRows = ((professorRowsResult.data ?? []) as ProfessorRow[]).filter(
    (professor) => professorUserIds.includes(professor.usuario_id)
  );
  const classRows = (classRowsResult.data ?? []) as ClassRow[];
  const visibleClassIds = new Set(classRows.map((classGroup) => classGroup.id));
  const enrollmentRowsResult = await supabase
    .from("matriculas_turma")
    .select("*")
    .eq("aluno_id", studentId);

  if (enrollmentRowsResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar as matrículas operacionais deste aluno."
      }
    };
  }

  const enrollmentRows = ((enrollmentRowsResult.data ?? []) as EnrollmentRow[]).filter(
    (enrollment) => visibleClassIds.has(enrollment.turma_id)
  );
  const professorAreaRowsResult = professorUserIds.length
    ? await supabase
        .from("professor_areas_estagio")
        .select("*")
        .in("professor_id", professorUserIds)
        .eq("ativo", true)
    : { data: [], error: null };

  if (professorAreaRowsResult.error) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar o aluno",
        description:
          "Houve um problema ao consultar as áreas vinculadas aos supervisores da unidade."
      }
    };
  }

  const professorAreaRows = (professorAreaRowsResult.data ?? []) as ProfessorAreaRow[];

  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const { data: professorLinksData, error: professorLinksError } = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (professorLinksError) {
    return {
      studentData: null,
      emptyState: {
        title: "Não foi possível carregar os supervisores",
        description:
          "O histórico de supervisao do aluno não pode ser consultado neste momento."
      }
    };
  }

  const professorLinks = (professorLinksData ?? []) as ProfessorLinkRow[];
  const blockMap = new Map(blockRows.map((block) => [block.id, block]));
  const areaMap = new Map(areaRows.map((área) => [área.id, área]));
  const semesterMap = new Map(semesterRows.map((semester) => [semester.id, semester]));
  const classMap = new Map(classRows.map((classGroup) => [classGroup.id, classGroup]));
  const professorMap = new Map(professorRows.map((professor) => [professor.usuario_id, professor]));
  const professorUserMap = new Map(professorUsers.map((user) => [user.id, user]));

  const areaBlocks = blockRows.map((block) => ({
    id: block.id,
    code: block.codigo,
    name: block.nome,
    areas: areaRows
      .filter((área) => área.bloco_id === block.id)
      .map((área) => ({
        id: área.id,
        code: área.codigo,
        name: área.nome,
        blockId: block.id,
        blockCode: block.codigo,
        blockName: block.nome
      }))
  }));

  const semesters = semesterRows.map((semester) => ({
    id: semester.id,
    code: semester.codigo,
    name: semester.nome,
    status: semester.status,
    startsAt: semester.data_inicio,
    endsAt: semester.data_fim,
    label: `${semester.codigo} - ${semester.nome}`
  }));

  const manageableSemesters = semesters.filter(
    (semester) => semester.status === "ativo" || semester.status === "planejado"
  );

  const professorOptions = professorUsers
    .filter((user) => user.ativo)
    .map((user) => {
      const professor = professorMap.get(user.id);

      if (!professor) {
        return null;
      }

      const areaIds = professorAreaRows
        .filter((link) => link.professor_id === user.id)
        .map((link) => link.area_estagio_id);
      const areaNames = areaIds
        .map((areaId) => areaMap.get(areaId)?.nome)
        .filter(Boolean) as string[];

      return {
        id: user.id,
        name: user.nome_completo,
        email: user.email,
        functional: professor.registro_funcional,
        areaIds,
        label: `${user.nome_completo} - ${professor.registro_funcional ?? "Sem funcional"}${areaNames.length ? ` - ${areaNames.join(", ")}` : ""}`
      } satisfies ManagementProfessorOption;
    })
    .filter(Boolean)
    .sort((left, right) => left!.name.localeCompare(right!.name, "pt-BR")) as ManagementProfessorOption[];

  const semesterHistory = semesterRows
    .map((semester) => {
      const semesterAssignments = enrollmentRows
        .map((enrollment) => {
          const classGroup = classMap.get(enrollment.turma_id);

          if (!classGroup || classGroup.semestre_id !== semester.id) {
            return null;
          }

          const área = classGroup.area_estagio_id
            ? areaMap.get(classGroup.area_estagio_id)
            : null;
          const block = área ? blockMap.get(área.bloco_id) : null;
          const linkedProfessors = professorLinks
            .filter((link) => link.matricula_turma_id === enrollment.id)
            .sort((left, right) => {
              const principalDifference =
                Number(right.responsavel_principal) - Number(left.responsavel_principal);

              if (principalDifference !== 0) {
                return principalDifference;
              }

              return left.created_at.localeCompare(right.created_at);
            });
          const currentSupervisorLinks = linkedProfessors.filter((link) => link.ativo);
          const currentSupervisorIds = currentSupervisorLinks.map((link) => link.professor_id);
          const currentSupervisorNames = currentSupervisorLinks
            .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
            .filter(Boolean) as string[];
          const allSupervisorNames = [
            ...new Set(
              linkedProfessors
                .map((link) => professorUserMap.get(link.professor_id)?.nome_completo)
                .filter(Boolean) as string[]
            )
          ];

          return {
            enrollmentId: enrollment.id,
            areaId: área?.id ?? null,
            areaName: área?.nome ?? classGroup.area_estagio,
            blockName: block?.nome ?? "Bloco não identificado",
            className: classGroup.nome,
            enrollmentStatus: enrollment.status,
            currentSupervisorIds,
            currentSupervisorNames,
            allSupervisorNames
          } satisfies ManagementStudentSemesterAssignmentRecord;
        })
        .filter(Boolean)
        .sort((left, right) => left!.areaName.localeCompare(right!.areaName, "pt-BR")) as ManagementStudentSemesterAssignmentRecord[];

      return {
        semesterId: semester.id,
        semesterCode: semester.codigo,
        semesterName: semester.nome,
        semesterStatus: semester.status,
        startsAt: semester.data_inicio,
        endsAt: semester.data_fim,
        assignments: semesterAssignments
      } satisfies ManagementStudentSemesterRecord;
    })
    .filter((semesterRecord) => semesterRecord.assignments.length > 0);

  const defaultManagementSemesterId =
    semesterHistory.find(
      (semesterRecord) => semesterRecord.semesterStatus !== "encerrado"
    )?.semesterId ??
    manageableSemesters[0]?.id ??
    semesters[0]?.id ??
    "";

  return {
    studentData: {
      coordinator: {
        id: currentUser.id,
        name: currentUser.name
      },
      student: {
        id: studentUser.id,
        name: studentRow.nome_social ?? studentUser.nome_completo,
        fullName: studentUser.nome_completo,
        registration: studentRow.matricula,
        cellphone: studentRow.celular,
        email: studentUser.email,
        isActive: studentUser.ativo
      },
      semesters,
      manageableSemesters,
      areaBlocks,
      professorOptions,
      semesterHistory,
      defaultManagementSemesterId
    },
    emptyState: null
  };
}


