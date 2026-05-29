import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalNotificationFeed } from "@/components/cards/clinical-notification-feed";
import { requireRole } from "@/lib/auth/session";
import { getClinicalSupervisionPageData } from "@/services/clinical-supervision";

export default async function ClinicalNotificationHistoryPage() {
  const currentUser = await requireRole(["professor", "aluno"]);
  const { pageData, emptyState } = await getClinicalSupervisionPageData(currentUser);

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>Histórico clínico</h1>
          <p>
            Consulte a trilha de notificações e movimentações dos registros
            clínicos dentro do seu contexto atual.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Histórico indisponível"}
          description={
            emptyState?.description ??
            "Ainda não foi possível carregar o histórico clínico neste contexto."
          }
        >
          <p className="empty-message">
            Revise o vínculo do caso, do estágio e da supervisão antes de tentar
            novamente.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>Histórico clínico</h1>
        <p>
          {pageData.view === "professor"
            ? "Consulte as notificações e movimentações já registradas na supervisão clínica dos seus casos."
            : "Consulte as notificações e movimentações já registradas nos seus casos clínicos."}
        </p>
      </section>

      <SectionCard
        title="Histórico de notificações"
        description="Linha de consulta das movimentações recentes da avaliação, do plano de tratamento e das evoluções, incluindo itens já lidos e resolvidos."
        actions={
          <Link
            href={"/clinica-supervisionada" as Route}
            className="button button-secondary button-small"
          >
            Voltar às pendências
          </Link>
        }
      >
        <ClinicalNotificationFeed
          notifications={pageData.notifications.historyItems}
          emptyMessage="Ainda não há notificações clínicas registradas neste contexto."
          showReadAction
        />
      </SectionCard>
    </div>
  );
}
