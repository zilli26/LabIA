# P6 — Assinaturas como motor de IA (padrão Hermes)

> Revisão de evidência em 2026-09-10: a limitação absoluta a texto abaixo ficou desatualizada. Foi inspecionado um plugin Hermes de imagem por OAuth ChatGPT/Codex, com referências. Ver `docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md`, seção 3, para fonte versionada, limites da evidência e testes ainda necessários. Também não usar as afirmações históricas sobre condições comerciais como análise atual de todos os provedores; avaliar cada rota antes de oferecê-la. O texto abaixo é a pesquisa histórica de julho, não comprovação de conexão atual.

**Data:** 2026-07-02 · **Passadas:** 2

## Veredito

**Viável e vale a pena para a fase pessoal** — para TEXTO (copy, estratégia, research, Video Director). NÃO existe rota de assinatura para geração de imagem/vídeo por API (essas seguem pay-per-use na fal.ai). E há uma linha vermelha: uso pessoal ok; revender acesso da sua assinatura dentro de um SaaS multi-usuário viola os termos → na E6, tudo migra para API.

## Rotas confirmadas

| Rota | Como | Custo | Para quê no LabIA |
|---|---|---|---|
| **Codex CLI com plano ChatGPT Plus** | login OAuth no CLI; `codex exec` roda scriptado | US$20/mês (já pago) | jobs de copy/research batch; GPT-5.5 só existe via assinatura |
| **Claude Code com plano Max** | headless/Agent SDK autenticado na conta | plano já pago | agentes de copy com voz de marca; validações |
| **Gemini CLI / AI Studio free** | cota diária gratuita | R$0 | dev e tarefas leves |
| **CLIProxyAPI / auth2api** (proxies OAuth→API-compat) | expõe a assinatura como endpoint OpenAI-compatible | R$0 extra | integrar assinatura ao ModelProvider como se fosse API |

## Arquitetura no LabIA

O `ModelProvider` de texto ganha um backend `subscription`: um worker local (na máquina do Felipe) que roda Codex/Claude headless e devolve o resultado à plataforma via fila. Implicação importante: **jobs de texto por assinatura rodam na máquina local, não na Vercel** — o worker local é um processo separado (Node) que consome a fila pg-boss. Backend `api` continua existindo para quando o worker está offline.

## Limites e riscos (registrar no 04-CUSTOS)

1. Rate limits da assinatura (mensagens/janela de 5h no Plus; limites do Max) — jobs batch precisam de fila com throttle.
2. OAuth de assinatura em servidor compartilhado / pooling de contas = violação de termos. Só a máquina do próprio dono.
3. Rotas de proxy são não-oficiais — podem quebrar a qualquer update. Backend `api` é o fallback permanente.
4. Na virada SaaS (E6): custo de API de texto entra no preço dos créditos.

## Passada de verificação — lacunas

- [ ] Testar na prática `codex exec` batch (medir throughput no plano do Felipe) antes de contar com ele na E3.
- [ ] Termos de uso exatos da automação headless do Claude Max — conferir na E3.

## Fontes

- https://developers.openai.com/codex/auth · https://developers.openai.com/codex/cli
- https://medium.com/@balazskocsis/automate-with-codex-cli-on-chatgpt-plus-subscription-d4f5c1e0c9a9
- https://codex.danielvaughan.com/2026/04/24/codex-subscription-api-programmatic-access-gpt-5-5-chatgpt-plan/
- https://github.com/router-for-me/CLIProxyAPI · https://github.com/AmazingAng/auth2api
