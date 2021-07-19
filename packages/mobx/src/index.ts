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
import {
  action,
  computed,
  get,
  keys,
  observable,
  observe,
  remove,
  runInAction,
  set,
} from "mobx";

const { concatLastString, flattenObject, mergeObjects, splitLastString } =
  utils;

const NOTHING = {};

function setSubState(
  state: any,
  value: any,
  namespace: string,
  key: string | undefined
): any {
  if (state === undefined) {
    state = observable({});
  }

  if (key === undefined) {
    if (value === NOTHING) {
      remove(state, namespace);
    } else {
      set(state, namespace, value);
    }
    return state;
  } else {
    set(
      state,
      namespace,
      setSubState(get(state, namespace), value, key, undefined)
    );
    return state;
  }
}

interface ModelContext {
  model: Model;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedGetters: Record<string, () => unknown>;

  observableInitialState: unknown;
  computedObserveDisposerByKey: Map<string, () => void>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
export function createNyaxCreateStore(_options: {}): CreateStore {
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
          model,
          isRegistered: false,

          subscriptionDisposables: [],

          flattenedReducers: mergeObjects(
            {},
            flattenObject<any>(model.reducers()),
            (item: Reducer, key, parent) => {
              parent[key] = action(item);
            }
          ),
          flattenedEffects: flattenObject(model.effects()),
          flattenedGetters: mergeObjects(
            {},
            flattenObject<any>(model.selectors()),
            (item: Selector, key, parent) => {
              const computedValue = computed(item);
              parent[key] = () => {
                if (
                  modelContext &&
                  !modelContext.computedObserveDisposerByKey.has(key)
                ) {
                  modelContext.computedObserveDisposerByKey.set(
                    key,
                    observe(computedValue, () => {
                      // noop
                    })
                  );
                }
                return computedValue.get();
              };
            }
          ),

          observableInitialState: observable(model.initialState()),
          computedObserveDisposerByKey: new Map(),
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    let observableRootState: Record<string, unknown> = observable({});
    let subscribers: (() => void)[] = [];
    let actionSubscribers: ActionSubscriber[] = [];

    function register(payload: RegisterActionPayload, rootState?: unknown) {
      if (rootState !== undefined) {
        observableRootState = observable(rootState as Record<string, unknown>);
      }

      payload.forEach((item) => {
        const modelPath = concatLastString(item.namespace, item.key);
        const modelContext = getModelContext(modelPath);
        if (!modelContext) {
          throw new Error("Model definition is not found.");
        }

        modelContext.isRegistered = true;

        const model = modelContext.model;

        if (rootState === undefined) {
          const state =
            item.state !== undefined ? item.state : model.initialState();

          runInAction(() => {
            setSubState(observableRootState, state, model.namespace, model.key);
          });
        }

        mergeObjects(
          {},
          flattenObject<any>(model.subscriptions()),
          (item: Subscription) => {
            const disposable = item();
            if (disposable) {
              modelContext.subscriptionDisposables.push(disposable);
            }
          }
        );
      });
    }

    function unregister(payload: UnregisterActionPayload) {
      payload.forEach((item) => {
        const modelPath = concatLastString(item.namespace, item.key);
        const modelContext = getModelContext(modelPath);

        modelContext?.subscriptionDisposables.forEach((disposable) =>
          disposable()
        );
        modelContext?.computedObserveDisposerByKey.forEach((disposer) =>
          disposer()
        );

        modelContextByModelPath.delete(modelPath);
        deleteModel(item.namespace, item.key);

        if (modelContext) {
          const model = modelContext.model;
          runInAction(() => {
            setSubState(
              observableRootState,
              NOTHING,
              model.namespace,
              model.key
            );
          });

          if (model.key !== undefined) {
            const namespacedState = get(observableRootState, model.namespace);
            if (namespacedState && keys(namespacedState).length === 0) {
              runInAction(() => {
                setSubState(
                  observableRootState,
                  NOTHING,
                  model.namespace,
                  undefined
                );
              });
            }
          }
        }
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
      register(registerActionPayload, payload.state);
    }

    function dispatchAction(action: AnyAction) {
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
        default: {
          break;
        }
      }

      const [modelPath, actionType] = splitLastString(action.type);
      const modelContext = getModelContext(modelPath);

      if (
        modelContext &&
        !modelContext.isRegistered &&
        (modelContext.flattenedReducers[actionType] ||
          modelContext.flattenedEffects[actionType])
      ) {
        dispatchAction({
          type: registerActionType,
          payload: [
            {
              namespace: modelContext.model.namespace,
              key: modelContext.model.key,
            },
          ],
        });
      }

      modelContext?.flattenedReducers[actionType]?.(action.payload);

      subscribers.forEach((fn) => fn());
      actionSubscribers.forEach((fn) => fn(action));

      if (modelContext?.isRegistered) {
        const effect = modelContext.flattenedEffects[actionType];
        if (effect) {
          return effect(action.payload);
        }
      }

      return Promise.resolve();
    }

    return {
      getState() {
        return observableRootState;
      },
      dispatch(action) {
        dispatchAction(action);
      },
      subscribe(fn) {
        subscribers = [...subscribers, fn];
        return () => {
          subscribers = subscribers.filter((subscriber) => subscriber !== fn);
        };
      },

      getModelState(namespace, key) {
        let state = observableRootState;
        state = get(state, namespace);
        if (key !== undefined) {
          state = state != null ? get(state, key) : undefined;
        }

        if (state !== undefined) {
          return state;
        } else {
          return getModelContext(concatLastString(namespace, key))
            ?.observableInitialState;
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);
        return modelContext?.flattenedGetters[getterPath]?.();
      },
      dispatchModelAction(namespace, key, actionType, payload) {
        return dispatchAction({
          type: concatLastString(concatLastString(namespace, key), actionType),
          payload,
        });
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
