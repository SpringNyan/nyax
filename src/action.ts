import { NyaxPromise } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ConvertPayloadResultPairsFromModelEffects } from "./effect";
import { AnyModel, ExtractModelActionHelpers } from "./model";
import { ConvertPayloadResultPairsFromModelReducers } from "./reducer";
import { joinLastString, mergeObjects } from "./util";

export interface AnyAction {
  type: string;
}

export interface Action<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface ActionHelper<TPayload, TResult> {
  type: string;
  is(action: unknown): action is Action<TPayload>;
  create(payload: TPayload): Action<TPayload>;
  dispatch(payload: TPayload): Promise<TResult>;
}

export type ConvertActionHelpersFromPayloadResultPairs<T> = {
  [K in keyof T]: T[K] extends [any, any]
    ? ActionHelper<T[K][0], T[K][1]>
    : ConvertActionHelpersFromPayloadResultPairs<T[K]>;
};

export type ConvertActionHelpers<
  TReducers,
  TEffects
> = TReducers extends infer TReducers
  ? TEffects extends infer TEffects
    ? ConvertActionHelpersFromPayloadResultPairs<
        ConvertPayloadResultPairsFromModelReducers<TReducers> &
          ConvertPayloadResultPairsFromModelEffects<TEffects>
      >
    : never
  : never;

export class ActionHelperBaseImpl<TPayload>
  implements Omit<ActionHelper<TPayload, never>, "dispatch"> {
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
        resolve: resolve as (value: unknown) => void,
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

export function createActionHelpers<TModel extends AnyModel>(
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
