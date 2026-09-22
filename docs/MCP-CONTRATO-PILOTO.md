# Contrato MCP piloto do LabIA

**Status:** contrato proposto; não existe servidor MCP remoto no repositório ainda.

## Objetivo

Permitir que um cliente autorizado, como ChatGPT, transforme intenção em um Flow draft do LabIA, leia Assets, estime custo e consulte execução sem duplicar a lógica do canvas.

```text
cliente MCP
→ autenticação/workspace
→ tools LabIA
→ serviços atuais de Project/Flow/Asset/Cost/Run
→ canvas e executor comuns
```

O MCP não é um modelo, não fornece créditos e não deve iniciar geração apenas por interpretar uma frase.

## Permissões

```text
labia:read       projetos, flows, Assets, capabilities e runs
labia:draft      criar/alterar rascunhos
labia:estimate   calcular cotação
labia:run        iniciar execução aprovada
```

O servidor deve derivar `ownerId` e `workspaceId` da identidade autenticada. Nunca aceitar esses valores como autoridade enviada pelo modelo.

O checkout atual usa workspace/owner default local (`getOwnedExecutionScope`). Isso permite uma ponte local/stdio controlada, mas não autoriza expor o app publicamente como MCP multiusuário.

## Tools da primeira versão

### `get_capabilities`

Leitura sem efeitos colaterais.

```json
{}
```

Retorna:

```json
{
  "schemaVersion": "labia.mcp.v1",
  "scope": { "mode": "local_default", "workspaceId": "..." },
  "drafts": { "create": true, "save": true },
  "execution": { "estimate": true, "run": false, "reason": "executor offline" },
  "providers": [],
  "nodeTypes": []
}
```

Fontes atuais: `/api/flows/node-definitions`, readiness e conexões. O adaptador deve normalizar erros e redigir segredos.

### `list_projects`

```json
{
  "status": "DRAFT",
  "limit": 24
}
```

Mapeia para o serviço de listagem de Projetos. O filtro pode ser aplicado pelo adaptador até existir no endpoint.

### `get_project`

```json
{ "projectId": "..." }
```

Mapeia para `GET /api/projects/:projectId`.

### `list_assets`

```json
{
  "projectId": "...",
  "role": "source"
}
```

Mapeia para `GET /api/projects/:projectId/assets`. Para MCP remoto, URL de Asset deve ser protegida ou temporária; a rota atual retorna URL diretamente e precisa de revisão antes da exposição pública.

### `get_flow`

```json
{ "flowId": "..." }
```

Mapeia para `GET /api/flows/:flowId` e retorna o `FlowGraph` real.

### `create_flow_draft`

Entrada mínima:

```json
{
  "idempotencyKey": "chat-turn-unique-key",
  "template": "product-production-blueprint",
  "intent": {
    "name": "Produto X — vídeo TikTok",
    "objective": "Demonstrar o produto em vídeo vertical",
    "aspectRatio": "9:16",
    "durationSeconds": 15,
    "briefing": "Mostrar o produto em uso, com movimento suave e CTA final."
  }
}
```

Templates iniciais:

```text
product-imported-to-video
product-production-blueprint
```

A tool deve:

1. criar Projeto + Flow usando a rota/serviço existente;
2. preencher briefing no grafo sem duplicar o runner;
3. retornar `draftStatus: "draft"`;
4. garantir `generationStarted: false`;
5. retornar `project.id`, `flow.id`, `projectId` e grafo.

O endpoint atual cria o template, mas não recebe `briefing` diretamente; a implementação deve ler e salvar o Flow com `PUT` após a criação. Antes de expor remotamente, persistir `idempotencyKey` para impedir Projetos duplicados.

### `save_flow_draft`

```json
{
  "idempotencyKey": "save-key",
  "flowId": "...",
  "name": "Produto X — vídeo TikTok",
  "graph": {
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 0.8 }
  },
  "expectedGraphHash": null
}
```

Regras:

- validar tipos, portas, ciclos e Assets do mesmo Projeto/workspace;
- nunca iniciar geração;
- rejeitar revisão concorrente quando `expectedGraphHash` não bater;
- retornar o Flow salvo e `generationStarted: false`.

O `PUT /api/flows/:flowId` já valida grafo e ownership, mas ainda não possui revisão concorrente nem idempotência.

### `estimate_flow`

```json
{
  "flowId": "...",
  "targetNodeId": null
}
```

Mapeia para `GET/POST /api/flows/:flowId/cost` conforme o adaptador. Retorna:

```json
{
  "flowId": "...",
  "cost": {
    "total": {
      "usd": 0.75,
      "brl": 4.05,
      "billingMode": "api",
      "source": "catalog"
    },
    "nodes": []
  },
  "approval": {
    "required": true,
    "status": "pending",
    "expiresAt": "...",
    "snapshotHash": "..."
  }
}
```

Importação e montagem local têm custo de IA `R$0,00`. Geração desconhecida não vira zero.

### `start_run`

```json
{
  "flowId": "...",
  "targetNodeId": null,
  "confirmationToken": "..."
}
```

Mapeia para `POST /api/flows/:flowId/runs`.

Não expor remotamente até haver:

- aprovação humana confiável separada da interpretação do modelo;
- snapshot atual igual ao aprovado;
- provider/conexão/modelo operacional;
- executor e worker comprovados;
- idempotência de FlowRun;
- escopo autenticado por workspace.

### `get_run`

```json
{ "flowId": "...", "runId": "..." }
```

Mapeia para `GET /api/flows/:flowId/runs/:runId`. Estados atuais: `queued`, `running`, `done`, `failed`.

## Tools que ficam fora do primeiro piloto

Não expor ainda:

- `approve_flow`: não existe entidade/rota de aprovação humana persistente;
- `record_human_decision`: hoje é apenas metadata no nó `note`;
- `extend_approved_clip`: o nó existe, mas o runner não verifica aprovação semântica;
- `assemble_approved_clips`: montagem existe, mas não há tool MCP separada;
- `retry_node` e `cancel_run`: não há contrato completo de retry/cancelamento.

## Fluxo canônico

```text
get_capabilities
→ list_projects / get_project / list_assets
→ create_flow_draft
→ get_flow
→ save_flow_draft
→ estimate_flow
→ aprovação humana confiável
→ start_run
→ get_run
```

Criar/salvar draft nunca executa. Alterar grafo, modelo, provider, conexão, duração ou áudio invalida cotação e aprovação anteriores.

## O que pode ser feito agora

Uma ponte local/stdio controlada pode implementar leitura, criação de draft, salvamento e estimativa usando o workspace default, sem geração.

Um MCP remoto para ChatGPT depende antes de:

1. autenticação do cliente;
2. membership/isolamento de workspace;
3. URLs de Assets protegidas;
4. idempotência de draft/run;
5. aprovação humana server-side;
6. executor/worker operacional.

Não expor as rotas atuais diretamente à internet apenas embrulhando-as em JSON-RPC.
