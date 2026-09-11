# 01-Imagens — Especificação

**Etapa:** E1 (prioridade #1) · **Dor que resolve:** planos caros de plataformas de geração; falta de comparação entre modelos; falta de visibilidade de custo.

## O que terá

### Nós do canvas
- **Nó Prompt** — texto do prompt + campos estruturados opcionais (estilo, negativo, seed, proporção).
- **Nó Gerar Imagem** — escolhe **Provider → Conexão → Modelo** (com preço/cota visível quando aplicável), recebe prompt de entrada, produz asset. Suporta N variações.
- **Nó Comparar** — recebe 2+ imagens e exibe lado a lado (mesmo prompt, modelos diferentes) para descobrir custo×qualidade.
- **Nó Referência** — upload de imagem como referência (img2img / edição por instrução nos modelos que suportam).

### Telas
- **Biblioteca de assets** — grid de tudo que foi gerado/enviado: filtros por marca, tipo, modelo, data; cada item mostra prompt e custo real.
- **Histórico de gerações** — lista de `Generation` com prompt, provider/conexão/modelo, custo estimado vs. real, replay ("gerar de novo com outro modelo").

### Regras de produto
1. Custo estimado SEMPRE visível antes de rodar (no próprio nó) e custo real depois.
2. Mínimo 2 modelos no lançamento — 1 top (qualidade) + 1 barato (volume); catálogo final vem da pesquisa P1.
3. Toda geração persiste `Generation` + `Asset` (nada se perde, prompt sempre recuperável).
4. **Não existe provider principal.** Cada nó gerativo resolve `Provider → Conexão → Modelo`; fal.ai continua disponível e nenhuma conexão nova substitui outra silenciosamente (ADR 0002).
5. **Conta conectada ≠ capacidade de imagem verificada ≠ geração real validada.** Uma conexão OpenAI autenticada só pode aparecer como fonte de geração depois que a capacidade específica estiver comprovada em etapa autorizada.
6. Não existe fallback automático para API paga OpenAI quando uma conexão por assinatura estiver indisponível.

## O1 — conexão OpenAI/ChatGPT (2026-09-11)

O1 adiciona a gestão da conexão via Codex App Server e a persistência `ProviderConnection`, mas **não liga essa conexão ao executor do nó Gerar Imagem** e não roda geração. O contrato detalhado está em `docs/O1-OPENAI-OAUTH-ESPECIFICACAO.md`.

## Fora de escopo (deste módulo)
- Vídeo (módulo 02) · texto sobre imagem/carrossel (módulo 05) · upscale/edição avançada (backlog).
