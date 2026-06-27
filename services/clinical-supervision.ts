import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  loadScopedOperationalGraph,
  resolveScopedDataAccess,
  type ResolvedSessionDataScope
} from "@/lib/auth/data-scope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatMaskedFirstName,
  getClinicalWeekdayFromDateOnly,
  getDateValueTimestamp,
  normalizeDateOnlyValue
} from "@/lib/utils/format";
import {
  findActiveExceptionalRelease,
  loadActiveExceptionalReleaseRowsForUser,
  loadReleasedEnrollmentContextsForUser,
  resolveExceptionalReleaseVisualNoticeFromRows
} from "@/services/exceptional-releases";
import type { Database } from "@/types/database";
import type {
  ClinicalAttendanceEvolutionStatus,
  ClinicalAttendancePresenceStatus,
  ClinicalAttendanceSummary,
  ClinicalCaseSection,
  ClinicalCaseScheduleSlot,
  ClinicalCaseSummary,
  ClinicalWeekday,
  ClinicalEvaluationContent,
  ClinicalEvaluationRecord,
  ClinicalEvolutionContent,
  ClinicalEvolutionRecord,
  ClinicalInstitutionalPatientListItem,
  ClinicalInstitutionalViewerRole,
  ClinicalNotificationCenter,
  ClinicalNotificationSummary,
  ClinicalNotificationType,
  ClinicalPendingEvolutionSummary,
  ClinicalPatientHistoryCaseItem,
  ClinicalPatientSummary,
  ClinicalRecordType,
  ClinicalRecordStatus,
  ClinicalStudentOption,
  ClinicalTreatmentPlanContent,
  ClinicalTreatmentPlanRecord,
  ExceptionalReleaseVisualNotice,
  SessionUser
} from "@/types/domain";

type UserRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentRow = Database["public"]["Tables"]["alunos"]["Row"];
type ProfessorRow = Database["public"]["Tables"]["professores"]["Row"];
type InstitutionRow = Database["public"]["Tables"]["instituicoes"]["Row"];
type EnrollmentRow = Database["public"]["Tables"]["matriculas_turma"]["Row"];
type ClassRow = Database["public"]["Tables"]["turmas"]["Row"];
type SemesterRow = Database["public"]["Tables"]["semestres"]["Row"];
type UnitRow = Database["public"]["Tables"]["unidades"]["Row"];
type ProfessorLinkRow = Database["public"]["Tables"]["vinculos_professor_aluno"]["Row"];
type AreaRow = Database["public"]["Tables"]["areas_estagio"]["Row"];
type ClinicalPatientRow = Database["public"]["Tables"]["pacientes_clinica"]["Row"];
type ClinicalCaseRow = Database["public"]["Tables"]["casos_clinicos"]["Row"];
type ClinicalCaseScheduleRow =
  Database["public"]["Tables"]["casos_clinicos_horarios"]["Row"];
type ClinicalAttendanceRow =
  Database["public"]["Tables"]["atendimentos_clinicos"]["Row"];
type ClinicalRecordRow = Database["public"]["Tables"]["registros_clinicos"]["Row"];
type ClinicalNotificationRow =
  Database["public"]["Tables"]["notificacoes_clinicas"]["Row"];

interface EmptyState {
  title: string;
  description: string;
}

interface ClinicalOperatorContext {
  operator: {
    id: string;
    name: string;
    email: string;
    role: Extract<SessionUser["role"], "professor" | "coordenador" | "secretaria">;
  };
  studentOptions: ClinicalStudentOption[];
  studentOptionMap: Map<string, ClinicalStudentOption>;
  emptyHint: string | null;
}

interface ProfessorClinicalContext {
  professor: {
    id: string;
    name: string;
    email: string;
  };
  studentOptions: ClinicalStudentOption[];
  studentOptionMap: Map<string, ClinicalStudentOption>;
  emptyHint: string | null;
}

interface ClinicalReferenceBundle {
  patientsById: Map<string, ClinicalPatientRow>;
  enrollmentsById: Map<string, EnrollmentRow>;
  classesById: Map<string, ClassRow>;
  semestersById: Map<string, SemesterRow>;
  unitsById: Map<string, UnitRow>;
  studentsById: Map<string, StudentRow>;
  studentUsersById: Map<string, UserRow>;
  professorsById: Map<string, UserRow>;
  areasById: Map<string, AreaRow>;
  schedulesByCaseId: Map<string, ClinicalCaseScheduleSlot[]>;
}

export interface ClinicalSupervisionProfessorPageData {
  view: "professor";
  professor: ProfessorClinicalContext["professor"];
  studentOptions: ClinicalStudentOption[];
  cases: ClinicalCaseSummary[];
  attendancePendings: ClinicalPendingEvolutionSummary[];
  notifications: ClinicalNotificationCenter;
  metrics: {
    totalCases: number;
    activeCases: number;
    linkedStudents: number;
  };
  emptyHint: string | null;
}

export interface ClinicalSupervisionStudentPageData {
  view: "aluno";
  student: {
    id: string;
    name: string;
    email: string;
  };
  cases: ClinicalCaseSummary[];
  attendancePendings: ClinicalPendingEvolutionSummary[];
  notifications: ClinicalNotificationCenter;
  metrics: {
    totalCases: number;
    activeCases: number;
    updatedCases: number;
  };
  emptyHint: string | null;
}

export interface ClinicalSupervisionSecretaryPageData {
  view: "secretaria";
  operator: ClinicalOperatorContext["operator"];
  studentOptions: ClinicalStudentOption[];
  cases: ClinicalCaseSummary[];
  metrics: {
    totalCases: number;
    activeCases: number;
    linkedStudents: number;
  };
  emptyHint: string | null;
}

export type ClinicalSupervisionPageData =
  | ClinicalSupervisionProfessorPageData
  | ClinicalSupervisionStudentPageData
  | ClinicalSupervisionSecretaryPageData;

export interface ClinicalSupervisionPageLoadResult {
  pageData: ClinicalSupervisionPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalCaseFormInitialValues {
  caseId?: string;
  patientId: string;
  patientIdentifier: string;
  patientName: string;
  patientBirthDate: string;
  patientCpf: string;
  patientContact: string;
  patientCompanion: string;
  enrollmentId: string;
  schedules: Array<{
    row_id: string;
    weekday: ClinicalCaseSummary["weekday"];
    appointment_time: string;
  }>;
  status: ClinicalCaseSummary["status"];
}

export interface ClinicalCaseFormPageData {
  operator: ClinicalOperatorContext["operator"];
  studentOptions: ClinicalStudentOption[];
  mode: "create" | "edit";
  currentCase: ClinicalCaseSummary | null;
  initialValues: ClinicalCaseFormInitialValues;
  emptyHint: string | null;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
}

export interface ClinicalCaseFormLoadResult {
  formData: ClinicalCaseFormPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalCaseDetailPageData {
  viewerRole: "professor" | "aluno" | ClinicalInstitutionalViewerRole;
  viewerName: string;
  caseItem: ClinicalCaseSummary;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  currentSection: ClinicalCaseSection;
  sections: Array<{
    key: Exclude<ClinicalCaseSection, "visao-geral">;
    label: string;
    description: string;
  }>;
  evaluation: ClinicalEvaluationRecord | null;
  treatmentPlan: ClinicalTreatmentPlanRecord | null;
  evolutions: ClinicalEvolutionRecord[];
  notifications: ClinicalNotificationCenter;
  studentCanCreateEvolution: boolean;
}

export interface ClinicalCaseDetailLoadResult {
  pageData: ClinicalCaseDetailPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalEvaluationPageData {
  viewerRole: "professor" | "aluno" | ClinicalInstitutionalViewerRole;
  viewerName: string;
  caseItem: ClinicalCaseSummary;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  evaluation: ClinicalEvaluationRecord | null;
  studentCanEdit: boolean;
  studentReadOnlyMessage: string | null;
}

export interface ClinicalEvaluationLoadResult {
  pageData: ClinicalEvaluationPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalTreatmentPlanPageData {
  viewerRole: "professor" | "aluno" | ClinicalInstitutionalViewerRole;
  viewerName: string;
  caseItem: ClinicalCaseSummary;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  treatmentPlan: ClinicalTreatmentPlanRecord | null;
  studentCanEdit: boolean;
  studentReadOnlyMessage: string | null;
}

export interface ClinicalTreatmentPlanLoadResult {
  pageData: ClinicalTreatmentPlanPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalEvolutionPageData {
  viewerRole: "professor" | "aluno" | ClinicalInstitutionalViewerRole;
  viewerName: string;
  caseItem: ClinicalCaseSummary;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  evolution: ClinicalEvolutionRecord | null;
  linkedAttendance: ClinicalPendingEvolutionSummary | null;
  initialSessionDate: string | null;
  studentCanEdit: boolean;
  studentReadOnlyMessage: string | null;
}

export interface ClinicalEvolutionLoadResult {
  pageData: ClinicalEvolutionPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalEvolutionListPageData {
  viewerRole: "professor" | "aluno" | ClinicalInstitutionalViewerRole;
  viewerName: string;
  caseItem: ClinicalCaseSummary;
  exceptionalReleaseNotice?: ExceptionalReleaseVisualNotice | null;
  evolutions: ClinicalEvolutionRecord[];
}

export interface ClinicalDailyAttendancePageData {
  view: "professor" | "secretaria";
  viewerName: string;
  selectedDate: string;
  filters: {
    areaId: string;
    professorId: string;
    status: string;
  };
  filterOptions: {
    areas: Array<{ id: string; name: string }>;
    professors: Array<{ id: string; name: string }>;
    statuses: Array<{ value: string; label: string }>;
  };
  metrics: {
    scheduledCount: number;
    presentCount: number;
    absentCount: number;
    pendingCount: number;
  };
  items: ClinicalAttendanceSummary[];
  pendingFilters: {
    areaId: string;
    studentId: string;
    status: string;
  };
  pendingFilterOptions: {
    areas: Array<{ id: string; name: string }>;
    students: Array<{ id: string; name: string }>;
    statuses: Array<{ value: string; label: string }>;
  };
  pendingMetrics: {
    totalOpenCount: number;
    pendingCount: number;
    sentCount: number;
    adjustmentCount: number;
  };
  pendingItems: ClinicalPendingEvolutionSummary[];
}

export interface ClinicalDailyAttendanceLoadResult {
  pageData: ClinicalDailyAttendancePageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalEvolutionListLoadResult {
  pageData: ClinicalEvolutionListPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalPatientBasePageData {
  viewerRole: "professor" | "coordenador" | "secretaria";
  viewerName: string;
  patients: ClinicalInstitutionalPatientListItem[];
  filterOptions: {
    units: Array<{ id: string; name: string }>;
    semesters: Array<{ id: string; code: string }>;
    areas: Array<{ id: string; name: string }>;
  };
  filters: {
    query: string;
    unitId: string;
    status: "todos" | "com_caso_ativo" | "alta" | "com_historico";
    semesterId: string;
    areaId: string;
  };
  metrics: {
    totalPatients: number;
    activePatients: number;
    patientsWithHistory: number;
  };
}

export interface ClinicalPatientBaseLoadResult {
  pageData: ClinicalPatientBasePageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalPatientHistoryPageData {
  viewerRole: "professor" | "coordenador";
  viewerName: string;
  patient: ClinicalPatientSummary;
  patientStatusLabel: string;
  activeCaseId: string | null;
  latestCaseId: string | null;
  history: ClinicalPatientHistoryCaseItem[];
}

export interface ClinicalPatientHistoryLoadResult {
  pageData: ClinicalPatientHistoryPageData | null;
  emptyState: EmptyState | null;
}

export interface ClinicalInstitutionalDashboardCaseRow {
  caseItem: ClinicalCaseSummary;
  latestEvaluationStatus: ClinicalRecordStatus | null;
  latestTreatmentPlanStatus: ClinicalRecordStatus | null;
  latestEvolutionStatus: ClinicalRecordStatus | null;
  latestEvolutionDate: string | null;
  latestRecordType: ClinicalRecordType | null;
  latestRecordStatus: ClinicalRecordStatus | null;
  latestRecordUpdatedAt: string | null;
  hasPendingItems: boolean;
  hasRecentEvolutionGap: boolean;
}

export interface ClinicalInstitutionalDashboardInstitutionOption {
  id: string;
  name: string;
}

export interface ClinicalInstitutionalDashboardUnitOption {
  id: string;
  name: string;
  institutionId: string | null;
}

export interface ClinicalInstitutionalDashboardPageData {
  viewerRole: ClinicalInstitutionalViewerRole;
  viewerName: string;
  generatedAt: string;
  filters: {
    query: string;
    institutionId: string;
    unitId: string;
    semesterId: string;
    areaId: string;
    professorId: string;
    studentId: string;
    status: "todos" | ClinicalCaseSummary["status"];
  };
  filterOptions: {
    institutions: ClinicalInstitutionalDashboardInstitutionOption[];
    units: ClinicalInstitutionalDashboardUnitOption[];
    semesters: Array<{ id: string; code: string }>;
    areas: Array<{ id: string; name: string }>;
    professors: Array<{ id: string; name: string }>;
    students: Array<{ id: string; name: string; registration: string }>;
  };
  metrics: {
    totalActivePatients: number;
    totalActiveCases: number;
    totalCasesWithAlta: number;
    totalClosedCases: number;
    totalCasesWithPendingItems: number;
    totalCasesWithoutRecentEvolution: number;
  };
  cases: ClinicalInstitutionalDashboardCaseRow[];
  breakdowns: {
    byArea: Array<{
      areaId: string;
      areaName: string;
      patientCount: number;
      caseCount: number;
      activeCaseCount: number;
    }>;
    byUnit: Array<{
      unitId: string;
      unitName: string;
      patientCount: number;
      caseCount: number;
      activeCaseCount: number;
    }>;
    byProfessor: Array<{
      professorId: string;
      professorName: string;
      caseCount: number;
      activeCaseCount: number;
    }>;
    byStudent: Array<{
      studentId: string;
      studentName: string;
      registration: string;
      caseCount: number;
      activeCaseCount: number;
    }>;
  };
}

export interface ClinicalInstitutionalDashboardLoadResult {
  pageData: ClinicalInstitutionalDashboardPageData | null;
  emptyState: EmptyState | null;
}

function buildEmptyState(title: string, description: string): EmptyState {
  return { title, description };
}

function createEmptyClinicalEvaluationContent(
  evaluationDate = getTodayInSaoPaulo()
): ClinicalEvaluationContent {
  return {
    evaluationDate,
    chiefComplaint: "",
    currentIllnessHistory: "",
    relevantHistory: "",
    medicationsAndNotes: "",
    inspectionNotes: "",
    painNotes: "",
    rangeOfMotion: "",
    muscleStrength: "",
    functionalityLimitations: "",
    otherFindings: "",
    clinicalDiagnosis: "",
    initialObjectives: "",
    finalObservations: ""
  };
}

function createEmptyClinicalTreatmentPlanContent(
  planDate = getTodayInSaoPaulo()
): ClinicalTreatmentPlanContent {
  return {
    planDate,
    objectives: "",
    conducts: "",
    observations: ""
  };
}

function createEmptyClinicalEvolutionContent(
  sessionDate = getTodayInSaoPaulo()
): ClinicalEvolutionContent {
  return {
    sessionDate,
    progressAndConduct: "",
    observations: ""
  };
}

function normalizeClinicalTextValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeClinicalEvaluationContent(
  rawValue: unknown
): ClinicalEvaluationContent {
  const source =
    rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const fallback = createEmptyClinicalEvaluationContent();

  return {
    evaluationDate:
      normalizeClinicalTextValue(source.evaluationDate) || fallback.evaluationDate,
    chiefComplaint: normalizeClinicalTextValue(source.chiefComplaint),
    currentIllnessHistory: normalizeClinicalTextValue(source.currentIllnessHistory),
    relevantHistory: normalizeClinicalTextValue(source.relevantHistory),
    medicationsAndNotes: normalizeClinicalTextValue(source.medicationsAndNotes),
    inspectionNotes: normalizeClinicalTextValue(source.inspectionNotes),
    painNotes: normalizeClinicalTextValue(source.painNotes),
    rangeOfMotion: normalizeClinicalTextValue(source.rangeOfMotion),
    muscleStrength: normalizeClinicalTextValue(source.muscleStrength),
    functionalityLimitations: normalizeClinicalTextValue(
      source.functionalityLimitations
    ),
    otherFindings: normalizeClinicalTextValue(source.otherFindings),
    clinicalDiagnosis: normalizeClinicalTextValue(source.clinicalDiagnosis),
    initialObjectives: normalizeClinicalTextValue(source.initialObjectives),
    finalObservations: normalizeClinicalTextValue(source.finalObservations)
  };
}

function normalizeClinicalTreatmentPlanContent(
  rawValue: unknown
): ClinicalTreatmentPlanContent {
  const source =
    rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const fallback = createEmptyClinicalTreatmentPlanContent();

  return {
    planDate: normalizeClinicalTextValue(source.planDate) || fallback.planDate,
    objectives: normalizeClinicalTextValue(source.objectives),
    conducts: normalizeClinicalTextValue(source.conducts),
    observations: normalizeClinicalTextValue(source.observations)
  };
}

function normalizeClinicalEvolutionContent(
  rawValue: unknown
): ClinicalEvolutionContent {
  const source =
    rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const fallback = createEmptyClinicalEvolutionContent();

  return {
    sessionDate:
      normalizeClinicalTextValue(source.sessionDate) || fallback.sessionDate,
    progressAndConduct: normalizeClinicalTextValue(source.progressAndConduct),
    observations: normalizeClinicalTextValue(source.observations)
  };
}

function buildClinicalEvaluationRecord(
  recordRow: ClinicalRecordRow
): ClinicalEvaluationRecord {
  return {
    id: recordRow.id,
    unitId: recordRow.unidade_id,
    caseId: recordRow.caso_clinico_id,
    type: "avaliacao",
    status: recordRow.status,
    authorId: recordRow.autor_id,
    supervisorFeedback: recordRow.parecer_supervisor,
    reviewedById: recordRow.revisado_por,
    submittedAt: recordRow.enviado_em,
    reviewedAt: recordRow.revisado_em,
    createdAt: recordRow.created_at,
    updatedAt: recordRow.updated_at,
    content: normalizeClinicalEvaluationContent(recordRow.conteudo_json)
  };
}

function buildClinicalTreatmentPlanRecord(
  recordRow: ClinicalRecordRow
): ClinicalTreatmentPlanRecord {
  return {
    id: recordRow.id,
    unitId: recordRow.unidade_id,
    caseId: recordRow.caso_clinico_id,
    type: "plano_tratamento",
    status: recordRow.status,
    authorId: recordRow.autor_id,
    supervisorFeedback: recordRow.parecer_supervisor,
    reviewedById: recordRow.revisado_por,
    submittedAt: recordRow.enviado_em,
    reviewedAt: recordRow.revisado_em,
    createdAt: recordRow.created_at,
    updatedAt: recordRow.updated_at,
    content: normalizeClinicalTreatmentPlanContent(recordRow.conteudo_json)
  };
}

function buildClinicalEvolutionRecord(
  recordRow: ClinicalRecordRow
): ClinicalEvolutionRecord {
  return {
    id: recordRow.id,
    unitId: recordRow.unidade_id,
    caseId: recordRow.caso_clinico_id,
    type: "evolucao",
    status: recordRow.status,
    authorId: recordRow.autor_id,
    supervisorFeedback: recordRow.parecer_supervisor,
    reviewedById: recordRow.revisado_por,
    submittedAt: recordRow.enviado_em,
    reviewedAt: recordRow.revisado_em,
    createdAt: recordRow.created_at,
    updatedAt: recordRow.updated_at,
    content: normalizeClinicalEvolutionContent(recordRow.conteudo_json)
  };
}

function getClinicalNotificationRecordType(
  type: ClinicalNotificationType
): ClinicalRecordType {
  switch (type) {
    case "plano_tratamento_enviado_supervisao":
    case "plano_tratamento_ajustes_solicitados":
    case "plano_tratamento_aprovado":
      return "plano_tratamento";
    case "evolucao_enviada_supervisao":
    case "evolucao_ajustes_solicitados":
    case "evolucao_aprovada":
      return "evolucao";
    default:
      return "avaliacao";
  }
}

function buildClinicalNotificationActionLabel(
  type: ClinicalNotificationType
): string {
  switch (type) {
    case "avaliacao_enviada_supervisao":
    case "plano_tratamento_enviado_supervisao":
    case "evolucao_enviada_supervisao":
      return "Pendente";
    case "avaliacao_ajustes_solicitados":
    case "plano_tratamento_ajustes_solicitados":
    case "evolucao_ajustes_solicitados":
      return "Ajustes solicitados";
    case "avaliacao_aprovada":
    case "plano_tratamento_aprovado":
    case "evolucao_aprovada":
      return "Aprovado";
    default:
      return "Atualizado";
  }
}

function buildClinicalNotificationTitle(type: ClinicalNotificationType): string {
  switch (type) {
    case "avaliacao_enviada_supervisao":
      return "Avaliação enviada para supervisão";
    case "avaliacao_ajustes_solicitados":
      return "Ajustes solicitados na avaliação";
    case "avaliacao_aprovada":
      return "Avaliação aprovada";
    case "plano_tratamento_enviado_supervisao":
      return "Plano de tratamento enviado para supervisão";
    case "plano_tratamento_ajustes_solicitados":
      return "Ajustes solicitados no plano de tratamento";
    case "plano_tratamento_aprovado":
      return "Plano de tratamento aprovado";
    case "evolucao_enviada_supervisao":
      return "Evolução enviada para supervisão";
    case "evolucao_ajustes_solicitados":
      return "Ajustes solicitados na evolução";
    case "evolucao_aprovada":
      return "Evolução aprovada";
    default:
      return "Atualização clínica";
  }
}

function buildClinicalNotificationMessage(input: {
  type: ClinicalNotificationType;
  caseItem: ClinicalCaseSummary;
}): string {
  switch (input.type) {
    case "avaliacao_enviada_supervisao":
      return `${input.caseItem.studentName} enviou a avaliação de ${input.caseItem.patient.name} para supervisão.`;
    case "avaliacao_ajustes_solicitados":
      return `O supervisor registrou parecer e solicitou ajustes na avaliação de ${input.caseItem.patient.name}.`;
    case "avaliacao_aprovada":
      return `O supervisor aprovou a avaliação de ${input.caseItem.patient.name}.`;
    case "plano_tratamento_enviado_supervisao":
      return `${input.caseItem.studentName} enviou o plano de tratamento de ${input.caseItem.patient.name} para supervisão.`;
    case "plano_tratamento_ajustes_solicitados":
      return `O supervisor registrou parecer e solicitou ajustes no plano de tratamento de ${input.caseItem.patient.name}.`;
    case "plano_tratamento_aprovado":
      return `O supervisor aprovou o plano de tratamento de ${input.caseItem.patient.name}.`;
    case "evolucao_enviada_supervisao":
      return `${input.caseItem.studentName} enviou a evolução de ${input.caseItem.patient.name} para supervisão.`;
    case "evolucao_ajustes_solicitados":
      return `O supervisor registrou parecer e solicitou ajustes na evolução de ${input.caseItem.patient.name}.`;
    case "evolucao_aprovada":
      return `O supervisor aprovou a evolução de ${input.caseItem.patient.name}.`;
    default:
      return `Houve uma atualização clínica no caso de ${input.caseItem.patient.name}.`;
  }
}

function isClinicalNotificationPending(args: {
  role: SessionUser["role"];
  type: ClinicalNotificationType;
  status: ClinicalRecordStatus | null | undefined;
  read?: boolean;
}) {
  if (args.role === "professor" && args.status === "enviado") {
    return (
      args.type === "avaliacao_enviada_supervisao" ||
      args.type === "plano_tratamento_enviado_supervisao" ||
      args.type === "evolucao_enviada_supervisao"
    );
  }

  if (args.role === "aluno" && args.status === "ajustes_solicitados") {
    return (
      args.type === "avaliacao_ajustes_solicitados" ||
      args.type === "plano_tratamento_ajustes_solicitados" ||
      args.type === "evolucao_ajustes_solicitados"
    );
  }

  if (args.role === "aluno" && args.status === "aprovado" && !args.read) {
    return (
      args.type === "avaliacao_aprovada" ||
      args.type === "plano_tratamento_aprovado" ||
      args.type === "evolucao_aprovada"
    );
  }

  return false;
}

function buildClinicalNotificationSummary(input: {
  row: ClinicalNotificationRow;
  caseItem: ClinicalCaseSummary;
}): ClinicalNotificationSummary {
  return {
    id: input.row.id,
    unitId: input.row.unidade_id,
    userId: input.row.usuario_id,
    caseId: input.row.caso_clinico_id,
    recordId: input.row.registro_clinico_id,
    type: input.row.tipo,
    recordType: getClinicalNotificationRecordType(input.row.tipo),
    title: buildClinicalNotificationTitle(input.row.tipo),
    message: buildClinicalNotificationMessage({
      type: input.row.tipo,
      caseItem: input.caseItem
    }),
    read: input.row.lida,
    readAt: input.row.lida_em,
    createdAt: input.row.created_at,
    patientName: input.caseItem.patient.name,
    studentName: input.caseItem.studentName,
    actionLabel: buildClinicalNotificationActionLabel(input.row.tipo)
  };
}

function buildClinicalRecordStatusKey(input: {
  caseId: string;
  recordType: ClinicalRecordType;
  recordId?: string | null;
}) {
  return input.recordId
    ? `record:${input.recordId}`
    : `case:${input.caseId}:${input.recordType}`;
}

function buildClinicalNotificationPendingKey(input: {
  caseId: string;
  type: ClinicalNotificationType;
  recordId?: string | null;
}) {
  return buildClinicalRecordStatusKey({
    caseId: input.caseId,
    recordType: getClinicalNotificationRecordType(input.type),
    recordId: input.recordId
  });
}

function uniqueStringValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function filterSemestersToCurrentUnit(
  semesters: SemesterRow[],
  currentUser: SessionUser
) {
  if (
    currentUser.role === "coordenador_master" ||
    (currentUser.role === "coordenador" && !currentUser.unitId) ||
    !currentUser.unitId
  ) {
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

function getTodayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function getClinicalWeekdayFromDate(value: string): ClinicalWeekday | null {
  const normalizedValue = normalizeDateOnlyValue(value);
  return normalizedValue ? getClinicalWeekdayFromDateOnly(normalizedValue) : null;
}

function resolveClinicalAttendanceEvolutionStatusFromRecordStatus(
  value?: ClinicalRecordStatus | null
): ClinicalAttendanceEvolutionStatus {
  switch (value) {
    case "enviado":
      return "enviada";
    case "ajustes_solicitados":
      return "ajustes_solicitados";
    case "aprovado":
      return "aprovada";
    case "rascunho":
    default:
      return "pendente";
  }
}

function buildClinicalAttendanceCaseKey(input: {
  caseId: string;
  attendanceDate: string;
  scheduleId?: string | null;
}) {
  return `${input.caseId}:${input.attendanceDate}:${input.scheduleId ?? "sem-horario"}`;
}

function normalizeTime(value: string) {
  return value.slice(0, 5);
}

const clinicalWeekdayOrder = new Map([
  ["segunda", 0],
  ["terca", 1],
  ["quarta", 2],
  ["quinta", 3],
  ["sexta", 4],
  ["sabado", 5]
]);

function sortClinicalSchedules(schedules: ClinicalCaseScheduleSlot[]) {
  return [...schedules].sort((left, right) => {
    const weekdayDiff =
      (clinicalWeekdayOrder.get(left.weekday) ?? 0) -
      (clinicalWeekdayOrder.get(right.weekday) ?? 0);

    if (weekdayDiff !== 0) {
      return weekdayDiff;
    }

    return left.appointmentTime.localeCompare(right.appointmentTime, "pt-BR");
  });
}

function normalizeSection(value?: string | null): ClinicalCaseSection {
  if (value === "avaliacao") {
    return "avaliacao";
  }

  if (value === "plano-tratamento") {
    return "plano-tratamento";
  }

  if (value === "evolucao") {
    return "evolucao";
  }

  return "visao-geral";
}

function buildClinicalPatientSummary(patient: ClinicalPatientRow): ClinicalPatientSummary {
  return {
    id: patient.id,
    identifier: patient.identificador,
    name: patient.nome,
    birthDate: patient.data_nascimento,
    cpf: patient.cpf,
    contact: patient.contato,
    companion: patient.acompanhante,
    active: patient.ativo
  };
}

function applyClinicalStudentSensitiveMaskToCase(
  caseItem: ClinicalCaseSummary,
  currentUser: SessionUser
) {
  if (currentUser.role !== "aluno") {
    return caseItem;
  }

  return {
    ...caseItem,
    patient: {
      ...caseItem.patient,
      name: formatMaskedFirstName(caseItem.patient.name)
    }
  };
}

function applyClinicalStudentSensitiveMaskToCases(
  cases: ClinicalCaseSummary[],
  currentUser: SessionUser
) {
  if (currentUser.role !== "aluno") {
    return cases;
  }

  return cases.map((caseItem) =>
    applyClinicalStudentSensitiveMaskToCase(caseItem, currentUser)
  );
}

function applyClinicalStudentSensitiveMaskToNullableCase(
  caseItem: ClinicalCaseSummary | null,
  currentUser: SessionUser
) {
  return caseItem
    ? applyClinicalStudentSensitiveMaskToCase(caseItem, currentUser)
    : null;
}

function buildClinicalCaseSummary(input: {
  caseRow: ClinicalCaseRow;
  unit: UnitRow | null;
  patient: ClinicalPatientRow;
  enrollment: EnrollmentRow;
  classGroup: ClassRow;
  semester: SemesterRow;
  studentRow: StudentRow;
  studentUser: UserRow | null;
  professorUser: UserRow;
  area: AreaRow | null;
  schedules: ClinicalCaseScheduleSlot[];
}): ClinicalCaseSummary {
  const schedules =
    input.schedules.length > 0
      ? sortClinicalSchedules(input.schedules)
      : [
          {
            id: `legacy-${input.caseRow.id}`,
            weekday: input.caseRow.dia_semana,
            appointmentTime: normalizeTime(input.caseRow.horario_atendimento)
          }
        ];
  const primarySchedule = schedules[0];

  return {
    id: input.caseRow.id,
    unitId: input.caseRow.unidade_id,
    unitName: input.unit?.nome ?? "Unidade não informada",
    patient: buildClinicalPatientSummary(input.patient),
    enrollmentId: input.enrollment.id,
    studentId: input.studentUser?.id ?? input.enrollment.aluno_id,
    studentName:
      input.studentRow.nome_social ??
      input.studentUser?.nome_completo ??
      "Aluno arquivado",
    registration: input.studentRow.matricula,
    classId: input.classGroup.id,
    className: input.classGroup.nome,
    semesterId: input.semester.id,
    semesterCode: input.semester.codigo,
    areaId: input.area?.id ?? input.caseRow.area_estagio_id,
    areaName: input.area?.nome ?? input.classGroup.area_estagio,
    professorId: input.professorUser.id,
    professorName: input.professorUser.nome_completo,
    schedules,
    weekday: primarySchedule.weekday,
    appointmentTime: primarySchedule.appointmentTime,
    status: input.caseRow.status,
    notificationType: null,
    notificationLabel: null,
    notificationUnreadCount: 0,
    active: input.caseRow.ativo,
    startedAt: input.caseRow.data_inicio,
    endedAt: input.caseRow.data_fim,
    updatedAt: input.caseRow.updated_at
  };
}

async function loadProfessorClinicalContext(
  currentUser: SessionUser
): Promise<{
  context: ProfessorClinicalContext | null;
  emptyState: EmptyState | null;
}> {
  if (currentUser.role !== "professor") {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Módulo disponível apenas para supervisores",
        "Nesta fase, a Clínica Supervisionada pode ser operada apenas por professores supervisores e alunos vinculados."
      )
    };
  }

  if (!currentUser.unitId) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Unidade operacional não identificada",
        "O professor autenticado precisa estar vinculado a uma unidade para acessar a Clínica Supervisionada."
      )
    };
  }

  const currentUnitId = currentUser.unitId;
  /*
  try {
    const cases = (await loadClinicalInstitutionalCaseSummaries(currentUser)).filter(
      (caseItem) => caseItem.patient.id === patientId
    );
    const [patientData] = await loadInstitutionalPatientRows({
      currentUser,
      patientIds: [patientId]
    });

    if (!cases.length || !patientData) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Paciente institucional nÃ£o encontrado",
          "NÃ£o foi possÃ­vel localizar este cadastro-base de paciente no escopo do usuÃ¡rio autenticado."
        )
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: recordRowsData, error: recordError } = cases.length
      ? await supabase
          .from("registros_clinicos")
          .select("caso_clinico_id, tipo, status, updated_at")
          .in("caso_clinico_id", cases.map((caseItem) => caseItem.id))
          .order("updated_at", { ascending: false })
      : { data: [], error: null };

    if (recordError) {
      throw new Error("clinical-patient-history-record-load-failed");
    }

    const latestRecordByCaseAndType = new Map<string, ClinicalRecordStatus>();

    for (const recordRow of (recordRowsData ?? []) as Array<{
      caso_clinico_id: string;
      tipo: ClinicalRecordType;
      status: ClinicalRecordStatus;
      updated_at: string;
    }>) {
      const mapKey = `${recordRow.caso_clinico_id}:${recordRow.tipo}`;
      const currentValue = latestRecordByCaseAndType.get(mapKey);

      if (!currentValue) {
        latestRecordByCaseAndType.set(mapKey, recordRow.status);
      }
    }

    const history = [...cases]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((caseItem) => ({
        caseItem,
        latestEvaluationStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:avaliacao`) ?? null,
        latestTreatmentPlanStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:plano_tratamento`) ?? null,
        latestEvolutionStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:evolucao`) ?? null
      }));
    const patientSummary = buildClinicalPatientSummary(patientData);
    const patientListItem = buildClinicalInstitutionalPatientListItem({
      patient: patientData,
      cases
    });

    return {
      pageData: {
        viewerRole: currentUser.role,
        viewerName: currentUser.name,
        patient: patientSummary,
        patientStatusLabel: patientListItem.currentStatusLabel,
        activeCaseId: patientListItem.activeCaseId,
        latestCaseId: patientListItem.latestCaseId,
        history
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "NÃ£o foi possÃ­vel carregar o histÃ³rico institucional do paciente",
        "O cadastro-base foi encontrado, mas os casos clÃ­nicos vinculados ainda nÃ£o puderam ser consolidados nesta sessÃ£o."
      )
    };
  }

  const accessibleCaseRow = true;

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico nÃ£o encontrado",
        "NÃ£o foi possÃ­vel localizar este caso clÃ­nico no escopo do usuÃ¡rio autenticado."
      )
    };
  }

  */
  const supabase = await createSupabaseServerClient();
  const { data: professorRowData, error: professorError } = await supabase
    .from("professores")
    .select("*")
    .eq("usuario_id", currentUser.id)
    .maybeSingle();

  if (professorError || !professorRowData) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Cadastro docente não encontrado",
        "Não foi possível localizar o registro do professor autenticado para operar a Clínica Supervisionada."
      )
    };
  }

  let exceptionalReleaseRows: Awaited<
    ReturnType<typeof loadReleasedEnrollmentContextsForUser>
  >["releaseRows"] = [];
  let releasedEnrollmentContexts: Awaited<
    ReturnType<typeof loadReleasedEnrollmentContextsForUser>
  >["contexts"] = [];

  try {
    const releasedContextResult = await loadReleasedEnrollmentContextsForUser(currentUser, {
      type: "clinica_supervisionada",
      unitId: currentUser.unitId ?? null
    });

    exceptionalReleaseRows = releasedContextResult.releaseRows;
    releasedEnrollmentContexts = releasedContextResult.contexts;
  } catch (_error) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as liberações excepcionais",
        "Houve um problema ao consultar os contextos clínicos liberados excepcionalmente para este professor."
      )
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
      emptyState: buildEmptyState(
        "Não foi possível carregar os vínculos clínicos",
        "Houve um problema ao consultar os alunos vinculados à supervisão deste professor."
      )
    };
  }

  const today = getTodayInSaoPaulo();
  const professorLinks = ((professorLinksData ?? []) as ProfessorLinkRow[]).filter(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!professorLinks.length && !releasedEnrollmentContexts.length) {
    return {
      context: {
        professor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email
        },
        studentOptions: [],
        studentOptionMap: new Map<string, ClinicalStudentOption>(),
        emptyHint:
          "Assim que houver estagiários vinculados à sua supervisão no semestre atual, a atribuição de pacientes ficará disponível aqui."
      },
      emptyState: null
    };
  }

  const dataSupabase =
    releasedEnrollmentContexts.length > 0
      ? createSupabaseAdminClient()
      : supabase;

  const enrollmentIds = uniqueStringValues([
    ...professorLinks.map((link) => link.matricula_turma_id),
    ...releasedEnrollmentContexts.map((context) => context.enrollmentId)
  ]);
  const { data: enrollmentRowsData, error: enrollmentError } = await dataSupabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as matrículas vinculadas",
        "Os vínculos docentes foram encontrados, mas as matrículas dos estagiários não puderam ser consultadas."
      )
    };
  }

  const enrollmentRows = (enrollmentRowsData ?? []) as EnrollmentRow[];
  const activeEnrollmentRows = enrollmentRows.filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!activeEnrollmentRows.length && !releasedEnrollmentContexts.length) {
    return {
      context: {
        professor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email
        },
        studentOptions: [],
        studentOptionMap: new Map<string, ClinicalStudentOption>(),
        emptyHint:
          "Os vínculos existem, mas ainda não há matrículas ativas disponíveis para atribuição clínica."
      },
      emptyState: null
    };
  }

  const classIds = uniqueStringValues(enrollmentRows.map((row) => row.turma_id));
  const studentIds = uniqueStringValues(enrollmentRows.map((row) => row.aluno_id));
  const [classRowsResult, studentRowsResult, studentUsersResult] = await Promise.all([
    dataSupabase.from("turmas").select("*").in("id", classIds),
    dataSupabase.from("alunos").select("*").in("usuario_id", studentIds),
    dataSupabase
      .from("usuarios")
      .select("*")
      .in("id", studentIds)
      .eq("unidade_id", currentUnitId)
  ]);

  if (
    classRowsResult.error ||
    studentRowsResult.error ||
    studentUsersResult.error
  ) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível consolidar os estagiários",
        "Faltaram dados de aluno, usuário ou turma para montar a atribuição de pacientes."
      )
    };
  }

  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const allStudentUsers = (studentUsersResult.data ?? []) as UserRow[];
  const studentUsers = filterActiveStudentUsers(allStudentUsers);
  const semesterIds = uniqueStringValues(classRows.map((classGroup) => classGroup.semestre_id));
  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await dataSupabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar os semestres vinculados",
        "Os estagiários foram localizados, mas faltaram dados de semestre para montar o contexto clínico."
      )
    };
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterRowsData ?? []) as SemesterRow[],
    currentUser
  );
  classRows = filterClassesToSemesters(classRows, semesterRows);
  const activeEnrollmentIdSet = new Set(
    professorLinks.map((link) => link.matricula_turma_id)
  );
  const releasedEnrollmentIdSet = new Set(
    releasedEnrollmentContexts.map((context) => context.enrollmentId)
  );
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollments = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(
      activeEnrollmentRows.filter((enrollment) => activeEnrollmentIdSet.has(enrollment.id)),
      classRows
    ),
    activeStudentIdSet
  );
  const releasedEnrollments = filterEnrollmentsToClasses(
    enrollmentRows.filter((enrollment) => releasedEnrollmentIdSet.has(enrollment.id)),
    classRows
  );

  if (!visibleEnrollments.length && !releasedEnrollments.length) {
    return {
      context: {
        professor: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email
        },
        studentOptions: [],
        studentOptionMap: new Map<string, ClinicalStudentOption>(),
        emptyHint:
          "Ainda não há estagiários ativos da sua unidade com matrícula operacional disponível para atribuição clínica."
      },
      emptyState: null
    };
  }

  const areaIds = uniqueStringValues(
    classRows.map((classGroup) => classGroup.area_estagio_id)
  );
  const { data: areaRowsData, error: areaError } = areaIds.length
    ? await dataSupabase.from("areas_estagio").select("*").in("id", areaIds)
    : { data: [], error: null };

  if (areaError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as áreas do estágio",
        "Os estagiários foram encontrados, mas a área de estágio vinculada ao caso não pôde ser consultada."
      )
    };
  }

  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const allStudentUserMap = new Map(allStudentUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));
  const areaMap = new Map(((areaRowsData ?? []) as AreaRow[]).map((row) => [row.id, row]));

  const baseStudentOptions = visibleEnrollments
    .map((enrollment) => {
      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup
        ? semesterMap.get(classGroup.semestre_id)
        : undefined;
      const area =
        classGroup?.area_estagio_id ? areaMap.get(classGroup.area_estagio_id) : undefined;

      if (!studentRow || !studentUser || !classGroup || !semester) {
        return null;
      }

      const studentName = studentRow.nome_social ?? studentUser.nome_completo;
      const areaName = area?.nome ?? classGroup.area_estagio;

      return {
        enrollmentId: enrollment.id,
        studentId: studentUser.id,
        studentName,
        registration: studentRow.matricula,
        classId: classGroup.id,
        className: classGroup.nome,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        areaId: area?.id ?? classGroup.area_estagio_id,
        areaName,
        exceptionalReleaseNotice: null,
        label: `${studentName} · ${studentRow.matricula} · ${areaName} · ${classGroup.nome} · ${semester.codigo}`
      } satisfies ClinicalStudentOption;
    })
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as ClinicalStudentOption[];

  const releasedStudentOptions = releasedEnrollments
    .map((enrollment) =>
      buildClinicalStudentOption({
        enrollment,
        studentRowsById: studentRowMap,
        studentUsersById: allStudentUserMap,
        classRowsById: classMap,
        semestersById: semesterMap,
        areasById: areaMap
      })
    )
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as ClinicalStudentOption[];

  const studentOptionsMap = new Map<string, ClinicalStudentOption>();

  for (const studentOption of baseStudentOptions) {
    studentOptionsMap.set(studentOption.enrollmentId, studentOption);
  }

  for (const studentOption of releasedStudentOptions) {
    studentOptionsMap.set(studentOption.enrollmentId, studentOption);
  }

  const studentOptions = await applyProfessorClinicalExceptionalReleaseNotices(
    currentUser,
    [...studentOptionsMap.values()].sort((left, right) =>
      left.studentName.localeCompare(right.studentName, "pt-BR")
    ),
    exceptionalReleaseRows
  );

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
      ),
      emptyHint: studentOptions.length
        ? null
        : "Ainda não há estagiários aptos para receber pacientes nesta supervisão."
    },
    emptyState: null
  };
}

function buildClinicalOperatorContext(
  currentUser: SessionUser,
  studentOptions: ClinicalStudentOption[],
  emptyHint: string | null
): ClinicalOperatorContext {
  return {
    operator: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: currentUser.role as "professor" | "coordenador" | "secretaria"
    },
    studentOptions,
    studentOptionMap: new Map(
      studentOptions.map((studentOption) => [studentOption.enrollmentId, studentOption])
    ),
    emptyHint
  };
}

function buildClinicalStudentOption(input: {
  enrollment: Pick<EnrollmentRow, "id" | "aluno_id" | "turma_id">;
  studentRowsById: Map<string, StudentRow>;
  studentUsersById: Map<string, UserRow>;
  classRowsById: Map<string, ClassRow>;
  semestersById: Map<string, SemesterRow>;
  areasById: Map<string, AreaRow>;
  professorName?: string | null;
}) {
  const studentRow = input.studentRowsById.get(input.enrollment.aluno_id);
  const studentUser = input.studentUsersById.get(input.enrollment.aluno_id);
  const classGroup = input.classRowsById.get(input.enrollment.turma_id);
  const semester = classGroup
    ? input.semestersById.get(classGroup.semestre_id)
    : undefined;
  const area =
    classGroup?.area_estagio_id ? input.areasById.get(classGroup.area_estagio_id) : undefined;

  if (!studentRow || !studentUser || !classGroup || !semester) {
    return null;
  }

  const studentName = studentRow.nome_social ?? studentUser.nome_completo;
  const areaName = area?.nome ?? classGroup.area_estagio;
  const professorLabel = input.professorName
    ? ` · Supervisor: ${input.professorName}`
    : "";

  return {
    enrollmentId: input.enrollment.id,
    studentId: studentUser.id,
    studentName,
    registration: studentRow.matricula,
    classId: classGroup.id,
    className: classGroup.nome,
    semesterId: semester.id,
    semesterCode: semester.codigo,
    areaId: area?.id ?? classGroup.area_estagio_id,
    areaName,
    professorName: input.professorName ?? null,
    exceptionalReleaseNotice: null,
    label: `${studentName} · ${studentRow.matricula} · ${areaName} · ${classGroup.nome} · ${semester.codigo}${professorLabel}`
  } satisfies ClinicalStudentOption;
}

async function applyProfessorClinicalExceptionalReleaseNotices(
  currentUser: SessionUser,
  studentOptions: ClinicalStudentOption[],
  preloadedReleaseRows?: Awaited<
    ReturnType<typeof loadReleasedEnrollmentContextsForUser>
  >["releaseRows"]
) {
  if (currentUser.role !== "professor" || !studentOptions.length) {
    return studentOptions;
  }

  const closedSemesterIds = [...new Set(
    studentOptions
      .map((studentOption) => studentOption.semesterId)
      .filter(Boolean)
  )];

  if (!closedSemesterIds.length) {
    return studentOptions;
  }

  const releaseRows =
    preloadedReleaseRows ??
    (await loadActiveExceptionalReleaseRowsForUser(currentUser, {
      type: "clinica_supervisionada",
      semesterIds: closedSemesterIds,
      unitId: currentUser.unitId ?? null
    }));

  if (!releaseRows.length) {
    return studentOptions;
  }

  return studentOptions.map((studentOption) => ({
    ...studentOption,
    exceptionalReleaseNotice: resolveExceptionalReleaseVisualNoticeFromRows(releaseRows, {
      type: "clinica_supervisionada",
      semesterId: studentOption.semesterId,
      classId: studentOption.classId,
      studentId: studentOption.studentId,
      authorizedUserId: currentUser.id,
      unitId: currentUser.unitId ?? null
    })
  }));
}

async function resolveProfessorClinicalExceptionalReleaseNotice(
  currentUser: SessionUser,
  caseItem: ClinicalCaseSummary,
  semesterStatus?: SemesterRow["status"] | null
) {
  if (currentUser.role !== "professor" || semesterStatus !== "encerrado") {
    return null;
  }

  const release = await findActiveExceptionalRelease(
    {
      type: "clinica_supervisionada",
      semesterId: caseItem.semesterId,
      classId: caseItem.classId,
      studentId: caseItem.studentId,
      authorizedUserId: currentUser.id,
      unitId: caseItem.unitId ?? currentUser.unitId ?? null
    },
    currentUser
  );

  if (!release) {
    return null;
  }

  return {
    title: "Liberação excepcional ativa",
    message: release.noticeMessage,
    reason: release.reason,
    expiresAt: release.expiresAt
  } satisfies ExceptionalReleaseVisualNotice;
}

function selectInstitutionalProfessorLink(professorLinks: ProfessorLinkRow[]) {
  const principalLinks = professorLinks.filter((link) => link.responsavel_principal);

  if (principalLinks.length === 1) {
    return principalLinks[0];
  }

  if (principalLinks.length === 0 && professorLinks.length === 1) {
    return professorLinks[0];
  }

  return null;
}

async function loadClinicalOperatorContext(
  currentUser: SessionUser
): Promise<{
  context: ClinicalOperatorContext | null;
  emptyState: EmptyState | null;
}> {
  if (currentUser.role === "professor") {
    const { context, emptyState } = await loadProfessorClinicalContext(currentUser);

    return {
      context: context
        ? {
            operator: {
              id: context.professor.id,
              name: context.professor.name,
              email: context.professor.email,
              role: "professor"
            },
            studentOptions: context.studentOptions,
            studentOptionMap: context.studentOptionMap,
            emptyHint: context.emptyHint
          }
        : null,
      emptyState
    };
  }

  if (
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master" &&
    currentUser.role !== "secretaria"
  ) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Módulo disponível apenas para professores e coordenação",
        "Nesta fase, a base institucional de pacientes e a operação clínica podem ser consultadas apenas por professores e coordenação."
      )
    };
  }

  if (!currentUser.unitId) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Unidade operacional não identificada",
        "O usuário autenticado precisa estar vinculado a uma unidade para acessar a Clínica Supervisionada."
      )
    };
  }

  const supabase =
    currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  const { data: linksData, error: linksError } = await supabase
    .from("vinculos_professor_aluno")
    .select("*")
    .eq("ativo", true);

  if (linksError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar os vínculos clínicos",
        "Houve um problema ao consultar os vínculos ativos entre supervisores e estagiários da unidade."
      )
    };
  }

  const today = getTodayInSaoPaulo();
  const professorLinks = ((linksData ?? []) as ProfessorLinkRow[]).filter(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!professorLinks.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Assim que houver vínculos ativos entre estagiários e supervisores na unidade, a abertura de novos casos ficará disponível aqui."
      ),
      emptyState: null
    };
  }

  const enrollmentIds = uniqueStringValues(
    professorLinks.map((link) => link.matricula_turma_id)
  );
  const professorIds = uniqueStringValues(
    professorLinks.map((link) => link.professor_id)
  );
  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("matriculas_turma")
    .select("*")
    .in("id", enrollmentIds);

  if (enrollmentError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as matrículas vinculadas",
        "Os vínculos clínicos foram encontrados, mas as matrículas dos estagiários não puderam ser consultadas."
      )
    };
  }

  const enrollmentRows = ((enrollmentData ?? []) as EnrollmentRow[]).filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!enrollmentRows.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Os vínculos existem, mas ainda não há matrículas ativas disponíveis para atribuição clínica."
      ),
      emptyState: null
    };
  }

  const classIds = uniqueStringValues(enrollmentRows.map((row) => row.turma_id));
  const studentIds = uniqueStringValues(enrollmentRows.map((row) => row.aluno_id));
  const [classRowsResult, studentRowsResult, studentUsersResult, professorUsersResult] =
    await Promise.all([
      supabase.from("turmas").select("*").in("id", classIds),
      supabase.from("alunos").select("*").in("usuario_id", studentIds),
      supabase
        .from("usuarios")
        .select("*")
        .in("id", studentIds)
        .eq("unidade_id", currentUser.unitId)
        .eq("ativo", true),
      professorIds.length
        ? supabase
            .from("usuarios")
            .select("*")
            .in("id", professorIds)
            .eq("unidade_id", currentUser.unitId)
            .eq("ativo", true)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (
    classRowsResult.error ||
    studentRowsResult.error ||
    studentUsersResult.error ||
    professorUsersResult.error
  ) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível consolidar a operação clínica",
        "Faltaram dados de turma, aluno ou supervisor para preparar a abertura de novos casos."
      )
    };
  }

  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterActiveStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[]
  );
  const professorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const semesterIds = uniqueStringValues(classRows.map((classGroup) => classGroup.semestre_id));
  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await supabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };

  if (semesterError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar os semestres vinculados",
        "Os estagiários foram localizados, mas faltaram dados de semestre para preparar a operação clínica."
      )
    };
  }

  const semesterRows = filterSemestersToCurrentUnit(
    (semesterRowsData ?? []) as SemesterRow[],
    currentUser
  );
  classRows = filterClassesToSemesters(classRows, semesterRows);
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollments = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(enrollmentRows, classRows),
    activeStudentIdSet
  );

  if (!visibleEnrollments.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Ainda não há estagiários ativos da unidade com matrícula operacional disponível para atribuição clínica."
      ),
      emptyState: null
    };
  }

  const areaIds = uniqueStringValues(
    classRows.map((classGroup) => classGroup.area_estagio_id)
  );
  const { data: areaRowsData, error: areaError } = areaIds.length
    ? await supabase.from("areas_estagio").select("*").in("id", areaIds)
    : { data: [], error: null };

  if (areaError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as áreas do estágio",
        "Os estagiários foram encontrados, mas a área de estágio vinculada à operação clínica não pôde ser consultada."
      )
    };
  }

  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const professorUserMap = new Map(professorUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));
  const areaMap = new Map(((areaRowsData ?? []) as AreaRow[]).map((row) => [row.id, row]));
  const professorLinksByEnrollmentId = new Map<string, ProfessorLinkRow[]>();

  for (const professorLink of professorLinks) {
    const enrollmentLinks =
      professorLinksByEnrollmentId.get(professorLink.matricula_turma_id) ?? [];
    enrollmentLinks.push(professorLink);
    professorLinksByEnrollmentId.set(professorLink.matricula_turma_id, enrollmentLinks);
  }

  const baseStudentOptions = visibleEnrollments
    .map((enrollment) => {
      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup
        ? semesterMap.get(classGroup.semestre_id)
        : undefined;
      const area =
        classGroup?.area_estagio_id ? areaMap.get(classGroup.area_estagio_id) : undefined;
      const professorLink = selectInstitutionalProfessorLink(
        professorLinksByEnrollmentId.get(enrollment.id) ?? []
      );
      const professorName = professorLink
        ? professorUserMap.get(professorLink.professor_id)?.nome_completo ?? null
        : null;

      if (!studentRow || !studentUser || !classGroup || !semester || !professorName) {
        return null;
      }

      const studentName = studentRow.nome_social ?? studentUser.nome_completo;
      const areaName = area?.nome ?? classGroup.area_estagio;

      return {
        enrollmentId: enrollment.id,
        studentId: studentUser.id,
        studentName,
        registration: studentRow.matricula,
        classId: classGroup.id,
        className: classGroup.nome,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        areaId: area?.id ?? classGroup.area_estagio_id,
        areaName,
        professorName,
        exceptionalReleaseNotice: null,
        label: `${studentName} · ${studentRow.matricula} · ${areaName} · ${classGroup.nome} · ${semester.codigo} · Supervisor: ${professorName}`
      } satisfies ClinicalStudentOption;
    })
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as ClinicalStudentOption[];

  const studentOptions = await applyProfessorClinicalExceptionalReleaseNotices(
    currentUser,
    baseStudentOptions
  );

  return {
    context: buildClinicalOperatorContext(
      currentUser,
      studentOptions,
      studentOptions.length
        ? null
        : "Ainda não há matrículas com supervisor responsável definido para abrir novos casos na unidade."
    ),
    emptyState: null
  };
}

async function loadScopedClinicalOperatorContext(
  currentUser: SessionUser
): Promise<{
  context: ClinicalOperatorContext | null;
  emptyState: EmptyState | null;
}> {
  if (currentUser.role === "professor") {
    return loadClinicalOperatorContext(currentUser);
  }

  if (
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master" &&
    currentUser.role !== "secretaria"
  ) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Modulo disponivel apenas para professores e coordenacao",
        "Nesta fase, a base institucional de pacientes e a operacao clinica podem ser consultadas apenas por professores e coordenacao."
      )
    };
  }

  const serverSupabase = await createSupabaseServerClient();
  const supabase =
    currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : serverSupabase;
  const scopedGraph = await loadScopedOperationalGraph(currentUser, {
    supabase
  });

  if (
    scopedGraph.scope.scopeKind === "none" ||
    (scopedGraph.scope.restrictToCourse &&
      scopedGraph.scope.offerIds.length === 0)
  ) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "O contexto institucional ativo ainda nao possui matriculas operacionais seguras para a abertura de casos clinicos."
      ),
      emptyState: null
    };
  }

  const enrollmentRows = scopedGraph.enrollmentRows.filter(
    (enrollment) => enrollment.status === "ativa"
  );

  if (!enrollmentRows.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Ainda nao ha matriculas ativas dentro do contexto institucional selecionado."
      ),
      emptyState: null
    };
  }

  const classRows = scopedGraph.classRows;
  const semesterRows = scopedGraph.semesterRows;
  const enrollmentIds = uniqueStringValues(enrollmentRows.map((row) => row.id));
  const studentIds = uniqueStringValues(enrollmentRows.map((row) => row.aluno_id));
  const { data: linksData, error: linksError } = enrollmentIds.length
    ? await supabase
        .from("vinculos_professor_aluno")
        .select("*")
        .eq("ativo", true)
        .in("matricula_turma_id", enrollmentIds)
    : { data: [], error: null };

  if (linksError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Nao foi possivel carregar os vinculos clinicos",
        "Houve um problema ao consultar os vinculos ativos entre supervisores e estagiarios do contexto visivel."
      )
    };
  }

  const today = getTodayInSaoPaulo();
  const professorLinks = ((linksData ?? []) as ProfessorLinkRow[]).filter(
    (link) => !link.data_fim || link.data_fim >= today
  );

  if (!professorLinks.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Ainda nao ha vinculos ativos entre estagiarios e supervisores para a abertura de novos casos neste contexto."
      ),
      emptyState: null
    };
  }

  const professorIds = uniqueStringValues(
    professorLinks.map((link) => link.professor_id)
  );
  const [studentRowsResult, studentUsersResult, professorUsersResult] =
    await Promise.all([
      studentIds.length
        ? supabase.from("alunos").select("*").in("usuario_id", studentIds)
        : Promise.resolve({ data: [], error: null }),
      studentIds.length
        ? supabase.from("usuarios").select("*").in("id", studentIds).eq("ativo", true)
        : Promise.resolve({ data: [], error: null }),
      professorIds.length
        ? supabase.from("usuarios").select("*").in("id", professorIds).eq("ativo", true)
        : Promise.resolve({ data: [], error: null })
    ]);

  if (
    studentRowsResult.error ||
    studentUsersResult.error ||
    professorUsersResult.error
  ) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Nao foi possivel consolidar a operacao clinica",
        "Faltaram dados de turma, aluno ou supervisor para preparar a abertura de novos casos."
      )
    };
  }

  const studentRows = (studentRowsResult.data ?? []) as StudentRow[];
  const studentUsers = filterActiveStudentUsers(
    (studentUsersResult.data ?? []) as UserRow[]
  );
  const professorUsers = (professorUsersResult.data ?? []) as UserRow[];
  const activeStudentIdSet = new Set(studentUsers.map((studentUser) => studentUser.id));
  const visibleEnrollments = filterEnrollmentsToStudentIds(
    filterEnrollmentsToClasses(enrollmentRows, classRows),
    activeStudentIdSet
  );

  if (!visibleEnrollments.length) {
    return {
      context: buildClinicalOperatorContext(
        currentUser,
        [],
        "Ainda nao ha estagiarios ativos do contexto institucional com matricula operacional disponivel para atribuicao clinica."
      ),
      emptyState: null
    };
  }

  const areaIds = uniqueStringValues(
    classRows.map((classGroup) => classGroup.area_estagio_id)
  );
  const { data: areaRowsData, error: areaError } = areaIds.length
    ? await supabase.from("areas_estagio").select("*").in("id", areaIds)
    : { data: [], error: null };

  if (areaError) {
    return {
      context: null,
      emptyState: buildEmptyState(
        "Nao foi possivel carregar as areas do estagio",
        "Os estagiarios foram encontrados, mas a area de estagio vinculada a operacao clinica nao pode ser consultada."
      )
    };
  }

  const studentRowMap = new Map(studentRows.map((row) => [row.usuario_id, row]));
  const studentUserMap = new Map(studentUsers.map((row) => [row.id, row]));
  const professorUserMap = new Map(professorUsers.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const semesterMap = new Map(semesterRows.map((row) => [row.id, row]));
  const areaMap = new Map(((areaRowsData ?? []) as AreaRow[]).map((row) => [row.id, row]));
  const professorLinksByEnrollmentId = new Map<string, ProfessorLinkRow[]>();

  for (const professorLink of professorLinks) {
    const enrollmentLinks =
      professorLinksByEnrollmentId.get(professorLink.matricula_turma_id) ?? [];
    enrollmentLinks.push(professorLink);
    professorLinksByEnrollmentId.set(professorLink.matricula_turma_id, enrollmentLinks);
  }

  const baseStudentOptions = visibleEnrollments
    .map((enrollment) => {
      const studentRow = studentRowMap.get(enrollment.aluno_id);
      const studentUser = studentUserMap.get(enrollment.aluno_id);
      const classGroup = classMap.get(enrollment.turma_id);
      const semester = classGroup
        ? semesterMap.get(classGroup.semestre_id)
        : undefined;
      const area =
        classGroup?.area_estagio_id ? areaMap.get(classGroup.area_estagio_id) : undefined;
      const professorLink = selectInstitutionalProfessorLink(
        professorLinksByEnrollmentId.get(enrollment.id) ?? []
      );
      const professorName = professorLink
        ? professorUserMap.get(professorLink.professor_id)?.nome_completo ?? null
        : null;

      if (!studentRow || !studentUser || !classGroup || !semester || !professorName) {
        return null;
      }

      const studentName = studentRow.nome_social ?? studentUser.nome_completo;
      const areaName = area?.nome ?? classGroup.area_estagio;

      return {
        enrollmentId: enrollment.id,
        studentId: studentUser.id,
        studentName,
        registration: studentRow.matricula,
        classId: classGroup.id,
        className: classGroup.nome,
        semesterId: semester.id,
        semesterCode: semester.codigo,
        areaId: area?.id ?? classGroup.area_estagio_id,
        areaName,
        professorName,
        exceptionalReleaseNotice: null,
        label: `${studentName} - ${studentRow.matricula} - ${areaName} - ${classGroup.nome} - ${semester.codigo} - Supervisor: ${professorName}`
      } satisfies ClinicalStudentOption;
    })
    .filter(Boolean)
    .sort((left, right) =>
      left!.studentName.localeCompare(right!.studentName, "pt-BR")
    ) as ClinicalStudentOption[];

  const studentOptions = await applyProfessorClinicalExceptionalReleaseNotices(
    currentUser,
    baseStudentOptions
  );

  return {
    context: buildClinicalOperatorContext(
      currentUser,
      studentOptions,
      studentOptions.length
        ? null
        : "Ainda nao ha matriculas com supervisor responsavel definido para abrir novos casos no contexto institucional selecionado."
    ),
    emptyState: null
  };
}

async function loadClinicalReferenceBundle(
  caseRows: ClinicalCaseRow[],
  currentUser?: SessionUser | null
): Promise<ClinicalReferenceBundle> {
  const supabase =
    currentUser?.role === "coordenador_master" || currentUser?.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  const patientIds = uniqueStringValues(caseRows.map((caseRow) => caseRow.paciente_id));
  const enrollmentIds = uniqueStringValues(
    caseRows.map((caseRow) => caseRow.matricula_turma_id)
  );
  const professorIds = uniqueStringValues(caseRows.map((caseRow) => caseRow.professor_id));
  const caseIds = uniqueStringValues(caseRows.map((caseRow) => caseRow.id));
  const [
    patientRowsResult,
    enrollmentRowsResult,
    professorUsersResult,
    scheduleRowsResult
  ] = await Promise.all([
    patientIds.length
      ? supabase.from("pacientes_clinica").select("*").in("id", patientIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? supabase.from("matriculas_turma").select("*").in("id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    professorIds.length
      ? supabase.from("usuarios").select("*").in("id", professorIds)
      : Promise.resolve({ data: [], error: null }),
    caseIds.length
      ? supabase
          .from("casos_clinicos_horarios")
          .select("*")
          .in("caso_clinico_id", caseIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    patientRowsResult.error ||
    enrollmentRowsResult.error ||
    professorUsersResult.error ||
    scheduleRowsResult.error
  ) {
    throw new Error("clinical-reference-load-failed");
  }

  let enrollmentRows = (enrollmentRowsResult.data ?? []) as EnrollmentRow[];
  const classIds = uniqueStringValues(enrollmentRows.map((row) => row.turma_id));
  const studentIds = uniqueStringValues(enrollmentRows.map((row) => row.aluno_id));

  const [classRowsResult, studentRowsResult, studentUsersResult] = await Promise.all([
    classIds.length
      ? supabase.from("turmas").select("*").in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("alunos").select("*").in("usuario_id", studentIds)
      : Promise.resolve({ data: [], error: null }),
    studentIds.length
      ? supabase.from("usuarios").select("*").in("id", studentIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (
    classRowsResult.error ||
    studentRowsResult.error ||
    studentUsersResult.error
  ) {
    throw new Error("clinical-reference-load-failed");
  }

  let classRows = (classRowsResult.data ?? []) as ClassRow[];
  const unitIds = uniqueStringValues(caseRows.map((caseRow) => caseRow.unidade_id));
  const semesterIds = uniqueStringValues(classRows.map((classGroup) => classGroup.semestre_id));
  const { data: semesterRowsData, error: semesterError } = semesterIds.length
    ? await supabase.from("semestres").select("*").in("id", semesterIds)
    : { data: [], error: null };
  const { data: unitRowsData, error: unitError } = unitIds.length
    ? await supabase.from("unidades").select("*").in("id", unitIds)
    : { data: [], error: null };

  if (semesterError || unitError) {
    throw new Error("clinical-reference-load-failed");
  }

  const semesterRows = (semesterRowsData ?? []) as SemesterRow[];
  classRows = filterClassesToSemesters(classRows, semesterRows);
  enrollmentRows = filterEnrollmentsToClasses(enrollmentRows, classRows);
  const studentUsers = (studentUsersResult.data ?? []) as UserRow[];
  const areaIds = uniqueStringValues(classRows.map((classGroup) => classGroup.area_estagio_id));
  const { data: areaRowsData, error: areaError } = areaIds.length
    ? await supabase.from("areas_estagio").select("*").in("id", areaIds)
    : { data: [], error: null };

  if (areaError) {
    throw new Error("clinical-reference-load-failed");
  }

  const schedulesByCaseId = new Map<string, ClinicalCaseScheduleSlot[]>();

  for (const scheduleRow of (scheduleRowsResult.data ?? []) as ClinicalCaseScheduleRow[]) {
    const currentCaseSchedules = schedulesByCaseId.get(scheduleRow.caso_clinico_id) ?? [];
    currentCaseSchedules.push({
      id: scheduleRow.id,
      weekday: scheduleRow.dia_semana,
      appointmentTime: normalizeTime(scheduleRow.horario_atendimento)
    });
    schedulesByCaseId.set(
      scheduleRow.caso_clinico_id,
      sortClinicalSchedules(currentCaseSchedules)
    );
  }

  return {
    patientsById: new Map(
      ((patientRowsResult.data ?? []) as ClinicalPatientRow[]).map((row) => [row.id, row])
    ),
    enrollmentsById: new Map(enrollmentRows.map((row) => [row.id, row])),
    classesById: new Map(classRows.map((row) => [row.id, row])),
    semestersById: new Map(semesterRows.map((row) => [row.id, row])),
    unitsById: new Map(((unitRowsData ?? []) as UnitRow[]).map((row) => [row.id, row])),
    studentsById: new Map(
      ((studentRowsResult.data ?? []) as StudentRow[]).map((row) => [row.usuario_id, row])
    ),
    studentUsersById: new Map(studentUsers.map((row) => [row.id, row])),
    professorsById: new Map(
      ((professorUsersResult.data ?? []) as UserRow[]).map((row) => [row.id, row])
    ),
    areasById: new Map(((areaRowsData ?? []) as AreaRow[]).map((row) => [row.id, row])),
    schedulesByCaseId
  };
}

async function loadAccessibleClinicalCaseRows(input: {
  currentUser: SessionUser;
  caseId?: string;
  caseIds?: string[];
  patientId?: string;
  onlyActive?: boolean;
}) {
  const serverSupabase = await createSupabaseServerClient();
  const queryClient =
    input.currentUser.role === "coordenador_master" ||
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : serverSupabase;
  let query = queryClient.from("casos_clinicos").select("*");

  if (input.caseId) {
    query = query.eq("id", input.caseId);
  }

  if (input.caseIds?.length) {
    query = query.in("id", uniqueStringValues(input.caseIds));
  }

  if (input.patientId) {
    query = query.eq("paciente_id", input.patientId);
  }

  if (input.onlyActive) {
    query = query.eq("ativo", true);
  }

  if (input.currentUser.role === "professor") {
    query = query.eq("professor_id", input.currentUser.id);
  } else if (input.currentUser.role === "aluno") {
    const { data: studentEnrollmentRowsData, error: studentEnrollmentRowsError } =
      await serverSupabase
        .from("matriculas_turma")
        .select("id")
        .eq("aluno_id", input.currentUser.id);

    if (studentEnrollmentRowsError) {
      throw new Error("clinical-student-enrollment-scope-load-failed");
    }

    const enrollmentIds = uniqueStringValues(
      ((studentEnrollmentRowsData ?? []) as Array<{ id: string }>).map((row) => row.id)
    );

    if (!enrollmentIds.length) {
      return [] as ClinicalCaseRow[];
    }

    query = query.in("matricula_turma_id", enrollmentIds);
  } else if (
    input.currentUser.role === "coordenador" ||
    input.currentUser.role === "secretaria"
  ) {
    const scopedGraph = await loadScopedOperationalGraph(input.currentUser, {
      supabase: queryClient
    });

    if (
      scopedGraph.scope.scopeKind === "none" ||
      (scopedGraph.scope.restrictToCourse &&
        scopedGraph.scope.offerIds.length === 0)
    ) {
      return [] as ClinicalCaseRow[];
    }

    const enrollmentIds = uniqueStringValues(
      scopedGraph.enrollmentRows.map((row) => row.id)
    );

    if (!enrollmentIds.length) {
      return [] as ClinicalCaseRow[];
    }

    query = query.in("matricula_turma_id", enrollmentIds);
  } else if (input.currentUser.role !== "coordenador_master") {
    return [] as ClinicalCaseRow[];
  }

  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) {
    throw new Error("clinical-institutional-case-load-failed");
  }

  return (data ?? []) as ClinicalCaseRow[];
}

async function loadAccessibleClinicalCaseRow(
  currentUser: SessionUser,
  caseId: string
) {
  const caseRows = await loadAccessibleClinicalCaseRows({
    currentUser,
    caseId
  });

  return caseRows[0] ?? null;
}

async function loadClinicalPendingEvolutionSummaries(
  currentUser: SessionUser
): Promise<ClinicalPendingEvolutionSummary[]> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "secretaria"
  ) {
    return [];
  }

  const pendingStatuses =
    currentUser.role === "professor" || currentUser.role === "secretaria"
      ? ([
          "pendente",
          "enviada",
          "ajustes_solicitados"
        ] satisfies ClinicalAttendanceEvolutionStatus[])
      : (["pendente", "ajustes_solicitados"] satisfies ClinicalAttendanceEvolutionStatus[]);
  const attendanceRows = await loadClinicalAttendanceRowsByStatus({
    currentUser,
    studentId: currentUser.role === "aluno" ? currentUser.id : undefined,
    professorId: currentUser.role === "professor" ? currentUser.id : undefined,
    evolutionStatuses: pendingStatuses
  });

  if (!attendanceRows.length) {
    return [];
  }

  const caseRows = await loadAccessibleClinicalCaseRows({
    currentUser,
    caseIds: uniqueStringValues(attendanceRows.map((row) => row.caso_clinico_id))
  });

  if (!caseRows.length) {
    return [];
  }

  const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
  const caseSummaries = mapClinicalCaseSummaries(caseRows, bundle);
  const caseMap = new Map(caseSummaries.map((caseItem) => [caseItem.id, caseItem]));
  const recordRows = await loadClinicalRecordRowsByAttendanceIds({
    currentUser,
    attendanceIds: uniqueStringValues(attendanceRows.map((row) => row.id))
  });
  const recordMap = new Map(
    recordRows.map((recordRow) => [
      recordRow.atendimento_clinico_id ?? "",
      recordRow
    ])
  );

  return attendanceRows
    .map((attendanceRow) => {
      const caseItem = caseMap.get(attendanceRow.caso_clinico_id);

      if (!caseItem) {
        return null;
      }

      const schedule =
        caseItem.schedules.find(
          (slot) => slot.id === attendanceRow.caso_clinico_horario_id
        ) ?? caseItem.schedules[0] ?? null;
      const summary = buildClinicalAttendanceSummary({
        caseItem,
        attendanceDate: attendanceRow.data_atendimento,
        scheduleId: attendanceRow.caso_clinico_horario_id,
        appointmentTime: schedule?.appointmentTime ?? caseItem.appointmentTime,
        attendanceRow,
        evolutionRecord: recordMap.get(attendanceRow.id) ?? null
      });

      return buildClinicalPendingEvolutionSummary(summary);
    })
    .filter(Boolean)
    .sort((left, right) => {
      const dateDiff = left!.appointmentDate.localeCompare(right!.appointmentDate);

      if (dateDiff !== 0) {
        return dateDiff;
      }

      return left!.appointmentTime.localeCompare(right!.appointmentTime, "pt-BR");
    }) as ClinicalPendingEvolutionSummary[];
}

async function loadScopedClinicalAttendanceRow(input: {
  currentUser: SessionUser;
  caseId: string;
  attendanceId: string;
}) {
  const supabase =
    input.currentUser.role === "coordenador_master" ||
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let query = supabase
    .from("atendimentos_clinicos")
    .select("*")
    .eq("id", input.attendanceId)
    .eq("caso_clinico_id", input.caseId);

  if (input.currentUser.role === "aluno") {
    query = query.eq("aluno_id", input.currentUser.id);
  } else if (input.currentUser.role === "professor") {
    query = query.eq("professor_id", input.currentUser.id);
  } else if (input.currentUser.role === "coordenador" && input.currentUser.unitId) {
    query = query.eq("unidade_id", input.currentUser.unitId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error("clinical-attendance-scope-load-failed");
  }

  return (data ?? null) as ClinicalAttendanceRow | null;
}

function mapClinicalCaseSummaries(
  caseRows: ClinicalCaseRow[],
  bundle: ClinicalReferenceBundle
) {
  return caseRows
    .map((caseRow) => {
      const unit = caseRow.unidade_id
        ? bundle.unitsById.get(caseRow.unidade_id) ?? null
        : null;
      const patient = bundle.patientsById.get(caseRow.paciente_id);
      const enrollment = bundle.enrollmentsById.get(caseRow.matricula_turma_id);
      const classGroup = enrollment
        ? bundle.classesById.get(enrollment.turma_id)
        : null;
      const semester = classGroup
        ? bundle.semestersById.get(classGroup.semestre_id)
        : null;
      const studentRow = enrollment
        ? bundle.studentsById.get(enrollment.aluno_id)
        : null;
      const studentUser = enrollment
        ? bundle.studentUsersById.get(enrollment.aluno_id) ?? null
        : null;
      const professorUser = bundle.professorsById.get(caseRow.professor_id);
      const area = caseRow.area_estagio_id
        ? bundle.areasById.get(caseRow.area_estagio_id) ?? null
        : null;
      const schedules = bundle.schedulesByCaseId.get(caseRow.id) ?? [];

      if (
        !patient ||
        !enrollment ||
        !classGroup ||
        !semester ||
        !studentRow ||
        !professorUser
      ) {
        return null;
      }

      return buildClinicalCaseSummary({
        caseRow,
        unit,
        patient,
        enrollment,
        classGroup,
        semester,
        studentRow,
        studentUser,
        professorUser,
        area,
        schedules
      });
    })
    .filter(Boolean)
    .sort((left, right) =>
      right!.updatedAt.localeCompare(left!.updatedAt)
    ) as ClinicalCaseSummary[];
}

function isClinicalCaseScheduledOnDate(input: {
  caseRow: ClinicalCaseRow;
  attendanceDate: string;
  weekday: ClinicalWeekday;
  schedules: ClinicalCaseScheduleSlot[];
}) {
  if (!input.caseRow.data_inicio || input.caseRow.data_inicio > input.attendanceDate) {
    return false;
  }

  if (input.caseRow.data_fim && input.caseRow.data_fim < input.attendanceDate) {
    return false;
  }

  const schedules =
    input.schedules.length > 0
      ? input.schedules
      : [
          {
            id: `legacy-${input.caseRow.id}`,
            weekday: input.caseRow.dia_semana,
            appointmentTime: normalizeTime(input.caseRow.horario_atendimento)
          } satisfies ClinicalCaseScheduleSlot
        ];

  return schedules.some((schedule) => schedule.weekday === input.weekday);
}

async function loadClinicalAttendanceRowsByDate(input: {
  currentUser: SessionUser;
  date: string;
  caseIds: string[];
}) {
  if (!input.caseIds.length) {
    return [] as ClinicalAttendanceRow[];
  }

  const supabase =
    input.currentUser.role === "coordenador_master" ||
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("atendimentos_clinicos")
    .select("*")
    .in("caso_clinico_id", input.caseIds)
    .eq("data_atendimento", input.date);

  if (error) {
    throw new Error("clinical-attendance-load-failed");
  }

  return (data ?? []) as ClinicalAttendanceRow[];
}

async function loadClinicalAttendanceRowsByStatus(input: {
  currentUser: SessionUser;
  studentId?: string;
  professorId?: string;
  evolutionStatuses: ClinicalAttendanceEvolutionStatus[];
}) {
  const supabase =
    input.currentUser.role === "coordenador_master" ||
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let query = supabase
    .from("atendimentos_clinicos")
    .select("*")
    .eq("status_presenca", "presente")
    .in("status_evolucao", input.evolutionStatuses)
    .order("data_atendimento", { ascending: true });

  if (input.studentId) {
    query = query.eq("aluno_id", input.studentId);
  }

  if (input.professorId) {
    query = query.eq("professor_id", input.professorId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error("clinical-pending-attendance-load-failed");
  }

  return (data ?? []) as ClinicalAttendanceRow[];
}

async function loadClinicalRecordRowsByAttendanceIds(input: {
  currentUser: SessionUser;
  attendanceIds: string[];
}) {
  if (!input.attendanceIds.length) {
    return [] as ClinicalRecordRow[];
  }

  const supabase =
    input.currentUser.role === "coordenador_master" ||
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("tipo", "evolucao")
    .in("atendimento_clinico_id", input.attendanceIds);

  if (error) {
    throw new Error("clinical-attendance-record-load-failed");
  }

  return (data ?? []) as ClinicalRecordRow[];
}

function buildClinicalAttendanceSummary(input: {
  caseItem: ClinicalCaseSummary;
  attendanceDate: string;
  scheduleId: string | null;
  appointmentTime: string;
  attendanceRow?: ClinicalAttendanceRow | null;
  evolutionRecord?: ClinicalRecordRow | null;
}): ClinicalAttendanceSummary {
  const attendanceRow = input.attendanceRow ?? null;
  const evolutionRecord = input.evolutionRecord ?? null;
  const presenceStatus = attendanceRow?.status_presenca ?? null;
  const evolutionStatus =
    presenceStatus === "presente"
      ? evolutionRecord
        ? resolveClinicalAttendanceEvolutionStatusFromRecordStatus(
            evolutionRecord.status
          )
        : attendanceRow?.status_evolucao ?? null
      : attendanceRow?.status_evolucao ?? null;

  return {
    attendanceId: attendanceRow?.id ?? null,
    caseItem: input.caseItem,
    appointmentDate: input.attendanceDate,
    scheduleId: input.scheduleId,
    appointmentTime: input.appointmentTime,
    presenceStatus,
    evolutionStatus,
    administrativeNote: attendanceRow?.observacao_administrativa ?? null,
    recordedAt: attendanceRow?.registrado_em ?? null,
    recordedById: attendanceRow?.registrado_por ?? null,
    evolutionRecordId: evolutionRecord?.id ?? null
  };
}

function getClinicalOpenDaysSinceAttendanceDate(value: string) {
  const todayTimestamp = getDateValueTimestamp(getTodayInSaoPaulo());
  const appointmentTimestamp = getDateValueTimestamp(value);

  if (todayTimestamp === null || appointmentTimestamp === null) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((todayTimestamp - appointmentTimestamp) / (1000 * 60 * 60 * 24))
  );
}

function buildClinicalPendingEvolutionSummary(
  attendance: ClinicalAttendanceSummary
): ClinicalPendingEvolutionSummary | null {
  if (
    !attendance.attendanceId ||
    attendance.presenceStatus !== "presente" ||
    !attendance.evolutionStatus
  ) {
    return null;
  }

  return {
    attendanceId: attendance.attendanceId,
    caseItem: attendance.caseItem,
    appointmentDate: attendance.appointmentDate,
    scheduleId: attendance.scheduleId,
    appointmentTime: attendance.appointmentTime,
    evolutionStatus: attendance.evolutionStatus,
    administrativeNote: attendance.administrativeNote,
    evolutionRecordId: attendance.evolutionRecordId,
    openDays: getClinicalOpenDaysSinceAttendanceDate(attendance.appointmentDate)
  };
}

export async function getClinicalUnreadNotificationCount(
  currentUser: SessionUser
): Promise<number> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return 0;
  }

  const supabase = await createSupabaseServerClient();
  const { data: unreadRowsData, error } = await supabase
    .from("notificacoes_clinicas")
    .select("caso_clinico_id, registro_clinico_id, tipo, lida")
    .eq("usuario_id", currentUser.id)
    .eq("lida", false);

  if (error || !unreadRowsData?.length) {
    return 0;
  }

  const unreadRows = unreadRowsData as Array<{
    caso_clinico_id: string;
    registro_clinico_id: string | null;
    tipo: ClinicalNotificationType;
    lida: boolean;
  }>;
  const caseIds = uniqueStringValues(unreadRows.map((row) => row.caso_clinico_id));
  const { data: recordRowsData, error: recordError } = caseIds.length
    ? await supabase
        .from("registros_clinicos")
        .select("id, caso_clinico_id, tipo, status")
        .in("tipo", ["avaliacao", "plano_tratamento", "evolucao"])
        .in("caso_clinico_id", caseIds)
    : { data: [], error: null };

  if (recordError) {
    return 0;
  }

  const statusByRecordKey = new Map<string, ClinicalRecordStatus>();

  for (const recordRow of (recordRowsData ?? []) as Array<{
    id: string;
    caso_clinico_id: string;
    tipo: ClinicalRecordType;
    status: ClinicalRecordStatus;
  }>) {
    statusByRecordKey.set(
      buildClinicalRecordStatusKey({
        caseId: recordRow.caso_clinico_id,
        recordType: recordRow.tipo,
        recordId: recordRow.id
      }),
      recordRow.status
    );
    statusByRecordKey.set(
      buildClinicalRecordStatusKey({
        caseId: recordRow.caso_clinico_id,
        recordType: recordRow.tipo
      }),
      recordRow.status
    );
  }

  const unreadPendingKeys = new Set<string>();

  for (const row of unreadRows) {
    const pendingKey = buildClinicalNotificationPendingKey({
      caseId: row.caso_clinico_id,
      type: row.tipo,
      recordId: row.registro_clinico_id
    });

    const isPending = isClinicalNotificationPending({
      role: currentUser.role,
      type: row.tipo,
      read: row.lida,
      status:
        statusByRecordKey.get(
          buildClinicalRecordStatusKey({
            caseId: row.caso_clinico_id,
            recordType: getClinicalNotificationRecordType(row.tipo),
            recordId: row.registro_clinico_id
          })
        ) ?? null
    });

    if (isPending) {
      unreadPendingKeys.add(pendingKey);
    }
  }

  return unreadPendingKeys.size;
}

async function loadClinicalNotificationCenter(
  currentUser: SessionUser,
  cases: ClinicalCaseSummary[]
): Promise<{
  center: ClinicalNotificationCenter;
  pendingCaseMap: Map<
    string,
    {
      type: ClinicalNotificationType;
      label: string;
      unreadCount: number;
    }
  >;
}> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      center: {
        unreadCount: 0,
        pendingItems: [],
        historyItems: []
      },
      pendingCaseMap: new Map()
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseIds = uniqueStringValues(cases.map((caseItem) => caseItem.id));
  const [historyResult, recordResult] = await Promise.all([
    supabase
      .from("notificacoes_clinicas")
      .select("*")
      .eq("usuario_id", currentUser.id)
      .order("created_at", { ascending: false }),
    caseIds.length
      ? supabase
          .from("registros_clinicos")
          .select("id, caso_clinico_id, tipo, status")
          .in("tipo", ["avaliacao", "plano_tratamento", "evolucao"])
          .in("caso_clinico_id", caseIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (historyResult.error || recordResult.error) {
    return {
      center: {
        unreadCount: 0,
        pendingItems: [],
        historyItems: []
      },
      pendingCaseMap: new Map()
    };
  }

  const caseMap = new Map(cases.map((caseItem) => [caseItem.id, caseItem]));
  const historyRows = (historyResult.data ?? []) as ClinicalNotificationRow[];
  const historyItems = historyRows
    .map((row) => {
      const caseItem = caseMap.get(row.caso_clinico_id);
      return caseItem ? buildClinicalNotificationSummary({ row, caseItem }) : null;
    })
    .filter(Boolean) as ClinicalNotificationSummary[];
  const statusByRecordKey = new Map<string, ClinicalRecordStatus>();

  for (const recordRow of (recordResult.data ?? []) as Array<{
    id: string;
    caso_clinico_id: string;
    tipo: ClinicalRecordType;
    status: ClinicalRecordStatus;
  }>) {
    statusByRecordKey.set(
      buildClinicalRecordStatusKey({
        caseId: recordRow.caso_clinico_id,
        recordType: recordRow.tipo,
        recordId: recordRow.id
      }),
      recordRow.status
    );
    statusByRecordKey.set(
      buildClinicalRecordStatusKey({
        caseId: recordRow.caso_clinico_id,
        recordType: recordRow.tipo
      }),
      recordRow.status
    );
  }

  const pendingItems: ClinicalNotificationSummary[] = [];
  const pendingCaseMap = new Map<
    string,
    {
      type: ClinicalNotificationType;
      label: string;
      unreadCount: number;
    }
  >();
  const pendingCaseTimestampMap = new Map<string, string>();

  const latestPendingRowByKey = new Map<string, ClinicalNotificationRow>();
  const unreadPendingKeySet = new Set<string>();

  for (const row of historyRows) {
    const recordType = getClinicalNotificationRecordType(row.tipo);
    const pendingKey = buildClinicalNotificationPendingKey({
      caseId: row.caso_clinico_id,
      type: row.tipo,
      recordId: row.registro_clinico_id
    });
    const currentStatus =
      statusByRecordKey.get(
        buildClinicalRecordStatusKey({
          caseId: row.caso_clinico_id,
          recordType,
          recordId: row.registro_clinico_id
        })
      ) ?? null;

    if (
      !isClinicalNotificationPending({
        role: currentUser.role,
        type: row.tipo,
        read: row.lida,
        status: currentStatus
      })
    ) {
      continue;
    }

    if (!latestPendingRowByKey.has(pendingKey)) {
      latestPendingRowByKey.set(pendingKey, row);
    }

    if (!row.lida) {
      unreadPendingKeySet.add(pendingKey);
    }
  }

  const pendingSummaries = [...latestPendingRowByKey.entries()]
    .map(([pendingKey, row]) => {
      const caseItem = caseMap.get(row.caso_clinico_id);

      if (!caseItem) {
        return null;
      }

      return {
        summary: buildClinicalNotificationSummary({ row, caseItem }),
        unreadPendingCount: unreadPendingKeySet.has(pendingKey) ? 1 : 0
      };
    })
    .filter(Boolean) as Array<{
    summary: ClinicalNotificationSummary;
    unreadPendingCount: number;
  }>;

  const unreadPendingCountByCaseId = new Map<string, number>();

  for (const pendingEntry of pendingSummaries) {
    if (pendingEntry.unreadPendingCount > 0) {
      unreadPendingCountByCaseId.set(
        pendingEntry.summary.caseId,
        (unreadPendingCountByCaseId.get(pendingEntry.summary.caseId) ?? 0) + 1
      );
    }
  }

  for (const pendingEntry of pendingSummaries) {
    pendingItems.push(pendingEntry.summary);

    const currentTimestamp = pendingCaseTimestampMap.get(pendingEntry.summary.caseId);

    if (
      !currentTimestamp ||
      pendingEntry.summary.createdAt > currentTimestamp
    ) {
      pendingCaseMap.set(pendingEntry.summary.caseId, {
        type: pendingEntry.summary.type,
        label: pendingEntry.summary.actionLabel,
        unreadCount:
          unreadPendingCountByCaseId.get(pendingEntry.summary.caseId) ?? 0
      });
      pendingCaseTimestampMap.set(
        pendingEntry.summary.caseId,
        pendingEntry.summary.createdAt
      );
    }
  }

  return {
    center: {
      unreadCount: unreadPendingKeySet.size,
      pendingItems: pendingItems.sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt)
      ),
      historyItems
    },
    pendingCaseMap
  };
}

export async function getClinicalSupervisionPageData(
  currentUser: SessionUser
): Promise<ClinicalSupervisionPageLoadResult> {
  if (currentUser.role === "professor") {
    const { context, emptyState } = await loadProfessorClinicalContext(currentUser);

    if (!context || emptyState) {
      return {
        pageData: null,
        emptyState
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: caseRowsData, error: caseError } = await supabase
      .from("casos_clinicos")
      .select("*")
      .eq("professor_id", currentUser.id)
      .order("updated_at", { ascending: false });

    if (caseError) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível carregar os casos clínicos",
          "Houve um problema ao consultar os pacientes atribuídos à sua supervisão clínica."
        )
      };
    }

    const caseRows = (caseRowsData ?? []) as ClinicalCaseRow[];

    try {
      const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
      const baseCases = mapClinicalCaseSummaries(caseRows, bundle);
      const [notificationCenter, attendancePendings] = await Promise.all([
        loadClinicalNotificationCenter(currentUser, baseCases),
        loadClinicalPendingEvolutionSummaries(currentUser)
      ]);
      const cases = baseCases.map((caseItem) => {
        const pendingNotification = notificationCenter.pendingCaseMap.get(caseItem.id);

        return {
          ...caseItem,
          notificationType: pendingNotification?.type ?? null,
          notificationLabel: pendingNotification?.label ?? null,
          notificationUnreadCount: pendingNotification?.unreadCount ?? 0
        };
      });

      return {
        pageData: {
          view: "professor",
          professor: context.professor,
          studentOptions: context.studentOptions,
          cases,
          attendancePendings,
          notifications: notificationCenter.center,
          metrics: {
            totalCases: cases.length,
            activeCases: cases.filter((caseItem) => caseItem.active).length,
            linkedStudents: new Set(
              cases.map((caseItem) => caseItem.studentId)
            ).size
          },
          emptyHint: context.emptyHint
        },
        emptyState: null
      };
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível consolidar a Clínica Supervisionada",
          "Os casos clínicos foram encontrados, mas os dados derivados de aluno, turma, área ou paciente não puderam ser montados."
        )
      };
    }
  }

  if (currentUser.role === "aluno") {
    let caseRows: ClinicalCaseRow[] = [];

    try {
      caseRows = await loadAccessibleClinicalCaseRows({
        currentUser,
        onlyActive: true
      });
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível carregar seus pacientes",
          "Houve um problema ao consultar os casos clínicos vinculados ao aluno autenticado."
        )
      };
    }

    try {
      const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
      const cases = applyClinicalStudentSensitiveMaskToCases(
        mapClinicalCaseSummaries(caseRows, bundle),
        currentUser
      );
      const [notificationCenter, attendancePendings] = await Promise.all([
        loadClinicalNotificationCenter(currentUser, cases),
        loadClinicalPendingEvolutionSummaries(currentUser)
      ]);
      const casesWithNotifications = cases.map((caseItem) => {
        const pendingNotification = notificationCenter.pendingCaseMap.get(caseItem.id);

        return {
          ...caseItem,
          notificationType: pendingNotification?.type ?? null,
          notificationLabel: pendingNotification?.label ?? null,
          notificationUnreadCount: pendingNotification?.unreadCount ?? 0
        };
      });

      return {
        pageData: {
          view: "aluno",
          student: {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email
          },
          cases: casesWithNotifications,
          attendancePendings,
          notifications: notificationCenter.center,
          metrics: {
            totalCases: casesWithNotifications.length,
            activeCases: casesWithNotifications.filter((caseItem) => caseItem.active)
              .length,
            updatedCases: casesWithNotifications.filter(
              (caseItem) => Boolean(caseItem.notificationLabel)
            ).length
          },
          emptyHint: casesWithNotifications.length
            ? null
            : "Assim que um professor atribuir pacientes ao seu estágio atual, eles aparecerão aqui."
        },
        emptyState: null
      };
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível consolidar seus pacientes",
          "Os casos clínicos foram encontrados, mas o contexto acadêmico do aluno não pôde ser reconstruído."
        )
      };
    }
  }

  if (currentUser.role === "secretaria") {
    const { context, emptyState } = await loadScopedClinicalOperatorContext(currentUser);

    if (!context || emptyState) {
      return {
        pageData: null,
        emptyState
      };
    }

    const activeContext = context;
    let caseRows: ClinicalCaseRow[] = [];

    try {
      caseRows = await loadAccessibleClinicalCaseRows({
        currentUser
      });
      const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
      const cases = mapClinicalCaseSummaries(caseRows, bundle);

      return {
        pageData: {
          view: "secretaria",
          operator: activeContext.operator,
          studentOptions: activeContext.studentOptions,
          cases,
          metrics: {
            totalCases: cases.length,
            activeCases: cases.filter((caseItem) => caseItem.active).length,
            linkedStudents: new Set(cases.map((caseItem) => caseItem.studentId)).size
          },
          emptyHint: activeContext.emptyHint
        },
        emptyState: null
      };
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "NÃ£o foi possÃ­vel consolidar a rotina administrativa da clÃ­nica",
          "Os casos clÃ­nicos visÃ­veis foram encontrados, mas os dados de aluno, Ã¡rea, paciente ou agenda nÃ£o puderam ser consolidados."
        )
      };
    }

    if (!currentUser.unitId) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Unidade operacional não identificada",
          "A secretária autenticada precisa estar vinculada a uma unidade para acessar a Clínica Supervisionada."
        )
      };
    }

    const adminClient = createSupabaseAdminClient();
    const { data: caseRowsData, error: caseError } = await adminClient
      .from("casos_clinicos")
      .select("*")
      .eq("unidade_id", currentUser.unitId ?? "__no_unit__")
      .order("updated_at", { ascending: false });

    if (caseError) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível carregar os pacientes agendados",
          "Houve um problema ao consultar os casos clínicos da unidade para a rotina administrativa."
        )
      };
    }

    try {
      const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
      const cases = mapClinicalCaseSummaries(caseRows, bundle);

      return {
        pageData: {
          view: "secretaria",
          operator: activeContext.operator,
          studentOptions: activeContext.studentOptions,
          cases,
          metrics: {
            totalCases: cases.length,
            activeCases: cases.filter((caseItem) => caseItem.active).length,
            linkedStudents: new Set(cases.map((caseItem) => caseItem.studentId)).size
          },
          emptyHint: activeContext.emptyHint
        },
        emptyState: null
      };
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível consolidar a rotina administrativa da clínica",
          "Os casos clínicos da unidade foram encontrados, mas os dados de aluno, área, paciente ou agenda não puderam ser consolidados."
        )
      };
    }
  }

  return {
    pageData: null,
    emptyState: buildEmptyState(
      "Módulo indisponível para este perfil",
      "Nesta fase, a Clínica Supervisionada está disponível apenas para professores e alunos."
    )
  };
}

function normalizeClinicalAttendanceStatusFilter(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  return ["todos", "aguardando_marcacao", "paciente_presente", "paciente_ausente"].includes(
    normalizedValue
  )
    ? normalizedValue
    : "todos";
}

function matchesClinicalAttendanceStatusFilter(
  item: ClinicalAttendanceSummary,
  filterValue: string
) {
  switch (filterValue) {
    case "aguardando_marcacao":
      return item.presenceStatus === null;
    case "paciente_presente":
      return item.presenceStatus === "presente";
    case "paciente_ausente":
      return item.presenceStatus === "ausente";
    default:
      return true;
  }
}

function normalizeClinicalPendingEvolutionStatusFilter(value?: string | null) {
  const normalizedValue = value?.trim() ?? "";

  return ["todos", "pendente", "enviada", "ajustes_solicitados"].includes(
    normalizedValue
  )
    ? normalizedValue
    : "todos";
}

export async function getClinicalDailyAttendancePageData(
  currentUser: SessionUser,
  filters?: {
    date?: string | null;
    areaId?: string | null;
    professorId?: string | null;
    status?: string | null;
    pendingAreaId?: string | null;
    pendingStudentId?: string | null;
    pendingStatus?: string | null;
  }
): Promise<ClinicalDailyAttendanceLoadResult> {
  if (currentUser.role !== "professor" && currentUser.role !== "secretaria") {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "MÃ³dulo indisponÃ­vel para este perfil",
        "Nesta fase, os atendimentos do dia podem ser acompanhados apenas por professores e secretaria."
      )
    };
  }

  const selectedDate = normalizeDateOnlyValue(filters?.date) ?? getTodayInSaoPaulo();
  const weekday = getClinicalWeekdayFromDate(selectedDate);

  if (!weekday) {
    return {
      pageData: {
        view: currentUser.role,
        viewerName: currentUser.name,
        selectedDate,
        filters: {
          areaId: "",
          professorId: "",
          status: "todos"
        },
        filterOptions: {
          areas: [],
          professors: [],
          statuses: [{ value: "todos", label: "Todos os status" }]
        },
        metrics: {
          scheduledCount: 0,
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0
        },
        items: [],
        pendingFilters: {
          areaId: "",
          studentId: "",
          status: "todos"
        },
        pendingFilterOptions: {
          areas: [],
          students: [],
          statuses: [{ value: "todos", label: "Todos os status" }]
        },
        pendingMetrics: {
          totalOpenCount: 0,
          pendingCount: 0,
          sentCount: 0,
          adjustmentCount: 0
        },
        pendingItems: []
      },
      emptyState: null
    };
  }

  let caseRows: ClinicalCaseRow[] = [];

  try {
    caseRows = await loadAccessibleClinicalCaseRows({
      currentUser
    });
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "NÃ£o foi possÃ­vel carregar os casos clÃ­nicos",
        "Houve um problema ao consultar o escopo operacional necessÃ¡rio para montar os atendimentos do dia."
      )
    };
  }

  if (!caseRows.length) {
    return {
      pageData: {
        view: currentUser.role,
        viewerName: currentUser.name,
        selectedDate,
        filters: {
          areaId: "",
          professorId: "",
          status: "todos"
        },
        filterOptions: {
          areas: [],
          professors: [],
          statuses: [{ value: "todos", label: "Todos os status" }]
        },
        metrics: {
          scheduledCount: 0,
          presentCount: 0,
          absentCount: 0,
          pendingCount: 0
        },
        items: [],
        pendingFilters: {
          areaId: "",
          studentId: "",
          status: "todos"
        },
        pendingFilterOptions: {
          areas: [],
          students: [],
          statuses: [{ value: "todos", label: "Todos os status" }]
        },
        pendingMetrics: {
          totalOpenCount: 0,
          pendingCount: 0,
          sentCount: 0,
          adjustmentCount: 0
        },
        pendingItems: []
      },
      emptyState: null
    };
  }

  try {
    const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
    const caseSummaries = mapClinicalCaseSummaries(caseRows, bundle);
    const pendingSummaries = await loadClinicalPendingEvolutionSummaries(currentUser);
    const caseMap = new Map(caseSummaries.map((caseItem) => [caseItem.id, caseItem]));
    const attendanceRows = await loadClinicalAttendanceRowsByDate({
      currentUser,
      date: selectedDate,
      caseIds: caseSummaries.map((caseItem) => caseItem.id)
    });
    const attendanceMap = new Map(
      attendanceRows.map((attendanceRow) => [
        buildClinicalAttendanceCaseKey({
          caseId: attendanceRow.caso_clinico_id,
          attendanceDate: attendanceRow.data_atendimento,
          scheduleId: attendanceRow.caso_clinico_horario_id
        }),
        attendanceRow
      ])
    );
    const recordRows = await loadClinicalRecordRowsByAttendanceIds({
      currentUser,
      attendanceIds: uniqueStringValues(attendanceRows.map((attendanceRow) => attendanceRow.id))
    });
    const recordMap = new Map(
      recordRows.map((recordRow) => [recordRow.atendimento_clinico_id ?? "", recordRow])
    );
    const scheduledItems: ClinicalAttendanceSummary[] = [];

    for (const caseRow of caseRows) {
      const caseItem = caseMap.get(caseRow.id);

      if (!caseItem) {
        continue;
      }

      if (
        !isClinicalCaseScheduledOnDate({
          caseRow,
          attendanceDate: selectedDate,
          weekday,
          schedules: caseItem.schedules
        })
      ) {
        continue;
      }

      const matchingSchedules = (
        caseItem.schedules.length
          ? caseItem.schedules.filter((schedule) => schedule.weekday === weekday)
          : [
              {
                id: `legacy-${caseItem.id}`,
                weekday,
                appointmentTime: caseItem.appointmentTime
              } satisfies ClinicalCaseScheduleSlot
            ]
      ).sort((left, right) =>
        left.appointmentTime.localeCompare(right.appointmentTime, "pt-BR")
      );

      for (const schedule of matchingSchedules) {
        const attendanceRow =
          attendanceMap.get(
            buildClinicalAttendanceCaseKey({
              caseId: caseItem.id,
              attendanceDate: selectedDate,
              scheduleId: schedule.id
            })
          ) ?? null;
        scheduledItems.push(
          buildClinicalAttendanceSummary({
            caseItem,
            attendanceDate: selectedDate,
            scheduleId: schedule.id,
            appointmentTime: schedule.appointmentTime,
            attendanceRow,
            evolutionRecord: attendanceRow ? recordMap.get(attendanceRow.id) ?? null : null
          })
        );
      }
    }

    for (const attendanceRow of attendanceRows) {
      const caseItem = caseMap.get(attendanceRow.caso_clinico_id);

      if (!caseItem) {
        continue;
      }

      const uniqueKey = buildClinicalAttendanceCaseKey({
        caseId: attendanceRow.caso_clinico_id,
        attendanceDate: attendanceRow.data_atendimento,
        scheduleId: attendanceRow.caso_clinico_horario_id
      });

      if (
        scheduledItems.some(
          (item) =>
            buildClinicalAttendanceCaseKey({
              caseId: item.caseItem.id,
              attendanceDate: item.appointmentDate,
              scheduleId: item.scheduleId
            }) === uniqueKey
        )
      ) {
        continue;
      }

      const schedule =
        caseItem.schedules.find(
          (slot) => slot.id === attendanceRow.caso_clinico_horario_id
        ) ?? caseItem.schedules[0] ?? null;

      scheduledItems.push(
        buildClinicalAttendanceSummary({
          caseItem,
          attendanceDate: attendanceRow.data_atendimento,
          scheduleId: attendanceRow.caso_clinico_horario_id,
          appointmentTime: schedule?.appointmentTime ?? caseItem.appointmentTime,
          attendanceRow,
          evolutionRecord: recordMap.get(attendanceRow.id) ?? null
        })
      );
    }

    const areaOptions = Array.from(
      new Map(
        scheduledItems
          .filter((item) => item.caseItem.areaId)
          .map((item) => [
            item.caseItem.areaId as string,
            { id: item.caseItem.areaId as string, name: item.caseItem.areaName }
          ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const professorOptions = Array.from(
      new Map(
        scheduledItems.map((item) => [
          item.caseItem.professorId,
          { id: item.caseItem.professorId, name: item.caseItem.professorName }
        ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const normalizedAreaId = areaOptions.some((option) => option.id === filters?.areaId)
      ? filters?.areaId?.trim() ?? ""
      : "";
    const normalizedProfessorId =
      currentUser.role === "secretaria" &&
      professorOptions.some((option) => option.id === filters?.professorId)
        ? filters?.professorId?.trim() ?? ""
        : currentUser.role === "professor"
          ? currentUser.id
          : "";
    const normalizedStatus = normalizeClinicalAttendanceStatusFilter(filters?.status);
    const filteredItems = scheduledItems
      .filter((item) =>
        normalizedAreaId ? item.caseItem.areaId === normalizedAreaId : true
      )
      .filter((item) =>
        normalizedProfessorId
          ? item.caseItem.professorId === normalizedProfessorId
          : true
      )
      .filter((item) => matchesClinicalAttendanceStatusFilter(item, normalizedStatus))
      .sort((left, right) => {
        const timeDiff = left.appointmentTime.localeCompare(
          right.appointmentTime,
          "pt-BR"
        );

        if (timeDiff !== 0) {
          return timeDiff;
        }

        return left.caseItem.patient.name.localeCompare(
          right.caseItem.patient.name,
          "pt-BR"
        );
      });
    const pendingAreaOptions = Array.from(
      new Map(
        pendingSummaries
          .filter((item) => item.caseItem.areaId)
          .map((item) => [
            item.caseItem.areaId as string,
            { id: item.caseItem.areaId as string, name: item.caseItem.areaName }
          ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const pendingStudentOptions = Array.from(
      new Map(
        pendingSummaries.map((item) => [
          item.caseItem.studentId,
          { id: item.caseItem.studentId, name: item.caseItem.studentName }
        ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
    const normalizedPendingAreaId = pendingAreaOptions.some(
      (option) => option.id === filters?.pendingAreaId
    )
      ? filters?.pendingAreaId?.trim() ?? ""
      : "";
    const normalizedPendingStudentId = pendingStudentOptions.some(
      (option) => option.id === filters?.pendingStudentId
    )
      ? filters?.pendingStudentId?.trim() ?? ""
      : "";
    const normalizedPendingStatus = normalizeClinicalPendingEvolutionStatusFilter(
      filters?.pendingStatus
    );
    const filteredPendingItems = pendingSummaries
      .filter((item) =>
        normalizedPendingAreaId ? item.caseItem.areaId === normalizedPendingAreaId : true
      )
      .filter((item) =>
        normalizedPendingStudentId
          ? item.caseItem.studentId === normalizedPendingStudentId
          : true
      )
      .filter((item) =>
        normalizedPendingStatus === "todos"
          ? true
          : item.evolutionStatus === normalizedPendingStatus
      );

    return {
      pageData: {
        view: currentUser.role,
        viewerName: currentUser.name,
        selectedDate,
        filters: {
          areaId: normalizedAreaId,
          professorId: currentUser.role === "professor" ? "" : normalizedProfessorId,
          status: normalizedStatus
        },
        filterOptions: {
          areas: areaOptions,
          professors: currentUser.role === "secretaria" ? professorOptions : [],
          statuses: [
            { value: "todos", label: "Todos os status" },
            { value: "aguardando_marcacao", label: "Aguardando marcação" },
            { value: "paciente_presente", label: "Paciente presente" },
            { value: "paciente_ausente", label: "Paciente ausente" }
          ]
        },
        metrics: {
          scheduledCount: filteredItems.length,
          presentCount: filteredItems.filter((item) => item.presenceStatus === "presente")
            .length,
          absentCount: filteredItems.filter((item) => item.presenceStatus === "ausente")
            .length,
          pendingCount: filteredItems.filter(
            (item) => item.evolutionStatus === "pendente"
          ).length
        },
        items: filteredItems,
        pendingFilters: {
          areaId: normalizedPendingAreaId,
          studentId: normalizedPendingStudentId,
          status: normalizedPendingStatus
        },
        pendingFilterOptions: {
          areas: pendingAreaOptions,
          students: pendingStudentOptions,
          statuses: [
            { value: "todos", label: "Todos os status" },
            { value: "pendente", label: "Pendentes" },
            { value: "enviada", label: "Enviadas para revisão" },
            { value: "ajustes_solicitados", label: "Ajustes solicitados" }
          ]
        },
        pendingMetrics: {
          totalOpenCount: filteredPendingItems.length,
          pendingCount: filteredPendingItems.filter(
            (item) => item.evolutionStatus === "pendente"
          ).length,
          sentCount: filteredPendingItems.filter(
            (item) => item.evolutionStatus === "enviada"
          ).length,
          adjustmentCount: filteredPendingItems.filter(
            (item) => item.evolutionStatus === "ajustes_solicitados"
          ).length
        },
        pendingItems: filteredPendingItems
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "NÃ£o foi possÃ­vel montar os atendimentos do dia",
        "Os casos clÃ­nicos foram encontrados, mas a agenda prevista e os registros diÃ¡rios ainda nÃ£o puderam ser consolidados."
      )
    };
  }
}

function createEmptyClinicalCaseInitialValues(): ClinicalCaseFormInitialValues {
  return {
    patientId: "",
    patientIdentifier: "",
    patientName: "",
    patientBirthDate: "",
    patientCpf: "",
    patientContact: "",
    patientCompanion: "",
    enrollmentId: "",
    schedules: [
      {
        row_id: "clinical-schedule-initial",
        weekday: "segunda",
        appointment_time: ""
      }
    ],
    status: "atribuido"
  };
}

export async function getProfessorClinicalCaseFormPageData(
  currentUser: SessionUser,
  caseId?: string
): Promise<ClinicalCaseFormLoadResult> {
  const { context, emptyState } = await loadProfessorClinicalContext(currentUser);

  if (!context || emptyState) {
    return {
      formData: null,
      emptyState
    };
  }

  if (!caseId) {
    return {
      formData: {
        operator: {
          ...context.professor,
          role: "professor"
        },
        studentOptions: context.studentOptions,
        mode: "create",
        currentCase: null,
        initialValues: createEmptyClinicalCaseInitialValues(),
        emptyHint: context.emptyHint
      },
      emptyState: null
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: caseRowData, error: caseError } = await supabase
    .from("casos_clinicos")
    .select("*")
    .eq("id", caseId)
    .eq("professor_id", currentUser.id)
    .maybeSingle();

  if (caseError || !caseRowData) {
    return {
      formData: null,
      emptyState: buildEmptyState(
        "Caso clínico não encontrado",
        "Não foi possível localizar um caso clínico editável para este professor."
      )
    };
  }

  const caseRow = caseRowData as ClinicalCaseRow;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    const currentCase = mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null;

    if (!currentCase) {
      return {
        formData: null,
        emptyState: buildEmptyState(
          "Caso clínico indisponível",
          "O caso foi encontrado, mas faltaram dados de aluno, paciente ou área para editá-lo nesta sessão."
        )
      };
    }

    const mergedOptions = new Map<string, ClinicalStudentOption>(
      context.studentOptionMap
    );
    if (!mergedOptions.has(currentCase.enrollmentId)) {
      mergedOptions.set(currentCase.enrollmentId, {
        enrollmentId: currentCase.enrollmentId,
        studentId: currentCase.studentId,
        studentName: currentCase.studentName,
        registration: currentCase.registration,
        classId: currentCase.classId,
        className: currentCase.className,
        semesterId: currentCase.semesterId,
        semesterCode: currentCase.semesterCode,
        areaId: currentCase.areaId,
        areaName: currentCase.areaName,
        exceptionalReleaseNotice: null,
        label: `${currentCase.studentName} · ${currentCase.registration} · ${currentCase.areaName} · ${currentCase.className} · ${currentCase.semesterCode}`
      });
    }

    return {
      formData: {
        operator: {
          ...context.professor,
          role: "professor"
        },
        studentOptions: [...mergedOptions.values()].sort((left, right) =>
          left.studentName.localeCompare(right.studentName, "pt-BR")
        ),
        mode: "edit",
        currentCase,
        initialValues: {
          caseId: currentCase.id,
          patientId: currentCase.patient.id,
          patientIdentifier: currentCase.patient.identifier,
          patientName: currentCase.patient.name,
          patientBirthDate: currentCase.patient.birthDate ?? "",
          patientCpf: currentCase.patient.cpf ?? "",
          patientContact: currentCase.patient.contact ?? "",
          patientCompanion: currentCase.patient.companion ?? "",
          enrollmentId: currentCase.enrollmentId,
          schedules: currentCase.schedules.map((schedule) => ({
            row_id: schedule.id,
            weekday: schedule.weekday,
            appointment_time: schedule.appointmentTime
          })),
          status: currentCase.status
        },
        emptyHint: context.emptyHint
      },
      emptyState: null
    };
  } catch {
    return {
      formData: null,
      emptyState: buildEmptyState(
        "Não foi possível preparar a edição do caso",
        "O caso foi encontrado, mas os dados de paciente, aluno ou área não puderam ser consolidados."
      )
    };
  }
}

export async function getClinicalCaseFormPageData(
  currentUser: SessionUser,
  options?: {
    caseId?: string;
    patientId?: string | null;
  }
): Promise<ClinicalCaseFormLoadResult> {
  if (options?.caseId) {
    return getProfessorClinicalCaseFormPageData(currentUser, options?.caseId);
  }

  const { context, emptyState } = await loadScopedClinicalOperatorContext(currentUser);

  if (!context || emptyState) {
    return {
      formData: null,
      emptyState
    };
  }

  const supabase =
    currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let initialValues = createEmptyClinicalCaseInitialValues();

  if (options?.patientId) {
    const [patientData] = await loadInstitutionalPatientRows({
      currentUser,
      patientIds: [options.patientId]
    });
    const patientCases = await loadAccessibleClinicalCaseRows({
      currentUser,
      patientId: options.patientId
    });

    if (!patientData || !patientCases.length) {
      return {
        formData: null,
        emptyState: buildEmptyState(
          "Paciente institucional indisponível",
          "Não foi possível localizar o cadastro-base selecionado para abrir um novo caso clínico."
        )
      };
    }

    const patient = patientData;
    initialValues = {
      ...initialValues,
      patientId: patient.id,
      patientIdentifier: patient.identificador,
      patientName: patient.nome,
      patientBirthDate: patient.data_nascimento ?? "",
      patientCpf: patient.cpf ?? "",
      patientContact: patient.contato ?? "",
      patientCompanion: patient.acompanhante ?? ""
    };
  }

  return {
    formData: {
      operator: context.operator,
      studentOptions: context.studentOptions,
      mode: "create",
      currentCase: null,
      initialValues,
      emptyHint: context.emptyHint
    },
    emptyState: null
  };
}

function matchesClinicalPatientQuery(patient: ClinicalPatientSummary, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  if (!normalizedQuery) {
    return true;
  }

  const compactQuery = normalizedQuery.replace(/\D/g, "");
  const fields = [
    patient.name,
    patient.identifier,
    patient.cpf ?? ""
  ].map((value) => value.toLocaleLowerCase("pt-BR"));

  if (fields.some((value) => value.includes(normalizedQuery))) {
    return true;
  }

  return compactQuery
    ? (patient.cpf ?? "").replace(/\D/g, "").includes(compactQuery)
    : false;
}

function deriveClinicalInstitutionalPatientStatus(
  cases: ClinicalCaseSummary[]
): ClinicalInstitutionalPatientListItem["currentStatus"] {
  if (cases.some((caseItem) => caseItem.active)) {
    return "com_caso_ativo";
  }

  if (cases[0]?.status === "alta") {
    return "alta";
  }

  if (cases.length > 0) {
    return "com_historico";
  }

  return "cadastro_base";
}

function formatClinicalInstitutionalPatientStatusLabel(
  status: ClinicalInstitutionalPatientListItem["currentStatus"]
) {
  switch (status) {
    case "com_caso_ativo":
      return "Com caso ativo";
    case "alta":
      return "Alta";
    case "com_historico":
      return "Com histórico";
    default:
      return "Cadastro-base";
  }
}

function buildClinicalInstitutionalPatientListItem(input: {
  patient: ClinicalPatientRow;
  cases: ClinicalCaseSummary[];
}): ClinicalInstitutionalPatientListItem {
  const caseHistory = [...input.cases].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt)
  );
  const latestCase = caseHistory[0] ?? null;
  const activeCase = caseHistory.find((caseItem) => caseItem.active) ?? null;
  const currentStatus = deriveClinicalInstitutionalPatientStatus(caseHistory);

  return {
    patient: buildClinicalPatientSummary(input.patient),
    currentStatus,
    currentStatusLabel: formatClinicalInstitutionalPatientStatusLabel(currentStatus),
    activeCaseId: activeCase?.id ?? null,
    latestCaseId: latestCase?.id ?? null,
    latestCaseStatus: latestCase?.status ?? null,
    latestSemesterCode: latestCase?.semesterCode ?? null,
    latestAreaName: latestCase?.areaName ?? null,
    latestProfessorName: latestCase?.professorName ?? null,
    latestStudentName: latestCase?.studentName ?? null,
    lastUpdatedAt: latestCase?.updatedAt ?? null,
    historyCount: caseHistory.length
  };
}

async function loadClinicalInstitutionalCaseSummaries(currentUser: SessionUser) {
  const caseRows = await loadAccessibleClinicalCaseRows({
    currentUser
  });
  const bundle = await loadClinicalReferenceBundle(caseRows, currentUser);
  return mapClinicalCaseSummaries(caseRows, bundle);
}

async function loadClinicalInstitutionalUnitOptions(
  currentUser: SessionUser,
  scope?: ResolvedSessionDataScope | null
) {
  if (currentUser.role !== "coordenador_master") {
    if (currentUser.role === "coordenador" && scope?.scopeKind === "course_manager") {
      const allowedUnitIds = uniqueStringValues(scope.unitIds);

      if (!allowedUnitIds.length) {
        return {
          institutions: [] as ClinicalInstitutionalDashboardInstitutionOption[],
          units: [] as ClinicalInstitutionalDashboardUnitOption[]
        };
      }

      const adminClient = createSupabaseAdminClient();
      const { data: unitRowsData, error: unitRowsError } = await adminClient
        .from("unidades")
        .select("*")
        .in("id", allowedUnitIds)
        .order("nome");

      if (unitRowsError) {
        throw new Error("clinical-institutional-unit-load-failed");
      }

      return {
        institutions: [] as ClinicalInstitutionalDashboardInstitutionOption[],
        units: ((unitRowsData ?? []) as UnitRow[])
          .map((unit) => ({
            id: unit.id,
            institutionId: unit.instituicao_id,
            name: unit.nome
          }))
          .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
      };
    }

    return {
      institutions: [] as ClinicalInstitutionalDashboardInstitutionOption[],
      units: [] as ClinicalInstitutionalDashboardUnitOption[]
    };
  }

  const adminClient = createSupabaseAdminClient();
  const [institutionsResult, unitsResult] = await Promise.all([
    adminClient.from("instituicoes").select("*").order("nome"),
    adminClient.from("unidades").select("*").order("nome")
  ]);

  if (institutionsResult.error || unitsResult.error) {
    throw new Error("clinical-institutional-unit-load-failed");
  }

  return {
    institutions: ((institutionsResult.data ?? []) as InstitutionRow[])
      .map((institution) => ({
        id: institution.id,
        name: institution.nome
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    units: ((unitsResult.data ?? []) as UnitRow[])
      .map((unit) => ({
        id: unit.id,
        institutionId: unit.instituicao_id,
        name: unit.nome
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
  };
}

function normalizeClinicalInstitutionalScopeFilters(input: {
  institutions: ClinicalInstitutionalDashboardInstitutionOption[];
  units: ClinicalInstitutionalDashboardUnitOption[];
  allowInstitutionFilter: boolean;
  allowUnitFilter: boolean;
  filters?: {
    institutionId?: string | null;
    unitId?: string | null;
  };
}) {
  const requestedInstitutionId = input.allowInstitutionFilter
    ? input.filters?.institutionId?.trim() ?? ""
    : "";
  const validInstitutionId = input.institutions.some(
    (institution) => institution.id === requestedInstitutionId
  )
    ? requestedInstitutionId
    : "";

  const requestedUnitId = input.allowUnitFilter
    ? input.filters?.unitId?.trim() ?? ""
    : "";
  const requestedUnit = input.units.find((unit) => unit.id === requestedUnitId) ?? null;
  const validUnitId =
    requestedUnit &&
    (!validInstitutionId || requestedUnit.institutionId === validInstitutionId)
      ? requestedUnitId
      : "";

  return {
    institutionId: validInstitutionId,
    unitId: validUnitId
  };
}

function filterClinicalCasesToInstitutionAndUnitScope(
  cases: ClinicalCaseSummary[],
  units: ClinicalInstitutionalDashboardUnitOption[],
  filters: {
    institutionId: string;
    unitId: string;
  }
) {
  const visibleUnitIds = filters.institutionId
    ? new Set(
        units
          .filter((unit) => unit.institutionId === filters.institutionId)
          .map((unit) => unit.id)
      )
    : null;

  return cases
    .filter((caseItem) =>
      visibleUnitIds ? Boolean(caseItem.unitId && visibleUnitIds.has(caseItem.unitId)) : true
    )
    .filter((caseItem) => (filters.unitId ? caseItem.unitId === filters.unitId : true));
}

function buildClinicalInstitutionalSemesterOptions(cases: ClinicalCaseSummary[]) {
  return [
    ...new Map(cases.map((caseItem) => [caseItem.semesterId, caseItem.semesterCode])).entries()
  ]
    .map(([id, code]) => ({ id, code }))
    .sort((left, right) => right.code.localeCompare(left.code, "pt-BR"));
}

function buildClinicalInstitutionalAreaOptions(cases: ClinicalCaseSummary[]) {
  return [
    ...new Map(
      cases
        .filter((caseItem) => caseItem.areaId)
        .map((caseItem) => [caseItem.areaId as string, caseItem.areaName])
    ).entries()
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function buildClinicalInstitutionalProfessorOptions(cases: ClinicalCaseSummary[]) {
  return [
    ...new Map(cases.map((caseItem) => [caseItem.professorId, caseItem.professorName])).entries()
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function buildClinicalInstitutionalStudentOptions(cases: ClinicalCaseSummary[]) {
  return [
    ...new Map(
      cases.map((caseItem) => [
        caseItem.studentId,
        {
          id: caseItem.studentId,
          name: caseItem.studentName,
          registration: caseItem.registration
        }
      ])
    ).values()
  ].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

async function loadInstitutionalPatientRows(input: {
  currentUser: SessionUser;
  patientIds?: string[];
}) {
  const supabase =
    input.currentUser.role === "secretaria"
      ? createSupabaseAdminClient()
      : await createSupabaseServerClient();
  let query = supabase.from("pacientes_clinica").select("*");

  if (input.patientIds?.length) {
    query = query.in("id", input.patientIds);
  } else if (input.currentUser.role !== "coordenador_master") {
    return [] as ClinicalPatientRow[];
  } else {
    query = query.order("nome", { ascending: true });
  }

  const { data, error } = await query.order("nome", { ascending: true });

  if (error) {
    throw new Error("clinical-institutional-patient-load-failed");
  }

  return (data ?? []) as ClinicalPatientRow[];
}

export async function getClinicalPatientBasePageData(
  currentUser: SessionUser,
  filters?: {
    query?: string | null;
    unitId?: string | null;
    status?: string | null;
    semesterId?: string | null;
    areaId?: string | null;
  }
): Promise<ClinicalPatientBaseLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "secretaria"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Base institucional indisponível para este perfil",
        "Nesta fase, a base institucional de pacientes pode ser consultada apenas por professores e coordenação."
      )
    };
  }

  try {
    const supabase =
      currentUser.role === "coordenador"
        ? await createSupabaseServerClient()
        : null;
    const scopedAccess =
      currentUser.role === "coordenador" && supabase
        ? await resolveScopedDataAccess(currentUser, {
            supabase
          })
        : null;
    const { units: scopedUnitOptions } = await loadClinicalInstitutionalUnitOptions(
      currentUser,
      scopedAccess
    );
    const requestedUnitId =
      currentUser.role === "coordenador" && scopedUnitOptions.length > 0
        ? filters?.unitId?.trim() ?? ""
        : "";
    const validUnitId = scopedUnitOptions.some((unit) => unit.id === requestedUnitId)
      ? requestedUnitId
      : "";
    const visibleCases = (await loadClinicalInstitutionalCaseSummaries(currentUser)).filter(
      (caseItem) => (validUnitId ? caseItem.unitId === validUnitId : true)
    );
    const patients = await loadInstitutionalPatientRows({
      currentUser,
      patientIds: uniqueStringValues(visibleCases.map((caseItem) => caseItem.patient.id))
    });
    const filtersState = {
      query:
        currentUser.role === "coordenador" && scopedUnitOptions.length > 0
          ? ""
          : filters?.query?.trim() ?? "",
      unitId: validUnitId,
      status:
        filters?.status === "com_caso_ativo" ||
        filters?.status === "alta" ||
        filters?.status === "com_historico"
          ? filters.status
          : "todos",
      semesterId: filters?.semesterId?.trim() ?? "",
      areaId: filters?.areaId?.trim() ?? ""
    } as const;
    const casesByPatientId = new Map<string, ClinicalCaseSummary[]>();

    for (const caseItem of visibleCases) {
      const patientCases = casesByPatientId.get(caseItem.patient.id) ?? [];
      patientCases.push(caseItem);
      casesByPatientId.set(caseItem.patient.id, patientCases);
    }

    const patientItems = patients
      .map((patient) =>
        buildClinicalInstitutionalPatientListItem({
          patient,
          cases: casesByPatientId.get(patient.id) ?? []
        })
      )
      .filter((patientItem) => matchesClinicalPatientQuery(patientItem.patient, filtersState.query))
      .filter((patientItem) => {
        if (filtersState.status === "todos") {
          return true;
        }

        return patientItem.currentStatus === filtersState.status;
      })
      .filter((patientItem) => {
        if (!filtersState.semesterId) {
          return true;
        }

        return (casesByPatientId.get(patientItem.patient.id) ?? []).some(
          (caseItem) => caseItem.semesterId === filtersState.semesterId
        );
      })
      .filter((patientItem) => {
        if (!filtersState.areaId) {
          return true;
        }

        return (casesByPatientId.get(patientItem.patient.id) ?? []).some(
          (caseItem) => caseItem.areaId === filtersState.areaId
        );
      })
      .sort((left, right) => left.patient.name.localeCompare(right.patient.name, "pt-BR"));

    return {
      pageData: {
        viewerRole: currentUser.role,
        viewerName: currentUser.name,
        patients: patientItems,
        filterOptions: {
          units: scopedUnitOptions
            .map((unitOption) => ({
              id: unitOption.id,
              name: unitOption.name
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
          semesters: [
            ...new Map(
              visibleCases.map((caseItem) => [caseItem.semesterId, caseItem.semesterCode])
            ).entries()
          ]
            .map(([id, code]) => ({ id, code }))
            .sort((left, right) => right.code.localeCompare(left.code, "pt-BR")),
          areas: [
            ...new Map(
              visibleCases
                .filter((caseItem) => caseItem.areaId)
                .map((caseItem) => [caseItem.areaId as string, caseItem.areaName])
            ).entries()
          ]
            .map(([id, name]) => ({ id, name }))
            .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
        },
        filters: {
          query: filtersState.query,
          unitId: filtersState.unitId,
          status: filtersState.status,
          semesterId: filtersState.semesterId,
          areaId: filtersState.areaId
        },
        metrics: {
          totalPatients: patientItems.length,
          activePatients: patientItems.filter(
            (patientItem) => patientItem.currentStatus === "com_caso_ativo"
          ).length,
          patientsWithHistory: patientItems.filter(
            (patientItem) => patientItem.historyCount > 0
          ).length
        }
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar a base institucional de pacientes",
        "Os pacientes e casos clínicos foram encontrados, mas o histórico institucional ainda não pôde ser consolidado nesta sessão."
      )
    };
  }
}

export async function getClinicalPatientHistoryPageData(
  currentUser: SessionUser,
  patientId: string
): Promise<ClinicalPatientHistoryLoadResult> {
  if (currentUser.role !== "professor" && currentUser.role !== "coordenador") {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Histórico do paciente indisponível para este perfil",
        "Nesta fase, o histórico institucional de pacientes pode ser consultado apenas por professores e coordenação."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const scopedAccess =
    currentUser.role === "coordenador"
      ? await resolveScopedDataAccess(currentUser, {
          supabase
        })
      : null;
  const patientQuery = supabase.from("pacientes_clinica").select("*").eq("id", patientId);
  const scopedPatientQuery =
    currentUser.role === "coordenador" &&
    scopedAccess?.scopeKind !== "course_manager" &&
    currentUser.unitId
      ? patientQuery.eq("unidade_id", currentUser.unitId)
      : patientQuery;
  const { data: patientData, error: patientError } = await scopedPatientQuery.maybeSingle();

  if (patientError || !patientData) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Paciente institucional não encontrado",
        "Não foi possível localizar este cadastro-base de paciente no escopo do usuário autenticado."
      )
    };
  }

  try {
    const cases = (await loadClinicalInstitutionalCaseSummaries(currentUser)).filter(
      (caseItem) => caseItem.patient.id === patientId
    );

    if (!cases.length) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Paciente institucional nÃ£o encontrado",
          "NÃ£o foi possÃ­vel localizar este cadastro-base de paciente no escopo do usuÃ¡rio autenticado."
        )
      };
    }

    const { data: recordRowsData, error: recordError } = cases.length
      ? await supabase
          .from("registros_clinicos")
          .select("caso_clinico_id, tipo, status, updated_at")
          .in("caso_clinico_id", cases.map((caseItem) => caseItem.id))
          .order("updated_at", { ascending: false })
      : { data: [], error: null };

    if (recordError) {
      throw new Error("clinical-patient-history-record-load-failed");
    }

    const latestRecordByCaseAndType = new Map<string, ClinicalRecordStatus>();

    for (const recordRow of (recordRowsData ?? []) as Array<{
      caso_clinico_id: string;
      tipo: ClinicalRecordType;
      status: ClinicalRecordStatus;
      updated_at: string;
    }>) {
      const mapKey = `${recordRow.caso_clinico_id}:${recordRow.tipo}`;
      const currentValue = latestRecordByCaseAndType.get(mapKey);

      if (!currentValue) {
        latestRecordByCaseAndType.set(mapKey, recordRow.status);
      }
    }

    const history = [...cases]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((caseItem) => ({
        caseItem,
        latestEvaluationStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:avaliacao`) ?? null,
        latestTreatmentPlanStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:plano_tratamento`) ?? null,
        latestEvolutionStatus:
          latestRecordByCaseAndType.get(`${caseItem.id}:evolucao`) ?? null
      }));
    const patientSummary = buildClinicalPatientSummary(patientData as ClinicalPatientRow);
    const patientListItem = buildClinicalInstitutionalPatientListItem({
      patient: patientData as ClinicalPatientRow,
      cases
    });

    return {
      pageData: {
        viewerRole: currentUser.role,
        viewerName: currentUser.name,
        patient: patientSummary,
        patientStatusLabel: patientListItem.currentStatusLabel,
        activeCaseId: patientListItem.activeCaseId,
        latestCaseId: patientListItem.latestCaseId,
        history
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o histórico institucional do paciente",
        "O cadastro-base foi encontrado, mas os casos clínicos vinculados ainda não puderam ser consolidados nesta sessão."
      )
    };
  }
}

const CLINICAL_RECENT_EVOLUTION_THRESHOLD_DAYS = 14;

interface ClinicalInstitutionalCaseRecordSnapshot {
  latestEvaluationStatus: ClinicalRecordStatus | null;
  latestTreatmentPlanStatus: ClinicalRecordStatus | null;
  latestEvolutionStatus: ClinicalRecordStatus | null;
  latestEvolutionDate: string | null;
  latestRecordType: ClinicalRecordType | null;
  latestRecordStatus: ClinicalRecordStatus | null;
  latestRecordUpdatedAt: string | null;
}

function matchesClinicalInstitutionalCaseQuery(
  caseItem: ClinicalCaseSummary,
  query: string
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");

  if (!normalizedQuery) {
    return true;
  }

  const compactQuery = normalizedQuery.replace(/\D/g, "");
  const searchableFields = [
    caseItem.patient.name,
    caseItem.patient.identifier,
    caseItem.patient.cpf ?? ""
  ].map((value) => value.toLocaleLowerCase("pt-BR"));

  if (searchableFields.some((value) => value.includes(normalizedQuery))) {
    return true;
  }

  return compactQuery
    ? (caseItem.patient.cpf ?? "").replace(/\D/g, "").includes(compactQuery)
    : false;
}

function isClinicalCaseCareActive(caseItem: ClinicalCaseSummary) {
  return (
    caseItem.active &&
    caseItem.status !== "alta" &&
    caseItem.status !== "encerrado"
  );
}

function hasClinicalInstitutionalPendingStatus(
  status: ClinicalRecordStatus | null | undefined
) {
  return status === "enviado" || status === "ajustes_solicitados";
}

function getDateTimestamp(value: string | null | undefined) {
  return getDateValueTimestamp(value);
}

function shouldReplaceLatestEvolutionDate(currentValue: string | null, candidateValue: string) {
  const candidateTimestamp = getDateTimestamp(candidateValue);
  const currentTimestamp = getDateTimestamp(currentValue);

  if (candidateTimestamp === null) {
    return currentTimestamp === null;
  }

  if (currentTimestamp === null) {
    return true;
  }

  return candidateTimestamp > currentTimestamp;
}

function hasClinicalEvolutionGap(
  caseItem: ClinicalCaseSummary,
  latestEvolutionDate: string | null
) {
  if (!isClinicalCaseCareActive(caseItem)) {
    return false;
  }

  if (!latestEvolutionDate) {
    return true;
  }

  const latestEvolutionTimestamp = getDateTimestamp(latestEvolutionDate);

  if (latestEvolutionTimestamp === null) {
    return false;
  }

  const elapsedDays =
    (Date.now() - latestEvolutionTimestamp) / (1000 * 60 * 60 * 24);

  return elapsedDays > CLINICAL_RECENT_EVOLUTION_THRESHOLD_DAYS;
}

function createEmptyClinicalInstitutionalRecordSnapshot(): ClinicalInstitutionalCaseRecordSnapshot {
  return {
    latestEvaluationStatus: null,
    latestTreatmentPlanStatus: null,
    latestEvolutionStatus: null,
    latestEvolutionDate: null,
    latestRecordType: null,
    latestRecordStatus: null,
    latestRecordUpdatedAt: null
  };
}

export async function getClinicalInstitutionalDashboardPageData(
  currentUser: SessionUser,
  filters?: {
    query?: string | null;
    institutionId?: string | null;
    unitId?: string | null;
    semesterId?: string | null;
    areaId?: string | null;
    professorId?: string | null;
    studentId?: string | null;
    status?: string | null;
  }
): Promise<ClinicalInstitutionalDashboardLoadResult> {
  if (
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Visão institucional indisponível para este perfil",
        "Nesta fase, a camada institucional da Clínica Supervisionada pode ser consultada apenas pela coordenação."
      )
    };
  }

  if (false && currentUser.role === "coordenador" && !currentUser.unitId) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Unidade operacional não identificada",
        "A coordenação autenticada precisa estar vinculada a uma unidade para acompanhar a Clínica Supervisionada."
      )
    };
  }

  try {
    const serverSupabase = await createSupabaseServerClient();
    const scopedAccess =
      currentUser.role === "coordenador"
        ? await resolveScopedDataAccess(currentUser, {
            supabase: serverSupabase
          })
        : null;
    const supabase =
      currentUser.role === "coordenador_master"
        ? createSupabaseAdminClient()
        : serverSupabase;
    const showInstitutionFilter = currentUser.role === "coordenador_master";
    const showUnitFilter =
      currentUser.role === "coordenador_master" ||
      scopedAccess?.scopeKind === "course_manager";
    const { institutions: institutionOptions, units: unitOptions } =
      await loadClinicalInstitutionalUnitOptions(currentUser, scopedAccess);
    const baseCases = await loadClinicalInstitutionalCaseSummaries(currentUser);
    const normalizedScopeFilters = normalizeClinicalInstitutionalScopeFilters({
      institutions: institutionOptions,
      units: unitOptions,
      allowInstitutionFilter: showInstitutionFilter,
      allowUnitFilter: showUnitFilter,
      filters: {
        institutionId: filters?.institutionId ?? null,
        unitId: filters?.unitId ?? null
      }
    });
    const scopeFilteredCases = filterClinicalCasesToInstitutionAndUnitScope(
      baseCases,
      unitOptions,
      normalizedScopeFilters
    );
    const caseIds = scopeFilteredCases.map((caseItem) => caseItem.id);
    const normalizedFilters = {
      query:
        currentUser.role === "coordenador_master" ||
        scopedAccess?.scopeKind === "course_manager"
          ? ""
          : filters?.query?.trim() ?? "",
      institutionId: normalizedScopeFilters.institutionId,
      unitId: normalizedScopeFilters.unitId,
      semesterId: filters?.semesterId?.trim() ?? "",
      areaId: filters?.areaId?.trim() ?? "",
      professorId: filters?.professorId?.trim() ?? "",
      studentId: filters?.studentId?.trim() ?? "",
      status:
        filters?.status === "atribuido" ||
        filters?.status === "ativo" ||
        filters?.status === "alta" ||
        filters?.status === "encerrado"
          ? filters.status
          : "todos"
    } as const;

    const { data: recordRowsData, error: recordError } = caseIds.length
      ? await supabase
          .from("registros_clinicos")
          .select("*")
          .in("caso_clinico_id", caseIds)
          .in("tipo", ["avaliacao", "plano_tratamento", "evolucao"])
          .order("updated_at", { ascending: false })
      : { data: [], error: null };

    if (recordError) {
      throw new Error("clinical-institutional-record-load-failed");
    }

    const recordSnapshotsByCaseId = new Map<string, ClinicalInstitutionalCaseRecordSnapshot>();

    for (const recordRow of (recordRowsData ?? []) as ClinicalRecordRow[]) {
      const currentSnapshot =
        recordSnapshotsByCaseId.get(recordRow.caso_clinico_id) ??
        createEmptyClinicalInstitutionalRecordSnapshot();

      if (
        !currentSnapshot.latestRecordUpdatedAt ||
        recordRow.updated_at > currentSnapshot.latestRecordUpdatedAt
      ) {
        currentSnapshot.latestRecordType = recordRow.tipo;
        currentSnapshot.latestRecordStatus = recordRow.status;
        currentSnapshot.latestRecordUpdatedAt = recordRow.updated_at;
      }

      if (recordRow.tipo === "avaliacao" && !currentSnapshot.latestEvaluationStatus) {
        currentSnapshot.latestEvaluationStatus = recordRow.status;
      }

      if (
        recordRow.tipo === "plano_tratamento" &&
        !currentSnapshot.latestTreatmentPlanStatus
      ) {
        currentSnapshot.latestTreatmentPlanStatus = recordRow.status;
      }

      if (recordRow.tipo === "evolucao") {
        const evolutionRecord = buildClinicalEvolutionRecord(recordRow);
        const evolutionReferenceDate =
          evolutionRecord.content.sessionDate || evolutionRecord.updatedAt;

        if (
          shouldReplaceLatestEvolutionDate(
            currentSnapshot.latestEvolutionDate,
            evolutionReferenceDate
          )
        ) {
          currentSnapshot.latestEvolutionStatus = evolutionRecord.status;
          currentSnapshot.latestEvolutionDate = evolutionRecord.content.sessionDate;
        }
      }

      recordSnapshotsByCaseId.set(recordRow.caso_clinico_id, currentSnapshot);
    }

    const cases = scopeFilteredCases
      .filter((caseItem) =>
        matchesClinicalInstitutionalCaseQuery(caseItem, normalizedFilters.query)
      )
      .filter((caseItem) =>
        normalizedFilters.semesterId
          ? caseItem.semesterId === normalizedFilters.semesterId
          : true
      )
      .filter((caseItem) =>
        normalizedFilters.areaId ? caseItem.areaId === normalizedFilters.areaId : true
      )
      .filter((caseItem) =>
        normalizedFilters.professorId
          ? caseItem.professorId === normalizedFilters.professorId
          : true
      )
      .filter((caseItem) =>
        normalizedFilters.studentId ? caseItem.studentId === normalizedFilters.studentId : true
      )
      .filter((caseItem) =>
        normalizedFilters.status === "todos"
          ? true
          : caseItem.status === normalizedFilters.status
      )
      .map((caseItem) => {
        const snapshot =
          recordSnapshotsByCaseId.get(caseItem.id) ??
          createEmptyClinicalInstitutionalRecordSnapshot();
        const hasPendingItems =
          hasClinicalInstitutionalPendingStatus(snapshot.latestEvaluationStatus) ||
          hasClinicalInstitutionalPendingStatus(snapshot.latestTreatmentPlanStatus) ||
          hasClinicalInstitutionalPendingStatus(snapshot.latestEvolutionStatus);

        return {
          caseItem,
          latestEvaluationStatus: snapshot.latestEvaluationStatus,
          latestTreatmentPlanStatus: snapshot.latestTreatmentPlanStatus,
          latestEvolutionStatus: snapshot.latestEvolutionStatus,
          latestEvolutionDate: snapshot.latestEvolutionDate,
          latestRecordType: snapshot.latestRecordType,
          latestRecordStatus: snapshot.latestRecordStatus,
          latestRecordUpdatedAt: snapshot.latestRecordUpdatedAt,
          hasPendingItems,
          hasRecentEvolutionGap: hasClinicalEvolutionGap(
            caseItem,
            snapshot.latestEvolutionDate
          )
        } satisfies ClinicalInstitutionalDashboardCaseRow;
      })
      .sort((left, right) => {
        const leftActiveScore = isClinicalCaseCareActive(left.caseItem) ? 1 : 0;
        const rightActiveScore = isClinicalCaseCareActive(right.caseItem) ? 1 : 0;

        if (leftActiveScore !== rightActiveScore) {
          return rightActiveScore - leftActiveScore;
        }

        const lastRecordDiff = (right.latestRecordUpdatedAt ?? right.caseItem.updatedAt).localeCompare(
          left.latestRecordUpdatedAt ?? left.caseItem.updatedAt
        );

        if (lastRecordDiff !== 0) {
          return lastRecordDiff;
        }

        return left.caseItem.patient.name.localeCompare(
          right.caseItem.patient.name,
          "pt-BR"
        );
      });

    const activePatientIds = new Set(
      cases
        .filter((row) => isClinicalCaseCareActive(row.caseItem))
        .map((row) => row.caseItem.patient.id)
    );
    const byUnitMap = new Map<
      string,
      {
        unitId: string;
        unitName: string;
        patientIds: Set<string>;
        caseCount: number;
        activeCaseCount: number;
      }
    >();
    const byAreaMap = new Map<
      string,
      {
        areaId: string;
        areaName: string;
        patientIds: Set<string>;
        caseCount: number;
        activeCaseCount: number;
      }
    >();
    const byProfessorMap = new Map<
      string,
      {
        professorId: string;
        professorName: string;
        caseCount: number;
        activeCaseCount: number;
      }
    >();
    const byStudentMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        registration: string;
        caseCount: number;
        activeCaseCount: number;
      }
    >();

    for (const row of cases) {
      const caseIsActive = isClinicalCaseCareActive(row.caseItem);
      const unitKey = row.caseItem.unitId ?? `unit:${row.caseItem.unitName}`;
      const unitEntry = byUnitMap.get(unitKey) ?? {
        unitId: row.caseItem.unitId ?? unitKey,
        unitName: row.caseItem.unitName,
        patientIds: new Set<string>(),
        caseCount: 0,
        activeCaseCount: 0
      };
      unitEntry.caseCount += 1;
      unitEntry.patientIds.add(row.caseItem.patient.id);
      if (caseIsActive) {
        unitEntry.activeCaseCount += 1;
      }
      byUnitMap.set(unitKey, unitEntry);

      const areaKey = row.caseItem.areaId ?? `area:${row.caseItem.areaName}`;
      const areaEntry = byAreaMap.get(areaKey) ?? {
        areaId: row.caseItem.areaId ?? areaKey,
        areaName: row.caseItem.areaName,
        patientIds: new Set<string>(),
        caseCount: 0,
        activeCaseCount: 0
      };
      areaEntry.caseCount += 1;
      areaEntry.patientIds.add(row.caseItem.patient.id);
      if (caseIsActive) {
        areaEntry.activeCaseCount += 1;
      }
      byAreaMap.set(areaKey, areaEntry);

      const professorEntry = byProfessorMap.get(row.caseItem.professorId) ?? {
        professorId: row.caseItem.professorId,
        professorName: row.caseItem.professorName,
        caseCount: 0,
        activeCaseCount: 0
      };
      professorEntry.caseCount += 1;
      if (caseIsActive) {
        professorEntry.activeCaseCount += 1;
      }
      byProfessorMap.set(row.caseItem.professorId, professorEntry);

      const studentEntry = byStudentMap.get(row.caseItem.studentId) ?? {
        studentId: row.caseItem.studentId,
        studentName: row.caseItem.studentName,
        registration: row.caseItem.registration,
        caseCount: 0,
        activeCaseCount: 0
      };
      studentEntry.caseCount += 1;
      if (caseIsActive) {
        studentEntry.activeCaseCount += 1;
      }
      byStudentMap.set(row.caseItem.studentId, studentEntry);
    }

    return {
      pageData: {
        viewerRole: currentUser.role,
        viewerName: currentUser.name,
        generatedAt: new Date().toISOString(),
        filters: normalizedFilters,
        filterOptions: {
          institutions: institutionOptions,
          units: unitOptions,
          semesters: buildClinicalInstitutionalSemesterOptions(scopeFilteredCases),
          areas: buildClinicalInstitutionalAreaOptions(scopeFilteredCases),
          professors: buildClinicalInstitutionalProfessorOptions(scopeFilteredCases),
          students: buildClinicalInstitutionalStudentOptions(scopeFilteredCases)
        },
        metrics: {
          totalActivePatients: activePatientIds.size,
          totalActiveCases: cases.filter((row) => isClinicalCaseCareActive(row.caseItem))
            .length,
          totalCasesWithAlta: cases.filter((row) => row.caseItem.status === "alta").length,
          totalClosedCases: cases.filter((row) => row.caseItem.status === "encerrado")
            .length,
          totalCasesWithPendingItems: cases.filter((row) => row.hasPendingItems).length,
          totalCasesWithoutRecentEvolution: cases.filter(
            (row) => row.hasRecentEvolutionGap
          ).length
        },
        cases,
        breakdowns: {
          byUnit: [...byUnitMap.values()]
            .map((entry) => ({
              unitId: entry.unitId,
              unitName: entry.unitName,
              patientCount: entry.patientIds.size,
              caseCount: entry.caseCount,
              activeCaseCount: entry.activeCaseCount
            }))
            .sort((left, right) => {
              if (left.activeCaseCount !== right.activeCaseCount) {
                return right.activeCaseCount - left.activeCaseCount;
              }

              return left.unitName.localeCompare(right.unitName, "pt-BR");
            }),
          byArea: [...byAreaMap.values()]
            .map((entry) => ({
              areaId: entry.areaId,
              areaName: entry.areaName,
              patientCount: entry.patientIds.size,
              caseCount: entry.caseCount,
              activeCaseCount: entry.activeCaseCount
            }))
            .sort((left, right) => {
              if (left.activeCaseCount !== right.activeCaseCount) {
                return right.activeCaseCount - left.activeCaseCount;
              }

              return left.areaName.localeCompare(right.areaName, "pt-BR");
            }),
          byProfessor: [...byProfessorMap.values()].sort((left, right) => {
            if (left.activeCaseCount !== right.activeCaseCount) {
              return right.activeCaseCount - left.activeCaseCount;
            }

            return left.professorName.localeCompare(right.professorName, "pt-BR");
          }),
          byStudent: [...byStudentMap.values()].sort((left, right) => {
            if (left.activeCaseCount !== right.activeCaseCount) {
              return right.activeCaseCount - left.activeCaseCount;
            }

            return left.studentName.localeCompare(right.studentName, "pt-BR");
          })
        }
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar a visão institucional da Clínica Supervisionada",
        "Os casos clínicos da unidade foram localizados, mas os indicadores e relatórios consolidados ainda não puderam ser montados nesta sessão."
      )
    };
  }
}

export async function getClinicalCaseDetailPageData(
  currentUser: SessionUser,
  caseId: string,
  requestedSection?: string | null
): Promise<ClinicalCaseDetailLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Módulo indisponível para este perfil",
        "Nesta fase, a Clínica Supervisionada pode ser consultada apenas por professores, alunos e coordenação."
      )
    };
  }

  const accessibleCaseRow = await loadAccessibleClinicalCaseRow(currentUser, caseId);

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico nÃ£o encontrado",
        "NÃ£o foi possÃ­vel localizar este caso clÃ­nico no escopo do usuÃ¡rio autenticado."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseQuery = supabase.from("casos_clinicos").select("*").eq("id", caseId);
  const scopedQuery =
    currentUser.role === "professor"
      ? caseQuery.eq("professor_id", currentUser.id)
      : currentUser.role === "coordenador" && currentUser.unitId
        ? caseQuery.eq("unidade_id", currentUser.unitId)
      : caseQuery;
  const { data: caseRowData, error: caseError } = await scopedQuery.maybeSingle();

  if (false && (caseError || !caseRowData)) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico não encontrado",
        "Não foi possível localizar este caso clínico no escopo do usuário autenticado."
      )
    };
  }

  const caseRow = accessibleCaseRow as ClinicalCaseRow;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    const caseItem = applyClinicalStudentSensitiveMaskToNullableCase(
      mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null,
      currentUser
    );

    if (!caseItem) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Caso clínico indisponível",
          "O caso foi localizado, mas faltaram dados de paciente, aluno ou área para exibi-lo nesta sessão."
        )
      };
    }

    const semesterStatus = bundle.semestersById.get(caseItem.semesterId)?.status ?? null;
    const exceptionalReleaseNotice = await resolveProfessorClinicalExceptionalReleaseNotice(
      currentUser,
      caseItem,
      semesterStatus
    );

    const [recordResult, notificationResult] = await Promise.all([
      supabase
        .from("registros_clinicos")
        .select("*")
        .eq("caso_clinico_id", caseId)
        .in("tipo", ["avaliacao", "plano_tratamento", "evolucao"])
        .order("updated_at", { ascending: false }),
      loadClinicalNotificationCenter(currentUser, [caseItem])
    ]);

    if (recordResult.error) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Não foi possível exibir o painel clínico do caso",
          "O caso foi encontrado, mas os registros clínicos ainda não puderam ser consolidados nesta sessão."
        )
      };
    }

    const clinicalRecords = (recordResult.data ?? []) as ClinicalRecordRow[];
    const evaluationRow =
      clinicalRecords.find((recordRow) => recordRow.tipo === "avaliacao") ?? null;
    const treatmentPlanRow =
      clinicalRecords.find((recordRow) => recordRow.tipo === "plano_tratamento") ??
      null;
    const evolutions = clinicalRecords
      .filter((recordRow) => recordRow.tipo === "evolucao")
      .map((recordRow) => buildClinicalEvolutionRecord(recordRow))
      .sort((left, right) => {
        const sessionDateDiff = right.content.sessionDate.localeCompare(
          left.content.sessionDate
        );

        if (sessionDateDiff !== 0) {
          return sessionDateDiff;
        }

        return right.updatedAt.localeCompare(left.updatedAt);
      });

    return {
      pageData: {
        viewerRole: currentUser.role,
        viewerName: currentUser.name,
        caseItem,
        exceptionalReleaseNotice,
        currentSection: normalizeSection(requestedSection),
        sections: [
          {
            key: "avaliacao",
            label: "Avaliação",
            description:
              "Registro clínico já disponível para documentar a avaliação supervisionada do paciente."
          },
          {
            key: "plano-tratamento",
            label: "Plano de tratamento",
            description:
              "Registro clínico já disponível para organizar objetivos, condutas e observações do caso."
          },
          {
            key: "evolucao",
            label: "Evolução",
            description:
              "Registro clínico já disponível para documentar a evolução diária e a conduta terapêutica do caso."
          }
        ],
        evaluation: evaluationRow
          ? buildClinicalEvaluationRecord(evaluationRow)
          : null,
        treatmentPlan: treatmentPlanRow
          ? buildClinicalTreatmentPlanRecord(treatmentPlanRow)
          : null,
        evolutions,
        notifications: notificationResult.center,
        studentCanCreateEvolution:
          currentUser.role === "aluno" &&
          caseItem.active &&
          caseItem.status !== "encerrado" &&
          caseItem.status !== "alta"
      },
      emptyState: null
    };
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível exibir o caso clínico",
        "O caso foi encontrado, mas o contexto acadêmico ou clínico necessário para a visualização não pôde ser consolidado."
      )
    };
  }
}

export async function getClinicalEvaluationPageData(
  currentUser: SessionUser,
  caseId: string
): Promise<ClinicalEvaluationLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Módulo indisponível para este perfil",
        "Nesta fase, a Avaliação Clínica pode ser consultada apenas por professores, alunos e coordenação."
      )
    };
  }

  const accessibleCaseRow = await loadAccessibleClinicalCaseRow(currentUser, caseId);

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico nÃ£o encontrado",
        "NÃ£o foi possÃ­vel localizar este caso clÃ­nico no escopo do usuÃ¡rio autenticado."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseQuery = supabase.from("casos_clinicos").select("*").eq("id", caseId);
  const scopedQuery =
    currentUser.role === "professor"
      ? caseQuery.eq("professor_id", currentUser.id)
      : currentUser.role === "coordenador" && currentUser.unitId
        ? caseQuery.eq("unidade_id", currentUser.unitId)
      : caseQuery;
  const { data: caseRowData, error: caseError } = await scopedQuery.maybeSingle();

  if (false && (caseError || !caseRowData)) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico não encontrado",
        "Não foi possível localizar este caso clínico no escopo do usuário autenticado."
      )
    };
  }

  const caseRow = accessibleCaseRow as ClinicalCaseRow;

  let caseItem: ClinicalCaseSummary | null = null;
  let semesterStatus: SemesterRow["status"] | null = null;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    caseItem = applyClinicalStudentSensitiveMaskToNullableCase(
      mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null,
      currentUser
    );
    semesterStatus = caseItem
      ? bundle.semestersById.get(caseItem.semesterId)?.status ?? null
      : null;
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o caso clínico",
        "O caso foi encontrado, mas o contexto acadêmico necessário para abrir a avaliação não pode ser consolidado."
      )
    };
  }

  if (!caseItem) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "O caso foi encontrado, mas faltaram dados de paciente, aluno ou área para abrir a avaliação."
      )
    };
  }

  const exceptionalReleaseNotice = await resolveProfessorClinicalExceptionalReleaseNotice(
    currentUser,
    caseItem,
    semesterStatus
  );

  const { data: recordRowData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("caso_clinico_id", caseId)
    .eq("tipo", "avaliacao")
    .maybeSingle();

  if (recordError) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar a avaliação clínica",
        "Houve um problema ao consultar o registro clínico deste caso."
      )
    };
  }

  const evaluation = recordRowData
    ? buildClinicalEvaluationRecord(recordRowData as ClinicalRecordRow)
    : null;
  const studentCanEdit =
    currentUser.role === "aluno" &&
    (!evaluation ||
      (evaluation.authorId === currentUser.id &&
        (evaluation.status === "rascunho" ||
          evaluation.status === "ajustes_solicitados")));

  let studentReadOnlyMessage: string | null = null;

  if (currentUser.role === "aluno" && evaluation) {
    if (evaluation.authorId !== currentUser.id) {
      studentReadOnlyMessage =
        "Esta avaliação não pode ser editada pelo aluno autenticado nesta sessão.";
    } else if (evaluation.status === "enviado") {
      studentReadOnlyMessage =
        "A avaliação foi enviada para supervisão e aguarda retorno do professor.";
    } else if (evaluation.status === "aprovado") {
      studentReadOnlyMessage =
        "A avaliação foi aprovada pelo supervisor e está bloqueada para novas alterações nesta fase.";
    }
  }

  return {
    pageData: {
      viewerRole: currentUser.role,
      viewerName: currentUser.name,
      caseItem,
      exceptionalReleaseNotice,
      evaluation,
      studentCanEdit,
      studentReadOnlyMessage
    },
    emptyState: null
  };
}

export async function getClinicalTreatmentPlanPageData(
  currentUser: SessionUser,
  caseId: string
): Promise<ClinicalTreatmentPlanLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Módulo indisponível para este perfil",
        "Nesta fase, o Plano de tratamento pode ser consultado apenas por professores, alunos e coordenação."
      )
    };
  }

  const accessibleCaseRow = await loadAccessibleClinicalCaseRow(currentUser, caseId);

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico indisponÃ­vel",
        "NÃ£o foi possÃ­vel localizar um caso vÃ¡lido dentro do escopo autenticado."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseQuery = supabase.from("casos_clinicos").select("*").eq("id", caseId);
    const scopedQuery =
      currentUser.role === "professor"
        ? caseQuery.eq("professor_id", currentUser.id)
        : currentUser.role === "coordenador" && currentUser.unitId
          ? caseQuery.eq("unidade_id", currentUser.unitId)
        : caseQuery;
  const { data: caseRowData, error: caseError } = await scopedQuery.maybeSingle();

  if (false && (caseError || !caseRowData)) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "Não foi possível localizar um caso válido para abrir o Plano de tratamento."
      )
    };
  }

  const caseRow = accessibleCaseRow as ClinicalCaseRow;

  let caseItem: ClinicalCaseSummary | null = null;
  let semesterStatus: SemesterRow["status"] | null = null;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    caseItem = applyClinicalStudentSensitiveMaskToNullableCase(
      mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null,
      currentUser
    );
    semesterStatus = caseItem
      ? bundle.semestersById.get(caseItem.semesterId)?.status ?? null
      : null;
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o caso clínico",
        "O caso foi encontrado, mas o contexto acadêmico necessário para abrir o Plano de tratamento não pôde ser consolidado."
      )
    };
  }

  if (!caseItem) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "O caso foi encontrado, mas faltaram dados de paciente, aluno ou área para abrir o Plano de tratamento."
      )
    };
  }

  const exceptionalReleaseNotice = await resolveProfessorClinicalExceptionalReleaseNotice(
    currentUser,
    caseItem,
    semesterStatus
  );

  const { data: recordRowData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("caso_clinico_id", caseId)
    .eq("tipo", "plano_tratamento")
    .maybeSingle();

  if (recordError) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o Plano de tratamento",
        "Houve um problema ao consultar o registro clínico deste caso."
      )
    };
  }

  const treatmentPlan = recordRowData
    ? buildClinicalTreatmentPlanRecord(recordRowData as ClinicalRecordRow)
    : null;
  const studentCanEdit =
    currentUser.role === "aluno" &&
    (!treatmentPlan ||
      (treatmentPlan.authorId === currentUser.id &&
        (treatmentPlan.status === "rascunho" ||
          treatmentPlan.status === "ajustes_solicitados")));

  let studentReadOnlyMessage: string | null = null;

  if (currentUser.role === "aluno" && treatmentPlan) {
    if (treatmentPlan.authorId !== currentUser.id) {
      studentReadOnlyMessage =
        "Este Plano de tratamento não pode ser editado pelo aluno autenticado nesta sessão.";
    } else if (treatmentPlan.status === "enviado") {
      studentReadOnlyMessage =
        "O Plano de tratamento foi enviado para supervisão e aguarda retorno do professor.";
    } else if (treatmentPlan.status === "aprovado") {
      studentReadOnlyMessage =
        "O Plano de tratamento foi aprovado pelo supervisor e está bloqueado para novas alterações nesta fase.";
    }
  }

  return {
    pageData: {
      viewerRole: currentUser.role,
      viewerName: currentUser.name,
      caseItem,
      exceptionalReleaseNotice,
      treatmentPlan,
      studentCanEdit,
      studentReadOnlyMessage
    },
    emptyState: null
  };
}

export async function getClinicalEvolutionListPageData(
  currentUser: SessionUser,
  caseId: string
): Promise<ClinicalEvolutionListLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Módulo indisponível para este perfil",
        "Nesta fase, a Evolução pode ser consultada apenas por professores, alunos e coordenação."
      )
    };
  }

  const accessibleCaseRow = await loadAccessibleClinicalCaseRow(currentUser, caseId);

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico indisponÃ­vel",
        "NÃ£o foi possÃ­vel localizar um caso vÃ¡lido dentro do escopo autenticado."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseQuery = supabase.from("casos_clinicos").select("*").eq("id", caseId);
    const scopedQuery =
      currentUser.role === "professor"
        ? caseQuery.eq("professor_id", currentUser.id)
        : currentUser.role === "coordenador" && currentUser.unitId
          ? caseQuery.eq("unidade_id", currentUser.unitId)
        : caseQuery;
  const { data: caseRowData, error: caseError } = await scopedQuery.maybeSingle();

  if (false && (caseError || !caseRowData)) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "Não foi possível localizar um caso válido para abrir a lista de evoluções."
      )
    };
  }

  const caseRow = accessibleCaseRow as ClinicalCaseRow;

  let caseItem: ClinicalCaseSummary | null = null;
  let semesterStatus: SemesterRow["status"] | null = null;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    caseItem = applyClinicalStudentSensitiveMaskToNullableCase(
      mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null,
      currentUser
    );
    semesterStatus = caseItem
      ? bundle.semestersById.get(caseItem.semesterId)?.status ?? null
      : null;
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o caso clínico",
        "O caso foi encontrado, mas o contexto acadêmico necessário para abrir a lista de evoluções não pôde ser consolidado."
      )
    };
  }

  if (!caseItem) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "O caso foi encontrado, mas faltaram dados de paciente, aluno ou área para abrir a lista de evoluções."
      )
    };
  }

  const exceptionalReleaseNotice = await resolveProfessorClinicalExceptionalReleaseNotice(
    currentUser,
    caseItem,
    semesterStatus
  );

  const { data: recordRowsData, error: recordError } = await supabase
    .from("registros_clinicos")
    .select("*")
    .eq("caso_clinico_id", caseId)
    .eq("tipo", "evolucao")
    .order("updated_at", { ascending: false });

  if (recordError) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar as evoluções",
        "Houve um problema ao consultar os registros evolutivos deste caso."
      )
    };
  }

  const evolutions = ((recordRowsData ?? []) as ClinicalRecordRow[])
    .map((recordRow) => buildClinicalEvolutionRecord(recordRow))
    .sort((left, right) => {
      const sessionDateDiff = right.content.sessionDate.localeCompare(
        left.content.sessionDate
      );

      if (sessionDateDiff !== 0) {
        return sessionDateDiff;
      }

      return right.updatedAt.localeCompare(left.updatedAt);
    });

  return {
    pageData: {
      viewerRole: currentUser.role,
      viewerName: currentUser.name,
      caseItem,
      exceptionalReleaseNotice,
      evolutions
    },
    emptyState: null
  };
}

export async function getClinicalEvolutionPageData(
  currentUser: SessionUser,
  caseId: string,
  recordId?: string | null,
  options?: {
    attendanceId?: string | null;
  }
): Promise<ClinicalEvolutionLoadResult> {
  if (
    currentUser.role !== "professor" &&
    currentUser.role !== "aluno" &&
    currentUser.role !== "coordenador" &&
    currentUser.role !== "coordenador_master"
  ) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Módulo indisponível para este perfil",
        "Nesta fase, o Registro de Evolução e Conduta pode ser consultado apenas por professores, alunos e coordenação."
      )
    };
  }

  const accessibleCaseRow = await loadAccessibleClinicalCaseRow(currentUser, caseId);

  if (!accessibleCaseRow) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clÃ­nico indisponÃ­vel",
        "NÃ£o foi possÃ­vel localizar um caso vÃ¡lido dentro do escopo autenticado."
      )
    };
  }

  const supabase = await createSupabaseServerClient();
  const caseQuery = supabase.from("casos_clinicos").select("*").eq("id", caseId);
    const scopedQuery =
      currentUser.role === "professor"
        ? caseQuery.eq("professor_id", currentUser.id)
        : currentUser.role === "coordenador" && currentUser.unitId
          ? caseQuery.eq("unidade_id", currentUser.unitId)
        : caseQuery;
  const { data: caseRowData, error: caseError } = await scopedQuery.maybeSingle();

  if (false && (caseError || !caseRowData)) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "Não foi possível localizar um caso válido para abrir o Registro de Evolução e Conduta."
      )
    };
  }

  const caseRow = accessibleCaseRow as ClinicalCaseRow;

  let caseItem: ClinicalCaseSummary | null = null;
  let semesterStatus: SemesterRow["status"] | null = null;

  try {
    const bundle = await loadClinicalReferenceBundle([caseRow], currentUser);
    caseItem = applyClinicalStudentSensitiveMaskToNullableCase(
      mapClinicalCaseSummaries([caseRow], bundle)[0] ?? null,
      currentUser
    );
    semesterStatus = caseItem
      ? bundle.semestersById.get(caseItem.semesterId)?.status ?? null
      : null;
  } catch {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Não foi possível carregar o caso clínico",
        "O caso foi encontrado, mas o contexto acadêmico necessário para abrir o Registro de Evolução e Conduta não pôde ser consolidado."
      )
    };
  }

  if (!caseItem) {
    return {
      pageData: null,
      emptyState: buildEmptyState(
        "Caso clínico indisponível",
        "O caso foi encontrado, mas faltaram dados de paciente, aluno ou área para abrir o Registro de Evolução e Conduta."
      )
    };
  }

  const exceptionalReleaseNotice = await resolveProfessorClinicalExceptionalReleaseNotice(
    currentUser,
    caseItem,
    semesterStatus
  );

  let linkedAttendanceRow: ClinicalAttendanceRow | null = null;

  if (options?.attendanceId) {
    try {
      linkedAttendanceRow = await loadScopedClinicalAttendanceRow({
        currentUser,
        caseId,
        attendanceId: options.attendanceId
      });
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Atendimento diário indisponível",
          "Não foi possível localizar o atendimento diário selecionado dentro do seu escopo clínico."
        )
      };
    }

    if (!linkedAttendanceRow) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Atendimento diário indisponível",
          "O atendimento diário informado não pertence a este caso clínico ou não está disponível para o perfil autenticado."
        )
      };
    }

    if (
      currentUser.role === "aluno" &&
      linkedAttendanceRow.status_presenca !== "presente"
    ) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Evolução dispensada para este atendimento",
          "Este atendimento foi marcado como ausência do paciente e não exige registro de evolução."
        )
      };
    }
  }

  let evolutionRecordRow: ClinicalRecordRow | null = null;

  if (recordId) {
    const { data: recordRowData, error: recordError } = await supabase
      .from("registros_clinicos")
      .select("*")
      .eq("id", recordId)
      .eq("caso_clinico_id", caseId)
      .eq("tipo", "evolucao")
      .maybeSingle();

    if (recordError || !recordRowData) {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Registro de evolução indisponível",
          "Não foi possível localizar a evolução solicitada dentro deste caso clínico."
        )
      };
    }

    evolutionRecordRow = recordRowData as ClinicalRecordRow;
  } else if (linkedAttendanceRow?.id) {
    try {
      const linkedRecordRows = await loadClinicalRecordRowsByAttendanceIds({
        currentUser,
        attendanceIds: [linkedAttendanceRow.id]
      });
      evolutionRecordRow = linkedRecordRows[0] ?? null;
    } catch {
      return {
        pageData: null,
        emptyState: buildEmptyState(
          "Atendimento diário indisponível",
          "Não foi possível consolidar a evolução já vinculada a este atendimento diário."
        )
      };
    }
  }

  if (!linkedAttendanceRow && evolutionRecordRow?.atendimento_clinico_id) {
    try {
      linkedAttendanceRow = await loadScopedClinicalAttendanceRow({
        currentUser,
        caseId,
        attendanceId: evolutionRecordRow.atendimento_clinico_id
      });
    } catch {
      linkedAttendanceRow = null;
    }
  }

  const evolution = evolutionRecordRow
    ? buildClinicalEvolutionRecord(evolutionRecordRow)
    : null;
  const linkedAttendance =
    linkedAttendanceRow &&
    buildClinicalPendingEvolutionSummary(
      buildClinicalAttendanceSummary({
        caseItem,
        attendanceDate: linkedAttendanceRow.data_atendimento,
        scheduleId: linkedAttendanceRow.caso_clinico_horario_id,
        appointmentTime:
          caseItem.schedules.find(
            (schedule) => schedule.id === linkedAttendanceRow?.caso_clinico_horario_id
          )?.appointmentTime ?? caseItem.appointmentTime,
        attendanceRow: linkedAttendanceRow,
        evolutionRecord: evolutionRecordRow
      })
    );

  const studentCanEdit =
    currentUser.role === "aluno" &&
    (!evolution ||
      (evolution.authorId === currentUser.id &&
        (evolution.status === "rascunho" ||
          evolution.status === "ajustes_solicitados")));

  let studentReadOnlyMessage: string | null = null;

  if (currentUser.role === "aluno" && evolution) {
    if (evolution.authorId !== currentUser.id) {
      studentReadOnlyMessage =
        "Este Registro de Evolução e Conduta não pode ser editado pelo aluno autenticado nesta sessão.";
    } else if (evolution.status === "enviado") {
      studentReadOnlyMessage =
        "O Registro de Evolução e Conduta foi enviado para supervisão e aguarda retorno do professor.";
    } else if (evolution.status === "aprovado") {
      studentReadOnlyMessage =
        "O Registro de Evolução e Conduta foi aprovado pelo supervisor e está bloqueado para novas alterações nesta fase.";
    }
  }

  return {
    pageData: {
      viewerRole: currentUser.role,
      viewerName: currentUser.name,
      caseItem,
      exceptionalReleaseNotice,
      evolution,
      linkedAttendance: linkedAttendance ?? null,
      initialSessionDate:
        linkedAttendanceRow?.data_atendimento ??
        evolution?.content.sessionDate ??
        getTodayInSaoPaulo(),
      studentCanEdit,
      studentReadOnlyMessage
    },
    emptyState: null
  };
}
