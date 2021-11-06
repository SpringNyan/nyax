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
  model: Model;
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

        let _computedRefByGetterPath: Record<string, ComputedRef> | undefined;
        modelContext = {
          model,
          isRegistered: false,

          subscriptionDisposables: [],

          flattenedReducerKeySet: new Set(
            Object.keys(flattenObject(model.reducers()))
          ),
          flattenedEffectKeySet: new Set(
            Object.keys(flattenObject(model.effects()))
          ),

          get computedRefByGetterPath() {
            if (_computedRefByGetterPath === undefined) {
              _computedRefByGetterPath = mergeObjects(
                {},
                flattenObject<any>(model?.selectors() ?? {}),
                (item: Selector, key, parent) => {
                  // TODO: https://github.com/vuejs/vuex/pull/1884
                  // parent[key] = computed(item);

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
      function register(payload: RegisterActionPayload, rootState?: unknown) {
        if (rootState !== undefined) {
          store.replaceState(rootState);
        }

        payload.forEach((item) => {
          const modelPath = concatLastString(item.namespace, item.key);
          const modelContext = getModelContext(modelPath);
          if (!modelContext) {
            throw new Error("Model definition is not found.");
          }

          modelContext.isRegistered = true;

          const model = modelContext.model;

          const state = () =>
            mergeObjects(
              {},
              item.state !== undefined
                ? (item.state as Record<string, unknown>)
                : model.initialState()
            );

          const getters = mergeObjects(
            {},
            flattenObject<any>(model.selectors()),
            (item: Selector, key, parent) => {
              parent[concatLastString(modelPath, key)] = item;
            }
          );

          const mutations = mergeObjects(
            {},
            flattenObject<any>(model.reducers()),
            (item: Reducer, key, parent) => {
              parent[concatLastString(modelPath, key)] = (
                _state: unknown,
                action: AnyAction
              ) => item(action.payload);
            }
          );

          const actions = mergeObjects(
            {},
            flattenObject<any>(model.effects()),
            (item: Effect, key, parent) => {
              parent[concatLastString(modelPath, key)] = (
                _context: unknown,
                action: AnyAction
              ) => item(action.payload);
            }
          );

          const modulePaths = modelPath.split("/");
          if (
            modulePaths[0] &&
            modulePaths[1] &&
            !store.hasModule(modulePaths[0])
          ) {
            store.registerModule(
              modulePaths[0],
              {},
              { preserveState: rootState !== undefined }
            );
          }

          store.registerModule(
            modulePaths,
            {
              state,
              mutations,
              actions,
              getters,
            },
            { preserveState: rootState !== undefined }
          );

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

          modelContextByModelPath.delete(modelPath);
          deleteModel(item.namespace, item.key);

          const modulePaths = modelPath.split("/");
          if (store.hasModule(modulePaths)) {
            store.unregisterModule(modulePaths);
          }

          const model = modelContext?.model;
          if (
            model &&
            model.key !== undefined &&
            Object.keys((store.state as any)?.[model.namespace] ?? {})
              .length === 0
          ) {
            if (store.hasModule(model.namespace)) {
              store.unregisterModule(model.namespace);
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
                namespace: modelContext.model.namespace,
                key: modelContext.model.key,
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
          default: {
            break;
          }
        }

        return _commit.apply(store, args);
      }.bind(store);

      const _dispatch = store.dispatch;
      store.dispatch = function (...args: [any, any?]) {
        const type = isAction(args[0]) ? args[0].type : args[0];

        const [modelPath, actionType] = splitLastString(type);
        const modelContext = getModelContext(modelPath);
        autoRegister(modelContext, actionType);

        return _dispatch.apply(store, args);
      }.bind(store);

      store.registerModule("@@nyax", {
        mutations: {
          [registerActionType]: () => {
            // noop
          },
          [unregisterActionType]: () => {
            // noop
          },
          [reloadActionType]: () => {
            // noop
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
          )?.model.initialState();
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
