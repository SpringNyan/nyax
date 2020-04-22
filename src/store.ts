import {
  applyMiddleware,
  createStore,
  Middleware,
  Reducer,
  Store,
} from "redux";
import { createEpicMiddleware, Epic } from "redux-observable";
import { mergeMap, switchMap } from "rxjs/operators";
import { batchRegisterActionHelper, reloadActionHelper } from "./action";
import { Container, GetContainer } from "./container";
import { createNyaxContext } from "./context";
import { createMiddleware } from "./middleware";
import { ModelConstructors, registerModels } from "./model";
import { createRootReducer } from "./reducer";

export interface NyaxOptions {
  dependencies: any;

  createStore?: (params: {
    reducer: Reducer;
    epic: Epic;
    middleware: Middleware;
  }) => Store;

  onUnhandledEffectError?: (error: any) => void;
  onUnhandledEpicError?: (error: any) => void;
}

export interface Nyax {
  store: Store;
  registerModels: (modelConstructors: ModelConstructors) => void;
  getContainer: GetContainer;
  reload: (state?: any) => void;
  gc: (filterFn?: (container: Container) => boolean) => void;
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext();
  nyaxContext.options = options;

  const reducer: Reducer = createRootReducer(nyaxContext);
  const epic: Epic = (action$, state$, ...rest) => {
    nyaxContext.rootAction$ = action$;
    nyaxContext.rootState$ = state$;

    return nyaxContext.switchEpic$.pipe(
      switchMap(() =>
        nyaxContext.addEpic$.pipe(
          mergeMap((epic) => epic(action$, state$, ...rest))
        )
      )
    );
  };
  const middleware = createMiddleware(nyaxContext);

  if (options.createStore) {
    nyaxContext.store = options.createStore({
      reducer,
      epic,
      middleware,
    });
  } else {
    const epicMiddleware = createEpicMiddleware();
    nyaxContext.store = createStore(
      reducer,
      applyMiddleware(middleware, epicMiddleware)
    );
    epicMiddleware.run(epic);
  }

  nyaxContext.switchEpic$.next();

  return {
    store: nyaxContext.store,
    registerModels: (modelConstructors): void => {
      const registerActionPayloads = registerModels(
        nyaxContext,
        modelConstructors
      );
      nyaxContext.store.dispatch(
        batchRegisterActionHelper.create(registerActionPayloads)
      );
    },
    getContainer: nyaxContext.getContainer,
    reload: (state): void => {
      nyaxContext.store.dispatch(reloadActionHelper.create({ state }));
    },
    gc: (filterFn): void => {
      if (!filterFn) {
        filterFn = (container): boolean => !container.isRegistered;
      }

      const containers: Container[] = [];
      nyaxContext.modelContextByModelConstructor.forEach((context) => {
        context.containerByContainerKey.forEach((container) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          if (filterFn!(container)) {
            containers.push(container);
          }
        });
      });

      containers.forEach((container) => {
        container.unregister();
      });
    },
  };
}
