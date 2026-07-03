# LabIA — Design System (direção de arte)

> Status: v0 — direções definidas; tokens finais serão fixados no início da E1, ANTES de qualquer tela.

## Conceito

**"Laboratório noturno"**: o lugar onde um social media experimenta, mistura e destila conteúdo. Escuro, preciso, com energia de experimento — não corporativo, não template, não "SaaS pastel genérico".

## Direções (a fixar na E1)

- **Base dark** quase-preto com temperatura fria (ex.: `#0A0B0E` → `#12141A`), superfícies em camadas sutis, sem cinza chapado.
- **1 cor de assinatura** vibrante para ação/energia (candidatas: verde-ácido de laboratório, ciano elétrico ou âmbar químico) + estados semânticos discretos. A cor de assinatura marca: custo, execução de fluxo, CTAs.
- **Tipografia**: display com personalidade para títulos (ex.: Space Grotesk) + sans neutra para UI (ex.: Inter) + **mono** para números de custo, prompts e IDs (a estética de "precisão de laboratório").
- **Canvas como protagonista**: o canvas de fluxos é a tela mais importante do produto; nós com hierarquia visual clara por tipo (imagem/vídeo/copy/publicação), arestas animadas durante execução, custo acumulado sempre visível no canto.
- **Microdetalhes de laboratório**: grid sutil de fundo no canvas, badges de modelo (Flux, Kling...) como "reagentes", progresso de geração com feel de processo químico — personalidade sem infantilizar.

## Regras duras

1. Nenhuma tela nova sem consultar este arquivo; tokens ficam em `tailwind.config`/CSS vars — nunca hardcode de cor em componente.
2. shadcn/ui é ponto de partida, **sempre** re-tematizado (radius, cores, sombras próprias). Se parece com a doc do shadcn, está errado.
3. Números de custo SEMPRE em mono, sempre com a cor de assinatura quando ativos.
4. Dark é o modo primário (light mode não é prioridade até E6).
5. Na construção com Claude, usar a skill `frontend-design` para as telas.

## A fazer na E1 (tarefa de abertura da etapa)

- [ ] Fixar paleta final (hex) e tipografia (importações)
- [ ] Logo/marca "LabIA" (ao menos wordmark provisória de qualidade)
- [ ] Tela de referência: o canvas com 3 nós estilizados — vira o padrão visual de todos os nós
