# LabIA

Laboratório de produção de conteúdo com IA: canvas de fluxos, geração de imagem/vídeo e biblioteca com custo visível. Projeto pessoal de Felipe Zilli, com evolução futura para um serviço por uso.

## Comece por aqui

1. [Visão do produto](docs/00-VISAO.md).
2. [Estado vivo e próxima ação](docs/RETOMADA.md) — a seção mais recente prevalece sobre registros históricos.
3. [Plano ChatGPT, OAuth, Google, MCP e produção por cenas](docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md).
4. [Mensagem pronta para continuar pelo ChatGPT](docs/PROMPT-RETOMADA-CHATGPT.md).
5. [Regras de trabalho](AGENTS.md), [roadmap](docs/03-ROADMAP.md) e [arquitetura](docs/01-ARQUITETURA.md).

Este é o repositório de continuidade: [zilli26/LabIA](https://github.com/zilli26/LabIA). Ao retomar, confira a revisão atual da branch `main`; os hashes antigos nos documentos são evidência histórica.

## Estado do produto

| Parte | Estado em 10/09/2026 |
|---|---|
| Canvas React Flow, persistência e fila | Implementados |
| Imagem fal.ai e biblioteca | Implementadas, com prova real anterior |
| Vídeo, extensão, montagem e upload de trilha | Código implementado; prova completa de vídeo real pendente |
| Retry seletivo de vídeo | Pendente |
| Landing e painel | Protótipo existente incluído nesta publicação; não confundir com aceite final de design |
| OAuth de geração OpenAI/Google, MCP e personagem consistente | Plano e pesquisa; integrações ainda não implementadas |
| TikTok Shop, publicação e operação multi-conta | Trabalho futuro |

O site é [labia-hazel.vercel.app](https://labia-hazel.vercel.app). O deploy automático GitHub → Vercel foi confirmado READY para `e3be150` em 10/09/2026. A geração depende também de um worker ativo, separado do site.

**Pendência operacional em 10/09/2026:** o projeto Supabase LabIA está `INACTIVE`; a Biblioteca retorna erro 500 por indisponibilidade do banco. Reativar e verificar banco/Storage antes de testar persistência ou geração. Detalhes e evidências em [RETOMADA](docs/RETOMADA.md). O deploy bem-sucedido não resolve essa dependência.

## Desenvolvimento local

Requer Node.js compatível com as dependências (o projeto Vercel usa Node 24), npm e Postgres/Supabase para os fluxos persistidos.

```sh
npm ci
```

Copie `.env.example` para `.env.local` e preencha as configurações reais fora do Git. O arquivo de exemplo contém apenas placeholders. Para banco novo, revise as migrations antes de aplicá-las; não execute migrações em produção sem conferir o destino.

```sh
npm run dev
```

O servidor web não inicia o worker. `npm run worker` consome as filas de fluxo, imagem e vídeo e pode executar gerações já pendentes. Só o inicie após conferir a fila e as aprovações de gasto. `npm run smoke:image` também pode gerar cobrança real.

## Validação

```sh
npx vitest run
npm run typecheck
npm run lint
npm run build
```

Testes unitários não provam qualidade de personagem, continuidade entre cenas ou funcionamento de geração real. Toda chamada paga exige estimativa em R$ e autorização conforme os contratos do projeto.

## Mapa do repositório

- `app/`, `components/`, `lib/`: aplicação, canvas, serviços, provedores e execução.
- `prisma/`: schema e migrations.
- `modulos/`: especificação, construção, funcionamento e decisões de cada módulo.
- `docs/`: visão, estado vivo, planos e decisões gerais.
- `pesquisas/`: fontes e pesquisas datadas; revalidar preços e capacidades antes de usar.
- `tests/`: testes de fluxos, provedores, upload e processamento local.
- `public/landing/`, `Images/`: mídia e referências do protótipo de landing.

OAuth do LabIA e OAuth do provedor de geração são conexões diferentes. O código atual usa um workspace padrão; autenticação e isolamento devem preceder a exposição do MCP e o uso por terceiros. Nenhum token, sessão ou arquivo de ambiente real pertence ao repositório.
