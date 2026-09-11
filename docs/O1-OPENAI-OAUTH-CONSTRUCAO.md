# O1 — Plano de construção da conexão OpenAI/ChatGPT

**Status:** aprovado para O1 em 2026-09-11  
**Spec:** `docs/O1-OPENAI-OAUTH-ESPECIFICACAO.md`

## Resultado da etapa

Entregar o caminho de conexão local até o ponto em que Felipe precisa interagir com o login ChatGPT. Não executar geração e não iniciar worker de geração.

## Tarefas

### O1.1 — contrato e decisão arquitetural

- registrar ADR “provider por nó”;
- remover dos documentos ativos a ideia de fal.ai como provider principal;
- atualizar Imagens/Fluxos para `Provider → Conexão → Modelo`;
- manter fal.ai existente sem regressão.

### O1.2 — persistência

- adicionar `ProviderConnection` ao Prisma;
- vínculo obrigatório com `Workspace` e `ownerKey` local;
- armazenar apenas `credentialRef` opaco;
- separar `connectionState`, `executorState` e `capabilityState`;
- migration aditiva, sem tocar flows/generations/assets/jobs existentes.

### O1.3 — App Server por stdio

Criar `lib/providers/openai-codex/` com:

- tipos de protocolo mínimos usados por O1;
- processo injetável para permitir fake process;
- cliente JSON-RPC newline-delimited;
- initialize/initialized;
- account/read;
- login browser e device-code;
- wait por `account/login/completed` filtrado por `loginId`;
- cancel login;
- logout;
- encerramento e tratamento de EOF/timeout/erro;
- sanitização de mensagens.

### O1.4 — sessão dedicada

- `LABIA_CODEX_BIN` seleciona o binário, default `codex`;
- `LABIA_PROVIDER_DATA_DIR` seleciona a raiz dedicada, default em diretório do usuário fora de `~/.codex`;
- cada conexão recebe um subdiretório próprio;
- child env sobrescreve `CODEX_HOME` e remove chaves OpenAI herdadas;
- nunca copiar sessão atual do Codex.

### O1.5 — serviço de conexão

Criar serviço independente do runner/worker que:

- lista/cria conexão OpenAI local;
- sobe executor sob demanda;
- inicia login;
- consulta conta e reconcilia estado;
- cancela tentativa pendente;
- expira tentativa por timeout;
- desconecta via logout;
- reconecta usando a sessão dedicada quando ainda válida;
- mantém capacidade de imagem `UNVERIFIED` em O1.

### O1.6 — API local

Rotas:

- `GET/POST /api/provider-connections`;
- `GET /api/provider-connections/:id`;
- `POST /api/provider-connections/:id/actions` com ações `login`, `status`, `cancel`, `disconnect`, `reconnect`.

Todas passam por gate local explícito antes de acessar banco ou iniciar processo.

### O1.7 — UI

Adicionar `Conexões` na navegação e página `/conexoes`.

Card OpenAI/ChatGPT com:

- estado da conta;
- estado do executor;
- capacidade de imagem separada;
- geração real fixa como não validada;
- botões conforme estado;
- painel de browser/device code sem token;
- mensagens de erro sanitizadas.

### O1.8 — testes sem geração

Adicionar testes Vitest para:

- fake process: initialize/initialized e correlação por request id;
- login browser/device-code;
- notificação de conclusão só para login correto;
- cancel/logout;
- timeout, EOF e resposta de erro;
- `CODEX_HOME` dedicado e remoção de API keys herdadas;
- gate local;
- DOM/SSR da interface: Conta / Capacidade de imagem / Geração real e controles;
- prova estática de que módulos O1 não importam queue/worker/generation job.

Nenhum teste confirma login real e nenhum teste gera mídia.

### O1.9 — validação

Rodar em CI sem segredos:

- `npm ci`;
- `npm run typecheck`;
- `npm run lint`;
- `npx vitest run`;
- `npm run build` com URLs Prisma fictícias apenas para geração de client/build, sem conexão ao banco.

A execução local real do App Server fica pendente porque exige binário/ambiente do Felipe e, no passo de login, interação humana.

## Status

- [x] Contrato aprovado por Felipe para início de O1.
- [ ] O1.1 contrato/ADR aplicado.
- [ ] O1.2 persistência implementada.
- [ ] O1.3 cliente App Server implementado.
- [ ] O1.4 isolamento implementado.
- [ ] O1.5 serviço implementado.
- [ ] O1.6 API local implementada.
- [ ] O1.7 UI implementada.
- [ ] O1.8 testes adicionados.
- [ ] O1.9 CI executada.
- [ ] Login real executado por Felipe.
- [ ] Capacidade real de imagem verificada.
- [ ] Geração real validada.
