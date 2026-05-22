import { requireRole } from "@/lib/auth/session";

export default async function EvaluationsAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["professor"]);
  return children;
}
