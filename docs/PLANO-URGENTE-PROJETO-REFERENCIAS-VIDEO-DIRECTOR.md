# Plano urgente — Projetos, referências importadas, vídeo e Production Director

> Documento canônico visível no Obsidian. Substitui a cópia interna que foi criada por engano em `.hermes/`.

## O pedido que este plano cobre

1. Deixar a experiência tão clara e limpa quanto plataformas de referência, copiando referencias  UI, identidade ou textos de terceiros.
2. Criar um local real para importar imagem/vídeo de referência dentro do Projeto.
3. Permitir um fluxo TikTok Shop/produto usando a imagem original importada, sem obrigar a gerar uma imagem nova antes.
4. Renomear e explicar os nós hoje confusos: `Estender Vídeo` e `Montagem`.
5. Reposicionar o Projeto como a casa do trabalho, com canvas como bancada de produção.
6. Construir um agente de produção ligado ao trabalho já feito com OAuth ChatGPT, mas somente onde a capacidade estiver realmente comprovada.

## Objetivo

Transformar o LabIA em um lugar de produção por projeto: importar a peça real que já existe — por exemplo, criativo/foto de produto do TikTok Shop —, usá-la como entrada legítima de vídeo, deixar explícito o papel de “Continuar clipe” e “Juntar clipes”, e preparar o AI Production Director como camada de decisão, não como um chat solto.

## Arquitetura

`Project` passa a ser o contêiner de trabalho; `Asset` importado continua a entidade persistida e reutilizável; o novo nó utilitário `asset-input` expõe um Asset aprovado como saída tipada para o Flow. O canvas permanece a espinha dorsal de execução, mas não é mais a primeira tela nem a única forma de entender o trabalho. O Director propõe um grafo/shotlist e uma estimativa; ele nunca gera, enfileira ou cobra sem aplicação e revisão explícita.

## Diagnóstico confirmado

- Projetos já existem, mas são uma lista com onboarding mínimo. Criar um Projeto abre imediatamente seu Flow principal (`components/projects/project-onboarding.tsx`, `lib/projects.ts`), sem espaço para anexar fontes ou referências.
- O modelo `Asset` já suporta `origin = UPLOADED`, `projectId`, MIME, tamanho, dimensões e `metadata` (`prisma/schema.prisma`). O primeiro corte não precisa de tabela/migration apenas para distinguir fonte e referência; esses papéis cabem em metadata validado.
- A única rota de upload aceita exclusivamente áudio (`app/api/assets/upload/route.ts`). O nó de vídeo aceita uma URL manual de imagem (`components/nodes/lab-flow-node.tsx`), mas isso não é experiência de produto, não vincula ao Projeto e não torna a imagem reutilizável como Asset.
- O executor do nó de vídeo já aceita `image_url` direto ou um input tipado de imagem (`lib/flows/video-nodes.ts`). Um Asset importado pode gerar vídeo sem passar por “Gerar Imagem”.
- **Continuar clipe** (nome atual: `Estender Vídeo`) baixa o vídeo anterior, extrai seu último frame e o manda como primeira imagem de um novo img2video. É continuação de cena; não serve para abrir/importar vídeo.
- **Juntar clipes** (nome atual: `Montagem`) ordena dois ou mais vídeos pelo X dos nós, concatena em MP4 com ffmpeg e pode misturar trilha/voz. É a saída para roteiro multi-cena, não um passo inicial de criação.
- Há conexão OAuth ChatGPT e executor para imagem, mas não há capacidade de agente de texto pronta para chamar no produto. O plano não deve fingir que “ChatGPT conectado” já habilita o Director; a capacidade precisa ser adicionada e comprovada pelo contrato oficial do executor.

## Direção de produto

1. **Projeto é o lar; canvas é a bancada.** Cada projeto mostra objetivo, formato, referências/importações, Flow principal, gerações e resultados. A Biblioteca continua sendo o acervo transversal.
2. **Importar é caminho de primeira classe.** “Tenho uma imagem/produto real” é o caminho recomendado para vídeo de produto/TikTok Shop; gerar imagem do zero é alternativa, não pré-requisito.
3. **Fonte e referência não são sinônimos.**
   - `imagem-base`: arquivo que entra em “Animar imagem” e vira o primeiro frame do clipe.
   - `referência visual`: arquivo que orienta a direção/Director e só entra num modelo se o modelo declarar suporte.
   - `resultado`: Asset produzido pelo Flow.
4. **Nomes descrevem o resultado, não a implementação.** `Gerar Vídeo` vira **Animar imagem** quando o caminho é img2video; `Estender Vídeo` vira **Continuar clipe**; `Montagem` vira **Juntar clipes**. Os tipos internos e flows salvos permanecem compatíveis.
5. **Inspirar-se em princípios, não copiar Higgsfield.** O LabIA preserva “laboratório noturno”, custos em verde e identidade própria. A paleta será contextual: `Criar`, `Projeto`, `Pós-produção`, `Direção`.
6. **O Director decide antes de gastar.** Ele lê dados do Projeto e referências escolhidas, propõe cenas/modelos/prompts/custos e exige “Aplicar ao Flow”. A confirmação de custo atual continua sendo a única porta para enfileirar geração.

---

## Bloco 0 — Fixar o contrato antes de código

**Objetivo:** atualizar a especificação para que desenvolvimento não seja guiado pelo estado atual da UI.

**Arquivos:**
- Modificar: `modulos/02-videos/ESPECIFICACAO.md`
- Modificar: `modulos/02-videos/COMO-FUNCIONA.md`
- Modificar: `modulos/03-fluxos/ESPECIFICACAO.md`
- Modificar: `modulos/03-fluxos/CONSTRUCAO.md`
- Modificar: `modulos/03-fluxos/decisoes.md`
- Modificar: `docs/DESIGN-SYSTEM.md`
- Criar: `docs/adr/0003-project-first-media-input.md`

**Passos:**
1. Registrar o contrato Projeto-first, os papéis de Asset e que upload não executa geração.
2. Especificar `asset-input`: sem entrada, saída `image` ou `video`, custo R$0, validação de ownership/workspace/projeto antes de expor um Asset ao Flow.
3. Corrigir texto dos nós de vídeo para os nomes de produto acima, preservando tipos atuais para compatibilidade.
4. Definir o Director como proposta estruturada + revisão humana + aplicação explícita, sem geração automática.
5. Aprovar o contrato antes de começar implementação, como exige `AGENTS.md`.

**Aceite:** não existe ambiguidade entre Asset de referência e imagem-base; a spec afirma que um criativo importado pode alimentar img2video sem gerar outra imagem.

## Bloco 1 — Importação real, persistida e vinculada ao Projeto

**Objetivo:** permitir upload seguro de imagem e vídeo ao Projeto, persistindo em Storage e `Asset` com procedência/papel, sem API de geração nem custo.

**Arquivos:**
- Criar: `lib/assets/asset-input.ts` — validação compartilhada de tipo/MIME/tamanho/papel e parser seguro de metadata.
- Criar: `lib/assets/project-assets.ts` — consultas escopadas por workspace/projeto e criação do Asset.
- Modificar: `app/api/assets/upload/route.ts` — evoluir de áudio apenas para upload de `IMAGE`, `VIDEO` e `AUDIO`; receber `projectId` e `role` multipart.
- Criar: `app/api/projects/[projectId]/assets/route.ts` — listar/importar Assets do Projeto com checagem de scope.
- Modificar: `lib/providers/asset-storage.ts` — somente se necessário para preservar extensão/MIME de MP4 e imagem; não duplicar cliente Supabase.
- Modificar: `app/(studio)/biblioteca/page.tsx` — apresentar origem Importado e papel quando existirem.
- Modificar: `tests/api/assets-upload-route.test.ts`
- Criar: `tests/api/project-assets-route.test.ts`
- Criar: `tests/lib/project-assets.test.ts`

**Regras de implementação:**
1. Primeiro corte suporta JPG, PNG e WebP para imagem-base/referência; MP4/MOV/WebM para vídeo importado. Limites serão constantes centralizadas e testadas. Áudio mantém comportamento atual.
2. Validar arquivo vazio, tamanho, MIME e extensão antes de enviar ao Storage. Não aceitar URL arbitrária neste corte.
3. Validar que `projectId` pertence ao workspace antes do upload e gravar `Asset.projectId`; `Asset.origin = UPLOADED`; metadata aceita apenas `{ originalFileName, projectRole: "source" | "reference" | "audio" }` por allowlist.
4. Retornar só dados não sensíveis: `assetId`, `url`, `type`, `projectRole`, dimensões quando disponíveis. Nunca devolver credenciais de Storage.
5. Não chamar worker, ModelProvider, FlowRun ou custo durante upload.

**Testes RED/GREEN mínimos:**
- imagem PNG/JPEG aceita e cria `IMAGE/UPLOADED` vinculado ao projeto;
- referência de projeto de outro workspace retorna 404/403 sem upload;
- tipo/tamanho/papel inválidos não chegam ao Storage;
- upload existente de áudio continua verde;
- listagem do projeto não expõe Assets de outro projeto/workspace.

## Bloco 2 — Casa do Projeto e entrada “Imagem-base” no canvas

**Objetivo:** dar ao usuário uma tela limpa de projeto e conectar mídia importada ao Flow por Asset ID, não por URL colada.

**Arquivos:**
- Criar: `app/(studio)/projetos/[projectId]/page.tsx`
- Criar: `components/projects/project-workspace.tsx`
- Criar: `components/projects/project-assets-panel.tsx`
- Modificar: `components/projects/project-onboarding.tsx`
- Modificar: `app/(studio)/projetos/page.tsx`
- Modificar: `lib/projects.ts`
- Modificar: `app/api/projects/[projectId]/route.ts`
- Modificar: `lib/flows/graph.ts`
- Modificar: `lib/flows/utility-nodes.ts`
- Modificar: `lib/flows/registry.ts`
- Modificar: `app/(studio)/fluxos/flow-canvas.tsx`
- Modificar: `components/nodes/lab-flow-node.tsx`
- Modificar: `lib/flows/templates.ts`
- Criar: `tests/flows/asset-input-node.test.ts`
- Criar: `tests/app/project-workspace-page.test.tsx`
- Modificar: `tests/app/projects-page.test.tsx`
- Modificar: `tests/flows/flow-canvas-layout.test.tsx`

**Passos:**
1. Depois de criar o Projeto, navegar para `/projetos/:projectId`, não direto para o canvas. A página inicia com resumo, seção **Fontes e referências**, CTA de upload e CTA secundário para abrir o Flow.
2. Na primeira criação de vídeo, o CTA recomendado é **Importar imagem-base**. “Gerar uma imagem nova” aponta para a receita existente e aparece como alternativa.
3. Acrescentar `asset-input` a `LabNodeKind` e ao registry. Sua execução retorna `{ assetId, url, type }` do Asset persistido e validado; saída tipada impede áudio em `Animar imagem`.
4. Criar controle com preview, nome/origem, **Trocar asset** e seletor do acervo do Projeto. O caminho normal não pede `image_url`; URL fica em “Avançado” temporário para flows legados.
5. Alterar receita de vídeo: se Projeto tem imagem-base selecionada, criar/atualizar `Imagem-base → Animar imagem → Saída`; se ainda não houver fonte, mostrar pendência e não inventar imagem.
6. Adicionar no cabeçalho do Flow link contextual ao Projeto e seus Assets; reidratar nome/Project ID no payload do Flow, não inferir pelo título.
7. Validar conexões compatíveis antes de adicioná-las no `onConnect`, com mensagem imediata. Backend continua autoridade, mas UI não pode deixar erro aparecer só no save.
8. Criar paleta contextual:
   - **Criar:** Briefing, Prompt, Gerar imagem, Animar imagem.
   - **Projeto:** Importar/selecionar asset, Referência visual.
   - **Pós-produção:** Continuar clipe, Juntar clipes.
   - **Direção:** reservado para Production Director até o Bloco 4.

**Aceite DOM/dados:**
- PNG importado aparece como `Imagem-base` no projeto e pode ser escolhido no canvas;
- salvar/recarregar preserva `assetId`, preview e conexão ao vídeo;
- receita com Asset importado resolve URL do Asset sem executar `image-generation`;
- referência visual não vira primeiro frame sem seleção explícita;
- UI mantém custo estimado/real e não enfileira ao importar/aplicar receita.

## Bloco 3 — Tornar o vídeo compreensível e reduzir caminhos errados

**Objetivo:** reposicionar nós existentes segundo o processo real de produção.

**Arquivos:**
- Modificar: `lib/flows/video-nodes.ts`
- Modificar: `components/nodes/lab-flow-node.tsx`
- Modificar: `app/(studio)/fluxos/flow-canvas.tsx`
- Modificar: `lib/flows/templates.ts`
- Modificar: `tests/flows/video-nodes.test.ts`
- Modificar: `tests/flows/flow-canvas-video-rehydration.test.tsx`

**Comportamento final:**
1. **Animar imagem:** primeira ação de vídeo. Recebe imagem-base importada ou geração de imagem; pede movimento/câmera/ritmo e gera um clipe.
2. **Continuar clipe:** ação avançada após clipe concluído; mostra que usa último frame do clipe anterior para gerar próximo trecho. Mantém prompt de continuação e contexto de cena. Não promete estender MP4 importado enquanto `resolveUpstreamVideoUrl` exigir `generationId`.
3. **Juntar clipes:** aparece depois de dois ou mais clipes; comunica ordem esquerda→direita, exporta MP4 e pode receber trilha/voz. O resultado fecha roteiro; não é nova geração.
4. Piloto TikTok Shop: `imagem-base importada → Animar imagem → Revisar/Escolher → (opcional: Continuar clipe) → Juntar clipes`. O nó de revisão custa R$0 e bloqueia vídeo caro antes da fonte estar certa.
5. Criar template explícito **Produto importado → Vídeo curto**. Não contém Gerar Imagem e mostra pendência de selecionar imagem-base.
6. Corrigir proveniência de `Juntar clipes`: o Asset MP4 local hoje não recebe `projectId`; derivar o Projeto por `FlowRun → Flow` e associá-lo ao acervo correto.

**Aceite:** nomes públicos mudam sem quebrar types/flows persistidos; receita não enfileira imagem; MP4 final aparece no Projeto correto; conexão inválida recebe feedback antes de salvar; explicação de cada nó aparece no DOM.

## Bloco 4 — AI Production Director ligado ao OAuth ChatGPT de forma honesta

**Objetivo:** substituir “LLM Assistant” genérico por agente de produção que transforma Projeto real em proposta revisável.

**Pré-requisito bloqueante:** antes da UI, ampliar e provar capacidade de texto no contrato do executor (`lib/provider-connections/*`) usando somente operação oficial disponível no Codex App Server. Se a capacidade de texto não puder ser provada pela conexão ChatGPT atual, seletor mostra `Indisponível` e não simula resposta. Não usar endpoint privado de chatgpt.com, token copiado ou API paga implícita.

**Arquivos previstos após a prova:**
- Criar: `lib/director/types.ts` — contrato da proposta: intenção, assets usados, shotlist, nós/arestas permitidos, prompts, justificativa de modelo e custo estimado.
- Criar: `lib/director/validate-proposal.ts` — allowlist de tipos/params e vínculo obrigatório a Assets do Projeto.
- Criar: `lib/director/service.ts` — contexto mínimo do Projeto e execução pelo adaptador aprovado.
- Criar: `app/api/projects/[projectId]/director/route.ts` — gerar somente proposta; proteger scope, tamanho de briefing e conexão.
- Criar: `components/projects/production-director.tsx`
- Modificar: `components/projects/project-workspace.tsx`
- Modificar: `app/(studio)/fluxos/flow-canvas.tsx` — “Aplicar ao Flow” salva rascunho, nunca executa.
- Criar: `tests/director/validate-proposal.test.ts`
- Criar: `tests/api/project-director-route.test.ts`
- Criar: `tests/components/production-director.test.tsx`

**Fluxo do usuário:**
1. No Projeto, anexar imagem do produto/criativo e escrever “vídeo de TikTok Shop, 9:16, foco em demonstrar X”.
2. O Director recebe objetivo, formato, duração, Asset IDs/URLs autorizados e referências selecionadas; devolve 1–3 cenas, prompt de movimento por cena, modelo recomendado, estimativa por nó e riscos (texto legível, preço/alegações, continuidade).
3. UI mostra proposta como **rascunho**, permite rejeitar/editar e só então oferece **Aplicar ao Flow**.
4. Aplicar cria/atualiza nós e conexões; usuário ainda revisa e confirma custo no modal existente para gerar.

**Testes e limites:**
- proposta com Asset de outro workspace é recusada;
- proposta com nó não permitido/URL externa não passa no validator;
- aplicar proposta não cria `FlowRun`, `Generation` ou job;
- só uma chamada de texto autorizada por clique, com idempotência e estado claro;
- custo de API, se houver, separado de consumo de assinatura; ausência de preço nunca é “R$0/grátis”.

## Bloco 5 — Validação progressiva sem surpresa de custo

1. Rodar testes focados de upload/ownership, nó de Asset, receita/template e Director; depois `npm run lint`, `npm run typecheck`, `npm run build` e Vitest completo.
2. Com banco/Storage de staging e sem worker, provar `upload → Asset do Projeto → preview → salvar/recarregar` por DOM, rotas, banco e Storage; limpar objeto/registro de teste.
3. Somente com autorização explícita e custo declarado: traçador de vídeo `imagem-base importada real → um Animar imagem barato`. Confirmar Asset, custo real e reabertura do Projeto.
4. Em autorização posterior, testar `Continuar clipe` e, separadamente, `Juntar clipes` com dois clipes. Não confundir concatenação local com geração.
5. Registrar aprendizado/custo real em `modulos/02-videos/TECNICAS.md` e atualizar `docs/RETOMADA.md` ao concluir bloco.

## Limites e riscos

- Nenhum segredo, `.env*`, token OAuth ou diretório de credencial do executor será alterado.
- O primeiro desenho usa colunas existentes de `Asset` e `Project`; migration só entra com necessidade aprovada.
- Nenhum worker, geração fal.ai ou uso de assinatura será disparado durante teste de UI/contrato.
- Não haverá cópia de layout, textos ou comandos proprietários de Higgsfield.
- MVP resolve imagem-base importada. Referências múltiplas só entram no provider quando catálogo/validação declararem suporte; não fingir suporte genérico.
- Vídeo importado entra primeiro como Asset/proveniência. Estender MP4 importado requer evoluir contrato atual de `video-extend`, que exige Generation upstream.
- Login ChatGPT existente não prova acesso a texto/agente; capacidade precisa ser validada antes do Director.

## Critério de sucesso do primeiro corte

Felipe cria “TikTok Shop — Produto X”, arrasta uma imagem real, marca como imagem-base, vê no Projeto e canvas, descreve movimento, recebe custo antes de rodar e consegue gerar vídeo sem o LabIA criar imagem original. Ele entende que “Continuar clipe” alonga uma cena e “Juntar clipes” fecha um vídeo com várias cenas. O Director, quando conexão textual estiver comprovada, transforma o material em proposta revisável antes de qualquer gasto.
