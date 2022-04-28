import { Action } from "./action";
import { createNyaxContext } from "./context";
import { createGetModel, GetModel, Model } from "./model";
import { createGetState, GetState } from "./state";

export interface Store {
  getState(): Record<string, unknown>;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;

  subscribeAction(fn: (action: Action) => void): () => void;

  mountModel(model: Model, state?: unknown): void;
  unmountModel(model: Model): void;
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
}

export interface NyaxOptions {
  namespaceSeparator?: string;
  pathSeparator?: string;
}

export type CreateStore = (options?: NyaxOptions) => Store;

export function createNyax(
  createStore: CreateStore,
  options?: NyaxOptions
): Nyax {
  const nyaxContext = createNyaxContext(createStore, options);
  return {
    store: nyaxContext.store,
    getModel: createGetModel(nyaxContext),
    getState: createGetState(nyaxContext),
  };
}
