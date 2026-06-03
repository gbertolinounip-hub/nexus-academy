import type { Route } from "next";
import type { ProfileCode } from "@/types/domain";

export const roleLabels: Record<ProfileCode, string> = {
  aluno: "Aluno",
  professor: "Professor",
  secretaria: "Secretaria",
  coordenador: "Coordenador",
  coordenador_master: "Coordenador master"
};

export const defaultDashboardPath: Record<ProfileCode, Route> = {
  aluno: "/aluno" as Route,
  professor: "/professor" as Route,
  secretaria: "/secretaria" as Route,
  coordenador: "/coordenador" as Route,
  coordenador_master: "/master" as Route
};

export const roleCapabilities = {
  aluno: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: false,
    canAudit: false
  },
  professor: {
    canEditGrades: true,
    canEditAbsences: true,
    canManageStructure: false,
    canAudit: false
  },
  secretaria: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: false,
    canAudit: false
  },
  coordenador: {
    canEditGrades: true,
    canEditAbsences: true,
    canManageStructure: true,
    canAudit: true
  },
  coordenador_master: {
    canEditGrades: false,
    canEditAbsences: false,
    canManageStructure: true,
    canAudit: true
  }
} as const satisfies Record<
  ProfileCode,
  {
    canEditGrades: boolean;
    canEditAbsences: boolean;
    canManageStructure: boolean;
    canAudit: boolean;
  }
>;
