import { Model } from "./model";
import { NamespacedModelDefinition } from "./modelDefinition";
import { NyaxOptions, Store } from "./store";

export interface NyaxContext {
  options: NyaxOptions;

  store: Store;

  namespaceContextMap: Map<string, NamespaceContext>;
  getNamespaceContext(
    modelDefinitionOrNamespace: NamespacedModelDefinition | string
  ): NamespaceContext;
}

export interface NamespaceContext {
  namespace: string;
  modelDefinition: NamespacedModelDefinition;

  modelByKey: Map<string | undefined, Model>;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    options,

    store: options.createStore(),

    namespaceContextMap: new Map(),
    getNamespaceContext(modelDefinitionOrNamespace) {
      const namespace =
        typeof modelDefinitionOrNamespace === "string"
          ? modelDefinitionOrNamespace
          : modelDefinitionOrNamespace.namespace;

      let namespaceContext = this.namespaceContextMap.get(namespace);
      if (!namespaceContext) {
        if (typeof modelDefinitionOrNamespace === "string") {
          throw new Error("Model definition is not registered.");
        }
        namespaceContext = {
          namespace,
          modelDefinition: modelDefinitionOrNamespace,

          modelByKey: new Map(),
        };
        this.namespaceContextMap.set(namespace, namespaceContext);
      }

      return namespaceContext;
    },
  };

  return nyaxContext;
}
