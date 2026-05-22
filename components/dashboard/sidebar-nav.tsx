"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import type {
  NavigationItem,
  SecondaryNavigationItem
} from "@/lib/auth/navigation";

interface SidebarNavProps {
  links: NavigationItem[];
  secondaryNavigationItems?: SecondaryNavigationItem[];
}

export function SidebarNav({
  links,
  secondaryNavigationItems = []
}: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEnrollmentId = searchParams.get("matricula");
  const activeLinkHref =
    [...links]
      .sort((left, right) => right.href.length - left.href.length)
      .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
      ?.href ?? null;

  return (
    <nav className="sidebar-nav">
      {links.map((link) => {
        const isActive = activeLinkHref === link.href;
        const showSecondaryNavigation =
          link.href === "/aluno" && secondaryNavigationItems.length > 0;

        return (
          <div key={link.href} className="sidebar-nav-item">
            <Link className={isActive ? "sidebar-link active" : "sidebar-link"} href={link.href}>
              {link.label}
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
                      href={href as Route}
                    >
                      <strong>{item.label}</strong>
                      {item.description ? <span>{item.description}</span> : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
