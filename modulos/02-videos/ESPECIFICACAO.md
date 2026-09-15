# 02-Vídeos — Especificação

## Adendo interoperabilidade — 2026-09-13, O2 preservado e O3 oficial implementado para imagem

O [contrato de providers por nó](../../docs/OAUTH-OPENAI-ESPECIFICACAO.md) acrescenta Provider/Conexão/Modelo aos nós gerativos, Assets vindos de qualquer provider, resolução dinâmica e proteção contra submit duplicado. Montagem continua processamento LabIA. Seedance via fal.ai é modelo dessa conexão; integração Seedance direta será identificada e validada separadamente. Detalhes técnicos aguardam aprovação; a autorização anterior da E2 permanece restrita ao contrato anterior.

**Etapa:** E2 · **Dor que resolve:** vídeos IA limitados a ~8s; planos caros (Higgsfield/Pika); pipeline manual no Google Flow.
**Revisada:** 2026-09-14 (Bloco 0, contrato Projeto-first aprovado pelo Felipe).

## Contrato Projeto-first e papéis de entrada

O `Project` é o contêiner do trabalho e o `Asset` importado é uma entrada persistida, reutilizável e vinculada ao Projeto. Importar uma imagem-base não gera imagem: o arquivo pode alimentar diretamente o nó de img2video (**Animar imagem**) como primeiro frame do clipe. Upload, seleção ou troca de Asset não enfileira `Generation`, não chama worker/provider e não produz custo de IA.

Os papéis são distintos e não podem ser inferidos entre si:

- **Imagem-base:** Asset de imagem escolhido explicitamente para ser o primeiro frame de **Animar imagem**.
- **Referência visual:** Asset que orienta direção ou modelo somente quando o fluxo fizer uma seleção explícita e o provider declarar suporte. Referência visual não é automaticamente primeiro frame e não substitui a imagem-base.
- **Resultado:** Asset produzido pelo Flow, com procedência e vínculo ao Projeto preservados.

O template **Produto importado → Vídeo curto** começa com uma imagem-base importada e não contém geração de imagem. Gerar uma imagem nova é uma alternativa explícita, nunca uma etapa implícita do template.

## Princípio do catálogo

O valor do LabIA é **comparar modelos** (chineses e ocidentais) em preço × qualidade, não escolher um "vencedor" de antemão. Todos os modelos de vídeo viáveis via fal.ai entram no select com preço visível — estar no catálogo custa R$0. O gate de gasto é a aprovação explícita do Felipe antes de QUALQUER geração, nunca a remoção do modelo.

### Catálogo alvo (preços de P1/P2 em 2026-07-02, câmbio 5,40 — confirmar tudo na tarefa 0)

| Modelo | Origem | Custo ref. | Áudio nativo | Observação |
|---|---|---|---|---|
| Wan 2.5 | Alibaba (CN) | ~R$1,35/5s | sim (confirmar) | candidato a default barato |
| Kling 2.5 | Kuaishou (CN) | ~R$1,90/5s | confirmar | tem extend nativo (fora da 1ª entrega; frame-chaining cobre) |
| Hailuo / MiniMax | MiniMax (CN) | confirmar | confirmar | lacuna da P2 |
| Seedance | ByteDance (CN) | ~US$0,045/s via EvoLink; via fal.ai confirmar | confirmar | lacuna da P2 |
| Veo 3 | Google (US) | ~R$10,80/5s | sim | premium; uso pontual, mas NO catálogo |

## Nós do canvas e nomes públicos

Os nomes públicos descrevem o resultado e preservam os tipos internos e os flows salvos:

| Nome público | Tipo interno | Contrato |
|---|---|---|
| **Animar imagem** | `video-generation` | img2video a partir de uma imagem-base escolhida explicitamente (importada ou produzida por geração), com prompt de movimento, modelo, duração e áudio quando suportado. |
| **Continuar clipe** | `video-extend` | recebe o resultado de uma `Generation` de vídeo upstream concluída, extrai seu último frame e gera o próximo clipe via img2video. Não estende MP4 importado. |
| **Juntar clipes** | `video-assembly` | recebe dois ou mais clipes, concatena na ordem esquerda→direita e pode mixar trilha/voz. Não chama IA nem cria `Generation`; o custo de processamento é R$0. |

O nó `Text2Video` continua sendo geração direta de texto para os modelos que suportam bem, sem entrada de imagem. Todo nó de geração exibe custo estimado antes da execução e custo real depois; nenhuma geração é enfileirada sem aprovação explícita do Felipe para aquela geração.

**Juntar clipes** só é válido com 2 ou mais clipes. Seu MP4 final é um `Asset` do tipo vídeo e deve pertencer ao mesmo Projeto do Flow, resolvido por `FlowRun → Flow → Project`; não basta existir como arquivo no Storage.

## Expertise é entregável da etapa

Não basta o fluxo funcionar: a E2 tem que nos deixar **experts na técnica**. `TECNICAS.md` (neste módulo) é documento vivo: direção de cortes com áudio (o áudio manda no corte — emendas de clipe caem em beats/pausas da trilha), consistência entre clipes, prompts de movimento por modelo, e **receitas replicáveis** (tutoriais passo a passo de cada tipo de vídeo dominado). Toda geração real paga registra prompt/custo/resultado/aprendizado no log de experimentos — o real gasto compra o vídeo E o conhecimento.

## Regras de produto

1. **Custo de vídeo é ALTO e variável** → estimativa antes de rodar é obrigatória no nó E no fluxo inteiro. Fluxo contendo nó de vídeo exige **modal de confirmação com o custo total em R$ antes de enfileirar** (não só o chip informativo da E1).
2. **Áudio é parte do vídeo, não acessório**: modelos com áudio nativo expõem o toggle; **Juntar clipes** sempre oferece trilha/voz. Frame-chaining não preserva áudio contínuo entre clipes (P2) — a continuidade sonora vem da trilha na montagem.
3. Geração é lenta (30s–5min) → status por nó em tempo real; fluxo continua rodando com usuário fora da página.
4. Todo clipe intermediário vira Asset (reaproveitável, retry barato); o frame técnico extraído por **Continuar clipe** é apenas artefato intermediário e não vira Asset de biblioteca.
5. Falha num clipe do meio: fluxo pausa naquele nó; retry re-executa só ele (clipes anteriores já são Assets, não paga de novo).
6. **Nenhuma geração real sem aprovação explícita do Felipe, com custo em R$ declarado antes. Aprovação de uma geração não vale para a próxima.**

## Fora de escopo (documentado, sem sumir)

- Edição fina de vídeo (cortes, legendas) — backlog/ferramenta externa
- Avatares/lip-sync — backlog
- TTS/narração gerada — nasce como nó na E3 (copy/voz de marca)
- Extend nativo por modelo (Kling/Veo) como alternativa ao frame-chaining — evolução após 1ª validação
- Direção automática de cena (AI Video Director) — módulo 03
- Benchmark formal de consistência entre modelos (lacuna P2) — rodar quando houver orçamento aprovado para isso
