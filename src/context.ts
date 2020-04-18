import { Store } from "redux";
import { ActionsObservable, Epic, StateObservable } from "redux-observable";
import { Subject } from "rxjs";
import { AnyAction } from "./action";
import { NYAX_NOTHING } from "./common";
import {
  ContainerImpl,
  createGetContainer,
  GetContainerInternal,
} from "./container";
import { ModelConstructor } from "./model";
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

  modelContextByModelConstructor: Map<ModelConstructor, ModelContext>;
  modelConstructorByModelNamespace: Map<string, ModelConstructor>;

  containerByNamespace: Map<string, ContainerImpl>;
  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >;

  dependencies: any;
  onUnhandledEffectError: (error: any) => void;
  onUnhandledEpicError: (error: any) => void;
}

export interface ModelContext {
  modelNamespace: string;
  modelPath: string;

  isDynamic: boolean;
  autoRegister: boolean;

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

    modelContextByModelConstructor: new Map(),
    modelConstructorByModelNamespace: new Map(),

    containerByNamespace: new Map(),
    dispatchDeferredByAction: new Map(),

    get dependencies(): any {
      return nyaxContext.options.dependencies;
    },
    onUnhandledEffectError: (error) => {
      if (nyaxContext.options.onUnhandledEffectError) {
        nyaxContext.options.onUnhandledEffectError(error);
      } else {
        console.error(error);
      }
    },
    onUnhandledEpicError: (error) => {
      if (nyaxContext.options.onUnhandledEpicError) {
        nyaxContext.options.onUnhandledEpicError(error);
      } else {
        console.error(error);
      }
    },
  };

  nyaxContext.getContainer = createGetContainer(nyaxContext);

  return nyaxContext;
}
