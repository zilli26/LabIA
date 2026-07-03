# 02-Vídeos — Especificação

**Etapa:** E2 · **Dor que resolve:** vídeos IA limitados a ~8s; planos caros (Higgsfield/Pika); pipeline manual no Google Flow.

## O que terá

### Nós do canvas
- **Nó Img2Video** — recebe imagem (do módulo 01 ou upload) + prompt de movimento; escolhe modelo (Kling, Veo, Hailuo, Seedance — catálogo final via P1/P2); produz clipe.
- **Nó Extend** — recebe um clipe, extrai o último frame e gera o próximo clipe a partir dele (com prompt de continuação). É o coração dos **vídeos contínuos 30s+**: encadeie N nós Extend.
- **Nó Text2Video** — geração direta de texto (para modelos que suportam bem).
- **Nó Montagem** — concatena clipes na ordem das conexões + trilha opcional; exporta MP4 final (ffmpeg server-side).

### Regras de produto
1. Custo de vídeo é ALTO e variável → estimativa antes de rodar é obrigatória no nó E no fluxo inteiro (soma dos nós).
2. Geração é lenta (30s–5min) → status por nó em tempo real; fluxo continua rodando com usuário fora da página.
3. Todo clipe intermediário vira Asset (reaproveitável em outros fluxos).

## Fora de escopo
- Edição fina de vídeo (cortes, legendas) — backlog/ferramenta externa · avatares/lip-sync — backlog · direção automática de cena (AI Video Director) — módulo 03.
