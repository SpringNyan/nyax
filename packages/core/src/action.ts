import { NyaxPromise } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ConvertActionHelperTypeParamTuplesFromModelEffects } from "./effect";
import { ExtractModelActionHelpers, Model } from "./model";
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

    const promise = new NyaxPromise<TResult>((resolve, reject) => {
      this._nyaxContext.dispatchDeferredByAction.set(action, {
        resolve,
        reject: (reason) => {
          reject(reason);
          Promise.resolve().then(() => {
            if (!promise.hasRejectionHandler) {
              this._nyaxContext.onUnhandledEffectError(reason, promise);
            }
          });
        },
      });
    });

    this._nyaxContext.store.dispatch(action);

    return promise;
  }
}

export function createActionHelpers<TModel extends Model>(
  nyaxContext: NyaxContext,
  container: ContainerImpl<TModel>
): ExtractModelActionHelpers<TModel> {
  const actionHelpers: Record<string, unknown> = {};

  const obj: Record<string, unknown> = {};
  mergeObjects(obj, container.reducers);
  mergeObjects(obj, container.effects);

  mergeObjects(actionHelpers, obj, (item, key, parent, paths) => {
    parent[key] = new ActionHelperImpl(
      nyaxContext,
      joinLastString(container.namespace, paths.join("."))
    );
  });

  return actionHelpers as ExtractModelActionHelpers<TModel>;
}

export interface RegisterActionPayload {
  modelNamespace: string;
  containerKey?: string;
  args?: unknown;
  state?: unknown;
}

export const batchRegisterActionHelper = new ActionHelperBaseImpl<
  RegisterActionPayload[]
>("@@nyax/register");

export interface UnregisterActionPayload {
  modelNamespace: string;
  containerKey?: string;
}

export const batchUnregisterActionHelper = new ActionHelperBaseImpl<
  UnregisterActionPayload[]
>("@@nyax/unregister");

export interface ReloadActionPayload {
  state?: unknown;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax/reload"
);
