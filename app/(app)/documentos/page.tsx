import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { StudentDocumentNotificationFeed } from "@/components/documents/student-document-notification-feed";
import { StudentDocumentRecordList } from "@/components/documents/student-document-record-list";
import { StudentRequiredDocumentList } from "@/components/documents/student-required-document-list";
import { StudentDocumentUploadForm } from "@/components/documents/student-document-upload-form";
import { requireRole } from "@/lib/auth/session";
import { getStudentDocumentScopeForCurrentStudent } from "@/services/student-documents";

export default async function StudentDocumentsPage() {
  const currentUser = await requireRole(["aluno"]);
  const pageData = await getStudentDocumentScopeForCurrentStudent(currentUser);
  const activeVaccination = pageData.vaccinationCurrent;
  const activeTceCount = pageData.tceDocuments.filter((document) => document.active).length;
  const additionalDocumentHistory = pageData.additionalRequiredDocuments.flatMap(
    (entry) => entry.history
  );
  const rejectedCount = [
    ...pageData.vaccinationHistory,
    ...pageData.tceDocuments,
    ...additionalDocumentHistory
  ].filter((document) => document.active && document.status === "reprovado").length;

  return (
    <div className="stack student-documents-page">
      <section className="hero-card">
        <p className="eyebrow">Documentos do aluno</p>
        <h1>{pageData.student.name}</h1>
        <p>
          Envie sua carteira de vacinação, os TCEs e os demais documentos
          obrigatórios configurados pelo curso. Os arquivos ficam em storage
          privado e podem ser revisados por professor supervisor e coordenação.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Carteira atual"
          value={activeVaccination ? activeVaccination.statusLabel : "Sem envio"}
          hint="A carteira de vacinação é única por aluno e o reenvio substitui a versão ativa."
          tone={activeVaccination?.status === "aprovado" ? "positive" : "default"}
        />
        <MetricCard
          label="TCEs ativos"
          value={String(activeTceCount)}
          hint="Quantidade de TCEs atualmente ativos por área e bloco."
        />
        <MetricCard
          label="Notificações não lidas"
          value={String(pageData.notifications.unreadCount)}
          hint="Devolutivas documentais ainda pendentes de leitura."
          tone={pageData.notifications.unreadCount > 0 ? "alert" : "default"}
        />
        <MetricCard
          label="Reprovações ativas"
          value={String(rejectedCount)}
          hint="Documentos ativos que pedem correção e novo envio."
          tone={rejectedCount > 0 ? "alert" : "default"}
        />
      </div>

      <SectionCard
        title="Resumo do cadastro"
        description="Identificação básica do aluno e do contexto institucional atual do envio."
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
            <span>Unidade</span>
            <strong>{pageData.student.unitName ?? "Não informada"}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Pendências e notificações"
        description="Acompanhe reprovações, justificativas e devolutivas documentais antes de reenviar uma nova versão."
      >
        <div className="split-grid student-document-page-split">
          <div className="management-block-card student-document-notification-panel">
            <div className="management-block-header">
              <div>
                <h3>Não lidas</h3>
                <p className="field-help">
                  Notificações recentes que ainda exigem sua leitura.
                </p>
              </div>
            </div>
            <div className="student-document-notification-panel-scroll">
              <StudentDocumentNotificationFeed
                notifications={pageData.notifications.pendingItems}
                emptyMessage="Nenhuma notificação documental pendente de leitura."
              />
            </div>
          </div>

          <div className="management-block-card student-document-notification-panel">
            <div className="management-block-header">
              <div>
                <h3>Histórico</h3>
                <p className="field-help">
                  Histórico completo das devolutivas e reprovações documentais.
                </p>
              </div>
            </div>
            <div className="student-document-notification-panel-scroll">
              <StudentDocumentNotificationFeed
                notifications={pageData.notifications.historyItems}
                emptyMessage="Ainda não há histórico de devolutivas documentais."
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {pageData.additionalRequiredDocuments.length ? (
        <SectionCard
          title="Documentos obrigatórios adicionais"
          description="Documentos ativos configurados pelo curso para este aluno. Mesmo sem envio, eles já aparecem aqui para acompanhamento e upload."
        >
          <StudentRequiredDocumentList
            entries={pageData.additionalRequiredDocuments}
            emptyMessage="Não há documentos obrigatórios adicionais ativos para este curso."
            allowUpload
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Carteira de vacinação"
        description="Documento único por aluno. Se você reenviar uma nova versão, a anterior sai da condição ativa."
      >
        <div className="student-document-module-stack">
          <StudentDocumentUploadForm
            documentType="carteira_vacinacao"
            title="Enviar carteira de vacinação"
            description="Use esta área para o envio inicial ou para substituir a carteira ativa atual."
            submitLabel="Enviar carteira"
          />

          <StudentDocumentRecordList
            documents={pageData.vaccinationHistory}
            emptyMessage="Você ainda não enviou carteira de vacinação."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="TCE por área e bloco"
        description="Cada TCE é enviado no contexto de uma área operacional específica e pode coexistir com TCEs de outras áreas."
      >
        <div className="student-document-module-stack">
          <StudentDocumentUploadForm
            documentType="tce"
            title="Enviar TCE"
            description="Selecione a área e o bloco corretos antes de anexar o TCE correspondente."
            submitLabel="Enviar TCE"
            tceOptions={pageData.tceOptions}
            disabledMessage={
              pageData.tceOptions.length
                ? null
                : "Ainda não há vínculo ativo de área e bloco disponível para envio do TCE."
            }
          />

          <StudentDocumentRecordList
            documents={pageData.tceDocuments}
            emptyMessage="Você ainda não enviou TCEs vinculados às áreas operacionais."
          />
        </div>
      </SectionCard>
    </div>
  );
}
