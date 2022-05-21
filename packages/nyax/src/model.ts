import {
  createActionHelpers,
  ModelMountActionPayload,
  ModelMountActionType,
  ModelPatchActionPayload,
  ModelPatchActionType,
  ModelSetActionPayload,
  ModelSetActionType,
  ModelUnmountActionPayload,
  ModelUnmountActionType,
} from "./action";
import { NyaxContext } from "./context";
import {
  ConvertModelDefinitionActionHelpers,
  ConvertModelDefinitionGetters,
  ConvertModelDefinitionState,
  CreateModelDefinitionContext,
  ModelDefinition,
} from "./modelDefinition";
import { createGetters, createSelector } from "./selector";
import { getModelState } from "./state";
import { concatLastString, Simplify } from "./util";

export interface ModelBase<
  TState extends Record<string, unknown> = {},
  TGetters extends Record<string, unknown> = {},
  TActionHelpers extends Record<string, unknown> = {}
> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;

  set(state: TState | ((state: TState) => TState)): void;
  patch(state: Partial<TState> | ((state: TState) => Partial<TState>)): void;

  getSubModel<
    TKey extends keyof TState & keyof TGetters & keyof TActionHelpers
  >(
    key: TKey
  ): ModelBase<
    Simplify<TState[TKey]>,
    Simplify<TGetters[TKey]>,
    Simplify<TActionHelpers[TKey]>
  >;
}

export interface Model<
  TModelDefinition extends ModelDefinition = ModelDefinition
> extends ModelBase<
    ConvertModelDefinitionState<TModelDefinition>,
    ConvertModelDefinitionGetters<TModelDefinition>,
    ConvertModelDefinitionActionHelpers<TModelDefinition>
  > {
  modelDefinition: TModelDefinition;

  namespace: string;
  key: string | undefined;
  fullNamespace: string;

  isMounted: boolean;

  mount(state?: this["state"]): void;
  unmount(): void;
}

export type ModelInternal = Model &
  CreateModelDefinitionContext & {
    _path: string[] | undefined;

    _initialState: unknown | undefined;
    _getters: unknown | undefined;
    _actions: unknown | undefined;

    _reset(): void;
  };

export interface GetModel {
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string
  ): TModelDefinition extends ModelDefinition<any, any, any, any, any, true>
    ? never
    : Model<TModelDefinition>;
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string,
    key: string
  ): TModelDefinition extends ModelDefinition<any, any, any, any, any, false>
    ? never
    : Model<TModelDefinition>;
}

const subModelsByModel = new WeakMap<
  ModelInternal,
  Record<string, ModelInternal>
>();
export function createModel(
  nyaxContext: NyaxContext,
  namespace: string,
  key: string | undefined
): ModelInternal {
  const model: ModelInternal = {
    _path: undefined,

    _initialState: undefined,
    _getters: undefined,
    _actions: undefined,

    _reset() {
      this._initialState = undefined;
      this._getters = undefined;
      this._actions = undefined;
    },

    get state() {
      const state = getModelState(
        nyaxContext.getRootState(),
        this.namespace,
        this.key
      );
      if (state !== undefined) {
        return state;
      }

      if (this._initialState === undefined) {
        this._initialState = this.modelDefinition.state.call(this);
      }
      return this._initialState;
    },
    get getters() {
      if (this._getters === undefined) {
        this._getters = createGetters(nyaxContext, this);
      }
      return this._getters as any;
    },
    get actions() {
      if (this._actions === undefined) {
        this._actions = createActionHelpers(nyaxContext, this);
      }
      return this._actions as any;
    },

    get modelDefinition() {
      return nyaxContext.requireNamespaceContext(namespace).modelDefinition;
    },

    namespace,
    key,
    fullNamespace: concatLastString(
      namespace,
      key,
      nyaxContext.options.namespaceSeparator
    ),

    get isMounted() {
      return (
        getModelState(nyaxContext.getRootState(), this.namespace, this.key) !==
        undefined
      );
    },

    set(state) {
      if (typeof state === "function") {
        state = state(this.state) as Record<string, unknown>;
      }
      const payload: ModelSetActionPayload = { state };
      if (this._path !== undefined) {
        payload.path = this._path;
      }

      nyaxContext.dispatchAction(
        { type: ModelSetActionType, payload },
        this,
        ModelSetActionType
      );
    },
    patch(state) {
      if (typeof state === "function") {
        state = state(this.state) as Partial<Record<string, unknown>>;
      }
      const payload: ModelPatchActionPayload = { state };
      if (this._path !== undefined) {
        payload.path = this._path;
      }

      nyaxContext.dispatchAction(
        { type: ModelPatchActionType, payload },
        this,
        ModelPatchActionType
      );
    },

    getSubModel(key) {
      let subModels = subModelsByModel.get(this);
      if (!subModels) {
        subModels = {};
        subModelsByModel.set(this, subModels);
      }

      let subModel = subModels[key];
      if (!subModel) {
        subModel = Object.create(this, {
          _path: {
            value: this._path !== undefined ? [...this._path, key] : [key],
            enumerable: true,
            configurable: true,
          },

          state: {
            get: () => {
              return this.state?.[key];
            },
            enumerable: false,
            configurable: true,
          },
          getters: {
            get: () => {
              return this.getters?.[key];
            },
            enumerable: false,
            configurable: true,
          },
          actions: {
            get: () => {
              return this.actions?.[key];
            },
            enumerable: false,
            configurable: true,
          },
        }) as ModelInternal;
        subModels[key] = subModel;
      }
      return subModel as any;
    },

    mount(state) {
      const payload: ModelMountActionPayload =
        state !== undefined ? { state } : {};
      nyaxContext.dispatchAction(
        { type: ModelMountActionType, payload },
        this,
        ModelMountActionType
      );
    },
    unmount() {
      const payload: ModelUnmountActionPayload = {};
      nyaxContext.dispatchAction(
        { type: ModelUnmountActionType, payload },
        this,
        ModelUnmountActionType
      );
    },

    getModel: nyaxContext.nyax.getModel,
    createSelector,
    nyax: nyaxContext.nyax,
  };

  return model;
}

export function createGetModel(nyaxContext: NyaxContext): GetModel {
  return function (
    modelDefinitionOrNamespace: ModelDefinition | string,
    key?: string
  ): Model {
    const namespaceContext = nyaxContext.requireNamespaceContext(
      modelDefinitionOrNamespace
    );
    const modelDefinition = namespaceContext.modelDefinition;

    if (key === undefined && modelDefinition.isDynamic) {
      throw new Error(
        `Dynamic model should have a key: ${namespaceContext.namespace}`
      );
    }

    if (key !== undefined && !modelDefinition.isDynamic) {
      throw new Error(
        `Static model should not have a key: ${namespaceContext.namespace}`
      );
    }

    let model =
      key === undefined
        ? namespaceContext.model
        : namespaceContext.modelByKey.get(key);
    if (!model) {
      model = createModel(nyaxContext, namespaceContext.namespace, key);
      if (key === undefined) {
        namespaceContext.model = model;
      } else {
        namespaceContext.modelByKey.set(key, model);
      }
    }
    return model;
  };
}
