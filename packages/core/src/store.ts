import { AnyAction } from "./action";
import { createNyaxContext } from "./context";
import {
  createGetModel,
  createRegisterModelDefinitionClasses,
  GetModel,
  ModelDefinition,
  ModelDefinitionClass,
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

  registerModelDefinitionClass(
    modelDefinitionClass: ModelDefinitionClass
  ): void;
  getModelDefinition(
    nyax: Nyax,
    namespace: string,
    key: string | undefined
  ): ModelDefinition;
}

export interface NyaxOptions {
  dependencies: unknown;
  store: Store;
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
    store: options.store,
    getModel: createGetModel(nyaxContext),
    registerModelDefinitionClasses: createRegisterModelDefinitionClasses(
      nyaxContext
    ),
  };

  return nyaxContext.nyax;
}
