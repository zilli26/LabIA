# O1 — Conexão OpenAI/ChatGPT local

**Estado do contrato:** aprovado em 2026-09-11  
**Estado da implementação:** código em `feat/o1-openai-chatgpt-connection`; login real ainda não executado  
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

A UI deve mostrar separadamente:

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

## Proteção de acesso

A superfície de conexão do Next só aceita:

- `LABIA_LOCAL_CONNECTIONS_ENABLED=true`;
- host `localhost`, `127.0.0.1` ou `::1`;
- owner local explícito em `LABIA_LOCAL_OWNER_ID`.

A ponte Next → executor exige:

- URL HTTP de loopback;
- bearer token dedicado com pelo menos 32 caracteres.

O executor nunca devolve credenciais OAuth ao browser. Mensagens de erro passam por sanitização.

## Ciclo de vida

- **iniciar:** cria/reusa ProviderConnection, inicia login no App Server;
- **acompanhar:** `/status` consulta o App Server e persiste somente estado/metadados não secretos;
- **cancelar:** cancela tentativa em andamento;
- **expirar:** TTL local cancela tentativa e marca `expired`;
- **desconectar:** chama logout no App Server e encerra sessão local;
- **reconectar:** inicia uma nova tentativa na mesma ProviderConnection.

## Independência do worker

O executor de autenticação não importa o runner nem as filas. O script O1 não chama `registerFlowNodeWorker`, `startImageGenerationWorker` ou `startVideoGenerationWorker`.

Para concluir o login O1, **não execute `npm run worker`**.

## Testes de O1

Automatizados, sem credencial e sem geração:

- processo falso do Codex App Server;
- handshake `initialize`/`initialized`;
- device code;
- `account/login/completed`;
- expiração + cancel;
- garantia de que o processo filho não recebe chaves de API comuns;
- gate de loopback;
- redaction de erros;
- DOM: conta conectada continua com imagem `Não verificada` e geração `Não validada`.

## Passo manual — somente depois de código/migration local

1. configurar env local O1;
2. aplicar migration;
3. iniciar `npm run dev`;
4. iniciar `npm run provider:executor` em outro terminal;
5. manter `npm run worker` desligado;
6. abrir `http://localhost:3000/conexoes`;
7. criar `ChatGPT pessoal`;
8. clicar `Conectar ChatGPT`;
9. abrir a URL indicada, informar o código e concluir o login;
10. voltar ao LabIA e aguardar `Conta ChatGPT: Conectada`.

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
