import { ClinicalEvaluationContentCard } from "@/components/cards/clinical-evaluation-content";
import { ClinicalPrintCaseSummary } from "@/components/clinical/clinical-print-case-summary";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import { ClinicalPrintSupervisionCard } from "@/components/clinical/clinical-print-supervision-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { formatClinicalRecordStatus, formatDate, formatDateTime } from "@/lib/utils/format";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getClinicalEvaluationPageData } from "@/services/clinical-supervision";

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClinicalEvaluationPrintPage(props: {
  params: Promise<{ caseId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const currentUser = await requireRole([
    "professor",
    "aluno",
    "coordenador",
    "coordenador_master"
  ]);
  const reportBranding =
    await loadInstitutionalReportBrandingForCurrentUser(currentUser);
  const params = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const autoPrint = readSearchParam(searchParams.print) === "1";
  const { pageData, emptyState } = await getClinicalEvaluationPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        branding={reportBranding}
        title="Avaliação clínica indisponível"
        subtitle={
          emptyState?.description ??
          "Não foi possível preparar esta versão de impressão da avaliação."
        }
        backHref={`/clinica-supervisionada/${params.caseId}/avaliacao`}
        backLabel="Voltar à avaliação"
        autoPrint={autoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Impressão indisponível"}
          description="Revise o vínculo do caso antes de tentar novamente."
        >
          <p className="empty-message">
            A avaliação clínica não pôde ser consolidada para impressão nesta sessão.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      branding={reportBranding}
      title={`Avaliação clínica · ${pageData.caseItem.patient.name}`}
      subtitle="Versão organizada para impressão do registro de avaliação clínica."
      backHref={`/clinica-supervisionada/${pageData.caseItem.id}/avaliacao`}
      backLabel="Voltar à avaliação"
      autoPrint={autoPrint}
    >
      <SectionCard
        title="Identificação do caso"
        description="Contexto clínico e acadêmico associado a esta avaliação."
      >
        <ClinicalPrintCaseSummary
          caseItem={pageData.caseItem}
          statusLabel="Status da avaliação"
          statusValue={
            pageData.evaluation
              ? formatClinicalRecordStatus(pageData.evaluation.status)
              : "Ainda não iniciada"
          }
        />
      </SectionCard>

      <SectionCard
        title="Avaliação clínica"
        description="Conteúdo completo do registro de avaliação do caso."
      >
        {pageData.evaluation ? (
          <div className="clinical-record-overview-stack">
            <div className="clinical-record-overview-grid">
              <div className="report-mini-card">
                <span>Data da avaliação</span>
                <strong>{formatDate(pageData.evaluation.content.evaluationDate)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Última atualização</span>
                <strong>{formatDateTime(pageData.evaluation.updatedAt)}</strong>
              </div>
            </div>
            <ClinicalEvaluationContentCard content={pageData.evaluation.content} />
          </div>
        ) : (
          <p className="empty-message">
            A avaliação clínica ainda não foi registrada neste caso.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Supervisão"
        description="Status atual e parecer do supervisor sobre esta avaliação."
      >
        <ClinicalPrintSupervisionCard
          status={pageData.evaluation?.status}
          feedback={pageData.evaluation?.supervisorFeedback}
          emptyStatusLabel="Ainda não iniciada"
        />
      </SectionCard>
    </ClinicalPrintDocument>
  );
}
