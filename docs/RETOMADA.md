# RETOMADA - estado vivo do projeto

> Atualizado a cada fim de sessão de orquestração. Próxima sessão (Claude ou Codex): leia isto DEPOIS do CLAUDE.md e ANTES de qualquer trabalho.
> Última atualização: **2026-07-04** (sessão Codex - tarefa 1 da E2 implementada por testes unitários, sem geração).

## E2 tarefa 1 concluída — custo de vídeo + fila `video.generate` (2026-07-04, Codex)

Implementação da tarefa 1 do módulo `02-videos` concluída sem chamar API paga, worker, smoke test ou geração real. Saídas:

- `lib/providers/fal.ts`: `estimateCost` agora roteia modelos de vídeo antes dos modelos de imagem e calcula Wan 2.5, Kling 2.5 Turbo Pro, Hailuo 2.3 Standard, Seedance 2.0 e Veo 3 com a tabela local da tarefa 0. `generate`/`waitForResult` aceitam endpoints de vídeo, normalizam input por modelo e falham de forma legível se o output não trouxer URL de vídeo.
- `lib/providers/video-generation-job.ts`: criada fila `video.generate`, com `Generation` gravada com custo estimado antes do enqueue, transição RUNNING/DONE/FAILED, persistência de `Asset` tipo `VIDEO`, custo real e erro legível compartilhado.
- `scripts/worker.ts`: worker unificado passa a registrar `flow-node-execution`, `image.generate` e `video.generate`.
- `lib/providers/provider-errors.ts`: extraído `getProviderErrorMessage` para evitar duplicação entre imagem e vídeo.
- `tests/providers/fal-video-cost.test.ts`: 20 testes unitários para preços de vídeo, BRL, erros legíveis e custo real por duração retornada.
- `modulos/02-videos/fontes-tarefa-0.md`: Seedance 1080p reconfirmado na página pública fal.ai em 2026-07-04 antes de entrar no `estimateCost`.

Validação desta sessão:

- `npx vitest run tests/providers/fal-video-cost.test.ts` -> 20 testes verdes.
- `npx vitest run` -> 67 testes verdes.
- `npm run lint` -> limpo.
- `npm run typecheck` -> limpo.
- Nenhum comando executado nesta sessão chamou `fal.queue`, `worker`, `smoke`, `npm run dev` ou geração real.

### Revisão Claude da tarefa 1 (2026-07-04) — APROVADA e commitada

Validação externa independente: lint, typecheck e os 67 testes re-executados pelo revisor, tudo verde. Diff inspecionado por completo: roteamento vídeo/imagem no `estimateCost`, matemática de custo conferida caso a caso contra a tabela da tarefa 0 (Wan por resolução, Kling 0,35+0,07/s, Hailuo 6s/10s com rejeição de duração não confirmada, Seedance 720p/1080p com rejeição de resolução sem preço, Veo 3 com/sem áudio, custo real pela duração retornada), fila `video.generate` espelhando fielmente o padrão de `image.generate` (custo estimado gravado ANTES do enqueue, erro legível compartilhado em `provider-errors.ts`, expire 1800s justificado). **Seedance 1080p a US$0,682/s re-verificado pelo revisor na página pública** ("for 1080p you will be charged $0.682/second") — a leitura da revisão da tarefa 0 é que tinha sido parcial; a reconfirmação do Codex estava correta. `AssetType.VIDEO` já existia no schema Prisma (sem migration). Nenhuma correção necessária — primeira entrega do Codex na E2 sem regressão de acentos.

## E2 tarefa 0 concluída — catálogo fal.ai de vídeo (2026-07-04, Codex)

Mapeamento documental da tarefa 0 do módulo `02-videos` concluído sem chamar API paga, worker, smoke test ou geração real. Saídas:

- `lib/providers/fal-models.ts`: criado `FAL_VIDEO_MODELS` com 5 famílias pedidas: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance 2.0 e Veo 3. Cada item registra endpoint(s), preço, duração, suporte a áudio nativo, suporte a extend nativo e `defaultInput`.
- `lib/providers/model-provider.ts`: `PricingUnit` passou a aceitar `clip`, necessário para modelos cobrados por geração/clipe.
- `lib/providers/fal.ts`: `listModels("video")` agora devolve o catálogo de vídeo, sem implementar geração.
- `docs/06-PROVEDORES.md`: tabela atualizada com os 5 modelos, preço em USD e data/fonte 2026-07-04.
- `modulos/02-videos/fontes-tarefa-0.md`: URLs exatas consultadas e lacunas registradas.
- `modulos/02-videos/CONSTRUCAO.md`: status atualizado e tarefa 0 marcada como concluída.

Lacunas/alertas registrados:

1. Wan 2.5: tem `audio_url` de entrada/background music, mas não foi encontrada geração nativa de áudio.
2. Kling 2.5: sem áudio nativo no endpoint geral da fal.ai; extend nativo não confirmado na fal.ai (P2 citava fora da fal.ai).
3. Hailuo 2.3: Standard ficou como canônico por ter duração/preço claros; Pro aparece como US$0,49/geração, mas a duração não ficou explícita no schema público; áudio nativo ficou lacuna.
4. Seedance 2.0: conflito pequeno de preço entre páginas (`US$0,3034/s` vs `US$0,3024/s` no image-to-video); catálogo usa o maior valor e registra o conflito.
5. Veo 3: conflito de preço na própria doc (`US$0,20/s` sem áudio e `US$0,40/s` com áudio no endpoint; Readme cita Standard `US$0,50/0,75` e Fast `US$0,25/0,40`); catálogo registra o conflito.

Validação desta sessão:

- `npm run lint` limpo.
- `npm run typecheck` limpo.
- `git diff --check` sem erros de whitespace; apenas avisos CRLF normais do Windows.
- Nenhum comando executado nesta sessão chamou `fal.queue`, `worker`, `smoke` ou `npm run dev`.

### Revisão Claude da tarefa 0 (2026-07-04) — APROVADA e commitada

Validação externa independente (não aceitou a auto-declaração): lint, typecheck e 47 testes rodados de novo pelo revisor, tudo verde; **os 5 preços conferidos por segunda leitura das páginas públicas da fal.ai (WebFetch)** — Wan, Kling, Veo 3, Hailuo e Seedance batendo com o catálogo. Diff inspecionado: nenhuma chamada de geração, só dados + `listModels("video")`. Correções de revisão aplicadas direto: acentos PT-BR restaurados em `fontes-tarefa-0.md` (Codex entregou sem acento de novo — padrão recorrente, checar em toda revisão) e registrada incerteza adicional no preço 1080p do Seedance (US$0,682/s não reconfirmado na releitura; reconfirmar na tarefa 1 antes de entrar no `estimateCost`).

## E2 aberta — spec aprovada (2026-07-03, sessão de orquestração)

Spec do módulo 02-videos revisada com o Felipe e **aprovada** ("pra cima bora"). Norte declarado por ele: conter tudo que precisamos para fazer os fluxos da melhor maneira e **nunca desperdiçar dinheiro**. Decisões dele nesta sessão (registradas em `modulos/02-videos/decisoes.md`):

1. **Catálogo amplo, gate no gasto:** Wan 2.5, Kling 2.5, Hailuo, Seedance E Veo 3 no select com preço (comparar chinês × ocidental é o produto); a proteção é a aprovação explícita dele antes de cada geração, não cortar modelo do catálogo. (Reverteu proposta do Claude de tirar o Veo 3.)
2. **Áudio desde o início:** som é parte do vídeo. Toggle de áudio nativo por modelo + trilha/voz na Montagem. Limite técnico (P2): frame-chaining não preserva áudio contínuo entre clipes → continuidade sonora vem da trilha, e a direção dos cortes segue o áudio (emendas em beats).
3. **Expertise é entregável:** criado `modulos/02-videos/TECNICAS.md` (doc vivo) — direção de cortes com áudio, consistência entre clipes, receitas replicáveis (tutoriais) e log de experimentos. Toda geração paga registra prompt/custo/aprendizado.

Escada de validação combinada: 1 clipe Wan ~R$1,35 → teste de emenda em beat → fluxo 30s+ ~R$8,24 (6 clipes Wan + imagem). Cada degrau com aprovação do Felipe NA HORA; aprovação de uma geração não vale para a próxima.

**Prompt da tarefa 0 (mapear catálogo fal.ai: endpoints, preços com/sem áudio, durações — ZERO geração) foi entregue ao Felipe no chat da sessão para colar no Codex.** Se perdido, regenerar a partir do CONSTRUCAO.md tarefa 0 do módulo 02.

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

**E2 em andamento, spec APROVADA (2026-07-03). SDD cumprido — código liberado seguindo a ordem do CONSTRUCAO.md do módulo 02.**

1. **Tarefa 0 no Codex:** Felipe cola o prompt (mapear catálogo de vídeo fal.ai — endpoints, preços com/sem áudio, durações, ZERO geração). Depois: Claude revisa a entrega contra os critérios (todo número com fonte+data, lint/typecheck/testes limpos, nenhuma geração executada) e commita.
2. **Tarefas 1-8 do CONSTRUCAO.md** em ordem (fila `video.generate`, nó Gerar Vídeo, Text2Video, serviço ffmpeg, Extend, Montagem com áudio, modal de custo total, retry por nó). Prompts do Codex sempre com a instrução de NUNCA rodar geração real.
3. **Gerações reais:** escada 1 clipe (~R$1,35) → emenda em beat → 30s+ (~R$8,24), cada uma com custo em R$ declarado e ok do Felipe na hora. Cada geração alimenta o log do `TECNICAS.md`.
4. **Débitos E1 (não bloqueiam E2, não esquecer):** retry visual por nó (parte será quitada pela tarefa 8 da E2); comparação lado a lado (tarefa 6 E1, adiada); imagem renderizando no nó via UI observada pelo Felipe; Deployment Protection a desativar quando ele quiser site público.
5. **Ambiente segue o mesmo** (seção Ambiente abaixo). Vercel: env vars via bash `printf`, nunca pipe PowerShell.

## Ambiente (para quem chegar do zero)

`.env.local` completo e funcional (Supabase + FAL_KEY + câmbio). Banco migrado. Bucket `assets` existe. Dev: `npm run dev` (porta 3000 se livre). Testes: `npx vitest run`. Worker único: `npm run worker`. Worker legado só imagem: `npm run worker:image`. Scripts com env: prefixar `npx dotenv-cli -e .env.local --`.
