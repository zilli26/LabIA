# 02-Vídeos — Especificação

**Etapa:** E2 · **Dor que resolve:** vídeos IA limitados a ~8s; planos caros (Higgsfield/Pika); pipeline manual no Google Flow.
**Revisada:** 2026-07-03 (sessão de abertura da E2, aprovação Felipe pendente).

> **Adendo aprovado em 2026-09-11 — provider por nó:** não existe provider principal do LabIA. Cada nó gerativo deve resolver **Provider → Conexão → Modelo**. A fal.ai continua disponível normalmente. O caminho E2 abaixo descreve a implementação histórica via fal.ai e continua válido até a etapa de parametrização por conexão. Login de uma conta não prova capability de vídeo nem autoriza geração.

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

## Nós do canvas

- **Nó Gerar Vídeo (img2video)** — recebe imagem (saída de nó de imagem ou asset da biblioteca) + prompt de movimento; params: modelo (select com preço), duração do clipe (conforme suportado pelo modelo, 5–10s), toggle "com áudio" nos modelos que suportam (custo pode diferir — tarefa 0 confirma). Chip de custo estimado ANTES. Clipe vira Asset.
- **Nó Estender Vídeo (extend)** — recebe um clipe, extrai o último frame (ffmpeg server-side) e gera o próximo clipe via img2video com prompt de continuação. Implementação **modelo-agnóstica por frame-chaining** (validada na P2); extend nativo por modelo é evolução futura. Propaga "contexto de cena" pela aresta (re-declarar personagem/luz/câmera/estilo — regra P2). UI avisa degradação a partir do 6º encadeamento (>~60s).
- **Nó Text2Video** — geração direta de texto para os modelos que suportam bem. Mesmo padrão do Gerar Vídeo, sem entrada de imagem.
- **Nó Montagem** — concatena clipes na ordem das conexões (ffmpeg concat) e cuida do SONORO do vídeo final: mantém o áudio nativo dos clipes (com cortes nas emendas — limitação da técnica, ver P2) e/ou trilha/voz enviada por upload, mixada por cima cobrindo o vídeo inteiro (ffmpeg amix/volume). Exporta MP4 único como Asset.

## Expertise é entregável da etapa

Não basta o fluxo funcionar: a E2 tem que nos deixar **experts na técnica**. `TECNICAS.md` (neste módulo) é documento vivo: direção de cortes com áudio (o áudio manda no corte — emendas de clipe caem em beats/pausas da trilha), consistência entre clipes, prompts de movimento por modelo, e **receitas replicáveis** (tutoriais passo a passo de cada tipo de vídeo dominado). Toda geração real paga registra prompt/custo/resultado/aprendizado no log de experimentos — o real gasto compra o vídeo E o conhecimento.

## Regras de produto

1. **Custo de vídeo é ALTO e variável** → estimativa antes de rodar é obrigatória no nó E no fluxo inteiro. Fluxo contendo nó de vídeo exige **modal de confirmação com o custo total em R$ antes de enfileirar** (não só o chip informativo da E1).
2. **Áudio é parte do vídeo, não acessório**: modelos com áudio nativo expõem o toggle; a Montagem sempre oferece trilha/voz. Frame-chaining não preserva áudio contínuo entre clipes (P2) — a continuidade sonora vem da trilha na Montagem.
3. Geração é lenta (30s–5min) → status por nó em tempo real; fluxo continua rodando com usuário fora da página.
4. Todo clipe intermediário vira Asset (reaproveitável, retry barato).
5. Falha num clipe do meio: fluxo pausa naquele nó; retry re-executa só ele (clipes anteriores já são Assets, não paga de novo).
6. **Nenhuma geração real sem aprovação explícita do Felipe, com custo em R$ declarado antes. Aprovação de uma geração não vale para a próxima.**
7. **Arquitetura aprovada de seleção:** cada nó gerativo terá `Provider → Conexão → Modelo`; capability da conexão precisa ser verificada separadamente do login.
8. **Fallback de conexão pessoal para API paga não é automático.** Requer nova cotação e autorização explícita.

## O1 — conexão ChatGPT local

O1 implementa apenas autenticação/conexão OpenAI/ChatGPT por executor local separado. Não altera `video.generate`, não adiciona modelo OpenAI de vídeo, não marca capability de vídeo e não executa geração. Referências: `docs/O1-OPENAI-CHATGPT-CONNECTION.md` e `docs/adr/0002-provider-per-node-and-o1-chatgpt-connection.md`.

## Fora de escopo (documentado, sem sumir)

- Edição fina de vídeo (cortes, legendas) — backlog/ferramenta externa
- Avatares/lip-sync — backlog
- TTS/narração gerada — nasce como nó na E3 (copy/voz de marca)
- Extend nativo por modelo (Kling/Veo) como alternativa ao frame-chaining — evolução após 1ª validação
- Direção automática de cena (AI Video Director) — módulo 03
- Benchmark formal de consistência entre modelos (lacuna P2) — rodar quando houver orçamento aprovado para isso
