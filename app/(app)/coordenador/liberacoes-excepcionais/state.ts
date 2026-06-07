import type { ExceptionalReleaseManagementType } from "@/types/domain";

export interface ExceptionalReleaseFormValues {
  tipo: ExceptionalReleaseManagementType;
  semestre_id: string;
  turma_id: string;
  aluno_id: string;
  usuario_autorizado_id: string;
  motivo: string;
  inicio_em: string;
  expira_em: string;
}

export interface ExceptionalReleaseActionState {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: Record<string, string>;
  formValues: ExceptionalReleaseFormValues;
  submittedAt?: number;
}

function formatDateTimeLocalInput(date: Date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function createInitialExceptionalReleaseFormValues(): ExceptionalReleaseFormValues {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + 24 * 60 * 60 * 1000);

  return {
    tipo: "avaliacao",
    semestre_id: "",
    turma_id: "",
    aluno_id: "",
    usuario_autorizado_id: "",
    motivo: "",
    inicio_em: formatDateTimeLocalInput(startsAt),
    expira_em: formatDateTimeLocalInput(expiresAt)
  };
}

export const initialExceptionalReleaseActionState: ExceptionalReleaseActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  formValues: createInitialExceptionalReleaseFormValues()
};
