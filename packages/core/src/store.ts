import { Action, ReloadActionPayload, ReloadActionType } from "./action";
import { createNyaxContext } from "./context";
import { GetModel, Model } from "./model";
import { ModelDefinition } from "./modelDefinition";
import { GetState } from "./state";

export interface Store {
  getState(): Record<string, unknown>;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;

  subscribeAction(fn: (action: Action) => void): () => void;

  getModelState(model: Model): unknown;
  getModelGetter(model: Model, getterPath: string, value?: unknown): unknown;
  dispatchModelAction(
    model: Model,
    actionType: string,
    payload: unknown
  ): unknown;
}

export interface Nyax {
  store: Store;
  getModel: GetModel;
  getState: GetState;
  reload(state?: Record<string, unknown>): void;
  registerModelDefinitions(modelDefinitions: ModelDefinition[]): void;
}

export interface NyaxOptions {
  namespaceSeparator?: string;
  pathSeparator?: string;
}

export type CreateStore = (
  context: {
    getModelDefinition(namespace: string): ModelDefinition | null;
    getModel(namespace: string, key: string | undefined): Model;
    mountModel(model: Model): void;
    unmountModel(model: Model): void;
  },
  options: NyaxOptions
) => Store;

export function createNyax(
  createStore: CreateStore,
  options?: NyaxOptions
): Nyax {
  options = {
    namespaceSeparator: options?.namespaceSeparator ?? "/",
    pathSeparator: options?.pathSeparator ?? ".",
  };

  const nyaxContext = createNyaxContext(createStore, options);
  nyaxContext.nyax = {
    store: nyaxContext.store,
    getModel: nyaxContext.getModel,
    getState: nyaxContext.getState,
    reload(state) {
      const payload: ReloadActionPayload = state !== undefined ? { state } : {};
      this.store.dispatch({
        type: ReloadActionType,
        payload,
      });
    },
    registerModelDefinitions(modelDefinitions) {
      modelDefinitions.forEach((modelDefinition) => {
        nyaxContext.getNamespaceContext(modelDefinition);
      });
    },
  };
  return nyaxContext.nyax;
}
