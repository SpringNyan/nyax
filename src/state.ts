import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import {
  ExtractModelArgs,
  ExtractModelState,
  LazyModel,
  Model,
  ModelInstanceConstructor,
  resolveModel,
} from "./model";
import { isObject } from "./util";

export interface ModelInitialState {
  [key: string]: unknown | ModelInitialState;
}

export type ConvertState<
  TInitialState
> = TInitialState extends infer TInitialState ? TInitialState : never;

export function getSubState(
  state: unknown,
  modelPath: string,
  containerKey: string | undefined
): unknown {
  if (!isObject(state)) {
    throw new Error("state is not an object");
  }

  if (containerKey === undefined) {
    return state[modelPath];
  } else {
    return getSubState(state[modelPath], containerKey, undefined);
  }
}

export function updateSubState(
  state: Record<string, unknown>,
  value: unknown,
  modelPath: string,
  containerKey: string | undefined
): void {
  if (containerKey === undefined) {
    if (value === NYAX_NOTHING) {
      delete state[modelPath];
    } else {
      state[modelPath] = value;
    }
  } else {
    if (state[modelPath] === undefined) {
      state[modelPath] = {};
    }
    updateSubState(
      state[modelPath] as Record<string, unknown>,
      value,
      containerKey,
      undefined
    );
  }
}

export function createState<TModel extends Model>(
  container: ContainerImpl<TModel>,
  args: ExtractModelArgs<TModel>
): ExtractModelState<TModel> {
  container.args = args;
  const state = container.modelInstance.initialState();
  container.args = NYAX_NOTHING;

  return state as ExtractModelState<TModel>;
}

export interface GetState {
  (): unknown | undefined;
  <TModel extends Model>(
    modelOrModelNamespace: TModel | LazyModel<TModel> | string
  ): TModel extends ModelInstanceConstructor & { isDynamic: true }
    ? Partial<Record<string, ExtractModelState<TModel>>> | undefined
    : TModel extends ModelInstanceConstructor & { isDynamic?: false }
    ? ExtractModelState<TModel> | undefined
    :
        | Partial<Record<string, ExtractModelState<TModel>>>
        | ExtractModelState<TModel>
        | undefined;
  <TModel extends Model>(
    modelOrModelNamespace: TModel | LazyModel<TModel> | string,
    containerKey: string
  ): TModel extends ModelInstanceConstructor & { isDynamic: true }
    ? ExtractModelState<TModel> | undefined
    : TModel extends ModelInstanceConstructor & { isDynamic?: false }
    ? never
    : ExtractModelState<TModel> | never | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return <TModel extends Model>(
    modelOrModelNamespace?: TModel | LazyModel<TModel> | string,
    containerKey?: string
  ):
    | unknown
    | ExtractModelState<TModel>
    | Partial<Record<string, ExtractModelState<TModel>>>
    | never
    | undefined => {
    const rootState = nyaxContext.getRootState();

    if (modelOrModelNamespace === undefined) {
      return rootState;
    }

    const modelContext =
      typeof modelOrModelNamespace === "string"
        ? nyaxContext.modelContextByModelNamespace.get(modelOrModelNamespace)
        : nyaxContext.modelContextByModel.get(
            resolveModel(modelOrModelNamespace)
          );
    if (!modelContext) {
      throw new Error("Model is not registered");
    }
    const model = modelContext.model;

    const state = (rootState as Record<string, unknown> | undefined)?.[
      modelContext.modelPath
    ];

    if (model.isDynamic) {
      if (containerKey !== undefined) {
        return (state as Record<string, unknown> | undefined)?.[containerKey];
      } else {
        return state;
      }
    } else {
      if (containerKey !== undefined) {
        throw new Error("Container key is not available for static model");
      } else {
        return state;
      }
    }
  };
}
