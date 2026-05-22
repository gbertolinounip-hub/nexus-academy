insert into public.perfis (codigo, nome, descricao)
values
  ('aluno', 'Aluno', 'Visualiza apenas os proprios dados academicos.'),
  ('professor', 'Professor', 'Lanca avaliacoes e ausencias dos alunos vinculados.'),
  ('coordenador', 'Coordenador', 'Visualiza todos os dados, audita lancamentos e gerencia a estrutura.'),
  ('coordenador_master', 'Coordenador master', 'Mantem a governanca institucional e a estrutura multiunidade da plataforma.')
on conflict (codigo) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao;

insert into public.semestres (unidade_id, codigo, nome, data_inicio, data_fim, status)
values
  (public.default_unidade_id(), '2026/1', '1o Semestre de 2026', '2026-01-15', '2026-06-30', 'planejado'),
  (public.default_unidade_id(), '2026/2', '2o Semestre de 2026', '2026-07-15', '2026-12-20', 'planejado'),
  (public.default_unidade_id(), '2027/1', '1o Semestre de 2027', '2027-01-15', '2027-06-30', 'planejado'),
  (public.default_unidade_id(), '2027/2', '2o Semestre de 2027', '2027-07-15', '2027-12-20', 'planejado'),
  (public.default_unidade_id(), '2028/1', '1o Semestre de 2028', '2028-01-15', '2028-06-30', 'planejado'),
  (public.default_unidade_id(), '2028/2', '2o Semestre de 2028', '2028-07-15', '2028-12-20', 'planejado')
on conflict (unidade_id, codigo) do nothing;

insert into public.blocos_estagio (codigo, nome, ordem)
values
  ('bloco_1', 'Bloco 1', 1),
  ('bloco_2', 'Bloco 2', 2)
on conflict (codigo) do update
set
  nome = excluded.nome,
  ordem = excluded.ordem;

insert into public.areas_estagio (bloco_id, codigo, nome, ordem)
select b.id, v.codigo, v.nome, v.ordem
from (
  values
    ('bloco_1', 'ortopedia_traumatologia', 'Ortopedia e Traumatologia', 1),
    ('bloco_1', 'gerontologia', 'Gerontologia', 2),
    ('bloco_1', 'saude_publica', 'Saude Publica', 3),
    ('bloco_2', 'neurologia', 'Neurologia', 1),
    ('bloco_2', 'pediatria', 'Pediatria', 2),
    ('bloco_2', 'hospital', 'Hospital', 3),
    ('bloco_2', 'saude_mulher', 'Saude da Mulher', 4)
) as v(bloco_codigo, codigo, nome, ordem)
join public.blocos_estagio b
  on b.codigo = v.bloco_codigo
on conflict (codigo) do update
set
  bloco_id = excluded.bloco_id,
  nome = excluded.nome,
  ordem = excluded.ordem;

update public.turmas t
set area_estagio_id = a.id
from public.areas_estagio a
where t.area_estagio_id is null
  and lower(trim(t.area_estagio)) = lower(trim(a.nome));

insert into public.grupos_avaliacao (codigo, nome, ordem, peso_percentual)
values
  ('tomada_decisoes', 'Tomada de Decisoes', 1, 10.00),
  ('atencao_saude', 'Atencao a Saude', 2, 10.00),
  ('comunicacao', 'Comunicacao', 3, 5.00),
  ('lideranca', 'Lideranca', 4, 5.00),
  ('educacao_permanente', 'Educacao Permanente', 5, 70.00)
on conflict (codigo) do update
set
  nome = excluded.nome,
  ordem = excluded.ordem,
  peso_percentual = excluded.peso_percentual;

insert into public.criterios_avaliacao (grupo_id, codigo, nome, descricao, ordem, peso_percentual)
select g.id, v.codigo, v.nome, v.descricao, v.ordem, v.peso_percentual
from (
  values
    ('tomada_decisoes', 'objetivos_terapeuticos', 'Estabelece objetivos terapeuticos', 'Capacidade de definir objetivos terapeuticos adequados ao caso.', 1, 3.00),
    ('tomada_decisoes', 'tecnicas_adequadas', 'Indica as tecnicas terapeuticas adequadas', 'Escolha coerente das tecnicas terapeuticas.', 2, 3.00),
    ('tomada_decisoes', 'justificativa_cientifica', 'Justifica cientifica e racionalmente o emprego das tecnicas', 'Racionalidade clinica e fundamentacao cientifica.', 3, 3.00),
    ('tomada_decisoes', 'iniciativa', 'Apresenta iniciativa', 'Postura proativa no estagio.', 4, 1.00),
    ('atencao_saude', 'manuseio_equipamentos', 'Manuseio durante atendimentos, avaliacoes, uso de equipamentos e interpretacao dos exames complementares', 'Seguranca e qualidade tecnica durante o atendimento.', 1, 5.00),
    ('atencao_saude', 'etica_bioetica', 'Etica/Bioetica', 'Conduta etica em relacao ao paciente e a equipe.', 2, 1.00),
    ('atencao_saude', 'tempo_avaliacao', 'Usa tempo adequado para a avaliacao do paciente', 'Eficiencia e organizacao do tempo clinico.', 3, 1.00),
    ('atencao_saude', 'diagnostico_cineticofuncional', 'Chega a diagnostico cineticofuncional adequadamente', 'Raciocinio diagnostico adequado.', 4, 3.00),
    ('comunicacao', 'escrita_clinica', 'Apresenta habilidades de escrita (avaliacao e evolucao dos pacientes / trabalhos academicos)', 'Clareza e qualidade da documentacao clinica e academica.', 1, 4.00),
    ('comunicacao', 'esclarecimento_tratamento', 'Esclarece o processo de tratamento ao doente e/ou familiares', 'Comunicacao clara com paciente e familiares.', 2, 1.00),
    ('lideranca', 'trabalho_equipe', 'Trabalha bem em equipe (relacionamento interpessoal, respeito a hierarquia e organizacao do setor)', 'Atuacao colaborativa com o setor.', 1, 4.00),
    ('lideranca', 'compromisso_profissional', 'Compromisso com a profissao, pacientes, colegas, IES e clinica-escola', 'Responsabilidade profissional e institucional.', 2, 1.00),
    ('educacao_permanente', 'trabalhos_seminarios', 'Prepara e apresenta os trabalhos e seminarios adequadamente', 'Qualidade de trabalhos e seminarios.', 1, 10.00),
    ('educacao_permanente', 'provas_teoricas', 'Nota(s) da(s) prova(s) teorica(s)', 'Desempenho em avaliacoes teoricas.', 2, 30.00),
    ('educacao_permanente', 'atividade_pratica', 'Nota da atividade pratica de atendimento', 'Desempenho pratico no atendimento.', 3, 30.00)
) as v(grupo_codigo, codigo, nome, descricao, ordem, peso_percentual)
join public.grupos_avaliacao g
  on g.codigo = v.grupo_codigo
on conflict (codigo) do update
set
  nome = excluded.nome,
  descricao = excluded.descricao,
  ordem = excluded.ordem,
  peso_percentual = excluded.peso_percentual,
  grupo_id = excluded.grupo_id;
