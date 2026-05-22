import { roleCapabilities } from "@/lib/auth/roles";
import type { SessionUser } from "@/types/domain";

export function canViewOwnData(session: SessionUser, ownerId: string) {
  return (
    session.role === "coordenador" ||
    session.role === "coordenador_master" ||
    session.id === ownerId
  );
}

export function canViewEnrollment(
  session: SessionUser,
  enrollmentId: string,
  linkedEnrollmentIds: string[]
) {
  if (session.role === "coordenador") {
    return true;
  }

  if (session.role === "professor") {
    return linkedEnrollmentIds.includes(enrollmentId);
  }

  return false;
}

export function canEditGrades(
  session: SessionUser,
  enrollmentId: string,
  linkedEnrollmentIds: string[]
) {
  if (!roleCapabilities[session.role].canEditGrades) {
    return false;
  }

  if (session.role === "coordenador") {
    return true;
  }

  return linkedEnrollmentIds.includes(enrollmentId);
}
