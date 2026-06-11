# Guia Operacional de Abertura de Novo Curso

Este guia orienta a abertura de novos cursos na arquitetura multi-institucional e multicurso do Nexus Academy sem depender de SQL manual para as etapas administrativas iniciais.

Exemplos de cursos alvo:

- Enfermagem
- Nutricao
- Biomedicina
- Medicina

## 1. Visao geral

O Nexus Academy agora trabalha com as seguintes camadas estruturais:

- `instituicao`: organizacao mantenedora, como `UNIP`
- `unidade`: campus ou polo fisico
- `curso`: identidade academica do curso dentro da instituicao
- `oferta de curso na unidade`: vinculo entre curso e unidade
- `configuracoes academicas por curso`: modelos de avaliacao, grupos, criterios e documentos obrigatorios
- `contextos de usuario`: papeis escopados por instituicao, curso e, quando necessario, oferta

Na pratica, um curso novo so deve entrar em operacao depois que essas camadas estiverem coerentes.

## 2. Pre-requisitos

Antes de abrir um curso novo, valide:

- instituicao ja cadastrada no sistema
- unidades da instituicao ja cadastradas
- acesso com perfil `coordenador_master`
- Fisioterapia ja configurada como modelo-base na mesma instituicao
- homologacao multicurso disponivel em [docs/homologacao-multi-institucional-multicurso.md](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/docs/homologacao-multi-institucional-multicurso.md)
- consultas de validacao disponiveis em [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql)

## 3. Fluxo de abertura de curso

Use este passo a passo sempre que for abrir um curso novo:

1. Acesse `/master/cursos`.
2. Crie o curso dentro da instituicao correta.
3. Crie a oferta do curso na unidade desejada.
4. Acesse `/master/cursos/configuracoes`.
5. Copie a configuracao-base da Fisioterapia para o novo curso.
6. Revise o modelo de avaliacao do curso.
7. Revise grupos de avaliacao.
8. Revise criterios de avaliacao.
9. Revise documentos obrigatorios do curso.
10. Confira o diagnostico de pesos para grupos e criterios.
11. Valide o resultado no painel `/master/contextos`.
12. So depois avance para semestres, turmas, usuarios e alunos do novo curso.

## 4. Cuidados importantes

Ao abrir um curso novo, observe estes alertas:

- nao abrir turmas antes de configurar o curso
- nao copiar a configuracao-base duas vezes para o mesmo curso
- revisar pesos dos grupos para totalizar `100%`
- revisar pesos dos criterios dentro de cada grupo para totalizar `100%`
- revisar documentos obrigatorios antes de colocar o curso em operacao
- evitar editar a Fisioterapia por engano ao preparar outro curso
- nao alterar RLS/policies manualmente fora da etapa propria
- nao confundir `coordenador_master` com o Gestor do curso (`master_curso`)

Observacao:

`coordenador_master` continua sendo o administrador global da plataforma.

O Gestor do curso (`master_curso`) representa a gestao transversal de um curso especifico dentro de uma instituicao.

## 5. Checklist final

Marque este checklist ao concluir a abertura:

- [ ] Curso criado
- [ ] Oferta criada
- [ ] Configuracao-base copiada
- [ ] Modelo revisado
- [ ] Grupos revisados
- [ ] Criterios revisados
- [ ] Documentos revisados
- [ ] Pesos dos grupos OK
- [ ] Pesos dos criterios OK
- [ ] Curso aparece nos paineis administrativos
- [ ] Fluxo legado da Fisioterapia preservado

## 6. Proximas fases futuras

Depois que a abertura administrativa estiver pronta, as proximas fases esperadas sao:

- criacao de semestres por oferta
- criacao de turmas por oferta
- vinculacao de coordenadores, professores e alunos ao novo curso
- liberacao gradual de operacao para Gestor do curso (`master_curso`)
- migracao de RLS/policies compativeis com a arquitetura multicurso
- CRUD mais avancado de documentos, grupos e criterios
- ajustes especificos por curso conforme a regra academica real

## 7. Sequencia recomendada de validacao

Para reduzir risco operacional, use esta ordem:

1. confirmar curso e oferta em `/master/cursos`
2. confirmar configuracao academica em `/master/cursos/configuracoes`
3. conferir pesos e documentos obrigatorios
4. conferir estrutura e contextos em `/master/contextos`
5. rodar os checks SQL de leitura
6. so depois iniciar o preparo academico do novo curso

## 8. Pendencias que ainda nao fazem parte desta abertura

Este guia cobre apenas a abertura administrativa e a preparacao academica base.

Ainda ficam fora deste passo:

- RLS/policies novas
- seletor avancado de escopo administrativo
- liberacao total de navegacao por Gestor do curso (`master_curso`)
- abertura automatica de semestres e turmas
- fluxos especificos de clinica supervisionada por curso

## 9. Referencias uteis

- [docs/homologacao-multi-institucional-multicurso.md](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/docs/homologacao-multi-institucional-multicurso.md)
- [database/checks-validacao-multi-institucional.sql](/C:/Users/guibe/Documents/Codex/2026-04-20-atue-como-um-engenheiro-de-software/database/checks-validacao-multi-institucional.sql)
- `/master/cursos`
- `/master/cursos/configuracoes`
- `/master/contextos`
