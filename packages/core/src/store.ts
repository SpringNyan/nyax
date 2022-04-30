import { Action } from "./action";
import { createNyaxContext } from "./context";
import { GetModel, Model } from "./model";
import { GetState } from "./state";

export interface Store {
  getState(): Record<string, unknown>;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;

  subscribeAction(fn: (action: Action) => void): () => void;

  getModelState(namespace: string, key: string | undefined): unknown;
  getModelGetter(
    namespace: string,
    key: string | undefined,
    getterPath: string,
    value?: unknown
  ): unknown;
  dispatchModelAction(
    namespace: string,
    key: string | undefined,
    actionType: string,
    payload: unknown
  ): unknown;
}

export interface Nyax {
  store: Store;
  getModel: GetModel;
  getState: GetState;
}

export interface NyaxOptions {
  namespaceSeparator?: string;
  pathSeparator?: string;
}

export type CreateStore = (
  context: {
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
  return {
    store: nyaxContext.store,
    getModel: nyaxContext.getModel,
    getState: nyaxContext.getState,
  };
}
