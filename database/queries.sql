-- 1. Dashboard do aluno: nota atual por critério, grupo e total.
with latest_item_per_criterion as (
  select distinct on (ia.criterio_id)
    a.matricula_turma_id,
    ia.criterio_id,
    ia.nota_bruta,
    ia.nota_ponderada_percentual,
    a.avaliado_em
  from public.itens_avaliados ia
  join public.avaliacoes a on a.id = ia.avaliacao_id
  where a.matricula_turma_id = :matricula_turma_id
    and a.status = 'publicado'
  order by ia.criterio_id, a.avaliado_em desc, ia.created_at desc
),
ausencias_resumo as (
  select coalesce(sum(horas), 0) as horas_nao_justificadas
  from public.ausencias
  where matricula_turma_id = :matricula_turma_id
    and justificada = false
)
select
  g.nome as grupo,
  c.nome as criterio,
  c.peso_percentual,
  li.nota_bruta,
  li.nota_ponderada_percentual,
  ar.horas_nao_justificadas
from public.criterios_avaliacao c
join public.grupos_avaliacao g on g.id = c.grupo_id
left join latest_item_per_criterion li on li.criterio_id = c.id
cross join ausencias_resumo ar
where c.ativo = true
order by g.ordem, c.ordem;

-- 2. Painel do professor: alunos vinculados e média atual.
with latest_items as (
  select distinct on (a.matricula_turma_id, ia.criterio_id)
    a.matricula_turma_id,
    ia.criterio_id,
    ia.nota_ponderada_percentual
  from public.itens_avaliados ia
  join public.avaliacoes a on a.id = ia.avaliacao_id
  where a.status = 'publicado'
  order by a.matricula_turma_id, ia.criterio_id, a.avaliado_em desc, ia.created_at desc
),
ausencias as (
  select
    matricula_turma_id,
    coalesce(sum(horas) filter (where justificada = false), 0) as penalidade_percentual
  from public.ausencias
  group by matricula_turma_id
)
select
  mt.id as matricula_turma_id,
  u.nome_completo as aluno,
  a.matricula,
  t.nome as turma,
  round(coalesce(sum(li.nota_ponderada_percentual), 0), 2) as subtotal_percentual,
  round(coalesce(au.penalidade_percentual, 0), 2) as penalidade_percentual,
  round(greatest(coalesce(sum(li.nota_ponderada_percentual), 0) - coalesce(au.penalidade_percentual, 0), 0), 2) as total_percentual
from public.vinculos_professor_aluno v
join public.matriculas_turma mt on mt.id = v.matricula_turma_id
join public.alunos a on a.usuario_id = mt.aluno_id
join public.usuarios u on u.id = a.usuario_id
join public.turmas t on t.id = mt.turma_id
left join latest_items li on li.matricula_turma_id = mt.id
left join ausencias au on au.matricula_turma_id = mt.id
where v.professor_id = :professor_id
  and v.ativo = true
group by mt.id, u.nome_completo, a.matricula, t.nome, au.penalidade_percentual
order by u.nome_completo;

-- 3. Auditoria: histórico de lançamentos.
select
  h.id,
  h.tabela,
  h.registro_id,
  h.acao,
  h.usuario_id,
  u.nome_completo as usuario,
  h.created_at,
  h.dados_antes,
  h.dados_depois
from public.historico_alteracoes h
left join public.usuarios u on u.id = h.usuario_id
where h.tabela in ('avaliacoes', 'itens_avaliados', 'ausencias', 'vinculos_professor_aluno')
order by h.created_at desc
limit 200;
