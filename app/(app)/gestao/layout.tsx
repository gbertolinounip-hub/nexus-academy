import { requireRole } from "@/lib/auth/session";

export default async function ManagementAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["coordenador"]);
  return children;
}
