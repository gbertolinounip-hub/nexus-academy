# Homologacao Multi-institucional e Multicurso

Este checklist valida a migracao inicial da arquitetura multi-institucional e multicurso do Nexus Academy antes de avancarmos para RLS/policies, CRUDs institucionais e abertura de novos cursos.

## Pre-requisitos

- [ ] Scripts SQL 1 a 6 aplicados com sucesso.
- [ ] Aplicacao atualizada com as etapas 7 a 10.
- [ ] Usuario com contexto de Gestor do curso (`master_curso`) configurado para `UNIP / FISIO`.
- [ ] Ambiente local iniciado com `npm.cmd run dev`.
- [ ] Arquivo [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql) disponivel para execucao no SQL Editor.

## 1. Banco

- [ ] Existe uma instituicao com `slug = 'unip'`.
- [ ] Existe um curso `codigo = 'FISIO'` dentro da `UNIP`.
- [ ] Existe ao menos uma oferta em `ofertas_curso_unidade` para `UNIP / FISIO`.
- [ ] `unidades.instituicao_id` esta preenchido para as unidades migradas.
- [ ] `semestres.oferta_curso_unidade_id` esta preenchido para os registros que tem vinculo seguro.
- [ ] `turmas.oferta_curso_unidade_id` esta preenchido para os registros que tem vinculo seguro.
- [ ] `alunos.curso_id` e `alunos.oferta_curso_unidade_id` foram preenchidos para a Fisioterapia migrada.
- [ ] Existe um registro em `modelos_avaliacao_curso` para `AVALIACAO_ESTAGIO_FISIO`.
- [ ] Existem registros em `documentos_obrigatorios_curso` para `CARTEIRA_VACINACAO` e `TCE`.
- [ ] Existem registros em `usuarios_papeis_contexto`.
- [ ] Existe o perfil tecnico `master_curso` em `public.perfis`.

## 2. Sessao e Contexto

- [ ] Usuario com um unico contexto ativo continua autenticando normalmente.
- [ ] Usuario com um unico contexto ativo nao exibe seletor de contexto na sidebar.
- [ ] Usuario com multiplos contextos ativos exibe seletor de contexto na sidebar.
- [ ] Ao trocar o contexto na sidebar, `usuarios.contexto_padrao_id` e atualizado.
- [ ] A sessao recarrega com o novo `contextoAtivo`.
- [ ] Se nao houver contexto novo disponivel, o app continua funcionando com fallback legado por `role + unitId`.
- [ ] Usuario com multiplos contextos e sem `contexto_padrao_id` nao recebe selecao arbitraria de contexto.

## 3. Acessos

- [ ] `coordenador_master` acessa `/master`.
- [ ] `coordenador_master` acessa `/master/contextos`.
- [ ] `coordenador_master` continua com visao global da plataforma.
- [ ] Usuario com contexto ativo de Gestor do curso (`master_curso`) acessa `/master-curso`.
- [ ] Usuario com contexto ativo de Gestor do curso (`master_curso`) ve apenas dados do curso/instituicao do contexto ativo.
- [ ] Usuario com contexto de Gestor do curso (`master_curso`) nao recebe acesso global ao modulo `/master`.
- [ ] Usuario sem contexto ativo de Gestor do curso (`master_curso`) nao ve dados administrativos de `/master-curso`.
- [ ] Item de navegacao `Gestao do curso` aparece apenas quando o contexto ativo e de Gestor do curso.

## 4. Fluxos Legados

- [ ] Dashboard do aluno continua funcionando.
- [ ] Dashboard do professor continua funcionando.
- [ ] Dashboard do coordenador continua funcionando.
- [ ] Dashboard da secretaria continua funcionando.
- [ ] Lancamento de avaliacao continua funcionando.
- [ ] Lancamento de ausencias continua funcionando.
- [ ] Fluxo de documentos continua funcionando.
- [ ] Fluxo de liberacoes excepcionais continua funcionando.
- [ ] Fluxo de clinica supervisionada continua funcionando, se aplicavel ao ambiente de homologacao.
- [ ] Nenhum fluxo legado passou a depender visualmente da escolha de contexto para funcionar.

## 5. Diagnosticos Operacionais

- [ ] Conferir usuarios ativos sem contexto novo.
- [ ] Conferir usuarios com multiplos contextos e sem contexto padrao.
- [ ] Conferir unidades sem instituicao.
- [ ] Conferir semestres sem oferta.
- [ ] Conferir turmas sem oferta.
- [ ] Conferir alunos sem oferta.
- [ ] Conferir avaliacoes sem modelo configuravel.
- [ ] Conferir documentos sem documento obrigatorio do curso.
- [ ] Conferir usuarios com contexto de Gestor do curso (`master_curso`).
- [ ] Conferir que `coordenador_master` e `master_curso` sao perfis tecnicamente distintos.

## 6. Validacao Recomendada por Perfil

### Coordenador master

- [ ] Login bem-sucedido.
- [ ] Acesso a `/master`.
- [ ] Acesso a `/master/contextos`.
- [ ] Visualizacao dos indicadores globais esperados.

### Gestor do curso

- [ ] Login bem-sucedido com contexto ativo de Gestor do curso (`master_curso`).
- [ ] Visualizacao do seletor de contexto quando houver multiplos contextos.
- [ ] Acesso a `/master-curso`.
- [ ] Visualizacao de instituicao, curso, ofertas, contextos e indicadores do curso.
- [ ] Sem acesso global automatico a telas exclusivas de `coordenador_master`.

### Perfis legados

- [ ] Aluno segue no dashboard de aluno.
- [ ] Professor segue no dashboard e nos modulos de lancamento.
- [ ] Coordenador segue no dashboard e nos modulos de gestao local.
- [ ] Secretaria segue no dashboard e nos modulos operacionais habituais.

## 7. Criterios de Aprovacao

- [ ] Estrutura `UNIP / FISIO` consistente no banco.
- [ ] Contextos carregando na sessao sem quebrar o fallback legado.
- [ ] Seletor de contexto funcionando para usuarios com multiplos contextos.
- [ ] `/master/contextos` validando a camada institucional nova.
- [ ] `/master-curso` validando o escopo administrativo do Gestor do curso (`master_curso`).
- [ ] Fluxos legados da Fisioterapia sem regressao funcional visivel.

## 8. Como Usar este Checklist

1. Rode as consultas de [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql) no SQL Editor.
2. Valide os resultados estruturais do banco.
3. Inicie o app localmente e percorra os cenarios por perfil.
4. Marque cada item concluido.
5. Registre qualquer pendencia antes de avancar para RLS ou CRUDs institucionais.

## 9. Pendencias Esperadas Antes da Proxima Fase

- RLS/policies ainda nao foram migradas para o modelo multicurso.
- Nao existe CRUD institucional completo para instituicoes, cursos, ofertas e contextos.
- Nao existe seletor visual de escopo administrativo alem do contexto ativo.
- O menu principal ainda continua centrado no `role` legado, com extensoes pontuais por contexto.

## 10. Proximo Passo Recomendado

Depois da homologacao, o passo mais seguro e abrir a fase de RLS/policies compativeis por etapas:

1. novas tabelas estruturais;
2. tabelas de leitura administrativa;
3. tabelas academicas menos criticas;
4. tabelas operacionais centrais.

Antes disso, vale fechar qualquer pendencia encontrada nos diagnosticos acima.
