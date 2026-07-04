# P8 — Anatomia e didática de fluxos de produção de conteúdo

**Status:** SPEC aprovada, pesquisa NÃO executada · **Criada:** 2026-07-04 (side quest do Felipe, registrada formalmente)
**Encaixe no plano:** alimenta "Templates de fluxo (E2+)" e o AI Video Director (E3) do `modulos/03-fluxos/ESPECIFICACAO.md`, o guia de boas práticas do `modulos/02-videos/TECNICAS.md` e o Whitepaper (ver ROADMAP backlog). Não é pesquisa órfã: cada achado tem destino declarado.

---

## PROMPT DE PESQUISA (colar num agente com pesquisa web profunda)

### Contexto (não redescobrir o que já decidimos)

O LabIA é uma plataforma de social media onde TUDO nasce como nó de um canvas de fluxos (estilo n8n, com React Flow). Já existe e funciona: nós Prompt → Gerar Imagem → Gerar Vídeo, custo em R$ estimado antes e real depois, execução assíncrona com worker. Já está decidido (não questionar, aprofundar): canvas é a espinha dorsal; vídeo 30s+ via frame-chaining (P2); AI Video Director na E3 recebe briefing e propõe o fluxo inteiro com shotlist e custo. A dor que motiva esta pesquisa: montar um fluxo hoje não é didático — o usuário encara um canvas vazio sem saber a ordem certa de trabalho.

### Perguntas que a pesquisa DEVE responder (todas, com fonte)

1. **Como usuários experientes estruturam fluxos de geração de conteúdo na prática?** Analisar workflows reais e documentados de: ComfyUI (workflows compartilhados), n8n (biblioteca de templates de conteúdo/marketing), Higgsfield, Google Flow/Veo, Freepik AI Suite, Krea. O que os fluxos bons têm em comum (ordem, granularidade dos passos, pontos de revisão humana)?
2. **Qual é a ordem canônica de trabalho de um social media profissional**, do zero ao post publicado? (briefing → conceito/direção → roteiro/copy → prompts visuais → geração → curadoria → montagem/edição → adaptação por rede → publicação). Buscar em: processos de agências, creator workflows documentados, cursos/playbooks de produção de conteúdo. O objetivo é validar (ou corrigir) essa cadeia e nomear cada etapa.
3. **Mapeamento de processos aplicado a canvas de IA:** que notações leves (BPMN, SIPOC, value stream, service blueprint) têm elementos úteis para tornar um fluxo legível como processo — e o que ignorar por burocrático? Existe precedente de ferramenta de IA generativa usando lente de processo?
4. **O que torna um canvas didático?** Levantar padrões concretos de UX em ferramentas de nós: onboarding guiado, templates de partida, "ghost nodes"/sugestão de próximo nó, validação visual de conexões por tipo, empty state que ensina, tooltips de custo. Com exemplos nomeados de quem faz cada um.
5. **Manual do fluxo bem-feito HOJE no LabIA:** com o que existe (Prompt, Gerar Imagem, Gerar Vídeo, em breve Extend/Montagem), qual é a melhor prática de montagem manual? Propor o passo a passo que vira a primeira receita do TECNICAS.md e o embrião do Whitepaper.

### Método anti-superficialidade (obrigatório)

- Mínimo de 12 fontes independentes; cada afirmação factual com URL + data de acesso. NUNCA preencher de memória de IA.
- **Duas passadas** (padrão P1–P7 do repo): a segunda passada ataca as lacunas e contradições da primeira, e lista o que NÃO foi possível confirmar.
- Proibido concluir "depende" sem entregar recomendação: toda seção termina com "para o LabIA, recomendo X, porque Y".
- Distinguir explicitamente: fato observado ≠ opinião de blog ≠ inferência sua.

### Formato de saída

Arquivo no padrão das P1–P7: Veredito (1 parágrafo) → Fatos que mudam/afinam a spec (numerados) → Ordem canônica proposta (a cadeia nomeada, etapa a etapa) → Recomendações de UX didático priorizadas (impacto × esforço) → Impacto nos docs (que arquivo do repo muda e como) → Passada de verificação: lacunas → Fontes.

---

## Impacto esperado nos docs (preencher ao executar)

- `modulos/03-fluxos/ESPECIFICACAO.md` — seção Templates e requisitos de didática do canvas.
- `modulos/02-videos/TECNICAS.md` — receita "como montar um fluxo de vídeo bem-feito, manualmente".
- `docs/DESIGN-SYSTEM.md` — padrões de UX didático, se a pesquisa validar.
- Whitepaper (backlog) — a ordem canônica vira o esqueleto dos capítulos.
