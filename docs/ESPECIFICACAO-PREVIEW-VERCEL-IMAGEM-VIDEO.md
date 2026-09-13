# Preview Vercel — Imagem OpenAI → Vídeo por nó

**Branch:** `preview/vercel-image-to-video`
**Status:** especificação para aprovação antes de commit, push e preview Vercel
**Objetivo:** provar no navegador publicado o primeiro fluxo real que usa a assinatura ChatGPT apenas para gerar a imagem-base e um provider de vídeo separado para animar essa imagem.

## Decisão de produto

O fluxo não usa nem tentará usar vídeo pela OpenAI.

```text
Prompt / referências
        ↓
Nó Gerar Imagem — OpenAI / ChatGPT subscription
        ↓
Asset de imagem persistido na Biblioteca
        ↓
Nó Gerar Vídeo — fal.ai API (modelo escolhido)
        ↓
Asset de clipe MP4 persistido na Biblioteca
        ↓
(opcional) Extend / Montagem / trilha
```

- **OpenAI/ChatGPT:** origem da imagem-base, consumindo cota da assinatura. O LabIA mostra `API: R$0` e `Cota da assinatura: indisponível`, sem chamar isso de grátis.
- **fal.ai:** provider de vídeo. O LabIA mostra estimativa em R$ antes de qualquer envio e não faz fallback automático para API/modelo diferente.
- **Asset:** é o contrato entre os nós. O nó de vídeo recebe a imagem persistida, não uma URL efêmera nem Base64 do navegador.

## Resultado que este preview precisa provar

1. Um usuário autorizado abre a URL preview Vercel e vê executor local `online` ou `offline` de forma explícita.
2. Cria ou abre um fluxo com `Gerar Imagem → Gerar Vídeo → Saída`.
3. Seleciona uma conexão OpenAI já pareada e um modelo de imagem já confirmado pelo executor local.
4. Seleciona fal.ai e modelo/duração/resolução de vídeo no nó de vídeo.
5. Vê uma confirmação única que separa:
   - imagem OpenAI: assinatura, cota não mensurável;
   - vídeo fal.ai: valor estimado em R$ por nó;
   - processamento local/montagem: R$0 de geração, se aplicável.
6. Após confirmação explícita, a execução é criada uma única vez.
7. O worker local consome a fila, gera primeiro a imagem, persiste o Asset, usa esse Asset no vídeo e persiste o MP4.
8. A Vercel exibe estado por nó e a Biblioteca mostra os dois Assets.
9. Se o executor/local worker estiver desligado, o preview não finge executar: mostra `executor offline`, não envia OpenAI nem troca silenciosamente para API paga.

## Arquitetura do preview

### Vercel

Responsável por interface, autorização, APIs curtas, criação de FlowRun, confirmação assinada, estado e leitura de Assets. Não acessa `127.0.0.1`, não recebe credenciais ChatGPT e não abre o Codex App Server.

### Banco/fila compartilhados

Supabase/Postgres é o ponto de encontro. A Vercel cria o FlowRun e publica jobs na fila persistente. O executor/worker local já trabalha pelo banco; isso permite que o computador de Felipe faça polling de saída sem uma porta local aberta para a internet.

### Computador local de Felipe

Roda dois processos distintos:

1. `provider:executor`: mantém `CODEX_HOME` dedicado, OAuth ChatGPT e execução de imagem OpenAI.
2. `worker`: consome a fila, chama o executor local para nós OpenAI, chama fal.ai para vídeo e persiste Assets.

O computador precisa estar ligado para processamento com assinatura e ffmpeg. Desligado não cancela nem troca a execução; ela fica bloqueada/aguardando com estado explícito.

### Pareamento publicado

A interface publicada não chama o executor por `LABIA_PROVIDER_EXECUTOR_URL`. Para O5, o executor publica apenas heartbeat e capacidades permitidas por um canal de saída autenticado:

- identidade de executor e workspace;
- conexão `online/offline`;
- modelos de imagem já permitidos;
- versão/protocolo e horário da última verificação;
- comandos correlacionados com TTL, quando indispensáveis.

Tokens ChatGPT, `CODEX_HOME`, device code, URLs de login e logs brutos nunca passam pela Vercel, banco ou navegador publicado.

## Escopo desta branch

### Incluído

- corrigir o caminho publicado para ler estado/capacidades persistidos do executor pareado;
- autorização por owner/workspace em conexões, flows, confirmação, runs, Assets e Biblioteca;
- execução assíncrona via fila e worker local;
- OpenAI imagem → Asset → fal.ai vídeo;
- status de executor, run e nós sem screenshots como mecanismo de teste;
- preview Vercel isolado da `main`.

### Fora de escopo

- vídeo OpenAI;
- Google/Seedance direto;
- túnel público para localhost;
- MCP remoto;
- multiusuário comercial;
- publicação TikTok Shop;
- vídeo longo, avatar, lip-sync e direção automática.

## Gates de segurança e custo

1. Conexão OpenAI precisa pertencer ao owner/workspace e estar `connected`, com executor `online` e imagem elegível.
2. O nó de vídeo precisa ter provider/modelo fal.ai elegível e estimativa fresca.
3. A confirmação inclui snapshot de revisão, provider, conexão, modelo, parâmetros e modos de cobrança.
4. Cada nó usa `operationKey`; duplo clique, retry de HTTP ou restart do worker não reenviam geração já submetida.
5. `submission_unknown` bloqueia reenvio automático.
6. Falta de executor não autoriza fallback para uma chave OpenAI API nem para outro provider.
7. Falta de saldo/crédito fal.ai vira erro explícito e preserva a imagem-base; não apaga o run.

## Plano de implementação e validação

### Fase A — isolar e publicar preview

1. Revisar as 74 alterações locais e separar apenas código, migrations, testes e documentação do LabIA; excluir `.maestri/`, `.hermes/`, `.env*` e arquivos pessoais.
2. Criar commit da branch `preview/vercel-image-to-video`.
3. Fazer push e confirmar URL de preview da Vercel.
4. Confirmar que a Vercel usa banco/Storage de staging ou ambiente explicitamente aprovado; nunca apontar preview para credencial local.

**Prova:** build Vercel passa; URL preview abre; nenhuma rota publicada tenta `127.0.0.1:4317`.

### Fase B — pareamento O5 mínimo

1. Criar contrato de heartbeat/capacidades assinado entre executor local e backend publicado.
2. Persistir apenas estado sanitizado e catálogo de modelos permitidos.
3. Alterar UI publicada para consumir estado persistido, não `image-options` local síncrono.
4. Escrever testes de owner/workspace, executor offline, heartbeat expirado e conexão de outro workspace.

**Prova:** derrubar executor mostra offline no preview; religar atualiza online sem novo login; token e caminho local não aparecem em resposta/DOM/log.

### Fase C — tracer bullet real

1. Criar fluxo mínimo com três nós: imagem OpenAI, vídeo fal.ai, saída.
2. Confirmar imagem de assinatura e custo do único clipe fal.ai separadamente, com valor mostrado no momento.
3. Executar uma imagem; confirmar Asset na Biblioteca.
4. Executar um clipe de 5 s no modelo fal.ai escolhido; confirmar MP4 reproduzível e custo observado.
5. Testar worker restart entre imagem e vídeo: a imagem não pode ser gerada novamente.

**Prova:** dois Assets persistidos, um FlowRun concluído, `operationKey` único por nó e nenhum submit duplicado.

## Critérios de aceite

- [ ] Preview Vercel existe a partir desta branch e não altera `main`.
- [ ] Interface publicada não depende de loopback/local HTTP.
- [ ] Executor pareado mostra estado real e não exige novo login em restart.
- [ ] OpenAI gera somente a imagem-base.
- [ ] fal.ai gera o vídeo a partir do Asset de imagem.
- [ ] Custo/cota aparecem corretamente antes da execução.
- [ ] Executor/worker offline produzem erro legível, sem fallback pago.
- [ ] Primeiro clipe real e os Assets são verificáveis na Biblioteca.

## Decisão necessária antes do primeiro custo

Escolher o modelo fal.ai e aprovar o valor exibido para um único clipe de 5 segundos. A branch, os testes e o preview não autorizam consumo de fal.ai por si só.
