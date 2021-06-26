import {
  ActionSubscriber,
  AnyAction,
  CreateStore,
  Effect,
  Model,
  Reducer,
  RegisterActionPayload,
  registerActionType,
  ReloadActionPayload,
  reloadActionType,
  Selector,
  Subscription,
  UnregisterActionPayload,
  unregisterActionType,
  utils,
} from "@nyax/core";
import produce from "immer";
import {
  applyMiddleware as reduxApplyMiddleware,
  createStore as reduxCreateStore,
  Dispatch as ReduxDispatch,
  Middleware as ReduxMiddleware,
  Reducer as ReduxReducer,
  Store as ReduxStore,
} from "redux";

const {
  concatLastString,
  flattenObject,
  is,
  isPlainObject,
  mergeObjects,
  splitLastString,
} = utils;

const NOTHING = {};

function setSubState(
  state: any,
  value: any,
  namespace: string,
  key: string | undefined
): any {
  if (state === undefined) {
    state = {};
  }
  if (!isPlainObject(state)) {
    throw new Error("state is not an object");
  }

  if (key === undefined) {
    if (is(state[namespace], value)) {
      return state;
    }

    state = { ...state };
    if (value === NOTHING) {
      delete state[namespace];
    } else {
      state[namespace] = value;
    }

    return state;
  } else {
    const subState = setSubState(state[namespace], value, key, undefined);
    if (is(state[namespace], subState)) {
      return state;
    }

    return {
      ...state,
      [namespace]: subState,
    };
  }
}

interface ModelContext {
  modelPath: string;

  model: Model;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedGetters: Record<string, () => unknown>;

  draftState: unknown | typeof NOTHING;
}

export function createNyaxCreateStore(options: {
  createReduxStore?: (options: {
    reducer: ReduxReducer;
    middleware: ReduxMiddleware;
  }) => ReduxStore;
}): CreateStore {
  return ({ getModel, deleteModel }) => {
    const modelContextByModelPath = new Map<string, ModelContext>();

    function getModelContext(modelPath: string) {
      let modelContext = modelContextByModelPath.get(modelPath);
      if (!modelContext) {
        let model = getModel(modelPath, undefined);
        if (!model) {
          const [namespace, key] = splitLastString(modelPath);
          model = getModel(namespace, key);
        }
        if (!model) {
          return null;
        }

        modelContext = {
          modelPath,

          model,
          isRegistered: false,

          subscriptionDisposables: [],

          flattenedReducers: flattenObject(model.reducers()),
          flattenedEffects: flattenObject(model.effects()),
          flattenedGetters: mergeObjects(
            {},
            flattenObject<any>(model.selectors()),
            (item: Selector, key, parent) => {
              parent[key] = item;
            }
          ),

          draftState: NOTHING,
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    const registerModelContextsStack: ModelContext[][] = [];
    const unregisterModelContextsStack: ModelContext[][] = [];

    let cachedRootState: unknown | typeof NOTHING = NOTHING;
    const reduxReducer: ReduxReducer = (() => {
      function register(rootState: unknown, payload: RegisterActionPayload) {
        payload.forEach((item) => {
          let state = item.state;
          if (state === undefined) {
            const modelPath = concatLastString(item.namespace, item.key);
            const modelContext = getModelContext(modelPath);
            if (!modelContext) {
              throw new Error("Model definition is not found.");
            }
            state = modelContext.model.initialState();
          }
          rootState = setSubState(rootState, state, item.namespace, item.key);
        });
        return rootState;
      }

      function unregister(
        rootState: unknown,
        payload: UnregisterActionPayload
      ) {
        unregisterModelContextsStack.pop();

        payload.forEach((item) => {
          rootState = setSubState(rootState, NOTHING, item.namespace, item.key);

          if (
            item.key !== undefined &&
            Object.keys((rootState as any)?.[item.namespace] ?? {}).length === 0
          ) {
            rootState = setSubState(
              rootState,
              NOTHING,
              item.namespace,
              undefined
            );
          }
        });
        return rootState;
      }

      function reload(rootState: unknown, payload: ReloadActionPayload) {
        const unregisterModelContexts = unregisterModelContextsStack.pop();

        if (payload.state !== undefined) {
          return payload.state;
        } else {
          if (unregisterModelContexts) {
            rootState = unregister(
              rootState,
              unregisterModelContexts.map((e) => ({
                namespace: e.model.namespace,
                key: e.model.key,
              }))
            );
          }

          const modelContexts = Array.from(modelContextByModelPath.values());
          const registerActionPayload: RegisterActionPayload = [];
          modelContexts
            .filter((e) => e.model.key === undefined)
            .forEach((e) => {
              registerActionPayload.push({
                namespace: e.model.namespace,
              });
            });
          return register(rootState, registerActionPayload);
        }
      }

      const rootReducer = (rootState: any, action: AnyAction) => {
        if (rootState === undefined) {
          rootState = {};
        }

        switch (action.type) {
          case registerActionType: {
            return register(rootState, action.payload as RegisterActionPayload);
          }
          case unregisterActionType: {
            return unregister(
              rootState,
              action.payload as UnregisterActionPayload
            );
          }
          case reloadActionType: {
            return reload(rootState, action.payload as ReloadActionPayload);
          }
          default: {
            break;
          }
        }

        const [modelPath, actionType] = splitLastString(action.type);
        const modelContext = getModelContext(modelPath);
        if (!modelContext?.isRegistered) {
          return rootState;
        }

        const reducer = modelContext.flattenedReducers[actionType];
        if (!reducer) {
          return rootState;
        }

        const model = modelContext.model;
        let state = rootState?.[model.namespace];
        if (model.key !== undefined) {
          state = state?.[model.key];
        }

        const newState = produce(state, (draft: any) => {
          modelContext.draftState = draft;
          reducer(action.payload);
          modelContext.draftState = NOTHING;
        });

        return setSubState(rootState, newState, model.namespace, model.key);
      };

      return (rootState: any, action: AnyAction) => {
        cachedRootState = rootState;
        rootState = rootReducer(rootState, action);
        cachedRootState = NOTHING;
        return rootState;
      };
    })();

    let actionSubscribers: ActionSubscriber[] = [];
    const dispatchPromiseByAction = new Map<
      AnyAction,
      Promise<unknown> | null
    >();

    const reduxMiddleware: ReduxMiddleware = (() => {
      function register(payload: RegisterActionPayload) {
        const modelContexts: ModelContext[] = [];
        registerModelContextsStack.push(modelContexts);

        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);
          if (!modelContext) {
            throw new Error("Model definition is not found.");
          }
          modelContexts.push(modelContext);

          modelContext.isRegistered = true;
        });
      }

      function unregister(payload: UnregisterActionPayload) {
        const modelContexts: ModelContext[] = [];
        unregisterModelContextsStack.push(modelContexts);

        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);

          if (modelContext) {
            modelContexts.push(modelContext);

            modelContext.subscriptionDisposables.forEach((disposable) =>
              disposable()
            );
          }

          modelContextByModelPath.delete(modelPath);
          deleteModel(item.namespace, item.key);
        });
      }

      function reload(payload: ReloadActionPayload) {
        const modelContexts = Array.from(modelContextByModelPath.values());

        unregister(
          modelContexts.map((e) => ({
            namespace: e.model.namespace,
            key: e.model.key,
          }))
        );

        const registerActionPayload: RegisterActionPayload = [];
        if (payload.state === undefined) {
          modelContexts
            .filter((e) => e.model.key === undefined)
            .forEach((e) => {
              registerActionPayload.push({
                namespace: e.model.namespace,
              });
            });
        } else {
          mergeObjects(
            {},
            payload.state as Record<string, unknown>,
            (_item, _key, _parent, paths) => {
              if (paths.length > 2) {
                return;
              }
              const [namespace, key] = paths;
              if (namespace && getModel(namespace, key)) {
                registerActionPayload.push({ namespace, key });
              }
            }
          );
        }
        register(registerActionPayload);
      }

      function autoRegister(
        store: { dispatch: ReduxDispatch },
        modelContext: ModelContext | null,
        actionType: string
      ) {
        if (
          modelContext &&
          !modelContext.isRegistered &&
          (modelContext.flattenedReducers[actionType] ||
            modelContext.flattenedEffects[actionType])
        ) {
          store.dispatch({
            type: registerActionType,
            payload: [
              {
                namespace: modelContext.model.namespace,
                key: modelContext.model.key,
              },
            ],
          });
        }
      }

      function afterRegister(modelContexts: ModelContext[]) {
        modelContexts.forEach((modelContext) => {
          if (modelContext === getModelContext(modelContext.modelPath)) {
            mergeObjects(
              {},
              flattenObject<any>(modelContext.model.subscriptions()),
              (item: Subscription) => {
                const disposable = item();
                if (disposable) {
                  modelContext.subscriptionDisposables.push(disposable);
                }
              }
            );
          }
        });
      }

      return (store: { dispatch: ReduxDispatch }) =>
        (next: ReduxDispatch) =>
        (action: AnyAction) => {
          switch (action.type) {
            case registerActionType: {
              register(action.payload as RegisterActionPayload);
              break;
            }
            case unregisterActionType: {
              unregister(action.payload as UnregisterActionPayload);
              break;
            }
            case reloadActionType: {
              reload(action.payload as ReloadActionPayload);
              break;
            }
            default:
              break;
          }

          const [modelPath, actionType] = splitLastString(action.type);
          const modelContext = getModelContext(modelPath);

          autoRegister(store, modelContext, actionType);

          const result = next(action);
          actionSubscribers.forEach((fn) => fn(action));

          if (
            action.type === registerActionType ||
            action.type === reloadActionType
          ) {
            const registerModelContexts = registerModelContextsStack.pop();
            if (registerModelContexts) {
              afterRegister(registerModelContexts);
            }
          }

          if (modelContext?.isRegistered) {
            const effect = modelContext.flattenedEffects[actionType];
            if (effect) {
              const promise = effect(action.payload);
              if (dispatchPromiseByAction.has(action)) {
                dispatchPromiseByAction.set(action, promise);
              }
            }
          }

          return result;
        };
    })();

    const createReduxStore =
      options.createReduxStore ??
      (({ reducer, middleware }) =>
        reduxCreateStore(reducer, reduxApplyMiddleware(middleware)));

    const reduxStore = createReduxStore({
      reducer: reduxReducer,
      middleware: reduxMiddleware,
    });

    return {
      getState() {
        return cachedRootState !== NOTHING
          ? cachedRootState
          : reduxStore.getState();
      },
      dispatch(action) {
        reduxStore.dispatch(action);
      },
      subscribe(fn) {
        return reduxStore.subscribe(fn);
      },

      getModelState(namespace, key) {
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);

        if (modelContext?.isRegistered) {
          if (modelContext.draftState !== NOTHING) {
            return modelContext.draftState;
          }

          let state = reduxStore.getState();
          state = state?.[namespace];
          if (key !== undefined) {
            state = state?.[key];
          }
          return state;
        } else {
          return modelContext?.model.initialState();
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);
        return modelContext?.flattenedGetters[getterPath]?.();
      },
      dispatchModelAction(namespace, key, actionType, payload) {
        const action = {
          type: concatLastString(concatLastString(namespace, key), actionType),
          payload,
        };
        dispatchPromiseByAction.set(action, null);

        reduxStore.dispatch(action);

        const promise = dispatchPromiseByAction.get(action);
        dispatchPromiseByAction.delete(action);
        return promise ?? Promise.resolve();
      },

      subscribeAction: (fn) => {
        actionSubscribers = [...actionSubscribers, fn];
        return () => {
          actionSubscribers = actionSubscribers.filter(
            (subscriber) => subscriber !== fn
          );
        };
      },
    };
  };
}

export type InputSelector<TResult> = (lastResult?: TResult) => TResult;
export type OutputSelector<TResult> = () => TResult;

export function createSelector<TDeps extends any[] | [], TResult>(
  selectors: { [K in keyof TDeps]: InputSelector<TDeps[K]> },
  combiner: (deps: TDeps, lastResult?: TResult) => TResult
): OutputSelector<TResult>;
export function createSelector<TDeps extends any[], TResult>(
  ...args: [
    ...selectors: { [K in keyof TDeps]: InputSelector<TDeps[K]> },
    combiner: (...args: [...deps: TDeps, lastResult?: TResult]) => TResult
  ]
): OutputSelector<TResult>;
export function createSelector(...args: unknown[]): OutputSelector<unknown> {
  const arrayMode = Array.isArray(args[0]);
  const selectors = (
    arrayMode ? args[0] : args.slice(0, args.length - 1)
  ) as InputSelector<unknown>[];
  const combiner = args[args.length - 1] as (...args: unknown[]) => unknown;

  let lastDeps: unknown[] | undefined;
  let lastResult: unknown | undefined;

  return () => {
    let recalc = !lastDeps;
    if (lastDeps === undefined) {
      lastDeps = [];
    }

    const currDeps: unknown[] = [];
    for (let i = 0; i < selectors.length; i += 1) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      currDeps.push(selectors[i]!(lastDeps[i]));
      if (!recalc && !is(currDeps[i], lastDeps[i])) {
        recalc = true;
      }
    }

    lastDeps = currDeps;
    if (recalc) {
      lastResult = arrayMode
        ? combiner(currDeps, lastResult)
        : combiner(...currDeps, lastResult);
    }

    return lastResult;
  };
}
