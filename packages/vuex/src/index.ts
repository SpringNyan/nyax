import {
  concatLastString,
  flattenObject,
  mergeObjects,
  ModelDefinitionInstance,
  splitLastString,
  Store,
} from "@nyax/core";
import { createStore as vuexCreateStore } from "vuex";

export function createStore(): Store {
  const modelDefinitionInstanceByPath = new Map<
    string,
    ModelDefinitionInstance<any, any, any, any, any, any>
  >();

  const vuexStore = vuexCreateStore({});

  return {
    getState() {
      return vuexStore.state;
    },
    getComputed(path) {
      return vuexStore.getters[path];
    },
    dispatch(action) {
      const [path, actionName] = splitLastString(action.type);
      const modelDefinitionInstance = modelDefinitionInstanceByPath.get(path);

      if (modelDefinitionInstance?.reducers?.[actionName]) {
        vuexStore.commit(action.type, action.payload);
      }

      if (modelDefinitionInstance?.effects?.[actionName]) {
        vuexStore.dispatch(action.type, action.payload);
      }
    },
    subscribe(fn) {
      return vuexStore.subscribe(fn);
    },

    registerModel(modelDefinitionInstance) {
      const path = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );

      if (modelDefinitionInstanceByPath.has(path)) {
        throw new Error("model is already registered.");
      }
      modelDefinitionInstanceByPath.set(path, modelDefinitionInstance);

      const state = () =>
        mergeObjects<any>({}, modelDefinitionInstance.initialState);

      const getters = mergeObjects<any>(
        {},
        flattenObject(modelDefinitionInstance.selectors),
        (item, key, parent) => {
          parent[key] = () => item();
        }
      );

      const mutations = mergeObjects<any>(
        {},
        flattenObject(modelDefinitionInstance.reducers),
        (item, key, parent) => {
          parent[key] = (_state: unknown, payload: unknown) => item(payload);
        }
      );

      const actions = mergeObjects<any>(
        {},
        flattenObject(modelDefinitionInstance.effects),
        (item, key, parent) => {
          parent[key] = (_context: unknown, payload: unknown) => item(payload);
        }
      );

      vuexStore.registerModule(path.split("/"), {
        namespaced: true,
        state,
        mutations,
        actions,
        getters,
      });
    },
    unregisterModel(modelDefinitionInstance) {
      const path = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );

      vuexStore.unregisterModule(path.split("/"));

      modelDefinitionInstanceByPath.delete(path);
    },

    subscribeDispatchAction: (fn) => {},
    subscribeDispatchResult: (fn) => {},
  };
}
