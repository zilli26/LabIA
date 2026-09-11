# 03-Fluxos — Como funciona

## O motor (lib/flows/)

1. Usuário monta o grafo no canvas (React Flow JSON) e salva → `Flow`.
2. "Executar" cria um `FlowRun`: o motor ordena os nós topologicamente e enfileira no pg-boss os que não têm dependências pendentes.
3. Cada nó executado grava resultado (asset/texto/erro) no FlowRun; nós dependentes são liberados em cascata.
4. UI assina updates (Supabase Realtime) e anima o estado dos nós; custo acumulado atualiza a cada nó concluído.
5. Erro em nó: ramo para; outros ramos seguem; retry por nó.

## Seleção de provider

Para nós gerativos, a direção canônica é:

`Provider → Conexão → Modelo`

- **Provider**: integração/protocolo que executa o modelo;
- **Conexão**: `ProviderConnection` autorizada para o workspace/dono, quando necessária;
- **Modelo**: modelo disponível e comprovado naquela combinação.

Não existe provider principal. O comportamento legado atual ainda possui nós/jobs que instanciam fal.ai diretamente; O1 não altera esses grafos. A migração posterior deve persistir a seleção no grafo e no snapshot do `FlowRun`, sem reinterpretação silenciosa de runs antigos.

`ProviderConnection` é gerida fora do motor de execução. Login, status, cancelamento, logout ou reconexão não iniciam `FlowRun`, não enfileiram pg-boss e não liberam nós.

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

A evolução desse contrato para nós gerativos precisa receber/resolver `provider`, `connectionId` e `model` sem quebrar definições utilitárias. Novos módulos = novos `NodeDefinition` registrados num registry central. O motor não conhece módulos específicos.

## O1 — OpenAI/ChatGPT local

O1 adiciona `ProviderConnection` + executor Codex App Server por stdio, mas **não implementa um `NodeDefinition` OpenAI**.

A UI `/conexoes` mostra separadamente:

1. conta ChatGPT;
2. capacidade de imagem;
3. geração real validada.

Após login, apenas o primeiro estado pode mudar. Capacidade e geração permanecem pendentes até validação autorizada posterior.

## AI Video Director (nó-agente, E3)

Briefing → LLM pelo `Provider → Conexão → Modelo` escolhido → devolve um **fluxo proposto** (JSON de nós/arestas) + shotlist + custo estimado. O usuário revisa/edita o fluxo gerado ANTES de executar — o Director propõe, o humano aprova, o motor executa.

Regras vindas das pesquisas: o Director gera um **bloco de consistência por cena** (personagem, iluminação, câmera, estilo re-declarados em cada segmento — P2, evita "deriva" entre clipes) e escolhe provider/modelo POR CENA considerando custo e capacidades verificadas. Referência de mercado: o "Mr. Higgs" do Higgsfield (P4) valida o conceito; nosso diferencial é a estimativa de custo total antes de gerar.
