import { createGetModel, GetModel, Model } from "./model";
import { NamespacedModelDefinition } from "./modelDefinition";
import { createGetState, GetState } from "./state";
import { CreateStore, Nyax, NyaxOptions, Store } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: NyaxOptions;

  store: Store;

  namespaceContextByNamespace: Map<string, NamespaceContext>;
  getNamespaceContext(
    modelDefinitionOrNamespace: NamespacedModelDefinition | string
  ): NamespaceContext;

  getModel: GetModel;
  getState: GetState;
}

export interface NamespaceContext {
  namespace: string;
  modelDefinition: NamespacedModelDefinition;

  modelByKey: Map<string | undefined, Model>;
}

export function createNyaxContext(
  createStore: CreateStore,
  options: NyaxOptions
): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    store: createStore(
      {
        getModelDefinition(namespace) {
          return nyaxContext.getNamespaceContext(namespace).modelDefinition;
        },
        getModel(namespace, key) {
          return nyaxContext.getModel(namespace, key as any);
        },
        mountModel(model) {
          nyaxContext
            .getNamespaceContext(model.namespace)
            .modelByKey.set(model.key, model);
        },
        unmountModel(model) {
          nyaxContext
            .getNamespaceContext(model.namespace)
            .modelByKey.delete(model.key);
        },
      },
      options
    ),

    namespaceContextByNamespace: new Map(),
    getNamespaceContext(modelDefinitionOrNamespace) {
      const namespace =
        typeof modelDefinitionOrNamespace === "string"
          ? modelDefinitionOrNamespace
          : modelDefinitionOrNamespace.namespace;

      let namespaceContext = this.namespaceContextByNamespace.get(namespace);
      if (!namespaceContext) {
        if (typeof modelDefinitionOrNamespace === "string") {
          throw new Error("Model definition is not registered.");
        }
        namespaceContext = {
          namespace,
          modelDefinition: modelDefinitionOrNamespace,

          modelByKey: new Map(),
        };
        this.namespaceContextByNamespace.set(namespace, namespaceContext);
      }

      return namespaceContext;
    },

    get getModel() {
      delete (this as Partial<NyaxContext>).getModel;
      return (this.getModel = createGetModel(this));
    },
    get getState() {
      delete (this as Partial<NyaxContext>).getState;
      return (this.getState = createGetState(this));
    },
  };

  return nyaxContext;
}
