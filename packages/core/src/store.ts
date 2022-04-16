import { Action } from "./action";

export type StoreActionSubscriber = (action: Action) => void;

export interface Store {
  getState(): Record<string, unknown>;
  dispatch(action: Action): void;
  subscribe(fn: () => void): () => void;

  getModelState(namespace: string, key: string | undefined): unknown;
  getModelComputed(
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

  subscribeAction(fn: StoreActionSubscriber): () => void;
}

export interface Nyax {
  store: Store;
}
