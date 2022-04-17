import { ConvertEffectsTypeParams } from "./effect";
import { Model } from "./model";
import {
  ConvertModelDefinitionActionHelpers,
  ModelDefinition,
} from "./modelDefinition";
import { ConvertReducersTypeParams } from "./reducer";
import { Store } from "./store";
import { concatLastString, defineGetter, mergeObjects } from "./util";

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

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
  store: Store,
  model: Model,
  actionType: string
): ActionHelper<TPayload, TResult> {
  const actionHelper = function (payload: TPayload) {
    return store.dispatchModelAction(model, actionType, payload) as TResult;
  } as ActionHelper<TPayload, TResult>;
  actionHelper.type = concatLastString(
    concatLastString(model.namespace, model.key),
    actionType
  );
  Object.setPrototypeOf(actionHelper, actionHelperPrototype);
  return actionHelper;
}

export function createActionHelpers<TModelDefinition extends ModelDefinition>(
  store: Store,
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
      const actionType = paths.join(".");
      defineGetter(target, k, function () {
        delete target[k];
        return (target[k] = createActionHelper(store, model, actionType));
      });
    }
  }

  mergeObjects(actionHelpers, model.modelDefinition.reducers, handle);
  mergeObjects(actionHelpers, model.modelDefinition.effects, handle);

  return actionHelpers;
}
