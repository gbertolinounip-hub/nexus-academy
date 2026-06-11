import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { MasterCourseForm } from "@/components/forms/master-course-form";
import { MasterCourseOfferForm } from "@/components/forms/master-course-offer-form";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  toggleCourseOfferStatusAction,
  toggleCourseStatusAction
} from "@/app/(app)/master/cursos/actions";
import { requireRole } from "@/lib/auth/session";
import { getCourseManagementPageData } from "@/services/course-management";

export default async function MasterCoursesPage() {
  await requireRole(["coordenador_master"]);
  const pageData = await getCourseManagementPageData();

  return (
    <div className="stack master-dashboard master-courses-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Cursos e ofertas</p>
        <h1>Estrutura multicurso por instituicao</h1>
        <p>
          Prepare a expansao da Nexus Academy para novos cursos e novas ofertas por
          unidade sem mexer ainda nos fluxos academicos da Fisioterapia.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituicoes"
          value={String(pageData.summary.totalInstitutions)}
          hint="Instituicoes cadastradas na arquitetura nova."
        />
        <MetricCard
          label="Cursos"
          value={String(pageData.summary.totalCourses)}
          hint="Cursos cadastrados por instituicao."
        />
        <MetricCard
          label="Ofertas"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas de curso por unidade."
        />
        <MetricCard
          label="Cursos ativos"
          value={String(pageData.summary.totalActiveCourses)}
          hint="Cursos disponiveis para operacao futura."
          tone="positive"
        />
        <MetricCard
          label="Ofertas ativas"
          value={String(pageData.summary.totalActiveOffers)}
          hint="Ofertas habilitadas nas unidades."
          tone="positive"
        />
      </div>

      <SectionCard
        title="Cursos por instituicao"
        description="Crie cursos novos e acompanhe os cursos ja vinculados a cada instituicao."
      >
        <div className="master-course-management-stack">
          {pageData.courses.length ? (
            <div className="table-wrap master-contexts-table-wrap">
              <table className="table master-course-management-course-table">
                <thead>
                  <tr>
                    <th>Instituicao</th>
                    <th>Codigo</th>
                    <th>Nome</th>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.courses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong>{course.institutionName}</strong>
                      </td>
                      <td>{course.code}</td>
                      <td>{course.name}</td>
                      <td>{course.slug}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            course.isActive ? "status-ativo" : "status-inativo"
                          }`}
                        >
                          {course.isActive ? "ativo" : "inativo"}
                        </span>
                      </td>
                      <td>
                        <ConfirmActionForm
                          action={toggleCourseStatusAction}
                          confirmationMessage={`Deseja ${
                            course.isActive ? "desativar" : "ativar"
                          } o curso ${course.name}?`}
                          fields={[
                            { name: "course_id", value: course.id },
                            { name: "ativo", value: course.isActive ? "false" : "true" }
                          ]}
                          className="button button-secondary button-small"
                        >
                          {course.isActive ? "Desativar" : "Ativar"}
                        </ConfirmActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">Nenhum curso cadastrado ate o momento.</p>
          )}

          <div className="management-block-card">
            <div className="management-block-header">
              <div>
                <h3>Criar curso</h3>
                <p className="field-help">
                  Cadastre o curso dentro da instituicao correta com codigo e slug unicos.
                </p>
              </div>
            </div>
            <MasterCourseForm institutions={pageData.institutions} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Ofertas de curso por unidade"
        description="Vincule um curso a uma unidade da mesma instituicao e controle sua ativacao."
      >
        <div className="master-course-management-stack">
          {pageData.offers.length ? (
            <div className="table-wrap master-contexts-table-wrap">
              <table className="table master-course-management-offer-table">
                <thead>
                  <tr>
                    <th>Instituicao</th>
                    <th>Unidade</th>
                    <th>Curso</th>
                    <th>Nome de exibicao</th>
                    <th>Codigo</th>
                    <th>Status</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.offers.map((offer) => (
                    <tr key={offer.id}>
                      <td>
                        <strong>{offer.institutionName}</strong>
                      </td>
                      <td>{offer.unitName}</td>
                      <td>{offer.courseName}</td>
                      <td>{offer.displayName}</td>
                      <td>{offer.code ?? <span className="badge badge-muted">Sem codigo</span>}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            offer.isActive ? "status-ativo" : "status-inativo"
                          }`}
                        >
                          {offer.isActive ? "ativa" : "inativa"}
                        </span>
                      </td>
                      <td>
                        <ConfirmActionForm
                          action={toggleCourseOfferStatusAction}
                          confirmationMessage={`Deseja ${
                            offer.isActive ? "desativar" : "ativar"
                          } a oferta ${offer.displayName}?`}
                          fields={[
                            { name: "offer_id", value: offer.id },
                            { name: "ativo", value: offer.isActive ? "false" : "true" }
                          ]}
                          className="button button-secondary button-small"
                        >
                          {offer.isActive ? "Desativar" : "Ativar"}
                        </ConfirmActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-message">Nenhuma oferta cadastrada ate o momento.</p>
          )}

          <div className="management-block-card">
            <div className="management-block-header">
              <div>
                <h3>Criar oferta</h3>
                <p className="field-help">
                  A unidade e o curso precisam pertencer a mesma instituicao. Duplicidades por
                  unidade e curso sao bloqueadas no servidor.
                </p>
              </div>
            </div>
            <MasterCourseOfferForm
              institutions={pageData.institutions}
              units={pageData.units}
              courses={pageData.courseOptions}
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
