import { AnyAction } from "./action";
import { Model, ModelDefinition } from "./model";
import { Nyax, NyaxOptions, Store } from "./store";

export interface NyaxContext {
  nyax: Nyax;
  options: NyaxOptions;

  dependencies: unknown;
  store: Store;

  modelContextByNamespace: Map<string, ModelContext>;

  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
    }
  >;
}

export interface ModelContext {
  modelDefinition: ModelDefinition;
  modelByKey: Map<string | undefined, Model>;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    dependencies: options.dependencies,
    store: options.store,

    modelContextByNamespace: new Map(),

    dispatchDeferredByAction: new Map(),
  };

  nyaxContext.store.subscribeDispatchResult((action, result, error) => {
    const deferred = nyaxContext.dispatchDeferredByAction.get(action);
    if (deferred) {
      nyaxContext.dispatchDeferredByAction.delete(action);
      if (error !== undefined) {
        deferred.reject(error);
      } else {
        deferred.resolve(result);
      }
    }
  });

  return nyaxContext;
}

//  ok3
