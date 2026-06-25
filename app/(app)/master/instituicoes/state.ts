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

export interface InstitutionBrandingFormValues {
  institution_id: string;
  nome_exibicao: string;
  remove_logo_principal: "true" | "false";
  remove_logo_compacta: "true" | "false";
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

export const initialInstitutionBrandingActionState:
  InstitutionManagementActionState<InstitutionBrandingFormValues> = {
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

export function createEmptyInstitutionBrandingFormValues(): InstitutionBrandingFormValues {
  return {
    institution_id: "",
    nome_exibicao: "",
    remove_logo_principal: "false",
    remove_logo_compacta: "false"
  };
}
