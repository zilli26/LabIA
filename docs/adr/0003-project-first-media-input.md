# ADR 0003 — Projeto como casa e entrada de mídia por Asset

**Status:** aceita · **Data:** 2026-09-14

## Contexto

O primeiro corte de Projetos já cria um Flow principal, mas a produção de vídeo ainda pode parecer começar no canvas ou exigir uma geração de imagem antes de usar uma peça real. Isso mistura fonte, referência e resultado, perde o contexto do Projeto e favorece gasto sem direção. O plano de Projetos, referências importadas, vídeo e Production Director fixa um caminho Projeto-first sem copiar Higgsfield.

## Decisão

O **Projeto é a casa do trabalho** e o **canvas é a bancada de produção**. O Projeto reúne objetivo, formato, Assets, referências, Flow e resultados; o canvas monta, conecta, revisa e executa esse Flow, sempre mostrando o Projeto atual e oferecendo retorno explícito para ele.

Imagem-base e referência visual são papéis distintos de um `Asset` persistido e escopado por owner/workspace/Projeto. O nó utilitário `asset-input` seleciona um Asset e expõe saída tipada `image` ou `video`, depois de validar ownership, workspace, Projeto, tipo e papel. Ele não recebe entradas, não chama provider, não cria Generation/FlowRun/job e tem custo conhecido **R$0,00**. Importar ou selecionar mídia nunca é geração.

Uma imagem-base escolhida pode alimentar `Animar imagem` diretamente; gerar imagem é alternativa, não pré-requisito. Uma referência visual não vira primeiro frame automaticamente e só entra em uma etapa quando houver seleção explícita e suporte declarado. A procedência permite reabrir o Projeto e o Flow/FlowRun de um resultado.

## UX e direção

O canvas organiza a produção pela paleta contextual **Criar / Projeto / Pós-produção / Direção**. A validação de tipos acontece imediatamente na tentativa de conexão, com explicação curta e sugestão de caminho compatível; o backend continua autoridade final.

O Production Director é uma camada de decisão. Ele pode propor shotlist, grafo permitido, prompts, referências, modelos, riscos e custo estimado como rascunho. O usuário revisa e só então usa **Aplicar ao Flow**. Aplicar salva ou atualiza o grafo, mas não executa, enfileira nem cobra; a confirmação de custo da geração continua obrigatória.

## Consequências

- Vídeo de produto/TikTok Shop pode começar em uma imagem real importada, sem `image-generation` intermediário.
- O contrato separa claramente fonte, referência e resultado, evitando inferência por nome de arquivo, URL ou título.
- Upload/importação e `asset-input` têm custo zero conhecido, enquanto toda geração mantém estimativa antes e custo real depois.
- A implementação futura deve preservar compatibilidade dos tipos internos e Flows salvos, mas pode alterar os nomes públicos para `Animar imagem`, `Continuar clipe` e `Juntar clipes`.
- O Director permanece bloqueado para execução até a capacidade textual do executor estar comprovada; conexão OAuth não é prova suficiente.

## Fora deste ADR

Este ADR não autoriza código, migration, worker, login, acesso a segredo, API paga ou geração. Não altera o contrato do módulo 02 e não transforma vídeo importado em clipe estendível enquanto esse suporte não estiver declarado e validado.
