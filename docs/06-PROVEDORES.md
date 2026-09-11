# LabIA — Mapa de provedores e conexões

> Mapa vivo: o que cada tipo de nó precisa para funcionar — provedor, conexão, modelo, custo, status.
> Números vêm de P1/P5/P6 (2026-07-02, câmbio ~R$5,40) e da tarefa 0 do módulo 02 (2026-07-04). NUNCA preencher de memória de IA; só com fonte e data.
> Atualizado: 2026-09-11 para refletir a decisão Provider → Conexão → Modelo. Os preços históricos abaixo continuam com suas datas originais e precisam ser reconfirmados antes de gasto.

## Como pensar os provedores

**Decisão vigente desde 2026-09-11: não existe provider principal do LabIA.** Cada nó gerativo escolhe **Provider → Conexão → Modelo**. A decisão anterior da P1 de tratar fal.ai como "gateway principal" fica preservada como histórico de implementação, mas está superada como regra de produto.

**fal.ai não é "uma IA" — é um agregador (gateway).** Uma chave (`FAL_KEY`) dá acesso a dezenas de modelos de imagem e vídeo. Ele continua importante pelo catálogo e o código existente continua funcionando atrás de `ModelProvider`; O1 não remove nem desativa esse caminho.

| Provider/gateway | Papel atual | Observação |
|---|---|---|
| **fal.ai** | provider/conexão disponível | caminho legado já implementado para imagem/vídeo; não é default global de produto |
| **OpenAI / ChatGPT pessoal** | conexão O1 | autenticação local implementada; capability de imagem e geração real permanecem não verificadas até testes próprios |
| **Replicate** | a integrar | modelos abertos; referência histórica de imagem barata da P1 |
| **EvoLink/OpenRouter** | avaliar | alternativas de acesso a modelos conforme etapa e fonte atualizada |

A escolha de provider não cria fallback automático. Em especial, uma conexão por assinatura nunca deve cair silenciosamente em API paga; qualquer troca que possa gerar cobrança exige nova estimativa/autorização.

## O que cada nó precisa (estado legado + direção vigente)

Os nós existentes abaixo ainda refletem o caminho já implementado na fal.ai. A migração para Provider → Conexão → Modelo será feita depois da O1, preservando fluxos salvos.

| Nó (canvas) | Etapa | Provider atual | Credencial/conexão atual | Custo típico histórico | Status |
|---|---|---|---|---|---|
| Prompt | E1 | — (local) | — | R$0 | ✅ no canvas |
| Gerar Imagem (FLUX dev) | E1 | fal.ai | `FAL_KEY` | ~R$0,14/img | ✅ caminho legado no canvas |
| Gerar Imagem (Nano Banana 2) | E1 | fal.ai | `FAL_KEY` | ~R$0,43/img | ✅ caminho legado no canvas |
| Comparar / Referência (img2img) | E1 | fal.ai | `FAL_KEY` | por modelo | ⏳ tarefa 6 |
| Imagem barata/volume (FLUX schnell) | pós-E1 | Replicate | `REPLICATE_API_TOKEN` (futura) | ~R$0,02/img | 📋 backlog |
| img2video/txt2video (Wan 2.5 Preview) | E2 | fal.ai | `FAL_KEY` | US$0,05/s 480p · US$0,10/s 720p · US$0,15/s 1080p (fal.ai, acesso 2026-07-04) | catálogo legado |
| img2video/txt2video (Kling 2.5 Turbo Pro) | E2 | fal.ai | `FAL_KEY` | US$0,35/5s + US$0,07/s adicional; 10s = US$0,70 (fal.ai, acesso 2026-07-04) | catálogo legado |
| img2video/txt2video (Hailuo 2.3 Standard / MiniMax) | E2 | fal.ai | `FAL_KEY` | US$0,28/6s · US$0,56/10s; variante Pro: US$0,49/geração (fal.ai, acesso 2026-07-04) | catálogo legado |
| img2video/txt2video/reference (Seedance 2.0) | E2 | fal.ai | `FAL_KEY` | US$0,3034/s 720p com áudio; fast US$0,2419/s; 1080p US$0,682/s; conflito histórico documentado | catálogo legado |
| img2video/txt2video (Veo 3) | E2 | fal.ai | `FAL_KEY` | US$0,20/s sem áudio · US$0,40/s com áudio; conflito histórico documentado | catálogo legado |
| Conexão ChatGPT | O1 | OpenAI/ChatGPT | `ProviderConnection` + `CODEX_HOME` dedicado | nenhum gasto gerativo autorizado em O1 | ✅ código de conexão; login real pendente; imagem não verificada |
| Copy / roteiro / gancho | E3 | a escolher por nó | conexão específica | desconhecido até rota escolhida | 📋 futuro |
| Publicação multi-rede | E5 | decisão pendente | — | — | 📋 E5 |

Infra (sempre): Supabase (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) + `USD_BRL_RATE`. Conexões pessoais O1 também usam tokens locais não públicos documentados em `.env.example`.

## Estado da conexão não é capability

Para qualquer `ProviderConnection`, manter separados:

1. **conta conectada** — autenticação/sessão válida;
2. **capacidade disponível** — recurso específico comprovado naquela conexão;
3. **geração real validada** — chamada real executada e resultado recuperado em teste autorizado.

O1 pode terminar com a conta ChatGPT conectada e, ainda assim, `image_generation = unverified` e geração real `unvalidated`.

## Custo de campanha inteira (norte de produto)

O motor já estima o custo de UM fluxo inteiro antes de rodar (`estimateFlowCost` soma nó a nó) e o `CreditLedger` registra o custo real de cada geração desde o dia 1. O que falta para "campanha do começo ao fim" (copy + carrossel + vídeo):

1. resolver Provider → Conexão → Modelo em todos os nós gerativos sem default implícito;
2. nós de copy/demais módulos existirem com `estimateCost` adequado à conexão escolhida;
3. um agregado acima do fluxo (Campanha = N fluxos) somando estimado vs. real — candidato natural de spec para a E4/E5.

Os valores antigos de P1 continuam úteis como registro histórico, não como orçamento atual. Toda geração futura reconfirma preço/cota antes da autorização.

## Regras que este mapa obedece

- **Sem provider principal**: Provider → Conexão → Modelo por nó.
- **Sem fallback pago silencioso**: mudança de rota/cobrança exige nova autorização.
- **Custo visível** (docs/04): estimativa ANTES, real DEPOIS, em toda geração.
- **Login ≠ capability ≠ geração validada.**
- **Não comprar GPU** (P7): reavaliar economia com dados reais de uso, não apenas referências antigas.
- **Grátis é para desenvolver, não operar** (P5).
