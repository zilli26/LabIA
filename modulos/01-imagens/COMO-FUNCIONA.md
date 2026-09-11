# 01-Imagens — Como funciona

## Fluxo do usuário (caminho feliz)

1. No canvas, adiciona **Nó Prompt** e escreve o prompt (pode pedir ajuda do módulo 04-copywriting no futuro: nó de "melhorar prompt").
2. Conecta a um **Nó Gerar Imagem** e escolhe `Provider → Conexão → Modelo`. No comportamento legado atual, os modelos implementados ainda usam fal.ai diretamente; a migração do nó para a seleção completa vem depois de O1. O nó mostra preço/cota quando aplicável.
3. Clica em executar (nó ou fluxo inteiro). O nó entra em estado "gerando" (job assíncrono via pg-boss → provider selecionado → resultado).
4. Imagem aparece no nó ao concluir; custo real substitui o estimado quando houver cobrança mensurável. Asset salvo na biblioteca automaticamente.
5. Opcional: duplica o nó com outro modelo/provider e liga ambos num **Nó Comparar**.

## Conexões de provider

Uma `ProviderConnection` é a autorização/sessão associada ao workspace/dono. Ela não é a geração em si.

A interface separa três evidências:

- **Conta conectada**: autenticação válida no executor/provider;
- **Capacidade verificada**: a conexão comprovadamente suporta a modalidade necessária (imagem, vídeo, texto etc.);
- **Geração real validada**: uma execução autorizada terminou e foi persistida.

O1 implementa OpenAI/ChatGPT via Codex App Server local apenas até a gestão da conexão. Mesmo após login, `Capacidade de imagem = Não verificada` e `Geração real = Não validada` até etapas posteriores autorizadas.

## Regras de negócio

- Não existe provider principal; cada nó gerativo resolve `Provider → Conexão → Modelo` (ADR 0002).
- Estimativa de custo: o provider selecionado expõe `estimateCost()` quando houver preço mensurável; assinatura não deve ser convertida artificialmente em custo de API.
- Falha de geração: nó exibe erro legível + botão retry; `Generation.status = failed`; não debita ledger. **Débito atual:** retry pós-submit ainda precisa de reconciliação/idempotência para não reenviar geração já aceita pelo provider.
- Variações: N imagens = N × custo unitário quando o provider cobrar por imagem, mostrado antes.
- Câmbio US$→R$: cacheado 24h (API pública de câmbio) para providers cobrados em USD.
- Não há fallback automático para API paga OpenAI ou outro provider se uma conexão pessoal estiver indisponível.

## Modelos/APIs — estado histórico e O1

Modelos já integrados no comportamento legado de imagem:

- **FLUX dev** via fal.ai;
- **Nano Banana 2** via fal.ai.

Referências históricas da P1 incluem Replicate/FLUX schnell e outros modelos, mas integração futura depende de etapa própria.

OpenAI/ChatGPT em O1:

- autenticação pelo Codex App Server em processo local separado;
- sessão dedicada do LabIA (`CODEX_HOME` próprio), sem copiar a sessão atual do Codex;
- login/cancelamento/logout/reconexão disponíveis em `/conexoes`;
- **nenhum modelo de imagem OpenAI fica habilitado por O1**;
- **nenhuma geração OpenAI é executada por O1**.
