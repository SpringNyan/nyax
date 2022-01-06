import { Reducer, Store } from "redux";
import { Epic, StateObservable } from "redux-observable";
import { Observable, Subject } from "rxjs";
import { AnyAction } from "./action";
import { NYAX_NOTHING } from "./common";
import {
  ContainerImpl,
  createGetContainer,
  GetContainerInternal,
} from "./container";
import { Model } from "./model";
import { createRootReducer } from "./reducer";
import { createGetState, GetState } from "./state";
import { Nyax, NyaxOptions } from "./store";

export interface NyaxContext {
  nyax: Nyax;

  store: Store;
  options: NyaxOptions;

  rootAction$: Observable<AnyAction>;
  rootState$: StateObservable<unknown>;

  getContainer: GetContainerInternal;
  getState: GetState;

  rootReducer: Reducer;

  addEpic$: Subject<Epic>;
  switchEpic$: Subject<void>;

  cachedRootState: unknown | typeof NYAX_NOTHING;

  modelContextByModel: Map<Model, ModelContext>;
  modelByModelNamespace: Map<string, Model>;

  containerByNamespace: Map<string, ContainerImpl>;
  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
    }
  >;

  dependencies: unknown;
  onUnhandledEffectError: (
    error: unknown,
    promise: Promise<unknown> | undefined
  ) => void;
  onUnhandledEpicError: (
    error: unknown,
    caught: Observable<AnyAction>
  ) => Observable<AnyAction>;

  getRootState: () => unknown;
}

export interface ModelContext {
  modelNamespace: string;
  modelPath: string;

  containerByContainerKey: Map<string | undefined, ContainerImpl>;
}

export function createNyaxContext(): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    store: undefined!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    options: undefined!,

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    rootAction$: undefined!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    rootState$: undefined!,

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getContainer: undefined!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    getState: undefined!,

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    rootReducer: undefined!,

    addEpic$: new Subject(),
    switchEpic$: new Subject(),

    cachedRootState: NYAX_NOTHING,

    modelContextByModel: new Map(),
    modelByModelNamespace: new Map(),

    containerByNamespace: new Map(),
    dispatchDeferredByAction: new Map(),

    get dependencies() {
      return nyaxContext.options.dependencies;
    },
    onUnhandledEffectError: (error, promise) => {
      if (nyaxContext.options.onUnhandledEffectError) {
        return nyaxContext.options.onUnhandledEffectError(error, promise);
      } else {
        if (promise) {
          promise.then(undefined, () => {
            // noop
          });
        }
        console.error(error);
      }
    },
    onUnhandledEpicError: (error, caught) => {
      if (nyaxContext.options.onUnhandledEpicError) {
        return nyaxContext.options.onUnhandledEpicError(error, caught);
      } else {
        console.error(error);
        return caught;
      }
    },

    getRootState: () =>
      nyaxContext.cachedRootState !== NYAX_NOTHING
        ? nyaxContext.cachedRootState
        : nyaxContext.store.getState(),
  };

  nyaxContext.getContainer = createGetContainer(nyaxContext);
  nyaxContext.getState = createGetState(nyaxContext);

  nyaxContext.rootReducer = createRootReducer(nyaxContext);

  return nyaxContext;
}
