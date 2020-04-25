import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ConvertPayloadResultPairsFromModelEffects } from "./effect";
import { ExtractModelActionHelpers, Model } from "./model";
import { ConvertPayloadResultPairsFromModelReducers } from "./reducer";
import { joinLastString, mergeObjects } from "./util";

export interface AnyAction {
  type: string;
  payload?: any;
}

export interface Action<TPayload = any> {
  type: string;
  payload: TPayload;
}

export interface ActionHelper<TPayload = any, TResult = any> {
  type: string;
  is(action: any): action is Action<TPayload>;
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

  public is(action: any): action is Action<TPayload> {
    return action?.type === this.type;
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
    private readonly _nyaxContext: NyaxContext,
    public readonly type: string
  ) {
    super(type);
  }

  public dispatch(payload: TPayload): Promise<TResult> {
    const action = this.create(payload);
    const promise = new Promise<TResult>((resolve, reject) => {
      // TODO: handle unhandled effect error
      this._nyaxContext.dispatchDeferredByAction.set(action, {
        resolve,
        reject,
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
  const actionHelpers: Record<string, any> = {};

  const obj: Record<string, any> = {};
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
  args?: any;
  state?: any;
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
  state?: any;
}

export const reloadActionHelper = new ActionHelperBaseImpl<ReloadActionPayload>(
  "@@nyax/reload"
);
