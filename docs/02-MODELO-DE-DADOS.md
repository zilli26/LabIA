# LabIA — Modelo de Dados (entidades compartilhadas)

> Nível conceitual. O schema Prisma real nasce na E1 seguindo este contrato.
> Regra: TODA entidade carrega `workspaceId` (multi-tenant desde o dia 1, mesmo com usuário único).

## Núcleo

- **Workspace** — o tenant. Hoje: 1 (do Felipe). Futuro: 1 por cliente do SaaS. Carrega configurações e saldo de créditos.
- **User** — usuário autenticado (Supabase Auth). Pertence a 1+ workspaces com papel (owner/member).
- **Brand** — marca gerenciada no workspace (Felipe-Creator, PagFinance, Vega...). Carrega o **DNA**: tom de voz, pilares, proibições, corpus de exemplos (importável do vault ClaudeObisidian). É a entidade que dá "voz" a toda copy.

## Produção

- **Asset** — qualquer mídia na biblioteca (imagem, vídeo, áudio). Campos: tipo, url (Supabase Storage), origem (gerado/upload), tags, brandId opcional.
- **Generation** — um ato de geração via IA. Campos: provider, modelo, prompt, params, custo estimado, custo real (US$ e R$), status (queued/running/done/failed), assetId resultante, flowRunId opcional. **É o registro que torna o custo visível.**
- **Flow** — um fluxo salvo no canvas: grafo JSON de nós e arestas (formato React Flow) + metadados (nome, template?, brandId).
- **FlowRun** — uma execução de um Flow: status por nó, custo total acumulado, outputs. Executada via pg-boss.
- **CopyDoc** — texto produzido (post, roteiro por beats, CTA, estratégia): conteúdo, tipo, brandId, formato validado usado, score anti-IA.

## Distribuição

- **SocialAccount** — conexão com rede social (Instagram, X, TikTok, LinkedIn...): tokens, status. (Detalhes dependem da pesquisa P3 — API oficial vs. agregador.)
- **Post** — unidade do calendário: conteúdo final (copy + assets com proporção por rede), redes-alvo, status (rascunho/aprovação/agendado/publicado/falhou), scheduledAt, métricas pós-publicação (likes, comments, saves, alcance — alimenta o loop de aprendizado).
- **ApprovalLink** — link compartilhável para cliente aprovar posts (fase tardia).

## Inteligência

- **ResearchJob** — pesquisa agendada ou sob demanda: tema, fontes, recorrência, profundidade (rápida/completa), custo, resultado (markdown).
- **Strategy** — estratégia gerada para uma marca: objetivo, base teórica usada, pilares, mix de conteúdo, período. Conecta-se a Posts via pauta.
- **Credit / CreditLedger** — saldo e extrato de créditos do workspace (E6, mas o schema nasce junto: cada Generation debita do ledger desde o início, mesmo que "grátis" para o Felipe).

## Relações-chave

```
Workspace 1─N Brand 1─N CopyDoc / Strategy
Workspace 1─N Asset ←1─1 Generation N─1 FlowRun N─1 Flow
Brand 1─N Post N─N SocialAccount
Post N─1 CopyDoc, Post N─N Asset
Workspace 1─1 CreditLedger 1─N entries ←── Generation
```
