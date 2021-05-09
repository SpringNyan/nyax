import {
  concatLastString,
  ModelDefinitionInstance,
  splitLastString,
  Store,
} from "@nyax/core";
import { createStore as vuexCreateStore } from "vuex";

export function createStore(): Store {
  const modelDefinitionInstanceByFullNamespace = new Map<
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
      const [fullNamespace, actionName] = splitLastString(action.type);
      const modelDefinitionInstance = modelDefinitionInstanceByFullNamespace.get(
        fullNamespace
      );

      if (modelDefinitionInstance?.reducers?.[actionName]) {
        vuexStore.commit(action.type, action.payload);
      }

      if (modelDefinitionInstance?.effects?.[actionName]) {
        vuexStore.dispatch(action.type, action.payload);
      }
    },
    subscribe(fn) {
      const unsubscribe = vuexStore.subscribe(fn);
      const unsubscribeAction = vuexStore.subscribeAction(fn);
      return () => {
        unsubscribe();
        unsubscribeAction();
      };
    },

    registerModel(modelDefinitionInstance) {
      const fullNamespace = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );

      if (modelDefinitionInstanceByFullNamespace.has(fullNamespace)) {
        throw new Error("model is already registered.");
      }
      modelDefinitionInstanceByFullNamespace.set(
        fullNamespace,
        modelDefinitionInstance
      );
    },
    unregisterModel(modelDefinitionInstance) {
      const fullNamespace = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );
      modelDefinitionInstanceByFullNamespace.delete(fullNamespace);
    },

    subscribeDispatchAction: (fn) => {},
    subscribeDispatchResult: (fn) => {},
  };
}
