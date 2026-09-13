# O5-P3 — checklist operacional de pairing em staging

Este procedimento cria o primeiro `ExecutorPairing` para staging somente por
CLI local. A CLI nao aplica migration, nao inicia executor/worker, nao chama
Vercel, nao faz login, heartbeat ou geracao.

## Checklist

- [ ] Confirmar que `DATABASE_URL` e `DIRECT_URL` apontam para o banco de
      staging aprovado; nunca usar credenciais locais ou colar URLs em logs.
- [ ] Confirmar que a migration `20260913000000_add_executor_pairings` ja foi
      aplicada no staging e que `npm run staging:readiness` informa
      `Tabela ExecutorPairing: available`.
- [ ] Confirmar `LABIA_LOCAL_OWNER_ID` e `DEFAULT_WORKSPACE_SLUG` no ambiente
      local do operador; o workspace precisa existir nesse staging.
- [ ] Rodar a CLI com confirmacao explicita:
      `npm run staging:provision-executor -- --confirm PROVISION_EXECUTOR_PAIRING_FOR_STAGING`.
      Use `--label <nome>` se necessario.
- [ ] Se ja houver pairing ativo, parar e revisar. O padrao recusa; somente
      `--allow-existing-pairing` cria um pairing adicional e nunca sobrescreve
      o existente. Duas provisoes simultaneas para o mesmo owner/workspace sao
      serializadas no banco; sem a flag, exatamente uma cria e a outra recusa.
- [ ] Copiar `LABIA_EXECUTOR_PAIRING_ID` e
      `LABIA_EXECUTOR_PAIRING_SECRET` da saida uma unica vez para o ambiente
      local do executor. Nao salvar o segredo em repo, docs, `.env`, ticket,
      shell history ou log persistente.
- [ ] Configurar no executor local os nomes
      `LABIA_CONTROL_PLANE_URL`, `LABIA_EXECUTOR_PAIRING_ID`,
      `LABIA_EXECUTOR_PAIRING_SECRET` e `LABIA_EXECUTOR_CONNECTIONS_JSON`.
      Este ultimo deve conter apenas `connectionId`, `provider` e `sessionRef`.
- [ ] Iniciar/validar o executor local separadamente, sem alterar a CLI; o
      App Server real deve responder estado de conexao e modelos.
- [ ] Rodar `npm run staging:readiness` e confirmar `Executor: online` dentro
      do TTL de 90 segundos; conferir na preview que o pairing e as opcoes
      persistidas aparecem.
- [ ] Parar o executor e confirmar `offline` apos o TTL; religar deve voltar a
      `online` sem novo pairing/login quando o estado local continuar valido.
- [ ] Registrar que execucao remota, jobs, comandos e geracao permanecem fora
      deste corte.

## Saida esperada da CLI

A saida bem-sucedida contem somente os nomes `LABIA_EXECUTOR_PAIRING_ID` e
`LABIA_EXECUTOR_PAIRING_SECRET` com seus valores para copia imediata, seguidos
de instrucoes sem URLs, tokens, DATABASE URLs ou valores de ambiente extras.
