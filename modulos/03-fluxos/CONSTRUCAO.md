# 03-Fluxos — Construção

**Status:** E1 aberta; tarefas 1-2 implementadas em 2026-07-03 (persistência via Prisma pronta, validação end-to-end em Postgres depende de `DATABASE_URL`/`DIRECT_URL` reais) · **Etapa:** E1 (canvas+motor), E2 (templates), E3 (Video Director) · **Depende de:** nada (é a fundação — primeira coisa da E1 junto com ModelProvider).

## Ordem de tarefas (E1)

1. [x] Setup do projeto Next.js + Supabase + Prisma + design system base (tokens do DESIGN-SYSTEM.md).
2. [x] Canvas React Flow: adicionar/conectar/mover nós, salvar/carregar `Flow`.
3. [ ] Registry de `NodeDefinition` + validação de conexão por tipo de porta.
4. [ ] Motor de execução: ordenação topológica, pg-boss, estados por nó, Realtime para a UI.
5. [ ] Custo acumulado do fluxo (agregando estimateCost dos nós).
6. [ ] Nós utilitários (texto, upload, anotação).

## Status da implementação

- 2026-07-03: scaffold Next.js 15/App Router, TypeScript, Tailwind, shadcn/ui customizado, Prisma, Supabase client e `.env.example`.
- 2026-07-03: `Flow` persistido como grafo JSON React Flow em Postgres via Prisma (`Workspace`, `Brand`, `Flow`) com migration inicial.
- 2026-07-03: tela `/fluxos` com canvas React Flow, 3 nós iniciais não-gerativos, adição de nó, conexão, movimento e salvar/carregar por API.
- 2026-07-03: validação externa executada com lint, typecheck, build, Prisma validate e browser em `http://localhost:3000/fluxos`. Sem credenciais locais, a persistência real no Postgres não foi exercitada; a UI falha explicitamente quando `DATABASE_URL`/`DIRECT_URL` não estão configuradas.

(Templates: E2 · Video Director: E3 — tarefas detalhadas quando as etapas abrirem.)

## Critérios de aceite (E1, validação externa)

- [ ] Criar fluxo com 3 nós, salvar, recarregar a página e reabrir intacto.
- [ ] Executar fluxo e ver estados mudando em tempo real sem refresh.
- [ ] Fechar o browser durante execução; reabrir e ver o fluxo concluído.
- [ ] Conexão de tipos incompatíveis é bloqueada com feedback visual.
- [ ] Custo acumulado bate com a soma dos custos dos nós.
