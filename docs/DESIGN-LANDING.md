# LabIA — Landing "A Descida" — PLANO V2 (cinematográfico)

> Status: **V2 — plano ativo (2026-07-04).** A v1 (árvore SVG procedural) foi REPROVADA no checkpoint do Felipe: ficou esquemática, "diagrama de metrô", zero cinema. Este documento é o plano completo da v2 e é AUTO-SUFICIENTE: qualquer executor (Claude, Antigravity, Codex) constrói lendo só isto + `docs/DESIGN-SYSTEM.md` (tokens).
> Aprovado como direção pelo Felipe em 2026-07-04 ("quero algo cinematográfico, o efeito da Apple").

---

## 0. Por que a v1 falhou (não repetir o erro)

| O que a Apple faz (Vision Pro / AirPods) | O que a v1 fez (errado) |
|---|---|
| Cena RENDERIZADA (3D/foto) com luz volumétrica real | Linhas bezier desenhadas em código (SVG stroke) |
| Scroll "esfrega" frames de um take de câmera num `<canvas>` | Árvore estática num slot |
| Asset produzido por render, código só reproduz | Código tentou SER o asset |

**Lei da v2:** cinematográfico = RENDER + movimento de câmera + luz. SVG/CSS nunca é o palco — é no máximo camada de overlay interativo. Qualquer proposta de "desenhar a árvore em código" está automaticamente rejeitada.

## 1. O conceito (uma frase)

**A landing é um take contínuo de câmera descendo por uma árvore bioluminescente — da copa (o resultado) às raízes (o método) — dirigido pelo scroll do usuário, renderizado pelo PRÓPRIO pipeline de geração do LabIA, com o custo real da produção exibido na tela.**

O meta-argumento de marketing: "esta página foi gerada por um fluxo do LabIA e custou R$ X — custo na cara, como tudo aqui". Nenhum concorrente copia isso sem expor os créditos opacos deles.

## 2. A cena (direção de arte do asset renderizado)

Um take único, vertical, câmera em tilt-down + dolly lento, ~3 atos:

1. **Copa (0–30%):** árvore-rede de filamentos de fibra ótica no escuro de laboratório (fundo `#0A0B0E`). "Frutos" de luz nas 4 cores dos tipos de nó — âmbar `#FFC46B` (copy), violeta `#8B7CFF` (imagem), ciano `#4DD8FF` (vídeo), verde `#5EE38B` (publicação). Névoa fina, profundidade de campo rasa.
2. **Tronco (30–60%):** mergulho pelo tronco translúcido — pulsos de seiva esmeralda `#10B981` correndo por dentro (raros, vivos — esmeralda é RARO).
3. **Raízes (60–100%):** o solo é translúcido; raízes se abrem como rede neural/micélio, cada raiz-mãe brilhando na cor de um tipo, pontos ativos com vagalumes, tudo dissolvendo no breu.

**Prompt-base** (refinar com a skill `pipeline-image-generation` / `thumbnail-prompt-visual`):

```
cinematic macro shot, a bioluminescent tree made of glowing fiber-optic
filaments in a dark laboratory void (#0A0B0E background), camera slowly
descending from the canopy down through a translucent trunk into a vast
glowing root network resembling neural mycelium, emerald light pulses
flowing inside the trunk, small node lights in amber, violet, cyan and
green, volumetric fog, shallow depth of field, fireflies, no foliage,
no leaves, elegant, dark, precise, 4K, vertical composition
```

Negativos/override: sem folhas realistas, sem floresta, sem cogumelo, sem neon cyberpunk saturado, sem verde-ácido tipo Krea.

## 3. Produção do asset (via fal.ai — o próprio produto)

Duas rotas, decidir pelo resultado do primeiro teste:

- **Rota A — vídeo direto (preferida):** 1 take text2video ou img2video (Wan 2.5 ~R$1,35–4,05/take; Kling como alternativa) com instrução de câmera "slow tilt down / descending dolly". Estimar 3–5 takes de iteração até acertar. Total estimado: **R$5–20**.
- **Rota B — keyframes + interpolação:** 5–7 stills FLUX (~R$0,14 cada, ~R$1 total) da mesma cena em alturas diferentes + img2video curto entre keyframes para o movimento.

Pós-produção (local, custo R$0 — `lib/video/ffmpeg-service.ts` já existe no repo):
- Extrair **80–120 frames** do take: `ffmpeg -i take.mp4 -vf "fps=24,scale=1440:-2" frames/f_%03d.webp` (WebP q~70, alvo 40–80KB/frame; gerar também set mobile 720px com metade dos frames).
- Primeiro frame vira **poster** (AVIF/WebP de alta qualidade) — é o LCP.

**REGRA DE CUSTO (inegociável, do CLAUDE.md):** nenhuma geração roda sem ok explícito do Felipe com custo em R$ declarado ANTES. O custo real total das gerações vai pro hero como chip (`gerado por um fluxo LabIA · R$ X,XX`).

## 4. A mecânica scroll-scrub (a técnica exata da Apple)

- **Hero:** `<section>` wrapper de **300vh** (200vh mobile) com filho `position: sticky; top: 56px` (o header global é sticky z-40 h-14 — landing fica ≤ z-30).
- Dentro do sticky: `<canvas>` full-viewport + camada de overlay HTML.
- **Scrub:** progresso do scroll no wrapper (0→1) mapeia para o índice do frame; um único listener passivo/rAF: `ctx.drawImage(frames[Math.round(p * (N-1))])`. Scroll para baixo = câmera desce; para cima = volta. O usuário dirige a câmera.
- **Loading:** poster `<img>` renderiza imediatamente (LCP); frames pré-carregados em background com `fetchpriority` decrescente; canvas assume quando ≥30% dos frames chegaram, senão segue no poster.
- **Fallbacks:** sem JS → poster + textos (tudo SSR); `prefers-reduced-motion` → poster estático, zero scrub; mobile → set 720px/50 frames; Safari/iOS → testar `drawImage` com WebP (fallback JPEG se preciso).
- **Overlay vivo por cima do canvas (HTML/SVG, aqui SIM):** wordmark, promessa, CTA, chips de custo em JetBrains Mono, labels dos módulos que acendem em sincronia com o progresso (mesmos breakpoints do scrub), vagalumes CSS discretos. Cinema atrás, produto na frente.

## 5. Narrativa (6 beats — mantida da v1, agora sobre o take)

| Beat | Momento | O que aparece |
|---|---|---|
| B0 | scrub 0–10% | copa + wordmark + promessa + CTA. "Isto é vivo." |
| B1 | scrub 10–35% | descida pelo tronco; micro-copy "todo resultado nasce de um fluxo" |
| B2 | scrub 35–70% | raízes se abrem; labels dos 4 módulos acendem nas suas cores |
| B3 | scrub 70–100% + seção seguinte | pulso de seiva; chip `~R$0,43` acende; copy do custo visível |
| B4 | seção normal (pós-hero) | loop métrica→aprendizado→pauta — marcado VISÃO/FUTURO |
| B5 | seção normal | CTA "criar seu primeiro fluxo" → `#painel` |

B4/B5 + painel continuam seções leves com reveal por IntersectionObserver (trabalho da F1 que PERMANECE). Skip button "Pular para o painel" fixo, âncora nativa.

## 6. O que fica da F1 / o que morre

- **FICA:** `app/page.tsx` recomposto, `components/landing/beat-section.tsx`, `landing-narrative.tsx` (estrutura e copy), `components/home/painel-section.tsx`, `lib/format.ts`, `app/landing.css`, skip button, 125 testes.
- **MORRE:** `components/landing/tree-scene.tsx`, `tree-paths.ts`, `scripts/dev/gen-tree-paths.ts`, `app/landing-tree.css`, `tests/landing/tree-paths.test.ts` — deletar quando o hero v2 entrar (ou antes, se o Felipe quiser a árvore feia fora do ar já).

## 7. Fases da v2

- **V2-F0 — Asset (bloqueia tudo, precisa do Felipe):** aprovar budget → gerar takes via fal.ai (iterar com o Felipe julgando CADA take) → escolher o take herói → extrair frames + poster. Critério: o Felipe diz "é isso".
- **V2-F1 — Scrub:** componente canvas + preloader + wrapper 300vh + fallbacks (poster/reduced-motion/sem JS). Critério: scrub suave 60fps em desktop e mobile real, LCP = poster, CLS < 0.1.
- **V2-F2 — Overlay:** wordmark/promessa/CTA/chips/labels sincronizados com o progresso; B4/B5/painel integrados; deletar arquivos da árvore v1.
- **V2-F3 — Auditoria:** CWV, peso total da sequência (< 6MB desktop / < 2,5MB mobile), acessibilidade, revisão contra este doc.
- Checkpoint visual do Felipe ao fim de CADA fase; validação técnica por DOM/dados, nunca screenshot.

## 8. Tokens e regras herdadas (inalteradas)

Cores só `var(--lab-*)` no overlay/UI (o render usa a paleta mas é imagem); esmeralda raro; custos SEMPRE em JetBrains Mono; dark `#0A0B0E`; textos reais no DOM/SSR; nada acima de z-30.
