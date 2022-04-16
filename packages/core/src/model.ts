import { createActionHelpers } from "./action";
import {
  ConvertModelDefinitionActionHelpers,
  ConvertModelDefinitionGetters,
  ConvertModelDefinitionState,
  ModelDefinition,
} from "./modelDefinition";
import { createGetters } from "./selector";
import { Nyax } from "./store";

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

export function createModel<TModelDefinition extends ModelDefinition>(
  nyax: Nyax,
  modelDefinition: TModelDefinition,
  namespace: string,
  key: string | undefined
): Model<TModelDefinition> {
  let initialState: unknown;

  const model: Model<TModelDefinition> = {
    get state() {
      const state = nyax.store.getModelState(namespace, key);
      if (state === undefined) {
        if (initialState === undefined) {
          initialState = modelDefinition.state();
        }
        return initialState as ConvertModelDefinitionState<TModelDefinition>;
      }
      return state as ConvertModelDefinitionState<TModelDefinition>;
    },
    get getters() {
      delete (this as Partial<Model<TModelDefinition>>).getters;
      return (this.getters = createGetters(
        nyax,
        modelDefinition,
        namespace,
        key
      ));
    },
    get actions() {
      delete (this as Partial<Model<TModelDefinition>>).getters;
      return (this.actions = createActionHelpers(
        nyax,
        modelDefinition,
        namespace,
        key
      ));
    },

    modelDefinition,

    namespace,
    key,

    get isMounted() {
      return nyax.store.getModelState(namespace, key) !== undefined;
    },

    mount(state) {
      // TODO
    },
    unmount() {
      // TODO
    },
  };

  return model;
}
