import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getDefaultDashboardPathForUser } from "@/lib/auth/roles";
import { registerAuthenticatedAccess } from "@/services/access-logs";

function readLoginFlag(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] === "1";
  }

  return value === "1";
}

export default async function RedirectByRolePage(props: {
  searchParams?: Promise<{
    login?: string | string[];
  }>;
}) {
  const currentUser = await requireAuthenticatedUser();
  const searchParams = (await props.searchParams) ?? {};

  if (readLoginFlag(searchParams.login)) {
    try {
      await registerAuthenticatedAccess(currentUser);
    } catch (error) {
      console.error("[auth] Falha ao registrar acesso no redirecionamento", {
        userId: currentUser.id,
        role: currentUser.role,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  redirect(getDefaultDashboardPathForUser(currentUser));
}
