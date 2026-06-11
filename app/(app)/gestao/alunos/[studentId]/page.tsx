import Link from "next/link";
import {
  deleteStudentAction,
  deactivateStudentAction,
  reactivateStudentAction
} from "@/app/(app)/gestao/alunos/actions";
import {
  createInitialStudentProfileFormValues,
  createInitialStudentStageManagementFormValues
} from "@/app/(app)/gestao/alunos/state";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { StudentProfileForm } from "@/components/forms/student-profile-form";
import { StudentStageManagementForm } from "@/components/forms/student-stage-management-form";
import { getActiveMasterCourseContext } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { getStudentManagementDetailData } from "@/services/management";

export default async function StudentManagementDetailPage(props: {
  params: Promise<{
    studentId: string;
  }>;
  searchParams?: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);

  if (getActiveMasterCourseContext(currentUser)) {
    return (
      <div className="stack">
        <section className="hero-card">
          <p className="eyebrow">Gestão do aluno</p>
          <h1>Acesso somente para consulta</h1>
          <p>
            O Gestor do curso acompanha cadastros por unidade, mas não edita alunos nem vínculos
            operacionais nesta rota detalhada.
          </p>
          <div className="actions-row">
            <Link className="button button-secondary" href="/gestao/alunos">
              Voltar para cadastros
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const { studentId } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  const { studentData, emptyState } = await getStudentManagementDetailData(
    currentUser,
    studentId
  );
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";

  if (!studentData) {
    return (
      <div className="stack">
        <section className="hero-card">
          <p className="eyebrow">Gestão do aluno</p>
          <h1>{emptyState?.title ?? "Aluno não encontrado"}</h1>
          <p>
            {emptyState?.description ?? "Não foi possível carregar os dados deste aluno."}
          </p>
          <div className="actions-row">
            <Link className="button button-secondary" href="/gestao/alunos">
              Voltar para cadastros
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const defaultSemesterRecord = studentData.semesterHistory.find(
    (semesterRecord) =>
      semesterRecord.semesterId === studentData.defaultManagementSemesterId
  );

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Gestão do aluno</p>
        <h1>{studentData.student.name}</h1>
        <p>
          O cadastro da pessoa permanece único. O que muda a cada ciclo de
          estágio são apenas os vínculos acadêmicos por semestre.
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

        <div className="management-student-summary">
          <div className="management-student-summary-item">
            <span>RA</span>
            <strong>{studentData.student.registration}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>E-mail</span>
            <strong>{studentData.student.email}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Celular</span>
            <strong>{studentData.student.cellphone ?? "Não informado"}</strong>
          </div>
          <div className="management-student-summary-item">
            <span>Status</span>
            <strong>
              <span
                className={`status-pill ${
                  studentData.student.isActive ? "status-ativo" : "status-inativo"
                }`}
              >
                {studentData.student.isActive ? "ativo" : "inativo"}
              </span>
            </strong>
          </div>
        </div>

        <div className="management-anchor-nav">
          <Link className="button button-secondary button-small" href="#cadastro">
            Editar cadastro
          </Link>
          <Link className="button button-secondary button-small" href="#estagio">
            Gerenciar estágio
          </Link>
          <Link className="button button-secondary button-small" href="#histórico">
            Histórico
          </Link>
          {studentData.student.isActive ? (
            <form action={deactivateStudentAction}>
              <input type="hidden" name="user_id" value={studentData.student.id} />
              <input
                type="hidden"
                name="return_to"
                value={`/gestao/alunos/${studentData.student.id}`}
              />
              <button className="button button-secondary button-small" type="submit">
                Desativar
              </button>
            </form>
          ) : (
            <form action={reactivateStudentAction}>
              <input type="hidden" name="user_id" value={studentData.student.id} />
              <input
                type="hidden"
                name="return_to"
                value={`/gestao/alunos/${studentData.student.id}`}
              />
              <button className="button button-secondary button-small" type="submit">
                Reativar
              </button>
            </form>
          )}
          <ConfirmActionForm
            action={deleteStudentAction}
            confirmationMessage={`Excluir permanentemente o cadastro de ${studentData.student.name}? Use esta opção apenas para registros de teste sem histórico relevante.`}
            fields={[
              { name: "user_id", value: studentData.student.id },
              { name: "return_to", value: `/gestao/alunos/${studentData.student.id}` }
            ]}
            className="button button-danger button-small"
          >
            Excluir
          </ConfirmActionForm>
          <Link className="button button-secondary button-small" href="/gestao/alunos">
            Voltar para lista
          </Link>
        </div>
      </section>

      <div id="cadastro">
        <SectionCard
          title="Editar cadastro"
          description="Atualize os dados permanentes do aluno sem recadastrar a pessoa nem perder histórico."
        >
          <StudentProfileForm
            initialValues={createInitialStudentProfileFormValues({
              student_id: studentData.student.id,
              nome_completo: studentData.student.fullName,
              ra: studentData.student.registration,
              celular: studentData.student.cellphone ?? "",
              email: studentData.student.email
            })}
          />
        </SectionCard>
      </div>

      <div id="estagio">
        <SectionCard
          title="Gerenciar estágio por semestre"
          description="Crie um novo semestre para o aluno, ajuste áreas e supervisores do semestre atual e preserve intacto tudo o que já aconteceu nos semestres anteriores."
          actions={
            defaultSemesterRecord ? (
              <span className="badge">{defaultSemesterRecord.semesterCode}</span>
            ) : undefined
          }
        >
          <StudentStageManagementForm
            studentId={studentData.student.id}
            studentIsActive={studentData.student.isActive}
            manageableSemesters={studentData.manageableSemesters}
            areaBlocks={studentData.areaBlocks}
            professorOptions={studentData.professorOptions}
            semesterHistory={studentData.semesterHistory}
            defaultSemesterId={studentData.defaultManagementSemesterId}
          />
        </SectionCard>
      </div>

      <div id="histórico">
        <SectionCard
          title="Histórico de semestres"
          description="Veja em quais semestres o aluno esteve, com quais áreas e com quais supervisores, sem sobrescrever registros antigos."
        >
          {studentData.semesterHistory.length ? (
            <div className="management-history-grid">
              {studentData.semesterHistory.map((semesterRecord) => (
                <article key={semesterRecord.semesterId} className="management-history-card">
                  <div className="management-history-header">
                    <div>
                      <h3>
                        {semesterRecord.semesterCode} - {semesterRecord.semesterName}
                      </h3>
                      <p>
                        {semesterRecord.startsAt} até {semesterRecord.endsAt}
                      </p>
                    </div>
                    <span className={`status-pill status-${semesterRecord.semesterStatus}`}>
                      {semesterRecord.semesterStatus}
                    </span>
                  </div>

                  {semesterRecord.assignments.length ? (
                    <div className="management-assignment-list">
                      {semesterRecord.assignments.map((assignment) => (
                        <div
                          key={assignment.enrollmentId}
                          className="management-assignment-item management-history-assignment"
                        >
                          <strong>
                            {assignment.areaName} - {assignment.blockName}
                          </strong>
                          <span>Turma operacional: {assignment.className}</span>
                          <span>
                            Status da matrícula:{" "}
                            <span className={`status-pill status-${assignment.enrollmentStatus}`}>
                              {assignment.enrollmentStatus}
                            </span>
                          </span>
                          <span>
                            Supervisores:{" "}
                            {assignment.allSupervisorNames.length
                              ? assignment.allSupervisorNames.join(", ")
                              : "Sem supervisores vinculados"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-message">
                      Nenhum vínculo operacional encontrado neste semestre.
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-message">
              Este aluno ainda não possui histórico operacional de estágio.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}




