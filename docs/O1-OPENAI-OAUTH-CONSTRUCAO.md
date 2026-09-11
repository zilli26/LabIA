# O1 — Plano de construção da conexão OpenAI/ChatGPT

**Status:** implementação concluída até o ponto de interação humana de login em 2026-09-11  
**Spec:** `docs/O1-OPENAI-OAUTH-ESPECIFICACAO.md`  
**Branch:** `feat/o1-openai-oauth`  
**Validação sem geração:** GitHub Actions run `34616487976` — success

## Resultado da etapa

Entregar o caminho de conexão local até o ponto em que Felipe precisa interagir com o login ChatGPT. Não executar geração e não iniciar worker de geração.

Esse limite foi atingido em código e testes simulados. **Não confundir isso com login real, capacidade de imagem ou geração real:** os três continuam estados independentes.

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
- cliente JSON-RPC newline-delimited, omitindo o campo `jsonrpc` conforme o wire protocol do App Server;
- initialize/initialized;
- account/read;
- login browser e device-code;
- wait por `account/login/completed` filtrado por `loginId`;
- cancel login;
- logout;
- encerramento e tratamento de exit/error/JSON inválido/timeout;
- sanitização de mensagens.

### O1.4 — sessão dedicada

- `LABIA_CODEX_BIN` seleciona o binário, default `codex`;
- `LABIA_PROVIDER_DATA_DIR` seleciona a raiz dedicada, default em diretório do usuário fora de `~/.codex`;
- cada conexão recebe um subdiretório próprio;
- child env sobrescreve `CODEX_HOME` e remove chaves OpenAI/Codex herdadas;
- nunca copiar sessão atual do Codex.

### O1.5 — serviço de conexão

Serviço independente do runner/worker que:

- lista/cria conexão OpenAI local;
- sobe executor sob demanda;
- inicia login;
- consulta conta e reconcilia estado;
- cancela tentativa pendente;
- expira tentativa por timeout local;
- desconecta via logout;
- reconecta usando a sessão dedicada quando ainda válida;
- mantém capacidade de imagem `UNVERIFIED` em O1.

### O1.6 — API local

Rotas:

- `GET/POST /api/provider-connections`;
- `GET /api/provider-connections/:id`;
- `POST /api/provider-connections/:id/actions` com ações `login`, `status`, `cancel`, `disconnect`, `reconnect`.

Todas passam por gate local explícito antes de acessar banco ou iniciar processo. O gate fica desabilitado por padrão, recusa Vercel e só aceita host/origin loopback quando `LABIA_LOCAL_OPENAI_OAUTH_ENABLED=true`.

### O1.7 — UI

`Conexões` foi adicionada à navegação e `/conexoes` segue os tokens/classes existentes de `docs/DESIGN-SYSTEM.md`.

Card OpenAI/ChatGPT exibe:

- estado da conta;
- estado do executor;
- capacidade de imagem separada;
- geração real separada e não validada;
- botões conforme estado;
- browser/device code sem token;
- mensagens sanitizadas.

### O1.8 — testes sem geração

Vitest cobre:

- fake process: initialize/initialized e correlação por request id;
- login browser e device-code;
- notificação de conclusão somente para `loginId` correto;
- cancel/logout;
- timeout, process exit/error e JSON inválido;
- `CODEX_HOME` dedicado e remoção de API keys herdadas;
- gate local;
- DOM/SSR da interface: Conta / Capacidade de imagem / Geração real e controles;
- prova estática de que módulos O1 não importam filas/workers/jobs conhecidos de geração e não enviam `thread/start`/`turn/start`.

Nenhum teste confirma login real e nenhum teste gera mídia.

### O1.9 — validação

Run GitHub Actions `34616487976` em 2026-09-11:

- `npm ci` / Prisma client — success;
- `npm run typecheck` — success;
- `npm run lint` — success;
- `npx vitest run` — success;
- `next build` — success.

O CI não recebe credenciais OpenAI/ChatGPT, não inicia `codex app-server` real, não conecta ao banco e não inicia worker de geração.

### Limitações operacionais restantes

- a migration `20260911090000_add_provider_connections` está versionada, mas **não foi aplicada ao Supabase/produção por esta execução**;
- o repositório não possui membership de usuário para O1; `ownerKey` é uma identidade local configurada e vinculada ao workspace. Isso é suficiente para o executor local de usuário único, não para MCP/multiusuário;
- runtime do App Server é process-local; após restart do Next, a conexão persistida pode ser reconciliada por `reconnect` lendo o `CODEX_HOME` dedicado;
- o retry pós-submit dos workers pode reenviar geração já submetida e continua débito bloqueador antes de qualquer validação real por nova conexão;
- o nó Gerar Imagem ainda não foi migrado para usar `ProviderConnection`.

## Status

- [x] Contrato aprovado por Felipe para início de O1.
- [x] O1.1 contrato/ADR aplicado.
- [x] O1.2 persistência implementada em schema + migration versionada (não aplicada externamente).
- [x] O1.3 cliente App Server implementado.
- [x] O1.4 isolamento implementado.
- [x] O1.5 serviço implementado.
- [x] O1.6 API local implementada.
- [x] O1.7 UI implementada.
- [x] O1.8 testes com processo falso + DOM adicionados.
- [x] O1.9 CI sem geração executada e verde (`34616487976`).
- [ ] Migration aplicada ao banco escolhido para o teste local.
- [ ] App Server real iniciado pelo LabIA no host do Felipe.
- [ ] Login real executado por Felipe.
- [ ] Capacidade real de imagem verificada.
- [ ] Geração real validada.
- [ ] Produção publicada.
