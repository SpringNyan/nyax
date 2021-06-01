import {
  Action,
  ActionSubscriber,
  AnyAction,
  CreateStore,
  ModelDefinition,
  RegisterActionPayload,
  registerActionType,
  ReloadActionPayload,
  reloadActionType,
  UnregisterActionPayload,
  unregisterActionType,
  utils,
} from "@nyax/core";
import { ComputedRef } from "vue";
import {
  createStore as vuexCreateStore,
  Plugin as VuexPlugin,
  Store as VuexStore,
} from "vuex";

const {
  concatLastString,
  flattenObject,
  isPlainObject,
  mergeObjects,
  splitLastString,
} = utils;

interface ModelContext {
  modelDefinition: ModelDefinition;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducerKeySet: Set<string>;
  flattenedEffectKeySet: Set<string>;

  computedRefByGetterPath: Record<string, ComputedRef>;
}

function isAction(action: unknown): action is AnyAction {
  return isPlainObject(action) && !!action["type"];
}

export function createNyaxCreateStore(options: {
  createVuexStore?: (options: {
    plugin: VuexPlugin<unknown>;
  }) => VuexStore<unknown>;
}): CreateStore {
  return ({ getModelDefinition, deleteModelDefinition }) => {
    const modelContextByModelPath = new Map<string, ModelContext>();
    const registerCountByModelNamespace = new Map<string, number>();

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

        let _computedRefByGetterPath: Record<string, ComputedRef> | undefined;
        modelContext = {
          modelDefinition,
          isRegistered: false,

          subscriptionDisposables: [],

          flattenedReducerKeySet: new Set(
            Object.keys(flattenObject(modelDefinition.reducers()))
          ),
          flattenedEffectKeySet: new Set(
            Object.keys(flattenObject(modelDefinition.effects()))
          ),

          get computedRefByGetterPath() {
            if (_computedRefByGetterPath === undefined) {
              _computedRefByGetterPath = mergeObjects(
                {},
                flattenObject<any>(modelDefinition?.selectors() ?? {}),
                (item, key, parent) => {
                  // TODO: https://github.com/vuejs/vuex/pull/1884
                  // parent[key] = computed(() => item());

                  parent[key] = {
                    get value() {
                      return item();
                    },
                  };
                }
              );
            }
            return _computedRefByGetterPath;
          },
        };
        modelContextByModelPath.set(modelPath, modelContext);
      }

      return modelContext;
    }

    let actionSubscribers: ActionSubscriber[] = [];
    const vuexPlugin: VuexPlugin<unknown> = (store) => {
      function register(payload: RegisterActionPayload) {
        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);
          if (!modelContext) {
            throw new Error("Model definition is not found.");
          }

          const modelDefinition = modelContext.modelDefinition;

          const state = () => mergeObjects({}, modelDefinition.initialState());

          const getters = mergeObjects(
            {},
            flattenObject<any>(modelDefinition.selectors()),
            (item, key, parent) => {
              parent[concatLastString(modelPath, key)] = () => item();
            }
          );

          const mutations = mergeObjects(
            {},
            flattenObject<any>(modelDefinition.reducers()),
            (item, key, parent) => {
              parent[concatLastString(modelPath, key)] = (
                _state: unknown,
                action: AnyAction
              ) => item(action.payload);
            }
          );

          const actions = mergeObjects(
            {},
            flattenObject<any>(modelDefinition.effects()),
            (item, key, parent) => {
              parent[concatLastString(modelPath, key)] = (
                _context: unknown,
                action: AnyAction
              ) => item(action.payload);
            }
          );

          mergeObjects(
            {},
            flattenObject<any>(modelDefinition.subscriptions()),
            (item) => {
              const disposable = item();
              modelContext.subscriptionDisposables.push(disposable);
            }
          );

          const modulePaths = modelPath.split("/");
          if (
            modulePaths[0] &&
            modulePaths[1] &&
            !store.hasModule(modulePaths[0])
          ) {
            store.registerModule(modulePaths[0], {});
          }

          store.registerModule(modulePaths, {
            state,
            mutations,
            actions,
            getters,
          });

          modelContext.isRegistered = true;

          const registerCount =
            (registerCountByModelNamespace.get(modelDefinition.namespace) ??
              0) + 1;
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

          const modulePaths = modelPath.split("/");
          if (store.hasModule(modulePaths)) {
            store.unregisterModule(modulePaths);
          }

          const modelNamespace =
            modelContext?.modelDefinition.namespace ?? null;
          if (modelNamespace) {
            const registerCount =
              (registerCountByModelNamespace.get(modelNamespace) ?? 0) - 1;
            if (registerCount >= 0) {
              registerCountByModelNamespace.set(modelNamespace, registerCount);
              if (registerCount === 0) {
                if (store.hasModule(modelNamespace)) {
                  store.unregisterModule(modelNamespace);
                }
              }
            }
          }

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

      function autoRegister(
        modelContext: ModelContext | null,
        actionType: string
      ) {
        if (
          modelContext &&
          !modelContext.isRegistered &&
          (modelContext.flattenedReducerKeySet.has(actionType) ||
            modelContext.flattenedEffectKeySet.has(actionType))
        ) {
          store.commit({
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

      const _commit = store.commit;
      store.commit = function (...args: [any, any?]) {
        const type = isAction(args[0]) ? args[0].type : args[0];
        const payload = isAction(args[0]) ? args[0].payload : args[1];

        const [modelPath, actionType] = splitLastString(type);
        const modelContext = getModelContext(modelPath);
        autoRegister(modelContext, actionType);

        switch (type) {
          case registerActionType: {
            register(payload);
            break;
          }
          case unregisterActionType: {
            unregister(payload);
            break;
          }
          case reloadActionType: {
            reload(payload);
            break;
          }
          default:
            break;
        }

        return _commit.apply(store, args);
      }.bind(store);

      const _dispatch = store.dispatch;
      store.dispatch = function (...args: [any, any?, any?]) {
        const type = isAction(args[0]) ? args[0].type : args[0];

        const [modelPath, actionType] = splitLastString(type);
        const modelContext = getModelContext(modelPath);
        autoRegister(modelContext, actionType);

        return _dispatch.apply(store, args);
      }.bind(store);

      store.registerModule("@@nyax", {
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
              store.replaceState(action.payload.state);
            }
          },
        },
      });

      store.subscribe((action) => {
        actionSubscribers.forEach((fn) => fn(action));
      });
      store.subscribeAction({
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
    };

    const createVuexStore =
      options.createVuexStore ??
      (({ plugin }) => vuexCreateStore({ plugins: [plugin] }));

    const vuexStore = createVuexStore({ plugin: vuexPlugin });

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
          return getModelContext(
            concatLastString(namespace, key)
          )?.modelDefinition.initialState();
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const modelContext = getModelContext(modelPath);

        const path = concatLastString(modelPath, getterPath);
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
