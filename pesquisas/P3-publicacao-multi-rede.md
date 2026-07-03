# P3 — Publicação multi-rede: APIs oficiais vs. agregadores

**Data:** 2026-07-02 · **Passadas:** 2

## Veredito (recomendação para E5)

**Fase pessoal (E5, usuário = Felipe): começar com agregador barato (Late ~US$19-49/mês ou Post Bridge)** — publica em 13 redes sem passar pelo app review da Meta. **Fase SaaS (E6+): migrar para APIs oficiais** (grátis, mas semanas de burocracia) ou Ayrshare (caro, US$149+/mês, mas white-label e por perfil). A interface `SocialPublisher` (já na spec do módulo 06) torna essa troca barata — decisão validada.

## Opções comparadas

| Opção | Custo | Redes | Prós | Contras |
|---|---|---|---|---|
| **APIs oficiais (Meta, TikTok, X, LinkedIn)** | R$0 de licença | todas | grátis, controle total | app review da Meta (dias-semanas), OAuth/token management próprio, rate limits (ex.: 200 req/h), X API paga à parte |
| **Late (getlate.dev)** | US$19-49/mês | 13 (IG, TikTok, X, LinkedIn, FB, YT, Threads, Reddit, Pinterest, Bluesky, GBP, Telegram) | mais barato, vídeo em todos os planos, API simples | menos features (sem DMs/comments) |
| **Post Bridge** | plano criador barato; API disponível (conferir tier) | IG, TikTok, YT, X, LinkedIn, FB, Pinterest, Threads, Bluesky | barato, usa APIs oficiais por baixo | docs de API com informação conflitante — validar antes |
| **Ayrshare** | US$149-599/mês (+US$8,99/perfil extra) | 13+ | completo (analytics, comments, DMs), feito p/ SaaS | caro demais para fase pessoal |
| **Zernio / bundle.social / postpeer** | free tier (Zernio: 2 contas grátis) | variadas | opções emergentes baratas | maturidade incerta |

## Fatos-chave

- Meta não cobra pela Graph API, mas exige: conta dev, Página FB vinculada a IG Business/Creator, app aprovado em review e modo Live. Custo real = tempo de desenvolvimento (dias a semanas).
- Late é ~87% mais barato que Ayrshare para as mesmas plataformas.
- Métricas (likes/alcance p/ o loop de aprendizado) também vêm dos agregadores — conferir cobertura de analytics do escolhido na E5 (Ayrshare tem; Late é focado em publicar — pode exigir API oficial só para métricas).

## Passada de verificação — lacunas

- [ ] Cobertura de MÉTRICAS por agregador (Late/Post Bridge) não confirmada — pesquisar na abertura da E5 (pode definir escolha).
- [ ] Stories/Reels específicos: quais agregadores suportam agendar Stories? (limite conhecido da API do IG).
- [ ] X (Twitter) API: preço atual do tier básico mudou várias vezes — confirmar na E5.

## Fontes

- https://www.ayrshare.com/pricing/ · https://getlate.dev/alternatives/ayrshare · https://getlate.dev/ayrshare-vs-late
- https://support.post-bridge.com/api/post-bridge-api-overview-access-and-pricing · https://www.post-bridge.com/pricing
- https://www.getphyllo.com/post/instagram-api-pricing-explained-iv · https://zernio.com/blog/instagram-graph-api
