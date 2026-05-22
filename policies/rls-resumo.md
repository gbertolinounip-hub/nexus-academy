# Resumo Operacional de Permissões

- **Aluno**
  - lê apenas sua matrícula, avaliações, itens, ausências e vínculo correspondente
  - não insere nem atualiza notas ou ausências
- **Professor**
  - lê apenas matrículas e avaliações dos alunos vinculados
  - cria e edita avaliações e ausências apenas quando houver vínculo ativo
- **Coordenador**
  - lê todos os dados
  - gerencia semestres, turmas, vínculos e rubricas
  - acessa todo o histórico de auditoria

## Estratégia

- Autorização otimista no app para navegação e UX.
- Autorização definitiva no banco via RLS.
- Funções auxiliares em `private.*` para reduzir repetição nas políticas.
- Índices nos campos usados pelas políticas para evitar degradação de performance.
