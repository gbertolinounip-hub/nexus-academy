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
          Envie sua carteira de vacinacao, os TCEs e os demais documentos
          obrigatorios configurados pelo curso. Os arquivos ficam em storage
          privado e podem ser revisados por professor supervisor e coordenacao.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Carteira atual"
          value={activeVaccination ? activeVaccination.statusLabel : "Sem envio"}
          hint="A carteira de vacinacao e unica por aluno e o reenvio substitui a versao ativa."
          tone={activeVaccination?.status === "aprovado" ? "positive" : "default"}
        />
        <MetricCard
          label="TCEs ativos"
          value={String(activeTceCount)}
          hint="Quantidade de TCEs atualmente ativos por area e bloco."
        />
        <MetricCard
          label="Notificacoes nao lidas"
          value={String(pageData.notifications.unreadCount)}
          hint="Devolutivas documentais ainda pendentes de leitura."
          tone={pageData.notifications.unreadCount > 0 ? "alert" : "default"}
        />
        <MetricCard
          label="Reprovacoes ativas"
          value={String(rejectedCount)}
          hint="Documentos ativos que pedem correcao e novo envio."
          tone={rejectedCount > 0 ? "alert" : "default"}
        />
      </div>

      <SectionCard
        title="Resumo do cadastro"
        description="Identificacao basica do aluno e do contexto institucional atual do envio."
      >
        <div className="report-mini-grid student-document-summary-grid">
          <div className="report-mini-card">
            <span>Aluno</span>
            <strong>{pageData.student.name}</strong>
          </div>
          <div className="report-mini-card">
            <span>Matricula</span>
            <strong>{pageData.student.registration}</strong>
          </div>
          <div className="report-mini-card">
            <span>E-mail</span>
            <strong>{pageData.student.email}</strong>
          </div>
          <div className="report-mini-card">
            <span>Unidade</span>
            <strong>{pageData.student.unitName ?? "Nao informada"}</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Pendencias e notificacoes"
        description="Acompanhe reprovacoes, justificativas e devolutivas documentais antes de reenviar uma nova versao."
      >
        <div className="split-grid student-document-page-split">
          <div className="management-block-card student-document-notification-panel">
            <div className="management-block-header">
              <div>
                <h3>Nao lidas</h3>
                <p className="field-help">
                  Notificacoes recentes que ainda exigem sua leitura.
                </p>
              </div>
            </div>
            <div className="student-document-notification-panel-scroll">
              <StudentDocumentNotificationFeed
                notifications={pageData.notifications.pendingItems}
                emptyMessage="Nenhuma notificacao documental pendente de leitura."
              />
            </div>
          </div>

          <div className="management-block-card student-document-notification-panel">
            <div className="management-block-header">
              <div>
                <h3>Historico</h3>
                <p className="field-help">
                  Historico completo das devolutivas e reprovacoes documentais.
                </p>
              </div>
            </div>
            <div className="student-document-notification-panel-scroll">
              <StudentDocumentNotificationFeed
                notifications={pageData.notifications.historyItems}
                emptyMessage="Ainda nao ha historico de devolutivas documentais."
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {pageData.additionalRequiredDocuments.length ? (
        <SectionCard
          title="Documentos obrigatorios adicionais"
          description="Documentos ativos configurados pelo curso para este aluno. Mesmo sem envio, eles ja aparecem aqui para acompanhamento e upload."
        >
          <StudentRequiredDocumentList
            entries={pageData.additionalRequiredDocuments}
            emptyMessage="Nao ha documentos obrigatorios adicionais ativos para este curso."
            allowUpload
          />
        </SectionCard>
      ) : null}

      <SectionCard
        title="Carteira de vacinacao"
        description="Documento unico por aluno. Se voce reenviar uma nova versao, a anterior sai da condicao ativa."
      >
        <div className="student-document-module-stack">
          <StudentDocumentUploadForm
            documentType="carteira_vacinacao"
            title="Enviar carteira de vacinacao"
            description="Use esta area para o envio inicial ou para substituir a carteira ativa atual."
            submitLabel="Enviar carteira"
          />

          <StudentDocumentRecordList
            documents={pageData.vaccinationHistory}
            emptyMessage="Voce ainda nao enviou carteira de vacinacao."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="TCE por area e bloco"
        description="Cada TCE e enviado no contexto de uma area operacional especifica e pode coexistir com TCEs de outras areas."
      >
        <div className="student-document-module-stack">
          <StudentDocumentUploadForm
            documentType="tce"
            title="Enviar TCE"
            description="Selecione a area e o bloco corretos antes de anexar o TCE correspondente."
            submitLabel="Enviar TCE"
            tceOptions={pageData.tceOptions}
            disabledMessage={
              pageData.tceOptions.length
                ? null
                : "Ainda nao ha vinculo ativo de area e bloco disponivel para envio do TCE."
            }
          />

          <StudentDocumentRecordList
            documents={pageData.tceDocuments}
            emptyMessage="Voce ainda nao enviou TCEs vinculados as areas operacionais."
          />
        </div>
      </SectionCard>
    </div>
  );
}
