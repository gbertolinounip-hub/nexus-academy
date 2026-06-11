-- Checks de validacao da arquitetura multi-institucional e multicurso.
-- Apenas leitura. Nao altera dados.

-- 1. Instituicoes e cursos base
select count(*) as total_instituicoes
from public.instituicoes;

select id, nome, sigla, slug, ativo
from public.instituicoes
order by nome;

select count(*) as total_cursos
from public.cursos;

select
  i.slug as instituicao_slug,
  c.codigo,
  c.nome,
  c.slug,
  c.ativo
from public.cursos c
join public.instituicoes i on i.id = c.instituicao_id
order by i.nome, c.nome;

select
  count(*) as total_unip_fisio
from public.cursos c
join public.instituicoes i on i.id = c.instituicao_id
where i.slug = 'unip'
  and c.codigo = 'FISIO';

-- 2. Ofertas por unidade
select count(*) as total_ofertas_curso_unidade
from public.ofertas_curso_unidade;

select
  i.nome as instituicao,
  c.nome as curso,
  u.nome as unidade,
  ocu.nome_exibicao as oferta,
  ocu.ativo
from public.ofertas_curso_unidade ocu
join public.instituicoes i on i.id = ocu.instituicao_id
join public.cursos c on c.id = ocu.curso_id
join public.unidades u on u.id = ocu.unidade_id
order by i.nome, c.nome, u.nome;

select count(*) as unidades_sem_instituicao
from public.unidades
where instituicao_id is null;

-- 3. Integridade academica da migracao
select count(*) as semestres_sem_oferta
from public.semestres
where oferta_curso_unidade_id is null;

select count(*) as turmas_sem_oferta
from public.turmas
where oferta_curso_unidade_id is null;

select count(*) as alunos_sem_oferta
from public.alunos
where oferta_curso_unidade_id is null;

select count(*) as alunos_sem_curso_id
from public.alunos
where curso_id is null;

select count(*) as avaliacoes_sem_modelo
from public.avaliacoes
where modelo_avaliacao_curso_id is null;

select count(*) as documentos_sem_documento_obrigatorio
from public.documentos_aluno
where documento_obrigatorio_curso_id is null;

-- 4. Configuracoes por curso
select
  i.slug as instituicao_slug,
  c.codigo as curso_codigo,
  mac.codigo as modelo_codigo,
  mac.nome as modelo_nome,
  mac.versao,
  mac.ativo
from public.modelos_avaliacao_curso mac
join public.cursos c on c.id = mac.curso_id
join public.instituicoes i on i.id = c.instituicao_id
order by i.slug, c.codigo, mac.versao;

select
  c.codigo as curso_codigo,
  td.codigo as tipo_documento_codigo,
  doc.nome_exibicao,
  doc.obrigatorio,
  doc.ordem,
  doc.ativo
from public.documentos_obrigatorios_curso doc
join public.cursos c on c.id = doc.curso_id
join public.tipos_documento td on td.id = doc.tipo_documento_id
order by c.codigo, doc.ordem nulls last, td.codigo;

-- 5. Perfis e contextos
select id, codigo, nome, descricao
from public.perfis
where codigo in ('coordenador_master', 'master_curso')
order by codigo;

select
  count(*) as total_contextos
from public.usuarios_papeis_contexto;

select
  count(distinct usuario_id) as usuarios_com_contexto
from public.usuarios_papeis_contexto;

select
  count(*) as usuarios_com_contexto_padrao
from public.usuarios
where contexto_padrao_id is not null;

select
  u.id as usuario_id,
  u.nome_completo,
  u.email,
  count(*) as total_contextos_ativos
from public.usuarios_papeis_contexto upc
join public.usuarios u on u.id = upc.usuario_id
where upc.ativo = true
group by u.id, u.nome_completo, u.email
having count(*) > 1
order by total_contextos_ativos desc, u.nome_completo;

select
  u.id as usuario_id,
  u.nome_completo,
  u.email,
  p.codigo as perfil_contexto,
  i.nome as instituicao,
  c.nome as curso,
  ocu.nome_exibicao as oferta,
  upc.principal,
  upc.ativo
from public.usuarios_papeis_contexto upc
join public.usuarios u on u.id = upc.usuario_id
join public.perfis p on p.id = upc.perfil_id
left join public.instituicoes i on i.id = upc.instituicao_id
left join public.cursos c on c.id = upc.curso_id
left join public.ofertas_curso_unidade ocu on ocu.id = upc.oferta_curso_unidade_id
where p.codigo = 'master_curso'
order by u.nome_completo, c.nome;

select
  u.id as usuario_id,
  u.nome_completo,
  u.email,
  p.codigo as perfil_legado,
  un.nome as unidade_legada
from public.usuarios u
join public.perfis p on p.id = u.perfil_id
left join public.unidades un on un.id = u.unidade_id
left join public.usuarios_papeis_contexto upc on upc.usuario_id = u.id
where u.ativo = true
group by u.id, u.nome_completo, u.email, p.codigo, un.nome
having count(upc.id) = 0
order by u.nome_completo;

select
  u.id as usuario_id,
  u.nome_completo,
  u.email,
  count(*) as total_contextos_ativos
from public.usuarios_papeis_contexto upc
join public.usuarios u on u.id = upc.usuario_id
where upc.ativo = true
  and u.contexto_padrao_id is null
group by u.id, u.nome_completo, u.email
having count(*) > 1
order by total_contextos_ativos desc, u.nome_completo;

-- 6. Recorte da Fisioterapia migrada
select
  i.nome as instituicao,
  c.nome as curso,
  count(distinct ocu.id) as total_ofertas,
  count(distinct s.id) as total_semestres,
  count(distinct t.id) as total_turmas,
  count(distinct a.usuario_id) as total_alunos
from public.cursos c
join public.instituicoes i on i.id = c.instituicao_id
left join public.ofertas_curso_unidade ocu on ocu.curso_id = c.id
left join public.semestres s on s.oferta_curso_unidade_id = ocu.id
left join public.turmas t on t.oferta_curso_unidade_id = ocu.id
left join public.alunos a on a.oferta_curso_unidade_id = ocu.id
where i.slug = 'unip'
  and c.codigo = 'FISIO'
group by i.nome, c.nome;

-- 7. Distincao entre coordenador_master e master_curso
select
  cm.id as coordenador_master_id,
  cm.codigo as coordenador_master_codigo,
  mc.id as master_curso_id,
  mc.codigo as master_curso_codigo,
  (cm.id <> mc.id) as perfis_distintos
from public.perfis cm
cross join public.perfis mc
where cm.codigo = 'coordenador_master'
  and mc.codigo = 'master_curso';
