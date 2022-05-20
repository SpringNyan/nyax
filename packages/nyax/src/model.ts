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
import { concatLastString } from "./util";

export interface ModelBase<
  TState extends Record<string, unknown> = {},
  TGetters extends Record<string, unknown> = {},
  TActionHelpers extends Record<string, unknown> = {}
> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;
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

  set(state: this["state"] | ((state: this["state"]) => this["state"])): void;
  patch(
    state:
      | Partial<this["state"]>
      | ((state: this["state"]) => Partial<this["state"]>)
  ): void;

  mount(state?: this["state"]): void;
  unmount(): void;
}

export interface ModelInternal<
  TModelDefinition extends ModelDefinition = ModelDefinition
> extends Model<TModelDefinition> {
  _initialState: unknown | undefined;
  _getters: unknown | undefined;
  _actions: unknown | undefined;

  _reset(): void;
}

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

export function createModel(
  nyaxContext: NyaxContext,
  namespace: string,
  key: string | undefined
): ModelInternal {
  const model: ModelInternal & CreateModelDefinitionContext = {
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
        state = state(this.state);
      }
      const payload: ModelSetActionPayload = state;
      nyaxContext.dispatchAction(
        { type: ModelSetActionType, payload },
        this,
        ModelSetActionType
      );
    },
    patch(state) {
      if (typeof state === "function") {
        state = state(this.state);
      }
      const payload: ModelPatchActionPayload = state;
      nyaxContext.dispatchAction(
        { type: ModelPatchActionType, payload },
        this,
        ModelPatchActionType
      );
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

export function createSubModel<
  TModel extends ModelBase<any, any, any>,
  TPath extends string
>(
  model: TModel,
  path: TPath
): ModelBase<
  TModel["state"][TPath],
  TModel["getters"][TPath],
  TModel["actions"][TPath]
> {
  return {
    get state(): TModel["state"][TPath] {
      return model.state?.[path];
    },
    get getters(): TModel["getters"][TPath] {
      return model.getters?.[path];
    },
    get actions(): TModel["actions"][TPath] {
      return model.actions?.[path];
    },
  };
}
