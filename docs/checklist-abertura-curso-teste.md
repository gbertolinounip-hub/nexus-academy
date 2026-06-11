# Checklist de Abertura de Curso Teste

Este checklist valida ponta a ponta a abertura de um curso teste na arquitetura multi-institucional e multicurso do Nexus Academy antes de avancarmos para importacao em massa, liberacao para Gestor do curso (`master_curso`), RLS/policies ou novos fluxos academicos.

Curso teste sugerido:

- Instituicao: `UNIP`
- Codigo: `ENF`
- Nome: `Enfermagem`
- Slug: `enfermagem`
- Unidade/oferta: usar uma unidade existente, como `Ribeirao Preto`, se estiver disponivel no ambiente

## 1. Preparacao

- [ ] Confirmar login com perfil `coordenador_master`.
- [ ] Confirmar que as etapas anteriores da arquitetura multicurso foram concluidas.
- [ ] Confirmar que o app local esta iniciado com `npm.cmd run dev`.
- [ ] Confirmar que [docs/homologacao-multi-institucional-multicurso.md](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/docs/homologacao-multi-institucional-multicurso.md) esta disponivel como referencia.
- [ ] Confirmar que [docs/guia-abertura-novo-curso.md](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/docs/guia-abertura-novo-curso.md) esta disponivel como guia operacional.
- [ ] Confirmar que [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql) esta disponivel para execucao no SQL Editor.
- [ ] Abrir `/master/contextos` e confirmar ausencia de inconsistencias criticas novas.
- [ ] Confirmar que `UNIP / FISIO` segue estruturado e configurado corretamente.

## 2. Criar curso

Validar em `/master/cursos`:

- [ ] Criar o curso `ENF / Enfermagem`.
- [ ] Confirmar que o curso foi criado dentro da `UNIP`.
- [ ] Confirmar que `slug = enfermagem`.
- [ ] Confirmar que o curso ficou ativo.
- [ ] Tentar recriar o mesmo curso e confirmar bloqueio de duplicidade por codigo e/ou slug.

## 3. Criar oferta

Validar em `/master/cursos`:

- [ ] Criar uma oferta de `Enfermagem` para uma unidade existente.
- [ ] Se `Ribeirao Preto` existir, usar essa unidade no teste.
- [ ] Confirmar que a oferta ficou ativa.
- [ ] Confirmar que a unidade pertence a `UNIP`.
- [ ] Tentar recriar a mesma oferta na mesma unidade e confirmar bloqueio de duplicidade.

## 4. Configurar curso

Validar em `/master/cursos/configuracoes`:

- [ ] Confirmar que `Enfermagem` aparece inicialmente como `Sem configuracao` ou `Parcial`.
- [ ] Copiar a configuracao-base da Fisioterapia para `ENF`.
- [ ] Confirmar que o curso passa a ter modelo de avaliacao.
- [ ] Confirmar que grupos e criterios foram copiados.
- [ ] Confirmar que documentos obrigatorios foram copiados.
- [ ] Editar nome, descricao, pesos ou documentos se necessario para o teste.
- [ ] Conferir o diagnostico visual de pesos dos grupos.
- [ ] Conferir o diagnostico visual de pesos dos criterios.
- [ ] Tentar copiar novamente a configuracao-base e confirmar bloqueio de duplicidade.

## 5. Criar semestre

Validar em `/master/semestres`:

- [ ] Criar um semestre para a oferta de `Enfermagem`.
- [ ] Confirmar que `semestres.oferta_curso_unidade_id` foi preenchido.
- [ ] Confirmar que `semestres.unidade_id` continua preenchido por compatibilidade.
- [ ] Confirmar que o semestre aparece na listagem master com instituicao, unidade, curso e oferta.

## 6. Criar turma

Validar em `/master/turmas`:

- [ ] Criar uma turma para o semestre de `Enfermagem`.
- [ ] Confirmar que `turmas.semestre_id` foi preenchido.
- [ ] Confirmar que `turmas.oferta_curso_unidade_id` foi preenchido com a oferta do semestre.
- [ ] Confirmar que a turma aparece na listagem master com instituicao, unidade, curso, oferta e semestre.
- [ ] Tentar duplicar a turma no mesmo semestre e confirmar bloqueio.

## 7. Vincular aluno

Validar em `/master/matriculas`:

- [ ] Selecionar instituicao, curso, oferta, semestre e turma de `Enfermagem`.
- [ ] Vincular um aluno existente.
- [ ] Confirmar que `matriculas_turma.turma_id` foi preenchido.
- [ ] Confirmar que `matriculas_turma.oferta_curso_unidade_id` foi preenchido.
- [ ] Confirmar que `alunos.curso_id` e `alunos.oferta_curso_unidade_id` ficaram coerentes quando o preenchimento era seguro.
- [ ] Tentar duplicar a mesma matricula na mesma turma e confirmar bloqueio.

## 8. Checks SQL

Rodar [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql) e conferir:

- [ ] `semestres_sem_oferta`
- [ ] `turmas_sem_oferta`
- [ ] `alunos_sem_oferta`
- [ ] `avaliacoes_sem_modelo`
- [ ] `documentos_sem_documento_obrigatorio`
- [ ] usuarios com contexto
- [ ] usuarios com multiplos contextos

Consulta manual sugerida para o recorte do curso teste `ENF`:

```sql
select
  i.nome as instituicao,
  c.nome as curso,
  count(distinct ocu.id) as total_ofertas,
  count(distinct s.id) as total_semestres,
  count(distinct t.id) as total_turmas,
  count(distinct a.usuario_id) as total_alunos,
  count(distinct mt.id) as total_matriculas
from public.cursos c
join public.instituicoes i
  on i.id = c.instituicao_id
left join public.ofertas_curso_unidade ocu
  on ocu.curso_id = c.id
left join public.semestres s
  on s.oferta_curso_unidade_id = ocu.id
left join public.turmas t
  on t.oferta_curso_unidade_id = ocu.id
left join public.alunos a
  on a.oferta_curso_unidade_id = ocu.id
left join public.matriculas_turma mt
  on mt.oferta_curso_unidade_id = ocu.id
where i.slug = 'unip'
  and c.codigo = 'ENF'
group by i.nome, c.nome;
```

## 9. Regressao Fisioterapia

Validar que continuam funcionando:

- [ ] fluxo do aluno
- [ ] fluxo do professor
- [ ] fluxo do coordenador
- [ ] fluxo da secretaria
- [ ] lancamentos de avaliacao
- [ ] lancamentos de ausencia
- [ ] documentos
- [ ] liberacoes excepcionais
- [ ] clinica supervisionada, se aplicavel ao ambiente

## 10. Criterios de aprovacao

O teste esta aprovado quando:

- [ ] curso criado com sucesso
- [ ] oferta criada com sucesso
- [ ] configuracao academica copiada e revisada
- [ ] semestre criado com `oferta_curso_unidade_id`
- [ ] turma criada com `semestre_id` e `oferta_curso_unidade_id`
- [ ] matricula criada com coerencia entre aluno, turma e oferta
- [ ] duplicidades foram bloqueadas nas telas testadas
- [ ] os checks SQL nao apontaram inconsistencias criticas novas
- [ ] a Fisioterapia permaneceu operacional

## 11. Pendencias que ainda ficam para depois

Mesmo com o teste aprovado, ainda ficam para fases futuras:

- importacao em massa por curso/oferta
- liberacao operacional progressiva para Gestor do curso (`master_curso`)
- RLS/policies compativeis com a arquitetura multicurso
- fluxos academicos adicionais por curso
- revisoes mais profundas de documentos, criterios e modelos especificos

## 12. Sequencia recomendada apos este teste

Se o curso teste `ENF` passar neste checklist, a sequencia mais segura e:

1. registrar qualquer ajuste fino encontrado no teste
2. repetir o fluxo para mais um curso piloto, se desejado
3. planejar a etapa de importacao em massa por curso/oferta
4. so depois avancar para RLS/policies e liberacoes administrativas mais amplas
