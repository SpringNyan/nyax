import { AnyAction } from "./action";
import { ModelDefinition } from "./model";

export interface Store {
  getState(): unknown;
  dispatch(action: AnyAction): void;
  subscribe(fn: () => void): () => void;

  getComputed(path: string): unknown;

  registerModel(modelDefinition: ModelDefinition): void;
  unregisterModel(namespace: string, key: string | undefined): void;
}

export interface NyaxOptions {
  dependencies: unknown;
  store: Store;
}

export interface Nyax {
  store: Store;
}
