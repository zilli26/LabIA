# RETOMADA - estado vivo do projeto

> Atualizado a cada fim de sessão de orquestração. Próxima sessão (Claude ou Codex): leia isto DEPOIS do CLAUDE.md e ANTES de qualquer trabalho.
> Última atualização: **2026-07-03** (sessão Claude - PRIMEIRA IMAGEM REAL gerada; worker revisado e commitado).

## Marco: primeira imagem real (2026-07-03)

Fluxo Prompt -> Gerar Imagem rodou de ponta a ponta com saldo real: FlowRun `cmr5jxsi9000hvd5cgaqo09qz` -> Generation `cmr5jy3ry0000vdeczlnfbh0j` DONE, FLUX dev, custo estimado R$0,135 ANTES e custo real R$0,135 DEPOIS, asset 1024x768 no Supabase Storage, visível na `/biblioteca` com prompt recuperável. Regra nova do Felipe: **nenhum gasto de API sem aprovação explícita dele** (cartão pessoal na fal.ai). Comparação lado a lado (tarefa 6) adiada por decisão dele. Handles do canvas estavam invisíveis (Felipe não conseguia conectar nós) — corrigidos para 16px esmeralda (`710f48b`).

## Onde estamos

**E1 em andamento, ~88%.** Funcionando de verdade (validado, não declarado): app shell com dashboard/lista/canvas, persistência de fluxos no Supabase real, motor de execução + custos com 47 testes unitários verdes, ModelProvider fal.ai completo até a chamada real, bucket de assets criado, migrations aplicadas, nós `Prompt` e `Gerar Imagem` registrados no registry e disponíveis na paleta flutuante do canvas, worker único `npm run worker` consumindo `flow-node-execution` e `image.generate`, `/biblioteca` real com grid/filtros consultando `Asset` + `Generation`.

**Worker unificado implementado, revisado e commitado.** Revisão Claude reproduziu a validação de forma independente (não aceitou a auto-declaração): worker subiu com as duas filas, run novo `cmr5evbev000qvd6wrkwhbi3k` executou Prompt -> Gerar Imagem de ponta a ponta e a `Generation cmr5evly30000vdas2ud40y5k` falhou com `Exhausted balance - HTTP 403` legível, como esperado sem saldo. Detalhe original da entrega: `scripts/worker.ts` carrega `.env.local`, registra `flow-node-execution` via `registerFlowNodeWorker` -> `executeFlowRunNode` e registra `image.generate` via `startImageGenerationWorker`. Validação externa: worker logou as duas filas ativas; com `npm run dev` em paralelo, um fluxo Prompt -> Gerar Imagem criou `FlowRun cmr5e8egz0008vd58exhblo6h`, o nó de imagem saiu de `queued`, criou `Generation cmr5e8qld0000vd84qgl2jc4a` e a fal.ai respondeu `User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing. - HTTP 403`, persistido como erro legível.

**Revisão das tarefas 4-5 concluída e commitada (`c6a6804`).** A entrega do Codex estava no working tree (não commitada, ao contrário do que a versão anterior deste arquivo dizia). Revisão contra os critérios do CONSTRUCAO.md com validação externa: 47 testes, lint, typecheck, build, e canvas vivo no browser - paleta carrega os 5 nós do registry via `/api/flows/node-definitions`, no `Gerar Imagem` mostra chip de custo estimado (~R$0,14) ANTES da execução e select com 2 modelos + preço, `/biblioteca` renderiza filtros e empty state. Correção de revisão aplicada direto: acentos PT-BR restaurados em strings de UI que o Codex removeu (incluindo regressão em "salvo às").

## Decisões mudadas nesta sessão (e o porquê)

1. **Worker único para as duas filas** (implementado nesta sessão): um processo `npm run worker` registra `flow-node-execution` E `image.generate` juntos. Por quê: em dev/E1, um único processo reduz operação e evita esquecer uma fila; separar só quando houver razão de escala ou isolamento.
2. **Erro da fal.ai deve preservar detalhe do corpo da resposta.** Por quê: `Forbidden` sozinho não prova nem orienta; o worker agora extrai `body.detail/message`, status HTTP e requestId quando existirem, permitindo mostrar `Exhausted balance` de forma legível no nó/Generation.

(Decisões da sessão anterior - par esmeralda, app shell, chip de custo condicional, registry vivo em `estimateFlowCost`, nós como definições de registry - seguem valendo; ver histórico do git.)

## Débitos técnicos (assumidos conscientemente)

- **Saldo fal.ai zerado** -> smoke/fluxo chegam na chamada real e param em `Exhausted balance`; a primeira imagem real nunca rodou. Ação: Felipe faz top up de US$10 -> rodar `npx dotenv-cli -e .env.local -- npm run smoke:image` e depois `npm run worker` + fluxo pelo canvas.
- **Critérios de aceite E1 ainda abertos:** smoke real com imagem, imagem aparecendo no nó com custo real depois, asset real na biblioteca, comparação lado a lado (tarefa 6: Nó Comparar + Nó Referência), falha simulada com retry visual por nó.
- **Strings backend sem acento** em `lib/providers/*` (erros de fal.ts, asset-storage etc., preexistentes) - limpar quando tocar nesses arquivos.
- **Wordmark provisória** (Space Grotesk 700, sem logo).
- **Prompt do fluxo de teste com mojibake:** o texto gravado pelo Codex no fluxo `cmr5dy5200002vd581a6hyi9h` contém U+FFFD (corrompido na entrada, não no pipeline de leitura — verificado por codepoint). Na revisão integrada, digitar um prompt acentuado num browser real para confirmar que a entrada via UI preserva UTF-8.
- **Limpeza menor:** no "Validação Claude" ficou no fluxo do banco; pasta `Temp\claude\labia-tests-worktree` pode ter sobrado no disco; considerar `.gitattributes` para warnings LF/CRLF.
- **Pesquisas com pendência agendada:** P3 (métricas dos agregadores -> reabrir na E5), P6 (medir throughput real do `codex exec` -> E3).

## Validado nesta sessão (2026-07-03, revisão)

- `npx vitest run` -> 47 testes verdes.
- `npm run lint` e `npm run typecheck` limpos (antes e depois das correções de acento).
- `npm run build` ok - todas as rotas compilam, incluindo `/api/generations/[generationId]` e `/api/flows/[flowId]/runs/[runId]`.
- Browser preview real: dashboard, `/fluxos/[id]` com canvas + paleta do registry + nó Gerar Imagem com custo estimado e modelos, `/biblioteca` com filtros. Screenshot da ferramenta de preview travou (flakiness conhecida), validação foi via inspeção de DOM.

## Validado nesta sessão (2026-07-03, Codex worker)

- `npx dotenv-cli -e .env.local -- npm run worker` -> logou `Worker ativo na fila flow-node-execution.` e `Worker ativo na fila image.generate.`.
- `npm run dev` em paralelo (porta 3001 porque 3000 estava ocupada) + canvas em `/fluxos/cmr5dy5200002vd581a6hyi9h`: fluxo Prompt -> Gerar Imagem disparado; `GET /api/flows/cmr5dy5200002vd581a6hyi9h/runs/cmr5e8egz0008vd58exhblo6h` mostrou run `done`, nó `image-worker-check` `done`, com `generationId cmr5e8qld0000vd84qgl2jc4a`.
- `GET /api/generations/cmr5e8qld0000vd84qgl2jc4a` -> `FAILED` com erro legível `User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing. - HTTP 403`.
- `npx vitest run` -> 47 testes verdes.
- `npm run lint` -> limpo.
- `npm run typecheck` -> limpo.

## Deploy Vercel (2026-07-03) — FUNCIONANDO

Site em produção: `https://labia-zilli26s-projects.vercel.app` (projeto `labia`, conta `zilli26`). **Biblioteca confirmada funcionando pelo Felipe** após correção: as env vars subiram contaminadas com `\r` (pipe do PowerShell) causando `PrismaClientInitializationError`; re-subidas via bash `printf` e redeploy. Lição: env vars para Vercel no Windows SEMPRE via `printf '%s'`, nunca pipe do PowerShell. Deployment Protection segue ativa (só o Felipe logado na Vercel vê; desativar em Settings -> Deployment Protection quando quiser acesso público). Worker continua local (`iniciar-labia.bat` na raiz sobe dev + worker); o site na nuvem enfileira no mesmo Postgres, geração processa só com worker ligado.

## Por onde retomar (nesta ordem)

**Decisão do Felipe (2026-07-03): E1 declarada boa o suficiente; começar a E2 (vídeo) em sessão nova.**

1. **E2 — Nós de Vídeo:** SDD obrigatório — revisar/aprovar `modulos/02-videos/ESPECIFICACAO.md` e `CONSTRUCAO.md` com o Felipe ANTES de código. Base: `pesquisas/P2-video-continuo-30s.md` e `docs/06-PROVEDORES.md` (Wan 2.5 ~R$1,35/5s, Kling 2.5 ~R$1,90/5s, Veo 3 ~R$10,80/5s). Nós img2video + extend encadeáveis; critério da etapa: vídeo 30s+ coerente a partir de uma imagem, custo total visível ANTES de rodar. REGRA: nenhuma geração de vídeo sem aprovação explícita do Felipe (vídeo é ordem de grandeza mais caro que imagem).
2. **Débitos E1 (não bloqueiam E2, não esquecer):** retry visual por nó; comparação lado a lado (tarefa 6, adiada); imagem renderizando no nó em execução via UI pelo Felipe (nunca observada visualmente); Deployment Protection a desativar quando ele quiser site público.
3. **Ambiente segue o mesmo** (seção Ambiente abaixo). Vercel: env vars via bash `printf`, nunca pipe PowerShell.

## Ambiente (para quem chegar do zero)

`.env.local` completo e funcional (Supabase + FAL_KEY + câmbio). Banco migrado. Bucket `assets` existe. Dev: `npm run dev` (porta 3000 se livre). Testes: `npx vitest run`. Worker único: `npm run worker`. Worker legado só imagem: `npm run worker:image`. Scripts com env: prefixar `npx dotenv-cli -e .env.local --`.
