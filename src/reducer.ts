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

export type ModelReducer<TPayload = any> = (payload: TPayload) => void;

export interface ModelReducers {
  [key: string]: ModelReducer | ModelReducers;
}

export type ConvertPayloadResultPairsFromModelReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends ModelReducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertPayloadResultPairsFromModelReducers<TReducers[K]>;
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
      const registerPayloads: RegisterActionPayload[] = [];
      nyaxContext.modelContextByModel.forEach((context, model) => {
        if (!model.isDynamic && !model.isLazy) {
          registerPayloads.push({
            modelNamespace: context.modelNamespace,
          });
        }
      });
      return batchRegister(undefined, registerPayloads);
    }
  }

  const rootReducer: Reducer = (rootState, action) => {
    if (rootState === undefined) {
      rootState = {};
    }

    if (batchRegisterActionHelper.is(action)) {
      return batchRegister(rootState, action.payload);
    } else if (batchUnregisterActionHelper.is(action)) {
      return batchUnregister(rootState, action.payload);
    } else if (reloadActionHelper.is(action)) {
      return reload(rootState, action.payload);
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
      container.draftState = draft;
      reducer(action.payload);
      container.draftState = NYAX_NOTHING;
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
