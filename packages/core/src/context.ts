import { AnyAction } from "./action";
import { Store } from "./store";

export interface NyaxContext {
  store: Store;

  dispatchDeferredByAction: Map<
    AnyAction,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
    }
  >;
}

export function createNyaxContext(store: Store): NyaxContext {
  const nyaxContext: NyaxContext = {
    store,

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
