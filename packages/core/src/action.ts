import { NyaxContext } from "./context";
import { ConvertActionHelperTypeParamsTuplesFromModelEffects } from "./effect";
import {
  ExtractModelActionHelpers,
  ModelDefinition,
  ModelDefinitionConstructor,
} from "./model";
import { ConvertActionHelperTypeParamsTuplesFromModelReducers } from "./reducer";
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

export type ConvertActionHelpersFromTypeParamsTuples<T> = {
  [K in keyof T]: T[K] extends [any, any]
    ? ActionHelper<T[K][0], T[K][1]>
    : ConvertActionHelpersFromTypeParamsTuples<T[K]>;
};

export type ConvertActionHelpers<TReducers, TEffects> = TReducers extends any
  ? TEffects extends any
    ? ConvertActionHelpersFromTypeParamsTuples<
        ConvertActionHelperTypeParamsTuplesFromModelReducers<TReducers> &
          ConvertActionHelperTypeParamsTuplesFromModelEffects<TEffects>
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
  RegisterActionPayload | RegisterActionPayload[]
>("@@nyax/register");

export interface UnregisterActionPayload {
  namespace: string;
  key?: string;
}

export const unregisterActionHelper = new ActionHelperBaseImpl<
  UnregisterActionPayload | UnregisterActionPayload[]
>("@@nyax/unregister");

export interface ReloadActionPayload {
  state?: unknown;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax/reload"
);

export function createActionHelpers<TModel extends ModelDefinitionConstructor>(
  nyaxContext: NyaxContext,
  modelDefinition: ModelDefinition<TModel>
): ExtractModelActionHelpers<TModel> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, modelDefinition.reducers());
  mergeObjects(obj, modelDefinition.effects());

  const fullNamespace = concatLastString(
    modelDefinition.namespace,
    modelDefinition.key
  );
  mergeObjects(actionHelpers, obj, (_item, key, parent, paths) => {
    parent[key] = new ActionHelperImpl(
      nyaxContext,
      concatLastString(fullNamespace, paths.join("."))
    );
  });

  return actionHelpers as ExtractModelActionHelpers<TModel>;
}

// ok
