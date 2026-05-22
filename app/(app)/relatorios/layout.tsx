import { requireRole } from "@/lib/auth/session";

export default async function ReportsAreaLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["coordenador", "professor"]);
  return children;
}
