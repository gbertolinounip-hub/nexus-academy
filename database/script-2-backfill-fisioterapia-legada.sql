-- Script 2 - backfill da Fisioterapia legada para a arquitetura
-- multi-institucional e multicurso.
--
-- Objetivo:
-- 1. Criar/reutilizar a instituicao UNIP.
-- 2. Vincular unidades legadas sem instituicao a UNIP.
-- 3. Criar/reutilizar o curso Fisioterapia na UNIP.
-- 4. Criar/reutilizar ofertas de Fisioterapia por unidade.
-- 5. Preencher FKs novos quando houver caminho legado seguro.
-- 6. Criar contextos basicos em usuarios_papeis_contexto sem duplicar registros.
-- 7. Preencher usuarios.contexto_padrao_id apenas quando houver um unico contexto principal seguro.
--
-- Observacoes:
-- - Script idempotente.
-- - Nao altera RLS/policies.
-- - Nao remove campos antigos.
-- - Nao faz endurecimento de constraints.
-- - Nao mexe nas tabelas clinicas nesta etapa.

begin;

do $$
declare
  v_instituicao_id uuid;
  v_curso_id uuid;
begin
  insert into public.instituicoes (
    nome,
    sigla,
    slug,
    ativo
  )
  values (
    'UNIP',
    'UNIP',
    'unip',
    true
  )
  on conflict (slug) do update
  set
    nome = excluded.nome,
    sigla = excluded.sigla,
    ativo = excluded.ativo
  returning id into v_instituicao_id;

  if v_instituicao_id is null then
    select i.id
    into v_instituicao_id
    from public.instituicoes i
    where i.slug = 'unip'
    limit 1;
  end if;

  update public.unidades u
  set instituicao_id = v_instituicao_id
  where u.instituicao_id is null;

  insert into public.cursos (
    instituicao_id,
    codigo,
    nome,
    slug,
    ativo
  )
  values (
    v_instituicao_id,
    'FISIO',
    'Fisioterapia',
    'fisioterapia',
    true
  )
  on conflict (instituicao_id, codigo) do update
  set
    nome = excluded.nome,
    slug = excluded.slug,
    ativo = excluded.ativo
  returning id into v_curso_id;

  if v_curso_id is null then
    select c.id
    into v_curso_id
    from public.cursos c
    where c.instituicao_id = v_instituicao_id
      and c.codigo = 'FISIO'
    limit 1;
  end if;

  insert into public.ofertas_curso_unidade (
    instituicao_id,
    unidade_id,
    curso_id,
    codigo,
    nome_exibicao,
    ativo
  )
  select
    v_instituicao_id,
    u.id,
    v_curso_id,
    'FISIO-' || upper(trim(u.sigla)),
    'Fisioterapia - ' || u.nome,
    true
  from public.unidades u
  where u.instituicao_id = v_instituicao_id
  on conflict (unidade_id, curso_id) do update
  set
    instituicao_id = excluded.instituicao_id,
    codigo = excluded.codigo,
    nome_exibicao = excluded.nome_exibicao,
    ativo = excluded.ativo;

  update public.alunos a
  set curso_id = v_curso_id
  where a.curso_id is null
    and lower(trim(a.curso)) = 'fisioterapia';

  update public.alunos a
  set oferta_curso_unidade_id = o.id
  from public.usuarios u,
       public.ofertas_curso_unidade o
  where u.id = a.usuario_id
    and o.unidade_id = coalesce(a.unidade_id, u.unidade_id)
    and o.curso_id = v_curso_id
    and a.oferta_curso_unidade_id is null
    and (
      a.curso_id = v_curso_id
      or lower(trim(a.curso)) = 'fisioterapia'
    );

  update public.semestres s
  set oferta_curso_unidade_id = o.id
  from public.ofertas_curso_unidade o
  where s.oferta_curso_unidade_id is null
    and o.unidade_id = s.unidade_id
    and o.curso_id = v_curso_id;

  update public.turmas t
  set oferta_curso_unidade_id = s.oferta_curso_unidade_id
  from public.semestres s
  where t.semestre_id = s.id
    and t.oferta_curso_unidade_id is null
    and s.oferta_curso_unidade_id is not null;

  update public.matriculas_turma mt
  set oferta_curso_unidade_id = t.oferta_curso_unidade_id
  from public.turmas t
  where mt.turma_id = t.id
    and mt.oferta_curso_unidade_id is null
    and t.oferta_curso_unidade_id is not null;

  update public.avaliacoes av
  set oferta_curso_unidade_id = src.oferta_curso_unidade_id
  from (
    select
      av2.id,
      coalesce(mt.oferta_curso_unidade_id, s.oferta_curso_unidade_id) as oferta_curso_unidade_id
    from public.avaliacoes av2
    left join public.matriculas_turma mt
      on mt.id = av2.matricula_turma_id
    left join public.semestres s
      on s.id = av2.semestre_id
  ) src
  where av.id = src.id
    and av.oferta_curso_unidade_id is null
    and src.oferta_curso_unidade_id is not null;

  update public.ausencias au
  set oferta_curso_unidade_id = mt.oferta_curso_unidade_id
  from public.matriculas_turma mt
  where au.matricula_turma_id = mt.id
    and au.oferta_curso_unidade_id is null
    and mt.oferta_curso_unidade_id is not null;

  update public.liberacoes_excepcionais le
  set oferta_curso_unidade_id = src.oferta_curso_unidade_id
  from (
    select
      le2.id,
      coalesce(
        t.oferta_curso_unidade_id,
        s.oferta_curso_unidade_id,
        a.oferta_curso_unidade_id,
        o.id
      ) as oferta_curso_unidade_id
    from public.liberacoes_excepcionais le2
    left join public.turmas t
      on t.id = le2.turma_id
    left join public.semestres s
      on s.id = le2.semestre_id
    left join public.alunos a
      on a.usuario_id = le2.aluno_id
    left join public.ofertas_curso_unidade o
      on o.unidade_id = le2.unidade_id
     and o.curso_id = v_curso_id
  ) src
  where le.id = src.id
    and le.oferta_curso_unidade_id is null
    and src.oferta_curso_unidade_id is not null;

  update public.documentos_aluno da
  set oferta_curso_unidade_id = src.oferta_curso_unidade_id
  from (
    select
      da2.id,
      coalesce(
        mt.oferta_curso_unidade_id,
        a.oferta_curso_unidade_id,
        o.id
      ) as oferta_curso_unidade_id
    from public.documentos_aluno da2
    left join public.matriculas_turma mt
      on mt.id = da2.matricula_turma_id
    left join public.alunos a
      on a.usuario_id = da2.aluno_id
    left join public.ofertas_curso_unidade o
      on o.unidade_id = da2.unidade_id
     and o.curso_id = v_curso_id
  ) src
  where da.id = src.id
    and da.oferta_curso_unidade_id is null
    and src.oferta_curso_unidade_id is not null;

  insert into public.usuarios_papeis_contexto (
    usuario_id,
    perfil_id,
    instituicao_id,
    curso_id,
    oferta_curso_unidade_id,
    principal,
    ativo,
    metadata
  )
  select
    candidates.usuario_id,
    candidates.perfil_id,
    candidates.instituicao_id,
    candidates.curso_id,
    candidates.oferta_curso_unidade_id,
    false,
    candidates.ativo,
    '{}'::jsonb
  from (
    select
      u.id as usuario_id,
      u.perfil_id,
      v_instituicao_id as instituicao_id,
      v_curso_id as curso_id,
      case
        when p.codigo = 'aluno' then coalesce(a.oferta_curso_unidade_id, o_unidade.id)
        when p.codigo in ('professor', 'coordenador', 'secretaria') then o_unidade.id
        else null
      end as oferta_curso_unidade_id,
      u.ativo
    from public.usuarios u
    join public.perfis p
      on p.id = u.perfil_id
    left join public.alunos a
      on a.usuario_id = u.id
    left join public.ofertas_curso_unidade o_unidade
      on o_unidade.unidade_id = u.unidade_id
     and o_unidade.curso_id = v_curso_id
    where p.codigo in ('aluno', 'professor', 'coordenador', 'secretaria')
  ) candidates
  where candidates.instituicao_id is not null
    and candidates.curso_id is not null
    and candidates.oferta_curso_unidade_id is not null
    and not exists (
      select 1
      from public.usuarios_papeis_contexto upc
      where upc.usuario_id = candidates.usuario_id
        and upc.perfil_id = candidates.perfil_id
        and upc.instituicao_id is not distinct from candidates.instituicao_id
        and upc.curso_id is not distinct from candidates.curso_id
        and upc.oferta_curso_unidade_id is not distinct from candidates.oferta_curso_unidade_id
    );

  update public.usuarios_papeis_contexto upc
  set principal = true
  from (
    select
      upc_single.usuario_id,
      upc_single.id as contexto_id
    from public.usuarios_papeis_contexto upc_single
    join (
      select usuario_id
      from public.usuarios_papeis_contexto
      where ativo = true
      group by usuario_id
      having count(*) = 1
    ) single_active
      on single_active.usuario_id = upc_single.usuario_id
    where upc_single.ativo = true
  ) single_context
  where upc.id = single_context.contexto_id
    and upc.principal = false;

  update public.usuarios u
  set contexto_padrao_id = principal_contexts.contexto_id
  from (
    select
      upc_single.usuario_id,
      upc_single.id as contexto_id
    from public.usuarios_papeis_contexto upc_single
    join (
      select usuario_id
      from public.usuarios_papeis_contexto
      where ativo = true
      group by usuario_id
      having count(*) = 1
    ) only_active
      on only_active.usuario_id = upc_single.usuario_id
    where upc_single.ativo = true
      and upc_single.principal = true
  ) principal_contexts
  where u.id = principal_contexts.usuario_id
    and u.contexto_padrao_id is null;
end;
$$;

commit;

-- Consultas de verificacao manual
-- select count(*) as total_instituicoes from public.instituicoes;
-- select count(*) as total_cursos from public.cursos;
-- select count(*) as total_ofertas_fisio from public.ofertas_curso_unidade;
-- select count(*) as unidades_sem_instituicao from public.unidades where instituicao_id is null;
-- select count(*) as semestres_sem_oferta from public.semestres where oferta_curso_unidade_id is null;
-- select count(*) as turmas_sem_oferta from public.turmas where oferta_curso_unidade_id is null;
-- select count(*) as matriculas_sem_oferta from public.matriculas_turma where oferta_curso_unidade_id is null;
-- select count(*) as alunos_sem_curso_id from public.alunos where curso_id is null;
-- select count(*) as alunos_sem_oferta from public.alunos where oferta_curso_unidade_id is null;
-- select count(*) as avaliacoes_sem_oferta from public.avaliacoes where oferta_curso_unidade_id is null;
-- select count(*) as ausencias_sem_oferta from public.ausencias where oferta_curso_unidade_id is null;
-- select count(*) as liberacoes_sem_oferta from public.liberacoes_excepcionais where oferta_curso_unidade_id is null;
-- select count(*) as documentos_sem_oferta from public.documentos_aluno where oferta_curso_unidade_id is null;
-- select count(*) as total_contextos_usuario from public.usuarios_papeis_contexto;
-- select count(*) as usuarios_com_contexto_principal from public.usuarios where contexto_padrao_id is not null;
-- select count(*) as usuarios_sem_contexto_padrao from public.usuarios where contexto_padrao_id is null;
