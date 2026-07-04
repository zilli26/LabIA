# Fontes da tarefa 0 - catálogo fal.ai de vídeo

Data de acesso: 2026-07-04.

Regra aplicada: pesquisa 100% documental em páginas públicas da fal.ai. Nenhuma chamada de API, fila, worker, smoke test ou geração real foi executada.

## Wan 2.5 Preview (Alibaba)

- Docs text-to-video: https://fal.ai/models/fal-ai/wan-25-preview/text-to-video
- API text-to-video: https://fal.ai/models/fal-ai/wan-25-preview/text-to-video/api
- Docs image-to-video: https://fal.ai/models/fal-ai/wan-25-preview/image-to-video
- API image-to-video: https://fal.ai/models/fal-ai/wan-25-preview/image-to-video/api

Notas antes de preencher:

- Encontrei páginas específicas para `fal-ai/wan-25-preview/text-to-video` e `fal-ai/wan-25-preview/image-to-video`.
- O preço é por segundo: US$0.05/s em 480p, US$0.10/s em 720p, US$0.15/s em 1080p.
- O modelo tem text-to-video e image-to-video separados; usei image-to-video como endpoint canônico do catálogo porque o primeiro nó de vídeo da E2 é img2video.
- Durações suportadas: 5s ou 10s.
- Áudio: a doc expõe `audio_url` como áudio de entrada/background music, truncado conforme a duração do vídeo. Não encontrei geração nativa de áudio pelo modelo.
- Extend nativo: não encontrado nas docs públicas da fal.ai.

## Kling 2.5 Turbo Pro (Kuaishou)

- Docs text-to-video: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/text-to-video
- API text-to-video: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/text-to-video/api
- Docs image-to-video: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video
- API image-to-video: https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video/api

Notas antes de preencher:

- Encontrei páginas específicas para `fal-ai/kling-video/v2.5-turbo/pro/text-to-video` e `fal-ai/kling-video/v2.5-turbo/pro/image-to-video`.
- O preço público é por clipe/regra incremental: US$0.35 para 5s e US$0.07 por segundo adicional. Para 10s, o catálogo registra US$0.70 calculado a partir dessa regra pública.
- Usei a variante `v2.5-turbo/pro` porque é a página pública da fal.ai para Kling 2.5.
- Durações suportadas encontradas no schema do endpoint v2.5: 5s ou 10s.
- Áudio: não encontrei `generate_audio` nem `audio_url` no endpoint geral de Kling 2.5 Turbo Pro. A doc mostra campos de áudio em tipos auxiliares/avatares, mas não como áudio nativo do endpoint geral catalogado.
- Extend nativo: P2 cita extend do Kling fora da fal.ai, mas não encontrei endpoint/parâmetro de extend nativo para v2.5 nas docs públicas da fal.ai.

## MiniMax Hailuo 2.3

- Docs Standard text-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/standard/text-to-video
- API Standard text-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/standard/text-to-video/api
- Docs Standard image-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/standard/image-to-video
- API Standard image-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/standard/image-to-video/api
- Docs Pro text-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/pro/text-to-video
- API Pro text-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/pro/text-to-video/api
- Docs Pro image-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/pro/image-to-video
- API Pro image-to-video: https://fal.ai/models/fal-ai/minimax/hailuo-2.3/pro/image-to-video/api

Notas antes de preencher:

- Encontrei páginas Standard e Pro, ambas com text-to-video e image-to-video.
- Usei `fal-ai/minimax/hailuo-2.3/standard/image-to-video` como endpoint canônico porque a variante Standard expunha duração 6s/10s e preço por duração de forma clara.
- Preço Standard: US$0.28 por 6s e US$0.56 por 10s. Variante Pro: US$0.49 por geração.
- Lacuna: na variante Pro, a página pública informa US$0.49/geração, mas o schema público que li não deixou a duração explícita; por isso não converti para US$/s.
- Áudio: os exemplos Pro incluem uma linha `Audio:` dentro do prompt, mas não encontrei `generate_audio`, `audio_url` nem declaração explícita de áudio nativo para o endpoint de vídeo. Mantive como lacuna, não como fato.
- Extend nativo: não encontrado nas docs públicas da fal.ai.

## Seedance 2.0 (ByteDance)

- Docs text-to-video: https://fal.ai/models/bytedance/seedance-2.0/text-to-video
- Docs image-to-video: https://fal.ai/models/bytedance/seedance-2.0/image-to-video
- Docs reference-to-video: https://fal.ai/models/bytedance/seedance-2.0/reference-to-video
- Docs fast text-to-video: https://fal.ai/models/bytedance/seedance-2.0/fast/text-to-video
- Docs fast image-to-video: https://fal.ai/models/bytedance/seedance-2.0/fast/image-to-video
- Docs fast reference-to-video: https://fal.ai/models/bytedance/seedance-2.0/fast/reference-to-video

Notas antes de preencher:

- Encontrei páginas específicas para text-to-video, image-to-video e reference-to-video.
- O preço principal é por segundo. A página text-to-video/overview lista 720p com áudio a US$0.3034/s, 720p fast com áudio a US$0.2419/s e 1080p com áudio a US$0.682/s.
- Conflito: a página image-to-video lista Standard a US$0.3024/s, enquanto a página text-to-video/overview lista US$0.3034/s. Registrei os dois e usei o maior valor no `pricing.unitPriceUsd`.
- Durações suportadas: `auto` ou inteiro de 4 a 15 segundos.
- Áudio: suportado nativamente; `generate_audio` defaulta para true. A página image-to-video diz que o áudio está incluído sem custo extra independente de `generate_audio`.
- Extend nativo: a doc descreve "Video editing and extension" via reference-to-video, fornecendo vídeo de referência e descrevendo o que deve acontecer a seguir.

## Veo 3 (Google)

- Docs text-to-video: https://fal.ai/models/fal-ai/veo3
- API text-to-video: https://fal.ai/models/fal-ai/veo3/api
- Docs image-to-video: https://fal.ai/models/fal-ai/veo3/image-to-video
- API image-to-video: https://fal.ai/models/fal-ai/veo3/image-to-video/api
- Docs Veo 3 Fast consultada para conflito de preço: https://fal.ai/models/fal-ai/veo3/fast

Notas antes de preencher:

- Encontrei páginas específicas para `fal-ai/veo3` e `fal-ai/veo3/image-to-video`.
- O preço exibido no endpoint é por segundo: US$0.20/s com áudio off e US$0.40/s com áudio on.
- Conflito: o Readme da mesma página informa "Standard Veo 3" a US$0.50/s sem áudio ou US$0.75/s com áudio e "Veo 3 Fast" a US$0.25/s sem áudio ou US$0.40/s com áudio. Registrei o conflito no catálogo e no mapa de provedores.
- Durações suportadas no schema API: 4s, 6s ou 8s. A descrição "About" fala 5-8s; usei o enum do schema como dado operacional.
- Áudio: suportado nativamente via `generate_audio`, default true, gerado junto com o vídeo.
- Extend nativo: P2 cita caminhos fora da fal.ai, mas não encontrei endpoint/parâmetro de extend nativo nas docs públicas da fal.ai para Veo 3.

## Revisão independente (Claude, 2026-07-04)

Checagem por segunda leitura das 5 páginas canônicas (WebFetch), sem chamada de API:

- **Confirmados batendo exatamente:** Wan 2.5 (US$0.05/0.10/0.15 por s conforme resolução; só `audio_url` de entrada, sem geração nativa de áudio), Kling 2.5 Turbo Pro (US$0.35/5s + US$0.07/s adicional; sem áudio nativo na página), Veo 3 (US$0.20/s sem áudio, US$0.40/s com), Hailuo 2.3 Standard (US$0.28/6s, US$0.56/10s; sem menção a áudio nativo), Seedance durações (auto ou 4–15s) e áudio incluído sem custo extra.
- **Incerteza adicional (Seedance 1080p):** a releitura da página image-to-video viu Standard a US$0.3024/s e não confirmou o valor de US$0.682/s para 1080p (a página lida na revisão sugeria 1080p também a US$0.3024/s, possivelmente por leitura parcial da tabela de tiers). O conflito de 0.3024 vs 0.3034 já estava registrado; o preço de 1080p do Seedance deve ser reconfirmado na tarefa 1 antes de entrar no `estimateCost`.
