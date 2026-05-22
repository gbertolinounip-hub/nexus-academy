import { redirectToRoleHome } from "@/lib/auth/session";

export default async function RedirectByRolePage() {
  await redirectToRoleHome();
}
