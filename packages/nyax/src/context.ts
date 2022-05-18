import { Action as ReduxAction, Store as ReduxStore } from "redux";
import { ReloadActionPayload, ReloadActionType } from "./action";
import { createGetModel, Model } from "./model";
import { ModelDefinition } from "./modelDefinition";
import { createGetState } from "./state";
import { Nyax, NyaxOptions } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: Required<NyaxOptions>;

  store: ReduxStore;

  namespaceContextByNamespace: Map<string, NamespaceContext>;
  requireNamespaceContext(
    modelDefinitionOrNamespace: ModelDefinition | string
  ): NamespaceContext;

  actionSubscribers: ((action: ReduxAction) => void)[];

  dispatchAction(
    fullNamespace: string,
    actionType: string,
    payload: unknown
  ): unknown;
}

export interface NamespaceContext {
  namespace: string;
  modelDefinition: ModelDefinition;

  model: Model | undefined;
  modelByKey: Map<string, Model>;
}

export function createNyaxContext(options: Required<NyaxOptions>): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    store: options.createStore(undefined!, undefined!),

    namespaceContextByNamespace: new Map(),
    requireNamespaceContext(modelDefinitionOrNamespace) {
      const namespace =
        typeof modelDefinitionOrNamespace === "string"
          ? modelDefinitionOrNamespace
          : modelDefinitionOrNamespace.namespace;

      let namespaceContext = this.namespaceContextByNamespace.get(namespace);
      if (!namespaceContext) {
        if (typeof modelDefinitionOrNamespace === "string") {
          throw new Error(
            `Model definition is not registered: "${modelDefinitionOrNamespace}"`
          );
        }
        namespaceContext = {
          namespace,
          modelDefinition: modelDefinitionOrNamespace,

          model: undefined,
          modelByKey: new Map(),
        };
        this.namespaceContextByNamespace.set(namespace, namespaceContext);
      }

      return namespaceContext;
    },

    actionSubscribers: [],

    dispatchAction() {
      // TODO
    },
  };
  nyaxContext.nyax = {
    store: nyaxContext.store,
    getModel: createGetModel(nyaxContext),
    getState: createGetState(nyaxContext),
    subscribeAction(fn) {
      nyaxContext.actionSubscribers = [...nyaxContext.actionSubscribers, fn];
      return function () {
        nyaxContext.actionSubscribers = nyaxContext.actionSubscribers.filter(
          (subscriber) => subscriber !== fn
        );
      };
    },
    registerModelDefinitions(modelDefinitions) {
      modelDefinitions.forEach((modelDefinition) => {
        nyaxContext.requireNamespaceContext(modelDefinition);
      });
    },
    reload(state) {
      const payload: ReloadActionPayload = state !== undefined ? { state } : {};
      nyaxContext.store.dispatch({ type: ReloadActionType, payload });
    },
  };

  return nyaxContext;
}
