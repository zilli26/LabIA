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
| `--lab-reagent` | `#10B981` | esmeralda: fundo de CTA primário, execução de fluxo, foco |
| `--lab-reagent-bright` | `#3DDFA6` | esmeralda claro: NÚMEROS DE CUSTO (mono), wordmark "IA", ícones ativos — nunca como fundo |
| `--lab-reagent-dim` | `rgba(16,185,129,0.12)` | fundos de chip/badge de custo |
| texto sobre reagente | `#0A0B0E` | botões primários usam texto escuro |

Regra: o reagente é RARO — custo, ação de executar e foco. Se a tela está verde demais, está errada. O par existe porque esmeralda escuro (`reagent`) não tem contraste para texto sobre dark — texto/número verde usa SEMPRE o `bright`.

> **v1.1 (2026-07-03):** verde-ácido `#A3F53C` substituído pelo par esmeralda acima, a pedido do Felipe ("menos cara de IA" — o ácido sobre preto é a identidade do Krea). Validado em tela real.

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

## Estrutura de navegação — app shell (fixado 2026-07-03)

O LabIA é um APP com páginas, não uma tela única de canvas:

- **Top bar global** (todas as páginas): wordmark LabIA à esquerda + navegação horizontal — `Início` · `Fluxos` · `Biblioteca` · itens futuros (`Copy`, `Calendário`, `Research`) visíveis porém desabilitados com tag "em breve". À direita: custo do mês (chip mono) e espaço do usuário.
- **`/` (Início)**: dashboard de entrada — boas-vindas, últimos fluxos (cards com nome/data/custo), atalho "Novo fluxo", resumo de gasto do mês. O site NUNCA abre direto no canvas.
- **`/fluxos`**: lista de fluxos (cards) → clicar abre `/fluxos/[id]` (o canvas).
- **`/fluxos/[id]` (canvas)**: SEM sidebar fixa. A paleta de nós vira botão flutuante `+ Nó` no canto do canvas que abre um menu/painel leve (fecha ao adicionar). Toolbar do fluxo (nome, custo, salvar, executar) fica numa barra fina abaixo da top bar global.
- **`/biblioteca`**: grid de assets/gerações.

Racional: sidebar fixa de paleta era peso permanente para uma ação eventual (adicionar nó); navegação por funcionalidade é o que dá cara de produto.

## UX didático do canvas (aprovado 2026-07-04, base P8 — requisitos, detalhe em modulos/03-fluxos/ESPECIFICACAO.md)

- Novo fluxo abre chooser (do zero / receita), nunca canvas vazio por padrão.
- Arrastar de porta para o vazio → picker filtrado por nós compatíveis, com custo no tooltip.
- Tooltip de nó (paleta e canvas): descrição + capacidades + custo estimado em R$ (mono, par reagente).
- Conexão inválida: bloqueio + texto curto explicando o porquê e sugerindo o caminho.
- Fases de produção como bandas discretas no fundo do canvas (nomes da ordem canônica), sem virar BPMN.
- Empty state sempre com uma receita concreta como CTA.

## Paleta contextual de produção (Bloco 0 — 2026-09-14)

O LabIA continua sendo um **laboratório noturno**: a paleta contextual organiza a bancada sem criar quatro marcas ou copiar plataformas de referência. São acentos derivados dos tokens existentes, usados em cabeçalhos de grupo, ícones, bordas discretas e badges; o reagente continua reservado a foco, execução e custo.

| Contexto | Acento existente | Uso |
|---|---|---|
| **Criar** | `#8B7CFF` (imagem) | briefing, prompt, gerar imagem, animar imagem |
| **Projeto** | `#38BDF8` (info) | fontes, Assets, imagem-base e referência visual |
| **Pós-produção** | `#FFC46B` (copy) | continuar clipe, juntar clipes e fechamento do roteiro |
| **Direção** | `#FF7AC6` (design) | proposta, shotlist, grafo e riscos do Director |

Não introduzir verde adicional para representar contexto: `--lab-reagent`/`--lab-reagent-bright` continuam exclusivos para ações e números de custo. Importação conhecida pode exibir `R$0,00`; `A calcular` continua reservado a custo ainda desconhecido.

Projeto é a casa visual da mídia: cards e cabeçalhos devem mostrar Projeto, papel do Asset e procedência. O canvas é a bancada: mantém o contexto do Projeto no toolbar e oferece retorno visível ao Projeto. Uma conexão incompatível deve receber mensagem curta e imediata junto à interação, sem esperar o salvamento.

O Production Director usa o acento de Direção para um estado **Proposta / Rascunho**. A ação `Aplicar ao Flow` deve ser visualmente distinta da execução e só aparece após revisão; custo estimado fica visível antes de qualquer porta de geração.

## A fazer na E1

- [x] Fixar paleta final (hex) e tipografia — v1, 2026-07-03
- [ ] Wordmark "LabIA" (Space Grotesk 700; "Lab" em `--lab-text`, "IA" em `--lab-reagent`; provisória até ter logo)
- [ ] Tela de referência: implementar o canvas com 3 nós reais seguindo os tokens acima — vira o padrão de todos os nós
