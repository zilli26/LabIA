# LabIA — Visão

## O que é

**LabIA** (laboratório + lábia) é a plataforma dos sonhos de um social media: um único lugar onde tudo que um cliente precisa para redes sociais é produzido — imagens, vídeos, copy, design, calendário, publicação, pesquisa e estratégia — com IA de ponta, pagando **por uso** em vez de planos abusivos.

## Por que existe (a dor original)

Plataformas de geração (Higgsfield, Pika, Seedance, Flow, Picsart) cobram planos caros para liberar geração de imagem/vídeo. Quem gera com frequência profissional paga muito; quem gera pouco paga pelo que não usa. O LabIA usa as **APIs dos mesmos modelos** diretamente: você paga centavos pela geração, vê o custo antes e depois, e tem sempre acesso aos melhores modelos E aos baratos.

As demais dores vêm da rotina real de social media (documentadas no vault do Felipe):

| Dor | Como o LabIA resolve |
|---|---|
| Planos caros de plataformas de geração | Pay-per-use via API, custo visível em R$ |
| Vídeos IA limitados a ~8s | Fluxos com *extend* encadeando clipes → vídeos 30s+ |
| Pipeline fragmentado (roteiro→imagem→vídeo em 5 ferramentas) | Canvas de fluxos: tudo conectado em um lugar |
| Copy genérica com cara de IA | Voz da marca (DNA/Tom-de-Voz) + detector anti-IA-copy |
| Calendário reativo, sem método | Calendário com estratégia fundamentada + loop de aprendizado |
| Pesquisa manual de notícias/tendências | Research agendado por tema/fonte + pesquisas profundas |
| Publicar em N redes é retrabalho | Publicação multi-rede com proporção certa por rede |

## Para quem

- **Fase atual**: o próprio Felipe (social media com clientes reais: Felipe-Creator, PagFinance, Vega, Monad). Ele é o usuário 0 e o laboratório de validação.
- **Fase futura**: social medias e empresas — SaaS com onboarding, billing por créditos e preços já pensados desde a arquitetura (mas construídos só na etapa E6).

## Princípios inegociáveis

1. **Custo visível em tudo** — toda geração mostra custo estimado antes e real depois, em R$. É o antídoto à dor original e o futuro diferencial de billing transparente.
2. **O canvas de fluxos é a espinha dorsal** — copy, imagem, vídeo, design e publicação são nós que se conectam. Não existem features isoladas; existem nós.
3. **Sempre os melhores modelos (e os baratos)** — a plataforma nunca fica presa a um provedor; a camada `ModelProvider` permite plugar API paga, assinatura (padrão Hermes) ou máquina local.
4. **Voz da marca acima de template** — nenhuma copy sai genérica; o DNA da marca é entidade de primeira classe.
5. **Método, não improviso** — estratégia fundamentada em pensadores reais (Kotler etc.), loop engajamento → aprendizado → pauta.
6. **Visual de produto, não de MVP** — estética própria de "laboratório" (ver `DESIGN-SYSTEM.md`).
7. **Construível por qualquer IA** — documentação autossuficiente; specs antes de código (SDD).

## O que o LabIA NÃO é

- Não é um wrapper de um único modelo (é multi-modelo por princípio).
- Não é um Buffer/Metricool clone (calendário é 1 dos 8 módulos, não o centro).
- Não é um chat genérico de IA (tudo é orientado a fluxo e a entregável de social media).

## Os 8 módulos

| # | Módulo | Uma linha |
|---|---|---|
| 01 | Imagens | Studio de geração multi-modelo pay-per-use com custo visível |
| 02 | Vídeos | Geração multi-modelo + extend para vídeos contínuos 30s+ |
| 03 | Fluxos | Canvas estilo n8n — a espinha dorsal + AI Video Director |
| 04 | Copywriting | Copy/roteiros/ganchos/CTAs com voz de marca e base fundamentada |
| 05 | Design | Carrosséis, montagens, proporções automáticas por rede |
| 06 | Calendário | Agendar e publicar multi-rede + loop de aprendizado |
| 07 | Research | Pesquisas agendadas e profundas (notícias, concorrentes, mercado) |
| 08 | Estratégia | Onboarding de marca + estratégia fundamentada conectada à produção |

Detalhes de cada um: `modulos/<nn-nome>/ESPECIFICACAO.md`.
