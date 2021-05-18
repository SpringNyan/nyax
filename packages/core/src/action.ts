import { NyaxContext } from "./context";
import { ConvertActionHelperTypeParamsObjectFromEffects } from "./effect";
import {
  ExtractModelDefinitionProperty,
  ModelDefinitionConstructor,
} from "./model";
import { ConvertActionHelperTypeParamsObjectFromReducers } from "./reducer";
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
  constructor(public readonly type: string) {}

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
  constructor(private readonly _nyaxContext: NyaxContext, type: string) {
    super(type);
  }

  public dispatch(payload: TPayload): Promise<TResult> {
    const action = this.create(payload);

    const promise = new Promise<TResult>((resolve, reject) => {
      this._nyaxContext.dispatchDeferredByAction.set(action, {
        resolve,
        reject,
      });
    });

    this._nyaxContext.store.dispatch(action);

    return promise;
  }
}

export interface RegisterActionPayload {
  namespace: string;
  key?: string;
  state?: unknown;
}

export const registerActionHelper = new ActionHelperBaseImpl<
  RegisterActionPayload[]
>("@@nyax/register");

export interface UnregisterActionPayload {
  namespace: string;
  key?: string;
}

export const unregisterActionHelper = new ActionHelperBaseImpl<
  UnregisterActionPayload[]
>("@@nyax/unregister");

export interface ReloadActionPayload {
  state?: unknown;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax/reload"
);

export function createActionHelpers<
  TModelDefinitionConstructor extends ModelDefinitionConstructor
>(
  nyaxContext: NyaxContext,
  modelDefinition: InstanceType<TModelDefinitionConstructor>
): ExtractModelDefinitionProperty<TModelDefinitionConstructor, "actions"> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, modelDefinition.reducers);
  mergeObjects(obj, modelDefinition.effects);

  const modelPath = concatLastString(
    modelDefinition.namespace,
    modelDefinition.key
  );
  mergeObjects(actionHelpers, obj, (_item, key, parent, paths) => {
    parent[key] = new ActionHelperImpl(
      nyaxContext,
      concatLastString(modelPath, paths.join("."))
    );
  });

  return actionHelpers as ExtractModelDefinitionProperty<
    TModelDefinitionConstructor,
    "actions"
  >;
}
