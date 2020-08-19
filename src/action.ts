import { NyaxPromise } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ConvertPayloadResultPairsFromModelEffects } from "./effect";
import { ExtractModelActionHelpers, Model } from "./model";
import { ConvertPayloadResultPairsFromModelReducers } from "./reducer";
import { joinLastString, mergeObjects } from "./util";

export interface AnyAction {
  type: string;
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

export const registerActionHelper = new ActionHelperBaseImpl<
  RegisterActionPayload
>("@@nyax/register");

export interface UnregisterActionPayload {
  modelNamespace: string;
  containerKey?: string;
}

export const unregisterActionHelper = new ActionHelperBaseImpl<
  UnregisterActionPayload
>("@@nyax/unregister");

export interface ReloadActionPayload {
  state?: unknown;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax/reload"
);

export interface BatchActionPayload {
  actions: AnyAction[];
  timeout?: number | null;
}

export const batchActionHelper = new ActionHelperBaseImpl<BatchActionPayload>(
  "@@nyax/batch"
);

export interface BatchDispatch {
  (actions: AnyAction[], timeout?: number | null): Promise<void>;
  <TResults extends unknown[]>(
    fn: () => { [K in keyof TResults]: Promise<TResults[K]> },
    timeout?: number | null
  ): Promise<TResults>;
}

export function createBatchDispatch(nyaxContext: NyaxContext): BatchDispatch {
  return ((
    actionsOrFn: AnyAction[] | (() => Promise<unknown>[]),
    timeout?: number | null
  ): Promise<void | unknown[]> => {
    let promise = new Promise<void | unknown[]>((resolve) => {
      nyaxContext.batchCommitCallbacks.push(resolve);
    });

    let actions: AnyAction[];
    if (typeof actionsOrFn === "function") {
      nyaxContext.batchCollectedActions = [];
      const results = actionsOrFn();
      actions = nyaxContext.batchCollectedActions;
      nyaxContext.batchCollectedActions = null;

      promise = promise.then(() => Promise.all(results));
    } else {
      actions = actionsOrFn;
    }

    nyaxContext.store.dispatch(
      batchActionHelper.create({
        actions,
        timeout: timeout ?? null,
      })
    );

    return promise;
  }) as BatchDispatch;
}

export function isBatchAction(
  action: unknown
): action is Action<BatchActionPayload> {
  return batchActionHelper.is(action);
}
