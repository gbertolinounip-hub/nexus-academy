import { MetricCard } from "@/components/common/metric-card";
import { SectionCard } from "@/components/common/section-card";
import { MasterCourseConfigurationCopyForm } from "@/components/forms/master-course-configuration-copy-form";
import { MasterCourseConfigurationCourseCard } from "@/components/forms/master-course-configuration-course-card";
import { requireRole } from "@/lib/auth/session";
import { getCourseConfigurationPageData, type CourseConfigurationStatus } from "@/services/course-configurations";

function getStatusClassName(status: CourseConfigurationStatus) {
  if (status === "Configurado") {
    return "status-bem";
  }

  if (status === "Parcial") {
    return "status-atencao";
  }

  return "status-critico";
}

export default async function MasterCourseConfigurationsPage() {
  await requireRole(["coordenador_master"]);
  const pageData = await getCourseConfigurationPageData();

  return (
    <div className="stack master-dashboard master-course-configurations-dashboard">
      <section className="hero-card">
        <p className="eyebrow">Configuracoes dos cursos</p>
        <h1>Base academica por curso</h1>
        <p>
          Visualize o nivel de configuracao de cada curso, acompanhe modelos de
          avaliacao e documentos obrigatorios e use a Fisioterapia como base segura
          para preparar novos cursos.
        </p>
      </section>

      <div className="metrics-grid">
        <MetricCard
          label="Cursos"
          value={String(pageData.summary.totalCourses)}
          hint="Cursos cadastrados na nova arquitetura."
        />
        <MetricCard
          label="Configurados"
          value={String(pageData.summary.configuredCourses)}
          hint="Cursos com modelos, grupos, criterios e documentos."
          tone="positive"
        />
        <MetricCard
          label="Parciais"
          value={String(pageData.summary.partialCourses)}
          hint="Cursos com configuracao incompleta."
          tone="alert"
        />
        <MetricCard
          label="Sem configuracao"
          value={String(pageData.summary.unconfiguredCourses)}
          hint="Cursos prontos para receber uma base inicial."
          tone="alert"
        />
        <MetricCard
          label="Modelos"
          value={String(pageData.summary.totalModels)}
          hint="Modelos de avaliacao cadastrados no total."
        />
        <MetricCard
          label="Docs obrigatorios"
          value={String(pageData.summary.totalRequiredDocuments)}
          hint="Documentos obrigatorios por curso no total."
        />
      </div>

      <SectionCard
        title="Status de configuracao dos cursos"
        description="Panorama consolidado para identificar cursos configurados, parciais ou ainda sem base academica."
      >
        {pageData.courses.length ? (
          <div className="table-wrap master-contexts-table-wrap">
            <table className="table master-course-configuration-course-table">
              <thead>
                <tr>
                  <th>Instituicao</th>
                  <th>Curso</th>
                  <th>Codigo</th>
                  <th>Modelos</th>
                  <th>Grupos</th>
                  <th>Criterios</th>
                  <th>Documentos</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pageData.courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.institutionName}</strong>
                    </td>
                    <td>{course.courseName}</td>
                    <td>{course.courseCode}</td>
                    <td>{course.modelCount}</td>
                    <td>{course.groupCount}</td>
                    <td>{course.criterionCount}</td>
                    <td>{course.requiredDocumentCount}</td>
                    <td>
                      <span className={`status-pill ${getStatusClassName(course.status)}`}>
                        {course.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-message">Nenhum curso foi encontrado para configuracao.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Duplicar base da Fisioterapia"
        description="Use o curso FISIO da mesma instituicao como ponto de partida para novos cursos sem sobrescrever configuracoes ja iniciadas."
      >
        <div className="management-block-card">
          <div className="management-block-header">
            <div>
              <h3>Duplicar configuracao inicial</h3>
              <p className="field-help">
                A copia inclui modelos de avaliacao, grupos, criterios e documentos
                obrigatorios. O curso destino precisa estar sem configuracao previa.
              </p>
            </div>
          </div>

          {pageData.copyTargetOptions.length ? (
            <MasterCourseConfigurationCopyForm
              destinationOptions={pageData.copyTargetOptions}
            />
          ) : (
            <p className="empty-message">
              Nenhum curso elegivel para copiar a base da Fisioterapia foi encontrado.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Detalhes por curso"
        description="Inicie, continue ou edite a configuracao academica diretamente em cada card do curso."
      >
        <div className="master-course-configuration-detail-grid">
          {pageData.courses.map((course) => (
            <MasterCourseConfigurationCourseCard
              key={course.id}
              course={course}
              documentTypeOptions={pageData.documentTypeOptions}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
