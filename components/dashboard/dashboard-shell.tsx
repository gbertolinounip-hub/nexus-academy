import type { PropsWithChildren } from "react";
import Link from "next/link";
import type { Route } from "next";
import { BrandLockup } from "@/components/common/brand-lockup";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/forms/sign-out-button";
import {
  getRoleDescription,
  type NavigationItem,
  type SecondaryNavigationItem
} from "@/lib/auth/navigation";
import type { SessionUser } from "@/types/domain";

interface DashboardShellProps extends PropsWithChildren {
  currentUser: SessionUser;
  navigationItems: NavigationItem[];
  secondaryNavigationItems?: SecondaryNavigationItem[];
  currentUserId: string;
}

export function DashboardShell({
  children,
  currentUser,
  navigationItems,
  secondaryNavigationItems,
  currentUserId
}: DashboardShellProps) {
  const showSidebarHelperContent = false;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup
            compact
            eyebrow="Plataforma institucional"
            subtitle={"Desempenho e gest\u00e3o de est\u00e1gios"}
          />
        </div>

        <div className="sidebar-user">
          <strong>{currentUser.name}</strong>
          <span>{getRoleDescription(currentUser.role)}</span>
        </div>

        <SidebarNav
          currentUserId={currentUserId}
          links={navigationItems}
          secondaryNavigationItems={secondaryNavigationItems}
        />

        <div
          className={
            showSidebarHelperContent
              ? "sidebar-footer"
              : "sidebar-footer sidebar-footer-minimal"
          }
        >
          {showSidebarHelperContent ? (
            <p>
              A navega\u00e7\u00e3o agora \u00e9 filtrada pelo perfil autenticado, e as
              rotas s\u00e3o protegidas no servidor.
            </p>
          ) : null}
          {showSidebarHelperContent ? (
            <Link href="/redirecionar" className="button button-secondary">
              Ir para minha \u00e1rea
            </Link>
          ) : null}
          <div className="sidebar-footer-actions">
            <Link
              href={"/conta/seguranca" as Route}
              className="button button-secondary"
            >
              Alterar senha
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="page">{children}</main>
    </div>
  );
}
