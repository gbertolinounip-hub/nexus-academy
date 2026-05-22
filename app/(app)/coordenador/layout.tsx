import { requireRole } from "@/lib/auth/session";

export default async function CoordinatorAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["coordenador"]);
  return children;
}
