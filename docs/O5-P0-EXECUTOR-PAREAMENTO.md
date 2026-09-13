# O5 P0 Pareamento e heartbeat do executor

## Contrato

O executor local conhece `LABIA_EXECUTOR_PAIRING_ID` e `LABIA_EXECUTOR_PAIRING_SECRET`. O control-plane conhece apenas o hash SHA-256 do segredo na tabela `executor_pairings`. O segredo nao entra no JSON do heartbeat, no snapshot, na resposta ou em mensagens de erro.

O executor envia `POST /api/executors/heartbeat` para `LABIA_CONTROL_PLANE_URL` usando HTTPS publico, `Authorization: Bearer <segredo>` e `x-labia-executor-pairing-id`. Cada heartbeat exige `sequence` inteiro positivo; o control-plane aceita somente uma sequencia maior que `lastSequence` por pairing, usando update atomico. O corpo declara somente versao, estado, conexoes, provider, capabilities e modelos allowlisted.

O script `provider-executor` configura apenas a identidade `connectionId/provider/sessionRef` em `LABIA_EXECUTOR_CONNECTIONS_JSON`. A cada envio ele consulta o estado real do Codex App Server e as opcoes de imagem conhecidas pelo App Server; nao publica `state`, auth, capabilities ou modelos estaticos de env. Falha de conexao publica erro/desconexao e ausencia de heartbeat deriva offline por TTL.

`GET /api/executors/:pairingId` usa o mesmo Bearer e devolve somente o snapshot persistido sanitizado. A rota autentica header/token antes de ler JSON e limita o body do heartbeat a 16 KiB. Nao ha chamada do control-plane para localhost: o status e lido do Postgres no proprio servidor Vercel.

## Seguranca e estado

O sanitizer reaplica allowlist e redacao de valores exatos, `Bearer`, `sk-`, token/cookie e headers sensiveis tanto no snapshot persistido quanto em toda resposta publica. O escopo das conexoes e sempre resolvido por `ownerId` e `workspaceId` do pairing.

`lastSeenAt` e gravado pelo servidor no recebimento. Uma entrada ativa fica `online`, `starting`, `offline` ou `error` enquanto o heartbeat estiver dentro do TTL padrao de 90 segundos; depois disso a leitura deriva `offline` sem alterar o banco. Pareamento revogado nunca volta a ficar online.

O cliente faz somente chamadas outbound de heartbeat em intervalo configuravel. O P0 nao consulta jobs, comandos ou fila, nao abre loopback na Vercel e nao inicia execucao remota. Logout/desconexao do App Server aparecem como `authStatus: disconnected`; indisponibilidade do App Server aparece como executor `error`, e a ausencia subsequente de heartbeat passa a `offline`.

## Migration

`prisma/migrations/20260913000000_add_executor_pairings/migration.sql` e aditiva, inclui `last_sequence BIGINT`, habilita e forca RLS e revoga acesso dos papeis da Data API. Ela foi criada no codigo e nao foi aplicada.
