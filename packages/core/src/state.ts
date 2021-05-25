import { NyaxContext } from "./context";
import { ExtractModelDefinitionProperty, ModelDefinitionClass } from "./model";

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
        | Record<
            string,
            ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
          >
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
    ? ExtractModelDefinitionProperty<TModelDefinitionClass, "state"> | undefined
    :
        | Record<
            string,
            ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
          >
        | ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
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
    ? ExtractModelDefinitionProperty<TModelDefinitionClass, "state"> | undefined
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
    :
        | ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
        | never
        | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return (
    modelDefinitionClassOrNamespace?: ModelDefinitionClass | string,
    key?: string
  ): unknown => {
    let state = nyaxContext.nyax.store.getState();

    if (modelDefinitionClassOrNamespace === undefined) {
      return state;
    }

    const modelContext = nyaxContext.getModelContext(
      modelDefinitionClassOrNamespace
    );
    const modelDefinitionClass = modelContext.modelDefinitionClass;

    state = (state as Record<string, unknown> | undefined)?.[
      modelDefinitionClass.namespace
    ];
    if (modelDefinitionClass.isDynamic) {
      if (key !== undefined) {
        state = (state as Record<string, unknown> | undefined)?.[key];
      }
    } else {
      if (key !== undefined) {
        throw new Error("Key is not available for static model.");
      }
    }

    return state;
  };
}
