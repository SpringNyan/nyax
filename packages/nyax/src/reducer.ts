import { produce } from "immer";
import { Action as ReduxAction, Reducer as ReduxReducer } from "redux";
import {
  Action,
  ModelMountActionPayload,
  ModelMountActionType,
  ModelPatchActionPayload,
  ModelPatchActionType,
  ModelSetActionPayload,
  ModelSetActionType,
  ModelUnmountActionType,
  ReloadActionPayload,
  ReloadActionType,
} from "./action";
import { NyaxContext } from "./context";
import { Model } from "./model";
import { getModelState, setModelState } from "./state";
import { splitLastString } from "./util";

export type Reducer<TPayload = unknown> = (payload: TPayload) => void;

export type ConvertReducersTypeParams<TReducers> = {
  [K in keyof TReducers]: TReducers[K] extends Reducer<infer TPayload>
    ? [{ payload: TPayload }]
    : ConvertReducersTypeParams<TReducers[K]>;
};

export function createReducer(nyaxContext: NyaxContext): ReduxReducer {
  return function (rootState: any, action: ReduxAction) {
    if (rootState === undefined) {
      rootState = {};
    }

    if (action.type === ReloadActionType) {
      const payload =
        (action as Action<ReloadActionPayload | undefined>).payload ?? {};
      if ("state" in payload && payload.state !== undefined) {
        return payload.state;
      } else {
        return rootState;
      }
    }

    let model: Model | undefined;
    let actionType: string | undefined;
    if (nyaxContext.dispatchingAction === action) {
      model = nyaxContext.dispatchingModel;
      actionType = nyaxContext.dispatchingActionType;
    } else {
      let fullNamespace: string;
      [fullNamespace, actionType] = splitLastString(
        action.type,
        nyaxContext.options.namespaceSeparator
      );
      model = nyaxContext.tryGetModel(fullNamespace) ?? undefined;
    }

    if (!model || !actionType) {
      return rootState;
    }

    if (actionType === ModelMountActionType) {
      const payload =
        (action as Action<ModelMountActionPayload | undefined>).payload ?? {};
      return setModelState(
        rootState,
        model.namespace,
        model.key,
        payload.state !== undefined
          ? payload.state
          : model.modelDefinition.state.call(model)
      );
    }

    if (!model.isMounted) {
      return rootState;
    }

    if (actionType === ModelUnmountActionType) {
      return setModelState(rootState, model.namespace, model.key, undefined);
    }

    if (actionType === ModelSetActionType) {
      const payload = (action as Action<ModelSetActionPayload | undefined>)
        .payload;
      return setModelState(
        rootState,
        model.namespace,
        model.key,
        payload ?? model.modelDefinition.state.call(model)
      );
    }

    if (actionType === ModelPatchActionType) {
      const payload = (action as Action<ModelPatchActionPayload | undefined>)
        .payload;
      return setModelState(rootState, model.namespace, model.key, {
        ...getModelState(rootState, model.namespace, model.key),
        ...payload,
      });
    }

    const reducer = nyaxContext.requireNamespaceContext(model.namespace)
      .flattenedReducers[actionType];
    if (!reducer) {
      return rootState;
    }

    nyaxContext.cachedRootState = rootState;
    try {
      const newState = produce(
        getModelState(rootState, model.namespace, model.key),
        (draft: any) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const context = Object.create(model!, {
            state: {
              get() {
                return draft;
              },
              enumerable: false,
              configurable: true,
            },
          });
          reducer.call(context, (action as Action).payload);
        }
      );
      return setModelState(rootState, model.namespace, model.key, newState);
    } finally {
      nyaxContext.cachedRootState = undefined;
    }
  };
}
