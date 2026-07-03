# RETOMADA — estado vivo do projeto

> Atualizado a cada fim de sessão de orquestração. Próxima sessão (Claude ou Codex): leia isto DEPOIS do CLAUDE.md e ANTES de qualquer trabalho.
> Última atualização: **2026-07-03** (sessão de fundação E0 + abertura E1).

## Onde estamos

**E1 em andamento, ~70%.** Funcionando de verdade (validado, não declarado): app shell com dashboard/lista/canvas, persistência de fluxos no Supabase real, motor de execução + custos com 47 testes unitários verdes, ModelProvider fal.ai completo até o enqueue, bucket de assets criado, migrations aplicadas.

## Decisões mudadas nesta sessão (e o porquê)

1. **Verde-ácido → par esmeralda** (`#10B981` fundo/CTA + `#3DDFA6` texto/custo). Por quê: ácido sobre preto é a identidade do Krea = "cara de IA genérica"; esmeralda é a cor do Felipe. Detalhe: virou PAR porque esmeralda escuro não tem contraste para texto em dark.
2. **Tela única de canvas → app shell com páginas** (`/` dashboard, `/fluxos` lista, `/fluxos/[id]` canvas, paleta flutuante "+ Nó"). Por quê: era buraco de spec — sem shell especificado, o Codex encaixou tudo numa tela; sidebar fixa era peso permanente para ação eventual. Spec fixada no DESIGN-SYSTEM.md.
3. **Chip de custo só em nós com custo real.** Por quê: `~R$0,00` em nó utilitário era ruído que diluía o princípio "custo visível".
4. **`estimateFlowCost` consulta o registry VIVO** (era snapshot no import — nós registrados depois ficavam invisíveis ao custo; bug achado por teste) e **`sumCosts` deriva o câmbio dos totais** (era a taxa do último nó). Ambos corrigidos com testes de regressão em `tests/flows/`.
5. **Modelo de trabalho fixado**: Codex constrói por prompts com território explícito; Claude (sala de comando) especifica, revisa e valida; subagentes fazem trabalho paralelo isolado; quem constrói NUNCA se auto-valida. Main direto com territórios rígidos (sem branches de cerimônia); worktree só para paralelo arriscado.

## Débitos técnicos (assumidos conscientemente)

- **Saldo fal.ai zerado** → smoke test parou em `Exhausted balance`; a primeira imagem real nunca rodou. Ação: Felipe faz top up de US$10 → rodar `npx dotenv-cli -e .env.local -- npm run smoke:image`.
- **Worker pg-boss não tem processo permanente** — `scripts/image-worker.ts` existe, mas ninguém o mantém vivo; sem ele, jobs enfileiram e não executam. Decidir na E1: rodar junto do dev ou processo separado documentado.
- **Critérios de aceite E1 ainda abertos** (módulo 03): execução com estados em tempo real, retomar após fechar browser, bloqueio visual de conexão incompatível, custo acumulado (unit OK, falta end-to-end). Módulo 01: todos, dependem do saldo.
- **/biblioteca é placeholder** (o prompt em aberto abaixo resolve).
- **Wordmark provisória** (Space Grotesk 700, sem logo).
- **Limpeza menor**: nó "Validação Claude" ficou no fluxo do banco; pasta `Temp\claude\labia-tests-worktree` pode ter sobrado no disco com node_modules travado; considerar `.gitattributes` para os warnings LF/CRLF.
- **Pesquisas com pendência agendada**: P3 (métricas dos agregadores → reabrir na E5), P6 (medir throughput real do `codex exec` → E3).

## Por onde retomar (nesta ordem)

1. **Prompt em aberto para o Codex** (pode já ter sido enviado — confira `modulos/01-imagens/CONSTRUCAO.md` seção Status antes de reenviar):

```
Repo C:\Users\teste\Desktop\LabIA. git pull antes de tudo. Leia AGENTS.md,
docs/DESIGN-SYSTEM.md e modulos/01-imagens/CONSTRUCAO.md.

Tarefas 4-5 do módulo 01-imagens, na estrutura atual do app:
(a) Nós "Prompt" e "Gerar Imagem" registrados no registry de
lib/flows/registry.ts e disponíveis na paleta flutuante "+ Nó" do canvas
(/fluxos/[id]). O nó Gerar Imagem: dropdown de modelo com preço unitário
(FLUX dev e Nano Banana 2, via lib/providers/fal-models.ts), custo
estimado ANTES no chip mono esmeralda (Badge variant cost), imagem +
custo real DEPOIS. Use o job de lib/providers/image-generation-job.ts.
Acento visual: --lab-node-image. Siga o padrão de
components/nodes/lab-flow-node.tsx.
(b) /biblioteca real: grid de Assets com preview, prompt e custo real da
Generation, filtro por modelo e data.

A suíte de testes existe: rode npx vitest run além de lint/typecheck/
build antes de declarar pronto — se um teste quebrar, o erro é seu, não
do teste. A geração real vai falhar por saldo fal.ai (esperado);
construa até o enqueue. Atualize o CONSTRUCAO.md ao final.
```

2. **Felipe: top up US$10 na fal.ai** → rodar o smoke test.
3. **Revisão integrada** (sala de comando): smoke real + nós de imagem no canvas + worker vivo → fechar os critérios de aceite E1 → decidir E2 (vídeo) vs. polir o momento "adeus Higgsfield".

## Ambiente (para quem chegar do zero)

`.env.local` completo e funcional (Supabase + FAL_KEY + câmbio). Banco migrado. Bucket `assets` existe. Dev: `npm run dev` (porta 3000). Testes: `npx vitest run`. Scripts com env: prefixar `npx dotenv-cli -e .env.local --`.
