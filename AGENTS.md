# LabIA — Regras de trabalho neste repositório

> Este arquivo é idêntico ao `AGENTS.md` (lido pelo Codex). Se editar um, espelhe no outro.

## O que é este projeto

LabIA ("laboratório" + "lábia") é a plataforma dos sonhos de um social media: geração de imagem/vídeo pay-per-use via API, canvas de fluxos estilo n8n como espinha dorsal, copywriting com voz de marca, design, calendário/publicação multi-rede, research e estratégia. Dono: Felipe Zilli (social media). Leia `docs/00-VISAO.md` antes de qualquer coisa.

## Mapa de leitura obrigatória (nesta ordem)

1. `docs/00-VISAO.md` — o que é, para quem, princípios inegociáveis
2. `docs/RETOMADA.md` — **estado vivo**: onde paramos, débitos, próxima ação
3. `docs/03-ROADMAP.md` — em que etapa estamos e o que é "pronto"
4. `docs/01-ARQUITETURA.md` — stack e como os módulos conversam
5. A pasta do módulo em que vai trabalhar: `modulos/<nn-nome>/` — leia os 4 arquivos

Ao encerrar uma sessão de orquestração, atualize o `docs/RETOMADA.md` (decisões mudadas + porquê, débitos, ponteiro de retomada).

## Regras inegociáveis

1. **Spec-Driven Development**: nenhum código de módulo é escrito sem `ESPECIFICACAO.md` e `CONSTRUCAO.md` daquele módulo aprovados pelo Felipe. A spec é o contrato; o código segue a spec, nunca o contrário. Se durante a implementação a spec se mostrar errada, PARE e atualize a spec primeiro.
2. **Validação externa, nunca auto-declarada**: "funciona" só depois de rodar e verificar de fora (teste, preview, chamada real). Lição do colapso do ClaudeObisidian: auto-validação de agente mente.
3. **Custo visível**: toda feature que gera algo via API de IA deve expor o custo estimado ANTES e o custo real DEPOIS da geração. Isso é princípio de produto, não detalhe.
4. **Canvas é a espinha dorsal**: novas capacidades nascem como NÓS do canvas de fluxos, não como telas isoladas.
5. **Decisões viram registro**: decisão técnica de escopo geral → `docs/adr/`; decisão local de módulo → `modulos/<x>/decisoes.md`. Sempre com o "por quê".
6. **Status atualizado**: ao terminar trabalho num módulo, atualize a seção "Status" do `CONSTRUCAO.md` daquele módulo.
7. **Qualidade visual é requisito**: siga `docs/DESIGN-SYSTEM.md` em toda tela. Nada de UI genérica de template.

## Stack (resumo — detalhes em docs/01-ARQUITETURA.md)

Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui customizado · Supabase (Postgres/auth/storage) + Prisma · fal.ai (gateway principal de geração) atrás de abstração `ModelProvider` · Vercel AI SDK p/ agentes de texto · React Flow p/ canvas · pg-boss p/ jobs assíncronos.

## Convenções

- Idioma dos docs e da UI: **português (BR)**. Código, nomes de variáveis e commits: inglês.
- Commits pequenos e frequentes; mensagem explica o porquê.
- Segredos só em `.env.local` (nunca commitado). `.env.example` documenta as chaves necessárias.
