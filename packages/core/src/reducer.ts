import produce from "immer";
import { Reducer } from "redux";
import {
  registerActionHelper,
  RegisterActionPayload,
  reloadActionHelper,
  ReloadActionPayload,
  unregisterActionHelper,
  UnregisterActionPayload,
} from "./action";
import { NYAX_NOTHING } from "./common";
import { NyaxContext } from "./context";
import {
  ConvertState,
  createState,
  getSubState,
  ModelInitialState,
  setSubState,
} from "./state";
import { splitLastString } from "./util";

export type ModelReducer<TPayload = unknown> = {
  bivarianceHack(payload: TPayload): void;
}["bivarianceHack"];

export interface ModelReducers {
  [key: string]: ModelReducer | ModelReducers;
}

export type ConvertActionHelperTypeParamTuplesFromModelReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends ModelReducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertActionHelperTypeParamTuplesFromModelReducers<TReducers[K]>;
};

export function createRootReducer(nyaxContext: NyaxContext): Reducer {
  function batchRegister(
    rootState: unknown,
    payloads: RegisterActionPayload[]
  ): unknown {
    payloads.forEach((payload) => {
      const container = nyaxContext.getContainer(
        payload.namespace,
        payload.key
      );

      let state: unknown;
      if (payload.state !== undefined) {
        state = payload.state;
      } else {
        state = createState(container);
      }

      rootState = setSubState(
        rootState,
        state,
        container.modelContext.modelPath,
        payload.key
      );
    });

    return rootState;
  }

  function batchUnregister(
    rootState: unknown,
    payloads: UnregisterActionPayload[]
  ): unknown {
    payloads.forEach((payload) => {
      const container = nyaxContext.getContainer(
        payload.namespace,
        payload.key
      );

      rootState = setSubState(
        rootState,
        NYAX_NOTHING,
        container.modelContext.modelPath,
        payload.key
      );
    });

    return rootState;
  }

  function reload(rootState: unknown, payload: ReloadActionPayload): unknown {
    if (payload.state !== undefined) {
      return payload.state;
    } else {
      const registerPayloads: RegisterActionPayload[] = [];
      nyaxContext.modelContextByModel.forEach((context, model) => {
        if (!model.isDynamic && !model.isLazy) {
          registerPayloads.push({
            namespace: context.modelNamespace,
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

    if (registerActionHelper.is(action)) {
      return batchRegister(rootState, action.payload);
    } else if (unregisterActionHelper.is(action)) {
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
    const newState = produce(state, (draft) => {
      container.draftState = draft as ConvertState<ModelInitialState>;
      reducer(action["payload"]);
      container.draftState = NYAX_NOTHING;
    });

    return setSubState(
      rootState,
      newState,
      container.modelContext.modelPath,
      container.containerKey
    );
  };

  return (rootState, action) => {
    nyaxContext.cachedRootState = rootState;
    rootState = rootReducer(rootState, action);
    nyaxContext.cachedRootState = NYAX_NOTHING;
    return rootState;
  };
}
