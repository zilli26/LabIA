# RETOMADA - estado vivo do projeto

## O5-P0 hardening apos reviewer - 2026-09-13

P0 corrigido antes de qualquer P1: snapshot/respostas passam por allowlist e redacao de Bearer, sk-, token/cookie e evidencia sensivel; heartbeat exige `sequence` monotonicamente crescente por pairing com `updateMany` atomico; a rota autentica antes do parse e limita body a 16 KiB. O provider-executor agora consulta o estado real do Codex App Server/conexoes configuradas apenas por identidade, reportando desconectado/erro e deixando o control-plane derivar offline por TTL. Migration aditiva permanece apenas no codigo, sem worker, login, generation, migration aplicada, commit, push ou deploy.

## O5-P3 provisionamento local para staging - 2026-09-13

Adicionada a CLI `npm run staging:provision-executor`, com confirmacao literal obrigatoria, resolucao de owner/workspace locais, bloqueio atomico de pairing ativo existente por padrao e flag explicita apenas para criar um pairing adicional. O segredo e gerado criptograficamente em memoria, enviado somente ao helper que persiste o hash e impresso uma unica vez junto do ID; nao ha escrita em repo/docs/.env, log de URLs/tokens ou chamadas de Vercel, worker, login, heartbeat ou geracao. Checklist operacional em `docs/O5-P3-STAGING-PAIRING.md`. A CLI nao foi executada.

## O5-P0 — pareamento e presença do executor — 2026-09-13

Implementado o transporte mínimo para o executor local declarar presença à preview Vercel por heartbeat outbound HTTPS. `executor_pairings` guarda hash do segredo, owner/workspace, versão, estado, `lastSeenAt` e snapshot seguro de conexões/providers, capabilities e modelos; leituras autenticadas derivam `offline` após TTL de 90s. O cliente é configurável por ambiente e não consulta jobs/comandos. Migration aditiva criada em código, não aplicada; execução remota permanece fora do P0.

Validação: 4 arquivos focados, 13 testes; lint e typecheck passaram; `git diff --check` passou. `prisma generate` e `build` ainda dependem de resolver o bloqueio local `EPERM` no client Prisma gerado.

## Persistência OAuth após restart — 2026-09-13

Correção TDD aplicada: falha de `initialize` apenas encerra o App Server e preserva o `CODEX_HOME`; `startLogin` não faz logout automático de conta cacheada e exige desconexão explícita; status consulta `account/read` antes de rejeitar correlação ausente e reidrata tentativa pendente usando `loginId`/`loginExpiresAt` server-side persistidos em `ProviderConnection`. O cancelamento permanece com a limpeza anterior, conforme decisão pendente separada.

Validação local sem login, geração, worker, migration ou cota: RED reproduzido em 6 testes antes do patch; GREEN em 13 testes Codex, 46 testes de provider-connections e suíte completa com 185 testes. Lint, typecheck, `next build` com cliente Prisma `--no-engine` e `git diff --check` passaram. `npm run build` foi tentado duas vezes e ficou bloqueado pelo `EPERM` do Prisma ao renomear `node_modules/.prisma/client/query_engine-windows.dll.node`.

## `/criar` com seleção OpenAI e confirmação server-side — 2026-09-13

O caminho guiado agora carrega somente conexões OpenAI conectadas do owner/workspace atual e modelos de imagem retornados pelo executor Codex 0.154.0 após os gates O3. Conexão e modelo são selects reais; fal.ai mantém o modelo legado explícito. A revisão cria/atualiza o Flow, pede cotação com `billingMode = subscription` e emite confirmação assinada; só então apresenta o CTA único `Gerar 1 imagem`. O enqueue usa a rota de FlowRun existente e a UI mostra estado e link para a Biblioteca.

Validação desta rodada: testes DOM e de rota com fixtures/mock de backend, sem clicar em geração real, login, worker, migration, cota ou API paga. A primeira imagem real permanece pendente de autorização específica.

## O3 oficial implementado por fixtures — 2026-09-13

O3 foi implementado no executor local usando somente o protocolo oficial do Codex App Server 0.154.0: `thread/start`, `turn/start`, evento `item/completed` com `imageGeneration`, recuperação por `thread/read` e `thread/items/list`. O resultado é validado como PNG/Base64 e `savedPath` só é aceito dentro do `CODEX_HOME` dedicado. O coordenador e os jobs reais preservam `operationKey`, `submission_unknown`, reuso de `providerJobId` e Asset idempotente. A conexão continua `generationValidationStatus = unvalidated` até uma única imagem real autorizada; nenhuma imagem, cota, worker, migration ou login foi executado nesta rodada.

## O1 encerrado e limite O2/O3 — 2026-09-12

O1 permanece implementado e validado localmente; a sessão/login existente do Codex não foi encerrada nem reiniciada nesta sessão. A correção runtime aceita `x-forwarded-host` somente quando é autoridade local idêntica ao Host/origem e mantém as recusas de host remoto, cadeia encaminhada, Origin e fetch-site.

O2 independente foi incorporado: Provider/Conexão/Modelo são selecionáveis em `/criar` e no nó de imagem, fal.ai permanece compatível, jobs resolvem provider por seleção explícita e há confirmação server-side, ownership, coordenador durável testável para concorrência, Asset idempotente e submit ambíguo com providers falsos. A migration aditiva `20260912000000_add_execution_guards` foi criada, mas nenhuma migration adicional foi aplicada.

O3 OpenAI estava bloqueado no registro histórico abaixo; o status vigente acima substitui esse bloqueio. O protocolo oficial agora está integrado por fixtures, sem geração real, e a conexão permanece `generationValidationStatus = unvalidated` até autorização específica.

## Bloco `/criar` concluído — 2026-09-12

Entrada guiada `/criar` validada localmente: Imagem ativa, vídeos em preparação, custo `A calcular`, execução bloqueada, formulário preservado em erro e navegação sem overflow em desktop/mobile. Nenhum provider, API, DB, migration, worker, OAuth, login, gasto ou deploy foi acionado.

**Próximo ponteiro:** O1 — conexão ChatGPT local segura, portando o corte aprovado de `feat/o1-openai-chatgpt-connection` em branch limpa a partir de `main`, sem login real, migration ou gasto no primeiro passo.

## Revisão independente da implementação O1 — 2026-09-11

Felipe pediu validar a entrega feita no ChatGPT. Branch remota `feat/o1-openai-oauth` conferida em `ef37b12`; main permanece `395e369`. Actions `34616487976` realmente passou (121 testes/14 arquivos e build), porém exclui o teste TSX da interface. O checkpoint remoto da RETOMADA está confirmado; o workflow temporário continua presente.

**Parecer:** corrigir acesso local, escopo por dono/workspace, proteção da migration, logout após restart, correlação de login e cobertura TSX antes do login real. Relatório com evidências: `docs/O1-REVISAO-2026-09-11.md`. Cinco cenários independentes reproduziram falhas; 29 testes existentes de providers, Prisma generate, typecheck e lint passaram localmente. Metadados Supabase consultados em modo leitura confirmam tabela nova ausente e default grants para anon/authenticated; nenhuma migration aplicada.

Código revisado em worktree isolada `C:/Users/teste/Desktop/LabIA-o1-review`. Não houve alteração enviada à branch, login, geração ou worker. Os documentos locais anteriores estão preservados; o relatório desta revisão é local. Próxima ação: corrigir os achados em O1 e repetir a validação antes de retomar os passos de login.

## OAuth OpenAI e provider por nó — 2026-09-11

Felipe pediu implementar OAuth OpenAI e reafirmou: **não existe provider principal; cada nó escolhe Provider, Conexão e Modelo**. Decisão registrada na ADR 0002.

- **Conferido nesta sessão:** checkout limpo no início em `395e369`; ausência de ProviderConnection no schema; FalProvider fixo em nós/jobs; workers reenviam geração em retry mesmo com providerJobId persistido. Codex CLI instalado `0.153.4`; geração local de JSON Schema confirmou login `chatgpt` e `chatgptDeviceCode`. Nenhum login foi iniciado.
- **Informado por Felipe na retomada, não revalidado nesta sessão:** Vercel/produção validadas; Supabase ACTIVE_HEALTHY; três migrations aplicadas; Storage/bucket assets validados; ausência de jobs queued/ready/active e gerações antigas pendentes; fluxo manual “Teste manual — Imagem → Vídeo” já criado. Esse relato supera a pendência histórica de Supabase inativo abaixo, sem constituir nova leitura ao vivo pelo Codex.
- **Entrega:** `docs/OAUTH-OPENAI-ESPECIFICACAO.md` e `docs/OAUTH-OPENAI-CONSTRUCAO.md`, vinculados aos contratos dos módulos 01/02/03. Status: proposta para aprovação, sem código implementado. Não confundir o pedido de produto recebido com aprovação dos detalhes técnicos agora propostos.
- **Proposta:** login gerido por Codex App Server em executor local dedicado; credenciais fora do repo e separadas da sessão Codex existente. Primeira entrega conecta a conta no LabIA local sem consumir fila. Imagem é capacidade a provar separadamente. Uso via Vercel exige contrato complementar de sessão do dono/autorização e pareamento do executor.
- **Débitos:** aprovação SDD do contrato novo; implementar ProviderConnection/login; resolver provider por nó; proteção contra submit duplicado; custo API versus cota; retry seletivo; prova de imagem OAuth; depois flow misto e Seedance direto/Google. Schema local de login não prova acesso de geração na conta.
- **Próxima ação:** Felipe revisar e aprovar os dois contratos propostos; então executar O1 na ordem. Regra de aprovação vem do AGENTS.md, item 1. Geração real exige autorização própria com custo/cota declarados.
- **Validação desta entrega documental:** referências locais e `git diff --check`; sem suíte de aplicação, pois nenhum código foi alterado. Nenhuma migration aplicada, worker iniciado, geração enfileirada ou gasto de geração realizado.

## Publicação do projeto no GitHub — 2026-09-10

Felipe solicitou enviar o projeto para o GitHub após conectar o LabIA à Vercel, para continuar pelo ChatGPT.

**Resultado confirmado:** aplicação e plano enviados no commit `e3be15080fbd73df7ec3aa45676e5a6652a70048`. Leitura de README e do prompt de retomada confirmada pela integração GitHub. Deploy automático de origem `git` para esse commit ficou **READY** (`dpl_J7a1NS571A4G5JZ8pYcZFpxVxjcW`). O site principal, `/fluxos` e `/api/flows/node-definitions` retornaram HTTP 200; o registry publicado contém os quatro nós de vídeo, além dos cinco nós básicos/imagem.

**Pendência operacional encontrada:** `/biblioteca` retornou HTTP 500. A integração Supabase informou projeto `LabIA` (`kbqjgyvytxxjlmojlyhr`) em estado **INACTIVE**. Logs de produção confirmaram `PrismaClientInitializationError` e falha de resolução do tenant do pooler. Uma consulta local somente de leitura também não alcançou o banco. Não confundir HTTP 200 da página inicial/Fluxos com persistência funcionando: existem fallbacks na UI. Antes de testes com dados ou geração, reativar o projeto Supabase e validar banco/Storage, credenciais e worker. O banco não foi restaurado, migrado ou alterado nesta entrega de publicação.

- Repositório confirmado: `https://github.com/zilli26/LabIA`, branch `main`, remoto `origin` configurado. O commit inicial remoto (README) foi incorporado preservando o histórico local, sem force push.
- Este pacote inclui aplicação, testes, migrations, pesquisas, arquivos do protótipo de landing e o planejamento OAuth/Google/MCP. O README apresenta a ordem de leitura e separa implementação, protótipo e trabalho futuro.
- O prompt de retomada agora aponta para o repositório. Os registros de ausência de remoto e atraso de 19 commits abaixo são históricos, anteriores a este envio; conferir revisão publicada separadamente na Vercel.
- Validação antes do envio: **112 testes em 11 arquivos**, lint e build de produção passaram; o build incluiu checagem de tipos. `git diff --check` limpo. Arquivos de ambiente reais e `.vercel` ignorados; `.env.example` é o modelo versionado. Checagem de padrões de credenciais e correspondências com segredos locais não encontrou ocorrências nos arquivos publicáveis nem no histórico.
- Próxima ação no ChatGPT: ler README → VISAO → esta seção de RETOMADA → PLANO-CHATGPT-MCP-E-PRODUCAO → PROMPT-RETOMADA-CHATGPT. Começar pela preparação de P0/P1. OAuth de geração, MCP, consistência e publicação TikTok continuam pendentes; subir o código não os implementa.
- Worker e gerações não foram iniciados neste envio. O resultado do deploy automático deve ser verificado pelo commit na Vercel, independentemente do sucesso do push.

## Planejamento para operar pelo ChatGPT — 2026-09-10

Felipe pediu um plano por etapas para conexões OpenAI/Google, MCP e produção com personagem/produto consistentes, incluindo montagem futura de até 15 minutos. Quer continuar pelo **ChatGPT**, não pela interface Codex, e informou que conectará o GitHub.

- Entrega: `docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md`, com arquitetura proposta, matriz de conexões, contratos MCP, fases P0–P6, testes, limites de custo e critérios de continuidade entre cenas.
- Retomada pronta: `docs/PROMPT-RETOMADA-CHATGPT.md`. Anexar os arquivos ao novo chat ou disponibilizá-los no GitHub; eles ainda não foram enviados ao remoto.
- Correção de evidência: o Hermes contém plugin de imagem `openai-codex` com OAuth e referências, inspecionado no commit `e83816a4d1998245968949e88fa15f26d89800c0`. As afirmações antigas de que assinatura só pode servir a texto não são mais uma premissa válida. A rota existe em código de terceiro, mas ainda precisa ser testada na conta do Felipe e integrada ao LabIA.
- Google: separar login Gemini CLI, OAuth/API com projeto Cloud e uso da assinatura Flow. Existem pontes comunitárias; nenhuma foi validada nesta sessão. Não tratar login como prova de geração ou consumo da assinatura.
- Proposta: ChatGPT e canvas usam os mesmos serviços LabIA; MCP autenticado; fila e executor persistentes; conexões pessoais separadas de APIs pagas. Antes de exposição MCP, resolver autorização por usuário/workspace, pois o código atual usa workspace padrão. As decisões técnicas novas continuam propostas, sem aprovação de spec ou implementação.
- Próxima ação: P0/P1 no ChatGPT — confirmar acesso/revisão do repo, consolidar as capacidades OpenAI/Google e preparar o primeiro experimento e as specs mínimas. Nenhuma geração, instalação de ponte, login, push, deploy ou mudança de banco foi feita nesta sessão de planejamento.

## Auditoria de panorama — 2026-09-10 (Codex)

Felipe retomou a ideia de produzir conteúdo afiliado para TikTok Shop com um personagem sintético por conta. Esta sessão verifica o estado; não aprova novo escopo de implementação nem geração paga.

- **Vercel verificada ao vivo:** projeto `labia`, produção `READY`, domínio `https://labia-hazel.vercel.app`. GET de `/`, `/fluxos` e `/api/flows/node-definitions` retornou HTTP 200 sem login nesta consulta. Isso supera a pendência histórica de acesso público abaixo.
- **Produção está atrás do local:** deployment `dpl_wZS1f93ZChYfuWGUFnU1efHpf9yw`, origem `cli`, commit `1e257310d5b7cdb60d5637dd8d02f23b7da2dee7`; HEAD local `aa87af9`, 19 commits à frente. A API publicada registra apenas Texto, Nota, Saída, Prompt e Gerar Imagem; os nós de vídeo locais não estão nesse deploy.
- **GitHub:** `git remote -v` vazio. Busca pela integração GitHub por `LabIA user:zilli26` sem resultados acessíveis. Não há conexão remota configurada neste checkout e não foi comprovado deploy automático GitHub → Vercel.
- **Implementação local:** canvas, imagem via fal.ai e vídeo até tarefa 7 permanecem presentes. Retry seletivo continua pendente. Referência/edição para consistência de personagem e produto, Director/roteiros, legendas, integração de produtos/afiliados e publicação TikTok não estão implementados. Assinaturas Google/OpenAI não estão conectadas como providers; a arquitetura documenta assinatura para texto como trabalho futuro.
- **Validação atual:** `npx --no-install vitest run` passou (11 arquivos, 112 testes); `npm run typecheck` passou. São verificações locais sem geração paga; não comprovam o pipeline de vídeo real. A prova anterior de imagem permanece evidência histórica, sem nova geração nesta auditoria.
- **Execução:** worker continua necessário para consumir a fila; nesta consulta não foi identificado processo Node com os scripts `scripts/worker` ou `scripts/image-worker`. Nenhum worker foi iniciado e nenhuma geração foi enfileirada. Saldo fal.ai e disponibilidade atual dos endpoints não foram revalidados.
- **Retomada proposta, ainda sem promover a nova spec:** validar um produto e um personagem em cenas consistentes, depois um clipe curto e uma montagem vertical. Declarar orçamento atualizado em R$ e obter aprovação a cada geração. A prova completa de vídeo e a operação em múltiplas contas continuam pendentes.

Os registros abaixo são históricos; usar a auditoria acima para distinguir versão local, versão publicada e funcionalidade apenas prevista.

> Ultima atualizacao: **2026-07-04, Codex P10** - pesquisa de referencias da landing concluida com duas passadas; `docs/DESIGN-LANDING.md` atualizado com stack v1 (SVG inline + CSS scroll-driven progressivo + IntersectionObserver; sem GSAP/Motion/Lenis na v1), inventario de efeitos e referencias. Nenhuma geracao de API; custo R$0.

## P10 concluida - referencias de landing/scrollytelling (2026-07-04, Codex)

Saidas:

- `pesquisas/P10-referencias-landing-scrollytelling.md`: substituido o brief por pesquisa executada, com veredito, tabela de referencias, tabela de tecnicas, stack recomendada, parametros de efeitos, acessibilidade/performance, armadilhas e fontes.
- `docs/DESIGN-LANDING.md`: secoes 3 e 5 preenchidas com inventario executavel e referencias resumidas. Direcao tecnica v1: SVG inline + `position: sticky` + CSS scroll-driven animations como melhoria progressiva + `IntersectionObserver` para reveals; fallback sem JS/reduced motion sempre legivel.
- `pesquisas/README.md`: indice atualizado com P8, P9 e P10 concluidas.

Decisao tecnica da P10: nao instalar GSAP, Motion ou Lenis na v1 da landing. Reavaliar GSAP ScrollTrigger apenas se o prototipo provar que CSS+IO nao sustenta o pin curto do hero.

Proxima acao: Felipe/Claude cruzarem a P10 com `docs/DESIGN-LANDING.md` para aprovar a direcao antes de Fable construir a landing e o `/Inicio`.

> Atualizado a cada fim de sessão de orquestração. Próxima sessão (Claude ou Codex): leia isto DEPOIS do CLAUDE.md e ANTES de qualquer trabalho.
> Última atualização: **2026-07-04, Codex tarefa 7** — modal de confirmação de custo total implementado e validado por DOM/Prisma; banco final com 0 Generations de vídeo e 0 jobs pendentes. Observação honesta: a validação do fluxo só de imagem preservou execução direta e um worker já ativo no ambiente processou 1 imagem FLUX real (R$0,135); registro/job temporários foram apagados, mas houve gasto de imagem.

## E2 tarefa 7 concluída — modal de confirmação de custo total (2026-07-04, Codex)

Implementação concluída sem confirmar o modal de vídeo e sem rodar `npm run worker`, smoke ou comando de geração. Saídas:

- `lib/flows/video-cost-gate.ts`: criado `PAID_VIDEO_KINDS` + `hasPaidVideoNode`, com gate apenas para `video-generation`, `video-extend` e `text2video`; `video-assembly` segue R$0 e não dispara sozinho.
- `components/flows/video-cost-confirm-modal.tsx`: modal próprio, sem `Dialog`, com overlay, `role="dialog"`, `aria-modal`, foco inicial em `Cancelar`, Esc/overlay para fechar, scroll de fundo travado e `data-id`s estáveis (`cost-confirm-modal`, `cost-confirm-total`, `cost-confirm-accept`, `cost-confirm-cancel`).
- `app/(studio)/fluxos/flow-canvas.tsx`: `handleRun` mantém guard de fluxo sujo; fluxos sem vídeo pago seguem no enqueue direto; fluxos com vídeo pago abrem modal, buscam estimativa fresca via `POST /api/flows/{id}/cost` com o grafo atual e só enfileiram ao clicar em `Confirmar e executar`.
- Docs atualizados em `modulos/02-videos/CONSTRUCAO.md` e `modulos/02-videos/decisoes.md`.

Validação desta sessão:

- `npm run typecheck` -> limpo.
- `npm run lint` -> limpo.
- `npx vitest run` -> 112 testes verdes, incluindo `tests/flows/video-cost-gate.test.ts`.
- `npm run dev` sem worker iniciado por esta sessão: fluxo temporário com `video-generation` salvo pela UI abriu o modal ao clicar `Executar`; DOM confirmou `role="dialog"`, `aria-modal="true"`, foco em `cost-confirm-cancel`, total `R$ 4,05`, breakdown com `video-paid-gate` + `video-generation` e texto de estimativa/gasto real na fal.ai. Clique em `Cancelar` fechou o modal sem mensagem de enqueue.
- Fluxo temporário só com `image-generation` salvo pela UI não abriu modal e preservou o caminho direto de execução. **Incidente:** havia algum worker/processador já ativo no ambiente; esse fluxo de imagem foi processado e criou `Generation cmr6y05e50000vdzo1krzdn09` (`fal-ai/flux/dev`, `DONE`, providerJobId presente, custo real R$0,135). O registro, assets vinculados e job foram removidos na limpeza. Não houve Generation de vídeo.
- Auditoria final via Prisma após limpeza: `tempFlowsRemaining: 0`, `videoGenerations: 0`, `pendingJobsCount: 0`.

Próxima ação: tarefa 8 da E2 (`Retry por nó de vídeo sem re-executar anteriores`), mantendo a regra operacional reforçada: antes de validar caminhos que enfileiram qualquer geração, conferir se não há worker/processador externo ativo.

## FIM DE SESSÃO (2026-07-04, tarde) — por onde retomar

1. **Próxima tarefa: tarefa 7 da E2 — Modal de confirmação de custo total (R$).** Prompt do Codex GERADO e entregue ao Felipe no chat desta sessão. Se perdido, regenerar de: `CONSTRUCAO.md` tarefa 7 + Regra de produto 1 da `ESPECIFICACAO.md` + pontos de design registrados no prompt (gate puro `hasPaidVideoNode` para `video-generation`/`video-extend`/`text2video`; `video-assembly` R$0 não dispara sozinho; modal próprio porque NÃO há Dialog em `components/ui/`; estimativa FRESCA via `POST /api/flows/{id}/cost` ao abrir; confirmar reusa o enqueue atual de `handleRun`; validação por DOM sem confirmar o modal pra não enfileirar). Fluxos só de imagem mantêm execução direta.
2. Depois: tarefa 8 (retry por nó de vídeo sem re-executar anteriores — clipes anteriores lidos como Asset). Fecha a E2 no núcleo.
3. Então: escada de gerações reais (1 clipe Wan ~R$1,35 → emenda em beat → 30s+ ~R$8,24), cada degrau com aprovação do Felipe NA HORA; resultados alimentam o log do `TECNICAS.md`.
4. Paralelo aprovado: tarefas candidatas T1–T6 de templates/didática (`modulos/03-fluxos/CONSTRUCAO.md`); Whitepaper v1 no fechamento da E2. **Side quest de DESIGN em andamento pelo Felipe em outra sessão (2026-07-04) — quando voltar, cruzar com `docs/DESIGN-SYSTEM.md` e a seção Didática do canvas.**
5. Regra viva: nenhuma geração paga sem ok explícito do Felipe com custo em R$ declarado antes; Codex nunca roda geração real; revisão sempre com validação externa **por dados/DOM/Prisma, nunca por screenshot** (ver `memory/validacao-sem-screenshot.md`).

## E2 tarefa 6b concluída — trilha/voz por upload na `Montagem` (2026-07-04, Codex)

Implementação concluída sem chamar fal.ai, sem worker, sem smoke test e sem executar fluxo de vídeo. Apenas ffmpeg local com mídia sintética foi usado. Saídas:

- `lib/video/ffmpeg-service.ts`: criado `hasAudioStream(videoPath)` usando `ffmpeg -hide_banner -i` e leitura do stderr; `mixAudioTrack` agora ramifica entre vídeo com áudio (`amix` com `[0:a]`) e vídeo mudo (trilha como áudio final, sem referenciar `[0:a]`).
- `app/api/assets/upload/route.ts`: nova rota `POST` multipart para áudio MP3/WAV/M4A/AAC/OGG até 25 MB; usa workspace default, `uploadBufferAssetToSupabase` em `workspaces/{ws}/uploads` e cria `Asset` `AUDIO`/`UPLOADED` sem `Generation`.
- `lib/flows/video-nodes.ts`: `video-assembly` aceita `audioAssetUrl`/`audioAssetId`; sem trilha mantém concat puro; com trilha baixa o áudio, grava o concat em temp, roda `mixAudioTrack`, faz upload do MP4 final e registra `metadata.hasAudioTrack`/`audioAssetId`. Cleanup centralizado no `finally`.
- `components/nodes/lab-flow-node.tsx`: `AssemblyControls` ganhou controle `Trilha/voz (opcional)` com input `accept="audio/*"`, upload para `/api/assets/upload`, estado de envio, erro legível, nome da trilha carregada e botão `Remover`; dica de ordem e chip `custo R$0 (montagem local)` preservados.
- `tests/video/ffmpeg-service.test.ts`: teste real com clipe mudo sintético `testsrc` + faixa `sine`, garantindo MP4 final com áudio e duração do vídeo; `hasAudioStream` cobre true/false.
- `tests/flows/video-nodes.test.ts` e `tests/api/assets-upload-route.test.ts`: cobrem Montagem com/sem trilha, metadata do Asset, não chamar `mixAudioTrack` sem trilha, ordem dos clipes, upload válido e erros de arquivo ausente/tipo inválido.
- Decisões registradas em `modulos/02-videos/decisoes.md`: detecção por stderr do ffmpeg, upload como parâmetro da Montagem sem porta de áudio, e rota mínima `AUDIO`/`UPLOADED`.

Validação desta sessão:

- `npx vitest run tests/video/ffmpeg-service.test.ts tests/flows/video-nodes.test.ts tests/api/assets-upload-route.test.ts` -> 35 testes verdes.
- `npm run lint` -> limpo.
- `npm run typecheck` -> limpo.
- `npx vitest run` -> 107 testes verdes.
- `npm run dev` sem worker: `/api/flows/node-definitions` serviu `video-assembly`; no canvas, a Montagem foi adicionada apenas no estado local e o DOM confirmou `Trilha/voz (opcional)`, `input[type=file][accept="audio/*"]`, dica de ordem e chip `custo R$0 (montagem local)`.
- `POST /api/assets/upload` com WAV sintético local retornou 200 e criou `Asset` `AUDIO`/`UPLOADED`; o objeto no Storage e o Asset de teste foram apagados depois.
- Banco verificado via Prisma: **0 Generations de vídeo, 0 Assets `VIDEO` novos de `labia/ffmpeg`, 0 Assets de áudio de teste e 0 jobs pendentes** em `pgboss.job` para `video.generate`.

Próxima ação: tarefa 7 da E2 (`Modal de confirmação de custo total`), mantendo a regra de nenhuma geração real sem aprovação explícita do Felipe com custo em R$ declarado antes.

### Revisão Claude da tarefa 6b (2026-07-04) — APROVADA e commitada

Validação externa **por dados, sem screenshot** (regra nova do Felipe nesta sessão: validar por DOM/Prisma, nunca por imagem). Reproduzido de forma independente: lint, typecheck e **107 testes** verdes. Pontos de risco inspecionados:

- **Fix do mix sobre vídeo mudo:** `hasAudioStream` roda `ffmpeg -i` e casa `/^\s*Stream #.+: Audio:/im` no stderr; `mixAudioTrack` ramifica para `[1:a]volume[aout]` (só trilha, com `-stream_loop -1`/`-shortest`) quando não há `[0:a]`. Coberto por teste **real de ffmpeg**: clipe `testsrc -an` (mudo) + faixa `sine` → o revisor conferiu que o teste afirma `source.hasAudio=false`, `mixed.hasAudio=true` e duração ±0,25s. Validação de vídeo de verdade, custo R$0.
- **Rota de upload exercitada ao vivo:** `POST /api/assets/upload` com WAV mínimo real (44B header + 16B data) via fetch no browser → **200** com `assetId`/URL do Supabase; Prisma confirmou `Asset` `AUDIO`/`UPLOADED` com `metadata.originalFileName`. Objeto do Storage removido (service client) + linha apagada pelo revisor.
- **Integração no nó por DOM:** fluxo temporário com um nó Montagem → DOM confirmou `input[data-id="assembly-audio-upload"][accept="audio/*"]`, label "Trilha/voz (opcional)" e estado "Nenhuma trilha carregada."; fluxo apagado.
- **Código:** `downloadRemoteAssetToTemp` generalizado (vídeo/áudio sem duplicar), concat→arquivo→mix condicional, `mixAudioTrack` NÃO chamado sem trilha (regressão da tarefa 6 coberta por teste). Acentos PT-BR corretos.

Banco reverificado ao final: **0 Generations de vídeo, 0 Assets de concat, 0 Assets de áudio, 0 jobs pendentes**. Nota honesta: uma tentativa de `preview_eval` minha retornou erro de navegação mas o POST completou no servidor e deixou um Asset de áudio órfão (`review-test.wav`, 60B) — identificado como resíduo MEU (não do Codex) e removido (Storage + linha). Nenhuma correção necessária na entrega do Codex.

## E2 tarefa 6 concluída — nó `Montagem` / concat local (2026-07-04, Codex)

Implementação concluída sem chamar fal.ai, sem worker, sem smoke test e sem executar fluxo de vídeo. Saídas:

- `lib/flows/runner.ts`: `collectInputs` agora respeita `PortSpec.multiple`; portas múltiplas recebem array ordenado pela posição X do nó de origem no canvas, com desempate por Y e id. Portas normais mantêm valor único.
- `lib/flows/video-nodes.ts`: criado `NodeDefinition` `video-assembly`/`Montagem`, com input `Clipes` múltiplo, custo `zeroCost`, polling de cada Generation de vídeo até `DONE`, download temporário compartilhado, `concatClips`, upload do MP4 e criação direta de `Asset` `VIDEO`/`GENERATED` sem `Generation` (`provider: labia/ffmpeg`, `model: concat`).
- `lib/providers/asset-storage.ts`: `uploadBufferAssetToSupabase` aceita `keyPrefix` opcional; chamadas antigas com `generationId` continuam no path anterior.
- `components/nodes/lab-flow-node.tsx`, `app/(studio)/fluxos/flow-canvas.tsx`, `lib/flows/graph.ts`: kind `video-assembly` registrado no canvas, com ícone próprio, sem select de modelo, dica de ordenação esquerda→direita e chip `custo R$0 (montagem local)`. O canvas trata output por `assetId`/`url`, sem forçar `generationStatus` quando não há `generationId`.
- Decisões registradas em `modulos/02-videos/decisoes.md`: Asset de Montagem sem `Generation` e `keyPrefix` no upload de buffer.

Validação desta sessão:

- `npx vitest run tests/flows/runner-inputs.test.ts tests/flows/video-nodes.test.ts tests/flows/registry.test.ts` -> 36 testes verdes.
- `npm run typecheck` -> limpo.
- `npm run lint` -> limpo.
- `npx vitest run` -> 101 testes verdes.
- `npm run dev` sem worker: `/api/flows/node-definitions` serviu `video-assembly`/`Montagem` com `multiple: true`; no canvas, a paleta mostrou o nó, e o nó exibiu dica de ordem e chip `custo R$0 (montagem local)`. A automação do browser não conseguiu criar arestas por drag, mas o handle renderizou como `connectable` e a ausência de limite no código foi coberta pelo teste puro de múltiplas entradas no runner.
- Banco verificado via Prisma: **0 Generations de vídeo, 0 Assets de montagem (`labia/ffmpeg`/`concat`) e 0 jobs pendentes** em `pgboss.job`.

Próxima ação: tarefa 6b da E2 (`Trilha/voz por upload`), sem mexer no concat já validado e tratando vídeo sem faixa de áudio própria em `mixAudioTrack`.

### Revisão Claude da tarefa 6 (2026-07-04) — APROVADA e commitada

Validação externa independente: lint, typecheck e **101 testes** re-executados pelo revisor (verdes). API viva conferida: `/api/flows/node-definitions` serve `video-assembly -> Montagem` com `multiple: true`. **Ponto de risco (mudança de engine em `collectInputs`) inspecionado a fundo**: portas `multiple` coletam array ordenado por X (desempate Y, id); portas normais mantêm valor único via `getEdgeOutputValue` (comportamento idêntico ao anterior) — coberto por 3 testes em `tests/flows/runner-inputs.test.ts`, incluindo o caso de duas imagens numa entrada não-múltipla (última vence, sem regressão). **A pendência visual do Codex (drag não criava arestas) foi fechada pelo revisor**: fluxo temporário no banco com 3 nós de vídeo em X fora de ordem + Montagem; abri no browser e as **3 arestas chegaram no handle único** de entrada (prova de que aceita múltiplas conexões), nó com dica de ordem e chip "custo R$0 (montagem local)", soma do fluxo ~R$12,15 (3×R$4,05, Montagem R$0 — exata), zero erros de console; fluxo apagado depois. Banco re-verificado: **0 Generations de vídeo, 0 Assets `labia/ffmpeg`/`concat`, 0 jobs pendentes**. Código: Asset de montagem criado direto (origin GENERATED, `generationId` null), download temp compartilhado com cleanup único no `finally`, `keyPrefix` no upload sem quebrar chamadores antigos, `getRecord` do canvas retorna `{}` (sem crash ao ler `output.assetId`). Acentos PT-BR corretos. Nenhuma correção necessária.

## FIM DE SESSÃO (2026-07-04) — por onde retomar

1. **Próxima tarefa: tarefa 6b da E2 — Trilha/voz por upload.** ATENÇÃO ao caso-limite registrado abaixo: `mixAudioTrack` hoje assume que o vídeo tem faixa de áudio; clipes Wan/Kling podem ser mudos. A 6b precisa tratar vídeo sem áudio próprio antes de mixar trilha/voz.
2. Depois: tarefa 7 (modal de custo total — a trava de gasto do produto) e tarefa 8 (retry por nó).
3. Então: escada de gerações reais (1 clipe Wan ~R$1,35 → emenda em beat → 30s+ ~R$8,24), cada degrau com aprovação do Felipe NA HORA; resultados alimentam o log do `TECNICAS.md`.
4. Paralelo aprovado: tarefas candidatas T1–T6 de templates/didática no `modulos/03-fluxos/CONSTRUCAO.md` (T1 "Revisar/Escolher" pode adiantar para a E2); Whitepaper v1 no fechamento da E2.
5. Regra viva: nenhuma geração paga sem ok explícito do Felipe com custo em R$ declarado antes; Codex nunca roda geração real; revisão sempre com validação externa (rodar suíte, browser, banco — nunca aceitar auto-declaração).

### Revisão Claude das tarefas 3-4 (2026-07-04) — APROVADAS e commitadas

Validação externa independente: lint, typecheck e **84 testes** re-executados pelo revisor (verdes; os 5 de ffmpeg processam clipes sintéticos reais `testsrc`+`sine` — validação de vídeo de verdade, custo R$0). API viva conferida com dev server sem worker: `/api/flows/node-definitions` serve `text2video -> Texto para Vídeo`. Banco re-verificado via Prisma: **0 Generations de vídeo, 0 jobs pendentes**. Código inspecionado: `ffmpeg-service.ts` usa spawn com array (sem injeção de shell), timeout com kill, stderr resumido, concat com re-encode justificado em comentário.

**Caso-limite registrado para a tarefa 6 (Montagem):** `mixAudioTrack` assume que o vídeo TEM faixa de áudio (`[0:a]` no filter_complex) — clipes de Wan/Kling nascem MUDOS e o mix falharia neles. O prompt da tarefa 6 deve exigir tratamento de vídeo sem trilha própria (ex.: `anullsrc` como fallback ou detecção prévia de faixa). Não é bug das tarefas 3-4 (contrato pedia mix sobre áudio existente).

## E2 tarefa 5 concluída — nó `Estender Vídeo` / frame-chaining (2026-07-04, Codex)

Implementação concluída sem chamar fal.ai, sem worker, sem smoke test e sem execução de fluxo de vídeo. Saídas:

- `lib/flows/video-nodes.ts`: criado o `NodeDefinition` `video-extend`/`Estender Vídeo`, com input/output `video`, custo via `FalProvider.estimateCost`, polling genérico de `Generation` até `DONE` com `Asset` tipo `VIDEO`, download temporário do vídeo upstream, `extractLastFrame`, upload do frame PNG e enqueue em `video.generate` com `image_url` do frame.
- `lib/providers/asset-storage.ts`: extraído `uploadBufferAssetToSupabase`, reutilizado por `uploadRemoteAssetToSupabase`. O frame intermediário sobe no path do `generationId` upstream e não cria linha `Asset`.
- Prompt de continuação: `sceneContext` pode vir do nó anterior pela aresta ou do campo local; o campo local vence. O prompt enviado anexa o contexto de cena usado. Output propaga `sceneContext` e `chainDepth = (input.chainDepth ?? 0) + 1`.
- `components/nodes/lab-flow-node.tsx`, `app/(studio)/fluxos/flow-canvas.tsx`, `lib/flows/graph.ts`: kind `video-extend` registrado no canvas, com controles compartilhados de vídeo, label `continuação`, textarea `Contexto de cena`, chip de custo em R$ e aviso visual a partir do 6º encadeamento.
- `lib/flows/video-chain.ts`: função pura para contar `video-extend` consecutivos upstream caminhando pelas arestas, coberta em teste unitário.
- Decisões registradas em `modulos/02-videos/decisoes.md`: frame intermediário sem `Asset`, precedência de `sceneContext` local e aviso de degradação calculado em tempo de edição.

Validação desta sessão:

- `npx vitest run tests/flows/video-nodes.test.ts tests/flows/video-chain.test.ts tests/flows/registry.test.ts` -> 31 testes verdes.
- `npm run typecheck` -> limpo.
- `npm run lint` -> limpo.
- `npx vitest run` -> 94 testes verdes.
- `npm run dev` sem worker: `/api/flows/node-definitions` serviu `video-extend`/`Estender Vídeo`; no canvas, a paleta mostrou o nó, e o nó exibiu select de modelo com preço, chip `~R$ 4,05`, prompt `continuação`, duração/resolução e textarea `Contexto de cena`. Seis nós foram adicionados apenas no estado local da tela, sem salvar e sem executar; a conexão visual por drag no browser não criou a cadeia, então o aviso do 6º encadeamento ficou validado pela função pura/teste unitário, não por inspeção visual completa.
- Banco verificado via Prisma: **0 Generations de vídeo, 0 jobs pendentes** em `pgboss.job` para `video.generate`.

Próxima ação: tarefa 6 da E2 (`Montagem`), obrigatoriamente tratando vídeo sem faixa de áudio própria.

### Revisão Claude da tarefa 5 (2026-07-04) — APROVADA e commitada

Validação externa independente: lint, typecheck e **94 testes** re-executados pelo revisor (verdes). API viva conferida: `/api/flows/node-definitions` serve `video-extend -> Estender Vídeo`. **A pendência visual do Codex foi fechada pelo revisor**: como o drag não criava arestas na sessão dele, o revisor criou um fluxo temporário direto no banco (Prisma) com Gerar Vídeo + 6 Estender encadeados e abriu no browser — os extends 1–5 renderizaram SEM aviso e o 6º mostrou o badge "6º encadeamento - qualidade tende a degradar acima de ~60s"; 6 arestas renderizadas, campo "contexto de cena" presente, chip ~R$4,05 por nó e soma do fluxo ~R$28,35 (7×R$4,05, exata), zero erros de console; fluxo temporário apagado depois. Banco re-verificado: **0 Generations de vídeo, 0 jobs pendentes**. Código inspecionado: poll generalizado sem duplicação, `uploadBufferAssetToSupabase` extraído e reutilizado (de quebra corrigiu acento preexistente em "não configurado"), precedência params > aresta no `sceneContext`, `chainDepth` propagado, cleanup do temp em `finally`, contagem de cadeia pura com proteção de ciclo. Acentos PT-BR corretos em toda a entrega — primeira vez sem regressão de acento em strings novas. Nenhuma correção necessária.

## E2 tarefas 3-4 concluídas — `Text2Video` + serviço ffmpeg local (2026-07-04, Codex)

Implementação das tarefas 3 e 4 do módulo `02-videos` concluída sem chamar fal.ai, sem worker e sem execução de fluxo de vídeo. Saídas:

- `lib/flows/video-nodes.ts`: criado o `NodeDefinition` `text2video`/`Texto para Vídeo`, com input text opcional, output video, prompt vindo de nó Prompt/texto ou campo do nó, custo via `FalProvider` e enqueue em `video.generate` sem `image_url`. O provider continua responsável por rotear para endpoint `text-to-video`.
- `components/nodes/lab-flow-node.tsx`, `lib/flows/graph.ts` e `app/(studio)/fluxos/flow-canvas.tsx`: kind `text2video` registrado no canvas/paleta, usando o mesmo componente de controles do `Gerar Vídeo`, sem campo de imagem de entrada e com chip de custo em R$ pelo fluxo.
- `lib/video/ffmpeg-service.ts`: serviço interno com `ffmpeg-static` + `spawn` por array de args, sem shell string; funções `extractLastFrame`, `concatClips` e `mixAudioTrack`; timeout default 5min e erros de ffmpeg resumidos.
- `tests/video/ffmpeg-service.test.ts`: validação externa local com clipes sintéticos `testsrc` + `sine`, cobrindo PNG do último frame com dimensões, concat com duração aproximada e áudio, mix preservando duração e áudio, arquivo inexistente e vídeo corrompido.
- Decisões registradas em `modulos/02-videos/decisoes.md`: Text2Video sem duplicar lógica de provider, concat com re-encode seguro, e uso exclusivo do binário local `ffmpeg-static`.

Validação parcial já feita nesta sessão: `npx vitest run tests/flows/video-nodes.test.ts tests/flows/registry.test.ts tests/video/ffmpeg-service.test.ts` -> 26 testes verdes. Antes de entregar, ainda rodar lint/typecheck/testes completos, preview sem worker e count de Generations/jobs de vídeo.

Próxima ação: tarefa 5 da E2 (`Nó Estender Vídeo`), usando `extractLastFrame` como base do frame-chaining.

## P8 executada — Anatomia e didática de fluxos de produção (2026-07-04, Codex)

`pesquisas/P8-anatomia-fluxos-producao.md` deixou de ser apenas SPEC e virou relatório executado, com 2 passadas e 18 fontes. Veredito: o canvas do LabIA não deve ensinar o usuário a "pensar em nós"; deve ensinar a pensar em **processo de produção**.

Cadeia canônica recomendada: Briefing de intenção -> Direção criativa -> Roteiro/copy -> Referências e prompts visuais -> Geração de candidatos -> Curadoria humana -> Vídeo/extend/montagem -> Adaptação por rede -> Aprovação/publicação -> Aprendizado.

Achados prioritários para retomar:

1. **Novo fluxo não deve abrir vazio por padrão.** Abrir com chooser de receitas/templates, mantendo "começar do zero" como opção avançada.
2. **Próximo nó sugerido por porta é prioridade.** Padrão mais forte encontrado: arrastar de uma saída para o vazio abre picker filtrado por nós compatíveis e já conecta.
3. **Nó `Revisar/Escolher` custo zero virou recomendação forte.** É o gate humano entre geração barata/cara e evita que vídeo herde erro de imagem.
4. **Tooltips de custo/capacidade por nó** na paleta e nos nós devem explicar modelo, limitações e custo estimado em R$.
5. **Fases visuais leves no canvas** (Briefing, Direção, Produção, Revisão, Montagem, Publicação, Aprendizado) ajudam didática, mas sem virar BPMN.

Impacto ainda NÃO aplicado em `modulos/03-fluxos/ESPECIFICACAO.md`, `modulos/03-fluxos/COMO-FUNCIONA.md`, `modulos/02-videos/TECNICAS.md`, `docs/DESIGN-SYSTEM.md`, `docs/WHITEPAPER.md` ou `pesquisas/P9-templates-fluxos-prontos.md`, porque muda requisitos e deve passar pelo Felipe antes de virar contrato de construção.

## P9 executada — Templates de fluxo prontos (2026-07-04, Codex)

`pesquisas/P9-templates-fluxos-prontos.md` deixou de ser apenas prompt e agora contém pesquisa executada com 18 fontes, duas passadas e recomendação de produto/técnica. Veredito: Templates devem ser `FlowTemplate` versionado com grafo JSON + manifest de placeholders, instanciado por galeria + wizard antes de abrir o canvas, sempre com custo estimado em R$ antes de rodar.

Primeira leva recomendada, usando apenas nós existentes/E2: `Post visual simples`, `Carrossel de variações visuais`, `Reel produto 6s barato`, `Trend visual a partir de foto`, `Text2Video rápido 10s`, `Campanha produto mini`, `Vídeo contínuo 30s+` e `Premium com áudio nativo`. Recomendação prática: lançar 5 como default visível e manter templates caros/premium como avançados.

Impacto ainda NÃO aplicado em `modulos/03-fluxos/ESPECIFICACAO.md`, `CONSTRUCAO.md` ou `prisma/schema.prisma`, porque SDD exige aprovação do Felipe antes de transformar pesquisa em contrato de construção. Próxima decisão: Felipe aprova/ajusta a P9; depois registrar decisão local em `modulos/03-fluxos/decisoes.md` e detalhar tarefas de Templates.

## Side quest registrada — fluxos didáticos, templates e whitepaper (2026-07-04)

Pedido do Felipe, com a preocupação explícita de que side quests não se percam nem saiam do plano. **Encaixe verificado: não é desvio — é o aprofundamento de features que o plano JÁ prevê** ("Templates de fluxo (E2+)" e AI Video Director/E3 em `modulos/03-fluxos/ESPECIFICACAO.md`; "biblioteca de formatos validados" no backlog do ROADMAP). O que foi criado:

1. **`pesquisas/P8-anatomia-fluxos-producao.md`** — spec de pesquisa profunda: como fluxos são bem feitos (ComfyUI/n8n/Higgsfield/Flow), a ordem canônica de trabalho do social media (briefing → direção → geração → montagem → publicação), lente de mapeamento de processos, padrões de canvas didático, e o manual do fluxo manual bem-feito hoje. Duas passadas, 12+ fontes, recomendação obrigatória por seção.
2. **`pesquisas/P9-templates-fluxos-prontos.md`** — spec de pesquisa: fluxos pré-moldados onde o usuário só troca as informações. Primeira leva de 5–8 templates (só com nós da E2), o que parametrizar, modelo de dados e UX de instanciar. Depende conceitualmente da P8.
3. **Whitepaper registrado no backlog do ROADMAP** — passo a passo didático da plataforma inteira; 1ª versão no fechamento da E2; esqueleto vem da P8, capítulo de templates da P9, receitas do TECNICAS.md.

Resposta à dúvida do Felipe sobre "começa pelo briefing → notas de direção?": hoje o canvas é livre (não impõe ordem); a cadeia briefing → direção → execução é exatamente o AI Video Director da E3, e a P8 vai validar/nomear essa ordem canônica antes — inclusive para a UX didática do canvas.

**Sequência combinada:** executar P8 e P9 (pesquisa profunda, custo R$0) → seguir tarefas 3–8 da E2 → escada de gerações reais → fechamento E2 dispara Whitepaper v1. As pesquisas NÃO bloqueiam as tarefas 3–8 (são frentes paralelas); bloqueiam apenas a construção de Templates.

### P8 e P9 executadas pelo Codex e revisadas pelo Claude (2026-07-04) — APROVADAS como pesquisa

Revisão independente: 18 fontes em cada, com URL+data; amostragem verificada de fora (doc do Magnific Spaces bate palavra por palavra com as alegações de UX; template n8n de social media existe e faz o descrito; `Flow.isTemplate` existe no schema como a P9 afirma); **as 8 contas de custo da tabela de templates refeitas pelo revisor — todas exatas** contra `docs/06-PROVEDORES.md`. Entregas-chave:

- **P8:** ordem canônica em 10 etapas (briefing → direção → copy → refs/prompts → geração → curadoria → montagem → adaptação por rede → publicação → aprendizado); 10 recomendações de UX didático priorizadas (top 5: chooser no lugar de canvas vazio, próximo nó sugerido por porta, nó "Revisar/Escolher" custo zero, tooltips de custo, conexão inválida explicada); manual do fluxo manual bem-feito hoje (candidato a 1ª receita do TECNICAS.md).
- **P9:** primeira leva de 8 templates com custo típico (5 visíveis + 2 avançados recomendados); desenho `FlowTemplate` versionado com manifest de placeholders; UX galeria → wizard → canvas montado com custo antes.

**DECISÃO DO FELIPE (2026-07-04): APROVADO — e com as 10 recomendações da P8, não só as top 5.** Aplicado nos docs pelo Claude: `modulos/03-fluxos/ESPECIFICACAO.md` (Templates com desenho da P9 + seção Didática do canvas com as 10), `CONSTRUCAO.md` (tarefas candidatas T1–T6; T1 "Revisar/Escolher" é candidato a adiantar para a E2), `decisoes.md` (4 decisões novas), `modulos/02-videos/TECNICAS.md` (Receita 1: fluxo manual bem-feito), `docs/DESIGN-SYSTEM.md` (seção UX didático). Timing de construção dos templates: fim da E2 ou abertura da E3 — Felipe decide na hora.

## E2 tarefa 2 concluída — nó `Gerar Vídeo` img2video no canvas (2026-07-04, Codex)

Implementação da tarefa 2 do módulo `02-videos` concluída sem chamar API paga, worker, smoke test ou execução de fluxo com vídeo. Saídas:

- `lib/flows/video-nodes.ts`: criado o NodeDefinition `video-generation`/`Gerar Vídeo`, com input `image`, output `video`, `estimateCost` delegando para `FalProvider.estimateCost`, enqueue via `enqueueVideoGenerationJob` e output espelhando o nó de imagem (`generationId`, `queueJobId`, `status`, `model`, `estimatedCost`).
- Espera assíncrona da imagem upstream: quando o input vem do nó `Gerar Imagem` com `generationId`, o nó de vídeo faz polling da `Generation` até `DONE`, lê o `Asset` de imagem e só então enfileira vídeo; `FAILED`, timeout ou ausência de imagem falham com erro legível sem enfileirar nada. Decisão registrada em `modulos/02-videos/decisoes.md`.
- `lib/flows/registry.ts` e `lib/flows/graph.ts`: `video-generation` registrado no registry vivo e adicionado aos kinds do canvas.
- `components/nodes/lab-flow-node.tsx` e `app/(studio)/fluxos/flow-canvas.tsx`: UI do nó com select dos 5 modelos, preços legíveis, prompt de movimento, duração por modelo, resolução só em Wan/Seedance, toggle `Gerar áudio` só em Seedance/Veo 3 e chip de custo em R$ via estimativa do fluxo.
- `tests/flows/video-nodes.test.ts`: testes unitários com mock de Prisma/fila cobrindo delegação de custo por modelo, imagem DONE, imagem FAILED, falta de imagem e timeout.

Validação desta sessão:

- `npx vitest run tests/flows/video-nodes.test.ts tests/flows/registry.test.ts` -> 18 testes verdes.
- `npm run typecheck` -> limpo.
- `npx vitest run` -> 76 testes verdes.
- `npm run lint` -> limpo.
- `npm run dev` sem worker: paleta mostrou `Gerar Vídeo` vindo de `/api/flows/node-definitions`; o nó exibiu os 5 modelos, durações/resolução/áudio condicionais e chip de custo em R$ mudando. Veo 3 caiu de ~R$17,28 com áudio para ~R$8,64 sem áudio.
- Consulta de leitura no banco para modelos de vídeo retornou `count: 0`; nenhuma `Generation` de vídeo foi criada e nenhum job de vídeo ficou enfileirado.

Próxima ação: tarefa 3 da E2 (`Text2Video`), mantendo a regra de zero geração real sem aprovação explícita do Felipe.

### Revisão Claude da tarefa 2 (2026-07-04) — APROVADA e commitada

Validação externa independente (não aceitou a auto-declaração):

- Lint, typecheck e os 76 testes re-executados pelo revisor — verdes.
- **Canvas real no browser** (dev server SEM worker): paleta mostra "Gerar Vídeo" vindo do registry; 5 modelos no select com preço legível; Wan default com chip ~R$4,05 (5s×US$0,15×5,40 — exato); Veo 3 com durações 4/6/8s, toggle de áudio e R$17,28 com áudio / R$8,64 sem (dobro/metade correto); Hailuo com 6s/10s, SEM toggle de áudio e chip R$1,51 (6s×US$0,28×5,40 — exato); soma do fluxo no topo atualizou para ~R$1,65 (imagem + vídeo). Acentos PT-BR corretos. Zero erros de console. Screenshot conferido. O nó de teste NÃO foi salvo no fluxo.
- **Banco verificado direto via Prisma pelo revisor**: 0 Generations de vídeo e 0 jobs pendentes em `pgboss.job` na fila `video.generate`.
- Código inspecionado: espera da imagem upstream com poll+timeout de 10min e falha legível sem enfileirar — implementação fiel ao ponto de design do prompt.

Nenhuma correção necessária. Observação (débito E1, não regressão): o título do fluxo de teste segue com mojibake no banco (`Valida??o worker ?nico`).

## E2 tarefa 1 concluída — custo de vídeo + fila `video.generate` (2026-07-04, Codex)

Implementação da tarefa 1 do módulo `02-videos` concluída sem chamar API paga, worker, smoke test ou geração real. Saídas:

- `lib/providers/fal.ts`: `estimateCost` agora roteia modelos de vídeo antes dos modelos de imagem e calcula Wan 2.5, Kling 2.5 Turbo Pro, Hailuo 2.3 Standard, Seedance 2.0 e Veo 3 com a tabela local da tarefa 0. `generate`/`waitForResult` aceitam endpoints de vídeo, normalizam input por modelo e falham de forma legível se o output não trouxer URL de vídeo.
- `lib/providers/video-generation-job.ts`: criada fila `video.generate`, com `Generation` gravada com custo estimado antes do enqueue, transição RUNNING/DONE/FAILED, persistência de `Asset` tipo `VIDEO`, custo real e erro legível compartilhado.
- `scripts/worker.ts`: worker unificado passa a registrar `flow-node-execution`, `image.generate` e `video.generate`.
- `lib/providers/provider-errors.ts`: extraído `getProviderErrorMessage` para evitar duplicação entre imagem e vídeo.
- `tests/providers/fal-video-cost.test.ts`: 20 testes unitários para preços de vídeo, BRL, erros legíveis e custo real por duração retornada.
- `modulos/02-videos/fontes-tarefa-0.md`: Seedance 1080p reconfirmado na página pública fal.ai em 2026-07-04 antes de entrar no `estimateCost`.

Validação desta sessão:

- `npx vitest run tests/providers/fal-video-cost.test.ts` -> 20 testes verdes.
- `npx vitest run` -> 67 testes verdes.
- `npm run lint` -> limpo.
- `npm run typecheck` -> limpo.
- Nenhum comando executado nesta sessão chamou `fal.queue`, `worker`, `smoke`, `npm run dev` ou geração real.

### Revisão Claude da tarefa 1 (2026-07-04) — APROVADA e commitada

Validação externa independente: lint, typecheck e os 67 testes re-executados pelo revisor, tudo verde. Diff inspecionado por completo: roteamento vídeo/imagem no `estimateCost`, matemática de custo conferida caso a caso contra a tabela da tarefa 0 (Wan por resolução, Kling 0,35+0,07/s, Hailuo 6s/10s com rejeição de duração não confirmada, Seedance 720p/1080p com rejeição de resolução sem preço, Veo 3 com/sem áudio, custo real pela duração retornada), fila `video.generate` espelhando fielmente o padrão de `image.generate` (custo estimado gravado ANTES do enqueue, erro legível compartilhado em `provider-errors.ts`, expire 1800s justificado). **Seedance 1080p a US$0,682/s re-verificado pelo revisor na página pública** ("for 1080p you will be charged $0.682/second") — a leitura da revisão da tarefa 0 é que tinha sido parcial; a reconfirmação do Codex estava correta. `AssetType.VIDEO` já existia no schema Prisma (sem migration). Nenhuma correção necessária — primeira entrega do Codex na E2 sem regressão de acentos.

## E2 tarefa 0 concluída — catálogo fal.ai de vídeo (2026-07-04, Codex)

Mapeamento documental da tarefa 0 do módulo `02-videos` concluído sem chamar API paga, worker, smoke test ou geração real. Saídas:

- `lib/providers/fal-models.ts`: criado `FAL_VIDEO_MODELS` com 5 famílias pedidas: Wan 2.5, Kling 2.5, Hailuo/MiniMax, Seedance 2.0 e Veo 3. Cada item registra endpoint(s), preço, duração, suporte a áudio nativo, suporte a extend nativo e `defaultInput`.
- `lib/providers/model-provider.ts`: `PricingUnit` passou a aceitar `clip`, necessário para modelos cobrados por geração/clipe.
- `lib/providers/fal.ts`: `listModels("video")` agora devolve o catálogo de vídeo, sem implementar geração.
- `docs/06-PROVEDORES.md`: tabela atualizada com os 5 modelos, preço em USD e data/fonte 2026-07-04.
- `modulos/02-videos/fontes-tarefa-0.md`: URLs exatas consultadas e lacunas registradas.
- `modulos/02-videos/CONSTRUCAO.md`: status atualizado e tarefa 0 marcada como concluída.

Lacunas/alertas registrados:

1. Wan 2.5: tem `audio_url` de entrada/background music, mas não foi encontrada geração nativa de áudio.
2. Kling 2.5: sem áudio nativo no endpoint geral da fal.ai; extend nativo não confirmado na fal.ai (P2 citava fora da fal.ai).
3. Hailuo 2.3: Standard ficou como canônico por ter duração/preço claros; Pro aparece como US$0,49/geração, mas a duração não ficou explícita no schema público; áudio nativo ficou lacuna.
4. Seedance 2.0: conflito pequeno de preço entre páginas (`US$0,3034/s` vs `US$0,3024/s` no image-to-video); catálogo usa o maior valor e registra o conflito.
5. Veo 3: conflito de preço na própria doc (`US$0,20/s` sem áudio e `US$0,40/s` com áudio no endpoint; Readme cita Standard `US$0,50/0,75` e Fast `US$0,25/0,40`); catálogo registra o conflito.

Validação desta sessão:

- `npm run lint` limpo.
- `npm run typecheck` limpo.
- `git diff --check` sem erros de whitespace; apenas avisos CRLF normais do Windows.
- Nenhum comando executado nesta sessão chamou `fal.queue`, `worker`, `smoke` ou `npm run dev`.

### Revisão Claude da tarefa 0 (2026-07-04) — APROVADA e commitada

Validação externa independente (não aceitou a auto-declaração): lint, typecheck e 47 testes rodados de novo pelo revisor, tudo verde; **os 5 preços conferidos por segunda leitura das páginas públicas da fal.ai (WebFetch)** — Wan, Kling, Veo 3, Hailuo e Seedance batendo com o catálogo. Diff inspecionado: nenhuma chamada de geração, só dados + `listModels("video")`. Correções de revisão aplicadas direto: acentos PT-BR restaurados em `fontes-tarefa-0.md` (Codex entregou sem acento de novo — padrão recorrente, checar em toda revisão) e registrada incerteza adicional no preço 1080p do Seedance (US$0,682/s não reconfirmado na releitura; reconfirmar na tarefa 1 antes de entrar no `estimateCost`).

## E2 aberta — spec aprovada (2026-07-03, sessão de orquestração)

Spec do módulo 02-videos revisada com o Felipe e **aprovada** ("pra cima bora"). Norte declarado por ele: conter tudo que precisamos para fazer os fluxos da melhor maneira e **nunca desperdiçar dinheiro**. Decisões dele nesta sessão (registradas em `modulos/02-videos/decisoes.md`):

1. **Catálogo amplo, gate no gasto:** Wan 2.5, Kling 2.5, Hailuo, Seedance E Veo 3 no select com preço (comparar chinês × ocidental é o produto); a proteção é a aprovação explícita dele antes de cada geração, não cortar modelo do catálogo. (Reverteu proposta do Claude de tirar o Veo 3.)
2. **Áudio desde o início:** som é parte do vídeo. Toggle de áudio nativo por modelo + trilha/voz na Montagem. Limite técnico (P2): frame-chaining não preserva áudio contínuo entre clipes → continuidade sonora vem da trilha, e a direção dos cortes segue o áudio (emendas em beats).
3. **Expertise é entregável:** criado `modulos/02-videos/TECNICAS.md` (doc vivo) — direção de cortes com áudio, consistência entre clipes, receitas replicáveis (tutoriais) e log de experimentos. Toda geração paga registra prompt/custo/aprendizado.

Escada de validação combinada: 1 clipe Wan ~R$1,35 → teste de emenda em beat → fluxo 30s+ ~R$8,24 (6 clipes Wan + imagem). Cada degrau com aprovação do Felipe NA HORA; aprovação de uma geração não vale para a próxima.

**Prompt da tarefa 0 (mapear catálogo fal.ai: endpoints, preços com/sem áudio, durações — ZERO geração) foi entregue ao Felipe no chat da sessão para colar no Codex.** Se perdido, regenerar a partir do CONSTRUCAO.md tarefa 0 do módulo 02.

## Marco: primeira imagem real (2026-07-03)

Fluxo Prompt -> Gerar Imagem rodou de ponta a ponta com saldo real: FlowRun `cmr5jxsi9000hvd5cgaqo09qz` -> Generation `cmr5jy3ry0000vdeczlnfbh0j` DONE, FLUX dev, custo estimado R$0,135 ANTES e custo real R$0,135 DEPOIS, asset 1024x768 no Supabase Storage, visível na `/biblioteca` com prompt recuperável. Regra nova do Felipe: **nenhum gasto de API sem aprovação explícita dele** (cartão pessoal na fal.ai). Comparação lado a lado (tarefa 6) adiada por decisão dele. Handles do canvas estavam invisíveis (Felipe não conseguia conectar nós) — corrigidos para 16px esmeralda (`710f48b`).

## Onde estamos

**E1 em andamento, ~88%.** Funcionando de verdade (validado, não declarado): app shell com dashboard/lista/canvas, persistência de fluxos no Supabase real, motor de execução + custos com 47 testes unitários verdes, ModelProvider fal.ai completo até a chamada real, bucket de assets criado, migrations aplicadas, nós `Prompt` e `Gerar Imagem` registrados no registry e disponíveis na paleta flutuante do canvas, worker único `npm run worker` consumindo `flow-node-execution` e `image.generate`, `/biblioteca` real com grid/filtros consultando `Asset` + `Generation`.

**Worker unificado implementado, revisado e commitado.** Revisão Claude reproduziu a validação de forma independente (não aceitou a auto-declaração): worker subiu com as duas filas, run novo `cmr5evbev000qvd6wrkwhbi3k` executou Prompt -> Gerar Imagem de ponta a ponta e a `Generation cmr5evly30000vdas2ud40y5k` falhou com `Exhausted balance - HTTP 403` legível, como esperado sem saldo. Detalhe original da entrega: `scripts/worker.ts` carrega `.env.local`, registra `flow-node-execution` via `registerFlowNodeWorker` -> `executeFlowRunNode` e registra `image.generate` via `startImageGenerationWorker`. Validação externa: worker logou as duas filas ativas; com `npm run dev` em paralelo, um fluxo Prompt -> Gerar Imagem criou `FlowRun cmr5e8egz0008vd58exhblo6h`, o nó de imagem saiu de `queued`, criou `Generation cmr5e8qld0000vd84qgl2jc4a` e a fal.ai respondeu `User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing. - HTTP 403`, persistido como erro legível.

**Revisão das tarefas 4-5 concluída e commitada (`c6a6804`).** A entrega do Codex estava no working tree (não commitada, ao contrário do que a versão anterior deste arquivo dizia). Revisão contra os critérios do CONSTRUCAO.md com validação externa: 47 testes, lint, typecheck, build, e canvas vivo no browser - paleta carrega os 5 nós do registry via `/api/flows/node-definitions`, no `Gerar Imagem` mostra chip de custo estimado (~R$0,14) ANTES da execução e select com 2 modelos + preço, `/biblioteca` renderiza filtros e empty state. Correção de revisão aplicada direto: acentos PT-BR restaurados em strings de UI que o Codex removeu (incluindo regressão em "salvo às").

## Decisões mudadas nesta sessão (e o porquê)

1. **Worker único para as duas filas** (implementado nesta sessão): um processo `npm run worker` registra `flow-node-execution` E `image.generate` juntos. Por quê: em dev/E1, um único processo reduz operação e evita esquecer uma fila; separar só quando houver razão de escala ou isolamento.
2. **Erro da fal.ai deve preservar detalhe do corpo da resposta.** Por quê: `Forbidden` sozinho não prova nem orienta; o worker agora extrai `body.detail/message`, status HTTP e requestId quando existirem, permitindo mostrar `Exhausted balance` de forma legível no nó/Generation.

(Decisões da sessão anterior - par esmeralda, app shell, chip de custo condicional, registry vivo em `estimateFlowCost`, nós como definições de registry - seguem valendo; ver histórico do git.)

## Débitos técnicos (assumidos conscientemente)

- **Saldo fal.ai zerado** -> smoke/fluxo chegam na chamada real e param em `Exhausted balance`; a primeira imagem real nunca rodou. Ação: Felipe faz top up de US$10 -> rodar `npx dotenv-cli -e .env.local -- npm run smoke:image` e depois `npm run worker` + fluxo pelo canvas.
- **Critérios de aceite E1 ainda abertos:** smoke real com imagem, imagem aparecendo no nó com custo real depois, asset real na biblioteca, comparação lado a lado (tarefa 6: Nó Comparar + Nó Referência), falha simulada com retry visual por nó.
- **Strings backend sem acento** em `lib/providers/*` (erros de fal.ts, asset-storage etc., preexistentes) - limpar quando tocar nesses arquivos.
- **Wordmark provisória** (Space Grotesk 700, sem logo).
- **Prompt do fluxo de teste com mojibake:** o texto gravado pelo Codex no fluxo `cmr5dy5200002vd581a6hyi9h` contém U+FFFD (corrompido na entrada, não no pipeline de leitura — verificado por codepoint). Na revisão integrada, digitar um prompt acentuado num browser real para confirmar que a entrada via UI preserva UTF-8.
- **Limpeza menor:** no "Validação Claude" ficou no fluxo do banco; pasta `Temp\claude\labia-tests-worktree` pode ter sobrado no disco; considerar `.gitattributes` para warnings LF/CRLF.
- **Pesquisas com pendência agendada:** P3 (métricas dos agregadores -> reabrir na E5), P6 (medir throughput real do `codex exec` -> E3).

## Validado nesta sessão (2026-07-03, revisão)

- `npx vitest run` -> 47 testes verdes.
- `npm run lint` e `npm run typecheck` limpos (antes e depois das correções de acento).
- `npm run build` ok - todas as rotas compilam, incluindo `/api/generations/[generationId]` e `/api/flows/[flowId]/runs/[runId]`.
- Browser preview real: dashboard, `/fluxos/[id]` com canvas + paleta do registry + nó Gerar Imagem com custo estimado e modelos, `/biblioteca` com filtros. Screenshot da ferramenta de preview travou (flakiness conhecida), validação foi via inspeção de DOM.

## Validado nesta sessão (2026-07-03, Codex worker)

- `npx dotenv-cli -e .env.local -- npm run worker` -> logou `Worker ativo na fila flow-node-execution.` e `Worker ativo na fila image.generate.`.
- `npm run dev` em paralelo (porta 3001 porque 3000 estava ocupada) + canvas em `/fluxos/cmr5dy5200002vd581a6hyi9h`: fluxo Prompt -> Gerar Imagem disparado; `GET /api/flows/cmr5dy5200002vd581a6hyi9h/runs/cmr5e8egz0008vd58exhblo6h` mostrou run `done`, nó `image-worker-check` `done`, com `generationId cmr5e8qld0000vd84qgl2jc4a`.
- `GET /api/generations/cmr5e8qld0000vd84qgl2jc4a` -> `FAILED` com erro legível `User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing. - HTTP 403`.
- `npx vitest run` -> 47 testes verdes.
- `npm run lint` -> limpo.
- `npm run typecheck` -> limpo.

## Deploy Vercel (2026-07-03) — FUNCIONANDO

Site em produção: `https://labia-zilli26s-projects.vercel.app` (projeto `labia`, conta `zilli26`). **Biblioteca confirmada funcionando pelo Felipe** após correção: as env vars subiram contaminadas com `\r` (pipe do PowerShell) causando `PrismaClientInitializationError`; re-subidas via bash `printf` e redeploy. Lição: env vars para Vercel no Windows SEMPRE via `printf '%s'`, nunca pipe do PowerShell. Deployment Protection segue ativa (só o Felipe logado na Vercel vê; desativar em Settings -> Deployment Protection quando quiser acesso público). Worker continua local (`iniciar-labia.bat` na raiz sobe dev + worker); o site na nuvem enfileira no mesmo Postgres, geração processa só com worker ligado.

## Por onde retomar (nesta ordem)

**E2 em andamento, spec APROVADA (2026-07-03). SDD cumprido — código liberado seguindo a ordem do CONSTRUCAO.md do módulo 02.**

1. **Próxima tarefa no Codex: tarefa 3 (`Text2Video`)** do `modulos/02-videos/CONSTRUCAO.md`, reaproveitando catálogo/custo/fila e mantendo a instrução de NUNCA rodar geração real.
2. **Tarefas 4-8 do CONSTRUCAO.md** em ordem (serviço ffmpeg, Extend, Montagem com áudio, modal de custo total, retry por nó). Prompts do Codex sempre com a instrução de NUNCA rodar geração real.
3. **Gerações reais:** escada 1 clipe (~R$1,35) → emenda em beat → 30s+ (~R$8,24), cada uma com custo em R$ declarado e ok do Felipe na hora. Cada geração alimenta o log do `TECNICAS.md`.
4. **Débitos E1 (não bloqueiam E2, não esquecer):** retry visual por nó (parte será quitada pela tarefa 8 da E2); comparação lado a lado (tarefa 6 E1, adiada); imagem renderizando no nó via UI observada pelo Felipe; Deployment Protection a desativar quando ele quiser site público.
5. **Ambiente segue o mesmo** (seção Ambiente abaixo). Vercel: env vars via bash `printf`, nunca pipe PowerShell.

## Ambiente (para quem chegar do zero)

`.env.local` completo e funcional (Supabase + FAL_KEY + câmbio). Banco migrado. Bucket `assets` existe. Dev: `npm run dev` (porta 3000 se livre). Testes: `npx vitest run`. Worker único: `npm run worker`. Worker legado só imagem: `npm run worker:image`. Scripts com env: prefixar `npx dotenv-cli -e .env.local --`.
