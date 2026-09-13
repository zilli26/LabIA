# 03-Fluxos — Especificação (a espinha dorsal)

## Adendo providers por nó — 2026-09-13, O2 preservado e O3 oficial implementado para imagem

Decisão recebida do Felipe: não existe provider principal; cada nó gerativo escolhe Provider/Conexão/Modelo. O [contrato proposto](../../docs/OAUTH-OPENAI-ESPECIFICACAO.md) define resolução por workspace, snapshot de execução, conclusão após Asset persistido, custo API separado de cota, anti-submit duplicado e retry seletivo. A ADR 0002 registra o porquê. Detalhes técnicos deste adendo aguardam aprovação.

## Adendo entrada guiada — 2026-09-11, aprovado

O primeiro acesso à criação é a rota `/criar`, com o título exato **O que você quer criar?**. A jornada é guiada e não abre o canvas automaticamente.

### Escopo deste incremento

- Exibir três opções acessíveis: **Imagem**, **Vídeo curto** e **Vídeo 30s+**.
- Somente **Imagem** é selecionável neste incremento. **Vídeo curto** e **Vídeo 30s+** ficam visíveis com estado `Em preparação`.
- Após selecionar Imagem, exibir intenção, formato, modo e resumo; as etapas didáticas ficam visíveis.
- Usar layout com painel compacto de configuração à esquerda e etapas didáticas + preview ao centro/direita.
- O modo guiado permanece nessa visão simples de etapas, status e preview. **Editar no canvas** é ação secundária para editar ou investigar; o canvas segue como espinha dorsal interna da receita e da execução.
- O custo aparece como **A calcular** enquanto desconhecido, nunca como R$ 0. A execução fica bloqueada neste incremento.
- Erros de interação ou validação preservam os campos já preenchidos do formulário.

### Limites deste incremento

Não simular upload, referência, custo, provider ou geração. Não iniciar gasto, worker, migration, OAuth, login ou deploy.

### Critérios DOM

- `h1` com o texto exato `O que você quer criar?`.
- Três opções acessíveis, com Imagem selecionável e as duas opções de vídeo em preparação.
- Selecionar Imagem mostra intenção, formato, modo, resumo e etapas didáticas.
- Custo `A calcular`, execução bloqueada e preservação do formulário em caso de erro.

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
- **UX de instanciar:** `Novo fluxo` abre `/criar` → jornada guiada com opções `Imagem`, `Vídeo curto` e `Vídeo 30s+` → `Em branco` ou `A partir de template` quando esse caminho estiver disponível → galeria (busca, categorias, cards com preview, custo típico e badges Barato/Vídeo/Produto/30s+/Premium) → wizard curto das variáveis obrigatórias → **custo estimado em R$ detalhado por nó ANTES de criar/rodar** → visão guiada com pendências destacadas e ação secundária `Editar no canvas`.
- **Primeira leva (só nós da E2):** visíveis — Post visual simples (~R$0,14), Carrossel de variações (~R$0,81), Reel produto 6s (~R$1,65), Campanha produto mini (~R$4,94), Vídeo contínuo 30s+ (~R$8,24); avançados (fora da galeria default, contra clique curioso caro) — Text2Video rápido 10s (~R$3,78), Premium com áudio nativo Veo 3 (~R$17,28). Trend visual (~R$1,65) na fila. Versões com copy = E3, marcadas como futuras.
- Biblioteca **curada interna** primeiro; marketplace só depois de validação por uso real.

### Didática do canvas — aprovada pelo Felipe em 2026-07-04 (base: P8, as 10 recomendações)

O canvas ensina a pensar em PROCESSO de produção, não em nós. Requisitos (prioridade da P8):

1. Novo fluxo abre em `/criar`, nunca diretamente em canvas vazio: jornada guiada com chooser de receitas; o canvas é acessado pela ação secundária `Editar no canvas` ou para investigação.
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
