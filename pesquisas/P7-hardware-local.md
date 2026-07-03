# P7 — Rodar local: estudo de hardware (GPU)

**Data:** 2026-07-02 · **Passadas:** 2

## Veredito

**Imagem local: viável e barata. Vídeo local: NÃO viável em GPU de consumidor** — os modelos de vídeo abertos de qualidade (Wan 14B 720p, HunyuanVideo) exigem 40-80GB de VRAM (H100/datacenter). Para vídeo, o caminho é API (fal.ai) ou GPU alugada por hora (RunPod). Recomendação: **adiar compra de máquina**; se a conta de imagem via API crescer, reavaliar com os dados reais do CreditLedger.

## Imagem local (funciona)

| Modelo | VRAM mínima | Confortável | GPU |
|---|---|---|---|
| SDXL | 8GB | 12-16GB | RTX 3060/4060 já roda |
| FLUX.1 dev (quantizado GGUF Q4/Q5) | 8GB | 12GB | RTX 3060/4060 |
| FLUX.1 dev FP16 pleno | 24GB | 24GB | RTX 4090 (10-18s por imagem 1024²) |

- Requisitos de sistema (ComfyUI): 32GB RAM (64GB c/ offload), ~60GB disco, fonte com folga (4090/5090 = 450-575W).
- Energia: ~US$0,0004/imagem (30x mais barato que API) — mas o hardware custa caro na frente.

## Vídeo local (não passa)

- Wan 14B @ 480p: 16-24GB (borderline numa 4090) · @ 720p: 40-80GB → só datacenter.
- HunyuanVideo @ 720p: 60-80GB → só H100+. Em 4090 (24GB) e até 5090 (32GB): não roda nas qualidades úteis. (Existem versões ultra-quantizadas p/ 10-12GB, qualidade/velocidade ruins p/ produção.)
- H100 aluga a ~US$2-3/h; 5s de vídeo levam 10-12min → ~US$0,50/clipe, comparável à API sem a dor de infra.

## Break-even (imagem)

- GPU ~US$1.600 (4090 usada/5080) se paga vs. nuvem só após **~130.000 imagens**, ou 6-8 meses gerando 8h/dia.
- Uso realista de social media (centenas de imagens/mês): **API vence com folga**. FLUX schnell na Replicate = $0.003/img → 10.000 imagens = US$30.
- GPU nuvem por hora (quando fizer sentido experimentar local): RTX 3090 US$0.22-0.50/h, 4090 ~US$0.74/h, 5090 US$0.75-0.90/h no RunPod — bom para testar ComfyUI sem comprar nada.

## Recomendações práticas

1. **Não comprar máquina agora.** Backend `local-comfy` do ModelProvider fica especificado mas não implementado.
2. Se quiser brincar com ComfyUI: RunPod por hora (US$0.30-0.75/h) — zero investimento.
3. Reavaliar em 6 meses: modelos de vídeo abertos estão encolhendo requisitos rápido.
4. Gatilho de reavaliação: quando o CreditLedger mostrar >R$300/mês só de IMAGEM, o local passa a competir.

## Fontes

- https://jarvislabs.ai/ai-faqs/best-gpu-for-flux · https://localaimaster.com/blog/flux-local-image-generation
- https://www.spheron.network/blog/gpu-cloud-video-ai-2026/ · https://willitrunai.com/blog/video-generation-gpu-guide-2026
- https://www.spheron.network/blog/comfyui-gpu-cloud-2026/ · https://valebyte.com/en/guides/comfyui-stable-diffusion-on-cloud-gpus-the-ultimate-guide/
- https://www.runpod.io/articles/guides/comfyui-wan-2-2 · https://stablediffusionxl.com/sdxl-system-requirements/
