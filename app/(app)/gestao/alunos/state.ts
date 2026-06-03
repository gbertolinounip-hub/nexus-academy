export interface StudentRegistrationAssignmentFormValue {
  row_id: string;
  area_id: string;
  supervisor_1_id: string;
  supervisor_2_id: string;
}

export interface StudentRegistrationFormValues {
  nome_completo: string;
  ra: string;
  celular: string;
  email: string;
  senha: string;
  semestre_id: string;
  assignments: StudentRegistrationAssignmentFormValue[];
}

export type ExistingStudentResolutionAction = "reactivate" | "link" | "cancel";

export interface StudentRegistrationConflictInfo {
  userId: string;
  name: string;
  email: string;
  registration: string;
  isActive: boolean;
  hasOperationalActiveSemester: boolean;
  selectedSemesterLinked: boolean;
  selectedSemesterLabel: string | null;
  canLinkCurrentSemester: boolean;
  linkDisabledReason: string | null;
}

export interface StudentProfileFormValues {
  student_id: string;
  nome_completo: string;
  ra: string;
  celular: string;
  email: string;
}

export interface StudentStageManagementFormValues {
  student_id: string;
  semestre_id: string;
  assignments: StudentRegistrationAssignmentFormValue[];
}

export interface ProfessorRegistrationFormValues {
  nome_completo: string;
  funcional: string;
  email: string;
  senha: string;
  area_ids: string[];
}

export interface SecretaryRegistrationFormValues {
  nome_completo: string;
  email: string;
  senha: string;
}

export interface SemesterManagementFormValues {
  codigo: string;
  nome: string;
  data_inicio: string;
  data_fim: string;
  status: "planejado" | "ativo" | "encerrado";
}

export interface StudentRegistrationActionState {
  status: "idle" | "success" | "error" | "conflict";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: StudentRegistrationFormValues;
  conflictInfo?: StudentRegistrationConflictInfo | null;
  submittedAt?: number;
}

export interface StudentProfileActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: StudentProfileFormValues;
  submittedAt?: number;
}

export interface StudentStageManagementActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: StudentStageManagementFormValues;
  submittedAt?: number;
}

export interface ProfessorRegistrationActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: ProfessorRegistrationFormValues;
  submittedAt?: number;
}

export interface SecretaryRegistrationActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: SecretaryRegistrationFormValues;
  submittedAt?: number;
}

export interface SemesterManagementActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues?: SemesterManagementFormValues;
  submittedAt?: number;
}

export type StudentImportPreviewRowStatus =
  | "valida"
  | "duplicada"
  | "invalida"
  | "importada"
  | "falha";

export interface StudentImportPreviewRow {
  rowNumber: number;
  nome_completo: string;
  ra: string;
  celular: string;
  email: string;
  status: StudentImportPreviewRowStatus;
  issues: string[];
  temporaryPasswordMasked: string;
}

export interface StudentImportSummary {
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  importedRows: number;
  failedRows: number;
}

export interface StudentImportPayloadRow {
  rowNumber: number;
  nome_completo: string;
  ra: string;
  celular: string;
  email: string;
}

export interface StudentImportActionState {
  status: "idle" | "preview" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  fileName: string | null;
  fileTypeLabel: string | null;
  rows: StudentImportPreviewRow[];
  importableRows: StudentImportPayloadRow[];
  summary: StudentImportSummary;
  submittedAt?: number;
}

export function createEmptyStudentAssignment(
  rowId = "assignment-initial"
): StudentRegistrationAssignmentFormValue {
  return {
    row_id: rowId,
    area_id: "",
    supervisor_1_id: "",
    supervisor_2_id: ""
  };
}

export function createInitialStudentRegistrationFormValues(): StudentRegistrationFormValues {
  return {
    nome_completo: "",
    ra: "",
    celular: "",
    email: "",
    senha: "",
    semestre_id: "",
    assignments: [createEmptyStudentAssignment()]
  };
}

export function createInitialStudentProfileFormValues(
  input?: Partial<StudentProfileFormValues>
): StudentProfileFormValues {
  return {
    student_id: input?.student_id ?? "",
    nome_completo: input?.nome_completo ?? "",
    ra: input?.ra ?? "",
    celular: input?.celular ?? "",
    email: input?.email ?? ""
  };
}

export function createInitialStudentStageManagementFormValues(
  input?: Partial<StudentStageManagementFormValues>
): StudentStageManagementFormValues {
  return {
    student_id: input?.student_id ?? "",
    semestre_id: input?.semestre_id ?? "",
    assignments:
      input?.assignments && input.assignments.length > 0
        ? input.assignments
        : [createEmptyStudentAssignment()]
  };
}

export const initialStudentRegistrationActionState: StudentRegistrationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  conflictInfo: null,
  formValues: createInitialStudentRegistrationFormValues()
};

export const initialStudentProfileActionState: StudentProfileActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: createInitialStudentProfileFormValues()
};

export const initialStudentStageManagementActionState: StudentStageManagementActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: createInitialStudentStageManagementFormValues()
};

export const initialProfessorRegistrationActionState: ProfessorRegistrationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    nome_completo: "",
    funcional: "",
    email: "",
    senha: "",
    area_ids: []
  }
};

export const initialSecretaryRegistrationActionState: SecretaryRegistrationActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    nome_completo: "",
    email: "",
    senha: ""
  }
};

export const initialSemesterManagementActionState: SemesterManagementActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: {
    codigo: "",
    nome: "",
    data_inicio: "",
    data_fim: "",
    status: "planejado"
  }
};

export const initialStudentImportActionState: StudentImportActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  fileName: null,
  fileTypeLabel: null,
  rows: [],
  importableRows: [],
  summary: {
    totalRows: 0,
    validRows: 0,
    duplicateRows: 0,
    invalidRows: 0,
    importedRows: 0,
    failedRows: 0
  }
};
