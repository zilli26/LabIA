# LabIA — Arquitetura

## Critério das escolhas

Máxima familiaridade para qualquer IA construtora (Codex/Claude), menor atrito no Windows, menor custo fixo possível (free tiers), e nenhuma dependência da qual não se possa sair (abstrações próprias sobre agregadores).

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend + backend | **Next.js 15 (App Router) + TypeScript** | Stack que os modelos de IA mais conhecem; front e API no mesmo repo |
| UI | **Tailwind + shadcn/ui customizado** | Base produtiva, mas SEMPRE customizada pelo `DESIGN-SYSTEM.md` |
| Banco/Auth/Storage | **Supabase (Postgres) + Prisma** | Free tier generoso; auth e storage de assets inclusos; Prisma = schema legível por IA |
| Geração imagem/vídeo | **fal.ai (principal) + Replicate (secundário)** atrás de `ModelProvider` | Uma API → dezenas de modelos, pay-per-use, preços públicos (validar na pesquisa P1) |
| Agentes de texto | **Vercel AI SDK** + Anthropic/OpenAI | Streaming, tools e troca de provedor fáceis |
| Canvas de fluxos | **React Flow (@xyflow/react)** | Padrão de mercado para canvas de nós |
| Jobs assíncronos | **pg-boss** (fila em Postgres) | Vídeo é assíncrono (30s–5min); evita Redis/infra extra no início |
| Deploy | **Vercel** (app) + Supabase (dados) | Free tiers; zero DevOps no início |

## A abstração central: `ModelProvider`

> Planejamento em revisão, 2026-09-10: `docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md` propõe operação pelo ChatGPT/MCP, conexões pessoais e imagem por OAuth com base em código Hermes inspecionado. A restrição histórica “SÓ para texto” abaixo não descreve todas as capacidades atuais. Novos adaptadores, autorização e contratos ainda não estão implementados nem aprovados em spec.

Toda geração passa por uma interface própria — nunca chamar fal.ai/Replicate direto do código de feature:

```ts
interface ModelProvider {
  id: string;                        // "fal", "replicate", "local-comfy", "subscription-codex"
  listModels(kind: "image" | "video" | "text"): ModelInfo[];
  estimateCost(model: string, params: GenParams): CostEstimate;  // ANTES de gerar
  generate(model: string, params: GenParams): Promise<JobHandle>; // assíncrono
}
```

Isso garante os três backends previstos:
1. **API paga** (fal.ai, Replicate) — dia 1. (P1: fal.ai confirmado como principal.)
2. **Assinatura** (padrão Hermes) — SÓ para texto (copy/research/Director). P6 confirmou: Codex CLI (`codex exec` via OAuth do plano ChatGPT) e Claude Max headless funcionam, mas rodam num **worker local na máquina do Felipe** (processo Node consumindo a fila pg-boss), nunca na Vercel. Backend API é o fallback quando o worker está offline. Uso pessoal apenas — no SaaS (E6) migra tudo para API.
3. **Local/ComfyUI** — P7 concluiu: NÃO implementar agora (imagem local só compensa após ~130k imagens; vídeo local exige 40-80GB VRAM). A interface fica especificada; reavaliar quando o ledger passar de R$300/mês em imagem.

Cada geração persiste: prompt, modelo, params, custo estimado, custo real, asset resultante (entidade `Generation` — ver `02-MODELO-DE-DADOS.md`).

## Como os módulos conversam

```
                    ┌─────────────────────────────────────┐
                    │      03-FLUXOS (canvas React Flow)  │  ← espinha dorsal
                    │  nós de todos os outros módulos     │
                    └──┬──────┬──────┬──────┬──────┬──────┘
                       │      │      │      │      │
                 01-imagens 02-videos 04-copy 05-design 06-calendário(saída)
                       │      │      │
                       └──────┴──────┴──→ ModelProvider ──→ fal.ai / Replicate / local / assinatura
                                              │
                                          pg-boss (jobs) ──→ webhook/poll ──→ atualiza nó no canvas

  08-estrategia ──(configura marca/DNA)──→ 04-copy e 07-research
  07-research ──(pauta/insumos)──→ 03-fluxos e 06-calendario
  06-calendario ──(métricas de engajamento)──→ 08-estrategia (loop de aprendizado)
```

Regras:
- **Módulo = conjunto de nós + telas próprias opcionais.** Ex.: 01-imagens tem o nó "Gerar Imagem" E uma tela de studio/biblioteca; ambos usam o mesmo serviço interno.
- **Comunicação entre módulos é via banco (entidades compartilhadas) e via arestas do canvas** — nunca import direto de código de outro módulo além dos serviços compartilhados em `lib/`.
- **Multi-tenant desde o schema**: toda entidade tem `workspaceId` (mesmo com 1 usuário hoje) — preço de ~zero agora, evita migração dolorosa na E6.

## Estrutura de código prevista (E1+)

```
app/            # rotas Next.js (App Router)
  (studio)/     # canvas, biblioteca, studio de imagens
lib/
  providers/    # ModelProvider + implementações (fal.ts, replicate.ts, ...)
  flows/        # motor de execução de fluxos (executa grafo de nós)
  db/           # Prisma client e queries
components/
  nodes/        # componentes React Flow de cada tipo de nó
  ui/           # shadcn customizado pelo design system
prisma/schema.prisma
```

## Decisões registradas

Decisões de escopo geral viram ADRs em `docs/adr/` (uma por arquivo, com contexto → decisão → consequências). Decisões locais de módulo ficam em `modulos/<x>/decisoes.md`.
