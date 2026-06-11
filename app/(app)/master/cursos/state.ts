export interface CourseFormValues {
  instituicao_id: string;
  codigo: string;
  nome: string;
  slug: string;
}

export interface CourseOfferFormValues {
  instituicao_id: string;
  unidade_id: string;
  curso_id: string;
  codigo: string;
  nome_exibicao: string;
}

export interface CourseManagementActionState<TFormValues> {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: TFormValues;
  submittedAt?: number;
}

export const initialCourseActionState: CourseManagementActionState<CourseFormValues> = {
  status: "idle",
  message: "",
  fieldErrors: {}
};

export const initialCourseOfferActionState:
  CourseManagementActionState<CourseOfferFormValues> = {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export function createEmptyCourseFormValues(): CourseFormValues {
  return {
    instituicao_id: "",
    codigo: "",
    nome: "",
    slug: ""
  };
}

export function createEmptyCourseOfferFormValues(): CourseOfferFormValues {
  return {
    instituicao_id: "",
    unidade_id: "",
    curso_id: "",
    codigo: "",
    nome_exibicao: ""
  };
}
