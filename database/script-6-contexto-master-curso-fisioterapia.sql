-- Script 6 - atribuicao inicial de master_curso para Fisioterapia
--
-- Objetivo:
-- 1. Parametrizar um usuario existente por e-mail.
-- 2. Localizar o usuario no cadastro atual.
-- 3. Localizar instituicao UNIP, curso FISIO e perfil master_curso.
-- 4. Criar ou reutilizar o contexto master_curso em usuarios_papeis_contexto.
-- 5. Nao alterar contexto_padrao_id nem principal automaticamente.
--
-- Importante:
-- - Substitua o valor de v_email_master antes de executar.
-- - O script nao altera coordenador_master.
-- - O script nao altera RLS/policies, sessao, services ou UI.

do $$
declare
  -- Defina aqui o e-mail do usuario que sera Master de Fisioterapia
  v_email_master text := 'DEFINIR_EMAIL_MASTER_AQUI';

  v_usuario_id uuid;
  v_usuario_ativo boolean;
  v_instituicao_id uuid;
  v_curso_id uuid;
  v_perfil_id smallint;
  v_existing_context_count integer;
begin
  if v_email_master is null
    or nullif(trim(v_email_master), '') is null
    or trim(v_email_master) = 'DEFINIR_EMAIL_MASTER_AQUI' then
    raise exception 'Defina um e-mail real em v_email_master antes de executar o Script 6.';
  end if;

  select u.id, u.ativo
  into v_usuario_id, v_usuario_ativo
  from public.usuarios u
  where lower(trim(u.email::text)) = lower(trim(v_email_master))
  limit 1;

  if v_usuario_id is null then
    raise exception 'Usuario com e-mail "%" nao encontrado em public.usuarios.', v_email_master;
  end if;

  if coalesce(v_usuario_ativo, false) = false then
    raise exception 'Usuario com e-mail "%" foi encontrado, mas esta inativo.', v_email_master;
  end if;

  select i.id
  into v_instituicao_id
  from public.instituicoes i
  where i.slug = 'unip'
  limit 1;

  if v_instituicao_id is null then
    raise exception 'Instituicao UNIP nao encontrada. Execute os scripts anteriores antes do Script 6.';
  end if;

  select c.id
  into v_curso_id
  from public.cursos c
  where c.instituicao_id = v_instituicao_id
    and c.codigo = 'FISIO'
  limit 1;

  if v_curso_id is null then
    raise exception 'Curso FISIO nao encontrado na instituicao UNIP. Execute os scripts anteriores antes do Script 6.';
  end if;

  select p.id
  into v_perfil_id
  from public.perfis p
  where p.codigo = 'master_curso'
  limit 1;

  if v_perfil_id is null then
    raise exception 'Perfil master_curso nao encontrado. Execute o Script 5 antes do Script 6.';
  end if;

  select count(*)
  into v_existing_context_count
  from public.usuarios_papeis_contexto upc
  where upc.usuario_id = v_usuario_id
    and upc.perfil_id = v_perfil_id
    and upc.instituicao_id = v_instituicao_id
    and upc.curso_id = v_curso_id
    and upc.oferta_curso_unidade_id is null;

  if v_existing_context_count > 1 then
    raise exception 'Ja existem % contextos master_curso duplicados para o usuario "%" em UNIP/FISIO. Resolva a duplicidade antes de continuar.', v_existing_context_count, v_email_master;
  end if;

  update public.usuarios_papeis_contexto upc
  set ativo = true
  where upc.usuario_id = v_usuario_id
    and upc.perfil_id = v_perfil_id
    and upc.instituicao_id = v_instituicao_id
    and upc.curso_id = v_curso_id
    and upc.oferta_curso_unidade_id is null
    and upc.ativo = false;

  if not exists (
    select 1
    from public.usuarios_papeis_contexto upc
    where upc.usuario_id = v_usuario_id
      and upc.perfil_id = v_perfil_id
      and upc.instituicao_id = v_instituicao_id
      and upc.curso_id = v_curso_id
      and upc.oferta_curso_unidade_id is null
  ) then
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
    values (
      v_usuario_id,
      v_perfil_id,
      v_instituicao_id,
      v_curso_id,
      null,
      false,
      true,
      jsonb_build_object(
        'origem', 'script-6-contexto-master-curso-fisioterapia',
        'curso_codigo', 'FISIO',
        'instituicao_slug', 'unip'
      )
    );
  end if;
end;
$$;

-- Consultas de verificacao manual
-- 1. Substitua o e-mail abaixo pelo mesmo valor informado em v_email_master.
--
-- select id, email, nome_completo, ativo
-- from public.usuarios
-- where lower(trim(email::text)) = lower(trim('DEFINIR_EMAIL_MASTER_AQUI'));
--
-- select
--   upc.id,
--   upc.usuario_id,
--   p.codigo as perfil,
--   upc.instituicao_id,
--   upc.curso_id,
--   upc.oferta_curso_unidade_id,
--   upc.principal,
--   upc.ativo,
--   upc.metadata
-- from public.usuarios_papeis_contexto upc
-- join public.perfis p on p.id = upc.perfil_id
-- join public.usuarios u on u.id = upc.usuario_id
-- where lower(trim(u.email::text)) = lower(trim('DEFINIR_EMAIL_MASTER_AQUI'))
-- order by upc.created_at desc;
--
-- select
--   upc.id,
--   p.codigo as perfil,
--   i.slug as instituicao_slug,
--   c.codigo as curso_codigo,
--   upc.oferta_curso_unidade_id,
--   upc.principal,
--   upc.ativo
-- from public.usuarios_papeis_contexto upc
-- join public.perfis p on p.id = upc.perfil_id
-- left join public.instituicoes i on i.id = upc.instituicao_id
-- left join public.cursos c on c.id = upc.curso_id
-- join public.usuarios u on u.id = upc.usuario_id
-- where lower(trim(u.email::text)) = lower(trim('DEFINIR_EMAIL_MASTER_AQUI'))
--   and p.codigo = 'master_curso';
--
-- select id, codigo, nome, descricao
-- from public.perfis
-- where codigo in ('master_curso', 'coordenador_master')
-- order by codigo;
