# Planejamento Técnico Inicial

## Premissas

- Cada aluno pertence a uma turma por semestre por meio de `matriculas_turma`.
- Professores podem registrar vários lançamentos ao longo do período.
- O cálculo oficial usa percentual `0..100`, com conversão opcional para `0..10`.
- O coordenador pode visualizar tudo, gerenciar estrutura acadêmica e realizar ajustes auditados.

## Decisões principais

- **Frontend**: Next.js App Router com TypeScript, priorizando Server Components para leitura e Server Actions para mutações.
- **Banco**: PostgreSQL em Supabase, com autenticação nativa e RLS como camada principal de segurança de dados.
- **Autorização**: combinação de DAL no servidor, guards em TypeScript e políticas RLS no banco.
- **Auditoria**: trilha de alterações via `historico_alteracoes` e triggers em tabelas críticas.
- **Escalabilidade acadêmica**: estrutura desacoplada por semestre, turma, matrícula e vínculos professor-aluno.

## Fluxo resumido

1. O usuário autentica pelo Supabase Auth.
2. O app resolve o perfil em `usuarios` + `perfis`.
3. O dashboard consulta somente os dados autorizados.
4. Cada lançamento cria um cabeçalho em `avaliacoes` e linhas em `itens_avaliados`.
5. A nota atual considera o último lançamento válido por critério.
6. Ausências não justificadas geram desconto percentual sobre a média semestral.
7. Alterações ficam registradas para auditoria.

## Pastas principais

- `app/`: rotas e layouts
- `components/`: UI reutilizável
- `lib/`: autenticação, cálculo, mock, utilitários
- `services/`: agregação de dados e consultas
- `types/`: contratos TypeScript
- `database/`: schema, seed, políticas e queries SQL
- `policies/`: resumo operacional das regras

## Próximos passos naturais

- integrar autenticação real com convite de usuários
- substituir mocks por chamadas reais ao Supabase
- adicionar testes de cálculo e RLS
- criar fluxo de fechamento de semestre
