import {
  AnyAction,
  concatLastString,
  CreateStore,
  flattenObject,
  mergeObjects,
  ModelDefinition,
  splitLastString,
} from "@nyax/core";
import { computed, ComputedRef, reactive } from "vue";
import { createStore as vuexCreateStore, Store as VuexStore } from "vuex";

interface ModelContext {
  isRegistered: boolean;

  subscriptionDisposables: (() => void)[];

  flattenedReducerKeySet: Set<string>;
  flattenedEffectKeySet: Set<string>;

  reactiveState: unknown;
  computedRefByPath: Record<string, ComputedRef>;
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
        throw new Error("Model definition is not registered.");
      }

      modelContext = {
        isRegistered: false,

        subscriptionDisposables: [],

        flattenedReducerKeySet: new Set(
          Object.keys(flattenObject(modelDefinition.reducers))
        ),
        flattenedEffectKeySet: new Set(
          Object.keys(flattenObject(modelDefinition.effects))
        ),

        reactiveState: reactive(mergeObjects({}, modelDefinition.initialState)),
        computedRefByPath: mergeObjects(
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

    const dispatch = (action: AnyAction) => {
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
        dispatch(action);
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
          ).reactiveState;
        }
      },
      getModelComputed(namespace, key, getterPath) {
        const modelPath = concatLastString(namespace, key);
        const path = concatLastString(modelPath, getterPath);
        const modelContext = getModelContext(getModelDefinition, modelPath);
        return modelContext.isRegistered
          ? vuexStore.getters[path]
          : modelContext.computedRefByPath[path]?.value;
      },
      dispatchModelAction(namespace, key, actionType, payload) {
        return dispatch({
          type: concatLastString(concatLastString(namespace, key), actionType),
          payload,
        });
      },
    };
  };
}
