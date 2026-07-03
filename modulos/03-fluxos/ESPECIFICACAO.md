# 03-Fluxos — Especificação (a espinha dorsal)

**Etapa:** E1 (fundação) e evolui em todas · **Dor que resolve:** pipeline fragmentado em 5+ ferramentas; falta de "AI Video Director"; retrabalho e queima de tokens sem direção.

## O que terá

### O canvas (E1)
- Canvas React Flow: adicionar/conectar/executar nós; salvar fluxo (`Flow`); executar (`FlowRun`) com status visual por nó (aguardando/rodando/pronto/erro).
- **Custo acumulado do fluxo** sempre visível (estimado antes, real durante/depois).
- Execução assíncrona: usuário pode sair da página; fluxo continua (pg-boss).
- Nós de utilidade: entrada de texto, upload, anotação.

### Templates de fluxo (E2+)
Fluxos prontos que abrem pré-montados: **Campanha de produto** (foto produto → cenários → variações + copy), **Vídeo contínuo 30s+**, **Post completo** (copy → imagem → proporções), **Carrossel**.

### AI Video Director (E3)
Nó-agente que recebe briefing (objetivo, produto, referências, duração) e PRODUZE o fluxo: shotlist (beats), prompts por cena com refs nomeadas, escolha de modelo por cena e **estimativa de custo total antes de gerar qualquer coisa**. Origem: spec do vault (`fluxos-video-ia-pipeline.md`) — o elo que falta entre roteiro e geração, onde o Felipe já queimou 2,5M+ tokens sem direção.

## Regras de produto
1. Todo nó declara: entradas tipadas, saídas tipadas, custo estimado. O motor valida conexões por tipo (copy não liga direto em montagem, etc.).
2. FlowRun é reproduzível: o grafo + params ficam versionados no run.
3. Um fluxo pode ser executado parcialmente (só um ramo / só um nó).

## Fora de escopo
- Nós de terceiros/marketplace (futuro distante) · agendamento de fluxo recorrente (entra com 07-research).
