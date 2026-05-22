import { requireRole } from "@/lib/auth/session";

export default async function StudentAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["aluno"]);
  return children;
}
