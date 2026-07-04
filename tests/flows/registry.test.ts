import { describe, expect, it } from "vitest";

import { NodeDefinitionRegistry, getNodeDefinition, listNodeDefinitions, listSerializableNodeDefinitions } from "@/lib/flows/registry";
import { zeroCost } from "@/lib/flows/types";
import type { NodeDefinition } from "@/lib/flows/types";

function makeDefinition(type: string): NodeDefinition {
  return {
    type,
    label: type,
    description: `desc for ${type}`,
    inputs: [{ id: "in", label: "in", type: "any" }],
    outputs: [{ id: "out", label: "out", type: "any" }],
    estimateCost() {
      return zeroCost;
    },
    async execute() {
      return { outputs: {}, actualCost: zeroCost };
    },
    ui: { componentKey: "labNode", kind: type },
  };
}

describe("NodeDefinitionRegistry — isolated instance", () => {
  it("registers and looks up a definition by type", () => {
    const registry = new NodeDefinitionRegistry();
    const def = makeDefinition("custom-a");

    registry.register(def);

    expect(registry.get("custom-a")).toBe(def);
  });

  it("returns undefined for a type that was never registered", () => {
    const registry = new NodeDefinitionRegistry();

    expect(registry.get("does-not-exist")).toBeUndefined();
  });

  it("accepts an initial array of definitions via the constructor", () => {
    const defA = makeDefinition("a");
    const defB = makeDefinition("b");
    const registry = new NodeDefinitionRegistry([defA, defB]);

    expect(registry.list()).toEqual([defA, defB]);
  });

  it("throws when registering the same type twice", () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(makeDefinition("dup"));

    expect(() => registry.register(makeDefinition("dup"))).toThrow(
      /NodeDefinition already registered: dup/,
    );
  });

  it("list() returns all registered definitions", () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(makeDefinition("x"));
    registry.register(makeDefinition("y"));

    const types = registry.list().map((d) => d.type);
    expect(new Set(types)).toEqual(new Set(["x", "y"]));
  });

  it("listSerializable() strips estimateCost and execute but keeps metadata", () => {
    const registry = new NodeDefinitionRegistry();
    registry.register(makeDefinition("z"));

    const [serialized] = registry.listSerializable();

    expect(serialized).toEqual({
      type: "z",
      label: "z",
      description: "desc for z",
      inputs: [{ id: "in", label: "in", type: "any" }],
      outputs: [{ id: "out", label: "out", type: "any" }],
      ui: { componentKey: "labNode", kind: "z" },
    });
    expect((serialized as Partial<NodeDefinition>).estimateCost).toBeUndefined();
    expect((serialized as Partial<NodeDefinition>).execute).toBeUndefined();
  });
});

describe("default nodeDefinitionRegistry singleton (populated with utility nodes)", () => {
  it("has the built-in utility node types registered", () => {
    expect(getNodeDefinition("text-input")).toBeDefined();
    expect(getNodeDefinition("note")).toBeDefined();
    expect(getNodeDefinition("asset-output")).toBeDefined();
    expect(getNodeDefinition("prompt")).toBeDefined();
    expect(getNodeDefinition("image-generation")).toBeDefined();
    expect(getNodeDefinition("video-generation")).toBeDefined();
    expect(getNodeDefinition("video-extend")).toBeDefined();
    expect(getNodeDefinition("video-assembly")).toBeDefined();
  });

  it("returns undefined for an unregistered type via getNodeDefinition", () => {
    expect(getNodeDefinition("nonexistent-node-type")).toBeUndefined();
  });

  it("listNodeDefinitions() and listSerializableNodeDefinitions() agree on the set of types", () => {
    const types = listNodeDefinitions().map((d) => d.type).sort();
    const serializableTypes = listSerializableNodeDefinitions().map((d) => d.type).sort();

    expect(serializableTypes).toEqual(types);
    expect(types).toEqual(
      [
        "text-input",
        "note",
        "asset-output",
        "prompt",
        "image-generation",
        "video-generation",
        "video-extend",
        "video-assembly",
        "text2video",
      ].sort(),
    );
  });
});
