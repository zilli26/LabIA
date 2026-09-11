# ADR 0002 — Provider por nó, sem provider principal

**Data:** 2026-09-11  
**Status:** aceito por decisão explícita de produto

## Contexto

A primeira implementação do LabIA integrou fal.ai diretamente em partes de nós/jobs e documentos históricos passaram a descrevê-la como gateway/provider principal. Isso foi útil para provar E1/E2, mas conflita com a direção multi-provider do produto e com conexões pessoais por assinatura.

O1 introduz a primeira `ProviderConnection` pessoal (OpenAI/ChatGPT via Codex App Server), sem remover fal.ai.

## Decisão

O LabIA não terá provider principal.

Todo nó gerativo deve selecionar explicitamente:

`Provider → Conexão → Modelo`

- **Provider** identifica a integração/protocolo (fal.ai, OpenAI via Codex App Server, futuros providers).
- **Conexão** identifica a credencial/sessão autorizada para aquele workspace/dono.
- **Modelo** é escolhido dentro das capacidades comprovadas daquela conexão/provider.

O executor resolve essa seleção; não existe troca silenciosa entre providers.

## Consequências

1. fal.ai permanece disponível e continua suportando os fluxos atuais até migração deliberada dos nós.
2. login OpenAI não altera grafos existentes nem habilita geração OpenAI automaticamente.
3. conexão autenticada, capacidade disponível e geração real validada são estados independentes.
4. fallback para API paga exige seleção/cotação/autorização explícitas; nunca é automático.
5. `ProviderCapabilities` é evidência por conexão/provider e não uma suposição baseada em login.
6. os campos futuros do grafo devem persistir provider, connectionId e model para manter `FlowRun` reproduzível.
7. código histórico que instancia `FalProvider` diretamente é dívida de migração; O1 não a refatora além do necessário para a conexão.
8. retries de geração devem respeitar idempotência/reconciliação do provider; o débito atual de reenvio pós-submit continua bloqueador antes de validar geração por nova conexão.

## Compatibilidade

Nenhuma migration de O1 modifica `Flow.graph` existente. Ausência dos novos campos em grafos antigos continua significando o comportamento legado já persistido até a etapa específica de migração de nós.

## Alternativas rejeitadas

- tornar OpenAI o novo provider principal;
- manter fal.ai como default invisível permanente;
- copiar a sessão atual do Codex para acelerar OAuth;
- converter OAuth ChatGPT em chave da API pública OpenAI;
- fallback automático para API paga quando a assinatura não estiver disponível.
