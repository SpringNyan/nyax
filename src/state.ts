import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import {
  ExtractArgsFromModelConstructor,
  ExtractStateFromModelConstructor,
  ModelConstructor,
} from "./model";
import { is, isObject } from "./util";

export interface ModelInitialState {
  [key: string]: any | ModelInitialState;
}

export type ConvertState<
  TInitialState
> = TInitialState extends infer TInitialState ? TInitialState : never;

export function getSubState(
  state: any,
  modelPath: string,
  containerKey: string | undefined
): any {
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
  state: any,
  value: any,
  modelPath: string,
  containerKey: string | undefined
): any {
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

    state = { ...state };
    if (value === NYAX_NOTHING) {
      delete state[modelPath];
    } else {
      state[modelPath] = value;
    }

    return state;
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

export function createState<TModelConstructor extends ModelConstructor>(
  container: ContainerImpl<TModelConstructor>,
  args: ExtractArgsFromModelConstructor<TModelConstructor>
): ExtractStateFromModelConstructor<TModelConstructor> {
  container.modelArgs = args;
  const state = container.model.initialState();
  container.modelArgs = NYAX_NOTHING;

  return state;
}

export interface GetState {
  <TModelConstructor extends ModelConstructor>(
    modelConstructorOrModelNamespace: TModelConstructor | string
  ): TModelConstructor["isDynamic"] extends true
    ? Partial<
        Record<string, ExtractStateFromModelConstructor<TModelConstructor>>
      >
    : ExtractStateFromModelConstructor<TModelConstructor>;
}

export function createGetState(nyaxContext: NyaxContext): GetState {
  // TODO: check model registered

  return <TModelConstructor extends ModelConstructor>(
    modelConstructorOrModelNamespace: TModelConstructor | string
  ): TModelConstructor["isDynamic"] extends true
    ? Partial<
        Record<string, ExtractStateFromModelConstructor<TModelConstructor>>
      >
    : ExtractStateFromModelConstructor<TModelConstructor> => {
    let modelNamespace: string;
    if (typeof modelConstructorOrModelNamespace === "string") {
      modelNamespace = modelConstructorOrModelNamespace;
    } else {
      const modelContext = nyaxContext.modelContextByModelConstructor.get(
        modelConstructorOrModelNamespace
      );
      if (!modelContext) {
        throw new Error("Model is not registered");
      }
      modelNamespace = modelContext.modelNamespace;
    }

    return nyaxContext.getRootState()[modelNamespace] ?? {};
  };
}
