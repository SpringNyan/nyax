import { NyaxContext } from "./context";
import {
  ConvertModelDefinitionState,
  ModelDefinition,
} from "./modelDefinition";

export interface GetState {
  (): Record<string, unknown>;
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string
  ): TModelDefinition extends ModelDefinition<any, any, any, any, any, true>
    ? Record<string, ConvertModelDefinitionState<TModelDefinition>> | undefined
    : TModelDefinition extends ModelDefinition<any, any, any, any, any, false>
    ? ConvertModelDefinitionState<TModelDefinition> | undefined
    :
        | Record<string, ConvertModelDefinitionState<TModelDefinition>>
        | ConvertModelDefinitionState<TModelDefinition>
        | undefined;
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string,
    key: string
  ): TModelDefinition extends ModelDefinition<any, any, any, any, any, true>
    ? ConvertModelDefinitionState<TModelDefinition> | undefined
    : TModelDefinition extends ModelDefinition<any, any, any, any, any, false>
    ? never
    : ConvertModelDefinitionState<TModelDefinition> | never | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return function (
    modelDefinitionOrNamespace?: ModelDefinition | string,
    key?: string
  ) {
    const rootState = nyaxContext.store.getState();
    if (modelDefinitionOrNamespace === undefined) {
      return rootState;
    }

    const namespaceContext = nyaxContext.getNamespaceContext(
      modelDefinitionOrNamespace
    );
    const state = rootState[namespaceContext.namespace];
    if (key === undefined) {
      return state;
    }

    if (!namespaceContext.modelDefinition.isDynamic) {
      throw new Error("Key is not available for static model.");
    }
    return (state as Record<string, unknown>)?.[key];
  } as any;
}
