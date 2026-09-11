# ADR 0002 — Provider por nó e conexão ChatGPT local

**Data:** 2026-09-11  
**Estado:** aprovado por Felipe  
**Escopo desta decisão:** arquitetura de providers e O1 (autenticação local OpenAI/ChatGPT)

## Decisão

O LabIA **não possui provider principal**. Cada nó gerativo escolhe explicitamente:

`Provider → Conexão → Modelo`

A fal.ai permanece disponível como provider/gateway normal. Decisões históricas que chamavam fal.ai de provider ou gateway "principal" permanecem registradas como contexto da primeira implementação, mas estão **substituídas por esta decisão** para a arquitetura de produto.

Uma conexão pessoal é uma entidade separada do modelo e da capacidade. Para O1, `ProviderConnection` registra proprietário, workspace, provider, método de autenticação, referência opaca da sessão, estado do executor e estado da conta. Capacidades são registradas separadamente em `ProviderCapability`.

## Regra de verdade de estado

Os três estados abaixo são independentes e nunca podem ser inferidos um do outro:

1. **Conta conectada** — autenticação do provider foi concluída.
2. **Capacidade disponível** — uma capacidade concreta (por exemplo, geração de imagem) foi verificada separadamente.
3. **Geração real validada** — uma execução real foi autorizada e comprovada.

Em O1, login bem-sucedido só pode mudar o item 1. `image_generation` continua `unverified` e `generationValidationStatus` continua `unvalidated` até etapas explicitamente autorizadas.

## OpenAI/ChatGPT em O1

O LabIA local usa o Codex App Server como executor de autenticação por stdio. O próprio App Server gerencia a autenticação ChatGPT. O LabIA não transforma o login em chave da API pública OpenAI e não cria fallback automático para API paga.

A sessão do LabIA usa `CODEX_HOME` dedicado por `ProviderConnection`. O processo filho não recebe `OPENAI_API_KEY`, `AZURE_OPENAI_API_KEY`, `CODEX_ACCESS_TOKEN` ou `CODEX_API_KEY` do ambiente pai. A referência persistida no banco é opaca (`labia-codex:<uuid>`); tokens não são armazenados em `ProviderConnection` e não são devolvidos ao browser.

## Isolamento operacional

Autenticação roda em processo próprio (`npm run provider:executor`), separado de `npm run worker`. O executor de provider não importa nem registra filas `flow-node-execution`, `image.generate` ou `video.generate`.

Iniciar login não executa fluxo, não cria `Generation`, não envia job e não consome fila existente.

## Segurança local

- UI/API de conexões só ficam disponíveis quando `LABIA_LOCAL_CONNECTIONS_ENABLED=true`.
- As rotas aceitam apenas host de loopback.
- O daemon escuta somente em `127.0.0.1` e exige bearer token local dedicado.
- `CODEX_HOME` dedicado fica sob `.labia/codex` por padrão e `.labia/` é ignorado pelo Git.
- Erros passam por redaction antes de serem persistidos/retornados.

## Não decidido/implementado por O1

- roteamento de geração OpenAI;
- prova de capacidade de imagem;
- geração real;
- ligação `Provider → Conexão → Modelo` dentro dos nós existentes (etapa posterior; a decisão arquitetural já é obrigatória);
- Google, Seedance direto, MCP ou publicação;
- execução SaaS/multi-host do executor pessoal.

## Consequências

- fal.ai continua funcionando no caminho legado até a etapa que parametrizar cada nó com conexão/modelo;
- nenhum código novo deve introduzir um provider default global;
- workers futuros devem resolver a conexão escolhida pelo nó e validar capacidade antes de submeter geração;
- idempotência de submissão continua um débito separado e deve ser resolvida antes de ampliar gerações reais.
