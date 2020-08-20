import produce from "immer";
import { Reducer } from "redux";
import {
  Action,
  batchActionHelper,
  registerActionHelper,
  RegisterActionPayload,
  reloadActionHelper,
  ReloadActionPayload,
  unregisterActionHelper,
  UnregisterActionPayload,
} from "./action";
import { ConvertRegisterArgs, createArgs, ModelDefaultArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { NyaxContext } from "./context";
import {
  ConvertState,
  createState,
  getSubState,
  ModelInitialState,
  updateSubState,
} from "./state";
import { findLastIndex, splitLastString } from "./util";

export type ModelReducer<TPayload = unknown> = {
  bivarianceHack(payload: TPayload): void;
}["bivarianceHack"];

export interface ModelReducers {
  [key: string]: ModelReducer | ModelReducers;
}

export type ConvertPayloadResultPairsFromModelReducers<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends ModelReducer<infer TPayload>
    ? [TPayload, unknown]
    : ConvertPayloadResultPairsFromModelReducers<TReducers[K]>;
};

export function createRootReducer(nyaxContext: NyaxContext): Reducer {
  function register(
    rootState: Record<string, unknown>,
    payload: RegisterActionPayload
  ): void {
    const container = nyaxContext.getContainer(
      payload.modelNamespace,
      payload.containerKey
    );

    let state: unknown;
    if (payload.state !== undefined) {
      state = payload.state;
    } else {
      state = createState(
        container,
        createArgs(
          container,
          payload.args as ConvertRegisterArgs<ModelDefaultArgs> | undefined,
          false
        )
      );
    }

    updateSubState(
      rootState,
      state,
      container.modelContext.modelPath,
      payload.containerKey
    );
  }

  function unregister(
    rootState: Record<string, unknown>,
    payload: UnregisterActionPayload
  ): void {
    const container = nyaxContext.getContainer(
      payload.modelNamespace,
      payload.containerKey
    );

    updateSubState(
      rootState,
      NYAX_NOTHING,
      container.modelContext.modelPath,
      payload.containerKey
    );
  }

  const rootReducer: Reducer = (rootState, action) => {
    if (rootState === undefined) {
      rootState = {};
    }

    const actions = batchActionHelper.is(action)
      ? action.payload.actions
      : [action];

    const reloadIndex = findLastIndex(actions, (action) =>
      reloadActionHelper.is(action)
    );
    if (reloadIndex >= 0) {
      const reloadAction = actions[reloadIndex] as Action<ReloadActionPayload>;
      if (reloadAction.payload.state !== undefined) {
        rootState = reloadAction.payload.state;
      } else {
        const registerActionPayloads: RegisterActionPayload[] = [];
        nyaxContext.modelContextByModel.forEach((context, model) => {
          if (!model.isDynamic && !model.isOnDemand && !model.isLazy) {
            registerActionPayloads.push({
              modelNamespace: context.modelNamespace,
            });
          }
        });
        rootState = produce({}, (draft: Record<string, unknown>) => {
          registerActionPayloads.forEach((payload) => {
            register(draft, payload);
          });
        });
      }
    }

    rootState = produce(rootState, (draft: Record<string, unknown>) => {
      for (let i = reloadIndex + 1; i < actions.length; ++i) {
        const action = actions[i];

        if (registerActionHelper.is(action)) {
          register(draft, action.payload);
          continue;
        } else if (unregisterActionHelper.is(action)) {
          unregister(draft, action.payload);
          continue;
        }

        const [namespace, actionName] = splitLastString(action.type);

        const container = nyaxContext.containerByNamespace.get(namespace);
        if (!container?.isRegistered) {
          continue;
        }

        const reducer = container.reducerByPath[actionName];
        if (!reducer) {
          continue;
        }

        const draftState = getSubState(
          draft,
          container.modelContext.modelPath,
          container.containerKey
        );
        container.draftState = draftState as ConvertState<ModelInitialState>;
        reducer(action.payload);
        container.draftState = NYAX_NOTHING;
      }
    });

    return rootState;
  };

  return (rootState, action) => {
    nyaxContext.cachedRootState = rootState;
    rootState = rootReducer(rootState, action);
    nyaxContext.cachedRootState = NYAX_NOTHING;
    return rootState;
  };
}
