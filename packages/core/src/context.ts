import { AnyAction } from "./action";
import { Nyax, NyaxOptions, Store } from "./store";

export interface NyaxContext {
  nyax: Nyax;

  dependencies: unknown;
  store: Store;

  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
    }
  >;
}

export function createNyaxContext(options: NyaxOptions): NyaxContext {
  const nyaxContext: NyaxContext = {
    dependencies: options.dependencies,
    store: options.store,

    dispatchDeferredByAction: new Map(),
  };

  store.subscribeDispatchResult((action, result, success) => {
    const deferred = nyaxContext.dispatchDeferredByAction.get(action);
    if (deferred) {
      nyaxContext.dispatchDeferredByAction.delete(action);
      if (success) {
        deferred.resolve(result);
      } else {
        deferred.reject(result);
      }
    }
  });

  return nyaxContext;
}

//  ok
