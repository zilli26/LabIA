# 02-Vídeos — Especificação

**Etapa:** E2 · **Dor que resolve:** vídeos IA limitados a ~8s; planos caros (Higgsfield/Pika); pipeline manual no Google Flow.
**Revisada:** 2026-09-11 (arquitetura de provider por nó aprovada; O1 não altera geração de vídeo).

## Princípio do catálogo

O valor do LabIA é **comparar modelos** (chineses e ocidentais) em preço × qualidade, não escolher um "vencedor" de antemão. **Não existe provider principal.** Cada nó gerativo resolve explicitamente **Provider → Conexão → Modelo**. A fal.ai continua disponível normalmente e o catálogo legado via fal.ai permanece funcional até a etapa que parametrizar os nós por conexão.

O gate de gasto é a aprovação explícita do Felipe antes de QUALQUER geração, nunca a remoção do modelo. Login de uma conta não prova capacidade de vídeo e nunca autoriza geração por si só.

### Catálogo alvo histórico (preços de P1/P2 em 2026-07-02, câmbio 5,40 — revalidar antes de usar)

| Modelo | Origem | Custo ref. | Áudio nativo | Observação |
|---|---|---|---|---|
| Wan 2.5 | Alibaba (CN) | ~R$1,35/5s | sim (confirmar) | candidato barato histórico |
| Kling 2.5 | Kuaishou (CN) | ~R$1,90/5s | confirmar | tem extend nativo fora da 1ª entrega |
| Hailuo / MiniMax | MiniMax (CN) | confirmar | confirmar | lacuna da P2 |
| Seedance | ByteDance (CN) | ~US$0,045/s via EvoLink; via fal.ai confirmar | confirmar | lacuna da P2 |
| Veo 3 | Google (US) | ~R$10,80/5s | sim | premium histórico |

## Nós do canvas

- **Nó Gerar Vídeo (img2video)** — recebe imagem (saída de nó de imagem ou asset da biblioteca) + prompt de movimento; params: provider, conexão, modelo, duração do clipe e toggle de áudio quando suportado. Chip de custo estimado ANTES. Clipe vira Asset.
- **Nó Estender Vídeo (extend)** — recebe um clipe, extrai o último frame (ffmpeg server-side) e gera o próximo clipe via img2video com prompt de continuação. Implementação modelo-agnóstica por frame-chaining; extend nativo por modelo é evolução futura. Propaga contexto de cena pela aresta. UI avisa degradação a partir do 6º encadeamento.
- **Nó Text2Video** — geração direta de texto para os modelos/capacidades comprovados. Mesmo padrão do Gerar Vídeo, sem entrada de imagem.
- **Nó Montagem** — concatena clipes na ordem das conexões e cuida do sonoro do vídeo final; processamento local, sem provider gerativo.

## Expertise é entregável da etapa

Não basta o fluxo funcionar: a E2 tem que nos deixar **experts na técnica**. `TECNICAS.md` é documento vivo: direção de cortes com áudio, consistência entre clipes, prompts por modelo e receitas replicáveis. Toda geração real paga registra prompt/custo/resultado/aprendizado.

## Regras de produto

1. **Custo de vídeo é alto e variável** → estimativa antes de rodar é obrigatória no nó e no fluxo inteiro; fluxo com vídeo pago exige modal de confirmação.
2. **Áudio é parte do vídeo, não acessório**: modelos com áudio nativo expõem o toggle; a Montagem oferece trilha/voz.
3. Geração é lenta → status por nó em tempo real; fluxo continua com usuário fora da página.
4. Todo clipe intermediário vira Asset.
5. Falha num clipe do meio: retry deve re-executar só ele; idempotência precisa impedir reenvio de geração já submetida.
6. **Nenhuma geração real sem aprovação explícita do Felipe, com custo em R$ declarado antes. Aprovação de uma geração não vale para a próxima.**
7. **Conexão, capability e geração validada são estados independentes.** O1 pode conectar ChatGPT sem adicionar nenhum modelo de vídeo ao catálogo.
8. **Fallback de conexão pessoal para API paga nunca é automático.** Exige nova estimativa e nova autorização.

## O1 — conexão ChatGPT local

O1 implementa autenticação/conexão OpenAI/ChatGPT fora do worker. Não altera `video.generate`, não liga OpenAI a vídeo e não comprova qualquer capacidade de vídeo. A fal.ai segue normal no caminho já implementado.

Referências: `docs/O1-OPENAI-CHATGPT-CONNECTION.md` e `docs/adr/0002-provider-per-node-and-o1-chatgpt-connection.md`.

## Fora de escopo

- Edição fina de vídeo (cortes, legendas) — backlog/ferramenta externa
- Avatares/lip-sync — backlog
- TTS/narração gerada — E3
- Extend nativo por modelo como alternativa ao frame-chaining
- Direção automática de cena — módulo 03
- Benchmark formal de consistência entre modelos
