begin;

create table if not exists public.atendimentos_clinicos (
  id uuid primary key default gen_random_uuid(),
  caso_clinico_id uuid not null references public.casos_clinicos (id) on delete cascade,
  paciente_id uuid not null references public.pacientes_clinica (id) on delete restrict,
  data_atendimento date not null,
  caso_clinico_horario_id uuid references public.casos_clinicos_horarios (id) on delete set null,
  matricula_turma_id uuid references public.matriculas_turma (id) on delete set null,
  turma_id uuid references public.turmas (id) on delete set null,
  semestre_id uuid references public.semestres (id) on delete set null,
  area_estagio_id uuid references public.areas_estagio (id) on delete set null,
  unidade_id uuid references public.unidades (id) on delete restrict,
  oferta_curso_unidade_id uuid references public.ofertas_curso_unidade (id) on delete restrict,
  curso_id uuid references public.cursos (id) on delete restrict,
  instituicao_id uuid references public.instituicoes (id) on delete restrict,
  professor_id uuid references public.professores (usuario_id) on delete restrict,
  aluno_id uuid references public.alunos (usuario_id) on delete restrict,
  status_presenca text not null,
  status_evolucao text not null,
  observacao_administrativa text,
  registrado_por uuid references public.usuarios (id) on delete set null,
  registrado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint atendimentos_clinicos_status_presenca_check
    check (status_presenca in ('presente', 'ausente', 'cancelado')),
  constraint atendimentos_clinicos_status_evolucao_check
    check (
      status_evolucao in (
        'dispensada',
        'pendente',
        'enviada',
        'ajustes_solicitados',
        'aprovada',
        'reprovada'
      )
    )
);

create unique index if not exists idx_atendimentos_clinicos_unico_dia_uk
  on public.atendimentos_clinicos (
    caso_clinico_id,
    data_atendimento,
    coalesce(caso_clinico_horario_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_atendimentos_clinicos_data_status
  on public.atendimentos_clinicos (data_atendimento, status_presenca, status_evolucao);

create index if not exists idx_atendimentos_clinicos_professor_data
  on public.atendimentos_clinicos (professor_id, data_atendimento desc)
  where professor_id is not null;

create index if not exists idx_atendimentos_clinicos_aluno_data
  on public.atendimentos_clinicos (aluno_id, data_atendimento desc)
  where aluno_id is not null;

create index if not exists idx_atendimentos_clinicos_area_data
  on public.atendimentos_clinicos (area_estagio_id, data_atendimento desc)
  where area_estagio_id is not null;

create index if not exists idx_atendimentos_clinicos_unidade_data
  on public.atendimentos_clinicos (unidade_id, data_atendimento desc)
  where unidade_id is not null;

create index if not exists idx_atendimentos_clinicos_oferta_data
  on public.atendimentos_clinicos (oferta_curso_unidade_id, data_atendimento desc)
  where oferta_curso_unidade_id is not null;

create index if not exists idx_atendimentos_clinicos_paciente_data
  on public.atendimentos_clinicos (paciente_id, data_atendimento desc);

alter table public.registros_clinicos
  add column if not exists atendimento_clinico_id uuid references public.atendimentos_clinicos (id) on delete set null;

drop index if exists public.idx_registros_clinicos_evolucao_data_uk;

create unique index if not exists idx_registros_clinicos_evolucao_atendimento_uk
  on public.registros_clinicos (atendimento_clinico_id)
  where tipo = 'evolucao'
    and atendimento_clinico_id is not null;

create unique index if not exists idx_registros_clinicos_evolucao_data_legacy_uk
  on public.registros_clinicos (
    caso_clinico_id,
    ((conteudo_json ->> 'sessionDate'))
  )
  where tipo = 'evolucao'
    and atendimento_clinico_id is null
    and coalesce(conteudo_json ->> 'sessionDate', '') <> '';

create index if not exists idx_registros_clinicos_atendimento_clinico_id
  on public.registros_clinicos (atendimento_clinico_id)
  where atendimento_clinico_id is not null;

create or replace function private.resolve_audit_unit_id(
  p_table_name text,
  p_record_data jsonb,
  p_actor_unit_id uuid default null
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  resolved_unit_id uuid;
begin
  if p_record_data is null then
    return p_actor_unit_id;
  end if;

  begin
    resolved_unit_id :=
      nullif(trim(coalesce(p_record_data ->> 'unidade_id', '')), '')::uuid;
  exception
    when invalid_text_representation then
      resolved_unit_id := null;
  end;

  if resolved_unit_id is not null then
    return resolved_unit_id;
  end if;

  case p_table_name
    when 'usuarios' then
      select u.unidade_id
      into resolved_unit_id
      from public.usuarios u
      where u.id = nullif(p_record_data ->> 'id', '')::uuid
      limit 1;

    when 'alunos' then
      select coalesce(a.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.alunos a
      left join public.usuarios u on u.id = a.usuario_id
      where a.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'professores' then
      select coalesce(p.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.professores p
      left join public.usuarios u on u.id = p.usuario_id
      where p.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'coordenadores' then
      select coalesce(c.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.coordenadores c
      left join public.usuarios u on u.id = c.usuario_id
      where c.usuario_id = nullif(p_record_data ->> 'usuario_id', '')::uuid
      limit 1;

    when 'semestres' then
      select s.unidade_id
      into resolved_unit_id
      from public.semestres s
      where s.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'semestre_id', '')::uuid
      )
      limit 1;

    when 'turmas' then
      select s.unidade_id
      into resolved_unit_id
      from public.turmas t
      join public.semestres s on s.id = t.semestre_id
      where t.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'turma_id', '')::uuid
      )
      limit 1;

    when 'matriculas_turma', 'ausencias', 'vinculos_professor_aluno' then
      select s.unidade_id
      into resolved_unit_id
      from public.matriculas_turma m
      join public.turmas t on t.id = m.turma_id
      join public.semestres s on s.id = t.semestre_id
      where m.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
      )
      limit 1;

    when 'blocos_estagio' then
      resolved_unit_id := p_actor_unit_id;

    when 'areas_estagio' then
      select ocu.unidade_id
      into resolved_unit_id
      from public.areas_estagio a
      left join public.ofertas_curso_unidade ocu on ocu.id = a.oferta_curso_unidade_id
      where a.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'area_estagio_id', '')::uuid
      )
      limit 1;

    when 'professor_areas_estagio' then
      select coalesce(p.unidade_id, u.unidade_id)
      into resolved_unit_id
      from public.professores p
      left join public.usuarios u on u.id = p.usuario_id
      where p.usuario_id = nullif(p_record_data ->> 'professor_id', '')::uuid
      limit 1;

    when 'avaliacoes' then
      select s.unidade_id
      into resolved_unit_id
      from public.semestres s
      where s.id = nullif(p_record_data ->> 'semestre_id', '')::uuid
      limit 1;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.matriculas_turma m
        join public.turmas t on t.id = m.turma_id
        join public.semestres s on s.id = t.semestre_id
        where m.id = nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
        limit 1;
      end if;

    when 'itens_avaliados' then
      select s.unidade_id
      into resolved_unit_id
      from public.avaliacoes a
      join public.semestres s on s.id = a.semestre_id
      where a.id = nullif(p_record_data ->> 'avaliacao_id', '')::uuid
      limit 1;

    when 'pacientes_clinica' then
      select p.unidade_id
      into resolved_unit_id
      from public.pacientes_clinica p
      where p.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'paciente_id', '')::uuid
      )
      limit 1;

    when 'casos_clinicos' then
      select c.unidade_id
      into resolved_unit_id
      from public.casos_clinicos c
      where c.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'caso_clinico_id', '')::uuid
      )
      limit 1;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.semestres s
        where s.id = nullif(p_record_data ->> 'semestre_id', '')::uuid
        limit 1;
      end if;

    when 'casos_clinicos_horarios', 'registros_clinicos', 'notificacoes_clinicas' then
      select c.unidade_id
      into resolved_unit_id
      from public.casos_clinicos c
      where c.id = nullif(p_record_data ->> 'caso_clinico_id', '')::uuid
      limit 1;

    when 'atendimentos_clinicos' then
      select ocu.unidade_id
      into resolved_unit_id
      from public.ofertas_curso_unidade ocu
      where ocu.id = nullif(p_record_data ->> 'oferta_curso_unidade_id', '')::uuid
      limit 1;

      if resolved_unit_id is null then
        select c.unidade_id
        into resolved_unit_id
        from public.casos_clinicos c
        where c.id = nullif(p_record_data ->> 'caso_clinico_id', '')::uuid
        limit 1;
      end if;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.turmas t
        join public.semestres s on s.id = t.semestre_id
        where t.id = nullif(p_record_data ->> 'turma_id', '')::uuid
        limit 1;
      end if;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.matriculas_turma m
        join public.turmas t on t.id = m.turma_id
        join public.semestres s on s.id = t.semestre_id
        where m.id = nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
        limit 1;
      end if;

    when 'modelos_tce' then
      resolved_unit_id := p_actor_unit_id;

    when 'configuracoes_tce_estagio' then
      select ocu.unidade_id
      into resolved_unit_id
      from public.configuracoes_tce_estagio cte
      join public.ofertas_curso_unidade ocu
        on ocu.id = cte.oferta_curso_unidade_id
      where cte.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'configuracao_tce_estagio_id', '')::uuid
      )
      limit 1;

    when 'tces_aluno' then
      select ocu.unidade_id
      into resolved_unit_id
      from public.tces_aluno ta
      join public.configuracoes_tce_estagio cte
        on cte.id = ta.configuracao_tce_estagio_id
      join public.ofertas_curso_unidade ocu
        on ocu.id = cte.oferta_curso_unidade_id
      where ta.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'tce_aluno_id', '')::uuid
      )
      limit 1;

      if resolved_unit_id is null then
        select s.unidade_id
        into resolved_unit_id
        from public.matriculas_turma m
        join public.turmas t on t.id = m.turma_id
        join public.semestres s on s.id = t.semestre_id
        where m.id = nullif(p_record_data ->> 'matricula_turma_id', '')::uuid
        limit 1;
      end if;

      if resolved_unit_id is null then
        select coalesce(a.unidade_id, u.unidade_id)
        into resolved_unit_id
        from public.alunos a
        left join public.usuarios u on u.id = a.usuario_id
        where a.usuario_id = nullif(p_record_data ->> 'aluno_id', '')::uuid
        limit 1;
      end if;

    when 'documentos_aluno' then
      select d.unidade_id
      into resolved_unit_id
      from public.documentos_aluno d
      where d.id = coalesce(
        nullif(p_record_data ->> 'id', '')::uuid,
        nullif(p_record_data ->> 'documento_id', '')::uuid
      )
      limit 1;

    when 'notificacoes_documentos_aluno' then
      select d.unidade_id
      into resolved_unit_id
      from public.documentos_aluno d
      where d.id = nullif(p_record_data ->> 'documento_id', '')::uuid
      limit 1;

    else
      resolved_unit_id := null;
  end case;

  return coalesce(resolved_unit_id, p_actor_unit_id);
end;
$$;

drop trigger if exists trg_atendimentos_clinicos_touch_updated_at on public.atendimentos_clinicos;
create trigger trg_atendimentos_clinicos_touch_updated_at
before update on public.atendimentos_clinicos
for each row execute function public.touch_updated_at();

drop trigger if exists trg_atendimentos_clinicos_audit on public.atendimentos_clinicos;
create trigger trg_atendimentos_clinicos_audit
after insert or update or delete on public.atendimentos_clinicos
for each row execute function public.audit_changes();

commit;
