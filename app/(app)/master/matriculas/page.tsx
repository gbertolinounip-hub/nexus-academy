import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  MasterOperationalFilters,
  type MasterOperationalFilterValues
} from "@/components/forms/master-operational-filters";
import { MasterEnrollmentForm } from "@/components/forms/master-enrollment-form";
import { requireRole } from "@/lib/auth/session";
import { getEnrollmentManagementPageData } from "@/services/enrollment-management";

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterEnrollmentsPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    oferta?: string | string[];
  }>;
}

export default async function MasterEnrollmentsPage({
  searchParams
}: MasterEnrollmentsPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedFilters: MasterOperationalFilterValues = {
    institutionId: readSearchParam(resolvedSearchParams.instituicao),
    unitId: readSearchParam(resolvedSearchParams.unidade),
    courseId: readSearchParam(resolvedSearchParams.curso),
    offerId: readSearchParam(resolvedSearchParams.oferta)
  };
  const pageData = await getEnrollmentManagementPageData({
    instituicaoId: requestedFilters.institutionId,
    unidadeId: requestedFilters.unitId,
    cursoId: requestedFilters.courseId,
    ofertaCursoUnidadeId: requestedFilters.offerId
  });

  return (
    <div className="stack master-dashboard master-enrollments-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Matrículas por turma e oferta</p>
        <h1>Vínculos de alunos na arquitetura multicurso</h1>
        <p>
          Visualize e vincule alunos existentes a turmas já alinhadas à oferta certa,
          preservando o eixo legado por turma e semestre.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituições"
          value={String(pageData.summary.totalInstitutions)}
          hint="Instituições presentes na arquitetura nova."
        />
        <MetricCard
          label="Ofertas"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas com potencial de matrícula."
        />
        <MetricCard
          label="Turmas"
          value={String(pageData.summary.totalClasses)}
          hint="Turmas disponíveis para vinculação."
        />
        <MetricCard
          label="Alunos"
          value={String(pageData.summary.totalStudents)}
          hint="Cadastros discentes disponíveis."
        />
        <MetricCard
          label="Matrículas"
          value={String(pageData.summary.totalEnrollments)}
          hint={`${pageData.summary.totalEnrollmentsWithOffer} já possuem oferta preenchida.`}
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description="Refine a leitura administrativa por instituição, unidade, curso e oferta sem remover o vínculo emergencial de alunos pelo Nexus Admin."
      >
        <MasterOperationalFilters
          actionPath="/master/matriculas"
          institutions={pageData.institutions}
          units={pageData.units}
          courses={pageData.courses}
          offers={pageData.offers}
          filters={pageData.filters}
        />
      </SectionCard>

      <SectionCard
        title="Vincular aluno à turma"
        description="Selecione instituição, curso, oferta, semestre, turma e aluno existente."
      >
        <div className="management-block-card">
          <MasterEnrollmentForm
            institutions={pageData.institutions}
            courses={pageData.courses}
            offers={pageData.offers}
            semesters={pageData.semesters}
            classes={pageData.classes}
            students={pageData.students}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Matrículas cadastradas"
        description="Leitura administrativa da trilha instituição -> unidade -> curso -> oferta -> semestre -> turma -> matrícula."
      >
        {pageData.enrollments.length ? (
          <div className="table-wrap master-contexts-table-wrap master-enrollments-table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Instituição</th>
                  <th>Unidade</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Semestre</th>
                  <th>Turma</th>
                  <th>Aluno</th>
                  <th>Matrícula / RA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageData.enrollments.map((enrollment) => (
                  <tr key={enrollment.id}>
                    <td>
                      <strong>{enrollment.institutionName}</strong>
                    </td>
                    <td>{enrollment.unitName}</td>
                    <td>
                      {enrollment.courseName ?? (
                        <span className="badge badge-muted">Curso não identificado</span>
                      )}
                    </td>
                    <td>
                      {enrollment.offerName ?? (
                        <span className="badge badge-muted">Sem oferta vinculada</span>
                      )}
                    </td>
                    <td>
                      <strong>{enrollment.semesterCode}</strong>
                      <div className="table-helper">{enrollment.semesterName}</div>
                    </td>
                    <td>
                      <strong>{enrollment.classCode}</strong>
                      <div className="table-helper">{enrollment.className}</div>
                    </td>
                    <td>
                      <strong>{enrollment.studentName}</strong>
                      <div className="table-helper">{enrollment.studentEmail}</div>
                    </td>
                    <td>
                      <strong>{enrollment.registration}</strong>
                      <div className="table-helper">
                        Curso do aluno: {enrollment.studentCourseName ?? "não definido"}
                      </div>
                      <div className="table-helper">
                        Oferta do aluno: {enrollment.studentOfferName ?? "não definida"}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill status-${enrollment.status}`}>
                        {enrollment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Nenhuma matrícula encontrada com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
