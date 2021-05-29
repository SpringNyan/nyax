import { NyaxContext } from "./context";
import { ExtractModelProperty, ModelDefinitionClass } from "./model";

export interface InitialState {
  [key: string]: unknown | InitialState;
}

export type ConvertState<TInitialState> = TInitialState extends any
  ? TInitialState
  : never;

export interface GetState {
  (): unknown | undefined;
  <TModelDefinitionClass extends ModelDefinitionClass>(
    modelDefinitionClassOrNamespace: TModelDefinitionClass | string
  ): TModelDefinitionClass extends ModelDefinitionClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ?
        | Record<string, ExtractModelProperty<TModelDefinitionClass, "state">>
        | undefined
    : TModelDefinitionClass extends ModelDefinitionClass<
        any,
        any,
        any,
        any,
        any,
        any,
        false
      >
    ? ExtractModelProperty<TModelDefinitionClass, "state"> | undefined
    :
        | Record<string, ExtractModelProperty<TModelDefinitionClass, "state">>
        | ExtractModelProperty<TModelDefinitionClass, "state">
        | undefined;
  <TModelDefinitionClass extends ModelDefinitionClass>(
    modelDefinitionClassOrNamespace: TModelDefinitionClass | string,
    key: string
  ): TModelDefinitionClass extends ModelDefinitionClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? ExtractModelProperty<TModelDefinitionClass, "state"> | undefined
    : TModelDefinitionClass extends ModelDefinitionClass<
        any,
        any,
        any,
        any,
        any,
        any,
        false
      >
    ? never
    : ExtractModelProperty<TModelDefinitionClass, "state"> | never | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return (
    modelDefinitionClassOrNamespace?: ModelDefinitionClass | string,
    key?: string
  ): unknown => {
    let state = nyaxContext.nyax.store.getState() as any;

    if (modelDefinitionClassOrNamespace === undefined) {
      return state;
    }

    const modelContext = nyaxContext.getModelContext(
      modelDefinitionClassOrNamespace
    );
    const modelDefinitionClass = modelContext.modelDefinitionClass;

    state = state?.[modelDefinitionClass.namespace];
    if (modelDefinitionClass.isDynamic) {
      if (key !== undefined) {
        state = state?.[key];
      }
    } else {
      if (key !== undefined) {
        throw new Error("Key is not available for static model.");
      }
    }

    return state;
  };
}
