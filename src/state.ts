import { NYAX_NOTHING } from "./common";
import { is, isObject } from "./util";

export interface InitialState {
  [key: string]: any;
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
