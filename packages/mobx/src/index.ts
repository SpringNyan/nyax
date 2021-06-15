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
  Selector,
  Subscription,
  UnregisterActionPayload,
  unregisterActionType,
  utils,
} from "@nyax/core";
import { action, computed, observable, runInAction } from "mobx";

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
    state = {};
  }

  if (key === undefined) {
    if (value === NOTHING) {
      delete state[namespace];
    } else {
      state[namespace] = value;
    }
    return state;
  } else {
    state[namespace] = setSubState(state[namespace], value, key, undefined);
    return state;
  }
}

interface ModelContext {
  modelDefinition: ModelDefinition;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedGetters: Record<string, () => unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/ban-types
export function createNyaxCreateStore(_options: {}): CreateStore {
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

          flattenedReducers: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.reducers()),
            (item: Reducer, key, parent) => {
              parent[key] = action(item);
            }
          ),
          flattenedEffects: flattenObject(modelDefinition.effects()),
          flattenedGetters: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.selectors()),
            (item: Selector, key, parent) => {
              const computedValue = computed(item);
              parent[key] = () => computedValue.get();
            }
          ),
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    let observableRootState: unknown = observable({});
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

        const modelDefinition = modelContext.modelDefinition;

        if (rootState === undefined) {
          const state =
            item.state !== undefined
              ? item.state
              : modelDefinition.initialState();

          runInAction(() => {
            setSubState(
              observableRootState,
              state,
              modelDefinition.namespace,
              modelDefinition.key
            );
          });
        }

        mergeObjects(
          {},
          flattenObject<any>(modelDefinition.subscriptions()),
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

        modelContextByModelPath.delete(modelPath);
        deleteModelDefinition(item.namespace, item.key);

        if (modelContext) {
          const modelDefinition = modelContext.modelDefinition;
          runInAction(() => {
            setSubState(
              observableRootState,
              NOTHING,
              modelDefinition.namespace,
              modelDefinition.key
            );
          });

          if (
            modelDefinition.key !== undefined &&
            Object.keys(
              (observableRootState as any)?.[modelDefinition.namespace] ?? {}
            ).length === 0
          ) {
            runInAction(() => {
              setSubState(
                observableRootState,
                NOTHING,
                modelDefinition.namespace,
                undefined
              );
            });
          }
        }
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
          payload.state as Record<string, unknown>,
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
              namespace: modelContext.modelDefinition.namespace,
              key: modelContext.modelDefinition.key,
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
        let state = observableRootState as any;
        state = state?.[namespace];
        if (key !== undefined) {
          state = state?.[key];
        }

        if (state !== undefined) {
          return state;
        } else {
          return getModelContext(
            concatLastString(namespace, key)
          )?.modelDefinition.initialState();
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
