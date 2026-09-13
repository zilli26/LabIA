# O5-P2 — prontidão segura de staging

Este corte adiciona uma leitura somente informativa para a preview em
`GET /api/provider-connections/readiness` e o check local
`npm run staging:readiness`. Nenhum deles inicia worker, login, executor,
geração ou execução.

## O que é verificado

- `DATABASE_URL` e `DIRECT_URL`: somente presença, nunca o valor.
- conectividade do banco por uma consulta `SELECT 1` e disponibilidade da
  tabela `ExecutorPairing`;
- presença de `NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ASSETS_BUCKET`, sem ecoar valores;
- pareamento ativo do owner/workspace derivado no servidor e heartbeat dentro
  do TTL configurado (90 segundos por padrão);
- worker: permanece `not_proven`, pois esta leitura não executa nem inventa um
  mecanismo de prova de processo.

Quando o worker não puder ser comprovado, a instrução exibida é validar o
processo de staging separadamente antes do teste controlado. A resposta sempre
contém `executionAllowed: false` e não oferece CTA de execução.

## Uso após configurar o staging

1. Configure as variáveis no ambiente do staging sem colá-las em tickets,
   logs ou respostas.
2. Rode `npm run staging:readiness` no checkout local do LabIA.
3. Confirme `Banco: available`, `Tabela ExecutorPairing: available` e
   `Executor: online` dentro do TTL.
4. Confirme no painel de Conexões da preview que o executor está pareado
   online e que os modelos do snapshot são exibidos.
5. Se o worker aparecer como `not_proven`, valide-o separadamente conforme o
   procedimento operacional do staging; este check não o inicia.
6. Só depois de revisar os estados e o custo apresentado, Felipe pode fazer o
   teste autorizado. Nenhum passo deste documento aplica migration ou produz
   imagem/vídeo.

Estados acionáveis: `not_configured` indica variável ausente; `unavailable`
indica indisponibilidade de consulta; `migration_missing` indica que a tabela
de pareamento não está disponível; `offline` indica ausência ou expiração do
heartbeat.
