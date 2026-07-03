# 06-Calendário — Construção

**Status:** não iniciado · **Etapa:** E5 · **Depende de:** P3 decidida (API oficial vs. agregador); módulos 03/05.

## Ordem de tarefas

1. Implementar a decisão de P3 (conector de publicação) atrás de interface própria `SocialPublisher` (mesmo padrão do ModelProvider — trocável).
2. Entidades SocialAccount + Post; conexão OAuth das redes.
3. Composer com preview fiel por rede (componentes de preview: feed IG, timeline X, LinkedIn).
4. Calendário visual + agendamento (pg-boss agendado, timezone).
5. Nó Publicar no canvas.
6. Coleta de métricas D+1/D+3/D+7 + tela de métricas por post.
7. (fase 2) ApprovalLink para clientes.

## Critérios de aceite (validação externa)

- [ ] Post agendado no LabIA publicado DE VERDADE em 2+ redes reais do Felipe.
- [ ] Preview do IG bate pixel-a-pixel razoável com o post publicado.
- [ ] Falha em 1 rede não impede as outras; retry funciona.
- [ ] Métricas do post aparecem na plataforma sem intervenção manual.
