# 02-Vídeos — Construção

**Status do adendo multi-provider (2026-09-13):** resolução por Provider/Conexão/Modelo e jobs compatíveis com provider explícito foram preservados; fal.ai e a tarefa 8 histórica permanecem preservadas. O3 OpenAI está integrado somente para imagem pelo contrato oficial do App Server 0.154.0; vídeo OpenAI continua explicitamente indisponível. Nenhum teste real de vídeo foi realizado nesta sessão.

**Status do contrato Projeto-first (2026-09-14):** aprovado para orientar a implementação documental deste bloco: imagem-base importada pode alimentar img2video sem gerar imagem; referência visual não é primeiro frame por padrão; nomes públicos foram fixados sem alterar tipos internos; Continuar clipe exige Generation upstream; Juntar clipes exige 2+ clipes, não gera IA e vincula o Asset final ao Projeto. Nenhum código foi alterado nesta sessão.

**Status:** tarefa 7 implementada e validada por testes + DOM/Prisma sem worker (2026-07-04); nenhuma geração real executada · **Etapa:** E2 · **Depende de:** E1 fechada (canvas, worker unificado, Generation/Asset/CreditLedger, ModelProvider fal.ai).

## Ordem de tarefas

0. [x] **Mapeamento de catálogo (SEM geração):** confirmar nas docs públicas da fal.ai o endpoint exato, preço por segundo/clipe (com e sem áudio), durações suportadas e suporte a áudio nativo de: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance, Veo 3. Saída: `FAL_VIDEO_MODELS` em `lib/providers/fal-models.ts` + tabela atualizada em `docs/06-PROVEDORES.md` com fonte e data. **Proibido rodar qualquer geração.**
1. [x] Estimativa de custo de vídeo no `ModelProvider` (por segundo/clipe, com/sem áudio) + fila `video.generate` no worker unificado, no padrão de `image.generate` (Generation, custo estimado/real, erro legível). Concluída por testes unitários, sem geração real.
2. [x] Nó Animar imagem (img2video; tipo interno `video-generation`): imagem-base de entrada (Asset importado ou resultado de nó), prompt de movimento, select de modelo com preço, duração, toggle áudio. A entrada importada não passa por geração de imagem. Job assíncrono com status por polling (padrão E1). Concluído por testes unitários e preview visual sem executar fluxo de vídeo.
3. [x] Nó Text2Video (reuso do nó **Animar imagem**, sem entrada de imagem). Concluído com `NodeDefinition` `text2video`, prompt por input text ou campo do nó, custo via `FalProvider`, enqueue em `video.generate` sem `image_url`, e UI compartilhada com **Animar imagem**.
4. [x] Serviço interno de ffmpeg (binário via `ffmpeg-static`): extração de último frame + concat + mix de trilha. Concluído com `spawn` sem shell string, timeout, erro resumido e testes Vitest com `testsrc`/`sine`.
5. [x] Nó Continuar clipe (tipo interno `video-extend`): last-frame da `Generation` de vídeo upstream concluída + contexto de cena propagado pela aresta + aviso de degradação no 6º encadeamento. Não estende MP4 importado. Concluído com `NodeDefinition` `video-extend`, polling de `Generation` de vídeo, frame intermediário sem `Asset`, `sceneContext`/`chainDepth` no output e UI com aviso visual no 6º encadeamento.
6. [x] Nó Juntar clipes (tipo interno `video-assembly`; concat): exige 2+ clipes, reúne-os na ordem da posição X dos nós de origem no canvas, concatena (áudio nativo dos clipes passa quando existir) e exporta MP4 único como Asset vinculado ao Projeto do Flow. Não gera IA nem cria `Generation`; custo R$0. Concluído com suporte a **entrada múltipla ordenada** no runner, upload em prefixo de `flow-runs`, UI com dica de ordem e custo R$0.
6b. [x] Trilha/voz por upload: subsistema mínimo de upload (Asset `AUDIO`, `UPLOADED`) + mix em **Juntar clipes** cobrindo o vídeo inteiro, tratando vídeo SEM faixa de áudio própria em `mixAudioTrack` (clipes Wan/Kling nascem mudos). Concluída com rota `/api/assets/upload`, parâmetro `audioAssetUrl`/`audioAssetId` no nó **Juntar clipes**, mix local via ffmpeg e teste real com clipe mudo sintético.
7. [x] Modal de confirmação de custo total (R$) antes de enfileirar fluxo com nó de vídeo. Concluído com gate puro para kinds de vídeo pago, estimativa fresca via rota de custo ao abrir, breakdown por nó pago e confirmação separada do enqueue.
8. Retry por nó de vídeo sem re-executar anteriores (clipes anteriores lidos como Asset).

## Critérios de aceite (validação externa — rodar de verdade, nunca auto-declarar)

- [ ] Tarefa 0: tabela de modelos com endpoint/preço/áudio confirmados em fonte pública, com data.
- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser, **com áudio quando o modelo suportar**.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente (sem "teleporte" visual entre clipes).
- [ ] Juntar clipes (tarefa 6) entrega MP4 único concatenando 2+ clipes na ordem X do canvas.
- [x] Juntar clipes com trilha (tarefa 6b) entrega MP4 com trilha enviada cobrindo o vídeo inteiro, inclusive sobre clipes mudos.
- [x] Custo total estimado aparece no modal ANTES de enfileirar fluxo com vídeo pago; cancelar/Esc/overlay fecha sem criar run.
- [ ] Soma dos custos reais aparece depois da execução.
- [ ] Retry de um clipe do meio não re-executa os anteriores (e não gera custo dos anteriores).

**Toda validação que envolve geração real tem custo declarado em R$ e aprovação do Felipe NA HORA, degrau a degrau (1 clipe → fluxo completo).**

## Contratos de implementação deste corte

- O template **Produto importado → Vídeo curto** começa com imagem-base importada e não inclui `image-generation`. A ausência de imagem-base é uma pendência explícita, nunca motivo para inventar uma geração.
- Referência visual e imagem-base são papéis de Asset diferentes. Referência só participa quando selecionada explicitamente e suportada pelo provider; jamais vira primeiro frame automaticamente.
- Os rótulos públicos **Animar imagem**, **Continuar clipe** e **Juntar clipes** são aliases de apresentação. Os tipos internos `video-generation`, `video-extend` e `video-assembly` e os flows existentes permanecem compatíveis.
- Importar, escolher ou aplicar Asset não enfileira worker, `FlowRun`, `Generation` ou provider pago. Toda geração, inclusive retry, exige aprovação explícita individual e custo estimado em R$ antes; custo real aparece depois.
- O Asset final de **Juntar clipes** deve ser criado no Projeto dono do Flow, resolvido por `FlowRun → Flow → Project`, mesmo quando não há `Generation` associada.
