import { Store } from "redux";
import {
  ActionsObservable,
  Epic as ReduxObservableEpic,
  StateObservable,
} from "redux-observable";
import { Subject } from "rxjs";
import { AnyAction } from "./action";
import { ContainerImpl, GetContainer } from "./container";
import { Model, ModelConstructor } from "./model";
import { NyaxOptions } from "./store";

export interface NyaxContext {
  store: Store;
  options: NyaxOptions;

  getContainer: GetContainer;

  addEpic$: Subject<ReduxObservableEpic>;
  switchEpic$: Subject<void>;

  rootAction$: ActionsObservable<AnyAction>;
  rootState$: StateObservable<any>;

  cachedRootState: any;

  modelContextByModelConstructor: Map<ModelConstructor, ModelContext>;
  modelConstructorByModelNamespace: Map<string, ModelConstructor>;

  containerByNamespace: Map<string, ContainerImpl<any>>;
  dispatchDeferredByAction: WeakMap<
    AnyAction,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
    }
  >;

  getDependencies: () => any;
  resolveActionName: (paths: string[]) => string;
  onUnhandledEffectError: (error: any) => void;
  onUnhandledEpicError: (error: any) => void;
}

export interface ModelContext {
  modelNamespace: string;
  modelPath: string;

  isDynamic: boolean;
  autoRegister: boolean;

  modelByContainerKey: Map<string | undefined, Model>;
  containerByContainerKey: Map<string | undefined, ContainerImpl>;
}
