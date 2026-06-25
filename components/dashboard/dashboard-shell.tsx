import type { PropsWithChildren } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ContextSwitcher } from "@/components/auth/context-switcher";
import { BrandLockup } from "@/components/common/brand-lockup";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/forms/sign-out-button";
import {
  getRoleDescription,
  type NavigationItem,
  type SecondaryNavigationItem
} from "@/lib/auth/navigation";
import type { InstitutionBrandingSummary } from "@/services/institution-branding";
import type { SessionUser } from "@/types/domain";

interface DashboardShellProps extends PropsWithChildren {
  currentUser: SessionUser;
  navigationItems: NavigationItem[];
  secondaryNavigationItems?: SecondaryNavigationItem[];
  currentUserId: string;
  institutionBranding?: InstitutionBrandingSummary | null;
}

export function DashboardShell({
  children,
  currentUser,
  navigationItems,
  secondaryNavigationItems,
  currentUserId,
  institutionBranding
}: DashboardShellProps) {
  const showSidebarHelperContent = false;
  const sidebarInstitutionLogoSrc =
    institutionBranding?.primaryLogoUrl ?? institutionBranding?.compactLogoUrl ?? null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandLockup
            compact
            subtitle="Gestão de estágios e desempenho acadêmico"
            institutionLogoSrc={sidebarInstitutionLogoSrc}
            institutionLogoAlt={
              institutionBranding ? `Logo da ${institutionBranding.displayName}` : ""
            }
          />
        </div>

        <div className="sidebar-account-stack">
          <div className="sidebar-user">
            <strong>{currentUser.name}</strong>
            <span>{getRoleDescription(currentUser)}</span>
          </div>

          <ContextSwitcher currentUser={currentUser} />
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
              A navegação agora é filtrada pelo perfil autenticado, e as rotas são
              protegidas no servidor.
            </p>
          ) : null}
          {showSidebarHelperContent ? (
            <Link href="/redirecionar" className="button button-secondary">
              Ir para minha área
            </Link>
          ) : null}
          <div className="sidebar-footer-actions">
            <Link href={"/conta/seguranca" as Route} className="button button-secondary">
              Alterar senha
            </Link>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main className="page">
        {currentUser.role === "aluno" && currentUser.passwordChangeRecommended ? (
          <section className="student-password-notice" aria-label="Aviso de segurança">
            <div className="student-password-notice-icon" aria-hidden="true">
              !
            </div>

            <div className="student-password-notice-copy">
              <div className="student-password-notice-meta">
                <span className="student-password-notice-tag">Atenção de segurança</span>
                <p className="eyebrow">Segurança da conta</p>
              </div>
              <h2>Bem-vindo ao Nexus Academy!</h2>
              <p>
                Seu acesso foi criado com uma senha padrão. Recomendamos alterar sua
                senha agora para manter sua conta mais segura.
              </p>
            </div>

            <div className="student-password-notice-actions">
              <Link href={"/conta/seguranca" as Route} className="button">
                Alterar senha
              </Link>
            </div>
          </section>
        ) : null}

        {children}
      </main>
    </div>
  );
}
