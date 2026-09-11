# 01-Imagens - Construção

**Status:** tarefas 1-5 implementadas e **primeira imagem real gerada em 2026-07-03** (Generation `cmr5jy3ry0000vdeczlnfbh0j`, FLUX dev, custo real R$0,135 persistido, asset 1024x768 no Supabase Storage, visível na `/biblioteca` com prompt recuperável). Canvas registra `Prompt` e `Gerar Imagem` no registry vivo, estima custo antes pelo `FalProvider`, worker unificado (`npm run worker`) consome as filas `flow-node-execution` e `image.generate`. Handles do canvas corrigidos (invisíveis -> 16px esmeralda) após feedback do Felipe. Comparação lado a lado (tarefa 6) **adiada por decisão do Felipe em 2026-07-03**. **O1 (2026-09-11): infraestrutura de `ProviderConnection` + OpenAI/ChatGPT local implementada em branch, sem conectar ainda o nó Gerar Imagem a essa conexão e sem geração real.** **Etapa:** E1. **Depende de:** fundação do canvas (módulo 03, parte E1), worker vivo e `ModelProvider`.

## O1 — Provider → Conexão → Modelo

Decisão vigente: **não existe provider principal**. O nó gerativo deve evoluir para selecionar `Provider → Conexão → Modelo` (ADR 0002). O1 entrega somente a infraestrutura de conexão OpenAI/ChatGPT:

- `ProviderConnection` no Prisma com workspace + `ownerKey`, referência opaca à sessão e estados separados de conexão/executor/capacidade;
- Codex App Server por stdio com `CODEX_HOME` dedicado ao LabIA;
- `/conexoes` e APIs locais protegidas;
- login/cancelamento/logout/reconexão implementados sem importar worker ou fila de geração;
- capacidade de imagem permanece `unverified` e geração real permanece `não validada`;
- migration existe no repositório, mas **não foi aplicada ao Supabase nesta execução**;
- testes usam processo falso/DOM; **login real não foi executado**;
- fal.ai continua funcionando como comportamento legado atual até a etapa específica de migração do nó.

O débito de retry pós-submit dos workers continua aberto e precisa ser resolvido antes de validar geração real por uma nova conexão; O1 não o mascara.

## Ordem de tarefas

1. `ModelProvider` interface + implementação fal.ai (`lib/providers/`) com 2 modelos de imagem - testável por script antes de UI.
2. Entidades `Generation` + `Asset` no Prisma + upload do resultado ao Supabase Storage.
3. Job de geração no pg-boss (enqueue -> poll/webhook fal -> persistir -> notificar UI).
4. Nó Prompt e Nó Gerar Imagem no canvas (React Flow), com estimativa de custo no nó.
5. Biblioteca de assets (tela) + histórico de gerações.
6. Nó Comparar + Nó Referência (img2img).
7. Pós-O1: migrar Gerar Imagem para persistir seleção explícita `provider + connectionId + model`, preservando grafos existentes até migração deliberada.

## Critérios de aceite (validação externa)

- [x] Geração real de 1 imagem via fal.ai com custo impresso — validado 2026-07-03 pelo pipeline completo (fluxo -> worker -> fal.ai -> Supabase), que cobre mais que o smoke script; custo real R$0,135 registrado na Generation.
- [x] No canvas: prompt -> gerar -> custo estimado ANTES (R$0,135 no run) e real DEPOIS (R$0,135 na Generation/biblioteca). Pendência visual histórica: confirmar a imagem renderizando no nó quando o Felipe executar pela UI.
- [ ] Mesma prompt em 2 modelos -> comparação lado a lado — **adiada por decisão do Felipe (2026-07-03)**; volta antes de declarar E1 fechada ou vai para E2, a decidir.
- [x] Asset aparece na biblioteca com prompt recuperável — validado no browser: 1 asset, FLUX.1 [dev], R$0,14, prompt completo, preview do Storage.
- [ ] Falha simulada (chave inválida) mostra erro legível (✓ validado com `Exhausted balance` legível no nó) e permite retry (✗ botão de retry por nó pendente).

### Critérios O1 vinculados a Imagens

- [x] conta/conexão, capacidade de imagem e geração real têm estados separados na UI/DOM;
- [x] login OpenAI não habilita automaticamente o nó Gerar Imagem;
- [x] teste estático prova ausência de imports de workers/jobs/pg-boss nas rotas O1;
- [ ] login ChatGPT real — pendente de interação do Felipe;
- [ ] capacidade de imagem real — não verificada por design em O1;
- [ ] geração OpenAI real — não autorizada em O1.

## Validação histórica da sessão E1 (2026-07-03)

- [x] `npx vitest run` - 47 testes verdes.
- [x] `npm run lint`.
- [x] `npm run typecheck`.
- [x] `npm run build`.
- [x] Dev server em `http://localhost:3000`: `/fluxos`, `/fluxos/[id]`, `/biblioteca` e `/api/flows/node-definitions` responderam 200; registry retornou `prompt` e `image-generation`.
- [x] `npx dotenv-cli -e .env.local -- npm run worker` - filas `flow-node-execution` e `image.generate` ativas no mesmo processo.
- [x] Com worker + dev em paralelo, fluxo Prompt -> Gerar Imagem criou `FlowRun cmr5e8egz0008vd58exhblo6h`, o nó de imagem saiu de `queued`, criou `Generation cmr5e8qld0000vd84qgl2jc4a` e a fal.ai retornou `Exhausted balance` legível.

## Validação O1 (2026-09-11)

- [x] GitHub Actions: typecheck, lint, Vitest/DOM e build passaram no run O1 após correções de tipagem; sem segredo de provider e sem worker de geração.
- [x] fake Codex App Server cobre initialize/initialized, device-code, notificação por `loginId`, cancel, logout e timeout.
- [x] teste de ambiente confirma `CODEX_HOME` dedicado e remoção de API keys herdadas.
- [x] DOM confirma `Conta ChatGPT`, `Capacidade de imagem` e `Geração real` como provas distintas.
- [x] boundary test impede imports conhecidos de worker/fila/generation no O1.
- [ ] App Server real no host do Felipe — não executado por esta sessão remota.

## Débitos restantes

- comportamento de geração atual ainda instancia fal.ai em partes dos nós/jobs; migrar em etapa própria sem quebrar o fluxo existente;
- retry pós-submit pode reenviar geração já submetida; corrigir antes de qualquer validação real por nova conexão;
- migration `ProviderConnection` precisa ser aplicada ao banco de desenvolvimento escolhido para o login local;
- login real, capacidade de imagem e geração OpenAI continuam pendentes e deliberadamente separados;
- nenhuma publicação/produção foi feita por O1.
