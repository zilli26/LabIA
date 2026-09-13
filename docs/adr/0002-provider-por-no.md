# ADR 0002 — Provider e conexão pertencem ao nó

Data: 2026-09-11. **Status: decisão de produto recebida do Felipe; detalhes técnicos propostos nos contratos OAuth, aguardando aprovação.**

## Contexto

O LabIA precisa combinar imagens por OAuth OpenAI, vídeo por outro serviço e montagem local. O código em `395e369` instancia FalProvider nos nós e jobs, e não possui ProviderConnection. Escolher um gateway principal impediria a composição pedida.

## Decisão

Não existe provider principal. Cada nó gerativo escolhe provider, conexão e modelo. Fal.ai continua disponível. O runner usa contratos comuns e Assets persistidos; os adaptadores resolvem autenticação, formato, acompanhamento e cobrança. Montagem permanece processamento local LabIA.

## Consequências

ProviderConnection e snapshots de execução passam a ser necessários. Custo de API e uso de assinatura são métricas distintas. Falhas de autenticação não acionam fallback pago. Compatibilidade de fluxos antigos deve explicitar fal.ai sem transformá-la em default para nós novos.

Por quê: a escolha é da etapa de produção e da conta disponível, não da plataforma inteira. Asset comum permite trocar o provider de uma etapa sem criar integração específica com a anterior.

OAuth local, autorização remota, anti-submit duplicado e retry estão detalhados na [especificação proposta](../OAUTH-OPENAI-ESPECIFICACAO.md) e no [plano de construção](../OAUTH-OPENAI-CONSTRUCAO.md).
