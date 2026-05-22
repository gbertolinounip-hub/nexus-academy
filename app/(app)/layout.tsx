import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getNavigationForRole } from "@/lib/auth/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getAuthenticatedStudentDashboardPageData } from "@/services/dashboard";

export default async function AppLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await requireAuthenticatedUser();
  const studentSecondaryNavigationItems =
    currentUser.role === "aluno"
      ? (
          await getAuthenticatedStudentDashboardPageData(currentUser)
        ).pageData?.navigation.areas.map((area) => ({
          key: area.enrollmentId,
          label: area.areaName,
          enrollmentId: area.enrollmentId,
          description: area.blockName
            ? `${area.blockName} · ${
                area.professorNames.length
                  ? area.professorNames.join(", ")
                  : "Supervisor ainda não vinculado"
              }`
            : area.professorNames.length
              ? area.professorNames.join(", ")
              : "Supervisor ainda não vinculado"
        })) ?? []
      : [];

  return (
    <DashboardShell
      currentUser={currentUser}
      navigationItems={getNavigationForRole(currentUser.role)}
      secondaryNavigationItems={
        currentUser.role === "aluno"
          ? [
              {
                key: "overview",
                label: "Visão geral",
                description: "Consolidado do semestre atual"
              },
              ...studentSecondaryNavigationItems
            ]
          : []
      }
    >
      {children}
    </DashboardShell>
  );
}


