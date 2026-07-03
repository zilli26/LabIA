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

## AI Video Director (nó-agente, E3)

Briefing → LLM (via assinatura ou API, ver P6) → devolve um **fluxo proposto** (JSON de nós/arestas) + shotlist + custo estimado. O usuário revisa/edita o fluxo gerado ANTES de executar — o Director propõe, o humano aprova, o motor executa.

Regras vindas das pesquisas: o Director gera um **bloco de consistência por cena** (personagem, iluminação, câmera, estilo re-declarados em cada segmento — P2, evita "deriva" entre clipes) e escolhe o modelo POR CENA considerando custo (Wan p/ cenas simples, Kling/Veo p/ cenas-chave — P1). Referência de mercado: o "Mr. Higgs" do Higgsfield (P4) valida o conceito; nosso diferencial é a estimativa de custo total antes de gerar.
