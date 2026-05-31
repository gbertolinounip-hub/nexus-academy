import { notFound } from "next/navigation";
import type { Route } from "next";
import { StudentDocumentDetailScreen } from "@/components/documents/student-document-detail-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDetailPageData } from "@/services/student-documents";

export default async function CoordinatorStudentDocumentDetailPage(props: {
  params: Promise<{
    studentId: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const params = await props.params;
  const pageData = await getStudentDocumentDetailPageData({
    currentUser,
    viewerRole: "coordenador",
    studentId: params.studentId
  });

  if (!pageData) {
    notFound();
  }

  return (
    <StudentDocumentDetailScreen
      pageData={pageData}
      backHref={"/coordenador/documentos" as Route}
      backLabel="Voltar para documentos"
      heroEyebrow="Documentos institucionais"
      heroTitle={pageData.student.name}
      heroDescription="Acompanhe o histórico documental do aluno e, quando necessário, aprove ou reprove os documentos no escopo da coordenação."
    />
  );
}
