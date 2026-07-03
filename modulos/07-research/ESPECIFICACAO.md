# 07-Research — Especificação

**Etapa:** E6 · **Dor que resolve:** social media precisa acompanhar notícias do dia/semana manualmente; pesquisa de concorrentes/mercado é cara e demorada.

## O que terá

- **Pesquisas agendadas** — usuário define tema, fontes (sites/perfis) e recorrência (diária/semanal); agente pesquisa e entrega briefing em markdown (padrão do `trend-scout` que já roda no vault).
- **Pesquisa profunda sob demanda** — concorrentes, mercado, audiência: mais passadas, mais fontes, custo maior e VISÍVEL antes de rodar ("esta pesquisa custará ~R$X").
- **Nó Research** — resultado de pesquisa como entrada de fluxo (briefing → pauta → copy → visual).
- **Feed de briefings** — histórico navegável por tema/marca; briefing pode virar Post com 1 clique.

## Regras de produto
1. Toda pesquisa cita fontes com URL e data (regra anti-alucinação).
2. Profundidade tem preço em degraus (rápida / padrão / profunda), sempre visível antes.
3. Recorrência para automaticamente se o usuário não abre os briefings por 3 ciclos (não queimar dinheiro à toa).

## Fora de escopo
Social listening em tempo real (backlog) · monitoramento de menções (backlog).
