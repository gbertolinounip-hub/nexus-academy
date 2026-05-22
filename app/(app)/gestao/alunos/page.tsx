import Link from "next/link";
import {
  discardSemesterAction,
  deleteProfessorAction,
  deleteStudentAction,
  deactivateProfessorAction,
  deactivateStudentAction,
  reactivateProfessorAction,
  reactivateStudentAction,
  updateSemesterStatusAction
} from "@/app/(app)/gestao/alunos/actions";
import { SectionCard } from "@/components/common/section-card";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { ProfessorRegistrationForm } from "@/components/forms/professor-registration-form";
import { SemesterManagementForm } from "@/components/forms/semester-management-form";
import { StudentRegistrationForm } from "@/components/forms/student-registration-form";
import { requireRole } from "@/lib/auth/session";
import { getCoordinatorManagementPageData } from "@/services/management";

export default async function AcademicManagementPage(props: {
  searchParams?: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
    alunos?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getCoordinatorManagementPageData(currentUser);
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";
  const studentFilter =
    searchParams.alunos === "desativados" ? "desativados" : "ativados";
  const activeStudents = pageData?.students.filter((student) => student.isActive) ?? [];
  const inactiveStudents = pageData?.students.filter((student) => !student.isActive) ?? [];
  const visibleStudents =
    studentFilter === "desativados" ? inactiveStudents : activeStudents;
  const studentFilterReturnPath =
    studentFilter === "desativados"
      ? "/gestao/alunos?alunos=desativados"
      : "/gestao/alunos";

  return (
    <div className="stack">
      <section className="hero-card">
        <p className="eyebrow">Gestão acadêmica</p>
        <h1>Cadastros e vínculos de estágio</h1>
        <p>
          Cadastre alunos e supervisores com acesso real ao sistema, vincule
          áreas dinamicamente por semestre e mantenha a supervisão organizada por
          bloco e área de estágio.
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

      {pageData ? (
        <>
          <SectionCard
            title="Semestres"
            description="O seletor de semestre usa somente os registros cadastrados. Cadastre novos períodos aqui para liberar vínculos futuros."
          >
            <div className="split-grid">
              <div className="stack">
                <SemesterManagementForm />
              </div>

              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nome</th>
                      <th>Período</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.semesters.length ? (
                      pageData.semesters.map((semester) => (
                        <tr key={semester.id}>
                          <td>{semester.code}</td>
                          <td>{semester.name}</td>
                          <td>
                            {semester.startsAt} até {semester.endsAt}
                          </td>
                          <td>
                            <span className={`status-pill status-${semester.status}`}>
                              {semester.status}
                            </span>
                          </td>
                          <td>
                            <div className="actions-row">
                              {semester.status === "planejado" ? (
                                <form action={updateSemesterStatusAction}>
                                  <input type="hidden" name="semester_id" value={semester.id} />
                                  <input type="hidden" name="status" value="ativo" />
                                  <input type="hidden" name="return_to" value="/gestao/alunos" />
                                  <button className="button button-secondary button-small" type="submit">
                                    Ativar
                                  </button>
                                </form>
                              ) : null}

                              {semester.status === "ativo" ? (
                                <form action={updateSemesterStatusAction}>
                                  <input type="hidden" name="semester_id" value={semester.id} />
                                  <input type="hidden" name="status" value="planejado" />
                                  <input type="hidden" name="return_to" value="/gestao/alunos" />
                                  <button className="button button-secondary button-small" type="submit">
                                    Inativar
                                  </button>
                                </form>
                              ) : null}

                              {semester.status !== "encerrado" ? (
                                <ConfirmActionForm
                                  action={updateSemesterStatusAction}
                                  confirmationMessage={`Encerrar o semestre ${semester.code}? Isso concluirá matrículas ativas, encerrará vínculos de supervisão e arquivará o acesso operacional dos alunos sem outro semestre ativo.`}
                                  fields={[
                                    { name: "semester_id", value: semester.id },
                                    { name: "status", value: "encerrado" },
                                    { name: "return_to", value: "/gestao/alunos" }
                                  ]}
                                  className="button button-secondary button-small"
                                >
                                  Encerrar
                                </ConfirmActionForm>
                              ) : null}
                              <ConfirmActionForm
                                action={discardSemesterAction}
                                confirmationMessage={`Descartar permanentemente o semestre ${semester.code}? Use esta ação apenas para semestres de teste ou criados por engano. O sistema só concluirá a exclusão se não houver histórico acadêmico relevante.`}
                                fields={[
                                  { name: "semester_id", value: semester.id },
                                  { name: "return_to", value: "/gestao/alunos" }
                                ]}
                                className="button button-danger button-small"
                              >
                                Descartar
                              </ConfirmActionForm>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5}>
                          <span className="table-helper">
                            Ainda não há semestres cadastrados.
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </SectionCard>

          <div className="split-grid">
        <SectionCard
          title="Cadastrar aluno de estágio"
          description="Crie acesso do aluno. Os vínculos de estágio podem ser criados agora ou depois, na tela de gerenciamento do aluno."
        >
              <StudentRegistrationForm
                semesters={pageData.semesters}
                areaBlocks={pageData.areaBlocks}
                professorOptions={pageData.professorOptions}
              />
            </SectionCard>

        <SectionCard
          title="Cadastrar professor / supervisor"
          description="Crie o acesso do supervisor e vincule as áreas em que ele pode atuar."
        >
              <ProfessorRegistrationForm areaBlocks={pageData.areaBlocks} />
            </SectionCard>
          </div>

          <SectionCard
            title="Áreas de estágio"
            description="Estrutura oficial por bloco, usada nos cadastros, vínculos e relatórios."
          >
            <div className="management-block-grid">
              {pageData.areaBlocks.map((block) => (
                <article key={block.id} className="management-block-card">
                  <div className="management-block-header">
                    <h3>{block.name}</h3>
                    <span className="badge">{block.areas.length} áreas</span>
                  </div>
                  <ul className="detail-list">
                    {block.areas.map((área) => (
                      <li key={área.id} className="detail-item">
                        <span>{área.name}</span>
                        <span>{área.code}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </SectionCard>

        <SectionCard
          title="Alunos cadastrados"
          description="Gerencie os dados de alunos já cadastrados."
          className="management-students-card"
          actions={
            <div className="actions-row">
              <Link
                href="/gestao/alunos"
                className={`button button-small${
                  studentFilter === "ativados" ? "" : " button-secondary"
                }`}
              >
                Ativados ({activeStudents.length})
              </Link>
              <Link
                href="/gestao/alunos?alunos=desativados"
                className={`button button-small${
                  studentFilter === "desativados" ? "" : " button-secondary"
                }`}
              >
                Desativados ({inactiveStudents.length})
              </Link>
            </div>
          }
        >
            {visibleStudents.length ? (
              <div className="table-wrap">
                <table className="table management-students-table">
                  <thead>
                    <tr>
                      <th className="management-students-table-col-student">Aluno</th>
                      <th className="management-students-table-col-ra">RA</th>
                      <th className="management-students-table-col-contact">Contato</th>
                      <th className="management-students-table-col-status">Status</th>
                      <th className="management-students-table-col-assignments">Áreas vinculadas</th>
                      <th className="management-students-table-col-actions">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="management-students-table-col-student">{student.name}</td>
                        <td className="management-students-table-col-ra">{student.registration}</td>
                        <td className="management-students-table-col-contact">
                          <div>{student.email}</div>
                          <div className="table-helper">
                            {student.cellphone ?? "Celular não informado"}
                          </div>
                        </td>
                        <td className="management-students-table-col-status">
                          <span
                            className={`status-pill ${
                              student.isActive ? "status-ativo" : "status-inativo"
                            }`}
                          >
                            {student.isActive ? "ativo" : "inativo"}
                          </span>
                        </td>
                        <td className="management-students-table-col-assignments">
                          {student.assignments.length ? (
                            <div className="management-assignment-list">
                              {student.assignments.map((assignment) => (
                                <div
                                  key={assignment.enrollmentId}
                                  className="management-assignment-item"
                                >
                                  <strong>
                                    {assignment.semesterCode} - {assignment.areaName}
                                  </strong>
                                  <span>
                                    {assignment.blockName} -{" "}
                                    {assignment.supervisorNames.length
                                      ? assignment.supervisorNames.join(", ")
                                      : "Sem supervisores definidos"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="table-helper">
                              Sem vínculos de área ativos.
                            </span>
                          )}
                        </td>
                        <td className="management-students-table-col-actions">
                          <div className="actions-row">
                            <Link
                              className="button button-secondary button-small"
                              href={`/gestao/alunos/${student.id}#cadastro`}
                            >
                              Editar cadastro
                            </Link>
                            <Link
                              className="button button-secondary button-small"
                              href={`/gestao/alunos/${student.id}#estagio`}
                            >
                              Gerenciar estágio
                            </Link>
                            <Link
                              className="button button-secondary button-small"
                              href={`/gestao/alunos/${student.id}#histórico`}
                            >
                              Histórico
                            </Link>
                            {student.isActive ? (
                              <form action={deactivateStudentAction}>
                                <input type="hidden" name="user_id" value={student.id} />
                                <input type="hidden" name="return_to" value={studentFilterReturnPath} />
                                <button
                                  className="button button-secondary button-small"
                                  type="submit"
                                >
                                  Desativar
                                </button>
                              </form>
                            ) : (
                              <form action={reactivateStudentAction}>
                                <input type="hidden" name="user_id" value={student.id} />
                                <input type="hidden" name="return_to" value={studentFilterReturnPath} />
                                <button
                                  className="button button-secondary button-small"
                                  type="submit"
                                >
                                  Reativar
                                </button>
                              </form>
                            )}
                            <ConfirmActionForm
                              action={deleteStudentAction}
                              confirmationMessage={`Excluir permanentemente o cadastro de ${student.name}? Use esta opção apenas para registros de teste sem histórico relevante.`}
                              fields={[
                                { name: "user_id", value: student.id },
                                { name: "return_to", value: studentFilterReturnPath }
                              ]}
                              className="button button-danger button-small"
                            >
                              Excluir
                            </ConfirmActionForm>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                {studentFilter === "desativados"
                  ? "Ainda não há alunos desativados para exibição."
                  : "Ainda não há alunos ativados para exibição."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Professores / supervisores"
            description="Lista os supervisores cadastrados e as áreas em que eles podem atuar."
          >
            {pageData.professors.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Professor</th>
                      <th>Funcional</th>
                      <th>E-mail</th>
                      <th>Status</th>
                      <th>Áreas supervisionadas</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.professors.map((professor) => (
                      <tr key={professor.id}>
                        <td>{professor.name}</td>
                        <td>{professor.functional ?? "Não informado"}</td>
                        <td>{professor.email}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              professor.isActive ? "status-ativo" : "status-inativo"
                            }`}
                          >
                            {professor.isActive ? "ativo" : "inativo"}
                          </span>
                        </td>
                        <td>
                          {professor.areas.length ? (
                            <div className="management-tag-list">
                              {professor.areas.map((área) => (
                                <span key={área} className="badge">
                                  {área}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="table-helper">Nenhuma área vinculada.</span>
                          )}
                        </td>
                        <td>
                          <div className="actions-row">
                            {professor.isActive ? (
                              <form action={deactivateProfessorAction}>
                                <input type="hidden" name="user_id" value={professor.id} />
                                <input type="hidden" name="return_to" value="/gestao/alunos" />
                                <button
                                  className="button button-secondary button-small"
                                  type="submit"
                                >
                                  Desativar
                                </button>
                              </form>
                            ) : (
                              <form action={reactivateProfessorAction}>
                                <input type="hidden" name="user_id" value={professor.id} />
                                <input type="hidden" name="return_to" value="/gestao/alunos" />
                                <button
                                  className="button button-secondary button-small"
                                  type="submit"
                                >
                                  Reativar
                                </button>
                              </form>
                            )}
                            <ConfirmActionForm
                              action={deleteProfessorAction}
                              confirmationMessage={`Excluir permanentemente o cadastro de ${professor.name}? Use esta opção apenas para registros de teste sem histórico relevante.`}
                              fields={[
                                { name: "user_id", value: professor.id },
                                { name: "return_to", value: "/gestao/alunos" }
                              ]}
                              className="button button-danger button-small"
                            >
                              Excluir
                            </ConfirmActionForm>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                Ainda não há professores cadastrados com áreas vinculadas.
              </p>
            )}
          </SectionCard>
        </>
      ) : (
        <SectionCard
          title={emptyState?.title ?? "Gestão indisponível"}
          description={
            emptyState?.description ??
            "Ainda não foi possível carregar a estrutura acadêmica necessária para esta área."
          }
        >
          <p className="empty-message">
            Aplique o schema e o seed atualizados das áreas de estágio para
            liberar os cadastros reais de aluno e supervisor.
          </p>
        </SectionCard>
      )}
    </div>
  );
}




