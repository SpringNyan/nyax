import { NyaxContext } from "./context";
import { ConvertActionHelperTypeParamTuplesFromModelEffects } from "./effect";
import {
  ExtractModelActionHelpers,
  ModelDefinitionConstructor,
  ModelInstanceImpl,
} from "./model";
import { ConvertActionHelperTypeParamTuplesFromModelReducers } from "./reducer";
import { joinLastString, mergeObjects } from "./util";

export interface AnyAction {
  type: string;
}

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export type Dispatch = (action: AnyAction) => void;

export interface ActionHelper<TPayload = unknown, TResult = unknown> {
  type: string;
  is(action: unknown): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): Promise<TResult>;
}

export type ConvertActionHelpersFromTypeParamTuples<T> = {
  [K in keyof T]: T[K] extends [any, any]
    ? ActionHelper<T[K][0], T[K][1]>
    : ConvertActionHelpersFromTypeParamTuples<T[K]>;
};

export type ConvertActionHelpers<TReducers, TEffects> = TReducers extends any
  ? TEffects extends any
    ? ConvertActionHelpersFromTypeParamTuples<
        ConvertActionHelperTypeParamTuplesFromModelReducers<TReducers> &
          ConvertActionHelperTypeParamTuplesFromModelEffects<TEffects>
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

    this._nyaxContext.dispatch(action);

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

// ok

export function createActionHelpers<TModel extends ModelDefinitionConstructor>(
  nyaxContext: NyaxContext,
  modelInstance: ModelInstanceImpl<TModel>
): ExtractModelActionHelpers<TModel> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, modelInstance.reducers);
  mergeObjects(obj, modelInstance.effects);

  mergeObjects(actionHelpers, obj, (item, key, parent, paths) => {
    parent[key] = new ActionHelperImpl(
      nyaxContext,
      joinLastString(modelInstance.namespace, paths.join("."))
    );
  });

  return actionHelpers as ExtractModelActionHelpers<TModel>;
}
