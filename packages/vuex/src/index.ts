import {
  Action,
  ActionSubscriber,
  AnyAction,
  concatLastString,
  CreateStore,
  flattenObject,
  isObject,
  mergeObjects,
  ModelDefinition,
  RegisterActionPayload,
  registerActionType,
  ReloadActionPayload,
  reloadActionType,
  splitLastString,
  UnregisterActionPayload,
  unregisterActionType,
} from "@nyax/core";
import { computed, ComputedRef } from "vue";
import { createStore as vuexCreateStore, Store as VuexStore } from "vuex";

interface ModelContext {
  modelDefinition: ModelDefinition;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducerKeySet: Set<string>;
  flattenedEffectKeySet: Set<string>;

  computedRefByGetterPath: Record<string, ComputedRef>;
}

function isAction(action: unknown): action is AnyAction {
  return isObject(action) && !!action["type"];
}

export function createNyaxCreateStore(options: {
  createVuexStore?: () => VuexStore<unknown>;
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

          flattenedReducerKeySet: new Set(
            Object.keys(flattenObject(modelDefinition.reducers))
          ),
          flattenedEffectKeySet: new Set(
            Object.keys(flattenObject(modelDefinition.effects))
          ),

          computedRefByGetterPath: mergeObjects(
            {},
            flattenObject<any>(modelDefinition.selectors),
            (item, key, parent) => {
              parent[key] = computed(() => item());
            }
          ),
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    const createVuexStore =
      options.createVuexStore ?? (() => vuexCreateStore({}));

    const vuexStore = createVuexStore();

    function registerModels(payload: RegisterActionPayload) {
      payload.forEach((item) => {
        const modelPath = concatLastString(item.namespace, item.key);
        const modelContext = getModelContext(modelPath);
        if (!modelContext) {
          throw new Error("Model definition is not found.");
        }

        const modelDefinition = modelContext.modelDefinition;

        const state = () => mergeObjects({}, modelDefinition.initialState);

        const getters = mergeObjects(
          {},
          flattenObject<any>(modelDefinition.selectors),
          (item, key, parent) => {
            parent[concatLastString(modelPath, key)] = () => item();
          }
        );

        const mutations = mergeObjects(
          {},
          flattenObject<any>(modelDefinition.reducers),
          (item, key, parent) => {
            parent[concatLastString(modelPath, key)] = (
              _state: unknown,
              action: AnyAction
            ) => item(action.payload);
          }
        );

        const actions = mergeObjects(
          {},
          flattenObject<any>(modelDefinition.effects),
          (item, key, parent) => {
            parent[concatLastString(modelPath, key)] = (
              _context: unknown,
              action: AnyAction
            ) => item(action.payload);
          }
        );

        mergeObjects(
          {},
          flattenObject<any>(modelDefinition.subscriptions),
          (item) => {
            const disposable = item();
            modelContext.subscriptionDisposables.push(disposable);
          }
        );

        const modulePaths = modelPath.split("/");
        if (
          modulePaths[0] &&
          modulePaths[1] &&
          !vuexStore.hasModule(modulePaths[0])
        ) {
          vuexStore.registerModule(modulePaths[0], {});
        }

        vuexStore.registerModule(modulePaths, {
          state,
          mutations,
          actions,
          getters,
        });

        modelContext.isRegistered = true;
      });
    }

    function unregisterModels(payload: UnregisterActionPayload) {
      payload.forEach((item) => {
        const modelPath = concatLastString(item.namespace, item.key);
        const modelContext = getModelContext(modelPath);

        modelContext?.subscriptionDisposables.forEach((disposable) =>
          disposable()
        );

        const modulePaths = modelPath.split("/");
        if (vuexStore.hasModule(modulePaths)) {
          vuexStore.unregisterModule(modulePaths);
        }

        modelContextByModelPath.delete(modelPath);
        deleteModelDefinition(item.namespace, item.key);
      });
    }

    function reloadModels(payload: ReloadActionPayload) {
      const modelContexts = Array.from(modelContextByModelPath.values());

      unregisterModels(
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
            const [namespace, key] = paths;
            if (namespace && getModelDefinition(namespace, key)) {
              registerActionPayload.push({
                namespace,
                key,
              });
            }
          }
        );
      }
      registerModels(registerActionPayload);
    }

    function autoRegisterModel(
      modelContext: ModelContext | null,
      actionType: string
    ) {
      if (
        modelContext &&
        !modelContext.isRegistered &&
        (modelContext.flattenedReducerKeySet.has(actionType) ||
          modelContext.flattenedEffectKeySet.has(actionType))
      ) {
        vuexStore.commit({
          type: registerActionType,
          payload: [
            {
              namespace: modelContext.modelDefinition.namespace,
              key: modelContext.modelDefinition.key,
            },
          ],
        });
      }
    }

    const _commit = vuexStore.commit;
    vuexStore.commit = function (...args: [any, any?]) {
      const type = isAction(args[0]) ? args[0].type : args[0];
      const payload = isAction(args[0]) ? args[0].payload : args[1];

      const [modelPath, actionType] = splitLastString(type);
      const modelContext = getModelContext(modelPath);
      autoRegisterModel(modelContext, actionType);

      switch (type) {
        case registerActionType: {
          registerModels(payload);
          break;
        }
        case unregisterActionType: {
          unregisterModels(payload);
          break;
        }
        case reloadActionType: {
          reloadModels(payload);
          break;
        }
        default:
          break;
      }

      return _commit.apply(vuexStore, args);
    }.bind(vuexStore);

    const _dispatch = vuexStore.dispatch;
    vuexStore.dispatch = function (...args: [any, any?, any?]) {
      const type = isAction(args[0]) ? args[0].type : args[0];

      const [modelPath, actionType] = splitLastString(type);
      const modelContext = getModelContext(modelPath);
      autoRegisterModel(modelContext, actionType);

      return _dispatch.apply(vuexStore, args);
    }.bind(vuexStore);

    vuexStore.registerModule("@@nyax", {
      mutations: {
        [registerActionType]: (
          rootState: any,
          action: Action<RegisterActionPayload>
        ) => {
          action.payload.forEach((item) => {
            if (item.state !== undefined) {
              if (rootState) {
                if (item.key === undefined) {
                  rootState[item.namespace] = item.state;
                } else {
                  if (rootState[item.namespace]) {
                    rootState[item.namespace][item.key] = item.state;
                  }
                }
              }
            }
          });
        },
        [unregisterActionType]: () => {
          // noop
        },
        [reloadActionType]: (
          _rootState: any,
          action: Action<ReloadActionPayload>
        ) => {
          if (action.payload.state !== undefined) {
            vuexStore.replaceState(action.payload.state);
          }
        },
      },
    });

    const dispatchAction = (action: AnyAction) => {
      const [modelPath, actionType] = splitLastString(action.type);
      const modelContext = getModelContext(modelPath);

      if (modelContext) {
        if (modelContext.flattenedReducerKeySet.has(actionType)) {
          vuexStore.commit(action);
        }

        if (modelContext.flattenedEffectKeySet.has(actionType)) {
          return vuexStore.dispatch(action);
        }
      } else {
        vuexStore.commit(action);
      }

      return Promise.resolve();
    };

    let actionSubscribers: ActionSubscriber[] = [];
    vuexStore.subscribe((action) => {
      actionSubscribers.forEach((fn) => fn(action));
    });
    vuexStore.subscribeAction({
      before: (action) => {
        const [modelPath, actionType] = splitLastString(action.type);
        const modelContext = getModelContext(modelPath);

        if (
          modelContext?.flattenedEffectKeySet.has(actionType) &&
          !modelContext?.flattenedReducerKeySet.has(actionType)
        ) {
          actionSubscribers.forEach((fn) => fn(action));
        }
      },
    });

    return {
      getState() {
        return vuexStore.state;
      },
      dispatch(action) {
        dispatchAction(action);
      },
      subscribe(fn) {
        return vuexStore.subscribe(fn);
      },

      getModelState(namespace, key) {
        let state = vuexStore.state as any;
        state = state?.[namespace];
        if (key !== undefined) {
          state = state?.[key];
        }

        if (state !== undefined) {
          return state;
        } else {
          return getModelContext(concatLastString(namespace, key))
            ?.modelDefinition.initialState;
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const path = concatLastString(modelPath, getterPath);
        const modelContext = getModelContext(modelPath);

        return modelContext?.isRegistered
          ? vuexStore.getters[path]
          : modelContext?.computedRefByGetterPath[getterPath]?.value;
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
