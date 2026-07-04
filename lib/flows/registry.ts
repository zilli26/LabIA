import type {
  NodeDefinition,
  SerializableNodeDefinition,
} from "@/lib/flows/types";
import { imageNodeDefinitions } from "@/lib/flows/image-nodes";
import { utilityNodeDefinitions } from "@/lib/flows/utility-nodes";
import { videoNodeDefinitions } from "@/lib/flows/video-nodes";

export class NodeDefinitionRegistry {
  private readonly definitions = new Map<string, NodeDefinition>();

  constructor(definitions: NodeDefinition[] = []) {
    definitions.forEach((definition) => this.register(definition));
  }

  register(definition: NodeDefinition) {
    if (this.definitions.has(definition.type)) {
      throw new Error(`NodeDefinition already registered: ${definition.type}`);
    }

    this.definitions.set(definition.type, definition);
  }

  get(type: string) {
    return this.definitions.get(type);
  }

  list() {
    return Array.from(this.definitions.values());
  }

  listSerializable(): SerializableNodeDefinition[] {
    return this.list().map((definition) => ({
      type: definition.type,
      label: definition.label,
      description: definition.description,
      inputs: definition.inputs,
      outputs: definition.outputs,
      ui: definition.ui,
    }));
  }
}

export const nodeDefinitionRegistry = new NodeDefinitionRegistry(
  [...utilityNodeDefinitions, ...imageNodeDefinitions, ...videoNodeDefinitions],
);

export function getNodeDefinition(type: string) {
  return nodeDefinitionRegistry.get(type);
}

export function listNodeDefinitions() {
  return nodeDefinitionRegistry.list();
}

export function listSerializableNodeDefinitions() {
  return nodeDefinitionRegistry.listSerializable();
}
