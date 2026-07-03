# ADR 0001 — Canvas de fluxos como espinha dorsal da plataforma

**Status:** aceita · **Data:** 2026-07-02

## Contexto
O plano original colocava o canvas de fluxos como módulo da etapa E2, depois de um "studio de geração" com telas próprias. Felipe apontou que o fluxo visual é universal: serve para conectar copy, imagens e vídeo — é o paradigma da plataforma, não uma feature.

## Decisão
O canvas (React Flow) entra na E1 como fundação. Toda capacidade nova nasce como NÓ do canvas; telas dedicadas (studio, biblioteca, calendário) são visões complementares sobre as mesmas entidades, nunca caminhos paralelos de funcionalidade.

## Consequências
- E1 = canvas + nós de imagem (não studio isolado).
- O motor de execução de fluxos (`lib/flows/`) é o primeiro sistema central a construir e estabiliza cedo.
- Cada módulo novo define seus nós em `modulos/<x>/ESPECIFICACAO.md`.
- Custo: E1 fica um pouco maior; benefício: nenhuma refatoração "de telas para nós" no futuro.
