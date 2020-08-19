import {
  applyMiddleware,
  createStore,
  Middleware,
  Reducer,
  Store,
} from "redux";
import { createEpicMiddleware, Epic } from "redux-observable";
import { Observable } from "rxjs";
import { mergeMap, switchMap } from "rxjs/operators";
import { AnyAction, BatchDispatch, reloadActionHelper } from "./action";
import { Container, GetContainer } from "./container";
import { createNyaxContext } from "./context";
import { createMiddleware } from "./middleware";
import { Models, registerModels, unregisterModels } from "./model";
import { GetState } from "./state";

export interface NyaxOptions {
  dependencies: unknown;

  createStore?: (params: {
    reducer: Reducer;
    epic: Epic;
    middleware: Middleware;
  }) => Store;

  onUnhandledEffectError?: (
    error: unknown,
    promise: Promise<unknown> | undefined
  ) => void;
  onUnhandledEpicError?: (
    error: unknown,
    caught: Observable<AnyAction>
  ) => Observable<AnyAction>;
}

export interface Nyax {
  store: Store;
  registerModels: (models: Models) => void;
  unregisterModels: (models: Models | string[]) => void;
  getContainer: GetContainer;
  getState: GetState;
  batch: BatchDispatch;
  reload: (state?: unknown) => void;
  getCachedContainers: () => Container[];
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext();
  nyaxContext.options = options;

  const nyax: Nyax = {
    get store() {
      return nyaxContext.store;
    },
    registerModels: (models) => {
      registerModels(nyaxContext, models);
    },
    unregisterModels: (models) => {
      unregisterModels(nyaxContext, models);
    },
    get getContainer() {
      return nyaxContext.getContainer;
    },
    get getState() {
      return nyaxContext.getState;
    },
    get batch() {
      return nyaxContext.batchDispatch;
    },
    reload: (state) => {
      nyaxContext.store.dispatch(reloadActionHelper.create({ state }));
    },
    getCachedContainers: () => {
      const containers: Container[] = [];
      nyaxContext.modelContextByModel.forEach((context) => {
        context.containerByContainerKey.forEach((container) => {
          containers.push(container);
        });
      });
      return containers;
    },
  };
  nyaxContext.nyax = nyax;

  const reducer: Reducer = nyaxContext.rootReducer;
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

  return nyax;
}
