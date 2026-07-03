# 06-Calendário — Especificação

**Etapa:** E5 · **Dor que resolve:** publicar em N redes é retrabalho; ferramentas tipo Metricool têm preview ruim e edição de proporção fora do fluxo; calendário reativo sem loop de aprendizado.

## O que terá

- **Calendário visual** (mês/semana) com Posts por Brand, arrastar para reagendar.
- **Composer de post**: copy + assets + seleção de redes; preview REAL por rede (como vai aparecer no feed do Instagram vs. X vs. LinkedIn); edição de proporção inline (chama o Nó Proporções do módulo 05).
- **Publicação multi-rede**: um post → N redes ao mesmo tempo, com adaptação por rede (limite de caracteres, hashtags, proporção). Via API oficial ou agregador — decisão da pesquisa P3.
- **Fila de aprovação** (fase 2 do módulo): link compartilhável para cliente aprovar/comentar antes de agendar.
- **Métricas pós-publicação**: coleta de likes/comments/saves/alcance por post → alimenta o loop de aprendizado (módulo 08 usa isso para pauta).
- **Nó Publicar**: o post como saída final de um fluxo do canvas.

## Regras de produto
1. Preview por rede é fiel (dimensões, truncamento de texto, capa de vídeo) — é o diferencial sobre Metricool.
2. Falha de publicação em 1 rede não cancela as outras; status por rede.
3. Nada publica sem estado "aprovado" (mesmo que auto-aprovado pelo owner).

## Fora de escopo
Responder comentários/community (backlog) · social listening (backlog) · stories interativos (depende de API, ver P3).
