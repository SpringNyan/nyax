import { AnyAction, reloadActionType } from "./action";
import {
  createGetContainer,
  createGetContainers,
  GetContainer,
  GetContainers,
} from "./container";
import { createNyaxContext } from "./context";
import {
  createRegisterModelClasses,
  Model,
  RegisterModelClasses,
} from "./model";
import { createGetState, GetState } from "./state";

export type ActionSubscriber = (action: AnyAction) => void;

export interface Store {
  getState(): unknown;
  dispatch(action: AnyAction): void;
  subscribe(fn: () => void): () => void;

  getModelState(namespace: string, key: string | undefined): unknown;
  getModelComputed(
    namespace: string,
    key: string | undefined,
    getterPath: string
  ): unknown;
  dispatchModelAction(
    namespace: string,
    key: string | undefined,
    actionType: string,
    payload: unknown
  ): Promise<unknown>;

  subscribeAction(fn: ActionSubscriber): () => void;
}

export interface CreateStoreOptions {
  getModel(namespace: string, key: string | undefined): Model | null;
  deleteModel(namespace: string, key: string | undefined): void;
}

export type CreateStore = (options: CreateStoreOptions) => Store;

export interface NyaxOptions {
  dependencies: unknown;
  createStore: CreateStore;
}

export interface Nyax {
  dependencies: unknown;
  store: Store;
  getState: GetState;
  getContainer: GetContainer;
  getContainers: GetContainers;
  registerModelClasses: RegisterModelClasses;
  reload: (state?: unknown) => void;
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext(options);
  nyaxContext.nyax = {
    dependencies: options.dependencies,
    store: options.createStore({
      getModel: nyaxContext.getModel,
      deleteModel: nyaxContext.deleteModel,
    }),
    getState: createGetState(nyaxContext),
    getContainer: createGetContainer(nyaxContext),
    getContainers: createGetContainers(nyaxContext),
    registerModelClasses: createRegisterModelClasses(nyaxContext),
    reload: (state) => {
      nyaxContext.nyax.store.dispatch({
        type: reloadActionType,
        payload: { state },
      });
    },
  };

  return nyaxContext.nyax;
}
