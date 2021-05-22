import {
  AnyAction,
  concatLastString,
  CreateStore,
  flattenObject,
  isObject,
  mergeObjects,
  ModelDefinition,
  RegisterActionPayload,
  registerActionType,
  reloadActionType,
  splitLastString,
  UnregisterActionPayload,
  unregisterActionType,
} from "@nyax/core";
import { computed, ComputedRef, reactive } from "vue";
import { createStore as vuexCreateStore, Store as VuexStore } from "vuex";

interface ModelContext {
  modelDefinition: ModelDefinition;
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducerKeySet: Set<string>;
  flattenedEffectKeySet: Set<string>;

  reactiveState: unknown;
  computedRefByGetterPath: Record<string, ComputedRef>;
}

function isAction(action: unknown): action is AnyAction {
  return isObject(action) && !!action["type"];
}

export function createNyaxCreateStore(options: {
  createVuexStore?: () => VuexStore<unknown>;
}): CreateStore {
  const modelContextByModelPath = new Map<string, ModelContext>();

  function getModelContext(
    getModelDefinition: (
      namespace: string,
      key: string | undefined
    ) => ModelDefinition | null,
    modelPath: string
  ) {
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

        reactiveState: reactive(mergeObjects({}, modelDefinition.initialState)),
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

  return ({ getModelDefinition, deleteModelDefinition }) => {
    const vuexStore = createVuexStore();

    const _commit = vuexStore.commit;
    vuexStore.commit = function (...args: [any, any?]) {
      const type = isAction(args[0]) ? args[0].type : args[0];
      const payload = isAction(args[0]) ? args[0].payload : args[1];

      switch (type) {
        case registerActionType: {
          (payload as RegisterActionPayload).forEach((item) => {
            const modelPath = concatLastString(item.namespace, item.key);
            const modelContext = getModelContext(getModelDefinition, modelPath);
            if (!modelContext) {
              throw new Error("Model definition is not found.");
            }

            const modelDefinition = modelContext.modelDefinition;

            const state = () => mergeObjects({}, modelDefinition.initialState);

            const getters = mergeObjects(
              {},
              flattenObject<any>(modelDefinition.selectors),
              (item, key, parent) => {
                parent[key] = () => item();
              }
            );

            const mutations = mergeObjects(
              {},
              flattenObject<any>(modelDefinition.reducers),
              (item, key, parent) => {
                parent[key] = (_state: unknown, payload: unknown) =>
                  item(payload);
              }
            );

            const actions = mergeObjects(
              {},
              flattenObject<any>(modelDefinition.effects),
              (item, key, parent) => {
                parent[key] = (_context: unknown, payload: unknown) =>
                  item(payload);
              }
            );

            const subscriptions = Object.values(
              flattenObject<any>(modelDefinition.subscriptions)
            );
            const subscriptionDisposables = subscriptions
              .map((subscription) => subscription())
              .filter(Boolean);
            modelContext.subscriptionDisposables = subscriptionDisposables;

            vuexStore.registerModule(modelPath.split("/"), {
              namespaced: true,
              state,
              mutations,
              actions,
              getters,
            });

            modelContext.isRegistered = true;
          });
          break;
        }
        case unregisterActionType: {
          (payload as UnregisterActionPayload).forEach((item) => {
            const modelPath = concatLastString(item.namespace, item.key);
            const modelContext = getModelContext(getModelDefinition, modelPath);

            modelContext?.subscriptionDisposables.forEach((disposable) =>
              disposable()
            );
            vuexStore.unregisterModule(modelPath.split("/"));

            modelContextByModelPath.delete(modelPath);
            deleteModelDefinition(item.namespace, item.key);
          });
          break;
        }
        case reloadActionType: {
          throw new Error("TODO");
          break;
        }
      }

      return _commit.apply(vuexStore, args);
    }.bind(vuexStore);

    const dispatchAction = (action: AnyAction) => {
      const [modelPath, actionType] = splitLastString(action.type);
      const modelContext = getModelContext(getModelDefinition, modelPath);

      if (modelContext?.flattenedReducerKeySet?.has(actionType)) {
        vuexStore.commit(action);
      }

      if (modelContext?.flattenedEffectKeySet?.has(actionType)) {
        return vuexStore.dispatch(action);
      } else {
        return Promise.resolve();
      }
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
            getModelDefinition,
            concatLastString(namespace, key)
          )?.reactiveState;
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const path = concatLastString(modelPath, getterPath);
        const modelContext = getModelContext(getModelDefinition, modelPath);

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

      subscribeDispatchAction: (fn) => {
        return vuexStore.subscribe(fn);
      },
    };
  };
}
