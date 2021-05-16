import {
  concatLastString,
  DispatchActionSubscriber,
  DispatchResultSubscriber,
  flattenObject,
  mergeObjects,
  ModelDefinitionInstance,
  splitLastString,
  Store,
} from "@nyax/core";
import {
  createStore as vuexCreateStore,
  Plugin as VuexPlugin,
  Store as VuexStore,
} from "vuex";

export function createStore(options: {
  createVuexStore?: (params: {
    plugin: VuexPlugin<unknown>;
  }) => VuexStore<unknown>;
  onUnhandledError?: (error: unknown) => void;
}): Store {
  const modelDefinitionInstanceByModelPath = new Map<
    string,
    ModelDefinitionInstance<any, any, any, any, any, any>
  >();
  const subscriptionDisposablesByModelPath = new Map<string, (() => void)[]>();

  const dispatchActionSubscribers: DispatchActionSubscriber[] = [];
  const dispatchResultSubscribers: DispatchResultSubscriber[] = [];

  const onUnhandledError =
    options.onUnhandledError ??
    ((error) => {
      console.error(error);
    });

  const vuexPlugin: VuexPlugin<unknown> = (store) => {
    store.subscribe((mutation) => {
      dispatchActionSubscribers.forEach((fn) => {
        try {
          fn(mutation);
        } catch (error) {
          onUnhandledError(error);
        }
      });
    });

    store.subscribeAction((action) => {
      dispatchActionSubscribers.forEach((fn) => {
        try {
          fn(action);
        } catch (error) {
          onUnhandledError(error);
        }
      });
    });
  };

  const createVuexStore =
    options.createVuexStore ??
    (({ plugin }) => {
      return vuexCreateStore({
        plugins: [plugin],
      });
    });

  const vuexStore = createVuexStore({
    plugin: vuexPlugin,
  });

  return {
    getState() {
      return vuexStore.state;
    },
    getComputed(path) {
      return vuexStore.getters[path];
    },
    dispatch(action) {
      const [modelPath, actionName] = splitLastString(action.type);
      const modelDefinitionInstance = modelDefinitionInstanceByModelPath.get(
        modelPath
      );

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
      const modelPath = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );

      if (modelDefinitionInstanceByModelPath.has(modelPath)) {
        throw new Error("Model is already registered.");
      }
      modelDefinitionInstanceByModelPath.set(
        modelPath,
        modelDefinitionInstance
      );

      const state = () =>
        mergeObjects({}, modelDefinitionInstance.initialState);

      const getters = mergeObjects(
        {},
        flattenObject<any>(modelDefinitionInstance.selectors),
        (item, key, parent) => {
          parent[key] = () => item();
        }
      );

      const mutations = mergeObjects(
        {},
        flattenObject<any>(modelDefinitionInstance.reducers),
        (item, key, parent) => {
          parent[key] = (_state: unknown, payload: unknown) => item(payload);
        }
      );

      const actions = mergeObjects(
        {},
        flattenObject<any>(modelDefinitionInstance.effects),
        (item, key, parent) => {
          parent[key] = (_context: unknown, payload: unknown) => item(payload);
        }
      );

      const subscriptions = Object.values(
        flattenObject<any>(modelDefinitionInstance.subscriptions)
      );
      const subscriptionDisposables = subscriptions
        .map((subscription) => subscription())
        .filter(Boolean);
      subscriptionDisposablesByModelPath.set(
        modelPath,
        subscriptionDisposables
      );

      vuexStore.registerModule(modelPath.split("/"), {
        namespaced: true,
        state,
        mutations,
        actions,
        getters,
      });
    },
    unregisterModel(modelDefinitionInstance) {
      const modelPath = concatLastString(
        modelDefinitionInstance.namespace,
        modelDefinitionInstance.key
      );

      vuexStore.unregisterModule(modelPath.split("/"));

      const subscriptionDisposables = subscriptionDisposablesByModelPath.get(
        modelPath
      );
      subscriptionDisposables?.forEach((disposable) => disposable());
      subscriptionDisposablesByModelPath.delete(modelPath);

      modelDefinitionInstanceByModelPath.delete(modelPath);
    },

    subscribeDispatchAction: (fn) => {
      throw new Error("NotImplemented");
    },
    subscribeDispatchResult: (fn) => {
      throw new Error("NotImplemented");
    },
  };
}
