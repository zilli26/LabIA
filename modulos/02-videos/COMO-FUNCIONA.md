# 02-Vídeos — Como funciona

## Fluxo do usuário: vídeo contínuo de 30s+

1. Gera/escolhe a imagem inicial (módulo 01) — ex.: frame de abertura da campanha.
2. Conecta a um **Nó Img2Video**: prompt de movimento ("câmera orbita o produto..."), provider, conexão, modelo e duração do clipe (5–10s). No caminho legado atual, provider/conexão ainda estão implícitos na fal.ai até a etapa pós-O1.
3. Conecta a saída a um **Nó Extend**: o sistema extrai o último frame do clipe anterior e usa como primeira imagem do próximo, com novo prompt de continuação.
4. Repete Extend quantas vezes precisar (4 clipes de 8s ≈ 32s).
5. Todos desembocam num **Nó Montagem** → MP4 único.
6. Antes de executar: o fluxo mostra custo total estimado ("este vídeo custará ~R$X"). Depois: custo real por clipe e total.

## Conexão e capability

O1 adiciona uma tela separada de conexões. Uma conta ChatGPT conectada não aparece automaticamente como rota de vídeo: a capability precisa ser comprovada e associada à conexão/modelo. `Conta conectada`, `capacidade disponível` e `geração real validada` são estados distintos.

## Regras de negócio

- **Validado na P2**: frame-chaining é o padrão do mercado (Kling extend nativo 4-5s/chamada até ~3min; Veo "Frames-to-Video"). Nossa implementação é modelo-agnóstica (funciona com qualquer img2video); onde existir extend nativo, oferecer como opção.
- **Aviso de degradação**: qualidade consistente até ~30s; degrada após ~60s de extends — a UI avisa a partir do 6º encadeamento.
- **Áudio**: modelos com áudio nativo (Veo 3, Wan 2.5 — confirmar na tarefa 0) geram som por clipe, mas o chaining NÃO preserva áudio contínuo entre clipes (P2). Continuidade sonora vem da trilha/voz no Nó Montagem (ffmpeg), e a direção dos cortes segue o áudio: emendas entre clipes planejadas para cair em beats/pausas da trilha (ver `TECNICAS.md`).
- Extração de último frame: server-side (ffmpeg), salvo como Asset interno do FlowRun.
- Consistência entre clipes: prompt de continuação herda descrição de estilo/personagem do nó anterior (campo "contexto de cena" propagado pela aresta) — técnica validada na pesquisa P2.
- Falha num clipe do meio: fluxo pausa naquele nó; retry só pode reenviar o nó quando a submissão anterior foi reconciliada, para evitar custo duplicado.
- Modelos e durações máximas por modelo: catálogo por provider/conexão/capability.
- Não existe provider principal. fal.ai permanece uma opção normal.
- Fallback para API paga exige nova cotação e aprovação; não é implícito.

## Dependências
Módulo 01 (imagens/assets), motor de fluxos (03), ffmpeg no servidor e contratos de `ProviderConnection`/capabilities para a etapa pós-O1.
