export interface InstitutionFormValues {
  nome: string;
  sigla: string;
  slug: string;
  cnpj: string;
}

export interface InstitutionEditFormValues extends InstitutionFormValues {
  institution_id: string;
  ativo: "true" | "false";
}

export interface InstitutionManagementActionState<TFormValues> {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: TFormValues;
  submittedAt?: number;
}

export const initialInstitutionCreateActionState:
  InstitutionManagementActionState<InstitutionFormValues> = {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export const initialInstitutionEditActionState:
  InstitutionManagementActionState<InstitutionEditFormValues> = {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export function createEmptyInstitutionFormValues(): InstitutionFormValues {
  return {
    nome: "",
    sigla: "",
    slug: "",
    cnpj: ""
  };
}
