import StudentFinalReportPage from "@/app/(app)/relatorios/alunos/[studentId]/page";

interface AuditStudentHistoricalReportPageProps {
  params: Promise<{
    semesterId: string;
    classId: string;
    studentId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AuditStudentHistoricalReportPage(
  props: AuditStudentHistoricalReportPageProps
) {
  const { semesterId, classId, studentId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};

  return StudentFinalReportPage({
    params: Promise.resolve({
      studentId
    }),
    searchParams: Promise.resolve({
      ...searchParams,
      semestre: searchParams.semestre ?? semesterId,
      turma: searchParams.turma ?? classId,
      from: searchParams.from ?? "audit"
    })
  });
}
