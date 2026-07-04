# P9 — Templates de fluxo prontos (biblioteca de modelos pré-moldados)

**Status:** SPEC aprovada, pesquisa NÃO executada · **Criada:** 2026-07-04 (side quest do Felipe, registrada formalmente)
**Encaixe no plano:** é a pesquisa-base da feature "Templates de fluxo (E2+)" já prevista em `modulos/03-fluxos/ESPECIFICACAO.md` e o primeiro degrau do item de backlog do ROADMAP "biblioteca de formatos validados como marketplace". Depende conceitualmente da P8 (ordem canônica) — executar P8 primeiro ou junto.

---

## PROMPT DE PESQUISA (colar num agente com pesquisa web profunda)

### Contexto (não redescobrir o que já decidimos)

LabIA, canvas de fluxos como espinha dorsal. A visão do Felipe: fluxos pré-moldados que abrem prontos, onde o usuário SÓ troca as informações (produto, marca, prompt, referências) e roda — em vez de montar nó por nó num canvas vazio. A spec do módulo 03 já lista 4 candidatos: Campanha de produto, Vídeo contínuo 30s+, Post completo, Carrossel. Nós disponíveis hoje: Prompt, Gerar Imagem (2 modelos), Gerar Vídeo (5 modelos); na E2 entram Text2Video, Estender Vídeo e Montagem. Regra de produto inegociável: custo estimado em R$ visível antes de rodar, em todo template.

### Perguntas que a pesquisa DEVE responder (todas, com fonte)

1. **Como as melhores bibliotecas de templates de workflow funcionam?** Dissecar: n8n (template library — estrutura, categorização, o que é variável vs fixo), ComfyUI (workflows compartilhados como JSON), Zapier (templates por caso de uso), CapCut/Canva (templates de mídia onde só se trocam os assets), Higgsfield (presets de vídeo). Para cada uma: como o template é armazenado, como o usuário o instancia, como as variáveis são expostas.
2. **Quais fluxos-tipo têm mais valor para social media?** Levantar demanda real (templates mais usados nas plataformas acima, formatos mais produzidos por creators/agências) e propor os 5–8 templates da primeira leva do LabIA — cada um descrito como: objetivo → nós na ordem → o que o usuário troca → custo estimado da execução típica em R$ (usar os preços já catalogados em `docs/06-PROVEDORES.md`, não inventar).
3. **O que parametrizar?** Nos templates propostos, separar com precisão: variáveis do usuário (produto, prompt-base, tom, refs, duração) × decisões pré-moldadas (modelo por etapa, resoluções, encadeamento) × o que o usuário pode destravar se quiser (modo avançado). Existe padrão de mercado para "placeholder" em workflow (ex.: variáveis nomeadas do n8n)?
4. **Modelo técnico de armazenamento:** template = Flow serializado com placeholders? Registro em tabela própria com versionamento? Arquivos versionados no repo (seed)? Comparar com como n8n/ComfyUI persistem e versionam, e recomendar o desenho para o schema atual do LabIA (Flow/FlowRun no Postgres via Prisma).
5. **UX de instanciar:** "Novo fluxo a partir de template" — os padrões de tela (galeria com preview? wizard de variáveis antes de abrir o canvas? abrir o canvas com os nós e destacar o que falta preencher?). Qual reduz mais o tempo-até-primeira-execução?

### Método anti-superficialidade (obrigatório)

- Mínimo de 10 fontes; cada afirmação com URL + data de acesso. NUNCA de memória de IA.
- **Duas passadas** (padrão do repo), a segunda ataca lacunas e contradições.
- Cada template proposto DEVE usar apenas nós que existem ou estão na E2 — nada de template que dependa de módulo não construído (copy/E3 pode aparecer como "versão futura", marcada).
- Toda seção termina com recomendação explícita para o LabIA, com o porquê.

### Formato de saída

Padrão P1–P7: Veredito → Fatos → **Primeira leva de templates** (tabela: nome, objetivo, nós, variáveis, custo típico R$) → Modelo de dados recomendado → UX recomendada → Impacto nos docs → Lacunas da verificação → Fontes.

---

## Impacto esperado nos docs (preencher ao executar)

- `modulos/03-fluxos/ESPECIFICACAO.md` e `CONSTRUCAO.md` — a feature Templates ganha spec construível (candidata a entrar no fim da E2 ou abrir a E3).
- `modulos/02-videos/TECNICAS.md` — cada template maduro vira/aponta uma receita.
- `prisma/schema.prisma` — se a recomendação for tabela de templates, vira tarefa com migration.
- Whitepaper (backlog) — capítulo "comece por um template".
