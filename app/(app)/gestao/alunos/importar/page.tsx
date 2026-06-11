import Link from "next/link";
import type { Route } from "next";
import { SectionCard } from "@/components/common/section-card";
import { StudentImportForm } from "@/components/forms/student-import-form";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";

export default async function StudentImportPage() {
  const currentUser = await requireRole(["coordenador"]);

  if (getActiveMasterCourseContext(currentUser)) {
    return (
      <div className="stack management-import-page">
        <section className="hero-card">
          <p className="eyebrow">Gestão acadêmica</p>
          <h1>Acesso somente para consulta</h1>
          <p>
            O Gestor do curso acompanha os cadastros da unidade, mas a importação operacional
            de alunos continua restrita ao Coordenador Local da oferta.
          </p>
          <div className="actions-row">
            <Link href={"/gestao/alunos" as Route} className="button button-secondary">
              Voltar para cadastros
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack management-import-page">
      <section className="hero-card">
        <p className="eyebrow">Gestão acadêmica</p>
        <h1>Importar alunos em massa</h1>
        <p>
          Carregue uma planilha com o cadastro-base dos alunos da unidade{" "}
          <strong>{currentUser.unitName ?? "atual"}</strong>, revise a prévia e
          confirme apenas as linhas válidas.
        </p>
        <div className="actions-row">
          <Link href={"/gestao/alunos" as Route} className="button button-secondary">
            Voltar para cadastros
          </Link>
          <Link
            href={"/gestao/alunos/importar/modelo" as Route}
            className="button button-secondary"
          >
            Baixar modelo de planilha
          </Link>
        </div>
      </section>

      <SectionCard
        title="Fluxo de importação"
        description="Nesta etapa o coordenador importa o cadastro-base do aluno. A ativação e os vínculos de estágio continuam sendo feitos depois, no fluxo operacional já existente."
      >
        <div className="report-mini-grid management-import-summary-grid">
          <div className="report-mini-card">
            <span>1. Envie a planilha</span>
            <strong>Arquivo .xlsx, .xls ou .csv</strong>
          </div>
          <div className="report-mini-card">
            <span>2. Revise a prévia</span>
            <strong>Válidos, duplicados e erros</strong>
          </div>
          <div className="report-mini-card">
            <span>3. Confirme o lote</span>
            <strong>Importação apenas das linhas válidas</strong>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Planilha de alunos"
        description="O sistema gera automaticamente a senha inicial no padrão institucional e deixa o cadastro-base desativado até a ativação do aluno."
      >
        <StudentImportForm />
      </SectionCard>
    </div>
  );
}
