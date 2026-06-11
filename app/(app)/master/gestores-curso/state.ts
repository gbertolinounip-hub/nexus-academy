export interface CourseManagerFormValues {
  instituicao_id: string;
  curso_id: string;
  usuario_id: string;
  ativo: "true" | "false";
}

export interface NewCourseManagerFormValues {
  nome_completo: string;
  email: string;
  senha: string;
  instituicao_id: string;
  curso_id: string;
  ativo: "true" | "false";
}

export interface CourseManagerActionState<TFormValues> {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: TFormValues;
  submittedAt?: number;
}

export type CourseManagerManagementActionState =
  CourseManagerActionState<CourseManagerFormValues>;

export type NewCourseManagerActionState =
  CourseManagerActionState<NewCourseManagerFormValues>;

export const initialCourseManagerActionState: CourseManagerManagementActionState = {
  status: "idle",
  message: "",
  fieldErrors: {}
};

export const initialNewCourseManagerActionState: NewCourseManagerActionState = {
  status: "idle",
  message: "",
  fieldErrors: {}
};

export function createEmptyCourseManagerFormValues(): CourseManagerFormValues {
  return {
    instituicao_id: "",
    curso_id: "",
    usuario_id: "",
    ativo: "true"
  };
}

export function createEmptyNewCourseManagerFormValues(): NewCourseManagerFormValues {
  return {
    nome_completo: "",
    email: "",
    senha: "",
    instituicao_id: "",
    curso_id: "",
    ativo: "true"
  };
}
