# Sistema de Estágio de Fisioterapia

Base inicial de um sistema web para acompanhamento semestral de notas de estágio, com foco em:

- segurança por padrão
- privacidade de dados acadêmicos
- autorização por perfil
- cálculo de nota auditável
- reutilização em semestres futuros

## Stack sugerida

- Next.js App Router + TypeScript
- Supabase Auth
- PostgreSQL / Supabase Database
- Row Level Security (RLS)
- Server Components + Server Actions + Data Access Layer

## Como começar

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env.local
```

3. Configure um projeto Supabase e aplique os arquivos em `database/`:

- `database/schema.sql`
- `database/seed.sql`
- `database/policies.sql`

4. Rode o projeto:

```bash
npm run dev
```

## O que esta base já entrega

- documentação arquitetural inicial em `docs/planejamento-tecnico.md`
- schema SQL inicial
- políticas RLS de exemplo
- lógica de cálculo de nota
- consultas iniciais
- dashboard do aluno, professor e coordenador em modo esqueleto
- dados mock para desenvolvimento sem banco configurado

## Premissas iniciais

- o lançamento do professor usa escala de `0 a 10`
- o cálculo canônico da média é feito em `0 a 100` para combinar com os pesos percentuais
- a exibição pode mostrar tanto percentual quanto equivalente em `0 a 10`
- cada lançamento é versionado; a nota atual do critério considera o valor mais recente
