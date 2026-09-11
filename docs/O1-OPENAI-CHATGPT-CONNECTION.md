# O1 — Conexão OpenAI/ChatGPT local

**Estado do contrato:** aprovado em 2026-09-11  
**Estado da implementação:** código em `feat/o1-openai-chatgpt-connection`; correções da revisão de segurança incorporadas; login real ainda não executado  
**Geração real:** proibida nesta etapa

## Objetivo

Chegar ao ponto em que Felipe possa abrir o LabIA local, iniciar o login de sua conta ChatGPT e concluir a autenticação por interação humana, sem ligar worker de geração, sem criar geração e sem consumir cota/API.

O1 não prova imagem e não autoriza qualquer geração.

## Contrato aprovado

### Entidades

`ProviderConnection`
- `workspaceId`;
- `ownerId`;
- `provider`;
- `authMethod`;
- `sessionRef` opaco;
- `authStatus`;
- `executorStatus`;
- metadados não secretos da conta;
- `generationValidationStatus` separado.

`ProviderCapability`
- pertence a uma conexão;
- chave de capacidade;
- estado `unverified | available | unavailable | error`;
- evidência e data de verificação opcionais.

### Estados independentes

A UI mostra separadamente:

- conta ChatGPT: conectada/desconectada/conectando/expirada/erro;
- capacidade de imagem: não verificada até experimento próprio;
- geração real: não validada até geração autorizada.

Login não muda automaticamente os dois últimos estados.

## Executor local

`npm run provider:executor` inicia um processo HTTP apenas em `127.0.0.1`. Esse processo mantém um `CodexAppServerClient` por `sessionRef` e inicia `codex app-server` via stdio.

Handshake:

1. `initialize`;
2. notificação `initialized`;
3. `account/read` ou `account/login/start`;
4. acompanhar `account/login/completed` + `account/read`;
5. quando aplicável, `account/login/cancel` ou `account/logout`.

Métodos de login suportados em O1:

- `chatgptDeviceCode` — padrão da UI;
- `chatgpt` — opção de login no navegador.

## Credenciais dedicadas

Cada conexão recebe um `CODEX_HOME` próprio abaixo de `LABIA_CODEX_HOME_ROOT` (default `.labia/codex`). O executor cria um `config.toml` local com armazenamento de credenciais gerido pelo Codex App Server.

O filho Codex não herda chaves OpenAI comuns do processo pai. O LabIA não lê nem copia a sessão global do Codex que possa existir na máquina.

`.labia/` é ignorado pelo Git.

### Desconexão destrutiva da credencial local

`Desconectar` não depende apenas do estado em memória do Next:

1. tenta cancelar login pendente, se houver;
2. chama `account/logout` no App Server;
3. fecha o processo daquela sessão;
4. remove recursivamente o `CODEX_HOME` dedicado daquela `ProviderConnection`.

Se o executor estiver indisponível, a rota local do Next ainda remove o `CODEX_HOME` dedicado. Nesse caso o LabIA marca a conexão como desconectada, mas registra `remote_logout_unconfirmed`: a credencial local foi eliminada, porém a revogação remota não é declarada como confirmada.

## Proteção de acesso local

A superfície `/api/provider-connections*` só aceita requisições quando todas as condições abaixo são verdadeiras:

- `LABIA_LOCAL_CONNECTIONS_ENABLED=true`;
- hostname da URL é loopback (`localhost`, `127.0.0.1` ou `::1`);
- header `Host` também é loopback e corresponde ao host da URL;
- `x-forwarded-host` está ausente — O1 não confia em proxy para converter origem remota em local;
- quando `Origin` existe, ele é exatamente o `origin` da própria aplicação local;
- quando `Sec-Fetch-Site` existe, é `same-origin` ou `none`;
- header `x-labia-local-token` corresponde, por comparação constante, a `LABIA_LOCAL_CONNECTIONS_TOKEN` configurado no servidor;
- owner local explícito existe em `LABIA_LOCAL_OWNER_ID`.

O token da superfície Next é separado do bearer token Next → executor (`LABIA_PROVIDER_EXECUTOR_TOKEN`). A tela `/conexoes` começa bloqueada e pede o token local; ele fica somente no estado em memória da página e não é gravado em storage do navegador.

A ponte Next → executor exige URL HTTP de loopback e bearer token dedicado com pelo menos 32 caracteres.

O executor nunca devolve credenciais OAuth ao browser. Mensagens de erro passam por sanitização.

## Isolamento workspace/dono

Listagens, leituras e ações por ID são resolvidas dentro do escopo `{ workspaceId, ownerId }` atual. Mutações usam os três campos (`id + workspaceId + ownerId`) no próprio `UPDATE`, não apenas numa verificação anterior.

Uma conexão pertencente a outro workspace/dono deve se comportar como inexistente para o escopo local atual.

## Proteção das tabelas no Supabase

A migration O1:

- habilita `ROW LEVEL SECURITY` em `provider_connections` e `provider_capabilities`;
- força RLS nas duas tabelas;
- revoga todos os privilégios de `PUBLIC`;
- revoga explicitamente privilégios de `anon`, `authenticated` e `service_role` quando esses papéis existem;
- não cria policy de acesso direto.

O contrato O1 é que essas tabelas são acessadas server-side pelo Prisma/role de banco autorizado, nunca diretamente pelo cliente Supabase.

A migration continua **não aplicada** enquanto o login real não for liberado.

## Ciclo de vida e tentativa atual

- **iniciar:** cria/reusa `ProviderConnection`, limpa o `loginId` anterior e inicia nova tentativa no App Server;
- **conta antiga em cache:** antes de uma nova tentativa, se `account/read` encontrar uma conta ChatGPT já persistida naquele `CODEX_HOME`, o executor executa logout e só então chama `account/login/start`;
- **acompanhar:** enquanto existe tentativa ativa, uma conta conectada em cache não basta. O estado só vira `connected` depois de `account/login/completed` do `loginId` atual e `account/read` refletir a conta;
- **reinício do executor:** se o banco diz `connecting`, mas o executor perdeu a tentativa atual, a consulta retorna `login_attempt_not_active`; não aceita uma conta antiga como conclusão;
- **cancelar:** cancela somente a tentativa em andamento;
- **expirar:** TTL local cancela tentativa e marca `expired`;
- **desconectar:** executa o fluxo destrutivo descrito acima;
- **reconectar:** inicia uma nova tentativa na mesma `ProviderConnection`.

## Independência do worker

O executor de autenticação não importa o runner nem as filas. O script O1 não chama `registerFlowNodeWorker`, `startImageGenerationWorker` ou `startVideoGenerationWorker`.

Para concluir o login O1, **não execute `npm run worker`**.

## Testes de O1

Automatizados, sem credencial real e sem geração:

- processo falso do Codex App Server;
- handshake `initialize`/`initialized`;
- device code;
- `account/login/completed` vinculado ao `loginId` atual;
- conta antiga em cache não satisfaz tentativa nova;
- reinício do executor não transforma cache antigo em conclusão;
- expiração + cancel;
- logout remove `CODEX_HOME` dedicado;
- garantia de que o processo filho não recebe chaves de API comuns;
- gate de Host/origin/`Sec-Fetch-Site` + token local;
- isolamento de query/update por workspace/dono;
- migration contém RLS/REVOKE para as tabelas sensíveis;
- redaction de erros;
- DOM: tela começa bloqueada por token local;
- DOM: conta conectada continua com imagem `Não verificada` e geração `Não validada`.

`vitest.config.ts` inclui tanto `tests/**/*.test.ts` quanto `tests/**/*.test.tsx`; os testes DOM fazem parte da suíte normal do CI.

### Validação automatizada confirmada

No commit `ab320ea27c28d87be50629789de02027932619be`, o GitHub Actions `O1 CI` concluiu com sucesso:

- `npx prisma validate`;
- `npm run lint`;
- `npm run typecheck`;
- `npx vitest run` — **16 arquivos, 131 testes verdes**, incluindo os 2 testes DOM `.test.tsx`;
- `npm run build` — build Next.js concluído e rota `/conexoes` incluída.

Isso é validação de código/simulação. Não é login real, não verifica imagem, não valida geração e não aplica a migration no Supabase.

## Passo manual — somente depois de revisão final da branch

1. gerar dois segredos locais diferentes, com pelo menos 32 caracteres: um para `LABIA_LOCAL_CONNECTIONS_TOKEN` e outro para `LABIA_PROVIDER_EXECUTOR_TOKEN`;
2. configurar também `LABIA_LOCAL_CONNECTIONS_ENABLED=true` e `LABIA_LOCAL_OWNER_ID` em `.env.local`;
3. aplicar a migration O1 no ambiente local autorizado;
4. iniciar `npm run dev`;
5. iniciar `npm run provider:executor` em outro terminal;
6. manter `npm run worker` desligado;
7. abrir `http://localhost:3000/conexoes`;
8. desbloquear a tela com `LABIA_LOCAL_CONNECTIONS_TOKEN`;
9. criar/reusar `ChatGPT pessoal`;
10. clicar `Conectar ChatGPT`;
11. abrir a URL indicada, informar o código e concluir o login;
12. voltar ao LabIA e aguardar `Conta ChatGPT: Conectada`.

O resultado esperado de O1 termina aqui. A mesma tela deve continuar mostrando:

- `Capacidade de imagem: Não verificada`;
- `Geração real: Não validada`.

## Fora de escopo

- qualquer prompt gerativo;
- verificação de imagem;
- consumo de cota ChatGPT;
- OpenAI API key;
- fallback pago;
- Google/Seedance/MCP/publicação;
- alteração do fluxo salvo “Teste manual — Imagem → Vídeo”.
