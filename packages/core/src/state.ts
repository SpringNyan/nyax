import {
  ExtractModelState,
  ModelDefinitionConstructor,
  ModelInstanceImpl,
} from "./model";

export interface ModelInitialState {
  [key: string]: unknown | ModelInitialState;
}

export type ConvertState<TInitialState> = TInitialState extends any
  ? TInitialState
  : never;

export function createState<TModel extends ModelDefinitionConstructor>(
  modelInstance: ModelInstanceImpl<TModel>
): ExtractModelState<TModel> {
  const state = modelInstance.initialState;
  return state as ExtractModelState<TModel>;
}

// ok
