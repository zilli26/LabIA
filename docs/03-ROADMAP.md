# LabIA — Roadmap

Princípio central: **o canvas de fluxos é a espinha dorsal desde o dia 1**. Copy, imagem, vídeo, design e publicação nascem como NÓS do canvas, nunca como telas isoladas.

Regra de progresso: uma etapa só é "pronta" quando seus critérios de aceite (escritos ANTES da construção) passam em validação externa — rodar de verdade, ver de fora. Auto-declaração de agente não vale (lição do ClaudeObisidian).

## E0 — Fundação (ATUAL)

Docs completos, pesquisas P1–P7 executadas com loop de verificação, repo com git.
**Pronto quando:** uma IA sem contexto responde "o que é o LabIA, o que construir primeiro e como" só lendo o repo; pesquisas têm números reais; Felipe validou VISAO e os 8 módulos.

## E1 — Canvas + Studio de Imagens

O site no ar com visual impecável (DESIGN-SYSTEM aplicado), canvas React Flow funcionando e os primeiros nós: **Prompt → Gerar Imagem (2-3 modelos) → Biblioteca**, com custo estimado antes e real depois de cada geração.
**Pronto quando:** Felipe cria um fluxo, gera imagens reais com 2+ modelos diferentes, compara resultados lado a lado, vê o custo em R$ de cada uma e encontra tudo na biblioteca depois. Momento-alvo: "uso isso em vez do Higgsfield".

## E2 — Nós de Vídeo

Nós img2video e **extend** (último frame vira início do próximo clipe), encadeáveis: vídeos contínuos de 30s+ saindo de um único fluxo. Base: pesquisa P2.
**Pronto quando:** um fluxo produz um vídeo de 30s+ coerente a partir de uma imagem inicial, com custo total visível antes de rodar.

## E3 — Nós de Copy & Marca

Entidade Brand com DNA importado do vault (Tom-de-Voz, pilares, corpus, proibições anti-IA). Nós de copy/roteiro/gancho/CTA que se conectam aos nós visuais: copy → prompt de imagem → vídeo num fluxo só. Inclui o **AI Video Director** (shotlist + prompts com refs + estimativa de custo).
**Pronto quando:** um fluxo gera um post completo (copy na voz da Felipe-Creator ou PagFinance + visual) e a copy passa no detector anti-IA.

## E4 — Nós de Design & Export

Carrossel para Instagram, montagens, texto sobre imagem, redimensionamento automático por rede (1:1, 4:5, 9:16, 16:9).
**Pronto quando:** um carrossel de 6 slides com identidade da marca sai pronto para postar, nas proporções certas.

## E5 — Calendário & Publicação

Conectar redes, agendar, publicar em várias ao mesmo tempo, preview real por rede. O Post é a saída final de um fluxo. Métricas de engajamento coletadas → loop de aprendizado. Decisão API oficial vs. agregador vem da pesquisa P3.
**Pronto quando:** um post agendado no LabIA é publicado de verdade em 2+ redes e suas métricas aparecem na plataforma.

## E6 — Research + Onboarding + Multi-usuário/Billing

Pesquisas agendadas e profundas; onboarding de cliente que cria Brand/DNA guiado; contas multi-usuário, créditos e preços (o CreditLedger já existe desde E1 — aqui vira cobrança real).
**Pronto quando:** um cliente externo consegue entrar, configurar a marca e produzir sem o Felipe pilotar.

## Backlog além das etapas (documentado, sem data)

Community manager (responder comentários em voz de marca), social listening, "Jornada vira Conteúdo" como nó, fila de aprovação de cliente (ApprovalLink), biblioteca de formatos validados como marketplace.

**Whitepaper do LabIA** (decisão do Felipe, 2026-07-04): documento didático explicando cada parte e funcionalidade da plataforma como passo a passo — como fazer fluxos, como pensar neles a partir do que você precisa. Gatilho da 1ª versão: fechamento da E2 (quando o pipeline de vídeo inteiro existir para ser documentado). Esqueleto vem da ordem canônica da pesquisa P8; capítulo de templates vem da P9; receitas vêm do `modulos/02-videos/TECNICAS.md`. Vive em `docs/WHITEPAPER.md` como doc vivo.
