# 05-Design — Especificação

**Etapa:** E4 · **Dor que resolve:** montar carrossel/artes de post é manual e lento; cada rede exige proporção diferente; texto sobre imagem sem identidade.

## O que terá

### Nós do canvas
- **Nó Carrossel** — recebe copy estruturada (slides) + imagens/fundos + identidade da Brand → gera N slides prontos (1080×1350) com tipografia e cores da marca. Base: pipeline Python+Pillow que já existe no vault (skill `gerador-carrossel`).
- **Nó Proporções** — recebe 1 arte e produz as variantes por rede (1:1, 4:5, 9:16, 16:9) com recorte inteligente (foco no sujeito).
- **Nó Texto sobre Imagem** — headline/legenda sobre asset, com estilos da marca.
- **Nó Montagem de Imagem** — composição: produto + fundo gerado + elementos (o "pipeline-image-generation" do vault: IA gera fundo/luz; logo/texto/grid são compostos programaticamente, nunca gerados).

### Regras de produto
1. Elementos de marca (logo, texto) NUNCA são gerados por IA — sempre compostos por código sobre a base gerada (regra da skill `pipeline-image-generation`: IA alucina logos).
2. Identidade da Brand (fontes, cores) aplicada automaticamente.
3. Export: PNG/JPG por slide + ZIP do carrossel.

## Fora de escopo
Editor manual estilo Canva (arrastar pixel a pixel) — o LabIA compõe por regra/template; ajuste fino vai pro Canva/Figma via export.
