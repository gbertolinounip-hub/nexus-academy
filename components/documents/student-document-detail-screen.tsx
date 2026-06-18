import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { StudentDocumentRecordList } from "@/components/documents/student-document-record-list";
import { StudentRequiredDocumentList } from "@/components/documents/student-required-document-list";
import type { StudentDocumentDetailPageData } from "@/services/student-documents";

interface StudentDocumentDetailScreenProps {
  pageData: StudentDocumentDetailPageData;
  backHref: Route;
  backLabel: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
}

function buildReviewerLabel(viewerRole: StudentDocumentDetailPageData["viewerRole"]) {
  switch (viewerRole) {
    case "coordenador":
      return "coordenação";
    case "professor":
      return "professor supervisor";
    default:
      return "validador";
  }
}

export function StudentDocumentDetailScreen({
  pageData,
  backHref,
  backLabel,
  heroEyebrow,
  heroTitle,
  heroDescription
}: StudentDocumentDetailScreenProps) {
  const additionalDocumentHistory = pageData.additionalRequiredDocuments.flatMap(
    (entry) => entry.history
  );
  const allDocuments = [
    ...pageData.vaccinationDocuments,
    ...pageData.tceDocuments,
    ...additionalDocumentHistory
  ];
  const activeVaccination =
    pageData.vaccinationDocuments.find((document) => document.active) ?? null;
  const activeTces = pageData.tceDocuments.filter((document) => document.active);
  const pendingCount = allDocuments.filter(
    (document) => document.active && document.status === "enviado"
  ).length;
  const rejectedCount = allDocuments.filter(
    (document) => document.active && document.status === "reprovado"
  ).length;
  const reviewerLabel = buildReviewerLabel(pageData.viewerRole);

  return (
    <div className="stack student-documents-page student-documents-detail-page">
      <section className="hero-card">
        <p className="eyebrow">{heroEyebrow}</p>
        <h1>{heroTitle}</h1>
        <p>{heroDescription}</p>
        <div className="actions-row">
          <Link href={backHref} className="button button-secondary">
            {backLabel}
          </Link>
        </div>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Carteira ativa"
          value={activeVaccination ? activeVaccination.statusLabel : "Sem envio"}
          hint="Última versão da carteira de vacinação enviada pelo aluno."
          tone={activeVaccination?.status === "aprovado" ? "positive" : "default"}
        />
        <MetricCard
          label="TCEs ativos"
          value={String(activeTces.length)}
          hint="Quantidade de TCEs ativos no histórico operacional do aluno."
        />
        <MetricCard
          label="Pendências"
          value={String(pendingCount)}
          hint="Documentos ativos aguardando análise neste momento."
          tone="alert"
        />
        <MetricCard
          label="Reprovações ativas"
          value={String(rejectedCount)}
          hint="Documentos ativos reprovados e passíveis de reenvio pelo aluno."
          tone={rejectedCount > 0 ? "alert" : "default"}
        />
      </div>

      <SectionCard
        title="Resumo do aluno"
        description="Identificação do cadastro-base e vínculo operacional do aluno no escopo atual."
      >
        <div className="report-mini-grid student-document-summary-grid">
          <div className="report-mini-card">
            <span>Aluno</span>
            <strong>{pageData.student.name}</strong>
          </div>
          <div className="report-mini-card">
            <span>Matrícula</span>
            <strong>{pageData.student.registration}</strong>
          </div>
          <div className="report-mini-card">
            <span>E-mail</span>
            <strong>{pageData.student.email}</strong>
          </div>
          <div className="report-mini-card">
            <span>Status</span>
            <strong>{pageData.student.active ? "Ativo" : "Inativo"}</strong>
          </div>
          <div className="report-mini-card">
            <span>Unidade</span>
            <strong>{pageData.student.unitName ?? "Não informada"}</strong>
          </div>
          <div className="report-mini-card student-document-summary-card-wide">
            <span>Áreas operacionais</span>
            <strong>
              {pageData.student.areaLabels.length
                ? pageData.student.areaLabels.join(" · ")
                : "Nenhuma área ativa identificada"}
            </strong>
          </div>
        </div>
      </SectionCard>

      {pageData.additionalRequiredDocuments.length ? (
        <SectionCard
          title="Documentos obrigatórios adicionais"
          description="Documentos ativos configurados pelo curso para este aluno. Eles aparecem aqui mesmo quando ainda não houve envio."
        >
          <StudentRequiredDocumentList
            entries={pageData.additionalRequiredDocuments}
            emptyMessage="Não há documentos obrigatórios adicionais ativos para este curso."
            canReview={pageData.canReview}
            reviewerLabel={reviewerLabel}
            reviewReadOnly={!pageData.canReview}
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Carteira de vacinação"
        description="Histórico completo da carteira de vacinação, incluindo versões substituídas."
      >
        <StudentDocumentRecordList
          documents={pageData.vaccinationDocuments}
          emptyMessage="O aluno ainda não enviou carteira de vacinação."
          canReview={pageData.canReview}
          reviewerLabel={reviewerLabel}
          reviewReadOnly={!pageData.canReview}
        />
      </SectionCard>

      <SectionCard
        title="TCEs do aluno"
        description="Histórico dos TCEs por área operacional e bloco vinculados ao aluno."
      >
        <StudentDocumentRecordList
          documents={pageData.tceDocuments}
          emptyMessage="O aluno ainda não enviou TCEs para as áreas operacionais."
          canReview={pageData.canReview}
          reviewerLabel={reviewerLabel}
          reviewReadOnly={!pageData.canReview}
        />
      </SectionCard>
    </div>
  );
}
