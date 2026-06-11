import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import {
  MasterOperationalFilters,
  type MasterOperationalFilterValues
} from "@/components/forms/master-operational-filters";
import { MasterSemesterForm } from "@/components/forms/master-semester-form";
import { requireRole } from "@/lib/auth/session";
import { getSemesterManagementPageData } from "@/services/semester-management";

function semesterStatusLabel(status: "planejado" | "ativo" | "encerrado") {
  switch (status) {
    case "ativo":
      return "Ativo";
    case "encerrado":
      return "Encerrado";
    default:
      return "Planejado";
  }
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

function readSearchParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

interface MasterSemestersPageProps {
  searchParams?: Promise<{
    instituicao?: string | string[];
    unidade?: string | string[];
    curso?: string | string[];
    oferta?: string | string[];
  }>;
}

export default async function MasterSemestersPage({
  searchParams
}: MasterSemestersPageProps) {
  await requireRole(["coordenador_master"]);
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedFilters: MasterOperationalFilterValues = {
    institutionId: readSearchParam(resolvedSearchParams.instituicao),
    unitId: readSearchParam(resolvedSearchParams.unidade),
    courseId: readSearchParam(resolvedSearchParams.curso),
    offerId: readSearchParam(resolvedSearchParams.oferta)
  };
  const pageData = await getSemesterManagementPageData({
    instituicaoId: requestedFilters.institutionId,
    unidadeId: requestedFilters.unitId,
    cursoId: requestedFilters.courseId,
    ofertaCursoUnidadeId: requestedFilters.offerId
  });

  return (
    <div className="stack master-dashboard master-semesters-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Semestres por oferta</p>
        <h1>Estrutura academica por curso, unidade e oferta</h1>
        <p>
          Cadastre semestres diretamente na oferta correta, preservando o
          vinculo legado por unidade sem interromper a operacao atual da Fisioterapia.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Instituicoes"
          value={String(pageData.summary.totalInstitutions)}
          hint="Instituicoes disponiveis para operacao multicurso."
        />
        <MetricCard
          label="Ofertas"
          value={String(pageData.summary.totalOffers)}
          hint="Ofertas de curso por unidade cadastradas."
        />
        <MetricCard
          label="Semestres"
          value={String(pageData.summary.totalSemesters)}
          hint="Semestres cadastrados no banco."
        />
        <MetricCard
          label="Semestres com oferta"
          value={String(pageData.summary.totalSemestersWithOffer)}
          hint="Registros ja alinhados ao novo eixo por oferta."
          tone="positive"
        />
        <MetricCard
          label="Turmas vinculadas"
          value={String(pageData.summary.totalClasses)}
          hint="Turmas associadas aos semestres cadastrados."
        />
      </div>

      <SectionCard
        title="Filtros institucionais"
        description="Refine a leitura administrativa por instituicao, unidade, curso e oferta sem alterar a trilha atual de criacao emergencial."
      >
        <MasterOperationalFilters
          actionPath="/master/semestres"
          institutions={pageData.institutions}
          units={pageData.units}
          courses={pageData.courses}
          offers={pageData.offers}
          filters={pageData.filters}
        />
      </SectionCard>

      <SectionCard
        title="Criar semestre por oferta"
        description="Selecione instituicao, curso e oferta. O sistema resolve a unidade legada automaticamente."
      >
        <div className="management-block-card">
          <MasterSemesterForm
            institutions={pageData.institutions}
            courses={pageData.courses}
            offers={pageData.offers}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Semestres cadastrados"
        description="Leitura administrativa da trilha instituicao -> unidade -> curso -> oferta -> semestre."
      >
        {pageData.semesters.length ? (
          <div className="table-wrap master-contexts-table-wrap table-scroll-md">
            <table className="table">
              <thead>
                <tr>
                  <th>Instituicao</th>
                  <th>Unidade</th>
                  <th>Curso</th>
                  <th>Oferta</th>
                  <th>Semestre</th>
                  <th>Status</th>
                  <th>Periodo</th>
                  <th>Turmas</th>
                </tr>
              </thead>
              <tbody>
                {pageData.semesters.map((semester) => (
                  <tr key={semester.id}>
                    <td>
                      <strong>{semester.institutionName}</strong>
                    </td>
                    <td>{semester.unitName}</td>
                    <td>
                      {semester.courseName ?? (
                        <span className="badge badge-muted">Curso nao identificado</span>
                      )}
                    </td>
                    <td>
                      {semester.offerName ? (
                        semester.offerName
                      ) : (
                        <span className="badge badge-muted">Sem oferta vinculada</span>
                      )}
                    </td>
                    <td>
                      <strong>{semester.code}</strong>
                      <div className="table-helper">{semester.name}</div>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          semester.status === "ativo"
                            ? "status-ativo"
                            : semester.status === "encerrado"
                              ? "status-inativo"
                              : "status-planejado"
                        }`}
                      >
                        {semesterStatusLabel(semester.status)}
                      </span>
                    </td>
                    <td>
                      {formatDate(semester.startsAt)} ate {formatDate(semester.endsAt)}
                    </td>
                    <td>{semester.classCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Nenhum semestre encontrado com os filtros atuais.</p>
        )}
      </SectionCard>
    </div>
  );
}
