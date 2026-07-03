# LabIA — Design System (direção de arte)

> Status: **v1 — tokens fixados em 2026-07-03.** Toda tela consome estes valores via CSS vars/tailwind.config. Mudança de token = commit próprio com justificativa.

## Conceito

**"Laboratório noturno"**: o lugar onde um social media experimenta, mistura e destila conteúdo. Escuro, preciso, com energia de experimento — não corporativo, não template, não "SaaS pastel genérico".

## Tokens (v1)

### Cores — base (dark, modo primário)

| Token | Hex | Uso |
|---|---|---|
| `--lab-bg` | `#0A0B0E` | fundo da página e do canvas |
| `--lab-surface-1` | `#12141A` | painéis, sidebar, cards |
| `--lab-surface-2` | `#1A1D26` | corpo dos nós, popovers, inputs |
| `--lab-border` | `#262A35` | hairlines padrão |
| `--lab-border-strong` | `#343947` | hover/divisores fortes |
| `--lab-text` | `#E9ECF2` | texto primário |
| `--lab-text-dim` | `#9AA3B5` | texto secundário |
| `--lab-text-muted` | `#5D6577` | hints, placeholders |

### Cor de assinatura — "reagente"

| Token | Hex | Uso |
|---|---|---|
| `--lab-reagent` | `#A3F53C` | verde-ácido: custo, execução de fluxo, CTA primário, foco |
| `--lab-reagent-dim` | `rgba(163,245,60,0.12)` | fundos de chip/badge de custo |
| texto sobre reagente | `#0A0B0E` | botões primários usam texto escuro |

Regra: o reagente é RARO — custo, ação de executar e foco. Se a tela está verde demais, está errada.

### Semânticas (discretas)

`--lab-success #4ADE80` · `--lab-warning #FBBF24` · `--lab-danger #FB7185` · `--lab-info #38BDF8`

### Acentos por tipo de nó (borda superior + ícone do nó)

| Tipo | Hex |
|---|---|
| imagem | `#8B7CFF` (violeta) |
| vídeo | `#4DD8FF` (ciano) |
| copy | `#FFC46B` (âmbar) |
| design | `#FF7AC6` (rosa) |
| publicação | `#5EE38B` (verde) |
| utilitário | `#9AA3B5` (neutro) |

### Tipografia

- **Display/títulos**: Space Grotesk (500/700) — Google Fonts
- **UI/corpo**: Inter (400/500) — Google Fonts
- **Mono**: JetBrains Mono — OBRIGATÓRIA para custos, prompts, seeds e IDs

### Forma e canvas

- Radius: nós `12px`, controles `8px`, chips/pills `999px`
- Canvas: dot-grid `#1B1E27` (16px), zoom com grid persistente
- Nós: fundo `--lab-surface-2`, borda `--lab-border`, faixa superior de 2px na cor do tipo; estado "rodando" = borda `--lab-reagent` com pulso sutil; erro = borda `--lab-danger`
- Arestas: `#343947`; durante execução animam no tom do tipo de nó de origem
- **Chip de custo** (canto do nó e do canvas): mono, `--lab-reagent` sobre `--lab-reagent-dim`, formato `~R$0,43` antes / `R$0,41 ✓` depois
- Badges de modelo ("reagentes"): pill mono minúscula com nome do modelo (FLUX, KLING...)

## Regras duras

1. Nenhuma tela nova sem consultar este arquivo; tokens ficam em `tailwind.config`/CSS vars — nunca hardcode de cor em componente.
2. shadcn/ui é ponto de partida, **sempre** re-tematizado (radius, cores, sombras próprias). Se parece com a doc do shadcn, está errado.
3. Números de custo SEMPRE em mono, sempre com a cor de assinatura quando ativos.
4. Dark é o modo primário (light mode não é prioridade até E6).
5. Na construção com Claude, usar a skill `frontend-design` para as telas.

## A fazer na E1

- [x] Fixar paleta final (hex) e tipografia — v1, 2026-07-03
- [ ] Wordmark "LabIA" (Space Grotesk 700; "Lab" em `--lab-text`, "IA" em `--lab-reagent`; provisória até ter logo)
- [ ] Tela de referência: implementar o canvas com 3 nós reais seguindo os tokens acima — vira o padrão de todos os nós
