# OpenAI OAuth e providers por nó — construção

Data: 2026-09-11. **Status atualizado em 2026-09-13: O1 validado localmente; O2 preservado; O3 implementado contra o protocolo oficial do App Server 0.154.0 com fixtures, sem geração real.** A geração permanece não validada até uma imagem real autorizada; não houve novo login, worker, migration ou consumo de cota nesta sessão.

## O1 — Primeira entrega: conectar a conta no LabIA local

1. Adicionar ProviderConnection com referência segura à sessão, dono/workspace, estado do executor e capacidades separadas. Preparar migration aditiva, validar em banco de teste e revisar compatibilidade antes de aplicá-la ao banco em uso.
2. Criar cliente stdio do Codex App Server: inicialização, IDs de chamadas, notificações, timeouts, encerramento e erros sem segredos. Fixar a versão validada. Executar com configuração e credenciais dedicadas fora do repo.
3. Criar processo de conexões independente do worker pg-boss. Ligar o login não pode consumir `flow-node-execution`, `image.generate` ou `video.generate`.
4. Implementar iniciar/status/cancelar/desconectar com autorização de operador local. Restringir listener a loopback, validar Host/Origin e exigir sessão/token de pareamento; loopback sozinho não é autenticação. Respostas de login não são cacheadas. Em ambiente publicado, essas rotas permanecem desabilitadas até O5.
5. Adicionar controles de conexão no canvas e painel de gerenciamento no design do LabIA. Exibir executor offline, login pendente, conectado, sessão expirada e imagem ainda não validada. Não apresentar botão de execução como disponível por causa do login.
6. Testar protocolo com processo falso e payloads sanitizados: conclusão antiga, cancelamento, timeout, processo morto, logout/relogin e acesso negado. Validar a UI por DOM, sem enfileirar gerações.
7. Entregar a tela de login para Felipe autenticar. Confirmar conta/conexão por leitura autenticada; registrar resultado sem credenciais. Esta é a primeira prova externa, ainda sem geração.

**Pronto O1:** Felipe conecta e desconecta sua conta pelo LabIA local; ProviderConnection mostra estado verdadeiro; nenhum job de geração é consumido. O1 não significa imagem OAuth nem conexão publicada prontas.

## O2 — Provider escolhido por nó e execução confiável

**Status:** registry por Provider/Conexão, seleção por nó em `/criar` e no canvas, compatibilidade explícita fal.ai, coordenador de operação, confirmação server-side, ownership, Asset idempotente e testes concorrentes/falsos implementados. A migration aditiva de guardas de execução foi criada em `prisma/migrations/20260912000000_add_execution_guards`, mas não foi aplicada.

1. Evoluir `lib/providers/model-provider.ts` com acompanhamento e capacidades; criar registry/resolver por conexão, sem default global.
2. Adaptar `lib/flows/image-nodes.ts`, `lib/flows/video-nodes.ts`, catálogos e controles em `components/nodes/lab-flow-node.tsx` para Provider/Conexão/Modelo. Preservar modelos fal.ai e parâmetros antigos via compatibilidade explícita.
3. Unificar a lógica comum de `image-generation-job.ts` e `video-generation-job.ts`: snapshot, chave única, claim atômico, envio/acompanhamento, estado ambíguo e persistência idempotente. Remover dependência direta de FalProvider dos jobs e nós.
4. Normalizar output em Asset e fazer runner aguardar conclusão efetiva da Generation. Corrigir agregação final de custos e erro downstream.
5. Separar API/assinatura/local no custo serializado, nó, confirmação e histórico. Exigir confirmação no servidor vinculada à execução, seleção e estimativa atuais; não confiar apenas no modal.
6. Validar seleção/isolamento, compatibilidade fal, concorrência e falhas após submit/storage com providers falsos e banco isolado. Nenhum teste automatizado deve usar credenciais de geração reais.

## O3 — Imagem OpenAI e retry seletivo

**Status:** implementado contra o protocolo oficial do App Server 0.154.0. O executor usa `thread/start` e `turn/start`, acompanha `item/completed` com `item.type = imageGeneration`, recupera por `thread/read` e `thread/items/list`, e normaliza somente PNG/Base64 validado. A conexão permanece `generationValidationStatus = unvalidated` até uma imagem real autorizada.

**Menor adendo técnico proposto:** homologar no App Server uma operação versionada de imagem (parâmetros, idempotência, acompanhamento e resultado recuperável com URL/bytes/MIME/dimensões) ou fornecer um adaptador oficial equivalente. Só então implementar o adapter e o retry OpenAI.

1. Verificar recursos de imagem da versão fixada do App Server sem consumir cota; documentar modelo/ferramenta e o contrato de resultado recuperável. Não inferir capacidade da conta a partir de schema.
2. Implementar adaptador somente após estabelecer esse contrato. Se faltar uma rota implementável, registrar o impedimento e propor adendo técnico; não usar endpoint inventado nem importar tokens da sessão Codex do usuário.
3. Implementar retry no runner/API/UI usando Generation e Assets anteriores. Acrescentar testes de nó intermediário falho, ramos independentes, retry concorrente e submit ambíguo.
4. Rodar `npx --no-install vitest run`, typecheck, lint, build e `git diff --check`. Validar DOM sem executar fluxo. Quando houver teste de banco, usar banco isolado e conferir os registros gerados.
5. Preparar uma única imagem OAuth de teste, declarar uso de cota e eventual custo conhecido; aguardar autorização específica antes de consumir cota. Conferir Asset, resultado visível e ausência de nova cobrança por retry técnico.

## O4 — Flow misto e novos adaptadores

Após imagem OAuth validada, reutilizar seu Asset em vídeo por fal.ai; Seedance via fal.ai continua sendo modelo desse provider. Cada geração de vídeo requer orçamento atualizado em R$ e aprovação específica.

Seedance direto e Google exigem identificar seus serviços de acesso e capacidades antes de adicionar conexões operacionais. O objetivo posterior é `OpenAI OAuth Image → Seedance Video`; não registrar essa prova como feita usando mocks ou só um login.

## O5 — Interface publicada usando executor local

Detalhar e revisar a sessão do dono, autorização por workspace e pareamento de executor antes de implementar o transporte remoto. Cobrir todas as entradas que poderiam ler dados ou consumir a conexão, inclusive os endpoints preexistentes de salvar/executar flows e ler Generations/Assets. Rejeitar IDs de outro dono/workspace.

Implantar transporte autenticado de saída do executor com expiração, correlação e cancelamento dos comandos de login. Falta de executor bloqueia execução sem fallback pago. Validar acesso negado e reconexão em staging antes de liberar na Vercel. A implementação e publicação dessa etapa dependem do contrato complementar, não são implicitamente concluídas por O1.

## Registro ao encerrar cada entrega

Atualizar RETOMADA, status dos módulos afetados e decisões com evidências. Distinguir código testado, login real, capacidade de imagem real e produção publicada. Não iniciar worker com fila real só para testar login. Não repetir as verificações de infraestrutura informadas por Felipe como se tivessem sido refeitas nesta sessão.
