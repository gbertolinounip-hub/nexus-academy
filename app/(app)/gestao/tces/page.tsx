import { TceConfigurationForm } from "@/components/forms/tce-configuration-form";
import { TceConfigurationCard } from "@/components/forms/tce-configuration-card";
import { SectionCard } from "@/components/common/section-card";
import { createTceConfigurationAction } from "@/app/(app)/gestao/tces/actions";
import { requireRole } from "@/lib/auth/session";
import { loadCoordinatorTcePageData } from "@/services/tce";

export default async function CoordinatorTceManagementPage() {
  const currentUser = await requireRole(["coordenador"]);
  const { pageData, emptyState } = await loadCoordinatorTcePageData(currentUser);

  return (
    <div className="stack management-catalog-page">
      <section className="hero-card">
        <p className="eyebrow">Gestão acadêmica</p>
        <h1>TCEs da oferta</h1>
        <p>
          Configure os dados fixos do Termo de Compromisso de Estágio por área,
          semestre e turma, preparando a base que será usada depois pelo aluno para
          preencher e gerar o documento institucional.
        </p>
      </section>

      {pageData ? (
        <>
          <SectionCard
            title="Nova configuração de TCE"
            description="Selecione o modelo ativo, vincule a configuração à área de estágio e preencha os dados fixos da concedente, vigência, horários e plano de atividades."
          >
            <TceConfigurationForm
              action={createTceConfigurationAction}
              areaOptions={pageData.areaOptions}
              classOptions={pageData.classOptions}
              courseName={pageData.courseName}
              modelOptions={pageData.modelOptions}
              mode="create"
              missingModelMessage={pageData.missingModelMessage}
              offerName={pageData.offerName}
              semesterOptions={pageData.semesterOptions}
              submitLabel="Criar configuração"
              unitName={pageData.unitName}
            />
          </SectionCard>

          <SectionCard
            title="Configurações existentes"
            description="Revise as configurações já cadastradas, ajuste dados da concedente, vigência ou plano de atividades e ative ou inative o escopo conforme necessário."
          >
            {pageData.configurations.length ? (
              <div className="stack">
                {pageData.configurations.map((configuration) => (
                  <TceConfigurationCard
                    key={configuration.id}
                    areaOptions={pageData.areaOptions}
                    classOptions={pageData.classOptions}
                    configuration={configuration}
                    courseName={pageData.courseName}
                    modelOptions={pageData.modelOptions}
                    offerName={pageData.offerName}
                    semesterOptions={pageData.semesterOptions}
                    unitName={pageData.unitName}
                  />
                ))}
              </div>
            ) : (
              <p className="field-help">
                Ainda não há configurações de TCE cadastradas para esta oferta.
              </p>
            )}
          </SectionCard>
        </>
      ) : emptyState ? (
        <SectionCard title={emptyState.title} description={emptyState.description}>
          <p className="field-help">
            {emptyState.title === "Módulo de TCE indisponível"
              ? "Assim que o script-15 estiver aplicado no banco, o coordenador poderá configurar os TCEs por área e semestre."
              : "Assim que o coordenador acessar uma oferta local válida, as configurações de TCE ficarão disponíveis nesta área."}
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
