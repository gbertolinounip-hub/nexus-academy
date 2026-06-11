export interface CourseConfigurationCopyFormValues {
  destination_course_id: string;
}

export interface CourseConfigurationInitializeFormValues {
  course_id: string;
}

export interface CourseConfigurationCreateGroupFormValues {
  course_id: string;
  model_id: string;
  codigo: string;
  nome: string;
  ordem: string;
  peso_percentual: string;
  ativo: string;
}

export interface CourseConfigurationCreateCriterionFormValues {
  course_id: string;
  group_id: string;
  codigo: string;
  nome: string;
  descricao: string;
  ordem: string;
  peso_percentual: string;
  escala_maxima: string;
  ativo: string;
}

export interface CourseConfigurationCreateRequiredDocumentFormValues {
  course_id: string;
  tipo_documento_id: string;
  nome_exibicao: string;
  descricao: string;
  obrigatorio: string;
  ordem: string;
  ativo: string;
}

export interface CourseConfigurationDeleteGroupFormValues {
  group_id: string;
}

export interface CourseConfigurationDeleteCriterionFormValues {
  criterion_id: string;
}

export interface CourseConfigurationDeleteRequiredDocumentFormValues {
  required_document_id: string;
}

export interface CourseConfigurationModelFormValues {
  model_id: string;
  nome: string;
  descricao: string;
  ativo: string;
}

export interface CourseConfigurationGroupFormValues {
  group_id: string;
  nome: string;
  ordem: string;
  peso_percentual: string;
  ativo: string;
}

export interface CourseConfigurationCriterionFormValues {
  criterion_id: string;
  nome: string;
  descricao: string;
  ordem: string;
  peso_percentual: string;
  escala_maxima: string;
  ativo: string;
}

export interface CourseConfigurationRequiredDocumentFormValues {
  required_document_id: string;
  nome_exibicao: string;
  descricao: string;
  obrigatorio: string;
  ordem: string;
  ativo: string;
}

export interface CourseConfigurationActionState<TFormValues> {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: TFormValues;
  submittedAt?: number;
}

export function createInitialCourseConfigurationActionState<TFormValues>():
  CourseConfigurationActionState<TFormValues> {
  return {
    status: "idle",
    message: "",
    fieldErrors: {}
  };
}

export const initialCourseConfigurationCopyActionState:
  CourseConfigurationActionState<CourseConfigurationCopyFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationCopyFormValues>()
  };

export const initialCourseConfigurationInitializeActionState:
  CourseConfigurationActionState<CourseConfigurationInitializeFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationInitializeFormValues>()
  };

export const initialCourseConfigurationCreateGroupActionState:
  CourseConfigurationActionState<CourseConfigurationCreateGroupFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationCreateGroupFormValues>()
  };

export const initialCourseConfigurationCreateCriterionActionState:
  CourseConfigurationActionState<CourseConfigurationCreateCriterionFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationCreateCriterionFormValues>()
  };

export const initialCourseConfigurationCreateRequiredDocumentActionState:
  CourseConfigurationActionState<CourseConfigurationCreateRequiredDocumentFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationCreateRequiredDocumentFormValues>()
  };

export const initialCourseConfigurationDeleteGroupActionState:
  CourseConfigurationActionState<CourseConfigurationDeleteGroupFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationDeleteGroupFormValues>()
  };

export const initialCourseConfigurationDeleteCriterionActionState:
  CourseConfigurationActionState<CourseConfigurationDeleteCriterionFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationDeleteCriterionFormValues>()
  };

export const initialCourseConfigurationDeleteRequiredDocumentActionState:
  CourseConfigurationActionState<CourseConfigurationDeleteRequiredDocumentFormValues> = {
    ...createInitialCourseConfigurationActionState<CourseConfigurationDeleteRequiredDocumentFormValues>()
  };

export function createEmptyCourseConfigurationCopyFormValues():
  CourseConfigurationCopyFormValues {
  return {
    destination_course_id: ""
  };
}

export function createEmptyCourseConfigurationInitializeFormValues():
  CourseConfigurationInitializeFormValues {
  return {
    course_id: ""
  };
}

export function createEmptyCourseConfigurationCreateGroupFormValues(
  courseId = "",
  modelId = "",
  order = "1",
  weightPercent = "100"
): CourseConfigurationCreateGroupFormValues {
  return {
    course_id: courseId,
    model_id: modelId,
    codigo: "",
    nome: "",
    ordem: order,
    peso_percentual: weightPercent,
    ativo: "true"
  };
}

export function createEmptyCourseConfigurationCreateCriterionFormValues(
  courseId = "",
  groupId = "",
  order = "1",
  weightPercent = "100",
  maxScale = "10"
): CourseConfigurationCreateCriterionFormValues {
  return {
    course_id: courseId,
    group_id: groupId,
    codigo: "",
    nome: "",
    descricao: "",
    ordem: order,
    peso_percentual: weightPercent,
    escala_maxima: maxScale,
    ativo: "true"
  };
}

export function createEmptyCourseConfigurationCreateRequiredDocumentFormValues(
  courseId = "",
  documentTypeId = "",
  order = ""
): CourseConfigurationCreateRequiredDocumentFormValues {
  return {
    course_id: courseId,
    tipo_documento_id: documentTypeId,
    nome_exibicao: "",
    descricao: "",
    obrigatorio: "true",
    ordem: order,
    ativo: "true"
  };
}

export function createEmptyCourseConfigurationDeleteGroupFormValues(
  groupId = ""
): CourseConfigurationDeleteGroupFormValues {
  return {
    group_id: groupId
  };
}

export function createEmptyCourseConfigurationDeleteCriterionFormValues(
  criterionId = ""
): CourseConfigurationDeleteCriterionFormValues {
  return {
    criterion_id: criterionId
  };
}

export function createEmptyCourseConfigurationDeleteRequiredDocumentFormValues(
  requiredDocumentId = ""
): CourseConfigurationDeleteRequiredDocumentFormValues {
  return {
    required_document_id: requiredDocumentId
  };
}
