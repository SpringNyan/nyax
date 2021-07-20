import { ExtractContainerProperty } from "./container";
import { NyaxContext } from "./context";
import { NamespacedModelClass } from "./model";

export interface InitialState {
  [key: string]: unknown | InitialState;
}

export type ConvertState<TInitialState> = TInitialState extends any
  ? TInitialState
  : never;

export interface GetState {
  (): unknown | undefined;
  <TModelClass extends NamespacedModelClass>(
    modelClassOrNamespace: TModelClass | string
  ): TModelClass extends NamespacedModelClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? Record<string, ExtractContainerProperty<TModelClass, "state">> | undefined
    : TModelClass extends NamespacedModelClass<
        any,
        any,
        any,
        any,
        any,
        any,
        false
      >
    ? ExtractContainerProperty<TModelClass, "state"> | undefined
    :
        | Record<string, ExtractContainerProperty<TModelClass, "state">>
        | ExtractContainerProperty<TModelClass, "state">
        | undefined;
  <TModelClass extends NamespacedModelClass>(
    modelClassOrNamespace: TModelClass | string,
    key: string
  ): TModelClass extends NamespacedModelClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? ExtractContainerProperty<TModelClass, "state"> | undefined
    : TModelClass extends NamespacedModelClass<
        any,
        any,
        any,
        any,
        any,
        any,
        false
      >
    ? never
    : ExtractContainerProperty<TModelClass, "state"> | never | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return (
    modelClassOrNamespace?: NamespacedModelClass | string,
    key?: string
  ): unknown => {
    let state = nyaxContext.nyax.store.getState() as any;

    if (modelClassOrNamespace === undefined) {
      return state;
    }

    const modelClassContext = nyaxContext.getModelClassContext(
      modelClassOrNamespace
    );
    const modelClass = modelClassContext.modelClass;

    state = state?.[modelClass.namespace];
    if (modelClass.isDynamic) {
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
