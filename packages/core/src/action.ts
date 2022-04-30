import { NyaxContext } from "./context";
import { ConvertEffectsTypeParams } from "./effect";
import { Model } from "./model";
import {
  ConvertModelDefinitionActionHelpers,
  ModelDefinition,
} from "./modelDefinition";
import { ConvertReducersTypeParams } from "./reducer";
import { concatLastString, defineGetter, mergeObjects } from "./util";

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export const MountActionType = "@@mount";
export interface MountActionPayload {
  state?: unknown;
}

export const UnmountActionType = "@@unmount";
export interface UnmountActionPayload {}

export interface ActionHelper<TPayload = unknown, TResult = unknown> {
  (payload: TPayload): TResult;

  type: string;
  is(action: unknown): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): TResult;
}

export interface ActionHelpers {
  [key: string]: ActionHelper | ActionHelpers;
}

type ConvertTypeParamsActionHelpers<TTypeParams> = {
  [K in keyof TTypeParams]: TTypeParams[K] extends [infer TTypeParam]
    ? "payload" extends keyof TTypeParam
      ? ActionHelper<
          TTypeParam["payload"],
          "result" extends keyof TTypeParam ? TTypeParam["result"] : void
        >
      : never
    : ConvertTypeParamsActionHelpers<TTypeParams[K]>;
};

export type ConvertActionHelpers<TReducers, TEffects> =
  ConvertTypeParamsActionHelpers<
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
    return nyaxContext.store.dispatchModelAction(
      model.namespace,
      model.key,
      actionType,
      payload
    ) as TResult;
  } as ActionHelper<TPayload, TResult>;
  actionHelper.type = concatLastString(
    model.fullNamespace,
    actionType,
    nyaxContext.options.namespaceSeparator
  );
  Object.setPrototypeOf(actionHelper, actionHelperPrototype);
  return actionHelper;
}

export function createActionHelpers<TModelDefinition extends ModelDefinition>(
  nyaxContext: NyaxContext,
  model: Model
): ConvertModelDefinitionActionHelpers<TModelDefinition> {
  const actionHelpers =
    {} as ConvertModelDefinitionActionHelpers<TModelDefinition>;

  function handle(
    _item: unknown,
    k: string,
    target: Record<string, unknown>,
    paths: readonly string[]
  ) {
    if (!(k in target)) {
      const actionType = paths.join(nyaxContext.options.pathSeparator);
      defineGetter(target, k, function () {
        delete target[k];
        return (target[k] = createActionHelper(nyaxContext, model, actionType));
      });
    }
  }

  mergeObjects(actionHelpers, model.modelDefinition.reducers, handle);
  mergeObjects(actionHelpers, model.modelDefinition.effects, handle);

  return actionHelpers;
}
