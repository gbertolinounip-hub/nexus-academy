import Link from "next/link";
import type { Route } from "next";
import {
  discardSemesterAction,
  deleteProfessorAction,
  deleteSecretaryAction,
  deleteStudentAction,
  deactivateProfessorAction,
  deactivateSecretaryAction,
  deactivateStudentAction,
  reactivateProfessorAction,
  reactivateSecretaryAction,
  reactivateStudentAction,
  updateSemesterStatusAction
} from "@/app/(app)/gestao/alunos/actions";
import { SectionCard } from "@/components/common/section-card";
import { CourseManagerUnitCoordinatorForm } from "@/components/forms/course-manager-unit-coordinator-form";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { ProfessorRegistrationForm } from "@/components/forms/professor-registration-form";
import { SecretaryRegistrationForm } from "@/components/forms/secretary-registration-form";
import { SemesterManagementForm } from "@/components/forms/semester-management-form";
import { StageAreaRegistrationForm } from "@/components/forms/stage-area-registration-form";
import { StudentRegistrationForm } from "@/components/forms/student-registration-form";
import { requireRole } from "@/lib/auth/session";
import { getCoordinatorManagementPageData } from "@/services/management";

function buildManagementListPath(input: {
  studentFilter?: "ativados" | "desativados";
  unitId?: string | null;
}): Route {
  const searchParams = new URLSearchParams();

  if (input.studentFilter === "desativados") {
    searchParams.set("alunos", "desativados");
  }

  if (input.unitId) {
    searchParams.set("unidade", input.unitId);
  }

  const serialized = searchParams.toString();
  return (serialized ? `/gestao/alunos?${serialized}` : "/gestao/alunos") as Route;
}

function buildUnitFilterActions(input: {
  unitOptions: Array<{ id: string; label: string }>;
  selectedUnitId: string | null;
  studentFilter?: "ativados" | "desativados";
}) {
  return (
    <form method="get" className="management-inline-filter-form">
      {input.studentFilter === "desativados" ? (
        <input type="hidden" name="alunos" value="desativados" />
      ) : null}
      <label className="management-inline-filter-field">
        <span>Unidade</span>
        <select className="input" name="unidade" defaultValue={input.selectedUnitId ?? ""}>
          <option value="">Todas as unidades</option>
          {input.unitOptions.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <button className="button button-secondary button-small" type="submit">
        Filtrar
      </button>
      {input.selectedUnitId ? (
        <Link
          href={buildManagementListPath({
            studentFilter: input.studentFilter
          })}
          className="button button-secondary button-small"
        >
          Limpar
        </Link>
      ) : null}
    </form>
  );
}

export default async function AcademicManagementPage(props: {
  searchParams?: Promise<{
    notice?: string;
    notice_type?: "success" | "error";
    alunos?: string;
    unidade?: string;
  }>;
}) {
  const currentUser = await requireRole(["coordenador"]);
  const searchParams = (await props.searchParams) ?? {};
  const { pageData, emptyState } = await getCoordinatorManagementPageData(currentUser, {
    unitId: searchParams.unidade
  });
  const notice = searchParams.notice?.trim() ?? "";
  const noticeType = searchParams.notice_type === "success" ? "success" : "error";
  const studentFilter =
    searchParams.alunos === "desativados" ? "desativados" : "ativados";
  const isCourseManager = pageData?.isCourseManager ?? false;
  const activeStudents = pageData?.students.filter((student) => student.isActive) ?? [];
  const inactiveStudents = pageData?.students.filter((student) => !student.isActive) ?? [];
  const visibleStudents =
    studentFilter === "desativados" ? inactiveStudents : activeStudents;
  const visibleStageAreas =
    pageData?.areaBlocks
      .flatMap((block) => block.areas)
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")) ?? [];
  const studentFilterReturnPath = buildManagementListPath({
    studentFilter,
    unitId: pageData?.selectedUnitId ?? null
  });

  return (
    <div className="stack management-catalog-page">
      <section className="hero-card">
        <p className="eyebrow">Gestão acadêmica</p>
        <h1>Cadastros e vínculos de estágio</h1>
        <p>
          {isCourseManager
            ? "Acompanhe os cadastros do curso em todas as unidades permitidas, filtre por unidade e habilite coordenadores locais sem assumir as operações acadêmicas do campus."
            : "Cadastre alunos e supervisores com acesso real ao sistema, vincule áreas dinamicamente por semestre, registre a secretária da unidade e mantenha a supervisão organizada por bloco e área de estágio."}
        </p>
        {!isCourseManager ? (
          <div className="actions-row">
            <Link href="/gestao/alunos/importar" className="button button-secondary">
              Importar alunos
            </Link>
          </div>
        ) : null}
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
          {!isCourseManager ? (
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
          ) : (
            <SectionCard
              title="Cadastrar Coordenador de Unidade"
              description="Habilite o Coordenador Local para uma unidade que já possui oferta do curso dentro da instituição ativa."
            >
              <CourseManagerUnitCoordinatorForm units={pageData.unitOptions} />
            </SectionCard>
          )}

          {!isCourseManager ? (
            <>
              <SectionCard
                title="Cadastrar área supervisionada"
                description="Cadastre áreas específicas da oferta ativa para alimentar aluno, professor, relatórios e a organização do estágio sem depender de listas fixas."
              >
                <StageAreaRegistrationForm />
              </SectionCard>

              <div className="split-grid management-registration-grid">
                <SectionCard
                  title="Cadastrar aluno de estágio"
                  description="Crie acesso do aluno. Os vínculos de estágio podem ser criados agora ou depois, na tela de gerenciamento do aluno."
                  className="management-registration-card"
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
                  className="management-registration-card management-professors-card"
                >
                  <ProfessorRegistrationForm areaBlocks={pageData.areaBlocks} />
                </SectionCard>
              </div>

              <SectionCard
                title="Cadastrar secretária da unidade"
                description="Crie o acesso administrativo-operacional da secretária para cadastro, atribuição e consulta institucional de pacientes."
              >
                <SecretaryRegistrationForm />
              </SectionCard>

              <SectionCard
                title="Áreas de estágio"
                description="Lista dinâmica das áreas supervisionadas disponíveis para a oferta atual."
                className="management-areas-card"
              >
                {visibleStageAreas.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Área supervisionada</th>
                          <th>Código</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleStageAreas.map((area) => (
                          <tr key={area.id}>
                            <td>{area.name}</td>
                            <td>{area.code}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-message">
                    Ainda não há áreas supervisionadas cadastradas para esta oferta. Cadastre a
                    primeira área acima para liberar os vínculos dinâmicos de aluno e professor.
                  </p>
                )}
              </SectionCard>
            </>
          ) : null}

        <SectionCard
          title="Alunos cadastrados"
          description={
            isCourseManager
              ? "Consulta consolidada dos alunos do curso nas unidades permitidas pelo contexto ativo."
              : "Gerencie os dados de alunos já cadastrados."
          }
          className="management-students-card"
          actions={
            <div className="actions-row">
              {isCourseManager
                ? buildUnitFilterActions({
                    unitOptions: pageData.unitOptions,
                    selectedUnitId: pageData.selectedUnitId,
                    studentFilter
                  })
                : null}
              <Link
                href={buildManagementListPath({
                  studentFilter: "ativados",
                  unitId: pageData.selectedUnitId
                })}
                className={`button button-small${
                  studentFilter === "ativados" ? "" : " button-secondary"
                }`}
              >
                Ativados ({activeStudents.length})
              </Link>
              <Link
                href={buildManagementListPath({
                  studentFilter: "desativados",
                  unitId: pageData.selectedUnitId
                })}
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
              <div className="table-wrap management-students-table-wrap">
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
                        <td className="management-students-table-col-student">
                          <div>{student.name}</div>
                          {isCourseManager && student.unitName ? (
                            <div className="table-helper">{student.unitName}</div>
                          ) : null}
                        </td>
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
                                    {assignment.blockName}
                                    {assignment.unitName ? ` - ${assignment.unitName}` : ""} -{" "}
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
                          {isCourseManager ? (
                            <span className="table-helper">
                              Consulta supervisionada por unidade.
                            </span>
                          ) : (
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
                          )}
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
                  : isCourseManager && pageData.selectedUnitId
                    ? "Nenhum aluno foi encontrado para a unidade selecionada."
                    : "Ainda não há alunos ativados para exibição."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Professores / supervisores"
            description={
              isCourseManager
                ? "Consulta os supervisores já ligados ao curso e permite recorte por unidade."
                : "Lista os supervisores cadastrados e as áreas em que eles podem atuar."
            }
            actions={
              isCourseManager
                ? buildUnitFilterActions({
                    unitOptions: pageData.unitOptions,
                    selectedUnitId: pageData.selectedUnitId,
                    studentFilter
                  })
                : undefined
            }
          >
            {pageData.professors.length ? (
              <div className="table-wrap management-professors-table-wrap">
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
                        <td>
                          <div>{professor.name}</div>
                          {isCourseManager && professor.unitName ? (
                            <div className="table-helper">{professor.unitName}</div>
                          ) : null}
                        </td>
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
                          {isCourseManager ? (
                            <span className="table-helper">
                              Consulta supervisionada por unidade.
                            </span>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                {isCourseManager && pageData.selectedUnitId
                  ? "Nenhum professor foi encontrado para a unidade selecionada."
                  : "Ainda não há professores cadastrados com áreas vinculadas."}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="Secretárias da unidade"
            description={
              isCourseManager
                ? "Consulta os acessos administrativos das unidades onde o curso está ofertado."
                : "Acessos administrativos da Clínica Supervisionada, restritos à operação institucional da unidade."
            }
            actions={
              isCourseManager
                ? buildUnitFilterActions({
                    unitOptions: pageData.unitOptions,
                    selectedUnitId: pageData.selectedUnitId,
                    studentFilter
                  })
                : undefined
            }
          >
            {pageData.secretaries.length ? (
              <div className="table-wrap management-professors-table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Secretária</th>
                      <th>E-mail</th>
                      <th>Status</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.secretaries.map((secretary) => (
                      <tr key={secretary.id}>
                        <td>
                          <div>{secretary.name}</div>
                          {isCourseManager && secretary.unitName ? (
                            <div className="table-helper">{secretary.unitName}</div>
                          ) : null}
                        </td>
                        <td>{secretary.email}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              secretary.isActive ? "status-ativo" : "status-inativo"
                            }`}
                          >
                            {secretary.isActive ? "ativo" : "inativo"}
                          </span>
                        </td>
                        <td>
                          {isCourseManager ? (
                            <span className="table-helper">
                              Consulta supervisionada por unidade.
                            </span>
                          ) : (
                            <div className="actions-row">
                              {secretary.isActive ? (
                                <form action={deactivateSecretaryAction}>
                                  <input type="hidden" name="user_id" value={secretary.id} />
                                  <input type="hidden" name="return_to" value="/gestao/alunos" />
                                  <button
                                    className="button button-secondary button-small"
                                    type="submit"
                                  >
                                    Desativar
                                  </button>
                                </form>
                              ) : (
                                <form action={reactivateSecretaryAction}>
                                  <input type="hidden" name="user_id" value={secretary.id} />
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
                                action={deleteSecretaryAction}
                                confirmationMessage={`Excluir permanentemente o cadastro de ${secretary.name}? Use esta opção apenas para registros de teste ou acessos criados por engano.`}
                                fields={[
                                  { name: "user_id", value: secretary.id },
                                  { name: "return_to", value: "/gestao/alunos" }
                                ]}
                                className="button button-danger button-small"
                              >
                                Excluir
                              </ConfirmActionForm>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-message">
                {isCourseManager && pageData.selectedUnitId
                  ? "Nenhuma secretária foi encontrada para a unidade selecionada."
                  : "Ainda não há secretárias cadastradas nesta unidade."}
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




