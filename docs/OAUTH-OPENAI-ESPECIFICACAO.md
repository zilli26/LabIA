# OpenAI OAuth e providers por nÃ³ â€” especificaÃ§Ã£o

Data: 2026-09-12. **Status: aprovado pelo Felipe em 2026-09-12; implementacao O1 iniciada.**

## DecisÃ£o de produto jÃ¡ recebida

NÃ£o existe provider principal do LabIA. Cada nÃ³ gerativo escolhe **Provider â†’ ConexÃ£o â†’ Modelo**. A fal.ai continua disponÃ­vel. O pedido atual prioriza conectar a conta OpenAI por OAuth; Seedance direto e Google sÃ£o prÃ³ximos adaptadores, nÃ£o dependÃªncias para comeÃ§ar o login.

O pedido define o resultado desejado. As escolhas tÃ©cnicas abaixo ainda precisam da aprovaÃ§Ã£o de contrato exigida no AGENTS.md; nÃ£o registrar esta proposta como spec jÃ¡ aprovada.

## ExperiÃªncia proposta

1. No nÃ³ Gerar Imagem, Felipe escolhe OpenAI e aciona **Conectar ChatGPT**.
2. O LabIA mostra o login iniciado pelo executor dedicado; Felipe autentica diretamente na OpenAI. Preferir cÃ³digo de dispositivo quando suportado pela conta; usar navegador com callback local como alternativa.
3. A conexÃ£o aparece como **Conectada**, com estado do executor e Ãºltima verificaÃ§Ã£o. A capacidade de imagem aparece separadamente como **NÃ£o validada**, **DisponÃ­vel** ou **IndisponÃ­vel**.
4. O seletor de modelo respeita a conexÃ£o e as capacidades verificadas. Login bem-sucedido nÃ£o habilita automaticamente geraÃ§Ã£o de imagem.
5. Ao executar, a confirmaÃ§Ã£o discrimina **API: estimativa em R$** e **Assinatura: usa a cota do plano**. Se a cota nÃ£o puder ser consultada, mostrar **Cota indisponÃ­vel**; nÃ£o mostrar â€œgrÃ¡tisâ€, â€œilimitadoâ€ ou converter cota em crÃ©ditos de API.
6. O resultado pronto vira Asset reutilizÃ¡vel na Biblioteca e na entrada de um nÃ³ de vÃ­deo, independentemente do provider de origem.

Todos os controles seguem DESIGN-SYSTEM.md; conexÃµes sÃ£o infraestrutura de apoio ao canvas. Trocar provider limpa conexÃ£o/modelo incompatÃ­veis e exige nova estimativa. NÃ£o fazer fallback automÃ¡tico para outra conexÃ£o, conta ou API paga.

## AutenticaÃ§Ã£o proposta

Usar **Codex App Server**, executado como processo local dedicado e controlado pelo LabIA por stdio. A documentaÃ§Ã£o oficial descreve sua incorporaÃ§Ã£o em outros produtos e os mÃ©todos de login. O protocolo foi conferido no CLI instalado `0.153.4`, com geraÃ§Ã£o local de JSON Schema, sem iniciar login ou geraÃ§Ã£o.

- Inicializar o protocolo e negociar recursos antes dos comandos de conta.
- Login: `account/login/start` com `chatgptDeviceCode` ou `chatgpt`; acompanhar `account/login/completed` e confirmar com `account/read`.
- Implementar cancelamento, timeout, logout e reconexÃ£o. Correlacionar eventos por tentativa de login, executor e conexÃ£o; ignorar conclusÃ£o de tentativa cancelada/antiga.
- Consultar limites somente quando disponÃ­veis; persistir data da leitura e manter estado desconhecido quando nÃ£o houver dados. Nunca consumir reset ou comprar crÃ©ditos automaticamente.
- Usar diretÃ³rio de credenciais dedicado, fora do repositÃ³rio, com proteÃ§Ã£o do usuÃ¡rio do sistema. Configurar o ambiente apenas no processo filho. NÃ£o ler/copiar a sessÃ£o do aplicativo Codex nem compartilhar seu diretÃ³rio de autenticaÃ§Ã£o.
- Tokens e refresh ficam sob gestÃ£o do App Server. Banco, grafo, logs, retornos de API e navegador nÃ£o recebem tokens OpenAI. A configuraÃ§Ã£o versionada contÃ©m somente referÃªncias; segredos configurÃ¡veis do LabIA continuam em `.env.local`.
- NÃ£o implementar um cliente OAuth pÃºblico inventado, nÃ£o embutir client secret no navegador e nÃ£o tratar o token ChatGPT como chave da API pÃºblica de imagens.

**ImplantaÃ§Ã£o:** primeiro validar login com interface e executor locais, sem consumir filas de geraÃ§Ã£o. Para usar a interface publicada na Vercel, adicionar sessÃ£o autenticada do dono e autorizaÃ§Ã£o de workspace nas rotas de conexÃµes, flows, execuÃ§Ã£o, retry, generations e assets antes de habilitar a conexÃ£o. O backend publicado encaminha comandos por canal autenticado ao executor, que abre conexÃ£o de saÃ­da; nÃ£o expor App Server ou terminal diretamente Ã  internet. O callback local sÃ³ funciona no computador do executor; acesso remoto deve usar o fluxo de dispositivo, quando disponÃ­vel.

O mecanismo de sessÃ£o e o pareamento remoto serÃ£o detalhados antes da etapa de publicaÃ§Ã£o. A primeira entrega local nÃ£o serÃ¡ apresentada como OAuth funcionando na Vercel.

## Contratos comuns

| Entidade | Campos e responsabilidade propostos |
|---|---|
| ProviderConnection | `id`, `workspaceId`, identidade do dono, `providerId`, `authMethod`, `label`, `status`, `executorId`, `credentialRef`, `lastVerifiedAt`, capacidades verificadas e data da prova. Sem tokens no registro. |
| ConfiguraÃ§Ã£o do nÃ³ | `providerId`, `connectionId`, `modelId`, parÃ¢metros. Montagem usa processamento LabIA e nÃ£o exige OAuth. |
| Generation | Snapshot imutÃ¡vel de provider/conexÃ£o/modelo, parÃ¢metros e inputs; modo de cobranÃ§a; chave da operaÃ§Ã£o; estado de envio; identificador remoto; estimativa/uso observado; vÃ­nculo a run e nÃ³. |
| Asset | Arquivo persistido, tipo/MIME/dimensÃµes/duraÃ§Ã£o, workspace, Generation e procedÃªncia. BinÃ¡rio/base64/URL do provider sÃ£o normalizados pelo adaptador antes do armazenamento. |

`ProviderConnection` sÃ³ Ã© resolvida dentro do workspace e do dono autorizado. Um ID recebido pelo cliente nÃ£o comprova acesso. ConexÃ£o desconectada, executor offline ou capacidade incompatÃ­vel produz erro antes de enviar geraÃ§Ã£o.

A camada comum deve oferecer catÃ¡logo/capacidades, estimativa, envio, acompanhamento/recuperaÃ§Ã£o e normalizaÃ§Ã£o de resultados. O runner conhece somente contratos e estados. Particularidades fal.ai/OpenAI ficam nos adaptadores, incluindo polling versus streaming e recuperaÃ§Ã£o possÃ­vel por cada serviÃ§o.

Para fluxos antigos, preservar `provider = fal` e modelo existentes via compatibilidade explÃ­cita. Associar a conexÃ£o fal do workspace por migraÃ§Ã£o controlada; nÃ£o criar um default global para nÃ³s novos. NÃ£o apagar, recriar nem executar o fluxo manual informado pelo Felipe.

**Seedance Ã© tambÃ©m nome de famÃ­lia de modelos.** Usar Seedance por fal.ai mantÃ©m Provider = fal.ai. Uma conexÃ£o separada Seedance sÃ³ serÃ¡ habilitada depois de identificar serviÃ§o/API de acesso, credenciais e contrato. A mesma distinÃ§Ã£o vale para modelos Google acessados por agregadores.

## ProteÃ§Ã£o contra envio duplicado e retry

- Uma chave Ãºnica da operaÃ§Ã£o por run/nÃ³/tentativa lÃ³gica impede que entrega duplicada da fila crie outra Generation. GeraÃ§Ã£o avulsa recebe chave prÃ³pria. Nova geraÃ§Ã£o intencional cria nova tentativa; retry tÃ©cnico mantÃ©m a mesma.
- Reservar a operaÃ§Ã£o atomicamente no banco antes do envio, com controle de concorrÃªncia. A fila deve ser recuperÃ¡vel apÃ³s falha entre criar Generation e enfileirar, sem chamar o provider.
- Estados de envio: `not_submitted`, `submitting`, `submitted`, `submission_unknown`, `completed` e `failed`. Uma operaÃ§Ã£o deixada em `submitting` apÃ³s queda exige reconciliaÃ§Ã£o; nÃ£o autoriza novo submit.
- Com identificador remoto persistido, retomar acompanhamento/resultado. Sem identificador apÃ³s timeout ou queda durante envio, marcar `submission_unknown` e nÃ£o reenviar automaticamente. IdempotÃªncia remota sÃ³ pode ser usada quando o provider a documentar e suportar.
- NÃ£o prometer exactly-once sobre um serviÃ§o sem idempotÃªncia/reconciliaÃ§Ã£o. Na incerteza, parar e explicar que uma geraÃ§Ã£o pode ter sido aceita.
- Persistir resultado recuperÃ¡vel antes de finalizar Assets. Upload/storage com erro repete somente persistÃªncia; chave Ãºnica por Generation/Ã­ndice evita Assets duplicados. Resultado perdido e nÃ£o recuperÃ¡vel permanece explÃ­cito, sem nova geraÃ§Ã£o silenciosa.
- Retry seletivo mantÃ©m Assets anteriores e ramos independentes. Apenas o nÃ³ falho Ã© retomado; descendentes bloqueados aguardam seu resultado. Bloquear retry concorrente e tentativa ambÃ­gua. Se houver necessidade de nova geraÃ§Ã£o, mostrar novo custo/cota e pedir confirmaÃ§Ã£o.
- NÃ³ gerativo e FlowRun sÃ³ ficam concluÃ­dos quando o Asset estiver persistido; enfileiramento nÃ£o significa conclusÃ£o. Custo final deve vir da Generation, nÃ£o do retorno de enqueue.

## Custo e uso

Separar `billingMode = api | subscription | local`. API mantÃ©m estimativa em USD/BRL e informa se o valor posterior foi medido pelo provider ou calculado por tabela; custo desconhecido nÃ£o vira zero. Assinatura registra plano/cota/uso apenas quando retornados, sem contabilizar ausÃªncia de preÃ§o como economia comprovada. Processamento local informa ausÃªncia de cobranÃ§a de geraÃ§Ã£o por API, sem alegar infraestrutura gratuita.

ConfirmaÃ§Ã£o por execuÃ§Ã£o cobre imagem, vÃ­deo e uso da assinatura. A autorizaÃ§Ã£o de login nÃ£o autoriza geraÃ§Ã£o. Para os testes reais nesta colaboraÃ§Ã£o, apresentar o passo exato e seu custo/cota antes de solicitar a aprovaÃ§Ã£o de execuÃ§Ã£o.

## Limite de evidÃªncia da geraÃ§Ã£o de imagem

O login tem caminho documentado. A rota de imagem via OAuth mencionada no planejamento anterior tem evidÃªncia histÃ³rica em plugin Hermes; ela nÃ£o foi testada nesta conta. NÃ£o Ã© requisito reescrever o OAuth do Hermes: priorizar autenticaÃ§Ã£o gerida pelo App Server e verificar, na versÃ£o fixada, se hÃ¡ uma operaÃ§Ã£o de imagem controlÃ¡vel e artefato recuperÃ¡vel.

Antes de habilitar geraÃ§Ã£o, provar protocolo, ferramenta/modelo, captura do resultado e comportamento de retry. Se o App Server nÃ£o fornecer essa capacidade, registrar o bloqueio e preparar um adendo especÃ­fico para outro adaptador experimental. NÃ£o declarar a integraÃ§Ã£o inteira concluÃ­da sÃ³ porque o login funciona.

## CritÃ©rios de aceite

- [ ] Conectar, cancelar, expirar e desconectar pela interface local; reconexÃ£o nÃ£o altera a sessÃ£o Codex existente.
- [ ] ProviderConnection persistida e isolada; nenhuma credencial em resposta, grafo, logs ou banco.
- [ ] Provider/conexÃ£o/modelo salvos por nÃ³; incompatibilidade e executor offline bloqueiam envio.
- [ ] ConexÃ£o autenticada e capacidade de imagem aparecem como estados independentes.
- [ ] Testes com dois workers, entrega duplicada, queda apÃ³s envio, erro de upload e retry comprovam ausÃªncia de reenvio automÃ¡tico.
- [ ] Teste com adaptadores falsos comprova Asset de imagem de um provider alimentando vÃ­deo de outro e retry sem regenerar upstream.
- [ ] Fal.ai preservada; fluxos antigos continuam legÃ­veis e geram apenas apÃ³s confirmaÃ§Ã£o.
- [ ] Primeira imagem OAuth real, apÃ³s autorizaÃ§Ã£o especÃ­fica, persiste Asset e uso/custo observado.
- [ ] OAuth remoto sÃ³ Ã© liberado apÃ³s testes de autorizaÃ§Ã£o de todas as rotas que poderiam consumir a conexÃ£o.

## Fontes e verificaÃ§Ã£o

- [Codex App Server](https://developers.openai.com/codex/app-server): incorporaÃ§Ã£o no produto, mÃ©todos de conta/login/logout e limites; consultado em 2026-09-11.
- [AutenticaÃ§Ã£o OpenAI](https://developers.openai.com/codex/auth): separaÃ§Ã£o de assinatura ChatGPT e acesso por chave/API; consultado em 2026-09-11.
- EvidÃªncia local: `codex --version` â†’ `0.153.4`; `codex app-server generate-json-schema` â†’ contratos `LoginAccountParams` e `LoginAccountResponse` com `chatgpt` e `chatgptDeviceCode`. Isso verifica formato de protocolo, nÃ£o login na conta.
- EvidÃªncia histÃ³rica de imagem: [plano de 2026-09-10](PLANO-CHATGPT-MCP-E-PRODUCAO.md), seÃ§Ã£o 3. Sem nova chamada de geraÃ§Ã£o nesta sessÃ£o.
