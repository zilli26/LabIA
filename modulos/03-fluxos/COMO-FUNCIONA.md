# 03-Fluxos — Como funciona

## O motor (lib/flows/)

1. Usuário monta o grafo no canvas (React Flow JSON) e salva → `Flow`.
2. "Executar" cria um `FlowRun`: o motor ordena os nós topologicamente e enfileira no pg-boss os que não têm dependências pendentes.
3. Cada nó executado grava resultado (asset/texto/erro) no FlowRun; nós dependentes são liberados em cascata.
4. UI assina updates (Supabase Realtime) e anima o estado dos nós; custo acumulado atualiza a cada nó concluído.
5. Erro em nó: ramo para; outros ramos seguem; retry por nó.

## Contrato de nó (o que qualquer módulo implementa para ter um nó)

```ts
interface NodeDefinition {
  type: string;                    // "generate-image", "extend-video", "write-copy"...
  inputs: PortSpec[];              // tipos: text | image | video | copy | brand | any
  outputs: PortSpec[];
  estimateCost(params, inputs): CostEstimate;   // pode ser 0 (nós utilitários)
  execute(ctx): Promise<Outputs>;  // roda no worker, nunca no browser
  Component: ReactFlowNode;        // visual no canvas (segue DESIGN-SYSTEM)
}
```

Novos módulos = novos `NodeDefinition` registrados num registry central. O motor não conhece módulos específicos.

## Provider, conexão e modelo

Decisão aprovada em 2026-09-11: não existe provider principal do LabIA. Para nós gerativos, a direção de arquitetura é **Provider → Conexão → Modelo** por nó.

- `ProviderConnection` representa uma conexão autorizada pertencente a workspace/dono e aponta para a credencial/sessão por referência segura.
- `ProviderCapability` registra o que foi realmente verificado naquela conexão; login sozinho não cria capability.
- O modelo é escolhido apenas depois do provider e da conexão.
- fal.ai continua sendo uma conexão/provider válido; não é removida nem transformada em fallback implícito.

A O1 implementa somente a camada de conexão ChatGPT local e seus controles. Os `NodeDefinition` existentes continuam usando o caminho legado de fal.ai até uma etapa posterior adaptar o contrato do runner com compatibilidade para fluxos salvos. Em particular, iniciar login não importa nem aciona as filas de `FlowRun`, imagem ou vídeo.

Quando a seleção por nó for integrada ao runner, o `FlowRun` deverá congelar a conexão/modelo escolhidos junto da revisão do grafo; trocar conexão depois não pode reinterpretar silenciosamente uma execução passada.

## AI Video Director (nó-agente, E3)

Briefing → LLM (via assinatura ou API, ver P6) → devolve um **fluxo proposto** (JSON de nós/arestas) + shotlist + custo estimado. O usuário revisa/edita o fluxo gerado ANTES de executar — o Director propõe, o humano aprova, o motor executa.

Regras vindas das pesquisas: o Director gera um **bloco de consistência por cena** (personagem, iluminação, câmera, estilo re-declarados em cada segmento — P2, evita "deriva" entre clipes) e escolhe o modelo POR CENA considerando custo (Wan p/ cenas simples, Kling/Veo p/ cenas-chave — P1). Referência de mercado: o "Mr. Higgs" do Higgsfield (P4) valida o conceito; nosso diferencial é a estimativa de custo total antes de gerar.
