# 02-Vídeos — Construção

**Status:** tarefa 7 implementada e validada por testes + DOM/Prisma sem worker (2026-07-04); nenhuma geração real executada · **Etapa:** E2 · **Depende de:** E1 fechada (canvas, worker unificado, Generation/Asset/CreditLedger, ModelProvider fal.ai).

**Atualização O1 — 2026-09-11:** infraestrutura de conexão ChatGPT implementada separadamente do worker. Nenhum código de `video.generate`, ffmpeg, montagem ou execução foi alterado por O1. Nenhuma capability de vídeo OpenAI foi marcada como disponível e nenhuma geração real foi autorizada. A arquitetura futura dos nós é **Provider → Conexão → Modelo**; fal.ai continua sendo uma opção normal.

## Ordem de tarefas

0. [x] Mapeamento de catálogo fal.ai (sem geração).
1. [x] Estimativa de custo de vídeo + fila `video.generate`.
2. [x] Nó Gerar Vídeo img2video.
3. [x] Nó Text2Video.
4. [x] Serviço interno ffmpeg.
5. [x] Nó Estender Vídeo.
6. [x] Nó Montagem.
6b. [x] Trilha/voz por upload.
7. [x] Modal de confirmação de custo total.
8. [ ] Retry por nó de vídeo sem re-executar anteriores e sem reenviar geração já submetida.
9. [ ] Pós-O1: parametrizar nós gerativos com `Provider → Conexão → Modelo`, filtrar por capability verificada e preservar o caminho fal.ai existente.

## Critérios de aceite

- [x] Catálogo fal.ai documentado no histórico do módulo.
- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser, com áudio quando suportado.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente.
- [x] Montagem entrega MP4 único concatenando clipes no caminho local validado.
- [x] Montagem com trilha cobre inclusive clipes mudos.
- [x] Custo total estimado aparece no modal antes de enfileirar vídeo pago; cancelar não cria run.
- [ ] Soma dos custos reais aparece depois da execução.
- [ ] Retry de um clipe do meio não re-executa nem reenvia os anteriores.
- [ ] OpenAI/ChatGPT: login O1 pode ser validado sem worker; isso não satisfaz nenhum critério de geração de vídeo.

**Toda validação que envolve geração real exige custo declarado em R$ e aprovação do Felipe na hora, degrau a degrau.**
