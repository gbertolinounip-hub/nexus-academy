import Link from "next/link";
import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  getActiveMasterCourseContext,
  getDefaultDashboardPathForUser
} from "@/lib/auth/roles";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getCourseMasterPageData } from "@/services/course-master";

function renderBooleanPill(value: boolean, activeLabel = "Ativo", inactiveLabel = "Inativo") {
  return (
    <span className={`status-pill ${value ? "status-ativo" : "status-inativo"}`}>
      {value ? activeLabel : inactiveLabel}
    </span>
  );
}

export default async function MasterCourseDashboardPage() {
  const currentUser = await requireAuthenticatedUser();
  const activeContext = getActiveMasterCourseContext(currentUser);

  if (!activeContext) {
    return (
      <div className="stack master-dashboard master-course-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão do curso</p>
          <h1>Acesso indisponível</h1>
          <p>
            Esta área exige um contexto ativo de Gestor do curso. Se você tiver mais de um
            contexto, selecione o contexto correto na sidebar.
          </p>
          <div className="actions-row">
            <Link
              href={getDefaultDashboardPathForUser(currentUser)}
              className="button button-secondary"
            >
              Voltar para minha área
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const pageData = await getCourseMasterPageData(currentUser);

  if (!pageData) {
    return (
      <div className="stack master-dashboard master-course-dashboard">
        <section className="hero-card">
          <p className="eyebrow">Gestão do curso</p>
          <h1>Contexto do curso não encontrado</h1>
          <p>
            O contexto ativo foi reconhecido como Gestor do curso, mas a instituição ou o curso
            não puderam ser resolvidos com segurança.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="stack master-dashboard master-course-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Gestão do curso</p>
        <h1>{pageData.courseName}</h1>
        <p>
          {currentUser.name}, esta visão usa o seu contexto ativo para acompanhar o curso em{" "}
          {pageData.institutionName} sem herdar o poder global do módulo Master da plataforma.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituição"
          value={pageData.institutionName}
          hint="Escopo institucional do contexto ativo."
        />
        <MetricCard
          label="Ofertas do curso"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas vinculadas ao curso nas unidades conhecidas."
          tone="positive"
        />
        <MetricCard
          label="Unidades com oferta"
          value={String(pageData.summary.totalUnits)}
          hint="Campi onde o curso aparece na nova estrutura."
        />
        <MetricCard
          label="Coordenadores"
          value={String(pageData.summary.totalCoordinators)}
          hint="Usuários com contexto de coordenação ligado ao curso."
        />
        <MetricCard
          label="Professores"
          value={String(pageData.summary.totalProfessors)}
          hint="Usuários com contexto docente ligado ao curso."
        />
        <MetricCard
          label="Alunos"
          value={String(pageData.summary.totalStudents)}
          hint="Cadastros de alunos ligados ao curso com inferência segura."
        />
        <MetricCard
          label="Turmas"
          value={String(pageData.summary.totalClasses)}
          hint="Turmas vinculadas às ofertas do curso."
        />
        <MetricCard
          label="Semestres"
          value={String(pageData.summary.totalSemesters)}
          hint="Semestres associados às ofertas do curso."
        />
      </div>

      <SectionCard
        title="Ofertas por unidade"
        description="Panorama inicial do curso por unidade, com contagens seguras a partir dos vínculos atuais."
      >
        {pageData.offerEntries.length ? (
          <div className="table-wrap master-contexts-table-wrap">
            <table className="table master-course-offers-table">
              <thead>
                <tr>
                  <th>Unidade</th>
                  <th>Oferta</th>
                  <th>Status</th>
                  <th>Alunos</th>
                  <th>Turmas</th>
                  <th>Professores</th>
                  <th>Coordenadores</th>
                </tr>
              </thead>
              <tbody>
                {pageData.offerEntries.map((entry) => (
                  <tr key={entry.offerId}>
                    <td>
                      <strong>{entry.unitName}</strong>
                    </td>
                    <td>{entry.offerName}</td>
                    <td>{renderBooleanPill(entry.isActive)}</td>
                    <td>{entry.studentCount}</td>
                    <td>{entry.classCount}</td>
                    <td>{entry.professorCount}</td>
                    <td>{entry.coordinatorCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Ainda não há ofertas vinculadas ao curso dentro deste contexto institucional.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Contextos ligados ao curso"
        description="Usuários com contexto escopado ao curso e à instituição do contexto ativo."
      >
        {pageData.contextEntries.length ? (
          <div className="table-wrap master-contexts-table-wrap table-scroll-lg">
            <table className="table master-course-contexts-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil de contexto</th>
                  <th>Unidade</th>
                  <th>Oferta</th>
                  <th>Principal</th>
                  <th>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {pageData.contextEntries.map((entry) => (
                  <tr key={entry.contextId}>
                    <td>
                      <strong>{entry.userName}</strong>
                      <div className="table-helper">{entry.userEmail}</div>
                    </td>
                    <td>{entry.profileName}</td>
                    <td>
                      {entry.unitName ?? (
                        <span className="badge badge-muted">Contexto transversal</span>
                      )}
                    </td>
                    <td>
                      {entry.offerName ?? (
                        <span className="badge badge-muted">Sem oferta específica</span>
                      )}
                    </td>
                    <td>{renderBooleanPill(entry.principal, "Principal", "Secundário")}</td>
                    <td>{renderBooleanPill(entry.active)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">
            Nenhum contexto foi encontrado para o curso dentro da instituição ativa.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
