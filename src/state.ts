import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import {
  ExtractModelArgs,
  ExtractModelState,
  Model,
  ModelInstanceConstructor,
} from "./model";
import { is, isObject } from "./util";

export interface ModelInitialState {
  [key: string]: unknown | ModelInitialState;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ConvertState<TInitialState> =
  TInitialState extends infer TInitialState ? TInitialState : never;

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

export function setSubState(
  state: unknown,
  value: unknown,
  modelPath: string,
  containerKey: string | undefined
): unknown {
  if (state === undefined) {
    state = {};
  }
  if (!isObject(state)) {
    throw new Error("state is not an object");
  }

  if (containerKey === undefined) {
    if (is(state[modelPath], value)) {
      return state;
    }

    const nextState = { ...state };
    if (value === NYAX_NOTHING) {
      delete nextState[modelPath];
    } else {
      nextState[modelPath] = value;
    }

    return nextState;
  } else {
    const subState = setSubState(
      state[modelPath],
      value,
      containerKey,
      undefined
    );
    if (is(state[modelPath], subState)) {
      return state;
    }

    return {
      ...state,
      [modelPath]: subState,
    };
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
    modelOrModelNamespace: TModel | string
  ): TModel["isDynamic"] extends true
    ? Partial<Record<string, ExtractModelState<TModel>>> | undefined
    : ExtractModelState<TModel> | undefined;
  <TModel extends ModelInstanceConstructor & { isDynamic: true }>(
    modelOrModelNamespace: TModel | string,
    containerKey: string
  ): ExtractModelState<TModel> | undefined;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  return <TModel extends Model>(
    modelOrModelNamespace?: TModel | string,
    containerKey?: string
  ):
    | unknown
    | ExtractModelState<TModel>
    | Partial<Record<string, ExtractModelState<TModel>>>
    | undefined => {
    const rootState = nyaxContext.getRootState();

    if (modelOrModelNamespace === undefined) {
      return rootState;
    }

    let model: TModel;
    if (typeof modelOrModelNamespace === "string") {
      model = nyaxContext.modelByModelNamespace.get(
        modelOrModelNamespace
      ) as TModel;
      if (!model) {
        throw new Error("Model namespace is not bound");
      }
    } else {
      model = modelOrModelNamespace;
    }

    const modelContext = nyaxContext.modelContextByModel.get(model);
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

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
