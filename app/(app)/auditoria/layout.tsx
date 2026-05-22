import { requireRole } from "@/lib/auth/session";

export default async function AuditAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["coordenador"]);
  return children;
}
