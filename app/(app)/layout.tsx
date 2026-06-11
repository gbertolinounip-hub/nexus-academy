import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getNavigationForUser } from "@/lib/auth/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getAuthenticatedStudentDashboardPageData } from "@/services/dashboard";
import { getClinicalUnreadNotificationCount } from "@/services/clinical-supervision";
import { getStudentDocumentUnreadNotificationCount } from "@/services/student-documents";

export default async function AppLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const currentUser = await requireAuthenticatedUser();
  const studentDashboardLoad =
    currentUser.role === "aluno"
      ? await getAuthenticatedStudentDashboardPageData(currentUser)
      : null;
  const clinicalUnreadNotificationCount =
    currentUser.role === "aluno" || currentUser.role === "professor"
      ? await getClinicalUnreadNotificationCount(currentUser)
      : 0;
  const studentDocumentUnreadNotificationCount =
    currentUser.role === "aluno"
      ? await getStudentDocumentUnreadNotificationCount(currentUser)
      : 0;
  const studentSecondaryNavigationItems =
    currentUser.role === "aluno"
      ? studentDashboardLoad?.pageData?.navigation.areas.map((area) => ({
          key: area.enrollmentId,
          label: area.areaName,
          enrollmentId: area.enrollmentId,
          recentUpdateAt: area.recentUpdateAt,
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
  const navigationItems = getNavigationForUser(currentUser).map((item) =>
    String(item.href) === "/clinica-supervisionada"
      ? {
          ...item,
          badgeCount:
            clinicalUnreadNotificationCount > 0
              ? clinicalUnreadNotificationCount
              : undefined
        }
      : String(item.href) === "/documentos"
        ? {
            ...item,
            badgeCount:
              studentDocumentUnreadNotificationCount > 0
                ? studentDocumentUnreadNotificationCount
                : undefined
          }
        : item
  );

  return (
    <DashboardShell
      currentUser={currentUser}
      navigationItems={navigationItems}
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
      currentUserId={currentUser.id}
    >
      {children}
    </DashboardShell>
  );
}
