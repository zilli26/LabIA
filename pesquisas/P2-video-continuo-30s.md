# P2 — Vídeo contínuo 30s+ (extend / last-frame chaining)

**Data:** 2026-07-02 · **Passadas:** 2

## Veredito: a técnica do módulo 02 é VIÁVEL e é o padrão do mercado

O encadeamento por último frame ("frame chaining") é exatamente como Kling, Veo/Flow e os apps em cima deles fazem vídeos longos hoje. Nossa spec (Nó Extend) está alinhada com a prática real.

## Fatos que mudam/afinam a spec

1. **Kling**: geração única capped em 10s (default 5s). Extend nativo adiciona 4-5s por chamada; até ~3min total encadeando. **Qualidade consistente até ~30s; degrada após ~60s** de extends empilhados → o Nó Extend deve avisar o usuário a partir do 6º encadeamento.
2. **Veo**: dois caminhos — (a) *Extend* nativo (Flow/Gemini API extend loop); (b) **Frames-to-Video**: salvar o último frame e usá-lo como primeiro frame da próxima geração — continuidade "pixel-locked" no ponto de corte. O caminho (b) é o que nosso Nó Extend implementa e funciona com QUALQUER modelo img2video (não só Veo) → decisão correta: implementar frame-chaining próprio (modelo-agnóstico) e, onde existir, oferecer o extend nativo do modelo como opção.
3. **Regra de consistência**: re-declarar personagem, iluminação, câmera e estilo em CADA segmento do prompt — senão o modelo "deriva". Confirma o campo "contexto de cena" propagado pela aresta (já na spec do módulo 02). O Video Director (03) deve gerar esse bloco de consistência automaticamente por cena.
4. **Áudio**: chaining não preserva áudio contínuo entre clipes — trilha/voz entra na Montagem (ffmpeg), não na geração. Anotar na spec do Nó Montagem.

## Impacto nos docs

- `modulos/02-videos/COMO-FUNCIONA.md`: técnica validada; adicionar aviso de degradação >6 extends e áudio via Montagem.
- `modulos/03-fluxos`: Video Director gera "bloco de consistência" por cena.

## Passada de verificação — lacunas

- [ ] Testar na prática (E2) qual modelo mantém melhor consistência de personagem entre clipes (Kling vs Wan vs Veo) — benchmark interno com 1 cena real.
- [ ] Hailuo/Seedance: extend nativo não confirmado nesta pesquisa — verificar docs do fal.ai na E2.

## Fontes

- https://www.veo3ai.io/blog/veo-3-extend-video-beyond-8-seconds-2026
- https://cybercorsairs.com/kling-v2-1-create-long-seamless-ai-videos/
- https://kling.ai/quickstart/ai-video-extension · https://artcoreai.com/guides/v2-kling-video-extend-guide
- https://www.atlascloud.ai/blog/guides/kling-ai-video-length-limit
- https://www.atlascloud.ai/blog/guides/best-ai-video-generation-api-longer-than-10-seconds
- https://www.eachlabs.ai/google/veo3-1/veo3-1-extend-video
