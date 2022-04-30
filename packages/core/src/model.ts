import {
  createActionHelpers,
  MountActionPayload,
  MountActionType,
  UnmountActionPayload,
  UnmountActionType,
} from "./action";
import { NyaxContext } from "./context";
import {
  ConvertModelDefinitionActionHelpers,
  ConvertModelDefinitionGetters,
  ConvertModelDefinitionState,
  ModelDefinition,
  NamespacedModelDefinition,
} from "./modelDefinition";
import { createGetters } from "./selector";
import { concatLastString } from "./util";

export interface ModelBase<TState = {}, TGetters = {}, TActionHelpers = {}> {
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

  mount(state?: ConvertModelDefinitionState<TModelDefinition>): void;
  unmount(): void;
}

export interface GetModel {
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string
  ): TModelDefinition extends NamespacedModelDefinition<
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? never
    : Model<TModelDefinition>;
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string,
    key: string
  ): TModelDefinition extends NamespacedModelDefinition<
    any,
    any,
    any,
    any,
    any,
    false
  >
    ? never
    : Model<TModelDefinition>;
}

export function createModel(
  nyaxContext: NyaxContext,
  modelDefinition: NamespacedModelDefinition,
  namespace: string,
  key: string | undefined
): Model {
  const model: Model = {
    get state() {
      return nyaxContext.store.getModelState(this.namespace, this.key) as {};
    },
    get getters() {
      delete (this as Partial<Model>).getters;
      return (this.getters = createGetters(nyaxContext, this));
    },
    get actions() {
      delete (this as Partial<Model>).actions;
      return (this.actions = createActionHelpers(nyaxContext, this));
    },

    modelDefinition,

    namespace,
    key,
    fullNamespace: concatLastString(
      namespace,
      key,
      nyaxContext.options.namespaceSeparator
    ),

    get isMounted() {
      return nyaxContext
        .getNamespaceContext(modelDefinition)
        .modelByKey.has(key);
    },

    mount(state) {
      const payload: MountActionPayload = state !== undefined ? { state } : {};
      nyaxContext.store.dispatchModelAction(
        this.namespace,
        this.key,
        MountActionType,
        payload
      );
    },
    unmount() {
      const payload: UnmountActionPayload = {};
      nyaxContext.store.dispatchModelAction(
        this.namespace,
        this.key,
        UnmountActionType,
        payload
      );
    },
  };

  return model;
}

export function createGetModel(nyaxContext: NyaxContext): GetModel {
  return function (
    modelDefinitionOrNamespace: NamespacedModelDefinition | string,
    key?: string
  ): Model {
    const namespaceContext = nyaxContext.getNamespaceContext(
      modelDefinitionOrNamespace
    );
    const modelDefinition = namespaceContext.modelDefinition;

    if (key === undefined && modelDefinition.isDynamic) {
      throw new Error("Key is required for dynamic model.");
    }

    if (key !== undefined && !modelDefinition.isDynamic) {
      throw new Error("Key is not available for static model.");
    }

    let model = namespaceContext.modelByKey.get(key);
    if (!model) {
      model = createModel(
        nyaxContext,
        modelDefinition,
        namespaceContext.namespace,
        key
      );
    }

    return model;
  };
}

export function createSubModel<
  TModel extends ModelBase<any, any, any>,
  TSubKey extends string
>(
  model: TModel,
  subKey: TSubKey
): ModelBase<
  TModel["state"][TSubKey],
  TModel["getters"][TSubKey],
  TModel["actions"][TSubKey]
> {
  return {
    get state(): TModel["state"][TSubKey] {
      return model.state?.[subKey];
    },
    get getters(): TModel["getters"][TSubKey] {
      return model.getters?.[subKey];
    },
    get actions(): TModel["actions"][TSubKey] {
      return model.actions?.[subKey];
    },
  };
}
