# 03-Fluxos — Construção

## Bloco 0 — contrato Projeto-first fixado (2026-09-14)

**Status deste corte:** contrato documental registrado e pronto para orientar implementação posterior. Nenhum código, migration, worker, login, geração ou custo de API foi executado neste bloco.

O contrato aprovado para o módulo é:

1. **Projeto é a casa; canvas é a bancada.** O workspace do Projeto concentra objetivo, Assets, referências, Flow e resultados. O canvas mantém contexto do Projeto e tem retorno explícito para ele.
2. **Imagem-base e referência visual são papéis de Asset**, persistidos com procedência e escopo de owner/workspace/Projeto. Referência não vira primeiro frame sem seleção explícita e suporte declarado.
3. **`asset-input` é utilitário e custa R$0,00.** Não tem entrada, retorna Asset tipado (`image` ou `video`) após validar ownership/workspace/Projeto/tipo/papel e não chama provider, worker, Generation ou FlowRun.
4. **Importar/selecionar retorna ao contexto Projeto.** A operação não executa geração. O caminho de vídeo pode começar em imagem real importada, sem `image-generation` intermediário.
5. **A paleta contextual é Criar / Projeto / Pós-produção / Direção.** Ela organiza a bancada por intenção; não cria telas paralelas nem copia a identidade de plataformas de referência.
6. **Conexão inválida recebe feedback na hora.** A UI recusa a aresta antes de adicioná-la, explica o motivo em linguagem curta e sugere o caminho compatível; o backend permanece autoridade final.
7. **Director somente propõe.** Shotlist, grafo, prompts, referências, modelos, riscos e custo estimado aparecem como rascunho. `Aplicar ao Flow` só fica disponível após revisão humana e apenas salva/atualiza o grafo; não gera, enfileira nem cobra.

### Ponteiro de implementação

O próximo bloco deve implementar importação persistida e vinculada ao Projeto, seguido do nó `asset-input` e da reidratação do Flow. A validação deverá provar ownership, tipo, papel, custo zero conhecido, retorno Projeto → canvas → Projeto e bloqueio imediato de conexões incompatíveis. O Director permanece fora da implementação até a capacidade textual do executor estar comprovada pelo contrato oficial.

**Hardening O5-P0 (2026-09-13):** snapshot e respostas sanitizados por allowlist; replay bloqueado por `lastSequence` e update atomico; rota autentica antes do parse e limita body a 16 KiB; heartbeat monta estado real do Codex App Server/conexoes e deriva desconectado/erro/offline. Nenhum P1 deve continuar ate este P0 ser validado; migration segue nao aplicada.

**O5-P3 (2026-09-13):** CLI local de provisionamento para staging adicionada com confirmacao obrigatoria, owner/workspace local, segredo forte em memoria, hash no DB, bloqueio atomico de pairing existente e saida unica para configuracao do executor. Checklist em `docs/O5-P3-STAGING-PAIRING.md`; CLI nao executada e migration nao aplicada por este corte.

**Status do adendo providers/OAuth (2026-09-13):** O1 foi validado localmente; O2 tem resolução por Provider/Conexão/Modelo nos nós/jobs e execução comum testável com providers falsos. O3 OpenAI está integrado pelo contrato oficial de imagem do App Server 0.154.0, e `/criar` já usa conexão/modelo aprovados pelo executor antes da confirmação server-side. A primeira imagem real continua não validada até autorização específica; exposição remota segue dependente do contrato complementar. Os status E1 abaixo são históricos.

**Status:** E1 aberta; tarefas 1-5 implementadas em 2026-07-03 (execução/custos prontos no backend; validação end-to-end em Postgres depende de `DATABASE_URL`/`DIRECT_URL` reais e worker pg-boss ativo); app shell global implementado em 2026-07-03 com dashboard em `/`, lista em `/fluxos` e canvas em `/fluxos/[id]` sem sidebar fixa. Incremento de entrada guiada `/criar` validado localmente em 2026-09-12 · **Etapa:** E1 (canvas+motor), E2 (templates), E3 (Video Director) · **Depende de:** nada (é a fundação — primeira coisa da E1 junto com ModelProvider).

## Incremento aprovado — entrada guiada `/criar` (2026-09-11)

**Status:** validado localmente em 2026-09-12; sem provider, API, banco, migration, worker, OAuth, login, gasto ou deploy.

**Status O5-P0 (2026-09-13):** transporte de presença do executor implementado em `executor_pairings`: hash de segredo, heartbeat HTTPS outbound, snapshot/lastSeen com TTL e leitura autenticada sem loopback. Execução remota, jobs e comandos continuam fora deste bloco; migration aditiva não aplicada.

**Evidências:** eslint focado nos 3 TSX passou; `npm.cmd run typecheck` passou; `git diff --check` do recorte passou. No portal Maestri em `localhost /criar`, desktop 1440x891 e mobile 390x844, a rota renderizou HTTP sem overlay, com `h1` exato, três radios acessíveis (Imagem ativa; dois vídeos desabilitados), custo `A calcular`, Gerar desabilitado, erro de intenção preservando o formulário, revisão válida funcionando, navegação `Novo fluxo` para `/criar` e sem overflow horizontal na nova rota.

1. [x] Criar a rota `/criar` com `h1` exato `O que você quer criar?` e três opções acessíveis: Imagem, Vídeo curto e Vídeo 30s+.
2. [x] Permitir selecionar somente Imagem; manter Vídeo curto e Vídeo 30s+ no estado `Em preparação`.
3. [x] Após selecionar Imagem, exibir intenção, formato, modo, resumo, etapas didáticas e preview no layout de painel compacto à esquerda e conteúdo ao centro/direita.
4. [x] Manter a jornada guiada; oferecer `Editar no canvas` apenas como ação secundária. O canvas permanece a espinha dorsal interna, sem abertura automática.
5. [x] Exibir custo `A calcular`, bloquear execução e preservar os campos preenchidos em erros de interação/validação.
6. [x] Não adicionar simulações de upload, referência, custo, provider ou geração; não iniciar worker, migration, OAuth, login, deploy ou gasto.
7. [x] Validar por DOM: `h1` exato, três opções acessíveis, seleção de Imagem com os campos/etapas previstos, custo `A calcular`, execução bloqueada e formulário preservado após erro.

## Ordem de tarefas (E1)

1. [x] Setup do projeto Next.js + Supabase + Prisma + design system base (tokens do DESIGN-SYSTEM.md).
2. [x] Canvas React Flow: adicionar/conectar/mover nós, salvar/carregar `Flow`.
3. [x] Registry de `NodeDefinition` + validação de conexão por tipo de porta.
4. [x] Motor de execução: ordenação topológica, pg-boss, estados por nó, Realtime para a UI.
5. [x] Custo acumulado do fluxo (agregando estimateCost dos nós).
6. [ ] Nós utilitários (texto, upload, anotação).

## Status da implementação

- 2026-07-03: scaffold Next.js 15/App Router, TypeScript, Tailwind, shadcn/ui customizado, Prisma, Supabase client e `.env.example`.
- 2026-07-03: `Flow` persistido como grafo JSON React Flow em Postgres via Prisma (`Workspace`, `Brand`, `Flow`) com migration inicial.
- 2026-07-03: tela `/fluxos` com canvas React Flow, 3 nós iniciais não-gerativos, adição de nó, conexão, movimento e salvar/carregar por API.
- 2026-07-03: validação externa executada com lint, typecheck, build, Prisma validate e browser em `http://localhost:3000/fluxos`. Sem credenciais locais, a persistência real no Postgres não foi exercitada; a UI falha explicitamente quando `DATABASE_URL`/`DIRECT_URL` não estão configuradas.
- 2026-07-03: registry central de `NodeDefinition` em `lib/flows/`, endpoints de definição/validação, bloqueio de grafo inválido no save e validação de portas `text | image | video | copy | brand | any`.
- 2026-07-03: `FlowRun`/`FlowRunNode`, ordenação topológica, enfileiramento pg-boss, helper de worker local, estados por nó persistidos em tabelas assináveis via Supabase Realtime.
- 2026-07-03: custo acumulado estimado/real por nó e por fluxo, endpoint de estimativa antes da execução e serialização de custo para a UI. Validação real de execução ainda requer banco Supabase/Postgres configurado e worker importando `registerDefaultFlowWorker()`.
- 2026-07-03: app reestruturado para o shell fixado no DESIGN-SYSTEM: top bar global com `Início`/`Fluxos`/`Biblioteca`, dashboard em `/`, cards de fluxos em `/fluxos`, canvas em `/fluxos/[id]` e paleta de nós como botão flutuante `+ Nó` dentro do canvas.

## Tarefas candidatas — Templates + Didática (aprovadas em spec 2026-07-04; timing: fim da E2 ou abertura da E3, decisão do Felipe na hora)

T1. Nó utilitário "Revisar/Escolher" (custo zero) — candidato a adiantar para a E2, serve à escada de gerações reais.
T2. `FlowTemplate` no Prisma (migration) + seeds da primeira leva (5 visíveis + 2 avançados) em arquivos versionados.
T3. API de galeria + instanciação (validação de placeholders, substituição no grafo, custo estimado antes de criar).
T4. UI: chooser no "Novo fluxo", galeria com cards/custo/badges, wizard de variáveis, canvas com pendências destacadas.
T5. Didática incremental no canvas: picker por porta (Spotlight), tooltips de custo, conexão inválida explicada, empty state com receita.
T6. Fases visuais leves no canvas + proveniência do asset na Biblioteca.

(Video Director: E3 — tarefas detalhadas quando a etapa abrir.)

## Critérios de aceite (E1, validação externa)

- [x] Criar fluxo com 3 nós, salvar, recarregar a página e reabrir intacto. *(2026-07-03, validado por Claude contra o Postgres real do Supabase: save com nó novo + rename → reload intacto, 4 nós.)*
- [ ] Executar fluxo e ver estados mudando em tempo real sem refresh.
- [ ] Fechar o browser durante execução; reabrir e ver o fluxo concluído.
- [ ] Conexão de tipos incompatíveis é bloqueada com feedback visual.
- [ ] Custo acumulado bate com a soma dos custos dos nós.
