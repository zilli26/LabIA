# 07-Research — Como funciona

## Fluxo do usuário

1. Cria uma pesquisa: tema ("stablecoins BR"), fontes (lista de sites/perfis ou "aberto"), recorrência, profundidade.
2. Vê custo estimado por execução; confirma.
3. Worker roda no horário: busca (API de search — decidir provedor na P8: Tavily/Brave/Perplexity API), lê fontes, sintetiza briefing com citações.
4. Briefing chega ao feed (e opcionalmente e-mail/notificação). Pode ser conectado a fluxos: Nó Research → Nó Copy.
5. Pesquisa profunda: mesmo pipeline com múltiplas passadas (ampla → verificação → síntese), estilo o loop de verificação da E0.

## Regras de negócio
- `ResearchJob` persiste: query, fontes usadas, custo real, resultado.
- Rate limits e custos do provedor de search na tabela de custos (04-CUSTOS).
- Backend LLM: preferir rota por assinatura quando disponível (P6) — research é uso intensivo de tokens.

## Dependências
pg-boss agendado (existe desde E1) · provedor de search (pesquisa P8, abrir na E6) · módulo 03 (nó).
