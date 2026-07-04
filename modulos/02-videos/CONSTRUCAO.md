# 02-Vídeos — Construção

**Status:** tarefa 5 implementada e validada por testes unitários + preview dos controles no canvas sem worker (2026-07-04); nenhuma geração real executada · **Etapa:** E2 · **Depende de:** E1 fechada (canvas, worker unificado, Generation/Asset/CreditLedger, ModelProvider fal.ai).

## Ordem de tarefas

0. [x] **Mapeamento de catálogo (SEM geração):** confirmar nas docs públicas da fal.ai o endpoint exato, preço por segundo/clipe (com e sem áudio), durações suportadas e suporte a áudio nativo de: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance, Veo 3. Saída: `FAL_VIDEO_MODELS` em `lib/providers/fal-models.ts` + tabela atualizada em `docs/06-PROVEDORES.md` com fonte e data. **Proibido rodar qualquer geração.**
1. [x] Estimativa de custo de vídeo no `ModelProvider` (por segundo/clipe, com/sem áudio) + fila `video.generate` no worker unificado, no padrão de `image.generate` (Generation, custo estimado/real, erro legível). Concluída por testes unitários, sem geração real.
2. [x] Nó Gerar Vídeo (img2video): imagem de entrada (nó ou asset), prompt de movimento, select de modelo com preço, duração, toggle áudio. Job assíncrono com status por polling (padrão E1). Concluído por testes unitários e preview visual sem executar fluxo de vídeo.
3. [x] Nó Text2Video (reuso do 2 sem entrada de imagem). Concluído com `NodeDefinition` `text2video`, prompt por input text ou campo do nó, custo via `FalProvider`, enqueue em `video.generate` sem `image_url`, e UI compartilhada com `Gerar Vídeo`.
4. [x] Serviço interno de ffmpeg (binário via `ffmpeg-static`): extração de último frame + concat + mix de trilha. Concluído com `spawn` sem shell string, timeout, erro resumido e testes Vitest com `testsrc`/`sine`.
5. [x] Nó Estender Vídeo: last-frame + contexto de cena propagado pela aresta + aviso de degradação no 6º encadeamento. Concluído com `NodeDefinition` `video-extend`, polling de `Generation` de vídeo, frame intermediário sem `Asset`, `sceneContext`/`chainDepth` no output e UI com aviso visual no 6º encadeamento.
6. Nó Montagem (concat): reúne os clipes na ordem da posição X dos nós de origem no canvas, concatena (áudio nativo dos clipes passa quando existir) e exporta MP4 único como Asset. Requer suporte a **entrada múltipla ordenada** no runner (`collectInputs` hoje sobrescreve edges no mesmo handle).
6b. Trilha/voz por upload: subsistema mínimo de upload (Asset `AUDIO`, `UPLOADED`) + mix na Montagem cobrindo o vídeo inteiro, tratando vídeo SEM faixa de áudio própria em `mixAudioTrack` (clipes Wan/Kling nascem mudos). Separada da 6 porque o upload não existe no projeto ainda e é reutilizável.
7. Modal de confirmação de custo total (R$) antes de enfileirar fluxo com nó de vídeo.
8. Retry por nó de vídeo sem re-executar anteriores (clipes anteriores lidos como Asset).

## Critérios de aceite (validação externa — rodar de verdade, nunca auto-declarar)

- [ ] Tarefa 0: tabela de modelos com endpoint/preço/áudio confirmados em fonte pública, com data.
- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser, **com áudio quando o modelo suportar**.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente (sem "teleporte" visual entre clipes).
- [ ] Montagem (tarefa 6) entrega MP4 único concatenando os clipes na ordem X do canvas.
- [ ] Montagem com trilha (tarefa 6b) entrega MP4 com trilha enviada cobrindo o vídeo inteiro, inclusive sobre clipes mudos.
- [ ] Custo total estimado aparece no modal ANTES de enfileirar; soma dos custos reais aparece depois.
- [ ] Retry de um clipe do meio não re-executa os anteriores (e não gera custo dos anteriores).

**Toda validação que envolve geração real tem custo declarado em R$ e aprovação do Felipe NA HORA, degrau a degrau (1 clipe → fluxo completo).**
