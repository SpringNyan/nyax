import {
  Action,
  CreateStore,
  Effect,
  Model,
  ModelDefinition,
  ModelMountActionPayload,
  ModelMountActionType,
  ModelPatchActionType,
  ModelSetActionType,
  ModelUnmountActionPayload,
  ModelUnmountActionType,
  Reducer,
  ReloadActionPayload,
  ReloadActionType,
  Selector,
  Subscription,
  utils,
} from "@nyax/core";
import {
  computed,
  entries,
  get,
  IComputedValue,
  keys,
  observable,
  observe,
  remove,
  runInAction,
  set,
} from "mobx";

const { concatLastString, flattenObject, splitLastString } = utils;

const NOTHING = {};

function setSubState(
  state: any,
  value: any,
  namespace: string,
  key: string | undefined
): any {
  if (state === undefined) {
    state = observable({});
  }

  if (key === undefined) {
    if (value === NOTHING) {
      remove(state, namespace);
    } else {
      set(state, namespace, value);
    }
    return state;
  } else {
    set(
      state,
      namespace,
      setSubState(get(state, namespace), value, key, undefined)
    );
    return state;
  }
}

interface ModelDefinitionContext {
  modelDefinition: ModelDefinition;

  flattenedSelectors: Record<string, Selector>;
  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedSubscriptions: Record<string, Subscription>;
}

interface ModelContext {
  model: Model;

  flattenedComputeds: Record<string, IComputedValue<unknown>>;
  computedObserveDisposers: (() => void)[];

  subscriptionDisposables: (() => void)[];
}

export function generateCreateStore(options: {}): CreateStore {
  options;

  return (
    { getModelDefinition, getModel, mountModel, unmountModel },
    options
  ) => {
    const modelDefinitionContextByNamespace = new Map<
      string,
      ModelDefinitionContext
    >();
    const modelContextByFullNamespace = new Map<string, ModelContext>();

    const observableRootState: Record<string, unknown> = observable({});
    let subscribers: (() => void)[] = [];
    let actionSubscribers: ((action: Action) => void)[] = [];

    function getModelDefinitionContext(
      namespace: string
    ): ModelDefinitionContext | null {
      let context = modelDefinitionContextByNamespace.get(namespace);
      if (!context) {
        const modelDefinition = getModelDefinition(namespace);
        if (!modelDefinition) {
          return null;
        }

        context = {
          modelDefinition,

          flattenedSelectors: flattenObject(
            modelDefinition.selectors,
            options.pathSeparator
          ) as any,
          flattenedReducers: flattenObject(
            modelDefinition.reducers,
            options.pathSeparator
          ) as any,
          flattenedEffects: flattenObject(
            modelDefinition.effects,
            options.pathSeparator
          ) as any,
          flattenedSubscriptions: flattenObject(
            modelDefinition.subscriptions,
            options.pathSeparator
          ) as any,
        };
        modelDefinitionContextByNamespace.set(namespace, context);
      }
      return context;
    }

    function handleMountModel(
      model: Model,
      payload: ModelMountActionPayload | null
    ) {
      const modelDefinitionContext = getModelDefinitionContext(model.namespace);
      if (!modelDefinitionContext) {
        throw new Error("Model definition is not registered.");
      }

      if (modelContextByFullNamespace.has(model.fullNamespace)) {
        throw new Error("Model is already mounted.");
      }

      if (payload) {
        const state =
          payload.state !== undefined
            ? payload.state
            : model.modelDefinition.state();
        runInAction(() => {
          setSubState(observableRootState, state, model.namespace, model.key);
        });
      }

      const modelContext: ModelContext = {
        model,

        flattenedComputeds: {},
        computedObserveDisposers: [],

        subscriptionDisposables: [],
      };
      modelContextByFullNamespace.set(model.fullNamespace, modelContext);
      mountModel(model);

      Object.values(modelDefinitionContext.flattenedSubscriptions).forEach(
        (subscription) => {
          const disposable = subscription.call(model);
          if (disposable) {
            modelContext.subscriptionDisposables.push(disposable);
          }
        }
      );
    }

    function handleUnmountModel(
      model: Model,
      payload: ModelUnmountActionPayload
    ) {
      payload;

      const modelContext = modelContextByFullNamespace.get(model.fullNamespace);
      if (modelContext) {
        modelContext.subscriptionDisposables.forEach((disposable) => {
          disposable();
        });
        modelContext.computedObserveDisposers.forEach((disposer) => {
          disposer();
        });

        unmountModel(model);
        modelContextByFullNamespace.delete(model.fullNamespace);

        do {
          if (model.key !== undefined) {
            const state = get(observableRootState, model.namespace);
            if (state) {
              const stateKeys = keys(state);
              if (stateKeys.length === 1 && stateKeys[0] === model.key) {
                runInAction(() => {
                  setSubState(
                    observableRootState,
                    NOTHING,
                    model.namespace,
                    undefined
                  );
                });
                break;
              }
            }
          }

          runInAction(() => {
            setSubState(
              observableRootState,
              NOTHING,
              model.namespace,
              model.key
            );
          });
          // eslint-disable-next-line no-constant-condition
        } while (false);
      }
    }

    function handleReload(payload: ReloadActionPayload) {
      Array.from(modelContextByFullNamespace.values()).forEach((context) => {
        handleUnmountModel(context.model, {});
      });

      if (payload.state !== undefined) {
        runInAction(() => {
          Object.assign(observableRootState, payload.state);
        });
        entries(observableRootState).forEach(([namespace, state]) => {
          const modelDefinitonContext = getModelDefinitionContext(namespace);
          if (modelDefinitonContext) {
            if (modelDefinitonContext.modelDefinition.isDynamic && state) {
              keys(state as any).forEach((key) => {
                handleMountModel(getModel(namespace, key as any), null);
              });
            } else {
              handleMountModel(getModel(namespace, undefined), null);
            }
          }
        });
      }
    }

    function dispatchModelAction(
      model: Model,
      action: Action,
      actionType: string
    ) {
      const { payload } = action;

      switch (actionType) {
        case ModelMountActionType: {
          handleMountModel(model, payload as ModelMountActionPayload);
          break;
        }
        case ModelUnmountActionType: {
          handleUnmountModel(model, payload as ModelUnmountActionPayload);
          break;
        }
        default: {
          break;
        }
      }

      const modelDefinitionContext = getModelDefinitionContext(model.namespace);
      if (!modelDefinitionContext) {
        throw new Error("Model definition is not registered.");
      }

      const isMounted = modelContextByFullNamespace.has(model.fullNamespace);
      if (
        !isMounted &&
        (modelDefinitionContext.flattenedReducers[actionType] ||
          modelDefinitionContext.flattenedEffects[actionType])
      ) {
        const mountAction: Action<ModelMountActionPayload> = {
          type: ModelMountActionType,
          payload: {},
        };
        dispatchModelAction(model, mountAction, ModelMountActionType);
      }

      switch (actionType) {
        case ModelSetActionType: {
          setSubState(observableRootState, payload, model.namespace, model.key);
          break;
        }
        case ModelPatchActionType: {
          // TODO
          break;
        }
        default: {
          modelDefinitionContext.flattenedReducers[actionType]?.call(
            model,
            payload
          );
          break;
        }
      }

      subscribers.forEach((fn) => fn());
      actionSubscribers.forEach((fn) => fn(action));

      if (isMounted) {
        return modelDefinitionContext.flattenedEffects[actionType]?.call(
          model,
          payload
        );
      }
    }

    function dispatchAction(action: Action) {
      if (action.type === ReloadActionType) {
        handleReload(action.payload as ReloadActionPayload);
        return;
      }

      const [fullNamespace, actionType] = splitLastString(
        action.type,
        options.namespaceSeparator
      );

      let model: Model | undefined;
      if (getModelDefinition(fullNamespace)) {
        model = getModel(fullNamespace, undefined);
      } else {
        const [namespace, key] = splitLastString(
          fullNamespace,
          options.namespaceSeparator
        );
        if (getModelDefinition(namespace)) {
          model = getModel(namespace, key);
        }
      }

      if (!model) {
        return;
      }

      return dispatchModelAction(model, action, actionType);
    }

    return {
      getState() {
        return observableRootState;
      },
      dispatch(action) {
        dispatchAction(action);
      },
      subscribe(fn) {
        subscribers = [...subscribers, fn];
        return () => {
          subscribers = subscribers.filter((subscriber) => subscriber !== fn);
        };
      },

      subscribeAction(fn) {
        actionSubscribers = [...actionSubscribers, fn];
        return () => {
          actionSubscribers = actionSubscribers.filter(
            (subscriber) => subscriber !== fn
          );
        };
      },

      getModelState(model) {
        const { namespace, key } = model;

        let state: any = observableRootState;
        state = get(state, namespace);
        if (key !== undefined) {
          state = state != null ? get(state, key) : undefined;
        }

        if (state !== undefined) {
          return state;
        } else {
          return model.modelDefinition.state();
        }
      },
      getModelGetter(model, getterPath) {
        const modelContext = modelContextByFullNamespace.get(
          model.fullNamespace
        );
        if (modelContext) {
          let computedValue = modelContext.flattenedComputeds[getterPath];
          if (!computedValue) {
            computedValue = computed(() =>
              getModelDefinitionContext(model.namespace)?.flattenedSelectors[
                getterPath
              ]?.call(model)
            );
            modelContext.flattenedComputeds[getterPath] = computedValue;

            modelContext.computedObserveDisposers.push(
              observe(computedValue, () => {
                return;
              })
            );
          }
          return computedValue.get();
        } else {
          return getModelDefinitionContext(model.namespace)?.flattenedSelectors[
            getterPath
          ]?.call(model);
        }
      },
      dispatchModelAction(model, actionType, payload) {
        const action: Action = {
          type: concatLastString(
            model.fullNamespace,
            actionType,
            options.namespaceSeparator
          ),
          payload,
        };
        return dispatchModelAction(model, action, actionType);
      },
    };
  };
}
