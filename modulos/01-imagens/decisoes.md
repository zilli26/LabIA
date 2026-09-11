# 01-Imagens — Decisões

- **2026-07-02 · Lançar com 2 modelos (1 top + 1 barato), não 10.** Por quê: o valor está na comparação custo×qualidade e no custo visível, não no catálogo; catálogo cresce depois via tabela de modelos sem código novo. Modelos exatos: aguardando pesquisa P1.
- **2026-07-02 · Toda geração persiste antes de mostrar.** Por quê: dor real do Felipe de perder prompt/resultado em plataformas; biblioteca é memória do laboratório.
- **2026-07-03 · Worker único para filas de fluxo e imagem.** Por quê: em desenvolvimento e na E1, um único processo `npm run worker` mantém `flow-node-execution` e `image.generate` vivos com menos operação e menos chance de esquecer uma fila; separar workers só quando houver razão real de escala ou isolamento.
- **2026-09-11 · Não existe provider principal; cada nó gerativo escolhe Provider → Conexão → Modelo.** Decisão definitiva do Felipe. A fal.ai continua disponível normalmente. Formulações históricas de “fal.ai principal” descrevem a primeira implementação e estão substituídas para a arquitetura de produto.
- **2026-09-11 · Login ChatGPT não habilita imagem.** O1 separa `ProviderConnection`, `ProviderCapability` e validação real. Conectar a conta pode alterar apenas o estado de autenticação; capacidade e geração continuam pendentes até provas próprias e autorizadas.
