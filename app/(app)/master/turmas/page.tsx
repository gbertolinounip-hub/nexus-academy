import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  MasterOperationalFilters,
  type MasterOperationalFilterValues
} from "@/components/forms/master-operational-filters";
import { MasterClassForm } from "@/components/forms/master-class-form";
import { MasterClassCurricularPeriodForm } from "@/components/forms/master-class-curricular-period-form";
import { requireRole } from "@/lib/auth/session";
import { getClassManagementPageData } from "@/services/class-management";

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterClassesPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    oferta?: string | string[];
  }>;
}

export default async function MasterClassesPage({
  searchParams
}: MasterClassesPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedFilters: MasterOperationalFilterValues = {
    institutionId: readSearchParam(resolvedSearchParams.instituicao),
    unitId: readSearchParam(resolvedSearchParams.unidade),
    courseId: readSearchParam(resolvedSearchParams.curso),
    offerId: readSearchParam(resolvedSearchParams.oferta)
  };
  const pageData = await getClassManagementPageData({
    instituicaoId: requestedFilters.institutionId,
    unidadeId: requestedFilters.unitId,
    cursoId: requestedFilters.courseId,
    ofertaCursoUnidadeId: requestedFilters.offerId
  });

  return (
    <div className="stack master-dashboard master-classes-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Auditoria de turmas por oferta</p>
        <h1>Visão administrativa de turmas</h1>
        <p>
          Acompanhe a trilha instituição - unidade - curso - oferta - semestre - turma e
          audite o período curricular usado pelas regras de avaliação. A criação operacional
          das turmas deve ocorrer prioritariamente no Coordenador local.
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
          hint="Ofertas de curso por unidade cadastradas."
        />
        <MetricCard
          label="Semestres"
          value={String(pageData.summary.totalSemesters)}
          hint="Semestres disponíveis para vinculação."
        />
        <MetricCard
          label="Turmas"
          value={String(pageData.summary.totalClasses)}
          hint="Turmas cadastradas no banco."
        />
        <MetricCard
          label="Turmas ativas"
          value={String(pageData.summary.totalActiveClasses)}
          hint="Turmas atualmente habilitadas."
          tone="positive"
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description="Refine a leitura administrativa por instituição, unidade, curso e oferta para auditar a estrutura multicurso sem assumir a operação acadêmica cotidiana."
      >
        <MasterOperationalFilters
          actionPath="/master/turmas"
          institutions={pageData.institutions}
          units={pageData.units}
          courses={pageData.courses}
          offers={pageData.offers}
          filters={pageData.filters}
        />
      </SectionCard>

      <SectionCard
        title="Ação administrativa excepcional"
        description="Use este bloco apenas em cenários administrativos excepcionais. A criação operacional das turmas reais deve ser feita pelo Coordenador local da oferta, junto do ajuste de período curricular."
      >
        <div className="management-block-card">
          <p className="field-help">
            Se precisar agir aqui, informe o período curricular para manter a seleção de
            modelos de avaliação coerente com as regras do curso.
          </p>
          <MasterClassForm
            institutions={pageData.institutions}
            courses={pageData.courses}
            offers={pageData.offers}
            semesters={pageData.semesters}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Turmas cadastradas"
        description="Leitura administrativa da trilha instituição -> unidade -> curso -> oferta -> semestre -> turma."
      >
        {pageData.classes.length ? (
          <div className="table-wrap master-contexts-table-wrap master-classes-table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Instituição</th>
                  <th>Unidade</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Semestre</th>
                  <th>Período curricular</th>
                  <th>Turma</th>
                  <th>Status</th>
                  <th>Matrículas</th>
                </tr>
              </thead>
              <tbody>
                {pageData.classes.map((classEntry) => (
                  <tr key={classEntry.id}>
                    <td>
                      <strong>{classEntry.institutionName}</strong>
                    </td>
                    <td>{classEntry.unitName}</td>
                    <td>
                      {classEntry.courseName ?? (
                        <span className="badge badge-muted">Curso não identificado</span>
                      )}
                    </td>
                    <td>
                      {classEntry.offerName ?? (
                        <span className="badge badge-muted">Sem oferta vinculada</span>
                      )}
                    </td>
                    <td>
                      <strong>{classEntry.semesterCode}</strong>
                      <div className="table-helper">{classEntry.semesterName}</div>
                    </td>
                    <td>
                      <MasterClassCurricularPeriodForm
                        classId={classEntry.id}
                        className={classEntry.className}
                        curricularPeriod={classEntry.curricularPeriod}
                      />
                    </td>
                    <td>
                      <strong>{classEntry.classCode}</strong>
                      <div className="table-helper">{classEntry.className}</div>
                      <div className="table-helper">Área: {classEntry.stageArea}</div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          classEntry.isActive ? "status-ativo" : "status-inativo"
                        }`}
                      >
                        {classEntry.isActive ? "ativa" : "inativa"}
                      </span>
                    </td>
                    <td>{classEntry.enrollmentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Nenhuma turma encontrada com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
