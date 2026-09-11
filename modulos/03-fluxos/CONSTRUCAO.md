# 03-Fluxos — Construção

**Status:** E1 aberta; tarefas 1-5 implementadas em 2026-07-03 (execução/custos prontos no backend; validação end-to-end em Postgres depende de `DATABASE_URL`/`DIRECT_URL` reais e worker pg-boss ativo); app shell global implementado em 2026-07-03 com dashboard em `/`, lista em `/fluxos` e canvas em `/fluxos/[id]` sem sidebar fixa. **O1 (2026-09-11): gestão de `ProviderConnection` OpenAI/ChatGPT implementada fora do worker de geração, com página `/conexoes`; nenhum grafo existente foi migrado nem executado.** · **Etapa:** E1 (canvas+motor), E2 (templates), E3 (Video Director) · **Depende de:** nada (é a fundação — primeira coisa da E1 junto com ModelProvider).

## O1 — impacto em Fluxos

A ADR 0002 substitui a noção de provider principal. O destino dos nós gerativos é `Provider → Conexão → Modelo`, mas O1 deliberadamente não altera `Flow.graph` existente nem a execução dos jobs de geração.

Implementado em O1:

- `ProviderConnection` associada a `workspaceId` + dono local configurado;
- processo Codex App Server independente da fila pg-boss;
- APIs locais de conexão e `/conexoes`;
- boundary test que impede imports conhecidos de `flow-node-execution`, pg-boss e jobs de geração no código O1;
- estados `conta`, `capacidade` e `geração validada` separados.

Não implementado em O1:

- campos `provider/connectionId/model` dentro dos nós legados;
- alteração do fluxo existente “Teste manual — Imagem → Vídeo”;
- geração OpenAI;
- correção do retry pós-submit dos workers (permanece bloqueador antes de nova geração real).

## Ordem de tarefas (E1)

1. [x] Setup do projeto Next.js + Supabase + Prisma + design system base (tokens do DESIGN-SYSTEM.md).
2. [x] Canvas React Flow: adicionar/conectar/mover nós, salvar/carregar `Flow`.
3. [x] Registry de `NodeDefinition` + validação de conexão por tipo de porta.
4. [x] Motor de execução: ordenação topológica, pg-boss, estados por nó, Realtime para a UI.
5. [x] Custo acumulado do fluxo (agregando estimateCost dos nós).
6. [ ] Nós utilitários (texto, upload, anotação).
7. [ ] Pós-O1: persistir a seleção explícita `provider + connectionId + model` nos nós gerativos e no snapshot do `FlowRun`, com compatibilidade para grafos legados.

## Status da implementação

- 2026-07-03: scaffold Next.js 15/App Router, TypeScript, Tailwind, shadcn/ui customizado, Prisma, Supabase client e `.env.example`.
- 2026-07-03: `Flow` persistido como grafo JSON React Flow em Postgres via Prisma (`Workspace`, `Brand`, `Flow`) com migration inicial.
- 2026-07-03: tela `/fluxos` com canvas React Flow, 3 nós iniciais não-gerativos, adição de nó, conexão, movimento e salvar/carregar por API.
- 2026-07-03: validação externa executada com lint, typecheck, build, Prisma validate e browser em `http://localhost:3000/fluxos`. Sem credenciais locais, a persistência real no Postgres não foi exercitada; a UI falha explicitamente quando `DATABASE_URL`/`DIRECT_URL` não estão configuradas.
- 2026-07-03: registry central de `NodeDefinition` em `lib/flows/`, endpoints de definição/validação, bloqueio de grafo inválido no save e validação de portas `text | image | video | copy | brand | any`.
- 2026-07-03: `FlowRun`/`FlowRunNode`, ordenação topológica, enfileiramento pg-boss, helper de worker local, estados por nó persistidos em tabelas assináveis via Supabase Realtime.
- 2026-07-03: custo acumulado estimado/real por nó e por fluxo, endpoint de estimativa antes da execução e serialização de custo para a UI. Validação real de execução ainda requer banco Supabase/Postgres configurado e worker importando `registerDefaultFlowWorker()`.
- 2026-07-03: app reestruturado para o shell fixado no DESIGN-SYSTEM: top bar global com `Início`/`Fluxos`/`Biblioteca`, dashboard em `/`, cards de fluxos em `/fluxos`, canvas em `/fluxos/[id]` e paleta de nós como botão flutuante `+ Nó` dentro do canvas.
- 2026-09-11: app shell ganhou `Conexões`; `/conexoes` gerencia OpenAI/ChatGPT local seguindo os mesmos tokens, sem acoplar login ao runner de fluxos.

## Tarefas candidatas — Templates + Didática (aprovadas em spec 2026-07-04; timing: fim da E2 ou abertura da E3, decisão do Felipe na hora)

T1. Nó utilitário "Revisar/Escolher" (custo zero) — candidato a adiantar para a E2, serve à escada de gerações reais.
T2. `FlowTemplate` no Prisma (migration) + seeds da primeira leva (5 visíveis + 2 avançados) em arquivos versionados.
T3. API de galeria + instanciação (validação de placeholders, substituição no grafo, custo estimado antes de criar).
T4. UI: chooser no "Novo fluxo", galeria com cards/custo/badges, wizard de variáveis, canvas com pendências destacadas.
T5. Didática incremental no canvas: picker por porta (Spotlight), tooltips de custo, conexão inválida explicada, empty state com receita.
T6. Fases visuais leves no canvas + proveniência do asset na Biblioteca.

(Video Director: E3 — tarefas detalhadas quando a etapa abrir.)

## Critérios de aceite (E1, validação externa)

- [x] Criar fluxo com 3 nós, salvar, recarregar a página e reabrir intacto. *(2026-07-03, validado por Claude contra o Postgres real do Supabase: save com nó novo + rename → reload intacto, 4 nós.)*
- [ ] Executar fluxo e ver estados mudando em tempo real sem refresh.
- [ ] Fechar o browser durante execução; reabrir e ver o fluxo concluído.
- [ ] Conexão de tipos incompatíveis é bloqueada com feedback visual.
- [ ] Custo acumulado bate com a soma dos custos dos nós.

## Validação O1 (2026-09-11)

- [x] typecheck, lint, testes Vitest/DOM e build passaram no GitHub Actions da branch O1 após correções do primeiro run;
- [x] testes O1 não iniciam worker e rejeitam dependências conhecidas da fila de geração;
- [x] UI separa autenticação de capacidade e validação de geração;
- [ ] migration aplicada em banco de desenvolvimento — pendente;
- [ ] login real pelo App Server local do Felipe — pendente;
- [ ] nenhuma produção publicada.
