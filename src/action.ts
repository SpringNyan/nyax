import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ConvertPayloadResultPairsFromEffects } from "./effect";
import { ModelConstructor } from "./model";
import { ConvertPayloadResultPairsFromReducers } from "./reducer";
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

export interface ActionHelpers {
  [key: string]: ActionHelper | ActionHelpers;
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
        ConvertPayloadResultPairsFromReducers<TReducers> &
          ConvertPayloadResultPairsFromEffects<TEffects>
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
    private readonly _container: ContainerImpl,
    public readonly type: string
  ) {
    super(type);
  }

  public dispatch(payload: TPayload): Promise<TResult> {
    if (
      this._container.canRegister &&
      this._container.modelContext.autoRegister
    ) {
      this._container.register();
    } else {
      throw new Error("Container is not registered");
    }

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

export function createActionHelpers<TModelConstructor extends ModelConstructor>(
  nyaxContext: NyaxContext,
  container: ContainerImpl<TModelConstructor>
): InstanceType<TModelConstructor>["actions"] {
  const actionHelpers: ActionHelpers = {};

  const obj: any = {};
  mergeObjects(obj, container.currentModel.reducers());
  mergeObjects(obj, container.currentModel.effects());

  const paths: string[] = [];
  mergeObjects(
    actionHelpers,
    obj,
    () =>
      new ActionHelperImpl(
        nyaxContext,
        container,
        joinLastString(container.namespace, paths.join("."))
      ),
    paths
  );

  return actionHelpers as InstanceType<TModelConstructor>["actions"];
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
