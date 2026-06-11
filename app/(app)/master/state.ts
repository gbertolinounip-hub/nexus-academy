export interface UnitFormValues {
  unit_id: string;
  instituicao_id: string;
  nome: string;
  sigla: string;
  slug: string;
  cidade: string;
  estado: string;
}

export interface UnitCoordinatorFormValues {
  coordinator_id?: string;
  unit_id: string;
  nome_completo: string;
  email: string;
  senha: string;
  cargo: string;
  replace_existing?: string;
}

export interface UnitCoordinatorProfileFormValues {
  coordinator_id: string;
  unit_id: string;
  nome_completo: string;
  cargo: string;
}

export interface MasterUserProfileFormValues {
  user_id: string;
  nome_completo: string;
}

export interface MasterActionState<TFormValues> {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  formValues?: TFormValues;
  submittedAt?: number;
}

export const initialUnitActionState: MasterActionState<UnitFormValues> = {
  status: "idle",
  message: "",
  fieldErrors: {}
};

export const initialCoordinatorActionState: MasterActionState<UnitCoordinatorFormValues> =
  {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export const initialCoordinatorProfileActionState:
  MasterActionState<UnitCoordinatorProfileFormValues> = {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export const initialMasterUserProfileActionState:
  MasterActionState<MasterUserProfileFormValues> = {
    status: "idle",
    message: "",
    fieldErrors: {}
  };

export function createEmptyUnitFormValues(): UnitFormValues {
  return {
    unit_id: "",
    instituicao_id: "",
    nome: "",
    sigla: "",
    slug: "",
    cidade: "",
    estado: ""
  };
}

export function createEmptyCoordinatorFormValues(
  unitId: string,
  overrides?: Partial<UnitCoordinatorFormValues>
): UnitCoordinatorFormValues {
  return {
    coordinator_id: "",
    unit_id: unitId,
    nome_completo: "",
    email: "",
    senha: "",
    cargo: "Coordenador da unidade",
    replace_existing: "false",
    ...overrides
  };
}
