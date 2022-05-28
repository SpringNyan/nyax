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

type ConvertTestActionConditionsFromActionHelpers<TActionHelpers> = {
  [K in keyof TActionHelpers]: TActionHelpers[K] extends ActionHelper<
    infer TPayload,
    any
  >
    ? Partial<Action<TPayload>>
    : ConvertTestActionConditionsFromActionHelpers<TActionHelpers[K]>;
};

export type ConvertTestActionConditions<
  TModelDefinition extends ModelDefinitionBase
> = ConvertTestActionConditionsFromActionHelpers<
  ConvertModelDefinitionActionHelpers<TModelDefinition>
>;

export function createTestActionConditions<
  TModelDefinition extends ModelDefinitionBase
>(
  nyaxContext: NyaxContext,
  modelDefinition: TModelDefinition
): ConvertTestActionConditions<TModelDefinition> {
  const testActionConditions =
    {} as ConvertTestActionConditions<TModelDefinition>;

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

  mergeObjects(testActionConditions, modelDefinition.reducers, handle);
  mergeObjects(testActionConditions, modelDefinition.effects, handle);

  return testActionConditions;
}

export interface TestActionResult<TPayload = unknown> {
  namespace: string;
  key: string | undefined;
  actionType: string;
  payload: TPayload;
}

export interface TestAction {
  (action: unknown): TestActionResult | null;
  <TModelDefinition extends ModelDefinition>(
    action: unknown,
    modelDefinitionOrNamespace: TModelDefinition | string
  ): TestActionResult | null;
  <TModelDefinition extends ModelDefinition, TPayload>(
    action: unknown,
    modelDefinitionOrNamespace: TModelDefinition | string,
    condition:
      | Partial<Action<TPayload>>
      | ((
          conditions: ConvertTestActionConditions<TModelDefinition>
        ) => Partial<Action<TPayload>>)
  ): TestActionResult<TPayload> | null;
}

export function createTestAction(nyaxContext: NyaxContext): TestAction {
  return function (
    action_: unknown,
    modelDefinitionOrNamespace?: ModelDefinition | string,
    condition?:
      | Partial<Action>
      | ((
          conditions: ConvertTestActionConditions<ModelDefinition>
        ) => Partial<Action>)
  ) {
    const action = action_ as Action | undefined;
    if (!action || typeof action.type !== "string" || !("payload" in action)) {
      return null;
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
      return null;
    }

    let namespaceContext: NamespaceContext;
    try {
      namespaceContext = nyaxContext.requireNamespaceContext(
        modelDefinitionOrNamespace ?? namespace
      );
    } catch (error) {
      return null;
    }

    if (namespaceContext.namespace !== namespace) {
      return null;
    }

    if (
      (key === undefined && namespaceContext.modelDefinition.isDynamic) ||
      (key !== undefined && !namespaceContext.modelDefinition.isDynamic)
    ) {
      return null;
    }

    if (condition) {
      if (typeof condition === "function") {
        condition = condition(namespaceContext.testActionConditions);
      }
      if ("type" in condition && actionType !== condition.type) {
        return null;
      }
      if ("payload" in condition && payload !== condition.payload) {
        return null;
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
      return null;
    }

    return {
      namespace,
      key,
      actionType,
      payload,
    };
  };
}
