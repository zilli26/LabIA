# 03-Fluxos — Construção

**Status:** não iniciado · **Etapa:** E1 (canvas+motor), E2 (templates), E3 (Video Director) · **Depende de:** nada (é a fundação — primeira coisa da E1 junto com ModelProvider).

## Ordem de tarefas (E1)

1. Setup do projeto Next.js + Supabase + Prisma + design system base (tokens do DESIGN-SYSTEM.md).
2. Canvas React Flow: adicionar/conectar/mover nós, salvar/carregar `Flow`.
3. Registry de `NodeDefinition` + validação de conexão por tipo de porta.
4. Motor de execução: ordenação topológica, pg-boss, estados por nó, Realtime para a UI.
5. Custo acumulado do fluxo (agregando estimateCost dos nós).
6. Nós utilitários (texto, upload, anotação).

(Templates: E2 · Video Director: E3 — tarefas detalhadas quando as etapas abrirem.)

## Critérios de aceite (E1, validação externa)

- [ ] Criar fluxo com 3 nós, salvar, recarregar a página e reabrir intacto.
- [ ] Executar fluxo e ver estados mudando em tempo real sem refresh.
- [ ] Fechar o browser durante execução; reabrir e ver o fluxo concluído.
- [ ] Conexão de tipos incompatíveis é bloqueada com feedback visual.
- [ ] Custo acumulado bate com a soma dos custos dos nós.
