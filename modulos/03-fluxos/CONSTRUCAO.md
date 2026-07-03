# 03-Fluxos — Construção

**Status:** E1 aberta; tarefas 1-5 implementadas em 2026-07-03 (execução/custos prontos no backend; validação end-to-end em Postgres depende de `DATABASE_URL`/`DIRECT_URL` reais e worker pg-boss ativo) · **Etapa:** E1 (canvas+motor), E2 (templates), E3 (Video Director) · **Depende de:** nada (é a fundação — primeira coisa da E1 junto com ModelProvider).

## Ordem de tarefas (E1)

1. [x] Setup do projeto Next.js + Supabase + Prisma + design system base (tokens do DESIGN-SYSTEM.md).
2. [x] Canvas React Flow: adicionar/conectar/mover nós, salvar/carregar `Flow`.
3. [x] Registry de `NodeDefinition` + validação de conexão por tipo de porta.
4. [x] Motor de execução: ordenação topológica, pg-boss, estados por nó, Realtime para a UI.
5. [x] Custo acumulado do fluxo (agregando estimateCost dos nós).
6. [ ] Nós utilitários (texto, upload, anotação).

## Status da implementação

- 2026-07-03: scaffold Next.js 15/App Router, TypeScript, Tailwind, shadcn/ui customizado, Prisma, Supabase client e `.env.example`.
- 2026-07-03: `Flow` persistido como grafo JSON React Flow em Postgres via Prisma (`Workspace`, `Brand`, `Flow`) com migration inicial.
- 2026-07-03: tela `/fluxos` com canvas React Flow, 3 nós iniciais não-gerativos, adição de nó, conexão, movimento e salvar/carregar por API.
- 2026-07-03: validação externa executada com lint, typecheck, build, Prisma validate e browser em `http://localhost:3000/fluxos`. Sem credenciais locais, a persistência real no Postgres não foi exercitada; a UI falha explicitamente quando `DATABASE_URL`/`DIRECT_URL` não estão configuradas.
- 2026-07-03: registry central de `NodeDefinition` em `lib/flows/`, endpoints de definição/validação, bloqueio de grafo inválido no save e validação de portas `text | image | video | copy | brand | any`.
- 2026-07-03: `FlowRun`/`FlowRunNode`, ordenação topológica, enfileiramento pg-boss, helper de worker local, estados por nó persistidos em tabelas assináveis via Supabase Realtime.
- 2026-07-03: custo acumulado estimado/real por nó e por fluxo, endpoint de estimativa antes da execução e serialização de custo para a UI. Validação real de execução ainda requer banco Supabase/Postgres configurado e worker importando `registerDefaultFlowWorker()`.

(Templates: E2 · Video Director: E3 — tarefas detalhadas quando as etapas abrirem.)

## Critérios de aceite (E1, validação externa)

- [x] Criar fluxo com 3 nós, salvar, recarregar a página e reabrir intacto. *(2026-07-03, validado por Claude contra o Postgres real do Supabase: save com nó novo + rename → reload intacto, 4 nós.)*
- [ ] Executar fluxo e ver estados mudando em tempo real sem refresh.
- [ ] Fechar o browser durante execução; reabrir e ver o fluxo concluído.
- [ ] Conexão de tipos incompatíveis é bloqueada com feedback visual.
- [ ] Custo acumulado bate com a soma dos custos dos nós.
