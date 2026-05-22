import type { PropsWithChildren } from "react";
import Link from "next/link";
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
}

export function DashboardShell({
  children,
  currentUser,
  navigationItems,
  secondaryNavigationItems
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
              A navegação agora é filtrada pelo perfil autenticado, e as rotas
              são protegidas no servidor.
            </p>
          ) : null}
          {showSidebarHelperContent ? (
            <Link href="/redirecionar" className="button button-secondary">
              Ir para minha área
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </aside>

      <main className="page">{children}</main>
    </div>
  );
}
