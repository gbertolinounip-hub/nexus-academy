-- Script 4 - helpers SQL e base de RLS compativel para arquitetura
-- multi-institucional e multicurso.
--
-- Objetivo:
-- 1. Criar helpers novos por instituicao, curso e oferta.
-- 2. Preservar os helpers legados por unidade.
-- 3. Nao trocar policies legadas nesta etapa.
-- 4. Manter o fluxo atual da Fisioterapia intacto.
--
-- Importante:
-- - Este script NAO altera policies das tabelas legadas.
-- - Este script NAO cria o perfil master_curso automaticamente.
-- - O perfil master_curso deve ser criado em script/seed proprio,
--   porque a tabela public.perfis hoje possui validacoes legadas que
--   merecem migracao controlada.

create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select auth.uid();
$$;

create or replace function private.current_contexto_padrao_id()
returns uuid
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select u.contexto_padrao_id
  from public.usuarios u
  where u.id = private.current_user_id()
    and u.ativo = true
  limit 1;
$$;

create or replace function private.current_instituicao_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  resolved_instituicao_id uuid;
begin
  select coalesce(
    upc.instituicao_id,
    ocu.instituicao_id,
    c.instituicao_id
  )
  into resolved_instituicao_id
  from public.usuarios_papeis_contexto upc
  left join public.ofertas_curso_unidade ocu
    on ocu.id = upc.oferta_curso_unidade_id
  left join public.cursos c
    on c.id = upc.curso_id
  where upc.id = private.current_contexto_padrao_id()
    and upc.ativo = true
  limit 1;

  if resolved_instituicao_id is not null then
    return resolved_instituicao_id;
  end if;

  select un.instituicao_id
  into resolved_instituicao_id
  from public.usuarios u
  join public.unidades un
    on un.id = u.unidade_id
  where u.id = private.current_user_id()
    and u.ativo = true
  limit 1;

  return resolved_instituicao_id;
end;
$$;

create or replace function private.current_oferta_curso_unidade_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  resolved_oferta_id uuid;
  legacy_unit_id uuid;
begin
  select upc.oferta_curso_unidade_id
  into resolved_oferta_id
  from public.usuarios_papeis_contexto upc
  where upc.id = private.current_contexto_padrao_id()
    and upc.ativo = true
    and upc.oferta_curso_unidade_id is not null
  limit 1;

  if resolved_oferta_id is not null then
    return resolved_oferta_id;
  end if;

  select u.unidade_id
  into legacy_unit_id
  from public.usuarios u
  where u.id = private.current_user_id()
    and u.ativo = true
  limit 1;

  if legacy_unit_id is null then
    return null;
  end if;

  select ocu.id
  into resolved_oferta_id
  from public.ofertas_curso_unidade ocu
  join (
    select unidade_id
    from public.ofertas_curso_unidade
    where unidade_id = legacy_unit_id
      and ativo = true
    group by unidade_id
    having count(*) = 1
  ) single_offer
    on single_offer.unidade_id = ocu.unidade_id
  where ocu.unidade_id = legacy_unit_id
    and ocu.ativo = true
  limit 1;

  return resolved_oferta_id;
end;
$$;

create or replace function private.can_access_instituicao(p_instituicao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    p_instituicao_id is not null
    and private.current_user_is_active()
    and (
      private.is_master_coordinator()
      or exists (
        select 1
        from public.usuarios_papeis_contexto upc
        left join public.ofertas_curso_unidade ocu
          on ocu.id = upc.oferta_curso_unidade_id
        left join public.cursos c
          on c.id = upc.curso_id
        where upc.usuario_id = private.current_user_id()
          and upc.ativo = true
          and coalesce(
            upc.instituicao_id,
            ocu.instituicao_id,
            c.instituicao_id
          ) = p_instituicao_id
      )
      or exists (
        select 1
        from public.usuarios u
        join public.unidades un
          on un.id = u.unidade_id
        where u.id = private.current_user_id()
          and u.ativo = true
          and un.instituicao_id = p_instituicao_id
      )
    ),
    false
  );
$$;

create or replace function private.can_access_oferta_curso_unidade(p_oferta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  oferta_unit_id uuid;
  oferta_instituicao_id uuid;
  oferta_curso_id uuid;
begin
  if p_oferta_id is null or not private.current_user_is_active() then
    return false;
  end if;

  select
    ocu.unidade_id,
    ocu.instituicao_id,
    ocu.curso_id
  into
    oferta_unit_id,
    oferta_instituicao_id,
    oferta_curso_id
  from public.ofertas_curso_unidade ocu
  where ocu.id = p_oferta_id
  limit 1;

  if oferta_unit_id is null then
    return false;
  end if;

  if private.is_master_coordinator() then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and upc.oferta_curso_unidade_id = p_oferta_id
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    join public.perfis p
      on p.id = upc.perfil_id
    left join public.ofertas_curso_unidade ocu
      on ocu.id = upc.oferta_curso_unidade_id
    left join public.cursos c
      on c.id = upc.curso_id
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and p.codigo = 'master_curso'
      and coalesce(upc.curso_id, ocu.curso_id) = oferta_curso_id
      and coalesce(upc.instituicao_id, ocu.instituicao_id, c.instituicao_id) = oferta_instituicao_id
  ) then
    return true;
  end if;

  return private.can_access_unit(oferta_unit_id);
end;
$$;

create or replace function private.can_admin_oferta_curso_unidade(p_oferta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  oferta_unit_id uuid;
  oferta_instituicao_id uuid;
  oferta_curso_id uuid;
begin
  if p_oferta_id is null or not private.current_user_is_active() then
    return false;
  end if;

  select
    ocu.unidade_id,
    ocu.instituicao_id,
    ocu.curso_id
  into
    oferta_unit_id,
    oferta_instituicao_id,
    oferta_curso_id
  from public.ofertas_curso_unidade ocu
  where ocu.id = p_oferta_id
  limit 1;

  if oferta_unit_id is null then
    return false;
  end if;

  if private.is_master_coordinator() then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    join public.perfis p
      on p.id = upc.perfil_id
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and upc.oferta_curso_unidade_id = p_oferta_id
      and p.codigo in ('coordenador', 'secretaria', 'coordenador_curso_unidade')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    join public.perfis p
      on p.id = upc.perfil_id
    left join public.ofertas_curso_unidade ocu
      on ocu.id = upc.oferta_curso_unidade_id
    left join public.cursos c
      on c.id = upc.curso_id
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and p.codigo = 'master_curso'
      and coalesce(upc.curso_id, ocu.curso_id) = oferta_curso_id
      and coalesce(upc.instituicao_id, ocu.instituicao_id, c.instituicao_id) = oferta_instituicao_id
  ) then
    return true;
  end if;

  return private.can_admin_unit(oferta_unit_id);
end;
$$;

create or replace function private.can_admin_curso_instituicao(
  p_instituicao_id uuid,
  p_curso_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select coalesce(
    p_instituicao_id is not null
    and p_curso_id is not null
    and private.current_user_is_active()
    and (
      private.is_master_coordinator()
      or exists (
        select 1
        from public.usuarios_papeis_contexto upc
        join public.perfis p
          on p.id = upc.perfil_id
        left join public.ofertas_curso_unidade ocu
          on ocu.id = upc.oferta_curso_unidade_id
        left join public.cursos c
          on c.id = upc.curso_id
        where upc.usuario_id = private.current_user_id()
          and upc.ativo = true
          and p.codigo = 'master_curso'
          and coalesce(upc.curso_id, ocu.curso_id) = p_curso_id
          and coalesce(upc.instituicao_id, ocu.instituicao_id, c.instituicao_id) = p_instituicao_id
      )
      or exists (
        select 1
        from public.usuarios_papeis_contexto upc
        join public.perfis p
          on p.id = upc.perfil_id
        left join public.ofertas_curso_unidade ocu
          on ocu.id = upc.oferta_curso_unidade_id
        where upc.usuario_id = private.current_user_id()
          and upc.ativo = true
          and p.codigo in ('coordenador', 'secretaria', 'coordenador_curso_unidade')
          and coalesce(upc.curso_id, ocu.curso_id) = p_curso_id
          and coalesce(upc.instituicao_id, ocu.instituicao_id) = p_instituicao_id
      )
    ),
    false
  );
$$;

create or replace function private.can_operate_oferta_curso_unidade(p_oferta_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, private, pg_temp
as $$
declare
  oferta_unit_id uuid;
  oferta_instituicao_id uuid;
  oferta_curso_id uuid;
begin
  if p_oferta_id is null or not private.current_user_is_active() then
    return false;
  end if;

  select
    ocu.unidade_id,
    ocu.instituicao_id,
    ocu.curso_id
  into
    oferta_unit_id,
    oferta_instituicao_id,
    oferta_curso_id
  from public.ofertas_curso_unidade ocu
  where ocu.id = p_oferta_id
  limit 1;

  if oferta_unit_id is null then
    return false;
  end if;

  if private.is_master_coordinator() then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    join public.perfis p
      on p.id = upc.perfil_id
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and upc.oferta_curso_unidade_id = p_oferta_id
      and p.codigo in ('coordenador', 'professor', 'secretaria', 'coordenador_curso_unidade')
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.usuarios_papeis_contexto upc
    join public.perfis p
      on p.id = upc.perfil_id
    left join public.ofertas_curso_unidade ocu
      on ocu.id = upc.oferta_curso_unidade_id
    left join public.cursos c
      on c.id = upc.curso_id
    where upc.usuario_id = private.current_user_id()
      and upc.ativo = true
      and p.codigo = 'master_curso'
      and coalesce(upc.curso_id, ocu.curso_id) = oferta_curso_id
      and coalesce(upc.instituicao_id, ocu.instituicao_id, c.instituicao_id) = oferta_instituicao_id
  ) then
    return true;
  end if;

  return private.can_operate_unit(oferta_unit_id);
end;
$$;

-- Policies das novas tabelas estruturais ficam para um Script 4B.
-- Razao:
-- neste momento os services e a sessao do app ainda estao no modelo legado
-- por unidade, entao endurecer RLS agora pode bloquear leituras server-side
-- ainda nao migradas.

-- Consultas de verificacao manual
-- Observacao: funcoes baseadas em auth.uid() normalmente retornam null/false
-- no SQL Editor sem contexto autenticado do app. Use-as em contexto autenticado
-- ou compare o resultado estrutural das consultas abaixo.
--
-- select private.current_user_id();
-- select private.current_contexto_padrao_id();
-- select private.current_instituicao_id();
-- select private.current_oferta_curso_unidade_id();
--
-- select i.id, i.nome, i.slug
-- from public.instituicoes i
-- where i.slug = 'unip';
--
-- select
--   ocu.id,
--   ocu.nome_exibicao,
--   ocu.ativo,
--   u.nome as unidade,
--   c.nome as curso,
--   i.nome as instituicao
-- from public.ofertas_curso_unidade ocu
-- join public.unidades u on u.id = ocu.unidade_id
-- join public.cursos c on c.id = ocu.curso_id
-- join public.instituicoes i on i.id = ocu.instituicao_id
-- where c.codigo = 'FISIO'
-- order by u.nome;
--
-- select
--   upc.id,
--   upc.usuario_id,
--   p.codigo as perfil,
--   upc.instituicao_id,
--   upc.curso_id,
--   upc.oferta_curso_unidade_id,
--   upc.principal,
--   upc.ativo
-- from public.usuarios_papeis_contexto upc
-- join public.perfis p on p.id = upc.perfil_id
-- order by upc.created_at desc;
--
-- Exemplo de testes autenticados:
-- select private.can_access_instituicao((select id from public.instituicoes where slug = 'unip' limit 1));
-- select private.can_access_oferta_curso_unidade((select id from public.ofertas_curso_unidade limit 1));
-- select private.can_admin_oferta_curso_unidade((select id from public.ofertas_curso_unidade limit 1));
-- select private.can_admin_curso_instituicao(
--   (select id from public.instituicoes where slug = 'unip' limit 1),
--   (select id from public.cursos where codigo = 'FISIO' limit 1)
-- );
-- select private.can_operate_oferta_curso_unidade((select id from public.ofertas_curso_unidade limit 1));
