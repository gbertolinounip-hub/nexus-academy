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
using (private.can_view_matricula(matricula_turma_id));

drop policy if exists avaliacoes_insert_policy on public.avaliacoes;
create policy avaliacoes_insert_policy
on public.avaliacoes
for insert
to authenticated
with check (
  private.can_manage_grades(matricula_turma_id)
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
using (private.can_manage_grades(matricula_turma_id))
with check (private.can_manage_grades(matricula_turma_id));

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
      and private.can_view_matricula(a.matricula_turma_id)
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
      and private.can_manage_grades(a.matricula_turma_id)
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
      and private.can_manage_grades(a.matricula_turma_id)
  )
)
with check (
  exists (
    select 1
    from public.avaliacoes a
    where a.id = itens_avaliados.avaliacao_id
      and private.can_manage_grades(a.matricula_turma_id)
  )
);

drop policy if exists ausencias_read_policy on public.ausencias;
create policy ausencias_read_policy
on public.ausencias
for select
to authenticated
using (private.can_view_matricula(matricula_turma_id));

drop policy if exists ausencias_insert_policy on public.ausencias;
create policy ausencias_insert_policy
on public.ausencias
for insert
to authenticated
with check (
  private.can_manage_grades(matricula_turma_id)
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
using (private.can_manage_grades(matricula_turma_id))
with check (private.can_manage_grades(matricula_turma_id));

drop policy if exists historico_alteracoes_read_policy on public.historico_alteracoes;
create policy historico_alteracoes_read_policy
on public.historico_alteracoes
for select
to authenticated
using (private.can_admin_unit(unidade_id));
