import { ClinicalTreatmentPlanContentCard } from "@/components/cards/clinical-treatment-plan-content";
import { ClinicalPrintCaseSummary } from "@/components/clinical/clinical-print-case-summary";
import { ClinicalPrintDocument } from "@/components/clinical/clinical-print-document";
import { ClinicalPrintSupervisionCard } from "@/components/clinical/clinical-print-supervision-card";
import { SectionCard } from "@/components/common/section-card";
import { requireRole } from "@/lib/auth/session";
import { formatClinicalRecordStatus, formatDate, formatDateTime } from "@/lib/utils/format";
import { loadInstitutionalReportBrandingForCurrentUser } from "@/services/report-branding";
import { getClinicalTreatmentPlanPageData } from "@/services/clinical-supervision";

function readSearchParam(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClinicalTreatmentPlanPrintPage(props: {
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
  const { pageData, emptyState } = await getClinicalTreatmentPlanPageData(
    currentUser,
    params.caseId
  );

  if (!pageData || emptyState) {
    return (
      <ClinicalPrintDocument
        branding={reportBranding}
        title="Plano de tratamento indisponível"
        subtitle={
          emptyState?.description ??
          "Não foi possível preparar esta versão de impressão do plano de tratamento."
        }
        backHref={`/clinica-supervisionada/${params.caseId}/plano-tratamento`}
        backLabel="Voltar ao plano"
        autoPrint={autoPrint}
      >
        <SectionCard
          title={emptyState?.title ?? "Impressão indisponível"}
          description="Revise o vínculo do caso antes de tentar novamente."
        >
          <p className="empty-message">
            O plano de tratamento não pôde ser consolidado para impressão nesta sessão.
          </p>
        </SectionCard>
      </ClinicalPrintDocument>
    );
  }

  return (
    <ClinicalPrintDocument
      branding={reportBranding}
      title={`Plano de tratamento · ${pageData.caseItem.patient.name}`}
      subtitle="Versão organizada para impressão do plano terapêutico."
      backHref={`/clinica-supervisionada/${pageData.caseItem.id}/plano-tratamento`}
      backLabel="Voltar ao plano"
      autoPrint={autoPrint}
    >
      <SectionCard
        title="Identificação do caso"
        description="Contexto clínico e acadêmico associado a este plano terapêutico."
      >
        <ClinicalPrintCaseSummary
          caseItem={pageData.caseItem}
          statusLabel="Status do plano"
          statusValue={
            pageData.treatmentPlan
              ? formatClinicalRecordStatus(pageData.treatmentPlan.status)
              : "Ainda não iniciado"
          }
        />
      </SectionCard>

      <SectionCard
        title="Plano de tratamento"
        description="Conteúdo completo do plano terapêutico registrado para o caso."
      >
        {pageData.treatmentPlan ? (
          <div className="clinical-record-overview-stack">
            <div className="clinical-record-overview-grid">
              <div className="report-mini-card">
                <span>Data do plano</span>
                <strong>{formatDate(pageData.treatmentPlan.content.planDate)}</strong>
              </div>
              <div className="report-mini-card">
                <span>Última atualização</span>
                <strong>{formatDateTime(pageData.treatmentPlan.updatedAt)}</strong>
              </div>
            </div>
            <ClinicalTreatmentPlanContentCard content={pageData.treatmentPlan.content} />
          </div>
        ) : (
          <p className="empty-message">
            O plano de tratamento ainda não foi registrado neste caso.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Supervisão"
        description="Status atual e parecer do supervisor sobre este plano de tratamento."
      >
        <ClinicalPrintSupervisionCard
          status={pageData.treatmentPlan?.status}
          feedback={pageData.treatmentPlan?.supervisorFeedback}
          emptyStatusLabel="Ainda não iniciado"
        />
      </SectionCard>
    </ClinicalPrintDocument>
  );
}
