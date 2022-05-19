import {
  Action as ReduxAction,
  applyMiddleware as reduxApplyMiddleware,
  createStore as reduxCreateStore,
  Middleware as ReduxMiddleware,
  Reducer as ReduxReducer,
  Store as ReduxStore,
} from "redux";
import { createNyaxContext } from "./context";
import { GetModel } from "./model";
import { ModelDefinition } from "./modelDefinition";
import { GetState } from "./state";

export interface Nyax {
  store: ReduxStore;
  getModel: GetModel;
  getState: GetState;
  subscribeAction(fn: (action: ReduxAction) => void): () => void;
  registerModelDefinitions(modelDefinitions: ModelDefinition[]): void;
  reload(stateOrNamespace?: Record<string, unknown> | string): void;
}

export interface NyaxOptions {
  createStore?: (
    reducer: ReduxReducer,
    middleware: ReduxMiddleware
  ) => ReduxStore;

  namespaceSeparator?: string;
  pathSeparator?: string;
}

export function createNyax(options?: NyaxOptions): Nyax {
  const requiredOptions: Required<NyaxOptions> = {
    createStore:
      options?.createStore ??
      function (reducer, middleware) {
        return reduxCreateStore(reducer, reduxApplyMiddleware(middleware));
      },

    namespaceSeparator: options?.namespaceSeparator ?? "/",
    pathSeparator: options?.pathSeparator ?? ".",
  };

  const nyaxContext = createNyaxContext(requiredOptions);
  return nyaxContext.nyax;
}
