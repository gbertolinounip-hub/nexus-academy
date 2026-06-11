-- Script 5 - perfil master_curso
--
-- Objetivo:
-- 1. Verificar a estrutura real de public.perfis.
-- 2. Criar ou reutilizar o perfil master_curso com seguranca.
-- 3. Preservar coordenador_master como perfil global/plataforma.
-- 4. Nao criar contextos automaticamente nesta etapa.
-- 5. Nao alterar RLS/policies nesta etapa.
--
-- Observacao:
-- A tabela public.perfis hoje usa id smallint identity e possui a constraint
-- perfis_codigo_check. Para permitir o novo codigo, este script atualiza a
-- constraint de forma idempotente.
--
-- Como preparacao adicional segura, este script tambem expande a constraint
-- acessos_sistema_perfil_check para aceitar master_curso, evitando falhas
-- futuras quando esse perfil passar a registrar acessos no sistema.

do $$
declare
  has_codigo boolean;
  has_nome boolean;
  has_descricao boolean;
  has_ativo boolean;
  unexpected_required_columns text[];
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfis'
      and column_name = 'codigo'
  ) into has_codigo;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfis'
      and column_name = 'nome'
  ) into has_nome;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfis'
      and column_name = 'descricao'
  ) into has_descricao;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'perfis'
      and column_name = 'ativo'
  ) into has_ativo;

  if not has_codigo or not has_nome then
    raise exception 'A tabela public.perfis nao possui a estrutura minima esperada (codigo/nome).';
  end if;

  select array_agg(c.column_name order by c.ordinal_position)
  into unexpected_required_columns
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'perfis'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and coalesce(c.is_identity, 'NO') = 'NO'
    and c.column_name not in ('id', 'codigo', 'nome');

  if unexpected_required_columns is not null and array_length(unexpected_required_columns, 1) > 0 then
    raise exception
      'A tabela public.perfis possui colunas obrigatorias sem default nao suportadas por este script: %',
      array_to_string(unexpected_required_columns, ', ');
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'perfis_codigo_check'
      and conrelid = 'public.perfis'::regclass
  ) then
    alter table public.perfis
      drop constraint perfis_codigo_check;
  end if;

  alter table public.perfis
    add constraint perfis_codigo_check
    check (
      codigo in (
        'aluno',
        'professor',
        'secretaria',
        'coordenador',
        'coordenador_master',
        'master_curso'
      )
    );

  if exists (
    select 1
    from pg_constraint
    where conname = 'acessos_sistema_perfil_check'
      and conrelid = 'public.acessos_sistema'::regclass
  ) then
    alter table public.acessos_sistema
      drop constraint acessos_sistema_perfil_check;
  end if;

  alter table public.acessos_sistema
    add constraint acessos_sistema_perfil_check
    check (
      perfil is null
      or perfil in (
        'aluno',
        'professor',
        'secretaria',
        'coordenador',
        'coordenador_master',
        'master_curso'
      )
    );

  if has_ativo then
    execute $sql$
      insert into public.perfis (codigo, nome, descricao, ativo)
      values (
        'master_curso',
        'Master do curso',
        'Gestor institucional responsavel por um curso em uma instituicao, com atuacao transversal as unidades onde o curso e ofertado.',
        true
      )
      on conflict (codigo) do update
      set
        nome = excluded.nome,
        descricao = excluded.descricao,
        ativo = excluded.ativo
    $sql$;
  elsif has_descricao then
    execute $sql$
      insert into public.perfis (codigo, nome, descricao)
      values (
        'master_curso',
        'Master do curso',
        'Gestor institucional responsavel por um curso em uma instituicao, com atuacao transversal as unidades onde o curso e ofertado.'
      )
      on conflict (codigo) do update
      set
        nome = excluded.nome,
        descricao = excluded.descricao
    $sql$;
  else
    execute $sql$
      insert into public.perfis (codigo, nome)
      values (
        'master_curso',
        'Master do curso'
      )
      on conflict (codigo) do update
      set
        nome = excluded.nome
    $sql$;
  end if;
end;
$$;

-- Consultas de verificacao manual
-- select column_name, data_type, is_nullable, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'perfis'
-- order by ordinal_position;
--
-- select id, codigo, nome, descricao
-- from public.perfis
-- order by id;
--
-- select id, codigo, nome, descricao
-- from public.perfis
-- where codigo = 'master_curso';
--
-- select id, codigo, nome, descricao
-- from public.perfis
-- where codigo = 'coordenador_master';
--
-- select
--   p1.id as master_curso_id,
--   p1.codigo as master_curso_codigo,
--   p2.id as coordenador_master_id,
--   p2.codigo as coordenador_master_codigo
-- from public.perfis p1
-- cross join public.perfis p2
-- where p1.codigo = 'master_curso'
--   and p2.codigo = 'coordenador_master';
