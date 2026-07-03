# LabIA — Custos & Billing

> Os números desta página vêm das pesquisas P1 (gateways), P5 (gratuito), P6 (assinaturas) e P7 (local).
> Status: aguardando resultados — será preenchida ao final da E0. NUNCA usar números de memória de IA aqui; só com fonte e data.

## Filosofia

1. **Custo visível**: toda geração mostra estimativa ANTES e custo real DEPOIS, em US$ e R$ (câmbio atualizado diariamente, cacheado).
2. **Ledger desde o dia 1**: cada `Generation` debita do `CreditLedger` do workspace mesmo na fase de uso próprio — assim o histórico de custo real existe quando o billing virar produto (E6).
3. **Margem futura**: no SaaS, crédito vendido = custo de API × margem (a definir na E6 com dados reais de uso do Felipe).

## Tabela de custo por modelo (P1 · 2026-07-02 · câmbio ~R$5,40)

| Modelo | Tipo | Provider | Custo unitário (US$) | ~R$ |
|---|---|---|---|---|
| FLUX schnell | imagem | Replicate | 0.003/img | 0,02 |
| FLUX dev | imagem | fal.ai | 0.025/img | 0,14 |
| Seedream V4 | imagem | fal.ai | 0.03/img | 0,16 |
| FLUX Kontext Pro (edição) | imagem | fal.ai | 0.04/img | 0,22 |
| Nano Banana 2 | imagem | fal.ai | 0.08/img | 0,43 |
| Nano Banana Pro | imagem | fal.ai | 0.15/img (2K=1.5x, 4K=2x) | 0,81 |
| Wan 2.5 | vídeo | fal.ai | 0.05/s | 1,35 (5s) |
| Kling 2.5 | vídeo | fal.ai | ~0.07/s (0.35/5s) | 1,90 (5s) |
| Seedance 2.0 | vídeo | EvoLink/OpenRouter | 0.045/s+ | 1,20 (5s) |
| Veo 3 | vídeo | fal.ai | 0.40/s | 10,80 (5s) |

Referência de produto: vídeo 30s+ custa de ~R$4 (Wan) a ~R$65 (Veo 3). Detalhes/fontes: `pesquisas/P1-gateways-precos.md`.

## Free tiers e créditos grátis (P5)

fal.ai: US$10-20 no signup (cobre o dev da E1/E2) · Replicate: créditos pequenos · Google AI Studio: ~50 req/dia grátis (texto; imagem NÃO) · Supabase/Vercel: free tiers cobrem infra até E5 · Zernio: 2 contas sociais grátis. **O grátis serve para desenvolver, não para operar.** Detalhes: `pesquisas/P5-mapa-do-gratuito.md`.

## Rotas por assinatura — padrão Hermes (P6)

Texto (copy/estratégia/research): viável rodar pelo plano ChatGPT Plus (Codex CLI `codex exec` via OAuth) e Claude Max (headless) através de um **worker local** na máquina do Felipe que consome a fila. Imagem/vídeo: NÃO tem rota de assinatura — segue API. Linha vermelha: só uso pessoal; no SaaS (E6) tudo migra para API. Detalhes: `pesquisas/P6-assinaturas-como-motor.md`.

## Local vs. API vs. GPU nuvem — break-even (P7)

- **Imagem local**: roda numa RTX 3060+ (FLUX quantizado), mas break-even só após ~130k imagens → **API vence no nosso volume**.
- **Vídeo local**: inviável em GPU de consumidor (Wan/Hunyuan 720p exigem 40-80GB VRAM) → API ou RunPod (US$0.22-0.90/h) para experimentos.
- **Decisão: não comprar máquina.** Gatilho de reavaliação: CreditLedger >R$300/mês só de imagem. Detalhes: `pesquisas/P7-hardware-local.md`.

## Custos fixos da plataforma (meta: ~R$0 até E5)

| Serviço | Plano | Custo |
|---|---|---|
| Vercel | Hobby | R$0 |
| Supabase | Free | R$0 |
| Domínio | (decidir na E1) | ~R$40/ano |
