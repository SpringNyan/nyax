import { ConvertActionHelperTypeParamsObjectFromEffects } from "./effect";
import {
  ExtractModelDefinitionProperty,
  ModelDefinitionConstructor,
} from "./model";
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

export class ActionHelperBaseImpl<TPayload> {
  public readonly type: string;

  constructor(
    public readonly namespace: string,
    public readonly key: string | undefined,
    public readonly actionType: string
  ) {
    this.type = concatLastString(concatLastString(namespace, key), actionType);
  }

  public is(action: unknown): action is Action<TPayload> {
    return (action as Action<TPayload> | undefined)?.type === this.type;
  }

  public create(payload: TPayload): Action<TPayload> {
    return {
      type: this.type,
      payload,
    };
  }
}

export class ActionHelperImpl<TPayload, TResult>
  extends ActionHelperBaseImpl<TPayload>
  implements ActionHelper<TPayload, TResult> {
  constructor(
    private readonly _nyax: Nyax,
    namespace: string,
    key: string | undefined,
    actionType: string
  ) {
    super(namespace, key, actionType);
  }

  public dispatch(payload: TPayload): Promise<TResult> {
    return this._nyax.store.dispatchModelAction(
      this.namespace,
      this.key,
      this.actionType,
      payload
    ) as Promise<TResult>;
  }
}

export interface RegisterActionPayload {
  namespace: string;
  key?: string;
  state?: unknown;
}

export const registerActionHelper = new ActionHelperBaseImpl<
  RegisterActionPayload[]
>("@@nyax", undefined, "register");

export interface UnregisterActionPayload {
  namespace: string;
  key?: string;
}

export const unregisterActionHelper = new ActionHelperBaseImpl<
  UnregisterActionPayload[]
>("@@nyax", undefined, "unregister");

export interface ReloadActionPayload {
  state?: unknown;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax",
  undefined,
  "reload"
);

export function createActionHelpers<
  TModelDefinitionConstructor extends ModelDefinitionConstructor
>(
  nyax: Nyax,
  modelDefinition: InstanceType<TModelDefinitionConstructor>
): ExtractModelDefinitionProperty<TModelDefinitionConstructor, "actions"> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, modelDefinition.reducers);
  mergeObjects(obj, modelDefinition.effects);

  mergeObjects(actionHelpers, obj, (_item, key, parent, paths) => {
    parent[key] = new ActionHelperImpl(
      nyax,
      modelDefinition.namespace,
      modelDefinition.key,
      paths.join(".")
    );
  });

  return actionHelpers as ExtractModelDefinitionProperty<
    TModelDefinitionConstructor,
    "actions"
  >;
}
