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
    : Record<string, unknown> | undefined;
  <TModelDefinition extends ModelDefinition>(
    modelDefinitionOrNamespace: TModelDefinition | string,
    key: string
  ): TModelDefinition extends ModelDefinition<any, any, any, any, any, true>
    ? ConvertModelDefinitionState<TModelDefinition> | undefined
    : TModelDefinition extends ModelDefinition<any, any, any, any, any, false>
    ? never
    : Record<string, unknown> | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return function (
    modelDefinitionOrNamespace?: ModelDefinition | string,
    key?: string
  ) {
    const rootState = nyaxContext.getRootState() as any;
    if (modelDefinitionOrNamespace === undefined) {
      return rootState;
    }

    const namespaceContext = nyaxContext.requireNamespaceContext(
      modelDefinitionOrNamespace
    );
    const state = rootState?.[namespaceContext.namespace];
    if (key === undefined) {
      return state;
    }

    if (!namespaceContext.modelDefinition.isDynamic) {
      throw new Error(
        `Static model should not have a key: ${namespaceContext.namespace}`
      );
    }
    return state?.[key];
  };
}

export function getModelState(
  rootState: any,
  namespace: string,
  key: string | undefined
): any {
  let state = rootState?.[namespace];
  if (key !== undefined) {
    state = state?.[key];
  }
  return state;
}

export function setModelState(
  rootState: any,
  namespace: string,
  key: string | undefined,
  value: any
): any {
  if (rootState === undefined) {
    rootState = {};
  }
  if (key === undefined) {
    if (value === undefined) {
      if (namespace in rootState) {
        rootState = { ...rootState };
        delete rootState[namespace];
      }
    } else {
      if (rootState[namespace] !== value) {
        rootState = { ...rootState, [namespace]: value };
      }
    }
  } else {
    if (value === undefined) {
      if (namespace in rootState) {
        let state = rootState[namespace];
        if (key in state) {
          const keys = Object.keys(state);
          if (keys.length === 1) {
            state = undefined;
          } else {
            state = { ...state };
            delete state[key];
          }

          if (state === undefined) {
            rootState = { ...rootState };
            delete rootState[namespace];
          } else {
            rootState = { ...rootState, [namespace]: state };
          }
        }
      }
    } else {
      let state = namespace in rootState ? rootState[namespace] : {};
      if (state[key] !== value) {
        state = { ...state, [key]: value };
      }
      if (rootState[namespace] !== state) {
        rootState = { ...rootState, [namespace]: state };
      }
    }
  }

  return rootState;
}
