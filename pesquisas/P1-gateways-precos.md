# P1 — Gateways de geração: fal.ai vs. Replicate (preços)

**Data:** 2026-07-02 · **Passadas:** 2 (ampla + verificação de modelos-chave) · **Câmbio usado:** ~R$5,40/US$ (conferir no dia de uso)

## Veredito

**fal.ai como gateway principal, Replicate como secundário** — confirmado. fal.ai tem catálogo maior de vídeo (Kling, Veo, Wan, Hailuo, Vidu, Pixverse, Nano Banana), preços públicos por output e é o agregador que o mercado de apps de geração usa. Replicate (adquirida pela Cloudflare) segue ótima para modelos abertos e tem FLUX schnell mais barato ($0.003/imagem).

## Imagem (US$ por imagem)

| Modelo | Provider | Preço | ~R$ | Uso no LabIA |
|---|---|---|---|---|
| FLUX schnell | Replicate | $0.003 | ~R$0,02 | nó "barato/volume" |
| Qwen image | fal.ai | ~$0.02/MP | ~R$0,11 | alternativa volume |
| FLUX dev | fal.ai | $0.025 | ~R$0,14 | qualidade média |
| Seedream V4 | fal.ai | $0.03 | ~R$0,16 | qualidade |
| FLUX Kontext Pro (edição) | fal.ai | $0.04 | ~R$0,22 | edição por instrução |
| Nano Banana 2 (Google) | fal.ai | $0.08 | ~R$0,43 | qualidade top / edição |
| Nano Banana Pro | fal.ai | $0.15 (2K=1.5x, 4K=2x) | ~R$0,81 | hero images |

## Vídeo (US$ por segundo, salvo indicado)

| Modelo | Provider | Preço | Clipe 5s ~R$ | Observação |
|---|---|---|---|---|
| Seedance (Fast tier) | Atlas Cloud API | $0.022/s | ~R$0,60 | tier rápido |
| Seedance 2.0 | EvoLink/OpenRouter | de $0.045/s | ~R$1,20 | ByteDance |
| Wan 2.5 | fal.ai | $0.05/s | ~R$1,35 | melhor custo no fal |
| Kling | fal.ai | ~$0.07/s ($0.35/5s) | ~R$1,90 | Kling 2.5 Turbo ≈ $4.20/min |
| Veo 3 | fal.ai | $0.40/s | ~R$10,80 | premium Google |

**Insight de produto:** um vídeo de 30s+ custa entre ~R$4 (Wan) e ~R$65 (Veo 3) — a comparação de modelo POR CENA (Video Director escolhendo) é diferencial econômico real. Planos do Higgsfield/Kling cobram US$20-80/mês; com uso moderado, API sai muito mais barato.

## Passada de verificação — o que checar de novo antes da E1

- [ ] Confirmar preços direto em https://fal.ai/pricing no dia da implementação (mudam com frequência).
- [ ] Alternativas de agregador não avaliadas a fundo: WaveSpeedAI, Segmind, AtlasCloud — reavaliar se fal.ai subir preços.
- [ ] GPT Image (OpenAI) não listado no fal — se necessário, via API OpenAI direta (adicionar como provider próprio).

## Fontes

- https://fal.ai/pricing · https://fal.ai/docs/platform-apis/v1/models/pricing
- https://fluxnote.io/blog/ai-video-generation-pricing-guide-2026
- https://pricepertoken.com/image · https://replicate.com/pricing
- https://fal.ai/models/fal-ai/nano-banana-2 · https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/text-to-video
- https://www.atlascloud.ai/blog/case-studies/seedance-2.0-pricing-full-cost-breakdown-2026
- https://wavespeed.ai/blog/posts/replicate-review-2026/ (aquisição Replicate/Cloudflare)
