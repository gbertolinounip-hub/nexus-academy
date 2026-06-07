alter table public.perfis enable row level security;
alter table public.unidades enable row level security;
alter table public.usuarios enable row level security;
alter table public.alunos enable row level security;
alter table public.professores enable row level security;
alter table public.coordenadores enable row level security;
alter table public.coordenadores_master enable row level security;
alter table public.semestres enable row level security;
alter table public.blocos_estagio enable row level security;
alter table public.areas_estagio enable row level security;
alter table public.turmas enable row level security;
alter table public.matriculas_turma enable row level security;
alter table public.professor_areas_estagio enable row level security;
alter table public.vinculos_professor_aluno enable row level security;
alter table public.grupos_avaliacao enable row level security;
alter table public.criterios_avaliacao enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.itens_avaliados enable row level security;
alter table public.ausencias enable row level security;
alter table public.pacientes_clinica enable row level security;
alter table public.casos_clinicos enable row level security;
alter table public.casos_clinicos_horarios enable row level security;
alter table public.registros_clinicos enable row level security;
alter table public.notificacoes_clinicas enable row level security;
alter table public.documentos_aluno enable row level security;
alter table public.notificacoes_documentos_aluno enable row level security;
alter table public.acessos_sistema enable row level security;
alter table public.liberacoes_excepcionais enable row level security;
alter table public.historico_alteracoes enable row level security;

alter table public.perfis force row level security;
alter table public.unidades force row level security;
alter table public.usuarios force row level security;
alter table public.alunos force row level security;
alter table public.professores force row level security;
alter table public.coordenadores force row level security;
alter table public.coordenadores_master force row level security;
alter table public.semestres force row level security;
alter table public.blocos_estagio force row level security;
alter table public.areas_estagio force row level security;
alter table public.turmas force row level security;
alter table public.matriculas_turma force row level security;
alter table public.professor_areas_estagio force row level security;
alter table public.vinculos_professor_aluno force row level security;
alter table public.grupos_avaliacao force row level security;
alter table public.criterios_avaliacao force row level security;
alter table public.avaliacoes force row level security;
alter table public.itens_avaliados force row level security;
alter table public.ausencias force row level security;
alter table public.pacientes_clinica force row level security;
alter table public.casos_clinicos force row level security;
alter table public.casos_clinicos_horarios force row level security;
alter table public.registros_clinicos force row level security;
alter table public.notificacoes_clinicas force row level security;
alter table public.documentos_aluno force row level security;
alter table public.notificacoes_documentos_aluno force row level security;
alter table public.acessos_sistema force row level security;
alter table public.liberacoes_excepcionais force row level security;
alter table public.historico_alteracoes force row level security;

drop policy if exists perfis_read_policy on public.perfis;
create policy perfis_read_policy
on public.perfis
for select
to authenticated
using (true);

drop policy if exists perfis_manage_policy on public.perfis;
create policy perfis_manage_policy
on public.perfis
for all
to authenticated
using (private.is_master_coordinator())
with check (private.is_master_coordinator());

drop policy if exists unidades_read_policy on public.unidades;
create policy unidades_read_policy
on public.unidades
for select
to authenticated
using (
  private.is_master_coordinator()
  or private.can_access_unit(id)
);

drop policy if exists unidades_manage_policy on public.unidades;
create policy unidades_manage_policy
on public.unidades
for all
to authenticated
using (private.is_master_coordinator())
with check (private.is_master_coordinator());

drop policy if exists usuarios_select_policy on public.usuarios;
create policy usuarios_select_policy
on public.usuarios
for select
to authenticated
using (
  id = (select auth.uid())
  or private.can_admin_unit(unidade_id)
  or private.can_view_student(id)
  or private.can_view_professor(id)
);

drop policy if exists usuarios_update_self_policy on public.usuarios;
create policy usuarios_update_self_policy
on public.usuarios
for update
to authenticated
using (
  id = (select auth.uid()) or private.can_operate_unit(unidade_id)
)
with check (
  id = (select auth.uid()) or private.can_operate_unit(unidade_id)
);

drop policy if exists usuarios_manage_policy on public.usuarios;
create policy usuarios_manage_policy
on public.usuarios
for all
to authenticated
using (private.can_operate_unit(unidade_id))
with check (private.can_operate_unit(unidade_id));

drop policy if exists alunos_select_policy on public.alunos;
create policy alunos_select_policy
on public.alunos
for select
to authenticated
using (private.can_view_student(usuario_id));

drop policy if exists alunos_manage_policy on public.alunos;
create policy alunos_manage_policy
on public.alunos
for all
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = alunos.usuario_id
      and private.can_operate_unit(u.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = alunos.usuario_id
      and private.can_operate_unit(u.unidade_id)
  )
);

drop policy if exists professores_select_policy on public.professores;
create policy professores_select_policy
on public.professores
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (
    select 1
    from public.usuarios u
    where u.id = professores.usuario_id
      and private.can_admin_unit(u.unidade_id)
  )
  or exists (
    select 1
    from public.vinculos_professor_aluno v
    join public.matriculas_turma m on m.id = v.matricula_turma_id
    where v.professor_id = professores.usuario_id
      and m.aluno_id = (select auth.uid())
      and v.ativo = true
  )
);

drop policy if exists professores_manage_policy on public.professores;
create policy professores_manage_policy
on public.professores
for all
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.id = professores.usuario_id
      and private.can_operate_unit(u.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.id = professores.usuario_id
      and private.can_operate_unit(u.unidade_id)
  )
);

drop policy if exists coordenadores_select_policy on public.coordenadores;
create policy coordenadores_select_policy
on public.coordenadores
for select
to authenticated
using (
  usuario_id = (select auth.uid()) or private.can_admin_unit(unidade_id)
);

drop policy if exists coordenadores_manage_policy on public.coordenadores;
create policy coordenadores_manage_policy
on public.coordenadores
for all
to authenticated
using (private.is_master_coordinator())
with check (private.is_master_coordinator());

drop policy if exists coordenadores_master_select_policy on public.coordenadores_master;
create policy coordenadores_master_select_policy
on public.coordenadores_master
for select
to authenticated
using (
  usuario_id = (select auth.uid()) or private.is_master_coordinator()
);

drop policy if exists coordenadores_master_manage_policy on public.coordenadores_master;
create policy coordenadores_master_manage_policy
on public.coordenadores_master
for all
to authenticated
using (private.is_master_coordinator())
with check (private.is_master_coordinator());

drop policy if exists semestres_read_policy on public.semestres;
create policy semestres_read_policy
on public.semestres
for select
to authenticated
using (private.can_access_unit(unidade_id));

drop policy if exists semestres_manage_policy on public.semestres;
create policy semestres_manage_policy
on public.semestres
for all
to authenticated
using (private.can_operate_unit(unidade_id))
with check (private.can_operate_unit(unidade_id));

drop policy if exists blocos_estagio_read_policy on public.blocos_estagio;
create policy blocos_estagio_read_policy
on public.blocos_estagio
for select
to authenticated
using (true);

drop policy if exists blocos_estagio_manage_policy on public.blocos_estagio;
create policy blocos_estagio_manage_policy
on public.blocos_estagio
for all
to authenticated
using (private.is_coordinator())
with check (private.is_coordinator());

drop policy if exists areas_estagio_read_policy on public.areas_estagio;
create policy areas_estagio_read_policy
on public.areas_estagio
for select
to authenticated
using (true);

drop policy if exists areas_estagio_manage_policy on public.areas_estagio;
create policy areas_estagio_manage_policy
on public.areas_estagio
for all
to authenticated
using (private.is_coordinator())
with check (private.is_coordinator());

drop policy if exists turmas_read_policy on public.turmas;
create policy turmas_read_policy
on public.turmas
for select
to authenticated
using (
  exists (
    select 1
    from public.semestres s
    where s.id = turmas.semestre_id
      and private.can_admin_unit(s.unidade_id)
  )
  or exists (
    select 1
    from public.matriculas_turma m
    where m.turma_id = turmas.id
      and m.aluno_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.vinculos_professor_aluno v
    join public.matriculas_turma m on m.id = v.matricula_turma_id
    where m.turma_id = turmas.id
      and v.professor_id = (select auth.uid())
      and v.ativo = true
  )
);

drop policy if exists turmas_manage_policy on public.turmas;
create policy turmas_manage_policy
on public.turmas
for all
to authenticated
using (
  exists (
    select 1
    from public.semestres s
    where s.id = turmas.semestre_id
      and private.can_operate_unit(s.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.semestres s
    where s.id = turmas.semestre_id
      and private.can_operate_unit(s.unidade_id)
  )
);

drop policy if exists matriculas_turma_read_policy on public.matriculas_turma;
create policy matriculas_turma_read_policy
on public.matriculas_turma
for select
to authenticated
using (
  private.can_view_matricula(id)
);

drop policy if exists matriculas_turma_manage_policy on public.matriculas_turma;
create policy matriculas_turma_manage_policy
on public.matriculas_turma
for all
to authenticated
using (
  exists (
    select 1
    from public.turmas t
    join public.semestres s on s.id = t.semestre_id
    where t.id = matriculas_turma.turma_id
      and private.can_operate_unit(s.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.turmas t
    join public.semestres s on s.id = t.semestre_id
    where t.id = matriculas_turma.turma_id
      and private.can_operate_unit(s.unidade_id)
  )
);

drop policy if exists professor_areas_estagio_read_policy on public.professor_areas_estagio;
create policy professor_areas_estagio_read_policy
on public.professor_areas_estagio
for select
to authenticated
using (
  exists (
    select 1
    from public.professores p
    join public.usuarios u on u.id = p.usuario_id
    where p.usuario_id = professor_areas_estagio.professor_id
      and private.can_admin_unit(u.unidade_id)
  )
  or professor_id = (select auth.uid())
);

drop policy if exists professor_areas_estagio_manage_policy on public.professor_areas_estagio;
create policy professor_areas_estagio_manage_policy
on public.professor_areas_estagio
for all
to authenticated
using (
  exists (
    select 1
    from public.professores p
    join public.usuarios u on u.id = p.usuario_id
    where p.usuario_id = professor_areas_estagio.professor_id
      and private.can_operate_unit(u.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.professores p
    join public.usuarios u on u.id = p.usuario_id
    where p.usuario_id = professor_areas_estagio.professor_id
      and private.can_operate_unit(u.unidade_id)
  )
);

drop policy if exists vinculos_professor_aluno_read_policy on public.vinculos_professor_aluno;
create policy vinculos_professor_aluno_read_policy
on public.vinculos_professor_aluno
for select
to authenticated
using (
  exists (
    select 1
    from public.matriculas_turma m
    join public.turmas t on t.id = m.turma_id
    join public.semestres s on s.id = t.semestre_id
    where m.id = vinculos_professor_aluno.matricula_turma_id
      and private.can_admin_unit(s.unidade_id)
  )
  or professor_id = (select auth.uid())
  or exists (
    select 1
    from public.matriculas_turma m
    where m.id = vinculos_professor_aluno.matricula_turma_id
      and m.aluno_id = (select auth.uid())
  )
);

drop policy if exists vinculos_professor_aluno_manage_policy on public.vinculos_professor_aluno;
create policy vinculos_professor_aluno_manage_policy
on public.vinculos_professor_aluno
for all
to authenticated
using (
  exists (
    select 1
    from public.matriculas_turma m
    join public.turmas t on t.id = m.turma_id
    join public.semestres s on s.id = t.semestre_id
    where m.id = vinculos_professor_aluno.matricula_turma_id
      and private.can_operate_unit(s.unidade_id)
  )
)
with check (
  exists (
    select 1
    from public.matriculas_turma m
    join public.turmas t on t.id = m.turma_id
    join public.semestres s on s.id = t.semestre_id
    where m.id = vinculos_professor_aluno.matricula_turma_id
      and private.can_operate_unit(s.unidade_id)
  )
);

drop policy if exists grupos_avaliacao_read_policy on public.grupos_avaliacao;
create policy grupos_avaliacao_read_policy
on public.grupos_avaliacao
for select
to authenticated
using (true);

drop policy if exists grupos_avaliacao_manage_policy on public.grupos_avaliacao;
create policy grupos_avaliacao_manage_policy
on public.grupos_avaliacao
for all
to authenticated
using (private.is_coordinator())
with check (private.is_coordinator());

drop policy if exists criterios_avaliacao_read_policy on public.criterios_avaliacao;
create policy criterios_avaliacao_read_policy
on public.criterios_avaliacao
for select
to authenticated
using (true);

drop policy if exists criterios_avaliacao_manage_policy on public.criterios_avaliacao;
create policy criterios_avaliacao_manage_policy
on public.criterios_avaliacao
for all
to authenticated
using (private.is_coordinator())
with check (private.is_coordinator());

drop policy if exists avaliacoes_read_policy on public.avaliacoes;
create policy avaliacoes_read_policy
on public.avaliacoes
for select
to authenticated
using (private.can_view_evaluation_matricula(matricula_turma_id));

drop policy if exists avaliacoes_insert_policy on public.avaliacoes;
create policy avaliacoes_insert_policy
on public.avaliacoes
for insert
to authenticated
with check (
  private.can_manage_evaluation_matricula(matricula_turma_id)
  and (
    private.is_coordinator()
    or professor_id = (select auth.uid()::uuid)
  )
);

drop policy if exists avaliacoes_update_policy on public.avaliacoes;
create policy avaliacoes_update_policy
on public.avaliacoes
for update
to authenticated
using (private.can_manage_evaluation_matricula(matricula_turma_id))
with check (private.can_manage_evaluation_matricula(matricula_turma_id));

drop policy if exists itens_avaliados_read_policy on public.itens_avaliados;
create policy itens_avaliados_read_policy
on public.itens_avaliados
for select
to authenticated
using (
  exists (
    select 1
    from public.avaliacoes a
    where a.id = itens_avaliados.avaliacao_id
      and private.can_view_evaluation_matricula(a.matricula_turma_id)
  )
);

drop policy if exists itens_avaliados_insert_policy on public.itens_avaliados;
create policy itens_avaliados_insert_policy
on public.itens_avaliados
for insert
to authenticated
with check (
  exists (
    select 1
    from public.avaliacoes a
    where a.id = itens_avaliados.avaliacao_id
      and private.can_manage_evaluation_matricula(a.matricula_turma_id)
  )
);

drop policy if exists itens_avaliados_update_policy on public.itens_avaliados;
create policy itens_avaliados_update_policy
on public.itens_avaliados
for update
to authenticated
using (
  exists (
    select 1
    from public.avaliacoes a
    where a.id = itens_avaliados.avaliacao_id
      and private.can_manage_evaluation_matricula(a.matricula_turma_id)
  )
)
with check (
  exists (
    select 1
    from public.avaliacoes a
    where a.id = itens_avaliados.avaliacao_id
      and private.can_manage_evaluation_matricula(a.matricula_turma_id)
  )
);

drop policy if exists ausencias_read_policy on public.ausencias;
create policy ausencias_read_policy
on public.ausencias
for select
to authenticated
using (private.can_view_absence_matricula(matricula_turma_id));

drop policy if exists ausencias_insert_policy on public.ausencias;
create policy ausencias_insert_policy
on public.ausencias
for insert
to authenticated
with check (
  private.can_manage_absence_matricula(matricula_turma_id)
  and (
    private.is_coordinator()
    or registrado_por = (select auth.uid()::uuid)
  )
);

drop policy if exists ausencias_update_policy on public.ausencias;
create policy ausencias_update_policy
on public.ausencias
for update
to authenticated
using (private.can_manage_absence_matricula(matricula_turma_id))
with check (private.can_manage_absence_matricula(matricula_turma_id));

drop policy if exists pacientes_clinica_select_policy on public.pacientes_clinica;
create policy pacientes_clinica_select_policy
on public.pacientes_clinica
for select
to authenticated
using (
  private.can_admin_unit(unidade_id)
  or exists (
    select 1
    from public.casos_clinicos c
    where c.paciente_id = pacientes_clinica.id
      and private.can_view_clinical_case(c.id)
  )
);

drop policy if exists pacientes_clinica_insert_policy on public.pacientes_clinica;
create policy pacientes_clinica_insert_policy
on public.pacientes_clinica
for insert
to authenticated
with check (
  private.current_user_is_active()
  and (
    private.can_operate_unit(unidade_id)
    or (
      private.current_profile_code() = 'professor'
      and private.can_access_unit(unidade_id)
    )
  )
);

drop policy if exists pacientes_clinica_update_policy on public.pacientes_clinica;
create policy pacientes_clinica_update_policy
on public.pacientes_clinica
for update
to authenticated
using (
  private.can_operate_unit(unidade_id)
  or exists (
    select 1
    from public.casos_clinicos c
    where c.paciente_id = pacientes_clinica.id
      and private.can_manage_clinical_case(c.id)
  )
)
with check (
  private.can_operate_unit(unidade_id)
  or exists (
    select 1
    from public.casos_clinicos c
    where c.paciente_id = pacientes_clinica.id
      and private.can_manage_clinical_case(c.id)
  )
);

drop policy if exists pacientes_clinica_delete_policy on public.pacientes_clinica;
create policy pacientes_clinica_delete_policy
on public.pacientes_clinica
for delete
to authenticated
using (private.can_operate_unit(unidade_id));

drop policy if exists casos_clinicos_select_policy on public.casos_clinicos;
create policy casos_clinicos_select_policy
on public.casos_clinicos
for select
to authenticated
using (
  private.can_admin_unit(unidade_id)
  or (
    private.current_profile_code() = 'professor'
    and professor_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.matriculas_turma m
    where m.id = casos_clinicos.matricula_turma_id
      and m.aluno_id = (select auth.uid())
  )
);

drop policy if exists casos_clinicos_insert_policy on public.casos_clinicos;
create policy casos_clinicos_insert_policy
on public.casos_clinicos
for insert
to authenticated
with check (
  private.can_assign_clinical_case(
    unidade_id,
    matricula_turma_id,
    professor_id
  )
);

drop policy if exists casos_clinicos_update_policy on public.casos_clinicos;
create policy casos_clinicos_update_policy
on public.casos_clinicos
for update
to authenticated
using (
  private.can_assign_clinical_case(
    unidade_id,
    matricula_turma_id,
    professor_id
  )
)
with check (
  private.can_assign_clinical_case(
    unidade_id,
    matricula_turma_id,
    professor_id
  )
);

drop policy if exists casos_clinicos_delete_policy on public.casos_clinicos;
create policy casos_clinicos_delete_policy
on public.casos_clinicos
for delete
to authenticated
using (
  private.can_assign_clinical_case(
    unidade_id,
    matricula_turma_id,
    professor_id
  )
);

drop policy if exists casos_clinicos_horarios_select_policy on public.casos_clinicos_horarios;
create policy casos_clinicos_horarios_select_policy
on public.casos_clinicos_horarios
for select
to authenticated
using (private.can_view_clinical_case(caso_clinico_id));

drop policy if exists casos_clinicos_horarios_insert_policy on public.casos_clinicos_horarios;
create policy casos_clinicos_horarios_insert_policy
on public.casos_clinicos_horarios
for insert
to authenticated
with check (private.can_manage_clinical_case(caso_clinico_id));

drop policy if exists casos_clinicos_horarios_update_policy on public.casos_clinicos_horarios;
create policy casos_clinicos_horarios_update_policy
on public.casos_clinicos_horarios
for update
to authenticated
using (private.can_manage_clinical_case(caso_clinico_id))
with check (private.can_manage_clinical_case(caso_clinico_id));

drop policy if exists casos_clinicos_horarios_delete_policy on public.casos_clinicos_horarios;
create policy casos_clinicos_horarios_delete_policy
on public.casos_clinicos_horarios
for delete
to authenticated
using (private.can_manage_clinical_case(caso_clinico_id));

drop policy if exists registros_clinicos_select_policy on public.registros_clinicos;
create policy registros_clinicos_select_policy
on public.registros_clinicos
for select
to authenticated
using (private.can_view_clinical_case(caso_clinico_id));

drop policy if exists registros_clinicos_insert_policy on public.registros_clinicos;
create policy registros_clinicos_insert_policy
on public.registros_clinicos
for insert
to authenticated
with check (
  tipo in ('avaliacao', 'plano_tratamento', 'evolucao')
  and autor_id = (select auth.uid())
  and private.current_profile_code() = 'aluno'
  and private.can_view_clinical_case(caso_clinico_id)
);

drop policy if exists registros_clinicos_update_policy on public.registros_clinicos;
create policy registros_clinicos_update_policy
on public.registros_clinicos
for update
to authenticated
using (
  private.can_view_clinical_case(caso_clinico_id)
  and (
    autor_id = (select auth.uid())
    or (
      private.current_profile_code() = 'professor'
      and exists (
        select 1
        from public.casos_clinicos c
        where c.id = registros_clinicos.caso_clinico_id
          and c.professor_id = (select auth.uid())
      )
    )
  )
)
with check (
  private.can_view_clinical_case(caso_clinico_id)
  and (
    autor_id = (select auth.uid())
    or (
      private.current_profile_code() = 'professor'
      and exists (
        select 1
        from public.casos_clinicos c
        where c.id = registros_clinicos.caso_clinico_id
          and c.professor_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists registros_clinicos_delete_policy on public.registros_clinicos;
create policy registros_clinicos_delete_policy
on public.registros_clinicos
for delete
to authenticated
using (private.can_manage_clinical_case(caso_clinico_id));

drop policy if exists notificacoes_clinicas_select_policy on public.notificacoes_clinicas;
create policy notificacoes_clinicas_select_policy
on public.notificacoes_clinicas
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  and private.can_view_clinical_case(caso_clinico_id)
);

drop policy if exists notificacoes_clinicas_insert_policy on public.notificacoes_clinicas;
create policy notificacoes_clinicas_insert_policy
on public.notificacoes_clinicas
for insert
to authenticated
with check (
  private.current_user_is_active()
  and (
    (
      private.current_profile_code() = 'aluno'
      and tipo in (
        'avaliacao_enviada_supervisao',
        'plano_tratamento_enviado_supervisao',
        'evolucao_enviada_supervisao'
      )
      and exists (
        select 1
        from public.casos_clinicos c
        join public.matriculas_turma m on m.id = c.matricula_turma_id
        where c.id = notificacoes_clinicas.caso_clinico_id
          and c.unidade_id = notificacoes_clinicas.unidade_id
          and m.aluno_id = (select auth.uid())
          and c.professor_id = notificacoes_clinicas.usuario_id
      )
    )
    or (
      private.current_profile_code() = 'professor'
      and tipo in (
        'avaliacao_ajustes_solicitados',
        'avaliacao_aprovada',
        'plano_tratamento_ajustes_solicitados',
        'plano_tratamento_aprovado',
        'evolucao_ajustes_solicitados',
        'evolucao_aprovada'
      )
      and exists (
        select 1
        from public.casos_clinicos c
        join public.matriculas_turma m on m.id = c.matricula_turma_id
        where c.id = notificacoes_clinicas.caso_clinico_id
          and c.unidade_id = notificacoes_clinicas.unidade_id
          and c.professor_id = (select auth.uid())
          and m.aluno_id = notificacoes_clinicas.usuario_id
      )
    )
  )
);

drop policy if exists notificacoes_clinicas_update_policy on public.notificacoes_clinicas;
create policy notificacoes_clinicas_update_policy
on public.notificacoes_clinicas
for update
to authenticated
using (
  usuario_id = (select auth.uid())
  and private.can_view_clinical_case(caso_clinico_id)
)
with check (
  usuario_id = (select auth.uid())
  and private.can_view_clinical_case(caso_clinico_id)
);

drop policy if exists documentos_aluno_select_policy on public.documentos_aluno;
create policy documentos_aluno_select_policy
on public.documentos_aluno
for select
to authenticated
using (private.can_view_student_document(id));

drop policy if exists documentos_aluno_insert_policy on public.documentos_aluno;
create policy documentos_aluno_insert_policy
on public.documentos_aluno
for insert
to authenticated
with check (
  private.current_profile_code() = 'aluno'
  and aluno_id = (select auth.uid())
  and private.can_access_unit(unidade_id)
  and (
    (
      tipo = 'carteira_vacinacao'
      and matricula_turma_id is null
      and area_estagio_id is null
    )
    or (
      tipo = 'tce'
      and exists (
        select 1
        from public.matriculas_turma m
        join public.turmas t on t.id = m.turma_id
        join public.semestres s on s.id = t.semestre_id
        where m.id = documentos_aluno.matricula_turma_id
          and m.aluno_id = (select auth.uid())
          and m.status = 'ativa'
          and t.area_estagio_id = documentos_aluno.area_estagio_id
          and private.can_access_unit(s.unidade_id)
      )
    )
  )
);

drop policy if exists documentos_aluno_update_policy on public.documentos_aluno;
create policy documentos_aluno_update_policy
on public.documentos_aluno
for update
to authenticated
using (private.can_manage_student_document(id))
with check (private.can_manage_student_document(id));

drop policy if exists notificacoes_documentos_aluno_select_policy on public.notificacoes_documentos_aluno;
create policy notificacoes_documentos_aluno_select_policy
on public.notificacoes_documentos_aluno
for select
to authenticated
using (
  usuario_id = (select auth.uid())
  or private.can_manage_student_document(documento_id)
);

drop policy if exists notificacoes_documentos_aluno_insert_policy on public.notificacoes_documentos_aluno;
create policy notificacoes_documentos_aluno_insert_policy
on public.notificacoes_documentos_aluno
for insert
to authenticated
with check (
  private.current_user_is_active()
  and private.can_manage_student_document(documento_id)
  and usuario_id <> (select auth.uid())
  and tipo in (
    'documento_reprovado_professor',
    'documento_reprovado_coordenador'
  )
  and exists (
    select 1
    from public.documentos_aluno d
    where d.id = notificacoes_documentos_aluno.documento_id
      and d.aluno_id = notificacoes_documentos_aluno.usuario_id
      and d.unidade_id = notificacoes_documentos_aluno.unidade_id
  )
);

drop policy if exists notificacoes_documentos_aluno_update_policy on public.notificacoes_documentos_aluno;
create policy notificacoes_documentos_aluno_update_policy
on public.notificacoes_documentos_aluno
for update
to authenticated
using (usuario_id = (select auth.uid()))
with check (usuario_id = (select auth.uid()));

drop policy if exists acessos_sistema_select_policy on public.acessos_sistema;
create policy acessos_sistema_select_policy
on public.acessos_sistema
for select
to authenticated
using (private.can_admin_unit(unidade_id));

drop policy if exists acessos_sistema_insert_policy on public.acessos_sistema;
create policy acessos_sistema_insert_policy
on public.acessos_sistema
for insert
to authenticated
with check (
  private.current_user_is_active()
  and usuario_id = (select auth.uid())
  and (
    unidade_id is null
    or private.can_access_unit(unidade_id)
    or private.is_master_coordinator()
  )
);

drop policy if exists liberacoes_excepcionais_select_policy on public.liberacoes_excepcionais;
create policy liberacoes_excepcionais_select_policy
on public.liberacoes_excepcionais
for select
to authenticated
using (
  private.can_admin_unit(unidade_id)
  or private.is_master_coordinator()
  or usuario_autorizado_id = (select auth.uid())
);

drop policy if exists liberacoes_excepcionais_insert_policy on public.liberacoes_excepcionais;
create policy liberacoes_excepcionais_insert_policy
on public.liberacoes_excepcionais
for insert
to authenticated
with check (
  private.current_user_is_active()
  and criado_por = (select auth.uid())
  and (
    private.can_admin_unit(unidade_id)
    or private.is_master_coordinator()
  )
);

drop policy if exists liberacoes_excepcionais_update_policy on public.liberacoes_excepcionais;
create policy liberacoes_excepcionais_update_policy
on public.liberacoes_excepcionais
for update
to authenticated
using (
  private.can_admin_unit(unidade_id)
  or private.is_master_coordinator()
)
with check (
  private.current_user_is_active()
  and (
    private.can_admin_unit(unidade_id)
    or private.is_master_coordinator()
  )
);

drop policy if exists historico_alteracoes_read_policy on public.historico_alteracoes;
create policy historico_alteracoes_read_policy
on public.historico_alteracoes
for select
to authenticated
using (private.can_admin_unit(unidade_id));
