# 02-Vídeos — Construção

**Status:** não iniciado · **Etapa:** E2 · **Depende de:** 01-imagens e motor de fluxos (E1) prontos; pesquisa P2 concluída.

## Ordem de tarefas

1. Adicionar modelos de vídeo ao `ModelProvider` (fal.ai) + estimativa de custo por segundo/clipe.
2. Nó Img2Video (job assíncrono longo, status em tempo real via polling/realtime do Supabase).
3. Extração de último frame (ffmpeg) como serviço interno.
4. Nó Extend (frame + contexto de cena propagado).
5. Nó Montagem (concat ffmpeg + export MP4).
6. Custo total do fluxo agregado e exibido antes da execução.

## Critérios de aceite (validação externa)

- [ ] Fluxo imagem → img2video gera clipe real reproduzível no browser.
- [ ] Fluxo com 3+ Extends produz vídeo 30s+ coerente (sem "teleporte" visual entre clipes).
- [ ] Custo total estimado aparece antes; soma dos custos reais aparece depois.
- [ ] Retry de um clipe do meio não re-executa os anteriores.
