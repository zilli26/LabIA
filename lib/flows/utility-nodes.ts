import type { NodeDefinition } from "@/lib/flows/types";
import { zeroCost } from "@/lib/flows/types";

export const utilityNodeDefinitions: NodeDefinition[] = [
  {
    type: "text-input",
    label: "Texto",
    description: "Entrada de texto para briefing, prompt ou contexto.",
    inputs: [],
    outputs: [
      {
        id: "text",
        label: "Texto",
        type: "text",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      const text = typeof ctx.params.text === "string" ? ctx.params.text : "";

      return {
        outputs: {
          text,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "text-input",
    },
  },
  {
    type: "note",
    label: "Nota",
    description: "Anotação interna que pode receber e repassar qualquer valor.",
    inputs: [
      {
        id: "input",
        label: "Entrada",
        type: "any",
      },
    ],
    outputs: [
      {
        id: "output",
        label: "Saída",
        type: "any",
      },
    ],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      return {
        outputs: {
          output: ctx.inputs.input ?? ctx.inputs,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "note",
    },
  },
  {
    type: "asset-output",
    label: "Saída",
    description: "Destino lógico do resultado produzido pelo fluxo.",
    inputs: [
      {
        id: "input",
        label: "Entrada",
        type: "any",
      },
    ],
    outputs: [],
    estimateCost() {
      return zeroCost;
    },
    async execute(ctx) {
      return {
        outputs: {
          received: ctx.inputs.input ?? ctx.inputs,
        },
        actualCost: zeroCost,
      };
    },
    ui: {
      componentKey: "labNode",
      kind: "asset-output",
    },
  },
];
