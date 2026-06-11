-- Script 3 - configuracoes da Fisioterapia legada
--
-- Objetivo:
-- 1. Criar/reutilizar o modelo de avaliacao configuravel da Fisioterapia.
-- 2. Clonar grupos e criterios legados para o novo modelo.
-- 3. Criar/reutilizar tipos documentais iniciais.
-- 4. Criar/reutilizar documentos obrigatorios da Fisioterapia.
-- 5. Fazer backfill de avaliacoes.modelo_avaliacao_curso_id quando houver vinculo seguro.
-- 6. Fazer backfill de documentos_aluno.documento_obrigatorio_curso_id quando houver vinculo seguro.
--
-- Observacoes:
-- - Script idempotente.
-- - Nao altera RLS/policies.
-- - Nao altera UI nem services.
-- - Nao remove campos legados.
-- - Nao endurece constraints.
-- - Nao mexe na clinica supervisionada.
--
-- Nota sobre pesos:
-- O legado ja possui peso_percentual explicito em grupos_avaliacao e criterios_avaliacao,
-- entao este script preserva exatamente esses valores, sem regra de redistribuicao.

begin;

do $$
declare
  v_instituicao_id uuid;
  v_curso_id uuid;
  v_modelo_id uuid;
  v_tipo_documento_carteira_id uuid;
  v_tipo_documento_tce_id uuid;
begin
  select i.id
  into v_instituicao_id
  from public.instituicoes i
  where i.slug = 'unip'
  limit 1;

  if v_instituicao_id is null then
    raise exception 'Instituicao UNIP nao encontrada. Execute o Script 2 antes do Script 3.';
  end if;

  select c.id
  into v_curso_id
  from public.cursos c
  where c.instituicao_id = v_instituicao_id
    and c.codigo = 'FISIO'
  limit 1;

  if v_curso_id is null then
    raise exception 'Curso FISIO nao encontrado na instituicao UNIP. Execute o Script 2 antes do Script 3.';
  end if;

  insert into public.modelos_avaliacao_curso (
    curso_id,
    codigo,
    nome,
    descricao,
    versao,
    ativo,
    metadata
  )
  values (
    v_curso_id,
    'AVALIACAO_ESTAGIO_FISIO',
    'Avaliacao de Estagio - Fisioterapia',
    'Modelo legado migrado a partir da configuracao atual de grupos e criterios da Fisioterapia.',
    1,
    true,
    jsonb_build_object(
      'origem', 'script-3-configuracoes-fisioterapia-legada',
      'base_legada', true
    )
  )
  on conflict (curso_id, codigo, versao) do update
  set
    nome = excluded.nome,
    descricao = excluded.descricao,
    ativo = excluded.ativo,
    metadata = excluded.metadata
  returning id into v_modelo_id;

  if v_modelo_id is null then
    select mac.id
    into v_modelo_id
    from public.modelos_avaliacao_curso mac
    where mac.curso_id = v_curso_id
      and mac.codigo = 'AVALIACAO_ESTAGIO_FISIO'
      and mac.versao = 1
    limit 1;
  end if;

  insert into public.grupos_modelo_avaliacao (
    modelo_avaliacao_curso_id,
    codigo,
    nome,
    ordem,
    peso_percentual,
    ativo,
    metadata
  )
  select
    v_modelo_id,
    g.codigo,
    g.nome,
    g.ordem,
    g.peso_percentual,
    g.ativo,
    jsonb_build_object(
      'grupo_legado_id', g.id,
      'grupo_legado_codigo', g.codigo
    )
  from public.grupos_avaliacao g
  on conflict (modelo_avaliacao_curso_id, codigo) do update
  set
    nome = excluded.nome,
    ordem = excluded.ordem,
    peso_percentual = excluded.peso_percentual,
    ativo = excluded.ativo,
    metadata = excluded.metadata;

  insert into public.criterios_modelo_avaliacao (
    grupo_modelo_avaliacao_id,
    codigo,
    nome,
    descricao,
    ordem,
    peso_percentual,
    escala_maxima,
    ativo,
    metadata
  )
  select
    gma.id,
    ca.codigo,
    ca.nome,
    ca.descricao,
    ca.ordem,
    ca.peso_percentual,
    ca.escala_maxima,
    ca.ativo,
    jsonb_build_object(
      'criterio_legado_id', ca.id,
      'criterio_legado_codigo', ca.codigo
    )
  from public.criterios_avaliacao ca
  join public.grupos_avaliacao ga
    on ga.id = ca.grupo_id
  join public.grupos_modelo_avaliacao gma
    on gma.modelo_avaliacao_curso_id = v_modelo_id
   and gma.codigo = ga.codigo
  on conflict (grupo_modelo_avaliacao_id, codigo) do update
  set
    nome = excluded.nome,
    descricao = excluded.descricao,
    ordem = excluded.ordem,
    peso_percentual = excluded.peso_percentual,
    escala_maxima = excluded.escala_maxima,
    ativo = excluded.ativo,
    metadata = excluded.metadata;

  insert into public.tipos_documento (
    codigo,
    nome,
    descricao,
    ativo,
    metadata
  )
  values
    (
      'CARTEIRA_VACINACAO',
      'Carteira de vacinacao',
      'Documento legada obrigatorio para validacao inicial de saude do aluno.',
      true,
      jsonb_build_object('origem', 'script-3-configuracoes-fisioterapia-legada')
    ),
    (
      'TCE',
      'Termo de Compromisso de Estagio',
      'Documento legada vinculado ao contexto operacional de estagio.',
      true,
      jsonb_build_object('origem', 'script-3-configuracoes-fisioterapia-legada')
    )
  on conflict (codigo) do update
  set
    nome = excluded.nome,
    descricao = excluded.descricao,
    ativo = excluded.ativo,
    metadata = excluded.metadata;

  select td.id
  into v_tipo_documento_carteira_id
  from public.tipos_documento td
  where td.codigo = 'CARTEIRA_VACINACAO'
  limit 1;

  select td.id
  into v_tipo_documento_tce_id
  from public.tipos_documento td
  where td.codigo = 'TCE'
  limit 1;

  insert into public.documentos_obrigatorios_curso (
    curso_id,
    tipo_documento_id,
    codigo,
    nome_exibicao,
    descricao,
    obrigatorio,
    ordem,
    ativo,
    metadata
  )
  values
    (
      v_curso_id,
      v_tipo_documento_carteira_id,
      'CARTEIRA_VACINACAO_FISIO',
      'Carteira de vacinacao',
      'Documento obrigatorio da Fisioterapia para validacao inicial.',
      true,
      1,
      true,
      jsonb_build_object(
        'origem', 'script-3-configuracoes-fisioterapia-legada',
        'codigo_tipo_documento', 'CARTEIRA_VACINACAO'
      )
    ),
    (
      v_curso_id,
      v_tipo_documento_tce_id,
      'TCE_FISIO',
      'Termo de Compromisso de Estagio',
      'Documento obrigatorio da Fisioterapia para o contexto de estagio.',
      true,
      2,
      true,
      jsonb_build_object(
        'origem', 'script-3-configuracoes-fisioterapia-legada',
        'codigo_tipo_documento', 'TCE'
      )
    )
  on conflict (curso_id, tipo_documento_id) do update
  set
    codigo = excluded.codigo,
    nome_exibicao = excluded.nome_exibicao,
    descricao = excluded.descricao,
    obrigatorio = excluded.obrigatorio,
    ordem = excluded.ordem,
    ativo = excluded.ativo,
    metadata = excluded.metadata;

  update public.avaliacoes av
  set modelo_avaliacao_curso_id = v_modelo_id
  from public.ofertas_curso_unidade o
  where av.modelo_avaliacao_curso_id is null
    and av.oferta_curso_unidade_id = o.id
    and o.curso_id = v_curso_id;

  update public.documentos_aluno da
  set documento_obrigatorio_curso_id = target.doc_obrigatorio_id
  from (
    select
      da_inner.id as documento_id,
      doc.id as doc_obrigatorio_id
    from public.documentos_aluno da_inner
    left join public.matriculas_turma mt
      on mt.id = da_inner.matricula_turma_id
    left join public.alunos a
      on a.usuario_id = da_inner.aluno_id
    join public.ofertas_curso_unidade o
      on o.id = coalesce(
        da_inner.oferta_curso_unidade_id,
        mt.oferta_curso_unidade_id,
        a.oferta_curso_unidade_id
      )
    join public.documentos_obrigatorios_curso doc
      on doc.curso_id = o.curso_id
    join public.tipos_documento td
      on td.id = doc.tipo_documento_id
    where o.curso_id = v_curso_id
      and (
        (da_inner.tipo = 'carteira_vacinacao' and td.codigo = 'CARTEIRA_VACINACAO')
        or
        (da_inner.tipo = 'tce' and td.codigo = 'TCE')
      )
  ) target
  where da.id = target.documento_id
    and da.documento_obrigatorio_curso_id is null;
end;
$$;

commit;

-- Consultas de verificacao manual
-- select count(*) as total_modelos_fisio
-- from public.modelos_avaliacao_curso mac
-- join public.cursos c on c.id = mac.curso_id
-- where c.codigo = 'FISIO';
--
-- select count(*) as total_grupos_clonados
-- from public.grupos_modelo_avaliacao gma
-- join public.modelos_avaliacao_curso mac on mac.id = gma.modelo_avaliacao_curso_id
-- where mac.codigo = 'AVALIACAO_ESTAGIO_FISIO' and mac.versao = 1;
--
-- select count(*) as total_criterios_clonados
-- from public.criterios_modelo_avaliacao cma
-- join public.grupos_modelo_avaliacao gma on gma.id = cma.grupo_modelo_avaliacao_id
-- join public.modelos_avaliacao_curso mac on mac.id = gma.modelo_avaliacao_curso_id
-- where mac.codigo = 'AVALIACAO_ESTAGIO_FISIO' and mac.versao = 1;
--
-- select count(*) as total_tipos_documento
-- from public.tipos_documento;
--
-- select count(*) as total_documentos_obrigatorios_fisio
-- from public.documentos_obrigatorios_curso doc
-- join public.cursos c on c.id = doc.curso_id
-- where c.codigo = 'FISIO';
--
-- select count(*) as avaliacoes_sem_modelo
-- from public.avaliacoes
-- where modelo_avaliacao_curso_id is null;
--
-- select count(*) as documentos_sem_documento_obrigatorio
-- from public.documentos_aluno
-- where documento_obrigatorio_curso_id is null;
--
-- select
--   c.nome as curso,
--   td.codigo as tipo_documento,
--   doc.nome_exibicao,
--   doc.obrigatorio,
--   doc.ordem,
--   doc.ativo
-- from public.documentos_obrigatorios_curso doc
-- join public.cursos c on c.id = doc.curso_id
-- join public.tipos_documento td on td.id = doc.tipo_documento_id
-- where c.codigo = 'FISIO'
-- order by doc.ordem nulls last, td.codigo;
--
-- select
--   mac.nome as modelo,
--   gma.ordem as grupo_ordem,
--   gma.nome as grupo,
--   cma.ordem as criterio_ordem,
--   cma.nome as criterio,
--   cma.peso_percentual
-- from public.criterios_modelo_avaliacao cma
-- join public.grupos_modelo_avaliacao gma on gma.id = cma.grupo_modelo_avaliacao_id
-- join public.modelos_avaliacao_curso mac on mac.id = gma.modelo_avaliacao_curso_id
-- where mac.codigo = 'AVALIACAO_ESTAGIO_FISIO'
--   and mac.versao = 1
-- order by gma.ordem, cma.ordem;
```
