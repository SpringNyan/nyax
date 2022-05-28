import { Action as ReduxAction } from "redux";
import {
  Action,
  ConvertTestActionConditions,
  createTestAction,
  createTestActionConditions,
  ReloadActionPayload,
  ReloadActionType,
} from "./action";
import { Effect } from "./effect";
import { createMiddleware } from "./middleware";
import { createGetModel, Model, ModelInternal } from "./model";
import { ModelDefinition } from "./modelDefinition";
import { createReducer, Reducer } from "./reducer";
import { createGetState, getModelState } from "./state";
import { Nyax, NyaxOptions } from "./store";
import { Subscription } from "./subscription";
import { flattenObject, splitLastString } from "./util";

export interface NyaxContext {
  nyax: Nyax;
  options: Required<NyaxOptions>;

  cachedRootState: Record<string, unknown> | undefined;
  getRootState(): Record<string, unknown>;

  dispatchingAction: Action | undefined;
  dispatchingModel: Model | undefined;
  dispatchingActionType: string | undefined;
  dispatchingResult: unknown | undefined;
  dispatchAction(action: Action, model: Model, actionType: string): unknown;

  namespaceContextByNamespace: Map<string, NamespaceContext>;
  requireNamespaceContext(
    modelDefinitionOrNamespace: ModelDefinition | string
  ): NamespaceContext;
  tryGetModel(fullNamespace: string): Model | undefined;

  actionSubscribers: ((action: ReduxAction) => void)[];
}

export interface NamespaceContext {
  namespace: string;
  modelDefinition: ModelDefinition;

  flattenedReducers: Record<string, Reducer>;
  flattenedEffects: Record<string, Effect>;
  flattenedSubscriptions: Record<string, Subscription>;

  model: ModelInternal | undefined;
  modelByKey: Map<string, ModelInternal>;

  subscriptionDisposablesByKey: Map<string | undefined, (() => void)[]>;

  testActionConditions: ConvertTestActionConditions<ModelDefinition>;
}

export function createNyaxContext(options: Required<NyaxOptions>): NyaxContext {
  const nyaxContext: NyaxContext = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    nyax: undefined!,
    options,

    cachedRootState: undefined,
    getRootState() {
      return this.cachedRootState !== undefined
        ? this.cachedRootState
        : this.nyax.store.getState();
    },

    dispatchingAction: undefined,
    dispatchingModel: undefined,
    dispatchingActionType: undefined,
    dispatchingResult: undefined,
    dispatchAction(action, model, actionType) {
      this.dispatchingAction = action;
      this.dispatchingModel = model;
      this.dispatchingActionType = actionType;

      try {
        this.nyax.store.dispatch(action);
        if (this.dispatchingAction !== action) {
          throw new Error(
            `Action dispatch should be synchronous: ${action.type}`
          );
        }
        return this.dispatchingResult;
      } finally {
        this.dispatchingAction = undefined;
        this.dispatchingActionType = undefined;
        this.dispatchingModel = undefined;
        this.dispatchingResult = undefined;
      }
    },

    namespaceContextByNamespace: new Map(),
    requireNamespaceContext(modelDefinitionOrNamespace) {
      const namespace =
        typeof modelDefinitionOrNamespace === "string"
          ? modelDefinitionOrNamespace
          : modelDefinitionOrNamespace.namespace;

      let namespaceContext = this.namespaceContextByNamespace.get(namespace);
      if (!namespaceContext) {
        if (typeof modelDefinitionOrNamespace === "string") {
          throw new Error(`Model definition is not registered: ${namespace}`);
        }
        namespaceContext = {
          namespace,
          modelDefinition: modelDefinitionOrNamespace,

          flattenedReducers: flattenObject(
            modelDefinitionOrNamespace.reducers,
            options.pathSeparator
          ) as Record<string, Reducer>,
          flattenedEffects: flattenObject(
            modelDefinitionOrNamespace.effects,
            options.pathSeparator
          ) as Record<string, Effect>,
          flattenedSubscriptions: flattenObject(
            modelDefinitionOrNamespace.subscriptions,
            options.pathSeparator
          ) as Record<string, Subscription>,

          model: undefined,
          modelByKey: new Map(),

          subscriptionDisposablesByKey: new Map(),

          get testActionConditions() {
            delete (this as Partial<NamespaceContext>).testActionConditions;
            return (this.testActionConditions = createTestActionConditions(
              nyaxContext,
              this.modelDefinition
            ));
          },
        };
        this.namespaceContextByNamespace.set(namespace, namespaceContext);

        if (
          getModelState(this.getRootState(), namespace, undefined) !== undefined
        ) {
          this.nyax.reload(namespace);
        }
      }

      if (
        typeof modelDefinitionOrNamespace !== "string" &&
        namespaceContext.modelDefinition !== modelDefinitionOrNamespace
      ) {
        throw new Error(
          `Model definition should be same as the registered one: ${namespace}`
        );
      }

      return namespaceContext;
    },
    tryGetModel(fullNamespace) {
      try {
        let namespace: string;
        let key: string | undefined;
        if (fullNamespace.includes(nyaxContext.options.namespaceSeparator)) {
          [namespace, key] = splitLastString(
            fullNamespace,
            nyaxContext.options.namespaceSeparator
          );
        } else {
          namespace = fullNamespace;
        }

        if (!nyaxContext.namespaceContextByNamespace.has(namespace)) {
          return undefined;
        }

        return nyaxContext.nyax.getModel(namespace, key as any);
      } catch (error) {
        return undefined;
      }
    },

    actionSubscribers: [],
  };
  nyaxContext.nyax = {
    store: options.createStore(
      createReducer(nyaxContext),
      createMiddleware(nyaxContext)
    ),
    getModel: createGetModel(nyaxContext),
    getState: createGetState(nyaxContext),
    testAction: createTestAction(nyaxContext),
    subscribeAction(fn) {
      nyaxContext.actionSubscribers = [...nyaxContext.actionSubscribers, fn];
      return function () {
        nyaxContext.actionSubscribers = nyaxContext.actionSubscribers.filter(
          (subscriber) => subscriber !== fn
        );
      };
    },
    registerModelDefinitions(modelDefinitions) {
      modelDefinitions.forEach((modelDefinition) => {
        const namespace = modelDefinition.namespace;

        const namespaceContext =
          nyaxContext.namespaceContextByNamespace.get(namespace);
        if (namespaceContext) {
          if (namespaceContext.modelDefinition !== modelDefinition) {
            nyaxContext.namespaceContextByNamespace.delete(namespace);
          } else {
            return;
          }
        }

        nyaxContext.requireNamespaceContext(modelDefinition);
      });
    },
    reload(stateOrNamespace) {
      const payload: ReloadActionPayload =
        stateOrNamespace !== undefined
          ? typeof stateOrNamespace === "string"
            ? { namespace: stateOrNamespace }
            : { state: stateOrNamespace }
          : {};
      nyaxContext.nyax.store.dispatch({ type: ReloadActionType, payload });
    },
  };

  return nyaxContext;
}
