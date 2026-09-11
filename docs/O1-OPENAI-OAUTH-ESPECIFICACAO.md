# O1 — Conexão OpenAI/ChatGPT por Codex App Server

**Status:** aprovado para implementação em 2026-09-11  
**Escopo autorizado:** conexão e testes sem geração  
**Fonte:** decisão explícita de Felipe em 2026-09-11 + `docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md`

## 1. Objetivo

Permitir que o LabIA local conecte uma conta ChatGPT por OAuth gerenciado pelo **Codex App Server**, sem transformar a sessão em chave da API pública OpenAI, sem reutilizar a sessão atual do Codex e sem iniciar qualquer geração.

O1 termina quando o componente local estiver pronto para Felipe iniciar o login. Login real, disponibilidade de imagem e geração real são provas diferentes.

## 2. Decisão de produto que governa O1

O LabIA **não possui provider principal**. Cada nó gerativo escolhe, de forma explícita:

`Provider → Conexão → Modelo`

A fal.ai continua disponível normalmente. A existência de uma conexão OpenAI não altera nós existentes, não troca provider silenciosamente e não cria fallback automático para API paga.

## 3. Contrato `ProviderConnection`

Uma conexão persiste apenas metadados e uma referência opaca à sessão. Credenciais/tokens não entram no Postgres.

Campos mínimos:

- `id`;
- `workspaceId`;
- `ownerKey` — identidade local configurada enquanto não existe membership multiusuário;
- `provider`;
- `authMethod`;
- `credentialRef` — referência opaca, nunca token ou conteúdo de `auth.json`;
- `connectionState`;
- `executorState`;
- `capabilityState` e `capabilities` separados do login;
- timestamps de conexão, expiração, desconexão e última verificação;
- código de erro sanitizado, sem segredo.

### Estado da conta

`DISCONNECTED → CONNECTING → CONNECTED`

Também existem `EXPIRED` e `ERROR`. Cancelar login volta para `DISCONNECTED`. Logout explícito limpa a sessão gerida pelo App Server e marca `DISCONNECTED`.

### Estado do executor

`STOPPED → STARTING → READY`, com `ERROR` quando o processo local não inicia ou perde o protocolo.

### Estado de capacidades

`UNVERIFIED | VERIFIED | UNAVAILABLE | ERROR`.

Em O1, **login bem-sucedido não promove imagem para VERIFIED**. Sem prova específica, a UI deve continuar mostrando `Não verificada`.

## 4. Codex App Server

O LabIA usa `codex app-server` por **stdio** e JSON-RPC. O cliente deve:

1. iniciar o processo sem `shell`;
2. definir um `CODEX_HOME` dedicado ao LabIA;
3. enviar `initialize` e depois `initialized`;
4. usar `account/read` para consultar conta;
5. iniciar login via `account/login/start` com `type: "chatgpt"` ou `type: "chatgptDeviceCode"`;
6. acompanhar `account/login/completed` apenas para o `loginId` correspondente;
7. cancelar por `account/login/cancel`;
8. desconectar por `account/logout`;
9. encerrar/recriar o processo para reconexão quando necessário;
10. tratar timeout, EOF, JSON inválido e erro JSON-RPC sem expor stderr bruto ao cliente.

Para `chatgpt`, a resposta expõe `authUrl` e `loginId`. Para `chatgptDeviceCode`, expõe `verificationUrl`, `userCode` e `loginId`.

## 5. Isolamento de credenciais

- O LabIA **nunca lê nem copia** `~/.codex`, a sessão atual do Codex ou outro `CODEX_HOME` herdado.
- Cada `ProviderConnection` recebe diretório próprio dentro de `LABIA_PROVIDER_DATA_DIR`.
- O processo filho recebe `CODEX_HOME` sobrescrito para esse diretório.
- Variáveis de chave OpenAI herdadas (`OPENAI_API_KEY` e equivalentes conhecidas) são removidas do ambiente do processo filho para O1.
- O App Server é o dono do login, refresh e logout da sessão ChatGPT.
- `credentialRef` é apenas um identificador opaco que permite reencontrar o diretório dedicado; o conteúdo da sessão não sai desse diretório.

## 6. Proteção local

As rotas O1 são locais e ficam desabilitadas por padrão.

Para aceitar acesso, todas as condições devem valer:

- `LABIA_LOCAL_OPENAI_OAUTH_ENABLED=true`;
- request para host loopback (`localhost`, `127.0.0.1` ou `[::1]`);
- `Origin`, quando presente, também precisa ser loopback.

Produção/Vercel não deve iniciar `codex app-server`. Erros retornados ao browser usam códigos e mensagens sanitizadas.

## 7. Interface LabIA

Criar `/conexoes`, seguindo `docs/DESIGN-SYSTEM.md`, com uma área OpenAI/ChatGPT que exiba separadamente:

1. **Conta ChatGPT** — desconectada, conectando, conectada, expirada ou erro;
2. **Capacidade de imagem** — não verificada/verificada/indisponível/erro;
3. **Geração real** — `Não validada` em O1.

A UI permite iniciar login, acompanhar, cancelar, desconectar e reconectar. Para device code, mostra link e código como valores separados. Segredos nunca são renderizados.

## 8. Independência da fila de geração

O1 não importa nem inicia `scripts/worker.ts`, `scripts/image-worker.ts`, pg-boss de geração, `Generation` ou `FlowRun`.

Iniciar login não enfileira job, não consulta filas para consumi-las e não executa o fluxo existente. O fluxo “Teste manual — Imagem → Vídeo” deve permanecer intocado.

## 9. Fora de escopo

- geração real de imagem, vídeo, áudio ou texto;
- verificação real da capacidade de imagem da conta;
- consumo de cota/assinatura;
- OpenAI API paga ou fallback automático para ela;
- Seedance direto;
- Google;
- MCP;
- publicação;
- refatoração completa dos nós atuais para executar por conexão — isso vem depois de O1;
- correção do retry pós-submit — permanece débito independente e bloqueador antes de geração por nova conexão.

## 10. Critérios de aceite O1

- [ ] migration/model `ProviderConnection` com workspace/dono, referência opaca, estados de conta/executor/capacidade;
- [ ] cliente App Server por stdio com processo injetável em teste;
- [ ] `CODEX_HOME` dedicado e ambiente sanitizado;
- [ ] iniciar/acompanhar/cancelar/expirar/desconectar/reconectar sem geração;
- [ ] rotas locais protegidas e sem segredos nas respostas;
- [ ] `/conexoes` seguindo o design system e separando as três provas;
- [ ] testes com processo falso cobrem protocolo, cancelamento, logout, timeout/erro e isolamento;
- [ ] validação DOM cobre os três estados visíveis e controles principais;
- [ ] nenhum worker de geração é iniciado nos testes O1;
- [ ] `RETOMADA.md` e status dos módulos afetados atualizados;
- [ ] login real ainda marcado como não executado até Felipe interagir.
