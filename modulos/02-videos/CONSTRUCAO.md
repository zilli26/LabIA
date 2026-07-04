# 02-Vídeos — Construção

**Status:** tarefa 1 implementada e validada por testes unitários/lint/typecheck (2026-07-04); nenhuma geração executada · **Etapa:** E2 · **Depende de:** E1 fechada (canvas, worker unificado, Generation/Asset/CreditLedger, ModelProvider fal.ai).

## Ordem de tarefas

0. [x] **Mapeamento de catálogo (SEM geração):** confirmar nas docs públicas da fal.ai o endpoint exato, preço por segundo/clipe (com e sem áudio), durações suportadas e suporte a áudio nativo de: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance, Veo 3. Saída: `FAL_VIDEO_MODELS` em `lib/providers/fal-models.ts` + tabela atualizada em `docs/06-PROVEDORES.md` com fonte e data. **Proibido rodar qualquer geração.**
1. [x] Estimativa de custo de vídeo no `ModelProvider` (por segundo/clipe, com/sem áudio) + fila `video.generate` no worker unificado, no padrão de `image.generate` (Generation, custo estimado/real, erro legível). Concluída por testes unitários, sem geração real.
2. Nó Gerar Vídeo (img2video): imagem de entrada (nó ou asset), prompt de movimento, select de modelo com preço, duração, toggle áudio. Job assíncrono com status por polling (padrão E1).
3. Nó Text2Video (reuso do 2 sem entrada de imagem).
4. Serviço interno de ffmpeg (binário via `ffmpeg-static`): extração de último frame + concat + mix de trilha.
5. Nó Estender Vídeo: last-frame + contexto de cena propagado pela aresta + aviso de degradação no 6º encadeamento.
6. Nó Montagem: concat + áudio nativo dos clipes + trilha/voz por upload mixada, export MP4 como Asset.
7. Modal de confirmação de custo total (R$) antes de enfileirar fluxo com nó de vídeo.
8. Retry por nó de vídeo sem re-executar anteriores (clipes anteriores lidos como Asset).

## Critérios de aceite (validação externa — rodar de verdade, nunca auto-declarar)

- [ ] Tarefa 0: tabela de modelos com endpoint/preço/áudio confirmados em fonte pública, com data.
- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser, **com áudio quando o modelo suportar**.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente (sem "teleporte" visual entre clipes).
- [ ] Montagem entrega MP4 único com trilha enviada cobrindo o vídeo inteiro.
- [ ] Custo total estimado aparece no modal ANTES de enfileirar; soma dos custos reais aparece depois.
- [ ] Retry de um clipe do meio não re-executa os anteriores (e não gera custo dos anteriores).

**Toda validação que envolve geração real tem custo declarado em R$ e aprovação do Felipe NA HORA, degrau a degrau (1 clipe → fluxo completo).**
