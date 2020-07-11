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
import {
  AnyAction,
  batchRegisterActionHelper,
  reloadActionHelper,
} from "./action";
import { Container, GetContainer } from "./container";
import { createNyaxContext } from "./context";
import { createMiddleware } from "./middleware";
import { Model, Models, registerModels } from "./model";
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
  getContainer: GetContainer;
  getState: GetState;
  reload: (state?: unknown) => void;
  gc: (filterFn?: (container: Container<Model>) => boolean) => void;
}

export function createNyax(options: NyaxOptions): Nyax {
  const nyaxContext = createNyaxContext();
  nyaxContext.options = options;

  const nyax: Nyax = {
    get store() {
      return nyaxContext.store;
    },
    registerModels: (models): void => {
      const registerActionPayloads = registerModels(nyaxContext, models);
      nyaxContext.store.dispatch(
        batchRegisterActionHelper.create(registerActionPayloads)
      );
    },
    get getContainer() {
      return nyaxContext.getContainer;
    },
    get getState() {
      return nyaxContext.getState;
    },
    reload: (state): void => {
      nyaxContext.store.dispatch(reloadActionHelper.create({ state }));
    },
    gc: (filterFn): void => {
      if (!filterFn) {
        filterFn = (container): boolean => !container.isRegistered;
      }

      const containers: Container<Model>[] = [];
      nyaxContext.modelContextByModel.forEach((context) => {
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
