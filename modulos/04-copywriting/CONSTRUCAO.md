# 04-Copywriting — Construção

**Status:** não iniciado · **Etapa:** E3 · **Depende de:** motor de fluxos (E1); decisão do backend de texto (P6).

## Ordem de tarefas

1. Schema `Brand` com DNA estruturado (voz, pilares, proibições, corpus) + tela de edição.
2. Importador do vault: parser dos arquivos ClaudeObisidian (Tom-de-Voz.md, Como-Escrevo-Exemplos.md, Pilares) → DNA. Começar por Felipe-Creator e PagFinance.
3. `ModelProvider` de texto (Vercel AI SDK) com backend API e backend assinatura (conforme P6).
4. Nó Copy (pipeline few-shot + detector) e entidade CopyDoc.
5. Detector Anti-IA como serviço reutilizável (porta as regras da skill `detector-ia-copy`).
6. Nós Roteiro, Gancho/CTA e Melhorar Prompt.

## Critérios de aceite (validação externa)

- [ ] DNA da Felipe-Creator importado do vault sem edição manual.
- [ ] Copy gerada para a Felipe-Creator é aprovada pelo PRÓPRIO Felipe como "na minha voz" (teste cego vs. copy de ChatGPT genérico).
- [ ] Texto com padrão proibido ("não é X, é Y") é reprovado pelo detector com apontamento do trecho.
- [ ] Fluxo copy → melhorar prompt → gerar imagem roda ponta a ponta.
