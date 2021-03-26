import { flattenObject, Store } from "@nyax/core";
import { createStore as vuexCreateStore } from "vuex";

export function createStore(): Store {
  const vuexStore = vuexCreateStore({});

  return {
    getState() {
      return vuexStore.state;
    },
    dispatch(action) {
      vuexStore.commit(action.type, action.payload);
      vuexStore.dispatch(action.type, action.payload);
    },
    subscribe(fn) {
      const unsubscribe = vuexStore.subscribe(fn);
      const unsubscribeAction = vuexStore.subscribeAction(fn);
      return () => {
        unsubscribe();
        unsubscribeAction();
      };
    },

    getComputed(path) {
      return vuexStore.getters[path];
    },
    registerModel(modelDefinition) {
      const initialState = modelDefinition.initialState();

      const flattenedReducers = flattenObject(modelDefinition.reducers());

      const flattenedSelectors = flattenObject(modelDefinition.selectors());
      const flattenedEffects = flattenObject(modelDefinition.effects());
    },
    unregisterModel(modelLocator) {},
  };
}
