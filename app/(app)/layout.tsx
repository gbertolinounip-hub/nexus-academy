import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import {
  getNavigationForUser,
  type NavigationItem
} from "@/lib/auth/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { joinDisplayParts } from "@/lib/utils/format";
import { getAuthenticatedStudentDashboardPageData } from "@/services/dashboard";
import { getClinicalUnreadNotificationCount } from "@/services/clinical-supervision";
import {
  getProfessorPendingStudentDocumentCount,
  getStudentDocumentUnreadNotificationCount
} from "@/services/student-documents";

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
  const professorPendingStudentDocumentCount =
    currentUser.role === "professor"
      ? await getProfessorPendingStudentDocumentCount(currentUser)
      : 0;
  function mapNavigationBadges(items: NavigationItem[]): NavigationItem[] {
    return items.map((item) => {
      const nextItem: NavigationItem =
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
            : String(item.href) === "/professor/documentos"
              ? {
                  ...item,
                  badgeCount:
                    professorPendingStudentDocumentCount > 0
                      ? professorPendingStudentDocumentCount
                      : undefined
                }
              : { ...item };

      return {
        ...nextItem,
        children: nextItem.children ? mapNavigationBadges(nextItem.children) : undefined
      };
    });
  }
  const studentSecondaryNavigationItems =
    currentUser.role === "aluno"
      ? studentDashboardLoad?.pageData?.navigation.areas.map((area) => ({
          key: area.enrollmentId,
          label: area.areaName,
          enrollmentId: area.enrollmentId,
          recentUpdateAt: area.recentUpdateAt,
          description: joinDisplayParts([
            area.className,
            area.professorNames.length
              ? area.professorNames.join(", ")
              : "Supervisor ainda nao vinculado"
          ])
        })) ?? []
      : [];
  const navigationItems = mapNavigationBadges(getNavigationForUser(currentUser));

  return (
    <DashboardShell
      currentUser={currentUser}
      navigationItems={navigationItems}
      secondaryNavigationItems={
        currentUser.role === "aluno"
          ? [
              {
                key: "overview",
                label: "Visao geral",
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
