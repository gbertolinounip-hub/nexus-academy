import { notFound } from "next/navigation";
import type { Route } from "next";
import { StudentDocumentDetailScreen } from "@/components/documents/student-document-detail-screen";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentDetailPageData } from "@/services/student-documents";

export default async function MasterStudentDocumentDetailPage(props: {
  params: Promise<{
    studentId: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador_master"]);
  const params = await props.params;
  const pageData = await getStudentDocumentDetailPageData({
    currentUser,
    viewerRole: "coordenador_master",
    studentId: params.studentId
  });

  if (!pageData) {
    notFound();
  }

  return (
    <StudentDocumentDetailScreen
      pageData={pageData}
      backHref={"/master/documentos" as Route}
      backLabel="Voltar para documentos"
      heroEyebrow="Documentos institucionais globais"
      heroTitle={pageData.student.name}
      heroDescription="Leitura institucional global do histórico documental do aluno, preservando o acompanhamento sem abrir o fluxo operacional de validação."
    />
  );
}
