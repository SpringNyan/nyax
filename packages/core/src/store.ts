import { AnyAction } from "./action";
import { ModelDefinition } from "./model";

export interface Store {
  getState(): unknown;
  dispatch(action: AnyAction): void;
  subscribe(fn: () => void): () => void;

  getComputed(path: string): unknown;

  registerModel(modelDefinition: ModelDefinition): void;
  unregisterModel(modelDefinition: ModelDefinition): void;

  subscribeDispatchResult(
    fn: (action: AnyAction, result: unknown, success: boolean) => void
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
