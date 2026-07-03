# P5 — Mapa do gratuito (free tiers e créditos)

**Data:** 2026-07-02 · **Passadas:** 2

## Resumo executivo

Dá para desenvolver e testar TODA a E1/E2 gastando quase zero: fal.ai dá créditos de entrada, Replicate tem créditos pequenos, e o Gemini/AI Studio dá cota diária gratuita de API para texto. A era de "imagem grátis ilimitada por API" acabou (OpenAI e Google não têm tier grátis de imagem) — o grátis serve para DESENVOLVER, não para operar.

## Tabela do grátis (para desenvolvimento/teste)

| Provedor | O que dá de graça | Serve para |
|---|---|---|
| **fal.ai** | US$10-20 em créditos no signup (US$20 com e-mail business) | desenvolver E1/E2 inteiras (centenas de imagens / dezenas de vídeos) |
| **Replicate** | créditos pequenos de entrada em centenas de modelos | testar modelos alternativos |
| **Google AI Studio (Gemini)** | ~50 requests/dia de API sem cartão (texto) | agentes de copy em dev; imagem NÃO é grátis via API |
| **Gemini app** | geração de imagem grátis no app (não API) | testes manuais de prompt |
| **Supabase / Vercel** | free tiers generosos | toda a infra até E5 |
| **Zernio** | 2 contas sociais grátis (publicação) | testar publicação na E5 |
| **Late** | vídeo em todos os planos, entrada US$19/mês | publicação barata |

## O que NÃO é grátis (não planejar em cima)

- GPT Image (OpenAI): sem tier grátis de API.
- Imagem via API do Google: "Free Tier: Not available" nas rotas principais (rota preview antiga desligada em nov/2025).
- Créditos de signup são one-shot — não são "contrato durável de free tier".

## Estratégia recomendada

1. Desenvolver com créditos fal.ai (dev inteiro da E1 cabe nos US$10-20).
2. Testes manuais de estética de prompt: apps grátis (Gemini app) antes de gastar API.
3. Texto em dev: AI Studio free tier; produção: assinatura (ver P6).
4. Orçar operação real com a tabela da P1 — o grátis não sustenta operação.

## Passada de verificação — lacunas

- [ ] Groq/Together/DeepInfra para LLM texto barato não pesquisados a fundo (relevante na E3).
- [ ] Cotas exatas do free tier do AI Studio mudam — reconferir na E3.

## Fontes

- https://www.getaiperks.com/en/ai/fal-ai-free-credits-2026 · https://www.getaiperks.com/en/blogs/27-ai-api-free-tier-credits-2026
- https://blog.laozhang.ai/en/posts/free-ai-image-generation-api · https://videoai.me/blog/free-ai-video-generation-api-developer-guide-2026
- https://ai.google.dev/gemini-api/docs/pricing · https://www.aifreeapi.com/en/posts/gemini-image-generation-free-tier
