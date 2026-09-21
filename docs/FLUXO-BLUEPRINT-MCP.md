# Blueprint de produção do LabIA

## O que esta branch entrega

O template `product-production-blueprint` cria um Flow real para um vídeo curto de produto:

```text
Briefing → Contexto do Projeto

Imagem-base → Animar imagem → Revisar / escolher → Continuar clipe ─┐
                           └──────────────────────────────────────────┤
                                                Juntar clipes → Saída
```

O Flow é criado no banco pelo launcher `/criar` e aberto no canvas canônico. Ele começa pendente de uma imagem-base e de prompts de movimento; criar o Flow não gera mídia.

## Por que este é o fluxo certo para aprender

Ele separa as decisões que normalmente ficam misturadas:

1. **Briefing:** qual hipótese o vídeo precisa responder.
2. **Contexto:** o que o Projeto já sabe sobre produto, formato e referências.
3. **Fonte:** qual imagem real será usada como primeiro frame.
4. **Teste:** um clipe curto com custo estimado antes da execução.
5. **Revisão:** decisão humana antes de expandir uma direção ruim.
6. **Expansão:** continuar somente o clipe aprovado.
7. **Finalização:** juntar os clipes localmente e preservar a saída.

## Lente MCP, sem fingir que já existe um servidor

O grafo registra `mcpTool` nos parâmetros dos nós para tornar a futura camada de ferramentas explícita:

| Etapa | Futura ferramenta | Regra atual |
|---|---|---|
| Contexto | `read_project_context` | Nota local, sem chamada externa |
| Teste | `estimate_and_request_generation` | Estimativa + confirmação humana |
| Revisão | `record_human_decision` | Gate visual/documental, sem execução automática |
| Continuidade | `extend_approved_clip` | Só depois do clipe aprovado |
| Finalização | `assemble_approved_clips` | Montagem local, custo R$0 |

O próximo passo não é abrir um MCP remoto. É aprender o contrato de cada ação no Flow: entrada, saída, custo, aprovação, evidência e falha. Depois, um servidor MCP poderá expor essas ações sem criar uma segunda lógica paralela ao canvas.

## Estado de execução

- O template pode ser criado e editado sem worker ou executor.
- O nó `Animar imagem` continua sujeito ao modal de custo.
- `Continuar clipe` depende de um vídeo concluído.
- `Juntar clipes` é local e não dispara provider.
- Nenhuma geração é iniciada ao criar o template.
