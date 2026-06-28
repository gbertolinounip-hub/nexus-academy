import StudentFinalReportPage from "@/app/(app)/relatorios/alunos/[studentId]/page";

interface MasterAuditStudentHistoricalReportPageProps {
  params: Promise<{
    semesterId: string;
    classId: string;
    studentId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MasterAuditStudentHistoricalReportPage(
  props: MasterAuditStudentHistoricalReportPageProps
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
      from: searchParams.from ?? "master-audit"
    })
  });
}
