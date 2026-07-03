# 05-Design — Como funciona

## Fluxo do usuário: carrossel

1. Nó Copy (módulo 04) gera a copy do carrossel estruturada por slides (título, corpo, CTA final).
2. Conecta ao **Nó Carrossel**: escolhe template visual da Brand, fundo (cor da marca ou imagem gerada no módulo 01).
3. Slides renderizados server-side (Node canvas/Sharp — port do pipeline Pillow do vault); preview no nó.
4. Ajustes por parâmetro (tamanho de fonte, alinhamento) — não por arrastar.
5. Export ZIP ou conecta direto a um Post (módulo 06).

## Regras de negócio

- Templates de slide por Brand versionados (JSON de layout: posições, fontes, cores) — criar template novo é dado, não código.
- Recorte inteligente do Nó Proporções: detecção de região de interesse (lib de vision ou heurística de foco central) antes do crop.
- Renderização: Sharp/`@napi-rs/canvas` no worker (mesma fila pg-boss).

## Dependências
Módulos 01 (assets), 03 (motor), 04 (copy estruturada) · identidade da Brand (E3).
