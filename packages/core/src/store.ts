import { AnyAction } from "./action";
import { createNyaxContext } from "./context";
import {
  createGetModel,
  createRegisterModelDefinitionClasses,
  GetModel,
  ModelDefinition,
  RegisterModelDefinitionClasses,
} from "./model";

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
}

export interface CreateStoreOptions {
  getModelDefinition(
    namespace: string,
    key: string | undefined
  ): ModelDefinition | null;
  deleteModelDefinition(namespace: string, key: string | undefined): void;
}

export type CreateStore = (options: CreateStoreOptions) => Store;

export interface NyaxOptions {
  dependencies: unknown;
  createStore: CreateStore;
}

export interface Nyax {
  dependencies: unknown;
  store: Store;
  getModel: GetModel;
  registerModelDefinitionClasses: RegisterModelDefinitionClasses;
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext(options);
  nyaxContext.nyax = {
    dependencies: options.dependencies,
    store: options.createStore({
      getModelDefinition: nyaxContext.getModelDefinition,
      deleteModelDefinition: nyaxContext.deleteModelDefinition,
    }),
    getModel: createGetModel(nyaxContext),
    registerModelDefinitionClasses: createRegisterModelDefinitionClasses(
      nyaxContext
    ),
  };

  return nyaxContext.nyax;
}
