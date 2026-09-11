# LabIA — Arquitetura

## Critério das escolhas

Máxima familiaridade para qualquer IA construtora (Codex/Claude), menor atrito no Windows, menor custo fixo possível (free tiers), e nenhuma dependência da qual não se possa sair (abstrações próprias sobre agregadores).

## Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Frontend + backend | **Next.js 15 (App Router) + TypeScript** | Stack que os modelos de IA mais conhecem; front e API no mesmo repo |
| UI | **Tailwind + shadcn/ui customizado** | Base produtiva, mas SEMPRE customizada pelo `DESIGN-SYSTEM.md` |
| Banco/Auth/Storage | **Supabase (Postgres) + Prisma** | Free tier generoso; auth e storage de assets inclusos; Prisma = schema legível por IA |
| Geração imagem/vídeo | **Providers selecionados por nó** atrás de `ModelProvider` + `ProviderConnection` quando houver sessão/credencial | Evita lock-in e torna explícita a escolha `Provider → Conexão → Modelo`; fal.ai continua disponível, sem ser provider principal |
| Agentes de texto | **Vercel AI SDK** + providers selecionados | Streaming, tools e troca de provedor fáceis |
| Canvas de fluxos | **React Flow (@xyflow/react)** | Padrão de mercado para canvas de nós |
| Jobs assíncronos | **pg-boss** (fila em Postgres) | Vídeo é assíncrono (30s–5min); evita Redis/infra extra no início |
| Deploy | **Vercel** (app) + Supabase (dados) | Free tiers; zero DevOps no início |

## A abstração central: `ModelProvider` + `ProviderConnection`

> **Decisão vigente desde 2026-09-11 — ADR 0002:** o LabIA não possui provider principal. Cada nó gerativo seleciona explicitamente `Provider → Conexão → Modelo`. fal.ai permanece disponível; uma conexão OpenAI/ChatGPT não substitui outra integração e não cria fallback automático para API paga.

`ModelProvider` continua isolando o protocolo de geração. `ProviderConnection` passa a representar qual sessão/credencial autorizada um provider usa quando a integração exige conexão específica. A migração dos nós legados para persistir `provider + connectionId + model` é posterior a O1; grafos existentes continuam com o comportamento já salvo até essa migração deliberada.

Contrato existente de provider:

```ts
interface ModelProvider {
  id: string;
  listModels(kind: "image" | "video" | "text"): ModelInfo[];
  estimateCost(model: string, params: GenParams): CostEstimate;  // ANTES de gerar
  generate(model: string, params: GenParams): Promise<JobHandle>; // assíncrono
}
```

A seleção de execução converge para:

```text
NodeSelection
  provider
  connectionId?  -> ProviderConnection
  model
```

Isso permite três famílias sem transformar nenhuma em default global:

1. **API paga / gateways** — fal.ai já implementada; Replicate e outras integrações entram quando houver etapa aprovada. Cada uso pago mantém estimativa antes e custo real depois.
2. **Conexões pessoais por assinatura** — O1 inicia com OpenAI/ChatGPT via `codex app-server` num executor local e sessão dedicada. O App Server gerencia OAuth/refresh; o LabIA guarda só referência opaca. API paga só pode ser usada por seleção/autorização explícita — nunca como fallback automático quando o executor pessoal estiver offline.
3. **Local/ComfyUI** — P7 concluiu: NÃO implementar agora (imagem local só compensa após ~130k imagens; vídeo local exige 40-80GB VRAM). A interface fica especificada; reavaliar quando o ledger passar de R$300/mês em imagem.

Cada geração persiste: prompt, provider, modelo, params, custo estimado, custo real, asset resultante (entidade `Generation` — ver `02-MODELO-DE-DADOS.md`). Quando a migração de seleção por conexão chegar aos nós, `connectionId` também precisa ficar preservado no snapshot executável do `FlowRun` para reproduzibilidade.

### O1 — conexão OpenAI/ChatGPT local

O1 adiciona `ProviderConnection` e um cliente do Codex App Server por stdio. A autenticação usa `CODEX_HOME` exclusivo do LabIA; não lê/copia a sessão atual do Codex. A conexão é independente dos workers de geração e possui três provas separadas:

- conta conectada;
- capacidade específica verificada (por exemplo imagem);
- geração real validada.

Em O1, login não promove capacidade de imagem e nenhuma geração é executada. Ver `docs/O1-OPENAI-OAUTH-ESPECIFICACAO.md`.

## Como os módulos conversam

```text
                    ┌─────────────────────────────────────┐
                    │      03-FLUXOS (canvas React Flow)  │  ← espinha dorsal
                    │  nós de todos os outros módulos     │
                    └──┬──────┬──────┬──────┬──────┬──────┘
                       │      │      │      │      │
                 01-imagens 02-videos 04-copy 05-design 06-calendário(saída)
                       │      │      │
                       └──────┴──────┴──→ seleção Provider → Conexão → Modelo
                                              │
                                          ModelProvider
                                              │
                                  fal.ai / OpenAI local / futuros providers
                                              │
                                          pg-boss (jobs de geração)
```

A gestão de `ProviderConnection` roda fora do worker de geração. Login/logout/reconexão não consomem a fila pg-boss.

Regras:
- **Módulo = conjunto de nós + telas próprias opcionais.** Ex.: 01-imagens tem o nó "Gerar Imagem" E uma tela de studio/biblioteca; ambos usam o mesmo serviço interno.
- **Comunicação entre módulos é via banco (entidades compartilhadas) e via arestas do canvas** — nunca import direto de código de outro módulo além dos serviços compartilhados em `lib/`.
- **Multi-tenant desde o schema**: toda entidade tem `workspaceId` (mesmo com 1 usuário hoje) — preço de ~zero agora, evita migração dolorosa na E6. O1 ainda não implementa membership de usuário; usa `ownerKey` local configurado + `workspaceId` e registra essa limitação explicitamente.

## Estrutura de código prevista (E1+)

```text
app/            # rotas Next.js (App Router)
  (studio)/     # canvas, biblioteca, studio de imagens, conexões locais
lib/
  providers/    # ModelProvider + implementações + ProviderConnection/executores locais
  flows/        # motor de execução de fluxos (executa grafo de nós)
  db/           # Prisma client e queries
components/
  nodes/        # componentes React Flow de cada tipo de nó
  providers/    # controles de conexão/provider
  ui/           # shadcn customizado pelo design system
prisma/schema.prisma
```

## Decisões registradas

Decisões de escopo geral viram ADRs em `docs/adr/` (uma por arquivo, com contexto → decisão → consequências). Decisões locais de módulo ficam em `modulos/<x>/decisoes.md`.

- ADR 0002 (2026-09-11): provider por nó, sem provider principal; fal.ai preservada; conexão OpenAI local não vira fallback pago.
