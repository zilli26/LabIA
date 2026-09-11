# LabIA — Mapa de provedores e conexões

> Mapa vivo: o que cada tipo de nó precisa para funcionar — provider, conexão, modelo, custo e status.
> Números vêm de P1/P5/P6 (2026-07-02, câmbio ~R$5,40) e da tarefa 0 do módulo 02 (2026-07-04). NUNCA preencher de memória de IA; só com fonte e data.
> Atualizado: 2026-09-11.

## Como pensar os provedores

**Não existe provider principal do LabIA.** Desde a ADR 0002 (2026-09-11), cada nó gerativo escolhe explicitamente:

`Provider → Conexão → Modelo`

fal.ai continua disponível como gateway de muitos modelos, mas não ocupa posição canônica acima das demais integrações. Uma conexão por assinatura não substitui fal.ai silenciosamente e falha de uma conexão pessoal não autoriza fallback automático para API paga.

| Provider / gateway | Papel atual | Estado |
|---|---|---|
| **fal.ai** | gateway de geração já implementado para imagem/vídeo | disponível no comportamento legado atual |
| **OpenAI/ChatGPT via Codex App Server** | conexão pessoal local gerida por `ProviderConnection` | O1: gestão de login implementada; capacidade de imagem ainda não verificada; geração não habilitada |
| **Replicate** | provider planejado para modelos abertos/volume | a integrar em etapa posterior |
| **EvoLink/OpenRouter** | candidato de avaliação para modelos futuros | não implementar em O1 |

## ProviderConnection

Uma conexão representa a autorização/sessão usada por um provider para um `workspaceId` + dono. O banco guarda apenas referência opaca e estados; tokens/sessão ficam sob responsabilidade do executor apropriado.

Estados de prova são separados:

1. **Conta conectada** — autenticação concluída naquele executor/provider.
2. **Capacidade verificada** — a conexão comprovadamente possui uma capacidade específica, como imagem.
3. **Geração real validada** — uma geração autorizada foi de fato executada e persistida.

O1 só implementa a primeira infraestrutura. Login OpenAI/ChatGPT não marca imagem como disponível e não roda geração.

## O que cada nó precisa (nó → provider/conexão/modelo → custo)

| Nó (canvas) | Etapa | Provider / conexão | Custo típico | Status |
|---|---|---|---|---|
| Prompt | E1 | — (local) | R$0 | ✅ no canvas |
| Gerar Imagem (FLUX dev) | E1 | fal.ai / chave existente / FLUX dev | ~R$0,14/img | ✅ comportamento legado atual |
| Gerar Imagem (Nano Banana 2) | E1 | fal.ai / chave existente / Nano Banana 2 | ~R$0,43/img | ✅ comportamento legado atual |
| OpenAI/ChatGPT — conexão | O1 | `openai-codex` / `ProviderConnection` / modelo não habilitado | sem geração em O1 | 🧪 conexão implementada; login real pendente; imagem não verificada |
| Comparar / Referência (img2img) | E1 | seleção futura por provider/conexão/modelo | por modelo | ⏳ tarefa 6 |
| Imagem barata/volume (FLUX schnell) | pós-E1 | Replicate futuro | ~R$0,02/img (referência histórica P1) | 📋 backlog |
| img2video/txt2video (Wan 2.5 Preview) | E2 | fal.ai | US$0,05/s 480p · US$0,10/s 720p · US$0,15/s 1080p (fonte histórica 2026-07-04) | 📋 catalogado |
| img2video/txt2video (Kling 2.5 Turbo Pro) | E2 | fal.ai | US$0,35/5s + US$0,07/s adicional; 10s = US$0,70 (fonte histórica 2026-07-04) | 📋 catalogado |
| img2video/txt2video (Hailuo 2.3 Standard / MiniMax) | E2 | fal.ai | US$0,28/6s · US$0,56/10s; variante Pro: US$0,49/geração (fonte histórica 2026-07-04) | 📋 catalogado |
| img2video/txt2video/reference (Seedance 2.0) | E2 | fal.ai no mapa histórico; integração direta não autorizada em O1 | preços históricos no levantamento de 2026-07-04 | 📋 fora de O1 |
| img2video/txt2video (Veo 3) | E2 | fal.ai no comportamento catalogado | preços históricos no levantamento de 2026-07-04 | 📋 catalogado |
| Copy / roteiro / gancho | E3 | provider/conexão/modelo explícitos | depende da conexão selecionada | 📋 E3 |
| Publicação multi-rede | E5 | decisão pendente | — | 📋 E5 |

Infra de geração existente: Supabase (`DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`) + `USD_BRL_RATE`. O1 acrescenta configuração local do Codex App Server em `.env.example`, sem transformar credencial ChatGPT em API key.

## O1 — isolamento da sessão ChatGPT

- `codex app-server` roda por stdio em processo local independente do worker de geração;
- cada `ProviderConnection` recebe `CODEX_HOME` dedicado sob a raiz do LabIA;
- o processo não herda `CODEX_HOME`, `OPENAI_API_KEY` ou `CODEX_API_KEY` da sessão atual;
- o App Server gerencia OAuth, refresh e logout;
- iniciar login não lê nem consome filas de geração;
- produção/Vercel não inicia esse executor local.

Ver `docs/O1-OPENAI-OAUTH-ESPECIFICACAO.md` e ADR 0002.

## Custo de campanha inteira (norte de produto)

O motor já estima o custo de UM fluxo inteiro antes de rodar (`estimateFlowCost` soma nó a nó) e registra custo real por geração. O que falta para "campanha do começo ao fim" (copy + carrossel + vídeo):

1. Nós de vídeo (E2) e copy (E3) existirem — cada um nasce com `estimateCost` quando houver custo mensurável.
2. Um agregado acima do fluxo (Campanha = N fluxos) somando estimado vs. real — candidato natural de spec para a E4/E5.
3. Nós migrarem do comportamento legado para persistir `provider + connectionId + model` no snapshot executável.

## Regras que este mapa obedece

- **Provider por nó:** nenhuma integração é default global invisível.
- **Custo visível:** estimativa ANTES e real DEPOIS quando houver cobrança por geração.
- **Sem fallback pago automático:** indisponibilidade de assinatura/conexão não autoriza gasto em API.
- **Capacidade precisa ser provada:** login não equivale a imagem/vídeo/texto disponível.
- **Não comprar GPU agora** (P7): decisão histórica preservada até nova revisão econômica.
