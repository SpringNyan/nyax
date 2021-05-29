import { ConvertActionHelperTypeParamsObjectFromEffects } from "./effect";
import { ExtractModelProperty, ModelDefinitionConstructor } from "./model";
import { ConvertActionHelperTypeParamsObjectFromReducers } from "./reducer";
import { Nyax } from "./store";
import { concatLastString, mergeObjects } from "./util";

export interface AnyAction {
  type: string;
  payload?: unknown;
}

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface ActionHelper<TPayload = unknown, TResult = unknown> {
  (payload: TPayload): Promise<TResult>;

  type: string;
  is(action: unknown): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): Promise<TResult>;
}

export interface ActionHelpers {
  [key: string]: ActionHelper | ActionHelpers;
}

export type ConvertActionHelpersFromTypeParamsObject<T> = {
  [K in keyof T]: T[K] extends [any, any]
    ? ActionHelper<T[K][0], T[K][1]>
    : ConvertActionHelpersFromTypeParamsObject<T[K]>;
};

export type ConvertActionHelpers<TReducers, TEffects> = TReducers extends any
  ? TEffects extends any
    ? ConvertActionHelpersFromTypeParamsObject<
        ConvertActionHelperTypeParamsObjectFromReducers<TReducers> &
          ConvertActionHelperTypeParamsObjectFromEffects<TEffects>
      >
    : never
  : never;

export const registerActionType = "@@nyax/register";
export type RegisterActionPayload = RegisterActionPayloadItem[];
export interface RegisterActionPayloadItem {
  namespace: string;
  key?: string;
  state?: unknown;
}

export const unregisterActionType = "@@nyax/unregister";
export type UnregisterActionPayload = UnregisterActionPayloadItem[];
export interface UnregisterActionPayloadItem {
  namespace: string;
  key?: string;
}

export const reloadActionType = "@@nyax/reload";
export interface ReloadActionPayload {
  state?: unknown;
}

export function createActionHelper<TPayload, TResult>(
  nyax: Nyax,
  namespace: string,
  key: string | undefined,
  actionType: string
): ActionHelper<TPayload, TResult> {
  const actionHelper: ActionHelper<TPayload, TResult> = (payload) =>
    nyax.store.dispatchModelAction(
      namespace,
      key,
      actionType,
      payload
    ) as Promise<TResult>;
  actionHelper.type = concatLastString(
    concatLastString(namespace, key),
    actionType
  );
  actionHelper.is = (action): action is Action<TPayload> =>
    (action as Action<TPayload> | undefined)?.type === actionHelper.type;
  actionHelper.create = (payload) => ({ type: actionHelper.type, payload });
  actionHelper.dispatch = actionHelper;

  return actionHelper;
}

export function createActionHelpers<
  TModelDefinitionConstructor extends ModelDefinitionConstructor
>(
  nyax: Nyax,
  modelDefinition: InstanceType<TModelDefinitionConstructor>
): ExtractModelProperty<TModelDefinitionConstructor, "actions"> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, modelDefinition.reducers());
  mergeObjects(obj, modelDefinition.effects());

  mergeObjects(actionHelpers, obj, (_item, key, parent, paths) => {
    parent[key] = createActionHelper(
      nyax,
      modelDefinition.namespace,
      modelDefinition.key,
      paths.join(".")
    );
  });

  return actionHelpers as ExtractModelProperty<
    TModelDefinitionConstructor,
    "actions"
  >;
}
