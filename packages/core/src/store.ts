import { AnyAction } from "./action";
import { createNyaxContext } from "./context";
import { createGetModel, GetModel, ModelDefinition } from "./model";

export type DispatchActionSubscriber = (action: AnyAction) => void;
export type DispatchResultSubscriber = (
  action: AnyAction,
  result: unknown,
  error?: unknown
) => void;

export interface Store {
  getState(): unknown;
  getComputed(path: string): unknown;
  dispatch(action: AnyAction): void;
  subscribe(fn: () => void): () => void;

  registerModel(modelDefinition: ModelDefinition): void;
  unregisterModel(modelDefinition: ModelDefinition): void;

  subscribeDispatchAction(fn: DispatchActionSubscriber): () => void;
  subscribeDispatchResult(fn: DispatchResultSubscriber): () => void;
}

export interface NyaxOptions {
  dependencies: unknown;
  store: Store;
}

export interface Nyax {
  store: Store;
  getModel: GetModel;
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext(options);
  nyaxContext.nyax = {
    store: nyaxContext.store,
    getModel: createGetModel(nyaxContext),
  };

  return nyaxContext.nyax;
}
