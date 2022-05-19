import { NyaxContext } from "./context";
import { ConvertEffectsTypeParams } from "./effect";
import { Model } from "./model";
import {
  ConvertModelDefinitionActionHelpers,
  ModelDefinitionBase,
} from "./modelDefinition";
import { ConvertReducersTypeParams } from "./reducer";
import { concatLastString, defineGetter, mergeObjects } from "./util";

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export const ModelMountActionType = "$mount";
export type ModelMountActionPayload<
  TState extends Record<string, unknown> = {}
> = {
  state?: TState;
};

export const ModelUnmountActionType = "$unmount";
export type ModelUnmountActionPayload = {};

export const ModelSetActionType = "$set";
export type ModelSetActionPayload<TState extends Record<string, unknown> = {}> =
  TState;

export const ModelPatchActionType = "$patch";
export type ModelPatchActionPayload<
  TState extends Record<string, unknown> = {}
> = Partial<TState>;

export const ReloadActionType = "@@nyax/reload";
export type ReloadActionPayload =
  | {
      state?: Record<string, unknown>;
    }
  | {
      namespace: string;
    };

export interface ActionHelper<TPayload = unknown, TResult = unknown> {
  (payload: TPayload): TResult;

  type: string;
  is(action: unknown): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): TResult;
}

type ConvertActionHelpersFromTypeParams<TTypeParams> = {
  [K in keyof TTypeParams]: TTypeParams[K] extends [infer TTypeParam]
    ? "payload" extends keyof TTypeParam
      ? ActionHelper<
          TTypeParam["payload"],
          "result" extends keyof TTypeParam ? TTypeParam["result"] : void
        >
      : never
    : ConvertActionHelpersFromTypeParams<TTypeParams[K]>;
};

export type ConvertActionHelpers<TReducers, TEffects> =
  ConvertActionHelpersFromTypeParams<
    ConvertReducersTypeParams<TReducers> & ConvertEffectsTypeParams<TEffects>
  >;

const actionHelperPrototype: ActionHelper = function () {
  throw new Error();
};
actionHelperPrototype.type = "";
actionHelperPrototype.is = function (action): action is Action {
  return (action as Action | undefined)?.type === this.type;
};
actionHelperPrototype.create = function (payload) {
  return { type: this.type, payload };
};
actionHelperPrototype.dispatch = function (payload) {
  return this(payload);
};

export function createActionHelper<TPayload, TResult>(
  nyaxContext: NyaxContext,
  model: Model,
  actionType: string
): ActionHelper<TPayload, TResult> {
  const actionHelper = function (payload: TPayload) {
    const action = actionHelper.create(payload);
    return nyaxContext.dispatchAction(action, model, actionType);
  } as ActionHelper<TPayload, TResult>;
  actionHelper.type = concatLastString(
    model.fullNamespace,
    actionType,
    nyaxContext.options.namespaceSeparator
  );
  Object.setPrototypeOf(actionHelper, actionHelperPrototype);
  return actionHelper;
}

export function createActionHelpers<
  TModelDefinition extends ModelDefinitionBase
>(
  nyaxContext: NyaxContext,
  model: Model
): ConvertModelDefinitionActionHelpers<TModelDefinition> {
  const actionHelpers =
    {} as ConvertModelDefinitionActionHelpers<TModelDefinition>;

  actionHelpers[ModelMountActionType] = createActionHelper(
    nyaxContext,
    model,
    ModelMountActionType
  );
  actionHelpers[ModelUnmountActionType] = createActionHelper(
    nyaxContext,
    model,
    ModelUnmountActionType
  );
  actionHelpers[ModelSetActionType] = createActionHelper(
    nyaxContext,
    model,
    ModelSetActionType
  );
  actionHelpers[ModelPatchActionType] = createActionHelper(
    nyaxContext,
    model,
    ModelPatchActionType
  );

  function handle(
    _item: unknown,
    k: string,
    target: Record<string, unknown>,
    paths: readonly string[]
  ) {
    if (!(k in target)) {
      const actionType = paths.join(nyaxContext.options.pathSeparator);
      defineGetter(target, k, () => {
        delete target[k];
        return (target[k] = createActionHelper(nyaxContext, model, actionType));
      });
    }
  }

  mergeObjects(actionHelpers, model.modelDefinition.reducers, handle);
  mergeObjects(actionHelpers, model.modelDefinition.effects, handle);

  return actionHelpers;
}
