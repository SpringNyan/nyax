import {
  AnyAction,
  concatLastString,
  DispatchActionSubscriber,
  DispatchResultSubscriber,
  flattenObject,
  isObject,
  last,
  mergeObjects,
  splitLastString,
  Store,
} from "@nyax/core";
import {
  createStore as vuexCreateStore,
  Plugin as VuexPlugin,
  Store as VuexStore,
} from "vuex";

interface ModelContext {
  flattenedReducerKeySet: Set<string>;
  flattenedEffectKeySet: Set<string>;

  subscriptionDisposables: (() => void)[];
}

function isAction(action: unknown): action is AnyAction {
  return isObject(action) && !!action["type"];
}

export function createStore(options: {
  createVuexStore?: (params: {
    plugin: VuexPlugin<unknown>;
  }) => VuexStore<unknown>;
}): Store {
  const modelContextByModelPath = new Map<string, ModelContext>();
  const dispatchDeferredByAction = new Map<
    AnyAction,
    {
      resolve(value: unknown): void;
      reject(error: unknown): void;
    }
  >();

  let dispatchActionSubscribers: DispatchActionSubscriber[] = [];
  let dispatchResultSubscribers: DispatchResultSubscriber[] = [];

  const currentActionStack: (AnyAction | null)[] = [];

  const vuexPlugin: VuexPlugin<unknown> = (store) => {
    const _commit = store.commit;
    store.commit = function (...args: [any, any?]) {
      const action = isAction(args[0]) ? args[0] : null;
      currentActionStack.push(action);
      try {
        return _commit.apply(store, args);
      } finally {
        currentActionStack.pop();
      }
    }.bind(store);

    const _dispatch = store.dispatch;
    store.dispatch = function (...args: [any, any?, any?]) {
      const action = isAction(args[0]) ? args[0] : null;
      currentActionStack.push(action);
      try {
        return _dispatch.apply(store, args);
      } finally {
        currentActionStack.pop();
      }
    }.bind(store);

    store.subscribe((_mutation) => {
      const action = last(currentActionStack) ?? _mutation;

      dispatchActionSubscribers.forEach((fn) => {
        fn(action);
      });
    });

    store.subscribeAction((_action) => {
      const action = last(currentActionStack) ?? _action;

      new Promise<unknown>((resolve, reject) => {
        dispatchDeferredByAction.set(action, { resolve, reject });
      }).then(
        (value) => {
          dispatchDeferredByAction.delete(action);
          dispatchResultSubscribers.forEach((fn) => {
            fn(action, value);
          });
        },
        (reason) => {
          dispatchDeferredByAction.delete(action);
          dispatchResultSubscribers.forEach((fn) => {
            fn(action, undefined, reason);
          });
        }
      );

      dispatchActionSubscribers.forEach((fn) => {
        fn(action);
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
      const modelContext = modelContextByModelPath.get(modelPath);

      if (modelContext?.flattenedReducerKeySet?.has(actionName)) {
        vuexStore.commit(action);
      }

      if (modelContext?.flattenedEffectKeySet?.has(actionName)) {
        vuexStore.dispatch(action);
      }
    },
    subscribe(fn) {
      return vuexStore.subscribe(fn);
    },

    registerModel(modelDefinition) {
      const modelPath = concatLastString(
        modelDefinition.namespace,
        modelDefinition.key
      );

      if (modelContextByModelPath.has(modelPath)) {
        throw new Error("Model is already registered.");
      }
      const modelContext: ModelContext = {
        flattenedReducerKeySet: new Set(
          Object.keys(flattenObject(modelDefinition.reducers))
        ),
        flattenedEffectKeySet: new Set(
          Object.keys(flattenObject(modelDefinition.effects))
        ),

        subscriptionDisposables: [],
      };
      modelContextByModelPath.set(modelPath, modelContext);

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
          parent[key] = (_state: unknown, payload: unknown) => item(payload);
        }
      );

      const actions = mergeObjects(
        {},
        flattenObject<any>(modelDefinition.effects),
        (item, key, parent) => {
          parent[key] = (_context: unknown, payload: unknown) => item(payload);
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
    },
    unregisterModel(modelDefinition) {
      const modelPath = concatLastString(
        modelDefinition.namespace,
        modelDefinition.key
      );

      const modelContext = modelContextByModelPath.get(modelPath);
      modelContext?.subscriptionDisposables.forEach((disposable) =>
        disposable()
      );

      vuexStore.unregisterModule(modelPath.split("/"));

      modelContextByModelPath.delete(modelPath);
    },

    subscribeDispatchAction: (fn) => {
      dispatchActionSubscribers.push(fn);
      return () => {
        dispatchActionSubscribers = dispatchActionSubscribers.filter(
          (e) => e !== fn
        );
      };
    },
    subscribeDispatchResult: (fn) => {
      dispatchResultSubscribers.push(fn);
      return () => {
        dispatchResultSubscribers = dispatchResultSubscribers.filter(
          (e) => e !== fn
        );
      };
    },
  };
}
