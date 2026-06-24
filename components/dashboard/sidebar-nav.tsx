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
  const flattenNavigationLinks = (
    items: NavigationItem[]
  ): Array<NavigationItem & { href: string }> => {
    return items.flatMap((item) => [
      ...(item.href ? [{ ...item, href: item.href }] : []),
      ...(item.children ? flattenNavigationLinks(item.children) : [])
    ]);
  };
  const hasStudentOverviewLink = links.some((link) => link.href === "/aluno");
  const studentClinicalLink = links.find(
    (link): link is NavigationItem & { href: string } =>
      hasStudentOverviewLink && link.href === "/clinica-supervisionada"
  );
  const visibleLinks = studentClinicalLink
    ? links.filter((link) => link.href !== studentClinicalLink.href)
    : links;
  const activeLinkHref =
    [...flattenNavigationLinks(links)]
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

  function renderNestedLink(link: NavigationItem) {
    if (!link.href) {
      return null;
    }

    const isActive = activeLinkHref === link.href;

    return (
      <Link
        key={link.href}
        className={isActive ? "sidebar-sublink sidebar-sublink-active" : "sidebar-sublink"}
        href={link.href as Route}
      >
        <strong>{renderNavigationLabel(link.label, link.badgeCount)}</strong>
        {link.description ? <span>{link.description}</span> : null}
      </Link>
    );
  }

  return (
    <nav className="sidebar-nav">
      {visibleLinks.map((link) => {
        const isActive = Boolean(link.href) && activeLinkHref === link.href;
        const hasActiveChild = Boolean(
          link.children?.some((child) => child.href && activeLinkHref === child.href)
        );
        const showSecondaryNavigation =
          link.href === "/aluno" &&
          (secondaryNavigationItems.length > 0 || Boolean(studentClinicalLink));
        const showChildNavigation = Boolean(link.children?.length);

        return (
          <div key={link.href ?? `group-${link.label}`} className="sidebar-nav-item">
            {link.href ? (
              <Link
                className={isActive ? "sidebar-link active" : "sidebar-link"}
                href={link.href as Route}
              >
                {renderNavigationLabel(link.label, link.badgeCount)}
              </Link>
            ) : (
              <div
                className={
                  hasActiveChild
                    ? "sidebar-nav-group-label sidebar-nav-group-label-active"
                    : "sidebar-nav-group-label"
                }
              >
                {renderNavigationLabel(link.label, link.badgeCount)}
              </div>
            )}

            {showChildNavigation ? (
              <div className="sidebar-subnav">
                {link.children?.map((child) => renderNestedLink(child))}
              </div>
            ) : null}

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
                    href={studentClinicalLink.href as Route}
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
