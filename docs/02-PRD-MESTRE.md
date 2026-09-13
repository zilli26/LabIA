# LabIA — PRD Mestre

**Bloco:** B0 · fase 1
**Status:** entrada canônica de produto para consolidação e aprovação do Felipe. Não autoriza código, migrations, conexões, gastos ou geração.
**Atualizado em:** 2026-09-11

## 1. Autoridade, função e leitura

Este PRD traduz a visão do LabIA em um contrato único de produto: o que se promete, qual é o primeiro produto vendável, como a experiência conduz o usuário e quais provas separam estado atual de alvo. Ele organiza o produto; não reescreve retrospectivamente evidências nem substitui especificações aprovadas.

Ordem de autoridade para resolver conflitos:

1. decisão explícita mais recente do Felipe;
2. este PRD para direção, escopo e critérios de produto;
3. a seção mais recente de [RETOMADA](RETOMADA.md) para estado real, bloqueios e próximo passo;
4. `ESPECIFICACAO.md` e `CONSTRUCAO.md` aprovados do módulo para autorizar e orientar implementação;
5. ADRs para decisões técnicas gerais e `decisoes.md` para decisões locais.

Fontes de enquadramento: [Visão](00-VISAO.md), [roadmap](03-ROADMAP.md), [arquitetura](01-ARQUITETURA.md), [módulo de imagens](../modulos/01-imagens/ESPECIFICACAO.md), [módulo de vídeos](../modulos/02-videos/ESPECIFICACAO.md), [módulo de fluxos](../modulos/03-fluxos/ESPECIFICACAO.md), [README](../README.md) e [plano de ChatGPT, MCP e produção](PLANO-CHATGPT-MCP-E-PRODUCAO.md).

## 2. Promessa e público

**Promessa:** transformar uma intenção de conteúdo social em um fluxo visual dirigível, que produz assets reaproveitáveis com modelos adequados ao trabalho, custo compreensível antes do gasto e evidência recuperável depois.

O usuário inicial é Felipe, social media com clientes reais e usuário 0 do laboratório. O primeiro valor deve funcionar para sua produção profissional antes de qualquer promessa SaaS: menos troca de ferramentas, mais direção e memória do que foi testado. A expansão futura atende social medias e empresas por uso, mas não muda a regra central: o produto não vende créditos opacos nem um único modelo; vende controle criativo, escolha e rastreabilidade.

## 3. Produto inicial vendável

O produto inicial vendável é um laboratório de produção guiada para criar, testar e finalizar conteúdo visual de cliente. Ele começa por imagem e vídeo, preserva cada resultado como asset e mantém o canvas como a representação comum de toda produção.

A primeira oferta deve permitir ao Felipe:

- criar uma peça visual a partir de uma intenção, referências e direção;
- comparar caminhos de qualidade e custo antes de gastar;
- gerar, revisar e reaproveitar imagens, clipes e montagens como Assets;
- sair de um experimento barato para uma entrega final sem perder prompt, referência, modelo, custo ou decisão;
- montar vídeo curto e, quando a técnica estiver comprovada, compor vídeo de 30s+ por cenas/clipes; e
- abrir o mesmo trabalho no modo guiado ou no editor avançado de fluxos.

Copy, design, calendário, publicação, research e estratégia permanecem partes da visão e futuros nós; não são pré-requisito para provar este produto inicial.

## 4. Experiência guiada e editor avançado

A entrada principal não é um canvas vazio. Ela pergunta, literalmente:

> **O que você quer criar?**

A resposta orienta um caminho, não uma geração cega. O usuário escolhe ou descreve a intenção, informa objetivo, formato, marca/produto, referências disponíveis e restrições de orçamento. O sistema então apresenta uma receita editável, os assets necessários, os nós envolvidos, as capacidades exigidas e uma estimativa de custo antes de qualquer execução.

O usuário pode começar com um dos três caminhos:

1. **Imagem:** explorar direção, gerar candidatos e escolher uma imagem final.
2. **Vídeo curto:** partir de uma imagem ou de texto, gerar um clipe, revisar e montar uma entrega curta.
3. **Vídeo 30s+:** planejar cenas, validar candidatos por trecho, encadear ou animar clipes aprovados e montar um MP4 final.

Depois do briefing guiado, a receita continua em uma visão simples de etapas, status e preview. A ação secundária **Editar no canvas** abre a representação avançada quando o usuário quiser editar ou investigar. O canvas continua sendo a espinha dorsal interna do produto: concentra origem, dependências, custo, estado, revisão e saída de cada etapa, mas não é a tela obrigatória do caminho guiado. O **editor avançado** permite criar do zero, editar grafo, substituir modelos/conexões, ajustar parâmetros, executar apenas um ramo ou nó e investigar proveniência. Ele preserva a mesma linguagem do modo guiado — briefing, direção, produção, revisão, montagem e finalização — e nunca vira um atalho que ignore aprovação humana ou custo.

## 5. Ciclo operacional de criação

Toda receita visual segue o ciclo abaixo, com gates humanos explícitos:

1. **TESTAR** — gerar poucos candidatos no caminho mais barato que responda à hipótese criativa.
2. **APROVAR** — escolher, rejeitar ou ajustar com critério humano; nada caro é disparado por inércia.
3. **TRAVAR REFERÊNCIAS** — promover os elementos aprovados a referências canônicas versionadas.
4. **EXPANDIR** — usar apenas referências travadas para variações, cenas, animação, extend ou escala de produção.
5. **FINALIZAR** — montar, exportar, registrar custo/evidência e preservar a linhagem para reuso ou retry seletivo.

O ciclo vale para imagem e vídeo. Em vídeo longo, cada cena ou bloco repete o ciclo antes de contaminar a próxima: a plataforma não promete coerência por repetição automática de um prompt.

## 6. Assets canônicos: personagem e produto

Personagem e produto são assets canônicos, não anexos soltos de prompt. Cada perfil deve guardar identidade/versionamento, referências aprovadas, atributos que não podem derivar, origem dos insumos e vínculo com a marca/workspace.

- **Personagem:** aparência, traços, estilo, voz quando aplicável e imagens de referência aprovadas.
- **Produto:** imagens reais, detalhes verificáveis, texto/fatos imutáveis, variações permitidas e fonte dos materiais.

Uma cena combina uma parte fixa (personagem/produto/referências travados) e uma parte variável (ação, ambiente, enquadramento, luz, fala, duração e transição). A evidência de aprovação acompanha o Asset, não só a conversa. Quando houver mudança de ambiente ou deriva visual, o caminho correto retorna aos assets canônicos; não acumula uma cadeia de gerações degradadas.

## 7. Arquitetura de produto e execução

A cadeia canônica de uma ação generativa é:

```text
Receita / Nó
  → Provider Registry
  → Provider
  → Connection
  → Model Catalog + Capabilities
  → Adapter
  → Executor
  → Generation
  → Asset + custo + evidência
```

- **Receita / Nó:** declara o objetivo, entradas/saídas, parâmetros, gate humano e orçamento da etapa.
- **Provider Registry:** resolve opções válidas para o workspace e evita acoplamento do nó a um fornecedor.
- **Provider:** representa o serviço; não existe provider principal por regra de produto.
- **Connection:** vínculo autorizado, pertencente ao dono/workspace, com método de autenticação e estado; nunca é um token exposto ao fluxo.
- **Model Catalog + Capabilities:** informa o que o modelo comprovadamente faz — imagem, edição, referências, vídeo, áudio, duração, proporção e limites — junto de fonte, data e confiança.
- **Adapter:** traduz o contrato interno para o provider sem contaminar o nó com API externa.
- **Executor:** faz o trabalho no ambiente compatível, devolve estado e não prolonga uma chamada de interface para esperar mídia.
- **Generation:** registra cotação/entrada, snapshot de modelo e conexão, status, parâmetros, custo e correlação/idempotência.
- **Asset + custo + evidência:** é a saída recuperável; inclui origem, referências, custo estimado e observado, estado do custo e prova de capacidade/resultado.

A mesma cadeia atende API paga, conexão individual aprovada ou executor pessoal pareado. Custo em dinheiro, consumo de cota/créditos e custo desconhecido são estados distintos. Cota desconhecida não pode aparecer como R$0, e fallback para API paga exige nova estimativa e nova aprovação.

## 8. Modos de escolha

O modo é uma intenção de decisão; o catálogo só mostra combinações suportadas pelas capacidades comprovadas.

| Modo | Objetivo | Comportamento esperado |
|---|---|---|
| **Rascunho barato** | responder hipóteses e testar direção | prioriza menor custo e variações controladas; deixa claro limites de qualidade/capacidade |
| **Equilibrado** | produzir candidato forte com custo previsível | combina qualidade e preço; expõe trade-offs antes de executar |
| **Melhor qualidade** | buscar peça-chave aprovada | prioriza capacidade/qualidade comprovada; exige confirmação explícita do orçamento |
| **Avançado** | controlar o fluxo em detalhe | libera escolha direta de provider, conexão, modelo, parâmetros e execução parcial, sem remover gates de custo e aprovação |

Nenhum modo pode prometer modelo, preço ou capacidade sem registro atual no catálogo.

## 9. Pricing e evidência de preço

Toda cotação precisa exibir, por nó e no total do fluxo:

- valor estimado em R$ e moeda/origem quando aplicável;
- fonte do preço ou da regra de cota;
- data/hora de verificação e validade da cotação;
- confiança: **confirmada**, **estimada**, **indisponível** ou **a revalidar**;
- unidade de cobrança e parâmetros que alteram o valor; e
- após execução, custo observado, consumo de cota quando mensurável e evidência correlacionável da geração.

O preço de material histórico serve para contexto, nunca para autorizar gasto presente. A ausência de medidor confiável deve permanecer visível como limitação. Cancelar uma cotação, alterar o grafo/modelo ou repetir uma requisição não pode criar cobrança escondida; repetição precisa ser idempotente e retries só podem refazer o trabalho escolhido.

## 10. Estado atual versus alvo

| Frente | Estado atual conhecido | Alvo de produto |
|---|---|---|
| Canvas e motor | base React Flow, registry, persistência e fila existem; há aceitações E1 ainda pendentes | canvas guiado e avançado, com execução reproduzível, proveniência e custo por nó |
| Imagem e biblioteca | caminho fal.ai e evidência histórica de imagem existem; comparador/retry e dependências operacionais permanecem | ciclo completo de testar, aprovar, travar e expandir com assets canônicos |
| Vídeo | nós e montagem foram implementados; prova completa de vídeo real, retry seletivo e custo final ainda pendem | vídeo curto comprovado e vídeo 30s+ em blocos, com gates por cena e montagem final |
| Providers por nó | contrato/adendos propostos; a revisão mais recente aponta falhas a corrigir antes de login real | Registry, Connection, catálogo/capabilities, Adapter e Executor operando com ownership e evidência |
| OAuth/OpenAI | linha `feat/o1-openai-chatgpt-connection` requer consolidação segura; não é aceite de login nem de imagem | conexão pessoal validada e separada de conexão do LabIA/MCP, com capacidade e cota comprovadas |
| SaaS/MCP/publicação | visão e plano existem; autorização, isolamento de workspace e operação externa não estão prontos | etapas posteriores, apenas após base de acesso, conexão e economia comprovadas |

## 11. Roadmap e primeira prioridade técnica

### B0 — PRD mestre

Consolidar este contrato, aprovar a direção e derivar mudanças em especificações/decisões antes de código que altere módulos.

### P1 — OAuth e conexão por nó: primeira prioridade técnica após este PRD

1. Consolidar **com segurança** a linha `feat/o1-openai-chatgpt-connection`, sem merge cego.
2. Validar migration, ownership por usuário/workspace, loopback, correlação de login e CI; corrigir os achados antes de qualquer login real.
3. Só então realizar login real na conta autorizada, validando renovação, revogação, destinatário da credencial e ausência de segredo em logs.
4. Depois do login, executar uma prova **separada** de imagem, com custo ou cota mostrados e aprovados no momento. Persistir resultado/evidência sem confundir cota com custo monetário.

Essa sequência não inclui MCP remoto, Google, geração de vídeo, worker hospedado ou exposição a terceiros. Cada um exige contrato e validação próprios.

### Próximos incrementos de produto

- provar imagem guiada e o ciclo de referências canônicas;
- provar vídeo curto por degraus de gasto e revisão;
- provar vídeo 30s+ como montagem de cenas/blocos, não como promessa de um único clipe longo;
- só então avançar para acesso/MCP, multiworkspace, operação comercial e módulos de publicação.

## 12. Critérios de conclusão

### Aprovação deste PRD

Este PRD estará aprovado quando:

- Felipe aprovar a promessa, o público, o produto inicial e os limites de escopo;
- a entrada “O que você quer criar?” e os três caminhos estiverem aceitos como linguagem de produto;
- o ciclo TESTAR > APROVAR > TRAVAR REFERÊNCIAS > EXPANDIR > FINALIZAR estiver aceito como regra operacional;
- a cadeia Receita/Nó → Asset+custo+evidência e a separação de custo/cota estiverem aceitas;
- os quatro modos e a regra de pricing com fonte/data/confiança estiverem aceitos;
- o estado atual e o alvo não declararem integração, login, geração ou prova que ainda não ocorreu; e
- o P1 de OAuth estiver aceito exatamente como prioridade condicionada às validações de segurança, antes de login e prova de imagem.

### Critérios futuros do produto inicial utilizável e vendível

Estes critérios **não estão concluídos**. Eles serão atingidos somente com validação externa e trabalho real:

- jornada guiada de imagem completa, do pedido à aprovação e ao Asset recuperável;
- vídeo curto aprovado por Felipe;
- vídeo 30s+ montado por cenas/clipes aprovados;
- custo ou cota visíveis antes da execução e observados depois, com estado/evidência corretos;
- assets e referências de personagem/produto reutilizáveis em novos trabalhos;
- retry seletivo que não refaça resultados já aprovados;
- persistência e retomada do trabalho sem perder etapas, decisões, assets ou custos; e
- um trabalho real do Felipe concluído sem operar manualmente o grafo.

A aprovação deste documento não declara E1/E2 concluídas, não satisfaz esses critérios futuros e não substitui os critérios de aceite de cada módulo.

## 13. Não escopo desta fase

Não fazem parte deste PRD como entrega implementável imediata:

- código, migrations, mudanças de branch, merge, deploy, worker, geração ou gasto;
- login real, conexão OAuth, prova de imagem, Google/Flow, MCP remoto ou Supabase Auth configurado;
- publicação em redes, TikTok Shop, métricas, calendário ou operação multi-conta;
- marketplace de templates/nós, billing SaaS, créditos comerciais ou uso da conta pessoal de Felipe para atender terceiros;
- promessa de vídeo único de 15 minutos, continuidade perfeita, preço atual sem fonte ou capacidade sem prova;
- substituir a aprovação humana por escolha automática de modelo, retry ou fallback pago.
