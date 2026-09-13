# OpenAI OAuth e providers por nó — especificação

Data: 2026-09-11. **Status atualizado em 2026-09-13: O1 validado localmente; O2 preservado; O3 implementado contra o contrato oficial do App Server 0.154.0 com fixtures, sem geração real.** A primeira imagem ainda não foi validada. Complementa as especificações dos módulos 01, 02 e 03. Plano executável: [CONSTRUCAO](OAUTH-OPENAI-CONSTRUCAO.md).

## Decisão de produto já recebida

Não existe provider principal do LabIA. Cada nó gerativo escolhe **Provider → Conexão → Modelo**. A fal.ai continua disponível. O pedido atual prioriza conectar a conta OpenAI por OAuth; Seedance direto e Google são próximos adaptadores, não dependências para começar o login.

O pedido define o resultado desejado. O código implementa a operação oficial local testável e mantém a validação da capacidade separada: somente uma imagem real autorizada pode alterar o estado de validação.

## Experiência proposta

1. No nó Gerar Imagem, Felipe escolhe OpenAI e aciona **Conectar ChatGPT**.
2. O LabIA mostra o login iniciado pelo executor dedicado; Felipe autentica diretamente na OpenAI. Preferir código de dispositivo quando suportado pela conta; usar navegador com callback local como alternativa.
3. A conexão aparece como **Conectada**, com estado do executor e última verificação. A capacidade de imagem aparece separadamente como **Não validada**, **Disponível** ou **Indisponível**.
4. O seletor de modelo respeita a conexão e as capacidades verificadas. Login bem-sucedido não habilita automaticamente geração de imagem.
5. Ao executar, a confirmação discrimina **API: estimativa em R$** e **Assinatura: usa a cota do plano**. Se a cota não puder ser consultada, mostrar **Cota indisponível**; não mostrar “grátis”, “ilimitado” ou converter cota em créditos de API.
6. O resultado pronto vira Asset reutilizável na Biblioteca e na entrada de um nó de vídeo, independentemente do provider de origem.

Todos os controles seguem DESIGN-SYSTEM.md; conexões são infraestrutura de apoio ao canvas. Trocar provider limpa conexão/modelo incompatíveis e exige nova estimativa. Não fazer fallback automático para outra conexão, conta ou API paga.

## Autenticação proposta

Usar **Codex App Server**, executado como processo local dedicado e controlado pelo LabIA por stdio. A documentação oficial descreve sua incorporação em outros produtos e os métodos de login. O protocolo foi conferido no CLI instalado `0.154.0`, com geração local de JSON Schema, sem iniciar login ou geração.

- Inicializar o protocolo e negociar recursos antes dos comandos de conta.
- Login: `account/login/start` com `chatgptDeviceCode` ou `chatgpt`; acompanhar `account/login/completed` e confirmar com `account/read`.
- Implementar cancelamento, timeout, logout e reconexão. Correlacionar eventos por tentativa de login, executor e conexão; ignorar conclusão de tentativa cancelada/antiga.
- Consultar limites somente quando disponíveis; persistir data da leitura e manter estado desconhecido quando não houver dados. Nunca consumir reset ou comprar créditos automaticamente.
- Usar diretório de credenciais dedicado, fora do repositório, com proteção do usuário do sistema. Configurar o ambiente apenas no processo filho. Não ler/copiar a sessão do aplicativo Codex nem compartilhar seu diretório de autenticação.
- Tokens e refresh ficam sob gestão do App Server. Banco, grafo, logs, retornos de API e navegador não recebem tokens OpenAI. A configuração versionada contém somente referências; segredos configuráveis do LabIA continuam em `.env.local`.
- Não implementar um cliente OAuth público inventado, não embutir client secret no navegador e não tratar o token ChatGPT como chave da API pública de imagens.

**Implantação:** primeiro validar login com interface e executor locais, sem consumir filas de geração. Para usar a interface publicada na Vercel, adicionar sessão autenticada do dono e autorização de workspace nas rotas de conexões, flows, execução, retry, generations e assets antes de habilitar a conexão. O backend publicado encaminha comandos por canal autenticado ao executor, que abre conexão de saída; não expor App Server ou terminal diretamente à internet. O callback local só funciona no computador do executor; acesso remoto deve usar o fluxo de dispositivo, quando disponível.

O mecanismo de sessão e o pareamento remoto serão detalhados antes da etapa de publicação. A primeira entrega local não será apresentada como OAuth funcionando na Vercel.

## Contratos comuns

| Entidade | Campos e responsabilidade propostos |
|---|---|
| ProviderConnection | `id`, `workspaceId`, identidade do dono, `providerId`, `authMethod`, `label`, `status`, `executorId`, `credentialRef`, `lastVerifiedAt`, capacidades verificadas e data da prova. Sem tokens no registro. |
| Configuração do nó | `providerId`, `connectionId`, `modelId`, parâmetros. Montagem usa processamento LabIA e não exige OAuth. |
| Generation | Snapshot imutável de provider/conexão/modelo, parâmetros e inputs; modo de cobrança; chave da operação; estado de envio; identificador remoto; estimativa/uso observado; vínculo a run e nó. |
| Asset | Arquivo persistido, tipo/MIME/dimensões/duração, workspace, Generation e procedência. Binário/base64/URL do provider são normalizados pelo adaptador antes do armazenamento. |

`ProviderConnection` só é resolvida dentro do workspace e do dono autorizado. Um ID recebido pelo cliente não comprova acesso. Conexão desconectada, executor offline ou capacidade incompatível produz erro antes de enviar geração.

A camada comum deve oferecer catálogo/capacidades, estimativa, envio, acompanhamento/recuperação e normalização de resultados. O runner conhece somente contratos e estados. Particularidades fal.ai/OpenAI ficam nos adaptadores, incluindo polling versus streaming e recuperação possível por cada serviço.

Para fluxos antigos, preservar `provider = fal` e modelo existentes via compatibilidade explícita. Associar a conexão fal do workspace por migração controlada; não criar um default global para nós novos. Não apagar, recriar nem executar o fluxo manual informado pelo Felipe.

**Seedance é também nome de família de modelos.** Usar Seedance por fal.ai mantém Provider = fal.ai. Uma conexão separada Seedance só será habilitada depois de identificar serviço/API de acesso, credenciais e contrato. A mesma distinção vale para modelos Google acessados por agregadores.

## Proteção contra envio duplicado e retry

- Uma chave única da operação por run/nó/tentativa lógica impede que entrega duplicada da fila crie outra Generation. Geração avulsa recebe chave própria. Nova geração intencional cria nova tentativa; retry técnico mantém a mesma.
- Reservar a operação atomicamente no banco antes do envio, com controle de concorrência. A fila deve ser recuperável após falha entre criar Generation e enfileirar, sem chamar o provider.
- Estados de envio: `not_submitted`, `submitting`, `submitted`, `submission_unknown`, `completed` e `failed`. Uma operação deixada em `submitting` após queda exige reconciliação; não autoriza novo submit.
- Com identificador remoto persistido, retomar acompanhamento/resultado. Sem identificador após timeout ou queda durante envio, marcar `submission_unknown` e não reenviar automaticamente. Idempotência remota só pode ser usada quando o provider a documentar e suportar.
- Não prometer exactly-once sobre um serviço sem idempotência/reconciliação. Na incerteza, parar e explicar que uma geração pode ter sido aceita.
- Persistir resultado recuperável antes de finalizar Assets. Upload/storage com erro repete somente persistência; chave única por Generation/índice evita Assets duplicados. Resultado perdido e não recuperável permanece explícito, sem nova geração silenciosa.
- Retry seletivo mantém Assets anteriores e ramos independentes. Apenas o nó falho é retomado; descendentes bloqueados aguardam seu resultado. Bloquear retry concorrente e tentativa ambígua. Se houver necessidade de nova geração, mostrar novo custo/cota e pedir confirmação.
- Nó gerativo e FlowRun só ficam concluídos quando o Asset estiver persistido; enfileiramento não significa conclusão. Custo final deve vir da Generation, não do retorno de enqueue.

## Custo e uso

Separar `billingMode = api | subscription | local`. API mantém estimativa em USD/BRL e informa se o valor posterior foi medido pelo provider ou calculado por tabela; custo desconhecido não vira zero. Assinatura registra plano/cota/uso apenas quando retornados, sem contabilizar ausência de preço como economia comprovada. Processamento local informa ausência de cobrança de geração por API, sem alegar infraestrutura gratuita.

Confirmação por execução cobre imagem, vídeo e uso da assinatura. A autorização de login não autoriza geração. Para os testes reais nesta colaboração, apresentar o passo exato e seu custo/cota antes de solicitar a aprovação de execução.

## Limite de evidência da geração de imagem

O login tem caminho documentado. A rota de imagem via OAuth mencionada no planejamento anterior tem evidência histórica em plugin Hermes; ela não foi testada nesta conta. Não é requisito reescrever o OAuth do Hermes: priorizar autenticação gerida pelo App Server e verificar, na versão fixada, se há uma operação de imagem controlável e artefato recuperável.

Antes de validar a capacidade, provar protocolo, ferramenta/modelo, captura do resultado e comportamento de retry. O adapter usa somente o App Server oficial; não usa `chatgpt.com/backend-api/codex/responses` nem o adapter Hermes. Não declarar a integração inteira concluída só porque o login funciona.

## Critérios de aceite

- [ ] Conectar, cancelar, expirar e desconectar pela interface local; reconexão não altera a sessão Codex existente.
- [ ] ProviderConnection persistida e isolada; nenhuma credencial em resposta, grafo, logs ou banco.
- [x] Provider/conexão/modelo são selecionáveis por nó; fal.ai permanece compatível e OpenAI bloqueia envio até contrato de imagem.
- [ ] Conexão autenticada e capacidade de imagem aparecem como estados independentes.
- [ ] Testes com dois workers, entrega duplicada, queda após envio, erro de upload e retry comprovam ausência de reenvio automático.
- [ ] Teste com adaptadores falsos comprova Asset de imagem de um provider alimentando vídeo de outro e retry sem regenerar upstream.
- [ ] Fal.ai preservada; fluxos antigos continuam legíveis e geram apenas após confirmação.
- [ ] Primeira imagem OAuth real, após autorização específica, persiste Asset e uso/custo observado (ainda não executada nesta rodada).
- [ ] OAuth remoto só é liberado após testes de autorização de todas as rotas que poderiam consumir a conexão.

## Fontes e verificação

- [Codex App Server](https://developers.openai.com/codex/app-server): incorporação no produto, métodos de conta/login/logout e limites; consultado em 2026-09-11.
- [Autenticação OpenAI](https://developers.openai.com/codex/auth): separação de assinatura ChatGPT e acesso por chave/API; consultado em 2026-09-11.
- Evidência local: `codex --version` → `codex-cli 0.154.0`; o schema e os testes oficiais locais sustentam `thread/start`, `turn/start`, `item/completed` com `imageGeneration`, recuperação por `thread/read`/`thread/items/list` e `result` Base64/`savedPath`. Isso verifica o contrato do protocolo, não login ou geração na conta.
- Evidência histórica de imagem: [plano de 2026-09-10](PLANO-CHATGPT-MCP-E-PRODUCAO.md), seção 3. Sem nova chamada de geração nesta sessão.
