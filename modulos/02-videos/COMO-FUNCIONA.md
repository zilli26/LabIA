# 02-Vídeos — Como funciona

## Fluxo do usuário: vídeo contínuo de 30s+

1. Gera/escolhe a imagem inicial (módulo 01) — ex.: frame de abertura da campanha.
2. Conecta a um **Nó Img2Video**: prompt de movimento ("câmera orbita o produto..."), modelo, duração do clipe (5–10s).
3. Conecta a saída a um **Nó Extend**: o sistema extrai o último frame do clipe anterior e usa como primeira imagem do próximo, com novo prompt de continuação.
4. Repete Extend quantas vezes precisar (4 clipes de 8s ≈ 32s).
5. Todos desembocam num **Nó Montagem** → MP4 único.
6. Antes de executar: o fluxo mostra custo total estimado ("este vídeo custará ~R$X"). Depois: custo real por clipe e total.

## Regras de negócio

- **Validado na P2**: frame-chaining é o padrão do mercado (Kling extend nativo 4-5s/chamada até ~3min; Veo "Frames-to-Video"). Nossa implementação é modelo-agnóstica (funciona com qualquer img2video); onde existir extend nativo, oferecer como opção.
- **Aviso de degradação**: qualidade consistente até ~30s; degrada após ~60s de extends — a UI avisa a partir do 6º encadeamento.
- **Áudio**: chaining não preserva áudio entre clipes — trilha/voz entram no Nó Montagem (ffmpeg), nunca na geração.
- Extração de último frame: server-side (ffmpeg), salvo como Asset interno do FlowRun.
- Consistência entre clipes: prompt de continuação herda descrição de estilo/personagem do nó anterior (campo "contexto de cena" propagado pela aresta) — técnica validada na pesquisa P2.
- Falha num clipe do meio: fluxo pausa naquele nó; usuário pode retry só do nó (não paga tudo de novo).
- Modelos e durações máximas por modelo: tabela vinda de P1/P2.

## Dependências
Módulo 01 (imagens/assets), motor de fluxos (03), ffmpeg no servidor (ou fal.ai ffmpeg endpoint — decidir em P2).
