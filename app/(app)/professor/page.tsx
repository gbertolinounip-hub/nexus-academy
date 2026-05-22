import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { StudentTable } from "@/components/tables/student-table";
import { requireRole } from "@/lib/auth/session";
import { formatPercentage } from "@/lib/utils/format";
import { getAuthenticatedProfessorDashboard } from "@/services/dashboard";

export default async function ProfessorDashboardPage() {
  const currentUser = await requireRole(["professor"]);
  const { dashboard, emptyState } = await getAuthenticatedProfessorDashboard(
    currentUser
  );

  if (!dashboard || emptyState) {
    return (
      <div className="stack">
        <section className="hero-card">
          <p className="eyebrow">Painel do professor</p>
          <h1>{currentUser.name}</h1>
          <p>
            Seu acesso está ativo. Assim que houver dados acadêmicos vinculados
            à sua supervisão, este painel será atualizado automaticamente.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Painel indisponível"}
          description={
            emptyState?.description ??
            "Ainda não encontramos vínculos ou dados suficientes para este professor."
          }
          actions={
            <div className="actions-row">
              <Link href={"/avaliacoes" as Route} className="button button-secondary">
                Meus lançamentos
              </Link>
              <Link href={"/relatorios" as Route} className="button button-secondary">
                Relatórios finais
              </Link>
              <Link href={"/ausencias" as Route} className="button button-secondary">
                Faltas
              </Link>
              <Link href="/avaliacoes/nova" className="button">
                Novo lançamento
              </Link>
            </div>
          }
        >
          <p className="empty-message">
            Quando houver alunos vinculados à sua supervisão, este painel
            passará a exibir os dados acadêmicos.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack professor-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Painel do professor</p>
        <h1>{dashboard.professor.name}</h1>
        <p>
          Acompanhamento dos alunos realmente vinculados a este professor, com
          visão de desempenho, risco e progresso de lançamento.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Alunos vinculados"
          value={String(dashboard.totalAssignedStudents)}
          hint="Vínculos ativos encontrados no banco para este professor."
        />
        <MetricCard
          label="Média da turma"
          value={formatPercentage(dashboard.classAveragePercentage)}
          hint="Média atual já descontando ausências não justificadas."
          tone="positive"
        />
        <MetricCard
          label="Alunos em atenção"
          value={String(dashboard.studentsAtRisk)}
          hint="Casos com nota final abaixo da faixa satisfatória."
          tone="alert"
        />
        <MetricCard
          label="Lançamentos no mês"
          value={String(dashboard.launchesThisMonth)}
          hint="Publicações feitas pelo professor no mês atual."
        />
      </div>

      <SectionCard
        title="Turma sob responsabilidade"
        description="Resumo consolidado dos alunos vinculados a este professor."
        actions={
          <div className="actions-row">
            <Link href={"/avaliacoes" as Route} className="button button-secondary">
              Meus lançamentos
            </Link>
            <Link href={"/relatorios" as Route} className="button button-secondary">
              Relatórios finais
            </Link>
            <Link href={"/ausencias" as Route} className="button button-secondary">
              Faltas
            </Link>
            <Link href="/avaliacoes/nova" className="button">
              Novo lançamento
            </Link>
          </div>
        }
      >
        {dashboard.linkedStudents.length ? (
          <StudentTable students={dashboard.linkedStudents} />
        ) : (
          <p className="empty-message">
            Não há alunos vinculados com dados suficientes para exibição.
          </p>
        )}
      </SectionCard>
    </div>
  );
}




