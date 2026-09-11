# 01-Imagens — Especificação

**Etapa:** E1 (prioridade #1) · **Dor que resolve:** planos caros de plataformas de geração; falta de comparação entre modelos; falta de visibilidade de custo.

## O que terá

### Nós do canvas
- **Nó Prompt** — texto do prompt + campos estruturados opcionais (estilo, negativo, seed, proporção).
- **Nó Gerar Imagem** — escolhe **Provider → Conexão → Modelo** (dropdowns com custo/cota visíveis quando conhecidos), recebe prompt de entrada, produz asset. Suporta N variações.
- **Nó Comparar** — recebe 2+ imagens e exibe lado a lado (mesmo prompt, modelos diferentes) para descobrir custo×qualidade.
- **Nó Referência** — upload de imagem como referência (img2img / edição por instrução nos modelos que suportam).

### Telas
- **Biblioteca de assets** — grid de tudo que foi gerado/enviado: filtros por marca, tipo, modelo, data; cada item mostra prompt e custo real.
- **Histórico de gerações** — lista de `Generation` com prompt, modelo, custo estimado vs. real, replay ("gerar de novo com outro modelo").

### Regras de produto
1. Custo estimado SEMPRE visível antes de rodar (no próprio nó) e custo real depois.
2. Não existe provider principal do LabIA. A fal.ai permanece disponível como provider/gateway normal; todo nó gerativo resolve explicitamente **Provider → Conexão → Modelo**. A implementação legada de E1 continua em fal.ai até a etapa de roteamento por conexão.
3. Login de uma conta não comprova capacidade de imagem e não habilita geração. `ProviderConnection`, `ProviderCapability` e validação real permanecem estados separados.
4. Mínimo 2 modelos no lançamento — 1 top (qualidade) + 1 barato (volume); catálogo final vem da pesquisa P1.
5. Toda geração persiste `Generation` + `Asset` (nada se perde, prompt sempre recuperável).

## O1 — conexão ChatGPT local (aprovada em 2026-09-11)

O1 implementa somente o ciclo de autenticação/conexão OpenAI/ChatGPT. O módulo de imagem **não** passa a gerar pela OpenAI por consequência do login. A prova de `image_generation` e o adaptador gerativo são etapas posteriores e exigem autorização própria.

Referências: `docs/O1-OPENAI-CHATGPT-CONNECTION.md` e `docs/adr/0002-provider-per-node-and-o1-chatgpt-connection.md`.

## Fora de escopo (deste módulo)
- Vídeo (módulo 02) · texto sobre imagem/carrossel (módulo 05) · upscale/edição avançada (backlog).
