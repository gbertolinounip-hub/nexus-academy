-- Correcao da auditoria para tabelas sem coluna "id".
--
-- Problema:
-- A funcao public.audit_changes() assumia que toda tabela auditada possuia
-- a coluna "id", usando new.id / old.id diretamente.
--
-- Solucao:
-- 1. Criar/recriar um helper para resolver registro_id a partir do payload jsonb.
-- 2. Ajustar public.audit_changes() para usar esse helper.
-- 3. Permitir registro_id nulo quando nenhum identificador compativel existir.
--
-- Ordem de tentativa do identificador:
-- - id
-- - usuario_id
-- - matricula_turma_id
-- - aluno_id
-- - documento_id
-- - caso_clinico_id

create or replace function private.resolve_audit_record_id(
  p_record_data jsonb
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  candidate_key text;
  candidate_value text;
begin
  if p_record_data is null then
    return null;
  end if;

  foreach candidate_key in array array[
    'id',
    'usuario_id',
    'matricula_turma_id',
    'aluno_id',
    'documento_id',
    'caso_clinico_id'
  ]
  loop
    candidate_value := nullif(trim(coalesce(p_record_data ->> candidate_key, '')), '');

    if candidate_value is null then
      continue;
    end if;

    begin
      return candidate_value::uuid;
    exception
      when invalid_text_representation then
        continue;
    end;
  end loop;

  return null;
end;
$$;

create or replace function public.audit_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_user_unit_id uuid;
  record_unit_id uuid;
  record_id uuid;
  current_exceptional_release_id uuid;
  record_payload jsonb;
begin
  current_user_id := auth.uid();
  current_user_unit_id := (
    select u.unidade_id
    from public.usuarios u
    where u.id = current_user_id
    limit 1
  );

  if tg_op = 'DELETE' then
    record_payload := to_jsonb(old);
  else
    record_payload := to_jsonb(new);
  end if;

  current_exceptional_release_id := private.current_exceptional_release_id();

  record_unit_id := private.resolve_audit_unit_id(
    tg_table_name,
    record_payload,
    current_user_unit_id
  );

  record_id := private.resolve_audit_record_id(record_payload);

  if tg_op = 'INSERT' then
    insert into public.historico_alteracoes (
      tabela,
      registro_id,
      acao,
      dados_depois,
      usuario_id,
      unidade_id,
      liberacao_excepcional_id
    )
    values (
      tg_table_name,
      record_id,
      tg_op,
      to_jsonb(new),
      current_user_id,
      record_unit_id,
      current_exceptional_release_id
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.historico_alteracoes (
      tabela,
      registro_id,
      acao,
      dados_antes,
      dados_depois,
      usuario_id,
      unidade_id,
      liberacao_excepcional_id
    )
    values (
      tg_table_name,
      record_id,
      tg_op,
      to_jsonb(old),
      to_jsonb(new),
      current_user_id,
      record_unit_id,
      current_exceptional_release_id
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.historico_alteracoes (
      tabela,
      registro_id,
      acao,
      dados_antes,
      usuario_id,
      unidade_id,
      liberacao_excepcional_id
    )
    values (
      tg_table_name,
      record_id,
      tg_op,
      to_jsonb(old),
      current_user_id,
      record_unit_id,
      current_exceptional_release_id
    );
    return old;
  end if;

  return null;
end;
$$;
