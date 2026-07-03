# 01-Imagens — Construção

**Status:** não iniciado · **Etapa:** E1 · **Depende de:** fundação do canvas (módulo 03, parte E1) e `ModelProvider`.

## Ordem de tarefas

1. `ModelProvider` interface + implementação fal.ai (`lib/providers/`) com 2 modelos de imagem — testável por script antes de UI.
2. Entidades `Generation` + `Asset` no Prisma + upload do resultado ao Supabase Storage.
3. Job de geração no pg-boss (enqueue → poll/webhook fal → persistir → notificar UI).
4. Nó Prompt e Nó Gerar Imagem no canvas (React Flow), com estimativa de custo no nó.
5. Biblioteca de assets (tela) + histórico de gerações.
6. Nó Comparar + Nó Referência (img2img).

## Critérios de aceite (validação externa)

- [ ] Script de smoke test gera 1 imagem real via fal.ai e imprime custo (sem UI).
- [ ] No canvas: prompt → gerar → imagem aparece no nó; custo estimado visível ANTES, real DEPOIS.
- [ ] Mesma prompt em 2 modelos → comparação lado a lado com custos diferentes.
- [ ] Asset aparece na biblioteca com prompt recuperável.
- [ ] Falha simulada (chave inválida) mostra erro legível e permite retry.
