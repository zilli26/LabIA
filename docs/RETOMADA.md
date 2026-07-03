# RETOMADA - estado vivo do projeto

> Atualizado a cada fim de sessao de orquestracao. Proxima sessao (Claude ou Codex): leia isto DEPOIS do CLAUDE.md e ANTES de qualquer trabalho.
> Ultima atualizacao: **2026-07-03** (sessao Claude - revisao das tarefas 4-5 do modulo 01-imagens).

## Onde estamos

**E1 em andamento, ~85%.** Funcionando de verdade (validado, nao declarado): app shell com dashboard/lista/canvas, persistencia de fluxos no Supabase real, motor de execucao + custos com 47 testes unitarios verdes, ModelProvider fal.ai completo ate o enqueue, bucket de assets criado, migrations aplicadas, nos `Prompt` e `Gerar Imagem` registrados no registry e disponiveis na paleta flutuante do canvas, `/biblioteca` real com grid/filtros consultando `Asset` + `Generation`.

**Revisao das tarefas 4-5 concluida e commitada (`c6a6804`).** A entrega do Codex estava no working tree (nao commitada, ao contrario do que a versao anterior deste arquivo dizia). Revisao contra os criterios do CONSTRUCAO.md com validacao externa: 47 testes, lint, typecheck, build, e canvas vivo no browser — paleta carrega os 5 nos do registry via `/api/flows/node-definitions`, no `Gerar Imagem` mostra chip de custo estimado (~R$0,14) ANTES da execucao e select com 2 modelos + preco, `/biblioteca` renderiza filtros e empty state. Correcao de revisao aplicada direto: acentos PT-BR restaurados em strings de UI que o Codex removeu (incluindo regressao em "salvo às").

## Decisoes mudadas nesta sessao (e o porque)

1. **Worker unico para as duas filas** (recomendacao desta sessao, a implementar pelo Codex): um processo `npm run worker` que registra `flow-node-execution` E `image.generate` juntos. Por que: em dev, um unico processo para manter vivo; separar so quando houver razao de escala.

(Decisoes da sessao anterior — par esmeralda, app shell, chip de custo condicional, registry vivo em `estimateFlowCost`, nos como definicoes de registry — seguem valendo; ver historico do git.)

## Debitos tecnicos (assumidos conscientemente)

- **Saldo fal.ai zerado** -> smoke test parou em `Exhausted balance`; a primeira imagem real nunca rodou. Acao: Felipe faz top up de US$10 -> rodar `npx dotenv-cli -e .env.local -- npm run smoke:image`.
- **Worker de `flow-node-execution` sem processo permanente.** `registerFlowNodeWorker` existe em `lib/flows/queue.ts` e `scripts/image-worker.ts` cobre `image.generate`, mas nada consome a fila de nos. Sem ele, executar fluxo cria `FlowRun` e enfileira, mas o no de imagem nunca chama `enqueueImageGenerationJob`. Prompt do Codex para isso ja foi gerado na sessao de 2026-07-03.
- **Criterios de aceite E1 ainda abertos:** smoke real, fluxo end-to-end com worker vivo, comparacao lado a lado (tarefa 6: No Comparar + No Referencia), falha simulada com retry visual por no.
- **Strings backend sem acento** em `lib/providers/*` (erros de fal.ts, asset-storage etc., pre-existentes) — limpar quando tocar nesses arquivos.
- **Wordmark provisoria** (Space Grotesk 700, sem logo).
- **Limpeza menor:** no "Validação Claude" ficou no fluxo do banco; pasta `Temp\claude\labia-tests-worktree` pode ter sobrado no disco; considerar `.gitattributes` para warnings LF/CRLF.
- **Pesquisas com pendencia agendada:** P3 (metricas dos agregadores -> reabrir na E5), P6 (medir throughput real do `codex exec` -> E3).

## Validado nesta sessao (2026-07-03, revisao)

- `npx vitest run` -> 47 testes verdes.
- `npm run lint` e `npm run typecheck` limpos (antes e depois das correcoes de acento).
- `npm run build` ok — todas as rotas compilam, incluindo `/api/generations/[generationId]` e `/api/flows/[flowId]/runs/[runId]`.
- Browser preview real: dashboard, `/fluxos/[id]` com canvas + paleta do registry + no Gerar Imagem com custo estimado e modelos, `/biblioteca` com filtros. Screenshot da ferramenta de preview travou (flakiness conhecida), validacao foi via inspecao de DOM.

## Por onde retomar (nesta ordem)

1. **Codex: worker unificado** — criar `scripts/worker.ts` que registra `flow-node-execution` (via `registerFlowNodeWorker` -> `executeFlowRunNode`) + `image.generate` no mesmo processo; script `npm run worker`; registrar decisao em `modulos/01-imagens/decisoes.md`. Prompt pronto (sessao 2026-07-03).
2. **Felipe: top up US$10 na fal.ai** -> rodar `npx dotenv-cli -e .env.local -- npm run smoke:image`.
3. **Revisao integrada (Claude):** com worker vivo + saldo, rodar fluxo Prompt -> Gerar Imagem de ponta a ponta; confirmar imagem no no, custo real depois, asset na biblioteca, falha simulada e retry.
4. **Tarefa 6 do modulo 01:** No Comparar + No Referencia (criterio "mesma prompt em 2 modelos lado a lado").
5. Depois disso, decidir E2 (video) vs. polir o momento "adeus Higgsfield".

## Ambiente (para quem chegar do zero)

`.env.local` completo e funcional (Supabase + FAL_KEY + cambio). Banco migrado. Bucket `assets` existe. Dev: `npm run dev` (porta 3000). Testes: `npx vitest run`. Worker de imagem: `npm run worker:image`. Scripts com env: prefixar `npx dotenv-cli -e .env.local --`.
