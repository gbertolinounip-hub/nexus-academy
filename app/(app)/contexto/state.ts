export interface ContextSwitchActionState {
  status: "idle" | "success" | "error";
  message: string;
  selectedContextId: string;
  submittedAt: number;
}

export const initialContextSwitchActionState: ContextSwitchActionState = {
  status: "idle",
  message: "",
  selectedContextId: "",
  submittedAt: 0
};
