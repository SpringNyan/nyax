import { NamespaceContext, NyaxContext } from "./context";
import { ConvertEffectsTypeParams } from "./effect";
import { Model } from "./model";
import {
  ConvertModelDefinitionActionHelpers,
  ModelDefinition,
  ModelDefinitionBase,
} from "./modelDefinition";
import { ConvertReducersTypeParams } from "./reducer";
import { concatLastString, defineGetter, mergeObjects } from "./util";

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export const ModelMountActionType = "$mount";
export type ModelMountActionPayload = {
  state?: Record<string, unknown>;
};

export const ModelUnmountActionType = "$unmount";
export type ModelUnmountActionPayload = {};

export const ModelSetActionType = "$set";
export type ModelSetActionPayload = {
  state: Record<string, unknown>;
  path?: string | string[];
};

export const ModelPatchActionType = "$patch";
export type ModelPatchActionPayload = {
  state: Partial<Record<string, unknown>>;
  path?: string | string[];
};

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

  function handle(
    _item: unknown,
    k: string,
    target: Record<string, unknown>,
    path: readonly string[]
  ) {
    if (!(k in target)) {
      const actionType = path.join(nyaxContext.options.pathSeparator);
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

type ConvertParseActionConditionsFromActionHelpers<TActionHelpers> = {
  [K in keyof TActionHelpers]: TActionHelpers[K] extends ActionHelper<
    infer TPayload,
    any
  >
    ? Partial<Action<TPayload>>
    : ConvertParseActionConditionsFromActionHelpers<TActionHelpers[K]>;
};

export type ConvertParseActionConditions<
  TModelDefinition extends ModelDefinitionBase
> = ConvertParseActionConditionsFromActionHelpers<
  ConvertModelDefinitionActionHelpers<TModelDefinition>
>;

export function createParseActionConditions<
  TModelDefinition extends ModelDefinitionBase
>(
  nyaxContext: NyaxContext,
  modelDefinition: TModelDefinition
): ConvertParseActionConditions<TModelDefinition> {
  const parseActionConditions =
    {} as ConvertParseActionConditions<TModelDefinition>;

  function handle(
    _item: unknown,
    k: string,
    target: Record<string, unknown>,
    path: readonly string[]
  ) {
    if (!(k in target)) {
      const actionType = path.join(nyaxContext.options.pathSeparator);
      defineGetter(target, k, () => {
        delete target[k];
        const condition: Partial<Action> = { type: actionType };
        return (target[k] = condition);
      });
    }
  }

  mergeObjects(parseActionConditions, modelDefinition.reducers, handle);
  mergeObjects(parseActionConditions, modelDefinition.effects, handle);

  return parseActionConditions;
}

export interface ParseActionResult<TPayload = unknown> {
  namespace: string;
  key: string | undefined;
  actionType: string;
  payload: TPayload;
}

export interface ParseAction {
  (action: unknown): ParseActionResult | undefined;
  <TModelDefinition extends ModelDefinition>(
    action: unknown,
    modelDefinitionOrNamespace: TModelDefinition | string
  ): ParseActionResult | undefined;
  <TModelDefinition extends ModelDefinition, TPayload>(
    action: unknown,
    modelDefinitionOrNamespace: TModelDefinition | string,
    condition:
      | Partial<Action<TPayload>>
      | ((
          conditions: ConvertParseActionConditions<TModelDefinition>
        ) => Partial<Action<TPayload>>)
  ): ParseActionResult<TPayload> | undefined;
}

export function createParseAction(nyaxContext: NyaxContext): ParseAction {
  return function (
    action_: unknown,
    modelDefinitionOrNamespace?: ModelDefinition | string,
    condition?:
      | Partial<Action>
      | ((
          conditions: ConvertParseActionConditions<ModelDefinition>
        ) => Partial<Action>)
  ) {
    const action = action_ as Action | undefined;
    if (!action || typeof action.type !== "string" || !("payload" in action)) {
      return undefined;
    }

    const payload = action.payload;

    let namespace: string;
    let key: string | undefined;
    let actionType: string;
    const arr = action.type.split(nyaxContext.options.namespaceSeparator);
    if (arr.length === 2) {
      [namespace, actionType] = arr as [string, string];
    } else if (arr.length === 3) {
      [namespace, key, actionType] = arr as [string, string, string];
    } else {
      return undefined;
    }

    let namespaceContext: NamespaceContext;
    try {
      namespaceContext = nyaxContext.requireNamespaceContext(
        modelDefinitionOrNamespace ?? namespace
      );
    } catch (error) {
      return undefined;
    }

    if (namespaceContext.namespace !== namespace) {
      return undefined;
    }

    if (
      (key === undefined && namespaceContext.modelDefinition.isDynamic) ||
      (key !== undefined && !namespaceContext.modelDefinition.isDynamic)
    ) {
      return undefined;
    }

    if (condition) {
      if (typeof condition === "function") {
        condition = condition(namespaceContext.parseActionConditions);
      }
      if ("type" in condition && actionType !== condition.type) {
        return undefined;
      }
      if ("payload" in condition && payload !== condition.payload) {
        return undefined;
      }
    }

    if (
      !(actionType in namespaceContext.flattenedReducers) &&
      !(actionType in namespaceContext.flattenedEffects) &&
      actionType !== ModelMountActionType &&
      actionType !== ModelUnmountActionType &&
      actionType !== ModelSetActionType &&
      actionType !== ModelPatchActionType
    ) {
      return undefined;
    }

    return {
      namespace,
      key,
      actionType,
      payload,
    };
  };
}
