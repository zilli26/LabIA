# OpenAI OAuth e providers por nÃ³ â€” construÃ§Ã£o

Data: 2026-09-12. **Status: aprovado pelo Felipe em 2026-09-12; implementacao O1 iniciada.**

## O1 â€” Primeira entrega: conectar a conta no LabIA local

1. Adicionar ProviderConnection com referÃªncia segura Ã  sessÃ£o, dono/workspace, estado do executor e capacidades separadas. Preparar migration aditiva, validar em banco de teste e revisar compatibilidade antes de aplicÃ¡-la ao banco em uso.
2. Criar cliente stdio do Codex App Server: inicializaÃ§Ã£o, IDs de chamadas, notificaÃ§Ãµes, timeouts, encerramento e erros sem segredos. Fixar a versÃ£o validada. Executar com configuraÃ§Ã£o e credenciais dedicadas fora do repo.
3. Criar processo de conexÃµes independente do worker pg-boss. Ligar o login nÃ£o pode consumir `flow-node-execution`, `image.generate` ou `video.generate`.
4. Implementar iniciar/status/cancelar/desconectar com autorizaÃ§Ã£o de operador local. Restringir listener a loopback, validar Host/Origin e exigir sessÃ£o/token de pareamento; loopback sozinho nÃ£o Ã© autenticaÃ§Ã£o. Respostas de login nÃ£o sÃ£o cacheadas. Em ambiente publicado, essas rotas permanecem desabilitadas atÃ© O5.
5. Adicionar controles de conexÃ£o no canvas e painel de gerenciamento no design do LabIA. Exibir executor offline, login pendente, conectado, sessÃ£o expirada e imagem ainda nÃ£o validada. NÃ£o apresentar botÃ£o de execuÃ§Ã£o como disponÃ­vel por causa do login.
6. Testar protocolo com processo falso e payloads sanitizados: conclusÃ£o antiga, cancelamento, timeout, processo morto, logout/relogin e acesso negado. Validar a UI por DOM, sem enfileirar geraÃ§Ãµes.
7. Entregar a tela de login para Felipe autenticar. Confirmar conta/conexÃ£o por leitura autenticada; registrar resultado sem credenciais. Esta Ã© a primeira prova externa, ainda sem geraÃ§Ã£o.

**Pronto O1:** Felipe conecta e desconecta sua conta pelo LabIA local; ProviderConnection mostra estado verdadeiro; nenhum job de geraÃ§Ã£o Ã© consumido. O1 nÃ£o significa imagem OAuth nem conexÃ£o publicada prontas.

## O2 â€” Provider escolhido por nÃ³ e execuÃ§Ã£o confiÃ¡vel

1. Evoluir `lib/providers/model-provider.ts` com acompanhamento e capacidades; criar registry/resolver por conexÃ£o, sem default global.
2. Adaptar `lib/flows/image-nodes.ts`, `lib/flows/video-nodes.ts`, catÃ¡logos e controles em `components/nodes/lab-flow-node.tsx` para Provider/ConexÃ£o/Modelo. Preservar modelos fal.ai e parÃ¢metros antigos via compatibilidade explÃ­cita.
3. Unificar a lÃ³gica comum de `image-generation-job.ts` e `video-generation-job.ts`: snapshot, chave Ãºnica, claim atÃ´mico, envio/acompanhamento, estado ambÃ­guo e persistÃªncia idempotente. Remover dependÃªncia direta de FalProvider dos jobs e nÃ³s.
4. Normalizar output em Asset e fazer runner aguardar conclusÃ£o efetiva da Generation. Corrigir agregaÃ§Ã£o final de custos e erro downstream.
5. Separar API/assinatura/local no custo serializado, nÃ³, confirmaÃ§Ã£o e histÃ³rico. Exigir confirmaÃ§Ã£o no servidor vinculada Ã  execuÃ§Ã£o, seleÃ§Ã£o e estimativa atuais; nÃ£o confiar apenas no modal.
6. Validar seleÃ§Ã£o/isolamento, compatibilidade fal, concorrÃªncia e falhas apÃ³s submit/storage com providers falsos e banco isolado. Nenhum teste automatizado deve usar credenciais de geraÃ§Ã£o reais.

## O3 â€” Imagem OpenAI e retry seletivo

1. Verificar recursos de imagem da versÃ£o fixada do App Server sem consumir cota; documentar modelo/ferramenta e o contrato de resultado recuperÃ¡vel. NÃ£o inferir capacidade da conta a partir de schema.
2. Implementar adaptador somente apÃ³s estabelecer esse contrato. Se faltar uma rota implementÃ¡vel, registrar o impedimento e propor adendo tÃ©cnico; nÃ£o usar endpoint inventado nem importar tokens da sessÃ£o Codex do usuÃ¡rio.
3. Implementar retry no runner/API/UI usando Generation e Assets anteriores. Acrescentar testes de nÃ³ intermediÃ¡rio falho, ramos independentes, retry concorrente e submit ambÃ­guo.
4. Rodar `npx --no-install vitest run`, typecheck, lint, build e `git diff --check`. Validar DOM sem executar fluxo. Quando houver teste de banco, usar banco isolado e conferir os registros gerados.
5. Preparar uma Ãºnica imagem OAuth de teste, declarar uso de cota e eventual custo conhecido; aguardar autorizaÃ§Ã£o especÃ­fica antes de consumir cota. Conferir Asset, resultado visÃ­vel e ausÃªncia de nova cobranÃ§a por retry tÃ©cnico.

## O4 â€” Flow misto e novos adaptadores

ApÃ³s imagem OAuth validada, reutilizar seu Asset em vÃ­deo por fal.ai; Seedance via fal.ai continua sendo modelo desse provider. Cada geraÃ§Ã£o de vÃ­deo requer orÃ§amento atualizado em R$ e aprovaÃ§Ã£o especÃ­fica.

Seedance direto e Google exigem identificar seus serviÃ§os de acesso e capacidades antes de adicionar conexÃµes operacionais. O objetivo posterior Ã© `OpenAI OAuth Image â†’ Seedance Video`; nÃ£o registrar essa prova como feita usando mocks ou sÃ³ um login.

## O5 â€” Interface publicada usando executor local

Detalhar e revisar a sessÃ£o do dono, autorizaÃ§Ã£o por workspace e pareamento de executor antes de implementar o transporte remoto. Cobrir todas as entradas que poderiam ler dados ou consumir a conexÃ£o, inclusive os endpoints preexistentes de salvar/executar flows e ler Generations/Assets. Rejeitar IDs de outro dono/workspace.

Implantar transporte autenticado de saÃ­da do executor com expiraÃ§Ã£o, correlaÃ§Ã£o e cancelamento dos comandos de login. Falta de executor bloqueia execuÃ§Ã£o sem fallback pago. Validar acesso negado e reconexÃ£o em staging antes de liberar na Vercel. A implementaÃ§Ã£o e publicaÃ§Ã£o dessa etapa dependem do contrato complementar, nÃ£o sÃ£o implicitamente concluÃ­das por O1.

## Registro ao encerrar cada entrega

Atualizar RETOMADA, status dos mÃ³dulos afetados e decisÃµes com evidÃªncias. Distinguir cÃ³digo testado, login real, capacidade de imagem real e produÃ§Ã£o publicada. NÃ£o iniciar worker com fila real sÃ³ para testar login. NÃ£o repetir as verificaÃ§Ãµes de infraestrutura informadas por Felipe como se tivessem sido refeitas nesta sessÃ£o.
