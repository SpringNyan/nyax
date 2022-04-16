import { ConvertEffectsTypeParams } from "./effect";
import {
  ConvertModelDefinitionActionHelpers,
  ModelDefinition,
} from "./modelDefinition";
import { ConvertReducersTypeParams } from "./reducer";
import { Nyax } from "./store";
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
  nyax: Nyax,
  namespace: string,
  key: string | undefined,
  actionType: string
): ActionHelper<TPayload, TResult> {
  const actionHelper = function (payload: TPayload) {
    return nyax.store.dispatchModelAction(
      namespace,
      key,
      actionType,
      payload
    ) as TResult;
  } as ActionHelper<TPayload, TResult>;
  actionHelper.type = concatLastString(
    concatLastString(namespace, key),
    actionType
  );
  Object.setPrototypeOf(actionHelper, actionHelperPrototype);
  return actionHelper;
}

export function createActionHelpers<TModelDefinition extends ModelDefinition>(
  nyax: Nyax,
  modelDefinition: TModelDefinition,
  namespace: string,
  key: string | undefined
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
        return (target[k] = createActionHelper(
          nyax,
          namespace,
          key,
          actionType
        ));
      });
    }
  }

  mergeObjects(actionHelpers, modelDefinition.reducers, handle);
  mergeObjects(actionHelpers, modelDefinition.effects, handle);

  return actionHelpers;
}

// ok
