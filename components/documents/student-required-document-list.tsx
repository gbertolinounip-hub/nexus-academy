import Link from "next/link";
import type { Route } from "next";
import { StudentDocumentReviewForm } from "@/components/documents/student-document-review-form";
import { StudentDocumentUploadForm } from "@/components/documents/student-document-upload-form";
import { formatDateTime } from "@/lib/utils/format";
import type {
  StudentDocumentReviewerRole,
  StudentRequiredDocumentEntry
} from "@/types/domain";

interface StudentRequiredDocumentListProps {
  entries: StudentRequiredDocumentEntry[];
  emptyMessage: string;
  canReview?: boolean;
  reviewerLabel?: string;
  reviewReadOnly?: boolean;
  allowUpload?: boolean;
}

export function StudentRequiredDocumentList({
  entries,
  emptyMessage,
  canReview = false,
  reviewerLabel = "validador",
  reviewReadOnly = false,
  allowUpload = false
}: StudentRequiredDocumentListProps) {
  if (!entries.length) {
    return <p className="empty-message">{emptyMessage}</p>;
  }

  return (
    <div className="student-document-record-list">
      {entries.map((entry) => {
        const currentDocument = entry.currentDocument;

        return (
          <article
            key={entry.requiredCourseDocumentId}
            className="management-block-card student-document-record-card"
          >
            <div className="management-block-header">
              <div>
                <h3>{entry.displayName}</h3>
                <p className="field-help">
                  Tipo documental: <strong>{entry.documentTypeName}</strong>
                </p>
              </div>
              <div className="student-document-record-badges">
                {entry.required ? <span className="badge">Obrigatório</span> : null}
                {currentDocument ? (
                  <span className={`status-pill status-${currentDocument.status}`}>
                    {currentDocument.statusLabel}
                  </span>
                ) : (
                  <span className="table-helper">Sem envio</span>
                )}
              </div>
            </div>

            {entry.description ? <p className="field-help">{entry.description}</p> : null}

            {currentDocument ? (
              <>
                <div className="report-mini-grid student-document-record-meta-grid">
                  <div className="report-mini-card">
                    <span>Arquivo</span>
                    <strong>{currentDocument.fileName}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Enviado em</span>
                    <strong>{formatDateTime(currentDocument.submittedAt)}</strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Validação</span>
                    <strong>
                      {currentDocument.reviewedAt
                        ? formatDateTime(currentDocument.reviewedAt)
                        : "Aguardando análise"}
                    </strong>
                  </div>
                  <div className="report-mini-card">
                    <span>Revisado por</span>
                    <strong>
                      {currentDocument.reviewedByName
                        ? `${currentDocument.reviewedByName}${
                            currentDocument.reviewerRoleLabel
                              ? ` - ${currentDocument.reviewerRoleLabel}`
                              : ""
                          }`
                        : "Ainda sem validador"}
                    </strong>
                  </div>
                </div>

                {currentDocument.rejectionReason ? (
                  <div className="form-notice form-notice-error student-document-record-reason">
                    <strong>Justificativa da reprovação:</strong>{" "}
                    {currentDocument.rejectionReason}
                  </div>
                ) : null}

                <div className="actions-row">
                  <Link
                    href={
                      `/documentos/arquivo/${encodeURIComponent(currentDocument.id)}` as Route
                    }
                    className="button button-secondary button-small"
                    target="_blank"
                  >
                    Visualizar arquivo
                  </Link>
                </div>

                {canReview && currentDocument.active ? (
                  <StudentDocumentReviewForm
                    documentId={currentDocument.id}
                    currentStatus={currentDocument.status}
                    currentReviewerRole={
                      currentDocument.reviewerRole as StudentDocumentReviewerRole | null
                    }
                    currentReason={currentDocument.rejectionReason}
                    reviewerLabel={reviewerLabel}
                    readOnly={reviewReadOnly}
                  />
                ) : null}
              </>
            ) : (
              <p className="field-help">
                O aluno ainda não enviou este documento obrigatório.
              </p>
            )}

            {allowUpload ? (
              <StudentDocumentUploadForm
                documentType="obrigatorio_generico"
                requiredCourseDocumentId={entry.requiredCourseDocumentId}
                title={
                  currentDocument
                    ? `Enviar nova versão de ${entry.displayName}`
                    : `Enviar ${entry.displayName}`
                }
                description="Envie o arquivo correspondente a este documento obrigatório configurado pelo curso."
                submitLabel={currentDocument ? "Enviar nova versão" : "Enviar documento"}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
