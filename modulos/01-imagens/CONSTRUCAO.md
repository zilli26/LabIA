# 01-Imagens - Construção

**Status:** tarefas 1-5 implementadas em 2026-07-03. Canvas registra `Prompt` e `Gerar Imagem` no registry vivo, expõe ambos na paleta flutuante `+ Nó`, estima custo antes pelo `FalProvider`, enfileira geração via `enqueueImageGenerationJob` e atualiza o nó quando a `Generation` tiver asset/custo real. `/biblioteca` agora consulta `Asset` + `Generation` reais, com preview, prompt, custo real e filtros por modelo/data. Worker unificado criado em `scripts/worker.ts`: `npm run worker` registra as filas `flow-node-execution` e `image.generate` no mesmo processo. Ambiente completo: migrations aplicadas no Supabase, bucket `assets` criado, `FAL_KEY` válida. Smoke/fluxo rodam até a chamada real e param em `Exhausted balance` - **bloqueio único: adicionar crédito na conta fal.ai** (Billing). Re-rodar `npm run smoke:image` após o top-up. **Etapa:** E1. **Depende de:** fundação do canvas (módulo 03, parte E1), worker de fluxo/imagem vivo e `ModelProvider`.

## Ordem de tarefas

1. `ModelProvider` interface + implementação fal.ai (`lib/providers/`) com 2 modelos de imagem - testável por script antes de UI.
2. Entidades `Generation` + `Asset` no Prisma + upload do resultado ao Supabase Storage.
3. Job de geração no pg-boss (enqueue -> poll/webhook fal -> persistir -> notificar UI).
4. Nó Prompt e Nó Gerar Imagem no canvas (React Flow), com estimativa de custo no nó.
5. Biblioteca de assets (tela) + histórico de gerações.
6. Nó Comparar + Nó Referência (img2img).

## Critérios de aceite (validação externa)

- [ ] Script de smoke test gera 1 imagem real via fal.ai e imprime custo (sem UI).
- [ ] No canvas: prompt -> gerar -> imagem aparece no nó; custo estimado visível ANTES, real DEPOIS.
- [ ] Mesma prompt em 2 modelos -> comparação lado a lado com custos diferentes.
- [ ] Asset aparece na biblioteca com prompt recuperável.
- [ ] Falha simulada (chave inválida) mostra erro legível e permite retry.

## Validação desta sessão

- [x] `npx vitest run` - 47 testes verdes.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] Dev server em `http://localhost:3000`: `/fluxos`, `/fluxos/[id]`, `/biblioteca` e `/api/flows/node-definitions` responderam 200; registry retornou `prompt` e `image-generation`.
- [x] `npx dotenv-cli -e .env.local -- npm run worker` - filas `flow-node-execution` e `image.generate` ativas no mesmo processo.
- [x] Com worker + dev em paralelo, fluxo Prompt -> Gerar Imagem criou `FlowRun cmr5e8egz0008vd58exhblo6h`, o nó de imagem saiu de `queued`, criou `Generation cmr5e8qld0000vd84qgl2jc4a` e a fal.ai retornou `Exhausted balance` legível.

## Débitos restantes

- Geração real continua bloqueada por saldo fal.ai (`Exhausted balance` esperado).
- Imagem no nó, custo real depois e asset na biblioteca dependem do top-up na fal.ai para validar com imagem real.
- Falha simulada com retry visual ainda não foi fechada; o nó exibe erro retornado, mas o botão de retry por nó fica para a próxima etapa.
