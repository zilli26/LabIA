# 01-Imagens - Construção

**Status:** tarefas 1-5 implementadas e **primeira imagem real gerada em 2026-07-03** (Generation `cmr5jy3ry0000vdeczlnfbh0j`, FLUX dev, custo real R$0,135 persistido, asset 1024x768 no Supabase Storage, visível na `/biblioteca` com prompt recuperável). Canvas registra `Prompt` e `Gerar Imagem` no registry vivo, estima custo antes pelo `FalProvider`, worker unificado (`npm run worker`) consome as filas `flow-node-execution` e `image.generate`. Handles do canvas corrigidos (invisíveis -> 16px esmeralda) após feedback do Felipe. Comparação lado a lado (tarefa 6) **adiada por decisão do Felipe em 2026-07-03**. **Etapa:** E1. **Depende de:** fundação do canvas (módulo 03, parte E1), worker vivo e `ModelProvider`.

## Ordem de tarefas

1. `ModelProvider` interface + implementação fal.ai (`lib/providers/`) com 2 modelos de imagem - testável por script antes de UI.
2. Entidades `Generation` + `Asset` no Prisma + upload do resultado ao Supabase Storage.
3. Job de geração no pg-boss (enqueue -> poll/webhook fal -> persistir -> notificar UI).
4. Nó Prompt e Nó Gerar Imagem no canvas (React Flow), com estimativa de custo no nó.
5. Biblioteca de assets (tela) + histórico de gerações.
6. Nó Comparar + Nó Referência (img2img).

## Critérios de aceite (validação externa)

- [x] Geração real de 1 imagem via fal.ai com custo impresso — validado 2026-07-03 pelo pipeline completo (fluxo -> worker -> fal.ai -> Supabase), que cobre mais que o smoke script; custo real R$0,135 registrado na Generation.
- [x] No canvas: prompt -> gerar -> custo estimado ANTES (R$0,135 no run) e real DEPOIS (R$0,135 na Generation/biblioteca). Pendência visual: confirmar a imagem renderizando no nó quando o Felipe executar pela UI.
- [ ] Mesma prompt em 2 modelos -> comparação lado a lado — **adiada por decisão do Felipe (2026-07-03)**; volta antes de declarar E1 fechada ou vai para E2, a decidir.
- [x] Asset aparece na biblioteca com prompt recuperável — validado no browser: 1 asset, FLUX.1 [dev], R$0,14, prompt completo, preview do Storage.
- [ ] Falha simulada (chave inválida) mostra erro legível (✓ validado com `Exhausted balance` legível no nó) e permite retry (✗ botão de retry por nó pendente).

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
