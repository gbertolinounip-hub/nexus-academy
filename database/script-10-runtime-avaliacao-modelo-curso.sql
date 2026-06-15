begin;

drop function if exists public.criar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
);

drop function if exists public.criar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
);

create or replace function public.criar_avaliacao_com_itens(
  p_matricula_turma_id uuid,
  p_tipo_lancamento text,
  p_referencia text,
  p_observacoes text,
  p_status text,
  p_itens jsonb,
  p_modelo_avaliacao_curso_id uuid default null,
  p_modalidade_snapshot text default null,
  p_avaliado_em timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avaliacao_id uuid;
  v_semestre_id uuid;
  v_item jsonb;
  v_criterio_id uuid;
  v_criterio_modelo_avaliacao_id uuid;
  v_opcao_criterio_modelo_avaliacao_id uuid;
  v_opcao_rotulo_snapshot text;
  v_opcao_descricao_snapshot text;
  v_opcao_valor_snapshot numeric(5,2);
  v_nota_bruta numeric(5,2);
  v_feedback text;
  v_peso_percentual numeric(5,2);
begin
  if private.current_profile_code() <> 'professor' then
    raise exception 'Apenas professores podem criar avaliacoes por esta funcao.';
  end if;

  if not private.can_manage_evaluation_matricula(p_matricula_turma_id) then
    raise exception 'Professor sem permissao para lancar avaliacao neste contexto.';
  end if;

  if p_tipo_lancamento not in ('parcial', 'revisao', 'fechamento') then
    raise exception 'Tipo de lancamento invalido.';
  end if;

  if p_status not in ('rascunho', 'publicado') then
    raise exception 'Status de lancamento invalido.';
  end if;

  if trim(coalesce(p_referencia, '')) = '' then
    raise exception 'A referencia do lancamento e obrigatoria.';
  end if;

  if p_modalidade_snapshot is not null
    and p_modalidade_snapshot not in ('descritiva', 'rubrica') then
    raise exception 'Modalidade de avaliacao invalida.';
  end if;

  if p_itens is null
    or jsonb_typeof(p_itens) <> 'array'
    or jsonb_array_length(p_itens) = 0 then
    raise exception 'E necessario informar ao menos um criterio avaliado.';
  end if;

  select t.semestre_id
  into v_semestre_id
  from public.matriculas_turma mt
  join public.turmas t on t.id = mt.turma_id
  where mt.id = p_matricula_turma_id
  limit 1;

  if v_semestre_id is null then
    raise exception 'Nao foi possivel identificar o semestre da matricula.';
  end if;

  insert into public.avaliacoes (
    matricula_turma_id,
    professor_id,
    semestre_id,
    tipo_lancamento,
    referencia,
    observacoes,
    status,
    avaliado_em,
    modelo_avaliacao_curso_id,
    modalidade_snapshot
  )
  values (
    p_matricula_turma_id,
    auth.uid(),
    v_semestre_id,
    p_tipo_lancamento,
    trim(p_referencia),
    nullif(trim(coalesce(p_observacoes, '')), ''),
    p_status,
    coalesce(p_avaliado_em, now()),
    p_modelo_avaliacao_curso_id,
    p_modalidade_snapshot
  )
  returning id into v_avaliacao_id;

  for v_item in
    select value
    from jsonb_array_elements(p_itens)
  loop
    v_criterio_id := nullif(v_item ->> 'criterio_id', '')::uuid;
    v_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'opcao_criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_rotulo_snapshot := nullif(trim(coalesce(v_item ->> 'opcao_rotulo_snapshot', '')), '');
    v_opcao_descricao_snapshot :=
      nullif(trim(coalesce(v_item ->> 'opcao_descricao_snapshot', '')), '');
    v_opcao_valor_snapshot := nullif(v_item ->> 'opcao_valor_snapshot', '')::numeric;
    v_nota_bruta := nullif(v_item ->> 'nota_bruta', '')::numeric;
    v_feedback := nullif(trim(coalesce(v_item ->> 'feedback', '')), '');

    if v_nota_bruta is null and v_opcao_valor_snapshot is not null then
      v_nota_bruta := v_opcao_valor_snapshot;
    end if;

    if v_criterio_id is null or v_nota_bruta is null then
      raise exception 'Item avaliado invalido.';
    end if;

    select c.peso_percentual
    into v_peso_percentual
    from public.criterios_avaliacao c
    where c.id = v_criterio_id
      and c.ativo = true
    limit 1;

    if v_peso_percentual is null then
      raise exception 'Criterio de avaliacao nao encontrado ou inativo.';
    end if;

    insert into public.itens_avaliados (
      avaliacao_id,
      criterio_id,
      criterio_modelo_avaliacao_id,
      opcao_criterio_modelo_avaliacao_id,
      opcao_rotulo_snapshot,
      opcao_descricao_snapshot,
      opcao_valor_snapshot,
      nota_bruta,
      peso_aplicado_percentual,
      feedback
    )
    values (
      v_avaliacao_id,
      v_criterio_id,
      v_criterio_modelo_avaliacao_id,
      v_opcao_criterio_modelo_avaliacao_id,
      v_opcao_rotulo_snapshot,
      v_opcao_descricao_snapshot,
      v_opcao_valor_snapshot,
      v_nota_bruta,
      v_peso_percentual,
      v_feedback
    );
  end loop;

  if p_status = 'publicado' then
    perform private.consume_active_exceptional_release_for_matricula_type(
      p_matricula_turma_id,
      'avaliacao'
    );
  end if;

  return v_avaliacao_id;
end;
$$;

revoke all on function public.criar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) from public;

grant execute on function public.criar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) to authenticated;

drop function if exists public.criar_revisao_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  jsonb,
  timestamptz
);

drop function if exists public.criar_revisao_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
);

create or replace function public.criar_revisao_avaliacao_com_itens(
  p_avaliacao_origem_id uuid,
  p_referencia text,
  p_observacoes text,
  p_status text,
  p_itens jsonb,
  p_modelo_avaliacao_curso_id uuid default null,
  p_modalidade_snapshot text default null,
  p_avaliado_em timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_origem public.avaliacoes%rowtype;
  v_avaliacao_id uuid;
  v_item jsonb;
  v_criterio_id uuid;
  v_criterio_modelo_avaliacao_id uuid;
  v_opcao_criterio_modelo_avaliacao_id uuid;
  v_opcao_rotulo_snapshot text;
  v_opcao_descricao_snapshot text;
  v_opcao_valor_snapshot numeric(5,2);
  v_nota_bruta numeric(5,2);
  v_feedback text;
  v_peso_percentual numeric(5,2);
  v_existing_draft_id uuid;
  v_latest_published_id uuid;
begin
  if private.current_profile_code() <> 'professor' then
    raise exception 'Apenas professores podem criar revisoes por esta funcao.';
  end if;

  select *
  into v_origem
  from public.avaliacoes
  where id = p_avaliacao_origem_id
  limit 1;

  if v_origem.id is null then
    raise exception 'Lancamento de origem nao encontrado.';
  end if;

  if v_origem.professor_id <> auth.uid() then
    raise exception 'O lancamento informado nao pertence ao professor autenticado.';
  end if;

  if v_origem.status <> 'publicado' then
    raise exception 'A revisao incremental so pode partir de um lancamento publicado.';
  end if;

  if not private.can_manage_evaluation_matricula(v_origem.matricula_turma_id) then
    raise exception 'Professor sem permissao para revisar a matricula informada.';
  end if;

  if p_status not in ('rascunho', 'publicado') then
    raise exception 'Status de lancamento invalido.';
  end if;

  if trim(coalesce(p_referencia, '')) = '' then
    raise exception 'A referencia da revisao e obrigatoria.';
  end if;

  if p_modalidade_snapshot is not null
    and p_modalidade_snapshot not in ('descritiva', 'rubrica') then
    raise exception 'Modalidade de avaliacao invalida.';
  end if;

  if p_itens is null
    or jsonb_typeof(p_itens) <> 'array'
    or jsonb_array_length(p_itens) = 0 then
    raise exception 'E necessario informar ao menos um criterio alterado para a revisao.';
  end if;

  select a.id
  into v_latest_published_id
  from public.avaliacoes a
  where (
      a.id = coalesce(v_origem.avaliacao_raiz_id, v_origem.id)
      or a.avaliacao_raiz_id = coalesce(v_origem.avaliacao_raiz_id, v_origem.id)
    )
    and a.status = 'publicado'
  order by a.avaliado_em desc, a.created_at desc, a.id desc
  limit 1;

  if v_latest_published_id is distinct from v_origem.id then
    raise exception 'A revisao incremental deve partir da versao publicada mais recente desta cadeia.';
  end if;

  select a.id
  into v_existing_draft_id
  from public.avaliacoes a
  where a.avaliacao_origem_id = p_avaliacao_origem_id
    and a.professor_id = auth.uid()
    and a.status = 'rascunho'
  order by a.created_at desc
  limit 1;

  if v_existing_draft_id is not null then
    raise exception 'Ja existe um rascunho de revisao para este lancamento.';
  end if;

  insert into public.avaliacoes (
    matricula_turma_id,
    professor_id,
    semestre_id,
    tipo_lancamento,
    referencia,
    observacoes,
    avaliacao_origem_id,
    avaliacao_raiz_id,
    status,
    avaliado_em,
    modelo_avaliacao_curso_id,
    modalidade_snapshot
  )
  values (
    v_origem.matricula_turma_id,
    auth.uid(),
    v_origem.semestre_id,
    'revisao',
    trim(p_referencia),
    nullif(trim(coalesce(p_observacoes, '')), ''),
    v_origem.id,
    coalesce(v_origem.avaliacao_raiz_id, v_origem.id),
    p_status,
    coalesce(p_avaliado_em, now()),
    coalesce(p_modelo_avaliacao_curso_id, v_origem.modelo_avaliacao_curso_id),
    coalesce(p_modalidade_snapshot, v_origem.modalidade_snapshot)
  )
  returning id into v_avaliacao_id;

  for v_item in
    select value
    from jsonb_array_elements(p_itens)
  loop
    v_criterio_id := nullif(v_item ->> 'criterio_id', '')::uuid;
    v_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'opcao_criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_rotulo_snapshot := nullif(trim(coalesce(v_item ->> 'opcao_rotulo_snapshot', '')), '');
    v_opcao_descricao_snapshot :=
      nullif(trim(coalesce(v_item ->> 'opcao_descricao_snapshot', '')), '');
    v_opcao_valor_snapshot := nullif(v_item ->> 'opcao_valor_snapshot', '')::numeric;
    v_nota_bruta := nullif(v_item ->> 'nota_bruta', '')::numeric;
    v_feedback := nullif(trim(coalesce(v_item ->> 'feedback', '')), '');

    if v_nota_bruta is null and v_opcao_valor_snapshot is not null then
      v_nota_bruta := v_opcao_valor_snapshot;
    end if;

    if v_criterio_id is null or v_nota_bruta is null then
      raise exception 'Item revisado invalido.';
    end if;

    select c.peso_percentual
    into v_peso_percentual
    from public.criterios_avaliacao c
    where c.id = v_criterio_id
      and c.ativo = true
    limit 1;

    if v_peso_percentual is null then
      raise exception 'Criterio de avaliacao nao encontrado ou inativo.';
    end if;

    insert into public.itens_avaliados (
      avaliacao_id,
      criterio_id,
      criterio_modelo_avaliacao_id,
      opcao_criterio_modelo_avaliacao_id,
      opcao_rotulo_snapshot,
      opcao_descricao_snapshot,
      opcao_valor_snapshot,
      nota_bruta,
      peso_aplicado_percentual,
      feedback
    )
    values (
      v_avaliacao_id,
      v_criterio_id,
      v_criterio_modelo_avaliacao_id,
      v_opcao_criterio_modelo_avaliacao_id,
      v_opcao_rotulo_snapshot,
      v_opcao_descricao_snapshot,
      v_opcao_valor_snapshot,
      v_nota_bruta,
      v_peso_percentual,
      v_feedback
    );
  end loop;

  if p_status = 'publicado' then
    perform private.consume_active_exceptional_release_for_matricula_type(
      v_origem.matricula_turma_id,
      'avaliacao'
    );
  end if;

  return v_avaliacao_id;
end;
$$;

revoke all on function public.criar_revisao_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) from public;

grant execute on function public.criar_revisao_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) to authenticated;

drop function if exists public.atualizar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  timestamptz
);

drop function if exists public.atualizar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
);

create or replace function public.atualizar_avaliacao_com_itens(
  p_avaliacao_id uuid,
  p_tipo_lancamento text,
  p_referencia text,
  p_observacoes text,
  p_status text,
  p_itens jsonb,
  p_modelo_avaliacao_curso_id uuid default null,
  p_modalidade_snapshot text default null,
  p_avaliado_em timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avaliacao public.avaliacoes%rowtype;
  v_item jsonb;
  v_criterio_id uuid;
  v_criterio_modelo_avaliacao_id uuid;
  v_opcao_criterio_modelo_avaliacao_id uuid;
  v_opcao_rotulo_snapshot text;
  v_opcao_descricao_snapshot text;
  v_opcao_valor_snapshot numeric(5,2);
  v_nota_bruta numeric(5,2);
  v_feedback text;
  v_peso_percentual numeric(5,2);
begin
  if private.current_profile_code() <> 'professor' then
    raise exception 'Apenas professores podem atualizar avaliacoes por esta funcao.';
  end if;

  select *
  into v_avaliacao
  from public.avaliacoes
  where id = p_avaliacao_id
  limit 1;

  if v_avaliacao.id is null then
    raise exception 'Lancamento de avaliacao nao encontrado.';
  end if;

  if v_avaliacao.professor_id <> auth.uid() then
    raise exception 'O lancamento informado nao pertence ao professor autenticado.';
  end if;

  if not private.can_manage_evaluation_matricula(v_avaliacao.matricula_turma_id) then
    raise exception 'Professor sem permissao para atualizar o lancamento informado.';
  end if;

  if v_avaliacao.status <> 'rascunho' then
    raise exception 'Apenas lancamentos em rascunho podem ser alterados.';
  end if;

  if p_tipo_lancamento not in ('parcial', 'revisao', 'fechamento') then
    raise exception 'Tipo de lancamento invalido.';
  end if;

  if v_avaliacao.avaliacao_origem_id is not null and p_tipo_lancamento <> 'revisao' then
    raise exception 'Rascunhos de revisao vinculada devem permanecer com o tipo revisao.';
  end if;

  if p_status not in ('rascunho', 'publicado') then
    raise exception 'Status de lancamento invalido.';
  end if;

  if trim(coalesce(p_referencia, '')) = '' then
    raise exception 'A referencia do lancamento e obrigatoria.';
  end if;

  if p_modalidade_snapshot is not null
    and p_modalidade_snapshot not in ('descritiva', 'rubrica') then
    raise exception 'Modalidade de avaliacao invalida.';
  end if;

  if p_itens is null
    or jsonb_typeof(p_itens) <> 'array'
    or jsonb_array_length(p_itens) = 0 then
    raise exception 'E necessario informar ao menos um criterio avaliado.';
  end if;

  update public.avaliacoes
  set
    tipo_lancamento = p_tipo_lancamento,
    referencia = trim(p_referencia),
    observacoes = nullif(trim(coalesce(p_observacoes, '')), ''),
    status = p_status,
    avaliado_em = coalesce(p_avaliado_em, avaliado_em),
    modelo_avaliacao_curso_id = coalesce(
      p_modelo_avaliacao_curso_id,
      modelo_avaliacao_curso_id
    ),
    modalidade_snapshot = coalesce(
      p_modalidade_snapshot,
      modalidade_snapshot
    )
  where id = p_avaliacao_id;

  delete from public.itens_avaliados
  where avaliacao_id = p_avaliacao_id;

  for v_item in
    select value
    from jsonb_array_elements(p_itens)
  loop
    v_criterio_id := nullif(v_item ->> 'criterio_id', '')::uuid;
    v_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_criterio_modelo_avaliacao_id :=
      nullif(v_item ->> 'opcao_criterio_modelo_avaliacao_id', '')::uuid;
    v_opcao_rotulo_snapshot := nullif(trim(coalesce(v_item ->> 'opcao_rotulo_snapshot', '')), '');
    v_opcao_descricao_snapshot :=
      nullif(trim(coalesce(v_item ->> 'opcao_descricao_snapshot', '')), '');
    v_opcao_valor_snapshot := nullif(v_item ->> 'opcao_valor_snapshot', '')::numeric;
    v_nota_bruta := nullif(v_item ->> 'nota_bruta', '')::numeric;
    v_feedback := nullif(trim(coalesce(v_item ->> 'feedback', '')), '');

    if v_nota_bruta is null and v_opcao_valor_snapshot is not null then
      v_nota_bruta := v_opcao_valor_snapshot;
    end if;

    if v_criterio_id is null or v_nota_bruta is null then
      raise exception 'Item avaliado invalido.';
    end if;

    select c.peso_percentual
    into v_peso_percentual
    from public.criterios_avaliacao c
    where c.id = v_criterio_id
      and c.ativo = true
    limit 1;

    if v_peso_percentual is null then
      raise exception 'Criterio de avaliacao nao encontrado ou inativo.';
    end if;

    insert into public.itens_avaliados (
      avaliacao_id,
      criterio_id,
      criterio_modelo_avaliacao_id,
      opcao_criterio_modelo_avaliacao_id,
      opcao_rotulo_snapshot,
      opcao_descricao_snapshot,
      opcao_valor_snapshot,
      nota_bruta,
      peso_aplicado_percentual,
      feedback
    )
    values (
      p_avaliacao_id,
      v_criterio_id,
      v_criterio_modelo_avaliacao_id,
      v_opcao_criterio_modelo_avaliacao_id,
      v_opcao_rotulo_snapshot,
      v_opcao_descricao_snapshot,
      v_opcao_valor_snapshot,
      v_nota_bruta,
      v_peso_percentual,
      v_feedback
    );
  end loop;

  if p_status = 'publicado' then
    perform private.consume_active_exceptional_release_for_matricula_type(
      v_avaliacao.matricula_turma_id,
      'avaliacao'
    );
  end if;

  return p_avaliacao_id;
end;
$$;

revoke all on function public.atualizar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) from public;

grant execute on function public.atualizar_avaliacao_com_itens(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid,
  text,
  timestamptz
) to authenticated;

commit;
