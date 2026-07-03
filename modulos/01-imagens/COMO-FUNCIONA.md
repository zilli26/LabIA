# 01-Imagens — Como funciona

## Fluxo do usuário (caminho feliz)

1. No canvas, adiciona **Nó Prompt** e escreve o prompt (pode pedir ajuda do módulo 04-copywriting no futuro: nó de "melhorar prompt").
2. Conecta a um **Nó Gerar Imagem**, escolhe o modelo — o nó mostra: `modelo · US$/imagem · ~R$`.
3. Clica em executar (nó ou fluxo inteiro). O nó entra em estado "gerando" (job assíncrono via pg-boss → ModelProvider → fal.ai).
4. Imagem aparece no nó ao concluir; custo real substitui o estimado. Asset salvo na biblioteca automaticamente.
5. Opcional: duplica o nó com outro modelo e liga ambos num **Nó Comparar**.

## Regras de negócio

- Estimativa de custo: `ModelProvider.estimateCost()` com preço da tabela local de modelos (sincronizada da pesquisa P1 e atualizável).
- Falha de geração: nó exibe erro legível + botão retry; `Generation.status = failed`; não debita ledger.
- Variações: N imagens = N × custo unitário, mostrado antes.
- Câmbio US$→R$: cacheado 24h (API pública de câmbio).

## Modelos/APIs (confirmado na P1 · preços em pesquisas/P1)

- Barato/volume: **FLUX schnell** (Replicate, $0.003/img) ou FLUX dev (fal.ai, $0.025)
- Qualidade: **Nano Banana 2** (fal.ai, $0.08) · hero: Nano Banana Pro ($0.15)
- Edição por instrução: **FLUX Kontext Pro** (fal.ai, $0.04) ou Nano Banana edit
- GPT Image: não está no fal — se necessário, provider OpenAI direto (fase 2)
