import {
  ActionSubscriber,
  AnyAction,
  CreateStore,
  Effect,
  ModelDefinition,
  Reducer,
  RegisterActionPayload,
  registerActionType,
  ReloadActionPayload,
  reloadActionType,
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

interface ModelContext {
  modelDefinition: ModelDefinition;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedGetters: Record<string, () => unknown>;

  draftState: unknown | undefined;
}

function setSubState(
  state: unknown,
  value: unknown,
  namespace: string,
  key: string | undefined
): unknown {
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

    const nextState = { ...state };
    if (value === undefined) {
      delete nextState[namespace];
    } else {
      nextState[namespace] = value;
    }

    return nextState;
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

export function createNyaxCreateStore(options: {
  createReduxStore?: (options: {
    reducer: ReduxReducer;
    middleware: ReduxMiddleware;
  }) => ReduxStore;
}): CreateStore {
  return ({ getModelDefinition, deleteModelDefinition }) => {
    const modelContextByModelPath = new Map<string, ModelContext>();

    function getModelContext(modelPath: string) {
      let modelContext = modelContextByModelPath.get(modelPath);
      if (!modelContext) {
        let modelDefinition = getModelDefinition(modelPath, undefined);
        if (!modelDefinition) {
          const [namespace, key] = splitLastString(modelPath);
          modelDefinition = getModelDefinition(namespace, key);
        }
        if (!modelDefinition) {
          return null;
        }

        modelContext = {
          modelDefinition,
          isRegistered: false,

          subscriptionDisposables: [],

          flattenedReducers: flattenObject(modelDefinition.reducers()),
          flattenedEffects: flattenObject(modelDefinition.effects()),
          flattenedGetters: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.selectors()),
            (item, key, parent) => {
              parent[key] = () => item();
            }
          ),

          draftState: undefined,
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    let actionSubscribers: ActionSubscriber[] = [];
    let cachedRootState: unknown | undefined;
    let dispatchActionPromise: Promise<unknown> | undefined;

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
            state = modelContext.modelDefinition.initialState();
          }
          rootState = setSubState(rootState, state, item.namespace, item.key);
        });
        return rootState;
      }

      function unregister(
        rootState: unknown,
        payload: UnregisterActionPayload
      ) {
        payload.forEach((item) => {
          rootState = setSubState(
            rootState,
            undefined,
            item.namespace,
            item.key
          );
        });
        return rootState;
      }

      function reload(_rootState: unknown, payload: ReloadActionPayload) {
        if (payload.state !== undefined) {
          return payload.state;
        } else {
          const modelContexts = Array.from(modelContextByModelPath.values());
          const registerActionPayload: RegisterActionPayload = [];
          modelContexts
            .filter((e) => e.modelDefinition.key === undefined)
            .forEach((e) => {
              registerActionPayload.push({
                namespace: e.modelDefinition.namespace,
              });
            });
          return register(undefined, registerActionPayload);
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

        const modelDefinition = modelContext.modelDefinition;
        let state = rootState?.[modelDefinition.namespace];
        if (modelDefinition.key !== undefined) {
          state = state?.[modelDefinition.key];
        }

        const newState = produce(state, (draft: any) => {
          modelContext.draftState = draft;
          reducer(action.payload);
          modelContext.draftState = undefined;
        });

        return setSubState(
          rootState,
          newState,
          modelDefinition.namespace,
          modelDefinition.key
        );
      };

      return (rootState: any, action: AnyAction) => {
        cachedRootState = rootState;
        rootState = rootReducer(rootState, action);
        cachedRootState = undefined;
        return rootState;
      };
    })();

    const reduxMiddleware: ReduxMiddleware = (() => {
      function register(payload: RegisterActionPayload) {
        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);
          if (!modelContext) {
            throw new Error("Model definition is not found.");
          }

          const modelDefinition = modelContext.modelDefinition;

          mergeObjects(
            {},
            flattenObject<any>(modelDefinition.subscriptions()),
            (item) => {
              const disposable = item();
              modelContext.subscriptionDisposables.push(disposable);
            }
          );

          modelContext.isRegistered = true;
        });
      }

      function unregister(payload: UnregisterActionPayload) {
        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);

          modelContext?.subscriptionDisposables.forEach((disposable) =>
            disposable()
          );

          modelContextByModelPath.delete(modelPath);
          deleteModelDefinition(item.namespace, item.key);
        });
      }

      function reload(payload: ReloadActionPayload) {
        const modelContexts = Array.from(modelContextByModelPath.values());

        unregister(
          modelContexts.map((e) => ({
            namespace: e.modelDefinition.namespace,
            key: e.modelDefinition.key,
          }))
        );

        const registerActionPayload: RegisterActionPayload = [];
        if (payload.state === undefined) {
          modelContexts
            .filter((e) => e.modelDefinition.key === undefined)
            .forEach((e) => {
              registerActionPayload.push({
                namespace: e.modelDefinition.namespace,
              });
            });
        } else {
          mergeObjects(
            {},
            payload.state as any,
            (_item, _key, _parent, paths) => {
              if (paths.length > 2) {
                return;
              }
              const [namespace, key] = paths;
              if (namespace && getModelDefinition(namespace, key)) {
                registerActionPayload.push({ namespace, key });
              }
            }
          );
        }
        register(registerActionPayload);
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

          // auto register
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
                  namespace: modelContext.modelDefinition.namespace,
                  key: modelContext.modelDefinition.key,
                },
              ],
            });
          }

          const result = next(action);

          // action subscribers
          actionSubscribers.forEach((fn) => fn(action));

          if (modelContext?.isRegistered) {
            const effect = modelContext.flattenedEffects[actionType];
            dispatchActionPromise = effect ? effect(action.payload) : undefined;
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
        return cachedRootState !== undefined
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
          if (modelContext.draftState !== undefined) {
            return modelContext.draftState;
          }

          let state = reduxStore.getState();
          state = state?.[namespace];
          if (key !== undefined) {
            state = state?.[key];
          }
          return state;
        } else {
          return modelContext?.modelDefinition.initialState();
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);
        return modelContext?.flattenedGetters[getterPath]?.();
      },
      dispatchModelAction(namespace, key, actionType, payload) {
        reduxStore.dispatch({
          type: concatLastString(concatLastString(namespace, key), actionType),
          payload,
        });
        return dispatchActionPromise ?? Promise.resolve();
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
