import { Store } from "redux";
import { ActionsObservable, Epic, StateObservable } from "redux-observable";
import { Observable, Subject } from "rxjs";
import { AnyAction } from "./action";
import { NYAX_NOTHING } from "./common";
import {
  ContainerImpl,
  createGetContainer,
  GetContainerInternal,
} from "./container";
import { Model } from "./model";
import { NyaxOptions } from "./store";

export interface NyaxContext {
  store: Store;
  options: NyaxOptions;

  rootAction$: ActionsObservable<AnyAction>;
  rootState$: StateObservable<any>;

  getContainer: GetContainerInternal;

  addEpic$: Subject<Epic>;
  switchEpic$: Subject<void>;

  cachedRootState: any | typeof NYAX_NOTHING;

  modelContextByModel: Map<Model, ModelContext>;
  modelByModelNamespace: Map<string, Model>;

  containerByNamespace: Map<string, ContainerImpl>;
  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >;

  dependencies: any;
  onUnhandledEffectError: (
    error: any,
    promise: Promise<any> | undefined
  ) => void;
  onUnhandledEpicError: (
    error: any,
    caught: Observable<AnyAction>
  ) => Observable<AnyAction>;

  getRootState: () => any;
}

export interface ModelContext {
  modelNamespace: string;
  modelPath: string;

  containerByContainerKey: Map<string | undefined, ContainerImpl>;
}

export function createNyaxContext(): NyaxContext {
  const nyaxContext: NyaxContext = {
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

    addEpic$: new Subject(),
    switchEpic$: new Subject(),

    cachedRootState: NYAX_NOTHING,

    modelContextByModel: new Map(),
    modelByModelNamespace: new Map(),

    containerByNamespace: new Map(),
    dispatchDeferredByAction: new Map(),

    get dependencies(): any {
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

  return nyaxContext;
}
