# LabIA — Mapa de provedores e conexões

> Mapa vivo: o que cada tipo de nó precisa para funcionar — provedor, chave, custo, status.
> Números vêm de P1/P5/P6 (2026-07-02, câmbio ~R$5,40) e da tarefa 0 do módulo 02 (2026-07-04). NUNCA preencher de memória de IA; só com fonte e data.
> Atualizado: 2026-07-04.

## Como pensar os provedores

**fal.ai não é "uma IA" — é um agregador (gateway).** Uma chave (`FAL_KEY`) dá acesso a dezenas de modelos de imagem e vídeo (FLUX, Nano Banana, Kling, Veo, Wan...), com preço público por output. Por isso ele é o gateway principal (decisão da P1): 1 chave, 1 integração, N modelos. O código já isola isso atrás da interface `ModelProvider` (`lib/providers/`) — trocar ou somar provedor não mexe nos nós do canvas.

| Gateway | Papel | Por quê (P1) |
|---|---|---|
| **fal.ai** | principal | maior catálogo de vídeo, preço público por output, padrão do mercado de apps de geração |
| **Replicate** | secundário (a integrar) | modelos abertos; tem o FLUX schnell a US$0.003/img — a imagem mais barata do mapa (~R$0,02) |
| **EvoLink/OpenRouter** | avaliar na E2 | Seedance 2.0 vídeo a ~US$0.045/s |

fal.ai NÃO é o mais barato em tudo: para volume de imagem barata, Replicate (FLUX schnell) ganha por ~8x. A estratégia é: fal.ai pela amplitude, Replicate como nó "barato/volume" quando a E1 fechar.

## O que cada nó precisa (nó → chave → custo)

| Nó (canvas) | Etapa | Provedor | Chave (.env.local) | Custo típico | Status |
|---|---|---|---|---|---|
| Prompt | E1 | — (local) | — | R$0 | ✅ no canvas |
| Gerar Imagem (FLUX dev) | E1 | fal.ai | `FAL_KEY` | ~R$0,14/img | ✅ no canvas, aguarda saldo |
| Gerar Imagem (Nano Banana 2) | E1 | fal.ai | `FAL_KEY` | ~R$0,43/img | ✅ no canvas, aguarda saldo |
| Comparar / Referência (img2img) | E1 | fal.ai | `FAL_KEY` | por modelo | ⏳ tarefa 6 |
| Imagem barata/volume (FLUX schnell) | pós-E1 | Replicate | `REPLICATE_API_TOKEN` (futura) | ~R$0,02/img | 📋 backlog |
| img2video/txt2video (Wan 2.5 Preview) | E2 | fal.ai | `FAL_KEY` | US$0,05/s 480p · US$0,10/s 720p · US$0,15/s 1080p (fal.ai, acesso 2026-07-04) | 📋 tarefa 0: catalogado; áudio nativo não confirmado, só `audio_url` de entrada |
| img2video/txt2video (Kling 2.5 Turbo Pro) | E2 | fal.ai | `FAL_KEY` | US$0,35/5s + US$0,07/s adicional; 10s = US$0,70 (fal.ai, acesso 2026-07-04) | 📋 tarefa 0: catalogado; sem áudio nativo no endpoint geral; extend nativo não confirmado na fal.ai |
| img2video/txt2video (Hailuo 2.3 Standard / MiniMax) | E2 | fal.ai | `FAL_KEY` | US$0,28/6s · US$0,56/10s; variante Pro: US$0,49/geração (fal.ai, acesso 2026-07-04) | 📋 tarefa 0: catalogado; áudio nativo ficou lacuna em doc pública |
| img2video/txt2video/reference (Seedance 2.0) | E2 | fal.ai | `FAL_KEY` | US$0,3034/s 720p com áudio; fast US$0,2419/s; 1080p US$0,682/s; conflito: página i2v lista US$0,3024/s (fal.ai, acesso 2026-07-04) | 📋 tarefa 0: catalogado; áudio nativo via `generate_audio`; reference-to-video cobre extensão |
| img2video/txt2video (Veo 3) | E2 | fal.ai | `FAL_KEY` | US$0,20/s sem áudio · US$0,40/s com áudio; conflito no Readme: Standard US$0,50/0,75 e Fast US$0,25/0,40 (fal.ai, acesso 2026-07-04) | 📋 tarefa 0: catalogado; áudio nativo via `generate_audio`; extend nativo não confirmado na fal.ai |
| Copy / roteiro / gancho | E3 | assinatura (Codex CLI / Claude headless via worker local — padrão Hermes, P6) | OAuth dos planos | ~R$0 (uso pessoal) | 📋 E3; no SaaS vira API |
| Publicação multi-rede | E5 | decisão pendente (P3: API oficial vs. agregador tipo Zernio) | — | — | 📋 E5 |

Infra (sempre): Supabase (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) + `USD_BRL_RATE`. Tudo documentado em `.env.example`.

## Custo de campanha inteira (norte de produto)

O motor já estima o custo de UM fluxo inteiro antes de rodar (`estimateFlowCost` soma nó a nó) e o `CreditLedger` registra o custo real de cada geração desde o dia 1. O que falta para "campanha do começo ao fim" (copy + carrossel + vídeo):

1. Nós de vídeo (E2) e copy (E3) existirem — cada um já nasce com `estimateCost`, é requisito de arquitetura.
2. Um agregado acima do fluxo (Campanha = N fluxos) somando estimado vs. real — candidato natural de spec para a E4/E5.

Referência de hoje (P1): um post com 1 imagem boa + vídeo 30s custa de ~R$4,50 (Wan) a ~R$65 (Veo 3). Carrossel de 6 slides em FLUX dev: ~R$0,85.

## Regras que este mapa obedece

- **Custo visível** (docs/04): estimativa ANTES, real DEPOIS, em toda geração.
- **Não comprar GPU** (P7): API vence até ~130k imagens/mês; reavaliar se CreditLedger passar de R$300/mês só de imagem.
- **Grátis é para desenvolver, não operar** (P5).
