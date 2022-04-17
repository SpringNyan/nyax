import { createActionHelpers } from "./action";
import { NyaxContext } from "./context";
import {
  ConvertModelDefinitionActionHelpers,
  ConvertModelDefinitionGetters,
  ConvertModelDefinitionState,
  ModelDefinition,
  NamespacedModelDefinition,
} from "./modelDefinition";
import { createGetters } from "./selector";
import { Store } from "./store";

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

export function createModel<TModelDefinition extends ModelDefinition>(
  store: Store,
  modelDefinition: TModelDefinition,
  namespace: string,
  key: string | undefined
): Model<TModelDefinition> {
  let initialState: unknown;

  const model: Model = {
    get state() {
      let state = store.getModelState(this);
      if (state === undefined) {
        if (initialState === undefined) {
          initialState = modelDefinition.state();
        }
        state = initialState;
      }
      // TODO
      return state as {};
    },
    get getters() {
      delete (this as Partial<Model>).getters;
      return (this.getters = createGetters(store, this));
    },
    get actions() {
      delete (this as Partial<Model>).actions;
      return (this.actions = createActionHelpers(store, this));
    },

    modelDefinition,

    namespace,
    key,

    get isMounted() {
      return store.getModelState(this) !== undefined;
    },

    mount(state) {
      store.mountModel(this, state);
    },
    unmount() {
      store.unmountModel(this);
    },
  };

  return model as Model<TModelDefinition>;
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
        nyaxContext.store,
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
