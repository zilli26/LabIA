# 02-Vídeos — Construção

**Status:** tarefa 7 implementada e validada por testes + DOM/Prisma sem worker (2026-07-04); nenhuma geração real executada · **Etapa:** E2 · **Depende de:** E1 fechada (canvas, worker unificado, Generation/Asset/CreditLedger, ModelProvider fal.ai).

> **Adendo O1 — 2026-09-11:** infraestrutura de `ProviderConnection`/`ProviderCapability`, executor local do Codex App Server e UI de conexão ChatGPT foram implementados na branch `feat/o1-openai-chatgpt-connection`, separadamente do worker. O1 não altera `video.generate`, ffmpeg, montagem ou execução e não valida capability de vídeo OpenAI. A arquitetura futura dos nós é **Provider → Conexão → Modelo**; fal.ai continua disponível normalmente. Tarefa pós-O1: parametrizar os nós somente depois das provas autorizadas, preservando o caminho atual.

## Ordem de tarefas

0. [x] **Mapeamento de catálogo (SEM geração):** confirmar nas docs públicas da fal.ai o endpoint exato, preço por segundo/clipe (com e sem áudio), durações suportadas e suporte a áudio nativo de: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance, Veo 3. Saída: `FAL_VIDEO_MODELS` em `lib/providers/fal-models.ts` + tabela atualizada em `docs/06-PROVEDORES.md` com fonte e data. **Proibido rodar qualquer geração.**
1. [x] Estimativa de custo de vídeo no `ModelProvider` (por segundo/clipe, com/sem áudio) + fila `video.generate` no worker unificado, no padrão de `image.generate` (Generation, custo estimado/real, erro legível). Concluída por testes unitários, sem geração real.
2. [x] Nó Gerar Vídeo (img2video): imagem de entrada (nó ou asset), prompt de movimento, select de modelo com preço, duração, toggle áudio. Job assíncrono com status por polling (padrão E1). Concluído por testes unitários e preview visual sem executar fluxo de vídeo.
3. [x] Nó Text2Video (reuso do 2 sem entrada de imagem). Concluído com `NodeDefinition` `text2video`, prompt por input text ou campo do nó, custo via `FalProvider`, enqueue em `video.generate` sem `image_url`, e UI compartilhada com `Gerar Vídeo`.
4. [x] Serviço interno de ffmpeg (binário via `ffmpeg-static`): extração de último frame + concat + mix de trilha. Concluído com `spawn` sem shell string, timeout, erro resumido e testes Vitest com `testsrc`/`sine`.
5. [x] Nó Estender Vídeo: last-frame + contexto de cena propagado pela aresta + aviso de degradação no 6º encadeamento. Concluído com `NodeDefinition` `video-extend`, polling de `Generation` de vídeo, frame intermediário sem `Asset`, `sceneContext`/`chainDepth` no output e UI com aviso visual no 6º encadeamento.
6. [x] Nó Montagem (concat): reúne os clipes na ordem da posição X dos nós de origem no canvas, concatena (áudio nativo dos clipes passa quando existir) e exporta MP4 único como Asset. Concluído com suporte a **entrada múltipla ordenada** no runner, `NodeDefinition` `video-assembly`, upload em prefixo de `flow-runs`, Asset direto sem `Generation`, UI com dica de ordem e custo R$0.
6b. [x] Trilha/voz por upload: subsistema mínimo de upload (Asset `AUDIO`, `UPLOADED`) + mix na Montagem cobrindo o vídeo inteiro, tratando vídeo SEM faixa de áudio própria em `mixAudioTrack` (clipes Wan/Kling nascem mudos). Concluída com rota `/api/assets/upload`, parâmetro `audioAssetUrl`/`audioAssetId` no nó `Montagem`, mix local via ffmpeg e teste real com clipe mudo sintético.
7. [x] Modal de confirmação de custo total (R$) antes de enfileirar fluxo com nó de vídeo. Concluído com gate puro para kinds de vídeo pago, estimativa fresca via rota de custo ao abrir, breakdown por nó pago e confirmação separada do enqueue.
8. Retry por nó de vídeo sem re-executar anteriores (clipes anteriores lidos como Asset). **Ao retomar, incluir idempotência/reconciliação para não reenviar uma geração já submetida após timeout/retry.**
9. Pós-O1: parametrizar nós gerativos com `Provider → Conexão → Modelo`, filtrando conexões/modelos por capability verificada e sem criar provider default global.

## Critérios de aceite (validação externa — rodar de verdade, nunca auto-declarar)

- [ ] Tarefa 0: tabela de modelos com endpoint/preço/áudio confirmados em fonte pública, com data.
- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser, **com áudio quando o modelo suportar**.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente (sem "teleporte" visual entre clipes).
- [ ] Montagem (tarefa 6) entrega MP4 único concatenando os clipes na ordem X do canvas.
- [x] Montagem com trilha (tarefa 6b) entrega MP4 com trilha enviada cobrindo o vídeo inteiro, inclusive sobre clipes mudos.
- [x] Custo total estimado aparece no modal ANTES de enfileirar fluxo com vídeo pago; cancelar/Esc/overlay fecha sem criar run.
- [ ] Soma dos custos reais aparece depois da execução.
- [ ] Retry de um clipe do meio não re-executa os anteriores (e não gera custo dos anteriores).
- [ ] OpenAI/ChatGPT: login O1 é um gate de autenticação separado e não satisfaz nenhum critério de geração de vídeo.

**Toda validação que envolve geração real tem custo declarado em R$ e aprovação do Felipe NA HORA, degrau a degrau (1 clipe → fluxo completo).**
