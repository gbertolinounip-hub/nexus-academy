import { requireRole } from "@/lib/auth/session";

export default async function ProfessorAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["professor"]);
  return children;
}
