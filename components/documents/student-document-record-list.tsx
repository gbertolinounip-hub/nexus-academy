import Link from "next/link";
import type { Route } from "next";
import { StudentDocumentReviewForm } from "@/components/documents/student-document-review-form";
import { formatDateTime, joinDisplayParts } from "@/lib/utils/format";
import type {
  StudentDocumentReviewerRole,
  StudentDocumentSummary
} from "@/types/domain";

interface StudentDocumentRecordListProps {
  documents: StudentDocumentSummary[];
  emptyMessage: string;
  canReview?: boolean;
  reviewerLabel?: string;
  reviewReadOnly?: boolean;
}

function buildDocumentSubtitle(document: StudentDocumentSummary) {
  if (document.type === "carteira_vacinacao") {
    return "Documento geral obrigatorio do aluno.";
  }

  if (document.type === "obrigatorio_generico") {
    return "Documento obrigatorio configurado dinamicamente para o curso.";
  }

  const scopeLabel = joinDisplayParts([document.areaName, document.semesterCode]);

  return scopeLabel || "Documento vinculado a area operacional do TCE.";
}

export function StudentDocumentRecordList({
  documents,
  emptyMessage,
  canReview = false,
  reviewerLabel = "validador",
  reviewReadOnly = false
}: StudentDocumentRecordListProps) {
  if (!documents.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="student-document-record-list">
      {documents.map((document) => (
        <article
          key={document.id}
          id={`documento-${document.id}`}
          className={`management-block-card student-document-record-card${
            !document.active ? " student-document-record-card-inactive" : ""
          }`}
        >
          <div className="management-block-header">
            <div>
              <h3>{document.typeLabel}</h3>
              <p className="field-help">{buildDocumentSubtitle(document)}</p>
            </div>
            <div className="student-document-record-badges">
              <span className={`status-pill status-${document.status}`}>
                {document.statusLabel}
              </span>
              {!document.active ? <span className="badge">Versao anterior</span> : null}
            </div>
          </div>

          <div className="report-mini-grid student-document-record-meta-grid">
            <div className="report-mini-card">
              <span>Arquivo</span>
              <strong>{document.fileName}</strong>
            </div>
            <div className="report-mini-card">
              <span>Enviado em</span>
              <strong>{formatDateTime(document.submittedAt)}</strong>
            </div>
            <div className="report-mini-card">
              <span>Validacao</span>
              <strong>
                {document.reviewedAt
                  ? formatDateTime(document.reviewedAt)
                  : "Aguardando analise"}
              </strong>
            </div>
            <div className="report-mini-card">
              <span>Revisado por</span>
              <strong>
                {document.reviewedByName
                  ? `${document.reviewedByName}${
                      document.reviewerRoleLabel
                        ? ` - ${document.reviewerRoleLabel}`
                        : ""
                    }`
                  : "Ainda sem validador"}
              </strong>
            </div>
          </div>

          {document.rejectionReason ? (
            <div className="form-notice form-notice-error student-document-record-reason">
              <strong>Justificativa da reprovacao:</strong> {document.rejectionReason}
            </div>
          ) : null}

          <div className="actions-row">
            <Link
              href={
                `/documentos/arquivo/${encodeURIComponent(document.id)}` as Route
              }
              className="button button-secondary button-small"
              target="_blank"
            >
              Visualizar arquivo
            </Link>
          </div>

          {canReview && document.active ? (
            <StudentDocumentReviewForm
              documentId={document.id}
              currentStatus={document.status}
              currentReviewerRole={
                document.reviewerRole as StudentDocumentReviewerRole | null
              }
              currentReason={document.rejectionReason}
              reviewerLabel={reviewerLabel}
              readOnly={reviewReadOnly}
            />
          ) : null}
        </article>
      ))}
    </div>
  );
}
