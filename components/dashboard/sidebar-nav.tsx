"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  NavigationItem,
  SecondaryNavigationItem
} from "@/lib/auth/navigation";
import { markStudentAreaAsRead } from "@/lib/student-area-updates";

interface SidebarNavProps {
  currentUserId: string;
  links: NavigationItem[];
  secondaryNavigationItems?: SecondaryNavigationItem[];
}

export function SidebarNav({
  currentUserId,
  links,
  secondaryNavigationItems = []
}: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEnrollmentId = searchParams.get("matricula");
  const hasStudentOverviewLink = links.some((link) => link.href === ("/aluno" as Route));
  const studentClinicalLink = links.find(
    (link) =>
      hasStudentOverviewLink &&
      link.href === ("/clinica-supervisionada" as Route)
  );
  const visibleLinks = studentClinicalLink
    ? links.filter((link) => link.href !== studentClinicalLink.href)
    : links;
  const activeLinkHref =
    [...links]
      .sort((left, right) => right.href.length - left.href.length)
      .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
      ?.href ?? null;

  useEffect(() => {
    if (pathname !== "/aluno" || !activeEnrollmentId) {
      return;
    }

    const activeArea = secondaryNavigationItems.find(
      (item) => item.enrollmentId === activeEnrollmentId
    );

    if (!activeArea?.recentUpdateAt) {
      return;
    }

    markStudentAreaAsRead({
      currentUserId,
      enrollmentId: activeEnrollmentId,
      recentUpdateAt: activeArea.recentUpdateAt
    });
  }, [activeEnrollmentId, currentUserId, pathname, secondaryNavigationItems]);

  function handleStudentAreaRead(
    enrollmentId: string | undefined,
    recentUpdateAt: string | null | undefined
  ) {
    if (!enrollmentId || !recentUpdateAt) {
      return;
    }

    markStudentAreaAsRead({
      currentUserId,
      enrollmentId,
      recentUpdateAt
    });
  }

  function renderNavigationLabel(label: string, badgeCount?: number) {
    return (
      <span className="sidebar-link-content">
        <span>{label}</span>
        {badgeCount && badgeCount > 0 ? (
          <span className="sidebar-link-badge">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <nav className="sidebar-nav">
      {visibleLinks.map((link) => {
        const isActive = activeLinkHref === link.href;
        const showSecondaryNavigation =
          link.href === "/aluno" &&
          (secondaryNavigationItems.length > 0 || Boolean(studentClinicalLink));

        return (
          <div key={link.href} className="sidebar-nav-item">
            <Link className={isActive ? "sidebar-link active" : "sidebar-link"} href={link.href}>
              {renderNavigationLabel(link.label, link.badgeCount)}
            </Link>

            {showSecondaryNavigation ? (
              <div className="sidebar-subnav">
                {secondaryNavigationItems.map((item) => {
                  const isOverviewItem = !item.enrollmentId;
                  const isSubActive = isOverviewItem
                    ? pathname === "/aluno" && !activeEnrollmentId
                    : pathname === "/aluno" && activeEnrollmentId === item.enrollmentId;
                  const href = item.enrollmentId
                    ? `/aluno?matricula=${encodeURIComponent(item.enrollmentId)}`
                    : "/aluno";

                  return (
                    <Link
                      key={item.key}
                      className={
                        isSubActive
                          ? "sidebar-sublink sidebar-sublink-active"
                          : "sidebar-sublink"
                      }
                      onClick={() =>
                        handleStudentAreaRead(item.enrollmentId, item.recentUpdateAt)
                      }
                      href={href as Route}
                    >
                      <strong>{item.label}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                    </Link>
                  );
                })}

                {studentClinicalLink ? (
                  <Link
                    className={
                      activeLinkHref === studentClinicalLink.href
                        ? "sidebar-sublink sidebar-sublink-active"
                        : "sidebar-sublink"
                    }
                    href={studentClinicalLink.href}
                  >
                    <strong>
                      {renderNavigationLabel(
                        studentClinicalLink.label,
                        studentClinicalLink.badgeCount
                      )}
                    </strong>
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
