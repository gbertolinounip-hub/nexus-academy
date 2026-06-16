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
        <p className="eyebrow">Turmas por semestre e oferta</p>
        <h1>Estrutura de turmas na arquitetura multicurso</h1>
        <p>
          Cadastre turmas vinculadas ao semestre certo e herde a oferta da estrutura
          institucional, sem interferir no modelo legado de operacao academica.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituicoes"
          value={String(pageData.summary.totalInstitutions)}
          hint="Instituicoes presentes na arquitetura nova."
        />
        <MetricCard
          label="Ofertas"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas de curso por unidade cadastradas."
        />
        <MetricCard
          label="Semestres"
          value={String(pageData.summary.totalSemesters)}
          hint="Semestres disponiveis para vinculacao."
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
        description="Refine a leitura administrativa por instituicao, unidade, curso e oferta sem perder a capacidade de criacao emergencial pelo Master."
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
        title="Criar turma por semestre"
        description="Selecione instituicao, curso, oferta e semestre. A oferta da turma sera herdada do semestre validado, e o periodo curricular pode ser informado para futuras regras de avaliacao."
      >
        <div className="management-block-card">
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
        description="Leitura administrativa da trilha instituicao -> unidade -> curso -> oferta -> semestre -> turma."
      >
        {pageData.classes.length ? (
          <div className="table-wrap master-contexts-table-wrap master-classes-table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Instituicao</th>
                  <th>Unidade</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Semestre</th>
                  <th>Periodo curricular</th>
                  <th>Turma</th>
                  <th>Status</th>
                  <th>Matriculas</th>
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
                        <span className="badge badge-muted">Curso nao identificado</span>
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
                      <div className="table-helper">Area: {classEntry.stageArea}</div>
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
