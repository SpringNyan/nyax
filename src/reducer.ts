import produce from "immer";
import { Reducer } from "redux";
import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  RegisterActionPayload,
  reloadActionHelper,
  ReloadActionPayload,
  UnregisterActionPayload,
} from "./action";
import { createArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { NyaxContext } from "./context";
import { createState, getSubState, setSubState } from "./state";
import { splitLastString } from "./util";

export interface Reducers {
  [key: string]: ((payload: any) => void) | Reducers;
}

export type ConvertPayloadResultPairsFromReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends (payload: infer TPayload) => void
    ? [TPayload, unknown]
    : ConvertPayloadResultPairsFromReducers<TReducers[K]>;
};

export function createRootReducer(nyaxContext: NyaxContext): Reducer {
  function batchRegister(
    rootState: any,
    payloads: RegisterActionPayload[]
  ): any {
    payloads.forEach((payload) => {
      const container = nyaxContext.getContainer(
        payload.modelNamespace,
        payload.containerKey
      );

      let state: any;
      if (payload.state !== undefined) {
        state = payload.state;
      } else {
        state = createState(
          container,
          createArgs(container, payload.args, false)
        );
      }

      rootState = setSubState(
        rootState,
        state,
        container.modelContext.modelPath,
        payload.containerKey
      );
    });

    return rootState;
  }

  function batchUnregister(
    rootState: any,
    payloads: UnregisterActionPayload[]
  ): any {
    payloads.forEach((payload) => {
      const container = nyaxContext.getContainer(
        payload.modelNamespace,
        payload.containerKey
      );

      rootState = setSubState(
        rootState,
        NYAX_NOTHING,
        container.modelContext.modelPath,
        payload.containerKey
      );
    });

    return rootState;
  }

  function reload(rootState: any, payload: ReloadActionPayload): any {
    if (payload.state !== undefined) {
      return payload.state;
    } else {
      return rootState;
    }
  }

  const rootReducer: Reducer = (rootState, action) => {
    if (rootState === undefined) {
      rootState = {};
    }

    if (reloadActionHelper.is(action)) {
      return reload(rootState, action.payload);
    }

    if (batchRegisterActionHelper.is(action)) {
      rootState = batchRegister(rootState, action.payload);
    } else if (batchUnregisterActionHelper.is(action)) {
      rootState = batchUnregister(rootState, action.payload);
    }

    const [namespace, actionName] = splitLastString(action.type);

    const container = nyaxContext.containerByNamespace.get(namespace);
    if (!container?.isRegistered) {
      return rootState;
    }

    const reducer = container.reducerByPath[actionName];
    if (!reducer) {
      return rootState;
    }

    const state = getSubState(
      rootState,
      container.modelContext.modelPath,
      container.containerKey
    );
    const newState = produce(state, (draft: any) => {
      // TODO
      reducer(action.payload);
    });

    return setSubState(
      rootState,
      newState,
      container.modelContext.modelPath,
      container.containerKey
    );
  };

  return (rootState, action): any => {
    nyaxContext.cachedRootState = rootState;
    rootState = rootReducer(rootState, action);
    nyaxContext.cachedRootState = NYAX_NOTHING;
    return rootState;
  };
}
