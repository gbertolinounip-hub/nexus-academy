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
  passwordChangeRecommended?: boolean;
}

export type StudentDocumentType = "carteira_vacinacao" | "tce";
export type StudentDocumentStatus = "enviado" | "aprovado" | "reprovado";
export type StudentDocumentReviewerRole = "professor" | "coordenador";
export type StudentDocumentNotificationType =
  | "documento_reprovado_professor"
  | "documento_reprovado_coordenador";

export interface StudentDocumentAreaOption {
  enrollmentId: string;
  areaId: string;
  areaName: string;
  blockName: string;
  className: string;
  semesterCode: string;
  professorNames: string[];
  label: string;
}

export interface StudentDocumentSummary {
  id: string;
  unitId: string | null;
  unitName: string | null;
  studentId: string;
  studentName: string;
  registration: string;
  type: StudentDocumentType;
  typeLabel: string;
  status: StudentDocumentStatus;
  statusLabel: string;
  reviewerRole: StudentDocumentReviewerRole | null;
  reviewerRoleLabel: string | null;
  reviewedByName: string | null;
  fileName: string;
  fileMimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  active: boolean;
  version: number;
  previousDocumentId: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  areaId: string | null;
  areaName: string | null;
  blockName: string | null;
  className: string | null;
  semesterCode: string | null;
  enrollmentId: string | null;
}

export interface StudentDocumentNotificationSummary {
  id: string;
  unitId: string | null;
  userId: string;
  documentId: string;
  documentType: StudentDocumentType;
  type: StudentDocumentNotificationType;
  title: string;
  message: string;
  actionLabel: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  studentName: string;
  areaName: string | null;
  blockName: string | null;
}

export interface StudentDocumentNotificationCenter {
  unreadCount: number;
  pendingItems: StudentDocumentNotificationSummary[];
  historyItems: StudentDocumentNotificationSummary[];
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

export type ClinicalCaseStatus = "atribuido" | "ativo" | "encerrado" | "alta";
export type ClinicalRecordType = "avaliacao" | "plano_tratamento" | "evolucao";
export type ClinicalRecordStatus =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "ajustes_solicitados";
export type ClinicalInstitutionalViewerRole =
  | "coordenador"
  | "coordenador_master";
export type ClinicalInstitutionalPatientStatus =
  | "com_caso_ativo"
  | "alta"
  | "com_historico"
  | "cadastro_base";

export type ClinicalNotificationType =
  | "avaliacao_enviada_supervisao"
  | "avaliacao_ajustes_solicitados"
  | "avaliacao_aprovada"
  | "plano_tratamento_enviado_supervisao"
  | "plano_tratamento_ajustes_solicitados"
  | "plano_tratamento_aprovado"
  | "evolucao_enviada_supervisao"
  | "evolucao_ajustes_solicitados"
  | "evolucao_aprovada";

export type ClinicalWeekday =
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado";

export interface ClinicalCaseScheduleSlot {
  id: string;
  weekday: ClinicalWeekday;
  appointmentTime: string;
}

export interface ClinicalEvaluationContent {
  evaluationDate: string;
  chiefComplaint: string;
  currentIllnessHistory: string;
  relevantHistory: string;
  medicationsAndNotes: string;
  inspectionNotes: string;
  painNotes: string;
  rangeOfMotion: string;
  muscleStrength: string;
  functionalityLimitations: string;
  otherFindings: string;
  clinicalDiagnosis: string;
  initialObjectives: string;
  finalObservations: string;
}

export interface ClinicalEvaluationRecord {
  id: string;
  unitId: string | null;
  caseId: string;
  type: "avaliacao";
  status: ClinicalRecordStatus;
  authorId: string;
  supervisorFeedback: string | null;
  reviewedById: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: ClinicalEvaluationContent;
}

export interface ClinicalTreatmentPlanContent {
  planDate: string;
  objectives: string;
  conducts: string;
  observations: string;
}

export interface ClinicalTreatmentPlanRecord {
  id: string;
  unitId: string | null;
  caseId: string;
  type: "plano_tratamento";
  status: ClinicalRecordStatus;
  authorId: string;
  supervisorFeedback: string | null;
  reviewedById: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: ClinicalTreatmentPlanContent;
}

export interface ClinicalEvolutionContent {
  sessionDate: string;
  progressAndConduct: string;
  observations: string;
}

export interface ClinicalEvolutionRecord {
  id: string;
  unitId: string | null;
  caseId: string;
  type: "evolucao";
  status: ClinicalRecordStatus;
  authorId: string;
  supervisorFeedback: string | null;
  reviewedById: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  content: ClinicalEvolutionContent;
}

export interface ClinicalNotificationSummary {
  id: string;
  unitId: string | null;
  userId: string;
  caseId: string;
  recordId: string | null;
  type: ClinicalNotificationType;
  recordType: ClinicalRecordType;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  patientName: string;
  studentName: string;
  actionLabel: string;
}

export interface ClinicalNotificationCenter {
  unreadCount: number;
  pendingItems: ClinicalNotificationSummary[];
  historyItems: ClinicalNotificationSummary[];
}

export type ClinicalCaseSection =
  | "visao-geral"
  | "avaliacao"
  | "plano-tratamento"
  | "evolucao";

export interface ClinicalStudentOption {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  registration: string;
  className: string;
  semesterCode: string;
  areaName: string;
  professorName?: string | null;
  label: string;
}

export interface ClinicalPatientSummary {
  id: string;
  identifier: string;
  name: string;
  birthDate: string | null;
  cpf: string | null;
  contact: string | null;
  companion: string | null;
  active: boolean;
}

export interface ClinicalInstitutionalPatientListItem {
  patient: ClinicalPatientSummary;
  currentStatus: ClinicalInstitutionalPatientStatus;
  currentStatusLabel: string;
  activeCaseId: string | null;
  latestCaseId: string | null;
  latestCaseStatus: ClinicalCaseStatus | null;
  latestSemesterCode: string | null;
  latestAreaName: string | null;
  latestProfessorName: string | null;
  latestStudentName: string | null;
  lastUpdatedAt: string | null;
  historyCount: number;
}

export interface ClinicalCaseSummary {
  id: string;
  unitId: string | null;
  unitName: string;
  patient: ClinicalPatientSummary;
  enrollmentId: string;
  studentId: string;
  studentName: string;
  registration: string;
  classId: string;
  className: string;
  semesterId: string;
  semesterCode: string;
  areaId: string | null;
  areaName: string;
  professorId: string;
  professorName: string;
  schedules: ClinicalCaseScheduleSlot[];
  weekday: ClinicalWeekday;
  appointmentTime: string;
  status: ClinicalCaseStatus;
  notificationType?: ClinicalNotificationType | null;
  notificationLabel?: string | null;
  notificationUnreadCount: number;
  active: boolean;
  startedAt: string;
  endedAt: string | null;
  updatedAt: string;
}

export interface ClinicalPatientHistoryCaseItem {
  caseItem: ClinicalCaseSummary;
  latestEvaluationStatus: ClinicalRecordStatus | null;
  latestTreatmentPlanStatus: ClinicalRecordStatus | null;
  latestEvolutionStatus: ClinicalRecordStatus | null;
}
