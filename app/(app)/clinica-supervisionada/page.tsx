import Link from "next/link";
import type { Route } from "next";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { ClinicalCaseCard } from "@/components/cards/clinical-case-card";
import { ClinicalNotificationFeed } from "@/components/cards/clinical-notification-feed";
import { ClinicalScheduleBoard } from "@/components/tables/clinical-schedule-board";
import { ClinicalCaseTable } from "@/components/tables/clinical-case-table";
import { requireRole } from "@/lib/auth/session";
import { getClinicalSupervisionPageData } from "@/services/clinical-supervision";

export default async function ClinicalSupervisionPage(props: {
  searchParams?: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
}) {
  const currentUser = await requireRole(["professor", "aluno"]);
  const searchParams = (await props.searchParams) ?? {};
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";
  const { pageData, emptyState } = await getClinicalSupervisionPageData(currentUser);

  if (!pageData || emptyState) {
    return (
      <div className="stack clinical-supervision-page">
        <section className="hero-card">
          <p className="eyebrow">Clínica Supervisionada</p>
          <h1>{currentUser.name}</h1>
          <p>
            Estrutura inicial do módulo clínico supervisionado, preparada para
            conectar paciente, estagiário, área e supervisão acadêmica.
          </p>
        </section>

        <SectionCard
          title={emptyState?.title ?? "Módulo indisponível"}
          description={
            emptyState?.description ??
            "Ainda não foi possível carregar a Clínica Supervisionada neste contexto."
          }
        >
          <p className="empty-message">
            Assim que a base clínica estiver disponível para o seu perfil, os
            pacientes e casos supervisionados aparecerão aqui.
          </p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="stack clinical-supervision-page">
      <section className="hero-card">
        <p className="eyebrow">Clínica Supervisionada</p>
        <h1>
          {pageData.view === "professor" ? pageData.professor.name : pageData.student.name}
        </h1>
        <p>
          {pageData.view === "professor"
            ? "Cadastre pacientes, atribua-os aos estagiários da sua supervisão e acompanhe a agenda semanal fixa dos atendimentos."
            : "Acompanhe apenas os pacientes atribuídos ao seu estágio e visualize a agenda semanal fixa dos seus atendimentos clínicos."}
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

      <SectionCard
        title="Atualizações recentes"
        description={
          pageData.view === "professor"
            ? "Pendências atuais de avaliação, plano de tratamento e evolução que ainda exigem ação da supervisão."
            : "Pendências atuais e retornos recentes da supervisão clínica que ainda exigem sua atenção ou ciência."
        }
        className="clinical-notification-highlight-card"
        actions={
          <Link
            href={"/clinica-supervisionada/historico" as Route}
            className="button button-secondary button-small"
          >
            Histórico
          </Link>
        }
      >
        <ClinicalNotificationFeed
          notifications={pageData.notifications.pendingItems}
          emptyMessage={
            pageData.view === "professor"
              ? "Nenhuma pendência clínica aguarda sua supervisão neste momento."
              : "Nenhum ajuste ou aprovação recente está pendente para os seus casos neste momento."
          }
          showReadAction={false}
        />
      </SectionCard>

      {pageData.view === "professor" ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Casos registrados"
              value={String(pageData.metrics.totalCases)}
              hint="Quantidade total de pacientes atribuídos por este supervisor."
            />
            <MetricCard
              label="Casos ativos"
              value={String(pageData.metrics.activeCases)}
              hint="Casos em andamento ou recém-atribuídos na Clínica Supervisionada."
              tone="positive"
            />
            <MetricCard
              label="Estagiários com pacientes"
              value={String(pageData.metrics.linkedStudents)}
              hint="Número de estagiários com ao menos um caso clínico atribuído."
            />
          </div>

          <SectionCard
            title="Cadastro e atribuição de paciente"
            description="Use o fluxo de atribuição para vincular um paciente ao estagiário correto, trazendo semestre, turma e área automaticamente do contexto."
            actions={
              pageData.studentOptions.length ? (
                <Link href={"/clinica-supervisionada/novo" as Route} className="button">
                  Cadastrar e atribuir paciente
                </Link>
              ) : undefined
            }
          >
            <p className="empty-message">
              {pageData.emptyHint ??
                "Selecione este módulo sempre que precisar criar ou revisar um caso clínico supervisionado."}
            </p>
          </SectionCard>

          <SectionCard
            title="Pacientes agendados"
            description="Agenda semanal fixa dos pacientes supervisionados nesta Clínica Supervisionada."
          >
            {pageData.cases.length ? (
              <ClinicalScheduleBoard cases={pageData.cases} enableProfessorFilters />
            ) : (
              <p className="empty-message">
                Ainda não há atendimentos semanais configurados para esta supervisão
                clínica.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Pacientes atribuídos"
            description="Listagem inicial dos casos clínicos sob responsabilidade deste professor."
          >
            {pageData.cases.length ? (
              <ClinicalCaseTable cases={pageData.cases} />
            ) : (
              <p className="empty-message">
                Ainda não há pacientes atribuídos nesta supervisão clínica.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Meus pacientes"
              value={String(pageData.metrics.totalCases)}
              hint="Pacientes atribuídos a você dentro da Clínica Supervisionada."
            />
            <MetricCard
              label="Casos ativos"
              value={String(pageData.metrics.activeCases)}
              hint="Casos que continuam em acompanhamento no estágio atual."
              tone="positive"
            />
            <MetricCard
              label="Casos com pendência"
              value={String(pageData.metrics.updatedCases)}
              hint="Casos que ainda exigem sua ação ou atenção na supervisão clínica."
            />
          </div>

          <SectionCard
            title="Pacientes agendados"
            description="Agenda semanal fixa dos pacientes atribuídos ao seu estágio atual."
          >
            {pageData.cases.length ? (
              <ClinicalScheduleBoard cases={pageData.cases} maskPatientNames />
            ) : (
              <p className="empty-message">
                Ainda não há atendimentos semanais configurados para o seu estágio
                atual.
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Meus pacientes"
            description="Apenas os pacientes realmente atribuídos ao seu estágio aparecem nesta visão."
          >
            {pageData.cases.length ? (
              <div className="clinical-case-grid">
                {pageData.cases.map((caseItem) => (
                  <ClinicalCaseCard
                    key={caseItem.id}
                    caseItem={caseItem}
                    maskPatientName
                    blurSensitiveContactData
                  />
                ))}
              </div>
            ) : (
              <p className="empty-message">
                {pageData.emptyHint ??
                  "Assim que um professor atribuir pacientes ao seu estágio, eles aparecerão aqui."}
              </p>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
