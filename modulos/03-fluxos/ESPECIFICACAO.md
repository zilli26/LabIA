# 03-Fluxos — Especificação (a espinha dorsal)

**Etapa:** E1 (fundação) e evolui em todas · **Dor que resolve:** pipeline fragmentado em 5+ ferramentas; falta de "AI Video Director"; retrabalho e queima de tokens sem direção.

## O que terá

### O canvas (E1)
- Canvas React Flow: adicionar/conectar/executar nós; salvar fluxo (`Flow`); executar (`FlowRun`) com status visual por nó (aguardando/rodando/pronto/erro).
- **Custo acumulado do fluxo** sempre visível (estimado antes, real durante/depois).
- Execução assíncrona: usuário pode sair da página; fluxo continua (pg-boss).
- Nós de utilidade: entrada de texto, upload, anotação.

### Templates de fluxo (E2+) — spec aprovada pelo Felipe em 2026-07-04 (base: P9)

Fluxos pré-moldados onde o usuário SÓ troca as informações. Desenho aprovado:

- **`FlowTemplate` versionado** (tabela própria, não `Flow.isTemplate`): `slug@version`, grafo JSON, **manifest de placeholders declarados** (key, label, type, required, mapsTo → campos dos nós), preview, custo estimado de exemplo. Seeds versionados no repo + seed script. `Flow.isTemplate` vira compatibilidade/protótipo.
- **UX de instanciar:** `Novo fluxo` → `Em branco` ou `A partir de template` → galeria (busca, categorias, cards com preview, custo típico e badges Barato/Vídeo/Produto/30s+/Premium) → wizard curto das variáveis obrigatórias → **custo estimado em R$ detalhado por nó ANTES de criar/rodar** → canvas abre montado com pendências destacadas.
- **Primeira leva (só nós da E2):** visíveis — Post visual simples (~R$0,14), Carrossel de variações (~R$0,81), Reel produto 6s (~R$1,65), Campanha produto mini (~R$4,94), Vídeo contínuo 30s+ (~R$8,24); avançados (fora da galeria default, contra clique curioso caro) — Text2Video rápido 10s (~R$3,78), Premium com áudio nativo Veo 3 (~R$17,28). Trend visual (~R$1,65) na fila. Versões com copy = E3, marcadas como futuras.
- Biblioteca **curada interna** primeiro; marketplace só depois de validação por uso real.

### Didática do canvas — aprovada pelo Felipe em 2026-07-04 (base: P8, as 10 recomendações)

O canvas ensina a pensar em PROCESSO de produção, não em nós. Requisitos (prioridade da P8):

1. Novo fluxo nunca abre vazio por padrão: chooser com "Começar do zero" + receitas.
2. Próximo nó sugerido por porta: arrastar de uma saída para o vazio abre picker filtrado por compatibilidade (padrão Magnific Spotlight).
3. Fases visuais leves no canvas (Briefing, Direção, Produção, Revisão, Montagem, Publicação, Aprendizado) — bandas discretas, sem burocracia BPMN.
4. Nó utilitário **"Revisar/Escolher"** (custo zero): gate humano explícito entre gerações caras.
5. Tooltips de custo e capacidade por nó (paleta e nó), em R$.
6. Conexão inválida explica o porquê em texto curto, não só bloqueia.
7. Templates com placeholders editáveis (núcleo da P9, acima).
8. Proveniência do asset: da Biblioteca, abrir o fluxo/run que o gerou com custos estimado/real.
9. Empty state com primeira receita concreta, não genérico.
10. Minimapa/fit-to-flow para fluxos grandes (pós-templates).

Ordem canônica de produção que fundamenta tudo (P8): briefing → direção criativa → roteiro/copy → referências e prompts visuais → geração de candidatos (barato antes de caro) → curadoria humana → montagem → adaptação por rede → publicação → aprendizado registrado.

### AI Video Director (E3)
Nó-agente que recebe briefing (objetivo, produto, referências, duração) e PRODUZE o fluxo: shotlist (beats), prompts por cena com refs nomeadas, escolha de modelo por cena e **estimativa de custo total antes de gerar qualquer coisa**. Origem: spec do vault (`fluxos-video-ia-pipeline.md`) — o elo que falta entre roteiro e geração, onde o Felipe já queimou 2,5M+ tokens sem direção.

## Regras de produto
1. Todo nó declara: entradas tipadas, saídas tipadas, custo estimado. O motor valida conexões por tipo (copy não liga direto em montagem, etc.).
2. FlowRun é reproduzível: o grafo + params ficam versionados no run.
3. Um fluxo pode ser executado parcialmente (só um ramo / só um nó).

## Fora de escopo
- Nós de terceiros/marketplace (futuro distante) · agendamento de fluxo recorrente (entra com 07-research).
