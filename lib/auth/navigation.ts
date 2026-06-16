import type { Route } from "next";
import {
  defaultDashboardPath,
  getActiveMasterCourseContext,
  getDefaultDashboardPathForUser,
  roleLabels
} from "@/lib/auth/roles";
import type { ProfileCode, SessionUser } from "@/types/domain";

export interface NavigationItem {
  href: Route;
  label: string;
  allowedRoles: ProfileCode[];
  badgeCount?: number;
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
  { href: "/secretaria" as Route, label: "Secretaria", allowedRoles: ["secretaria"] },
  {
    href: "/clinica-supervisionada" as Route,
    label: "Clínica Supervisionada",
    allowedRoles: ["aluno", "professor", "secretaria"]
  },
  {
    href: "/documentos" as Route,
    label: "Documentos",
    allowedRoles: ["aluno"]
  },
  {
    href: "/professor/documentos" as Route,
    label: "Documentos",
    allowedRoles: ["professor"]
  },
  {
    href: "/pacientes" as Route,
    label: "Pacientes",
    allowedRoles: ["professor", "secretaria", "coordenador"]
  },
  {
    href: "/master" as Route,
    label: "Master",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/instituicoes" as Route,
    label: "Instituições / IES",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/unidades" as Route,
    label: "Unidades",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/cursos" as Route,
    label: "Cursos e ofertas",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/gestores-curso" as Route,
    label: "Gestores de curso",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/coordenadores" as Route,
    label: "Coordenadores",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/cursos/configuracoes" as Route,
    label: "Configurações dos cursos",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/usuarios" as Route,
    label: "Usuários",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/contextos" as Route,
    label: "Contextos institucionais",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/semestres" as Route,
    label: "Semestres por oferta",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/matriculas" as Route,
    label: "Matrículas por oferta",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/auditoria" as Route,
    label: "Auditoria global",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/clinica-supervisionada" as Route,
    label: "Gestão clínica",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/master/documentos" as Route,
    label: "Documentos",
    allowedRoles: ["coordenador_master"]
  },
  {
    href: "/coordenador" as Route,
    label: "Coordenador",
    allowedRoles: ["coordenador"]
  },
  {
    href: "/coordenador/clinica-supervisionada" as Route,
    label: "Gestão clínica",
    allowedRoles: ["coordenador"]
  },
  {
    href: "/coordenador/documentos" as Route,
    label: "Documentos",
    allowedRoles: ["coordenador"]
  },
  {
    href: "/coordenador/liberacoes-excepcionais" as Route,
    label: "Liberações excepcionais",
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

export function getNavigationForUser(currentUser: SessionUser) {
  const links = [...getNavigationForRole(currentUser.role)];

  if (getActiveMasterCourseContext(currentUser)) {
    const coordinatorDashboardIndex = links.findIndex(
      (link) => link.href === ("/coordenador" as Route)
    );

    if (coordinatorDashboardIndex >= 0) {
      links[coordinatorDashboardIndex] = {
        ...links[coordinatorDashboardIndex],
        href: "/master-curso" as Route,
        label: "Gestão do curso"
      };
    } else if (!links.some((link) => link.href === ("/master-curso" as Route))) {
      links.unshift({
        href: "/master-curso" as Route,
        label: "Gestão do curso",
        allowedRoles: [currentUser.role]
      });
    }
  }

  return links;
}

export function getUnauthorizedRedirectPath(role: ProfileCode) {
  return defaultDashboardPath[role];
}

export function getRoleDescription(
  currentUser: Pick<SessionUser, "role" | "contextoAtivo">
) {
  if (getActiveMasterCourseContext(currentUser)) {
    return "Gestor autenticado";
  }

  return `${roleLabels[currentUser.role]} autenticado`;
}

export function getHomeNavigationPath(
  currentUser: Pick<SessionUser, "role" | "contextoAtivo">
) {
  return getDefaultDashboardPathForUser(currentUser);
}
