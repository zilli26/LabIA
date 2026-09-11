# 01-Imagens — Como funciona

## Fluxo do usuário (caminho feliz)

1. No canvas, adiciona **Nó Prompt** e escreve o prompt (pode pedir ajuda do módulo 04-copywriting no futuro: nó de "melhorar prompt").
2. No **Nó Gerar Imagem**, a arquitetura aprovada escolhe **Provider → Conexão → Modelo** e mostra custo/cota quando conhecidos. O caminho legado atual ainda usa fal.ai até a etapa pós-O1 de roteamento por conexão.
3. Clica em executar (nó ou fluxo inteiro). O nó entra em estado "gerando" (job assíncrono via pg-boss → ModelProvider → provider selecionado).
4. Imagem aparece no nó ao concluir; custo real substitui o estimado. Asset salvo na biblioteca automaticamente.
5. Opcional: duplica o nó com outro modelo e liga ambos num **Nó Comparar**.

## Conexão não é geração

A tela `/conexoes` gerencia autenticação separadamente do canvas. Em O1, uma conta ChatGPT pode ficar `Conectada`, enquanto `Capacidade de imagem` continua `Não verificada` e `Geração real` continua `Não validada`. O nó não deve oferecer uma capacidade apenas porque o login funcionou.

## Regras de negócio

- Estimativa de custo: `ModelProvider.estimateCost()` com preço da tabela local do provider/modelo quando houver preço confirmado.
- Falha de geração: nó exibe erro legível + botão retry; `Generation.status = failed`; não debita ledger.
- Variações: N imagens = N × custo unitário, mostrado antes quando a unidade de custo for conhecida.
- Câmbio US$→R$: cacheado 24h (API pública de câmbio).
- Não há provider principal global. fal.ai é uma opção normal e permanece funcional.
- Fallback de conexão pessoal para API paga nunca é automático; exige nova estimativa e autorização.

## Modelos/APIs — histórico da primeira implementação

- Barato/volume: **FLUX schnell** (Replicate, $0.003/img) ou FLUX dev (fal.ai, $0.025)
- Qualidade: **Nano Banana 2** (fal.ai, $0.08) · hero: Nano Banana Pro ($0.15)
- Edição por instrução: **FLUX Kontext Pro** (fal.ai, $0.04) ou Nano Banana edit
- OpenAI/ChatGPT: O1 implementa apenas conexão. Modelos/capacidades de imagem só entram após prova separada.

Preços desta seção são históricos da pesquisa original do módulo; não devem ser usados como cotação atual sem revalidação.
