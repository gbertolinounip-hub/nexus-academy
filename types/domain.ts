export type ProfileCode =
  | "aluno"
  | "professor"
  | "coordenador"
  | "coordenador_master";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: ProfileCode;
  unitId?: string | null;
  unitName?: string | null;
  unitSlug?: string | null;
}

export interface SemesterSummary {
  id: string;
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
}

export interface ClassSummary {
  id: string;
  code: string;
  name: string;
  internshipArea: string;
}

export interface RubricGroupDefinition {
  id: string;
  name: string;
  weightPercentage: number;
  order: number;
}

export interface RubricCriterionDefinition {
  id: string;
  groupId: string;
  name: string;
  description: string;
  weightPercentage: number;
  order: number;
  maxScore: number;
}

export interface StudentRecord {
  id: string;
  enrollmentId: string;
  registration: string;
  name: string;
  email: string;
  cellphone?: string | null;
  course: string;
  semesterId: string;
  classId: string;
  assignedProfessorIds: string[];
}

export interface ProfessorRecord {
  id: string;
  name: string;
  email: string;
  functional?: string | null;
  linkedEnrollmentIds: string[];
}

export interface CoordinatorRecord {
  id: string;
  name: string;
  email: string;
}

export interface EvaluationItemInput {
  criterionId: string;
  rawScore: number;
  feedback?: string;
}

export interface EvaluationLaunch {
  id: string;
  enrollmentId: string;
  semesterId: string;
  professorId: string;
  reference: string;
  isLegacyRecord?: boolean;
  launchType: "parcial" | "revisao" | "fechamento";
  publishedAt: string;
  createdAt?: string;
  notes?: string;
  items: EvaluationItemInput[];
}

export interface AbsenceRecord {
  id: string;
  enrollmentId: string;
  registeredBy: string;
  date: string;
  hours: number;
  justified: boolean;
  reason?: string;
}

export interface AuditEntry {
  id: string;
  tableName: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  actorId: string;
  actorName: string;
  happenedAt: string;
  recordLabel: string;
  summary: string;
  semesterId?: string;
  semesterCode?: string;
  areaId?: string | null;
  areaName?: string | null;
  blockName?: string | null;
}

export interface StudentCriterionSnapshot {
  criterionId: string;
  groupId: string;
  name: string;
  weightPercentage: number;
  latestRawScore: number | null;
  latestFeedback?: string | null;
  earnedPercentage: number;
  updatedAt: string | null;
}

export interface StudentGroupSnapshot {
  groupId: string;
  name: string;
  weightPercentage: number;
  earnedPercentage: number;
  criteria: StudentCriterionSnapshot[];
}

export interface StudentProgressPoint {
  label: string;
  launchType: "parcial" | "revisao" | "fechamento";
  publishedAt: string;
  isLegacyRecord?: boolean;
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  completionRate: number;
}

export interface StudentDashboardData {
  student: StudentRecord;
  semester: SemesterSummary;
  classGroup: ClassSummary;
  professors: ProfessorRecord[];
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  finalPercentage: number;
  finalGradeOutOfTen: number;
  completionRate: number;
  groups: StudentGroupSnapshot[];
  progress: StudentProgressPoint[];
  absences: AbsenceRecord[];
}

export interface ProfessorStudentSummary {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  registration: string;
  email: string;
  cellphone?: string | null;
  className: string;
  finalPercentage: number;
  subtotalPercentage: number;
  absencePenaltyPercentage: number;
  completionRate: number;
  status: "bem" | "atencao" | "critico";
}

export interface ProfessorDashboardData {
  professor: ProfessorRecord;
  semester: SemesterSummary;
  linkedStudents: ProfessorStudentSummary[];
  totalAssignedStudents: number;
  classAveragePercentage: number;
  studentsAtRisk: number;
  launchesThisMonth: number;
}

export interface CoordinatorDashboardData {
  coordinator: CoordinatorRecord;
  semester: SemesterSummary;
  semesterStatus: "planejado" | "ativo" | "encerrado";
  totalStudents: number;
  totalProfessors: number;
  averageFinalPercentage: number;
  totalUnjustifiedAbsenceHours: number;
  areaGroupAverages: Array<{
    areaId: string;
    areaName: string;
    blockName: string;
    studentCount: number;
    professorCount: number;
    groups: Array<{
      groupId: string;
      groupName: string;
      averagePercentage: number;
      weightPercentage: number;
    }>;
  }>;
  areaCoverage: Array<{
    areaId: string;
    areaName: string;
    blockName: string;
    studentCount: number;
    professorCount: number;
  }>;
  criticalStudents: ProfessorStudentSummary[];
  recentAuditEntries: AuditEntry[];
}
