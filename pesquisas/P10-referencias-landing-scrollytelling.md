# P10 - Referencias de landing: scrollytelling, estetica bioluminescente e efeitos

**Status:** CONCLUIDA - 2026-07-04, Codex.
**Criada:** 2026-07-04 (side quest de DESIGN do Felipe).
**Data de acesso das fontes:** 2026-07-04.
**Custo:** R$0 - pesquisa documental, nenhuma geracao de API.

## Veredito

**Caminho principal para o LabIA:** hero com scrollytelling curto e nativo: `position: sticky` + CSS scroll-driven animations quando disponivel + fallback por `IntersectionObserver`. A arvore/raizes deve ser um **SVG estatico no HTML** com caminhos nomeados por tipo de no; o scroll apenas altera `transform`, `opacity` e `stroke-dashoffset`. Vagalumes ficam em CSS/HTML absoluto com 12-18 pontos no desktop e 6-8 no mobile. O restante da landing usa scroll livre com reveals por secao, sem sequestrar a rolagem.

**Fallback obrigatorio:** sem JS, mostrar a composicao final da arvore/raizes ja desenhada, todos os textos e CTAs acessiveis, chips de custo visiveis em mono. Com `prefers-reduced-motion: reduce`, remover camera descendente, desenho progressivo e particulas; manter apenas estados estaticos e mudancas discretas de opacidade.

**Por que:** em 2026, CSS scroll-driven animations ja e viavel em Chrome/Safari, mas ainda exige fallback por suporte parcial/recente em Firefox e devices antigos. `IntersectionObserver` e baseline amplo desde 2019 e cobre a maior parte da narrativa com menos JS. GSAP ScrollTrigger e excelente, agora com licenca sem cobranca para uso amplo, mas vira dependencia pesada demais para a primeira versao se o efeito for apenas um pin curto. Lenis nao deve entrar como padrao: smooth scroll e opcional, nao argumento de produto.

## Passadas da pesquisa

1. **Pesquisa ampla + escrita:** scrollytelling de produto, referencias dark/organico-tech, landings de fluxo/no, tecnicas CSS/JS/SVG/Canvas/WebGL.
2. **Verificacao:** suporte de browser em 2026, custo de bibliotecas via `npm view`, acessibilidade (`prefers-reduced-motion`, scroll-jacking), Core Web Vitals e alternativa mais barata/robusta para cada tecnica.

## Tabela de referencias

| Referencia | O que roubar | O que evitar | URL | Data |
|---|---|---|---|---|
| Apple Vision Pro | Produto como objeto central no primeiro viewport; camera e composicao guiadas por scroll para explicar camadas do produto. | Sequencia pesada de imagens/3D como solucao padrao; alto risco de LCP alto e mobile caro. | https://www.apple.com/apple-vision-pro/ | 2026-07-04 |
| Recriacao CSS do Vision Pro | Demonstra que a API nativa de scroll animation consegue simular cenas complexas sem JS pesado. | Copiar a ambicao visual da Apple sem o orcamento de assets e QA. | https://css-tricks.com/recreating-apples-vision-pro-animation-in-css/ | 2026-07-04 |
| Stripe Climate | Explica um sistema abstrato com narrativa visual e provas concretas; bom modelo para transformar "metodo" em historia. | Virar pagina institucional longa demais antes de mostrar o produto. | https://stripe.com/climate | 2026-07-04 |
| The Pudding - scrollytelling libraries | Comparacao pragmatica de implementacoes; bom lembrete de que scrollytelling e arquitetura de conteudo antes de biblioteca. | Tratar a biblioteca como o design; a historia precisa existir sem ela. | https://pudding.cool/process/how-to-implement-scrollytelling/ | 2026-07-04 |
| n8n | Comunica automacao como sequencia de nos com inputs/outputs visiveis; bom paralelo para canvas produtivo. | Visual dev-tool denso demais para social media; LabIA precisa parecer metodo criativo, nao painel de integracao. | https://n8n.io/ | 2026-07-04 |
| Retool | Usa diagramas de conexoes para vender "tudo conectado a dados reais"; bom para mostrar confianca operacional. | Tom enterprise generico; diagramas de logos/conectores nao comunicam a arvore viva do LabIA. | https://retool.com/ | 2026-07-04 |
| Retool Workflows | Reforca que workflows precisam de landing propria e indice navegavel, nao so canvas cru. | Esconder a logica em listas/folders antes de mostrar o fluxo. | https://retool.com/build-enterprise-apps/workflows | 2026-07-04 |
| Lenis | Caso entre futuramente, usar por ser leve e baseado em scroll nativo, sem transformar a pagina inteira. | Adicionar smooth scroll por moda; qualquer atraso na rolagem prejudica controle e acessibilidade. | https://lenis.dev/ | 2026-07-04 |
| Fungal/bioluminescent references | Micelio e glow natural validam pontos vivos ligados por filamentos finos; o verde de fungos reais fica perto do esmeralda, nao do verde acido. | Cogumelos literais, floresta fantastica, neon cyberpunk saturado e "IA verde no preto" tipo template. | https://www.goldbio.com/blogs/articles/uncovering-the-mystery-behind-glow-in-the-dark-fungi | 2026-07-04 |
| Empa / bioluminescent wood | Boa direcao de material: brilho organico baixo, difuso, vindo de dentro da materia. | Realismo fotografico vegetal; a landing deve ser grafo/fluxo, nao biologia literal. | https://www.mycostories.com/post/bioluminescent-wood-created-using-fungi-a-new-sustainable-lighting-material | 2026-07-04 |
| NN/g - scrolljacking | Usar como regra negativa: preservar controle, ritmo e previsibilidade do usuario. | Pin longo, scroll em slides, bloquear roda/teclado, snap obrigatorio. | https://www.nngroup.com/articles/scrolljacking-101/ | 2026-07-04 |
| SitePoint - scrolljacking e acessibilidade | Reforca o risco para usuarios com tecnologia assistiva e perda de compreensao. | Qualquer tecnica que altere velocidade/direcao do scroll global. | https://www.sitepoint.com/scrolljacking-accessibility/ | 2026-07-04 |

## Tabela de tecnicas

| Tecnica | Custo perf | Acessibilidade | Fallback | Veredito p/ LabIA |
|---|---|---|---|---|
| CSS scroll-driven animations (`animation-timeline`, `view-timeline`) | Baixo quando animar `transform`, `opacity` e stroke; sem bundle JS. Suporte ja bom em Chromium/Safari, ainda pede fallback. | Respeita scroll nativo; precisa desligar movimento amplo em `prefers-reduced-motion`. | `@supports` + estado final estatico; IO para browsers sem suporte. | Usar no hero curto como melhoria progressiva, nao como unica base. |
| `position: sticky` + altura controlada de secao | Baixo; layout previsivel se dimensoes forem reservadas. | Mantem scroll nativo e teclado funcionando. | Secao vira bloco normal com a arvore final. | Base recomendada para B0/B1. |
| `IntersectionObserver` | Baixo; API assincrona evita listeners de scroll por pixel. | Bom para revelar conteudo sem mexer na rolagem; conteudo deve existir no DOM antes da animacao. | Sem JS, classes default mostram tudo visivel. | Base para B2-B5 e fallback do hero. |
| GSAP ScrollTrigger | Medio/alto: `gsap` 3.15.0 tem pacote grande no npm (unpacked ~6,2 MB); runtime pode ser bom, mas aumenta JS e complexidade. Licenca atual: "no charge". | Tem recursos para pin/scrub, mas facilita exagero e scroll-jacking se mal usado. | Import dinamico so no desktop; sem GSAP renderizar estado final. | Guardar para v2 se a composicao exigir timeline complexa. Evitar na v1. |
| Motion for React (`useScroll`) | Medio: pacote `motion` 12.42.2 unpacked ~682 KB, MIT; integra bem com React. | Bom para UI React, mas ainda depende de JS/hidratacao. | Sem JS, CSS estatico; com reduced motion, `useReducedMotion`. | Aceitavel para microinteracoes do app, mas a landing v1 pode evitar. |
| Lenis smooth scroll | Baixo/medio: `lenis` 1.3.25 unpacked ~451 KB, MIT; site declara menos de 4 KB em runtime. | Apesar de prometer scroll nativo, smooth scroll ainda pode incomodar; deve respeitar reduced motion. | Nao carregar Lenis; scroll nativo. | Nao usar na v1. O produto nao precisa de scroll suavizado global. |
| SVG path drawing (`stroke-dasharray`/`stroke-dashoffset`) | Baixo/medio; escala bem para dezenas de ramos se SVG for simples e sem filtros pesados. | Semantica decorativa com `aria-hidden` quando nao for informacao; texto separado no DOM. | SVG final ja desenhado. | Melhor tecnica para raizes ramificadas do LabIA. |
| Canvas 2D para raizes/particulas | Medio; bom para muitas particulas, mas exige JS e perde semantica/inspecao simples. | Conteudo visual vira bitmap; precisa alternativa textual/estatica. | Imagem/SVG estatico. | Usar so se CSS particles ficarem caros. Nao para raizes principais. |
| Lottie | Medio/alto; JSON pode ficar pesado, dificil de casar com tokens e responsividade. | Precisa fallback e cuidado com reduced motion. | Poster SVG/PNG. | Evitar. Pouco controle para uma arvore-grafo responsiva. |
| WebGL/Three.js | Alto; risco direto em LCP/INP/mobile, exige QA de canvas, GPU e fallback robusto. | Canvas sem conteudo semantico; reduced motion precisa desligar cena. | SVG/HTML completo. | Nao usar na v1. So justificar se virar produto visual 3D, o que nao e o caso. |
| CSS particles/vagalumes | Baixo se forem poucos elementos com `transform`/`opacity`; sem blur grande. | Pausar/remover em reduced motion; nao piscar rapido. | Pontos estaticos nos nos ativos. | Usar com teto: 12-18 desktop, 6-8 mobile, sem filtros caros. |
| Filtros de glow (`filter: blur`, drop-shadow) | Medio/alto se aplicado em areas grandes ou muitos elementos. | Glow nao pode reduzir contraste do texto. | Sombra simples/token dim. | Usar glow raro e pequeno; nunca em camada full-screen animada. |

## Recomendacao de stack de animacao

1. **HTML/SVG primeiro:** arvore/raizes como SVG inline responsivo, com `aria-hidden="true"` se for decorativo e textos equivalentes no DOM. Caminhos separados por beat/tipo de no.
2. **CSS como motor principal:** `position: sticky`, `@supports (animation-timeline: scroll())`, `view-timeline`, `transform`, `opacity`, `stroke-dashoffset`.
3. **JS minimo:** hook client-side pequeno com `IntersectionObserver` para adicionar `data-visible="true"` nos beats. Nada de listener global de scroll por frame.
4. **Sem dependencia na v1:** nao instalar GSAP/Motion/Lenis para a primeira landing. Reavaliar GSAP ScrollTrigger se o prototipo visual provar que CSS+IO nao sustenta o pin curto.
5. **Fallback:** HTML renderizado no servidor ja deve conter tudo. CSS default mostra estado final; JS/CSS avancado apenas refinam.
6. **Tokens:** nenhuma cor nova. Esmeralda so para seiva, nos ativos, CTA e custo; acentos por tipo de no herdados do `DESIGN-SYSTEM.md`.

## Parametros recomendados para os efeitos

| Efeito | Gatilho | Comportamento | Parametros | Limite |
|---|---|---|---|---|
| Descida copa -> raizes | Progresso do hero sticky | `translateY`/`scale` leve na camada SVG, copa perde opacidade e raizes ganham leitura. | Secao de 180-220vh desktop; 130-160vh mobile; pin visual de no maximo 1 tela e meia. | Sem scroll snap; com reduced motion, mostrar composicao inteira. |
| Crescimento das raizes | B1/B2 em viewport ou scroll timeline | `stroke-dashoffset` desenha tronco e ramos em stagger. | 8-14 caminhos principais; ramos secundarios ja visiveis em baixa opacidade. | Nao desenhar centenas de paths; sem filtros por path. |
| Vagalumes/nos ativos | Hero e pontos de custo/execucao | Pontos orbitam pouco e pulsam opacidade. | 12-18 desktop, 6-8 mobile; deriva max 20px; ciclo 3-5s dessincronizado; `opacity` 0.3-1. | Pausar em reduced motion; sem piscadas abaixo de 2s. |
| Seiva de execucao | B3 entra na viewport | Pulso percorre uma raiz e acende chip `~R$`. | Uma linha principal por vez; gradiente/stroke esmeralda curto; chip em JetBrains Mono. | Nao animar todos os ramos ao mesmo tempo. |
| Loop futuro | B4 entra na viewport | Ramos convergem em circuito discreto. | Texto deve marcar como visao/futuro; visual nao parecer painel funcional. | Nao prometer feature ja entregue. |

## Acessibilidade e performance

- **`prefers-reduced-motion`:** remover camera descendente, parallax, desenho progressivo e orbitas. Manter informacao por estado estatico, contraste e hierarquia.
- **Sem JS:** todos os beats, CTA e custos aparecem no HTML/SSR. Classes iniciais nao podem deixar conteudo invisivel dependendo de JS.
- **LCP:** hero nao deve depender de video, Three.js, canvas pesado ou sequencia de imagens. SVG inline + texto real e o alvo.
- **CLS:** reservar altura das secoes, do SVG e dos chips antes de carregar fontes; nao inserir elementos acima do fold depois da hidratacao.
- **INP:** evitar handlers de scroll frequentes; IO e CSS timelines reduzem trabalho no main thread. Se houver JS por frame, limitar a uma camada e testar em mobile.
- **Contraste:** glow nunca substitui contraste real. Texto usa `--lab-text`/`--lab-text-dim`; esmeralda claro so para custo/ativo.
- **Teclado/leitor:** nada de scroll bloqueado. Links e CTA devem ser focaveis em ordem natural. A arvore visual nao carrega texto essencial.

## Armadilhas de scrollytelling a evitar

- Pin longo que obriga o usuario a assistir antes de continuar.
- Scroll-jacking: alterar velocidade, direcao, snap obrigatorio ou bloquear roda/teclado.
- Hero pesado com video/3D antes do texto principal.
- Conteudo invisivel por padrao que so aparece se JS executar.
- Smooth scroll global por estetica.
- Particulas demais, blur em tela inteira e filtros animados em muitas camadas.
- Sequencia de imagens para algo que SVG/CSS resolve.
- Metafora vegetal literal demais: cogumelos, floresta, terra, folhas realistas.
- Verde em excesso: o reagente precisa ser raro para significar custo/execucao/foco.
- B4 parecer funcionalidade pronta; deve ser visao/futuro.

## Fontes tecnicas

- MDN - CSS scroll-driven animations: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- MDN - `animation-timeline`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline
- Can I use - `animation-timeline: scroll()`: https://caniuse.com/mdn-css_properties_animation-timeline_scroll
- WebKit - scroll-driven animations em Safari: https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/
- Chrome Developers - scroll-driven animations case studies: https://developer.chrome.com/blog/css-ui-ecommerce-sda
- MDN - Intersection Observer API: https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
- web.dev - `prefers-reduced-motion`: https://web.dev/articles/prefers-reduced-motion
- MDN - `prefers-reduced-motion`: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion
- Vercel - Core Web Vitals: https://vercel.com/kb/guide/optimizing-core-web-vitals-in-2024
- web.dev - CSS and Web Vitals: https://web.dev/articles/css-web-vitals
- GSAP pricing/license: https://gsap.com/pricing/
- GSAP ScrollTrigger docs: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Motion for React - reduce bundle size: https://motion.dev/docs/react-reduce-bundle-size
- Lenis: https://lenis.dev/
- NN/g - Scrolljacking 101: https://www.nngroup.com/articles/scrolljacking-101/
- SitePoint - scrolljacking and accessibility: https://www.sitepoint.com/scrolljacking-accessibility/

## Verificacao final

- **O que ficou de fora?** Bibliotecas de scrollytelling de nicho ficaram fora da recomendacao porque aumentam dependencia sem resolver uma necessidade clara da v1.
- **Essa tecnica ainda e padrao em 2026?** Para produto com performance como constraint, o padrao mais defensavel e CSS/IO progressivo. GSAP continua padrao de mercado para sites altamente animados, mas nao e necessario para a primeira landing do LabIA.
- **Existe abordagem mais barata/acessivel?** Sim: SVG inline + CSS + IO. E a recomendada.
