# 03-Fluxos — Decisões

- **2026-07-02 · Canvas é E1, não E2** (ADR 0001). Fluxo visual é o paradigma da plataforma; tudo nasce como nó.
- **2026-07-02 · Registry de nós com contrato tipado.** Por quê: módulos plugam nós sem tocar no motor; qualquer IA adiciona um nó lendo só o contrato.
- **2026-07-02 · Video Director propõe, humano aprova.** Por quê: custo de vídeo é alto; geração cega já queimou 2,5M tokens no passado do Felipe. Nada executa sem aprovação do fluxo proposto.
- **2026-07-04 · Template = `FlowTemplate` versionado + manifest de placeholders declarados** (não `Flow.isTemplate`, não `{{var}}` solto em string como fonte de verdade). Por quê (P9): manifest declarado permite formulário, validação de obrigatórios, custo antes de rodar e highlight visual; versão imutável mantém FlowRun antigo explicável. Aprovado pelo Felipe.
- **2026-07-04 · Didática do canvas: as 10 recomendações da P8 entram como requisito de produto** (Felipe pediu todas, não só as top 5). Por quê: a dor real é o canvas vazio; a ordem canônica de produção (briefing → direção → geração → curadoria → montagem → publicação → aprendizado) vira a linguagem da UI. Curadoria barata antes de gasto caro (padrão Higgsfield Shots) é regra de economia, não estética.
- **2026-07-04 · Biblioteca de templates nasce curada e interna; marketplace só após validação por uso real.** Por quê (P9): vender marketplace sem templates provados inverte a ordem do valor.

- **2026-09-13 · O5-P0 usa control-plane outbound com segredo hasheado.** Por quê: a preview precisa ler presença e capacidades sem expor localhost ou permitir que a Vercel chame `127.0.0.1`; o executor só declara estado conhecido e não recebe jobs/comandos neste corte.
- **2026-09-13 · Hardening O5-P0 exige snapshot allowlisted/sanitizado e sequência monotônica atômica.** Por quê: resposta pública não pode carregar credenciais ou evidências sensíveis, e heartbeat repetido/fora de ordem não pode reabrir estado antigo; estado publicado vem do Codex App Server real, com TTL para offline.
