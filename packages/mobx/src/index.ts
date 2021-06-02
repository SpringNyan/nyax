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
  UnregisterActionPayload,
  unregisterActionType,
  utils,
} from "@nyax/core";
import { action, computed, observable } from "mobx";

const { concatLastString, flattenObject, mergeObjects, splitLastString } =
  utils;

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
    if (value === undefined) {
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

  observableState: unknown | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createNyaxCreateStore(_options: {
  //
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

          flattenedReducers: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.reducers()),
            (item, key, parent) => {
              parent[key] = action(item as Reducer);
            }
          ),
          flattenedEffects: flattenObject(modelDefinition.effects()),
          flattenedGetters: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.selectors()),
            (item, key, parent) => {
              const computedValue = computed(item as Selector);
              parent[key] = () => computedValue.get();
            }
          ),

          observableState: observable(modelDefinition.initialState()),
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    let observableRootState: unknown = observable({});
    let subscribers: (() => void)[] = [];
    let actionSubscribers: ActionSubscriber[] = [];

    const registerCountByModelNamespace = new Map<string, number>();

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

        if (item.state !== undefined) {
          modelContext.observableState = observable(
            item.state as Record<string, unknown>
          );
        }
        setSubState(
          observableRootState,
          modelContext.observableState,
          modelDefinition.namespace,
          modelDefinition.key
        );

        const registerCount =
          (registerCountByModelNamespace.get(modelDefinition.namespace) ?? 0) +
          1;
        registerCountByModelNamespace.set(
          modelDefinition.namespace,
          registerCount
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
          setSubState(
            observableRootState,
            undefined,
            modelDefinition.namespace,
            modelDefinition.key
          );

          const registerCount =
            (registerCountByModelNamespace.get(modelDefinition.namespace) ??
              0) - 1;
          if (registerCount >= 0) {
            registerCountByModelNamespace.set(
              modelDefinition.namespace,
              registerCount
            );
            if (registerCount === 0) {
              setSubState(
                observableRootState,
                undefined,
                modelDefinition.namespace,
                undefined
              );
            }
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

      if (payload.state !== undefined) {
        observableRootState = observable(
          payload.state as Record<string, unknown>
        );
      }
    }

    const dispatchAction = (action: AnyAction) => {
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

      if (modelContext) {
        if (
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

        modelContext.flattenedReducers[actionType]?.(action.payload);

        subscribers.forEach((fn) => fn());
        actionSubscribers.forEach((fn) => fn(action));

        return (
          modelContext.flattenedEffects[actionType]?.(action.payload) ??
          Promise.resolve()
        );
      }

      return Promise.resolve();
    };

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
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);
        return modelContext?.observableState;
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
