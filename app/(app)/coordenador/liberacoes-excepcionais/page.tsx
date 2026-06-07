import { SectionCard } from "@/components/common/section-card";
import { ExceptionalReleaseForm } from "@/components/forms/exceptional-release-form";
import { ExceptionalReleaseTable } from "@/components/tables/exceptional-release-table";
import { closeExceptionalReleaseAction } from "@/app/(app)/coordenador/liberacoes-excepcionais/actions";
import { requireRole } from "@/lib/auth/session";
import { getCoordinatorExceptionalReleasePageData } from "@/services/exceptional-releases";

export default async function ExceptionalReleaseManagementPage(props: {
  searchParams?: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";
  const { pageData, emptyState } = await getCoordinatorExceptionalReleasePageData(
    currentUser
  );

  return (
    <div className="stack exceptional-release-page">
      <section className="hero-card">
        <p className="eyebrow">Governança operacional</p>
        <h1>Liberações excepcionais</h1>
        <p>
          Gerencie liberações temporárias, pontuais e auditáveis por aluno para
          ajustes após o encerramento do período letivo, sempre dentro da sua unidade.
        </p>
        {notice ? (
          <p
            className={`form-notice ${
              noticeType === "success" ? "form-notice-success" : "form-notice-error"
            }`}
          >
            {notice}
          </p>
        ) : null}
      </section>

      {pageData ? (
        <>
          <div className="report-mini-grid exceptional-release-summary-grid">
            <div className="report-mini-card">
              <span>Ativas agora</span>
              <strong>{pageData.summary.activeCount}</strong>
            </div>
            <div className="report-mini-card">
              <span>Agendadas</span>
              <strong>{pageData.summary.scheduledCount}</strong>
            </div>
            <div className="report-mini-card">
              <span>Expiradas</span>
              <strong>{pageData.summary.expiredCount}</strong>
            </div>
            <div className="report-mini-card">
              <span>Utilizadas</span>
              <strong>{pageData.summary.usedCount}</strong>
            </div>
            <div className="report-mini-card">
              <span>Encerradas manualmente</span>
              <strong>{pageData.summary.closedCount}</strong>
            </div>
          </div>

          <SectionCard
            title="Nova liberação excepcional"
            description="Escolha o tipo, selecione semestre, turma e aluno, e registre uma vigência temporária para o usuário liberado."
            className="exceptional-release-form-card"
          >
            <ExceptionalReleaseForm
              semesterOptions={pageData.semesterOptions}
              classOptions={pageData.classOptions}
              studentOptions={pageData.studentOptions}
              recipientOptions={pageData.recipientOptions}
            />
          </SectionCard>

          <SectionCard
            title="Liberações ativas e agendadas"
            description="Liberações por aluno que ainda podem ser utilizadas ou que já têm vigência futura programada."
          >
            <ExceptionalReleaseTable
              entries={pageData.activeEntries}
              emptyMessage="Nenhuma liberação ativa ou agendada foi encontrada para a unidade."
              allowManualClose
              closeAction={closeExceptionalReleaseAction}
            />
          </SectionCard>

          <SectionCard
            title="Liberações expiradas, utilizadas e encerradas"
            description="Histórico recente de vigências por aluno que expiraram, foram utilizadas em um lançamento excepcional ou encerradas manualmente pela coordenação."
          >
            <ExceptionalReleaseTable
              entries={pageData.historicalEntries}
              emptyMessage="Nenhuma liberação expirada, utilizada ou encerrada foi encontrada para a unidade."
            />
          </SectionCard>
        </>
      ) : emptyState ? (
        <SectionCard title={emptyState.title} description={emptyState.description}>
          <p className="empty-message">{emptyState.description}</p>
        </SectionCard>
      ) : null}
    </div>
  );
}
