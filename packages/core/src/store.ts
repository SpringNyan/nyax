import { AnyAction } from "./action";
import { ModelDefinitionInstance } from "./model";

export interface Store {
  getState(): unknown;
  getComputed(path: string): unknown;
  dispatch(action: AnyAction): void;
  subscribe(fn: () => void): () => void;

  registerModel(modelDefinitionInstance: ModelDefinitionInstance): void;
  unregisterModel(modelDefinitionInstance: ModelDefinitionInstance): void;

  subscribeDispatchAction(fn: (action: AnyAction) => void): () => void;
  subscribeDispatchResult(
    fn: (action: AnyAction, result: unknown, error: unknown) => void
  ): () => void;
}

export interface NyaxOptions {
  dependencies: unknown;
  store: Store;
}

export interface Nyax {
  store: Store;
}

// ok
