# Mensagem para continuar o LabIA no ChatGPT

Cole o texto abaixo no ChatGPT com acesso ao repositório [zilli26/LabIA](https://github.com/zilli26/LabIA), branch `main`. Comece pelo README e pela seção mais recente de RETOMADA. Se o conector ainda não enxergar os arquivos, anexe este documento e `PLANO-CHATGPT-MCP-E-PRODUCAO.md`.

---

Quero continuar o projeto LabIA por este ChatGPT. O planejamento foi preparado no Codex em 10/09/2026; quero usar o ChatGPT como interface de trabalho e, futuramente, operar o LabIA por MCP de qualquer cliente autorizado. Não me encaminhe automaticamente de volta para a interface Codex.

Meu objetivo é criar vídeos de produtos para TikTok Shop, com um personagem sintético por conta, referências consistentes, prompts padronizados e cenas bem conectadas. Quero reutilizar minhas assinaturas OpenAI e Google. Futuramente o cliente deve poder usar sua conexão quando suportada ou pagar por geração via APIs do LabIA. Vídeos de até 15 minutos são objetivo posterior, por montagem em blocos.

Leia `docs/PLANO-CHATGPT-MCP-E-PRODUCAO.md` no repositório `zilli26/LabIA`. Leia também AGENTS.md, docs/00-VISAO.md, docs/RETOMADA.md, docs/03-ROADMAP.md, docs/01-ARQUITETURA.md e os quatro documentos dos módulos afetados. Identifique a revisão atual de `main`. Não presuma que acesso ao GitHub permite escrever, executar testes ou hospedar serviços. Informe as capacidades que suas ferramentas de fato oferecem e avance com o que estiver disponível.

Estado de produto: canvas React Flow e geração de imagem existem. Vídeo, extensão, montagem e upload de trilha estão implementados até a tarefa 7 da E2, mas o vídeo completo não foi validado por geração real e falta retry seletivo. A auditoria inicial tinha HEAD local aa87af9, 112 testes aprovados e site 19 commits atrás; esses são dados históricos anteriores à publicação do projeto no GitHub. Use a seção mais recente de RETOMADA e a revisão atual do repositório para verificar o estado presente. O site é https://labia-hazel.vercel.app; conferir separadamente o commit implantado e a disponibilidade do worker.

Há evidência concreta de imagem por OAuth no Hermes: https://github.com/NousResearch/hermes-agent/blob/e83816a4d1998245968949e88fa15f26d89800c0/plugins/image_gen/openai-codex/__init__.py . O plugin usa referências e image_generation com a autenticação ChatGPT/Codex. Isso é uma rota de terceiro a testar na minha conta; não é prova de integração já pronta no LabIA. Não repita que assinatura necessariamente só serve a texto. O nome técnico do backend não muda minha escolha de interface ChatGPT.

Para Google, separe Gemini CLI/login, Gemini API/OAuth com projeto Cloud, e Google Flow/assinatura. Prove login, capacidade de imagem/vídeo, consumo e recuperação do arquivo em cada rota. Não confunda chave API, token OAuth e sessão do navegador. Investigue pontes existentes sem tratá-las como API oficial; não instale nem exponha credenciais sem necessidade, não contorne desafios de acesso e não migre silenciosamente para uma API paga.

Arquitetura desejada: ChatGPT → MCP autenticado → serviços comuns LabIA → fila persistente → executor pessoal ou provedor API → biblioteca. O canvas usa os mesmos serviços. O MCP não é um modelo e não paga geração. O backend atual usa workspace padrão, então autorização por usuário/workspace deve vir antes de expor ferramentas com dados ou execução. Processamento longo deve retornar runId, persistir progresso e permitir retomada.

Comece por P0/P1: conferir acesso ao projeto, consolidar a matriz das conexões e preparar a prova mínima de OAuth OpenAI + Google. Escreva as specs e construção necessárias para revisão, com critérios de aceite, antes de implementar módulos. Esta mensagem autoriza essa preparação; não autoriza executar todo o roadmap, gerar mídia, publicar ou gastar.

Depois faremos MCP mínimo, referências/personagem/produto, quatro cenas estáticas, um clipe, duas cenas com emenda avaliada, MP4 de 30–60s e só então 3–15 minutos. Planeje roteiro, áudio, estado inicial/final de cena e escolha de transição; não use apenas extensão repetida até atingir a duração.

Toda geração precisa informar fonte de cobrança, custo estimado em R$ e cota/créditos quando aplicável. Peça minha aprovação para cada geração real conforme as regras do projeto. Se o consumo for desconhecido, diga desconhecido. Não use um booleano criado pelo modelo como prova de autorização. Cotação, revisão do fluxo, teto, idempotência e retry devem impedir cobrança duplicada ou refação de cenas aprovadas.

Registre evidências reais: testes executados, request IDs, arquivos finais, persistência e consumo. Validação técnica por testes/DOM/dados/metadados, sem screenshots da UI; eu avalio a qualidade criativa dos arquivos. Não exponha segredos em mensagens, commits ou logs. Atualize RETOMADA ao encerrar e termine cada etapa com resultado, pendências e o próximo teste específico.
