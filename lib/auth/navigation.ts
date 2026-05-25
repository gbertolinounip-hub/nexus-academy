import type { Route } from "next";
import { defaultDashboardPath, roleLabels } from "@/lib/auth/roles";
import type { ProfileCode } from "@/types/domain";

export interface NavigationItem {
  href: Route;
  label: string;
  allowedRoles: ProfileCode[];
}

export interface SecondaryNavigationItem {
  key: string;
  label: string;
  description?: string;
  enrollmentId?: string;
  recentUpdateAt?: string | null;
}

export const navigationItems: NavigationItem[] = [
  { href: "/aluno" as Route, label: "Aluno", allowedRoles: ["aluno"] },
  { href: "/professor" as Route, label: "Professor", allowedRoles: ["professor"] },
  {
    href: "/master" as Route,
    label: "Master",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/unidades" as Route,
    label: "Unidades",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/coordenadores" as Route,
    label: "Coordenadores",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/usuarios" as Route,
    label: "Usuários",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/auditoria" as Route,
    label: "Auditoria global",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/coordenador" as Route,
    label: "Coordenador",
    allowedRoles: ["coordenador"]
  },
  {
    href: "/avaliacoes" as Route,
    label: "Lançamentos",
    allowedRoles: ["professor"]
  },
  {
    href: "/ausencias" as Route,
    label: "Faltas",
    allowedRoles: ["professor"]
  },
  {
    href: "/gestao/alunos" as Route,
    label: "Cadastros",
    allowedRoles: ["coordenador"]
  },
  {
    href: "/relatorios" as Route,
    label: "Relatórios",
    allowedRoles: ["coordenador", "professor"]
  },
  {
    href: "/auditoria" as Route,
    label: "Auditoria",
    allowedRoles: ["coordenador"]
  }
];

export function getNavigationForRole(role: ProfileCode) {
  return navigationItems.filter((item) => item.allowedRoles.includes(role));
}

export function getUnauthorizedRedirectPath(role: ProfileCode) {
  return defaultDashboardPath[role];
}

export function getRoleDescription(role: ProfileCode) {
  return `${roleLabels[role]} autenticado`;
}

