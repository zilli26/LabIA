# 01-Imagens - Construcao

**Status:** tarefas 1-5 implementadas em 2026-07-03. Canvas registra `Prompt` e `Gerar Imagem` no registry vivo, expoe ambos na paleta flutuante `+ No`, estima custo antes pelo `FalProvider`, enfileira geracao via `enqueueImageGenerationJob` e atualiza o no quando a `Generation` tiver asset/custo real. `/biblioteca` agora consulta `Asset` + `Generation` reais, com preview, prompt, custo real e filtros por modelo/data. Ambiente completo: migrations aplicadas no Supabase, bucket `assets` criado, `FAL_KEY` valida. Smoke test roda ate a chamada real e para em `Exhausted balance` - **bloqueio unico: adicionar credito na conta fal.ai** (Billing). Re-rodar `npm run smoke:image` apos o top-up. **Etapa:** E1. **Depende de:** fundacao do canvas (modulo 03, parte E1), worker de fluxo/imagem vivo e `ModelProvider`.

## Ordem de tarefas

1. `ModelProvider` interface + implementacao fal.ai (`lib/providers/`) com 2 modelos de imagem - testavel por script antes de UI.
2. Entidades `Generation` + `Asset` no Prisma + upload do resultado ao Supabase Storage.
3. Job de geracao no pg-boss (enqueue -> poll/webhook fal -> persistir -> notificar UI).
4. No Prompt e No Gerar Imagem no canvas (React Flow), com estimativa de custo no no.
5. Biblioteca de assets (tela) + historico de geracoes.
6. No Comparar + No Referencia (img2img).

## Criterios de aceite (validacao externa)

- [ ] Script de smoke test gera 1 imagem real via fal.ai e imprime custo (sem UI).
- [ ] No canvas: prompt -> gerar -> imagem aparece no no; custo estimado visivel ANTES, real DEPOIS.
- [ ] Mesma prompt em 2 modelos -> comparacao lado a lado com custos diferentes.
- [ ] Asset aparece na biblioteca com prompt recuperavel.
- [ ] Falha simulada (chave invalida) mostra erro legivel e permite retry.

## Validacao desta sessao

- [x] `npx vitest run` - 47 testes verdes.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] Dev server em `http://localhost:3000`: `/fluxos`, `/fluxos/[id]`, `/biblioteca` e `/api/flows/node-definitions` responderam 200; registry retornou `prompt` e `image-generation`.

## Debitos restantes

- Worker permanente do fluxo ainda precisa ficar vivo para consumir `flow-node-execution`; o no de imagem ja chama o job de imagem quando executado.
- Geracao real continua bloqueada por saldo fal.ai (`Exhausted balance` esperado).
- Falha simulada com retry visual ainda nao foi fechada; o no exibe erro retornado, mas o botao de retry por no fica para a proxima etapa.
