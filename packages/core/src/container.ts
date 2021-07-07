import { registerActionType, unregisterActionType } from "./action";
import { NyaxContext } from "./context";
import { ModelClass, NamespacedModelClass } from "./model";

export type ContainerPropertyKey = "state" | "getters" | "actions";

export type ExtractContainerProperty<
  TModelClass extends ModelClass,
  TPropertyKey extends ContainerPropertyKey
> = InstanceType<TModelClass>[TPropertyKey];

export interface ContainerLite<TModelClass extends ModelClass = ModelClass> {
  state: ExtractContainerProperty<TModelClass, "state">;
  getters: ExtractContainerProperty<TModelClass, "getters">;
  actions: ExtractContainerProperty<TModelClass, "actions">;
}

export interface Container<
  TModelClass extends NamespacedModelClass = NamespacedModelClass
> extends ContainerLite<TModelClass> {
  modelClass: TModelClass;

  namespace: string;
  key: string | undefined;

  isRegistered: boolean;

  register(): void;
  unregister(): void;
}

export class ContainerImpl<
  TModelClass extends NamespacedModelClass = NamespacedModelClass
> implements Container<TModelClass>
{
  public readonly namespace: string;

  private get _model() {
    const model = this._nyaxContext.getModel(this.namespace, this.key);
    if (!model) {
      throw new Error("Model is not registered.");
    }
    return model as InstanceType<TModelClass>;
  }

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly modelClass: TModelClass,
    public readonly key: string | undefined
  ) {
    this.namespace = modelClass.namespace;
  }

  public get isRegistered(): boolean {
    return (
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._nyaxContext.nyax.getState(this.namespace, this.key!) !== undefined
    );
  }

  public get state(): ExtractContainerProperty<TModelClass, "state"> {
    return this._model.state;
  }

  public get getters(): ExtractContainerProperty<TModelClass, "getters"> {
    return this._model.getters;
  }

  public get actions(): ExtractContainerProperty<TModelClass, "actions"> {
    return this._model.actions;
  }

  public register(): void {
    if (this.isRegistered) {
      throw new Error("Model is already registered.");
    }

    this._nyaxContext.nyax.store.dispatch({
      type: registerActionType,
      payload: [{ namespace: this.namespace, key: this.key }],
    });
  }

  public unregister(): void {
    if (this.isRegistered) {
      this._nyaxContext.nyax.store.dispatch({
        type: unregisterActionType,
        payload: [{ namespace: this.namespace, key: this.key }],
      });
    }

    this._nyaxContext.modelClassContextByNamespace
      .get(this.namespace)
      ?.containerByKey.delete(this.key);
  }
}

export interface GetContainer {
  <TModelClass extends NamespacedModelClass>(
    modelClassOrNamespace: TModelClass | string
  ): TModelClass extends NamespacedModelClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? never
    : Container<TModelClass>;
  <TModelClass extends NamespacedModelClass>(
    modelClassOrNamespace: TModelClass | string,
    key: string
  ): TModelClass extends NamespacedModelClass<
    any,
    any,
    any,
    any,
    any,
    any,
    false
  >
    ? never
    : Container<TModelClass>;
}

export function createGetContainer(nyaxContext: NyaxContext): GetContainer {
  return <TModelClass extends NamespacedModelClass>(
    modelClassOrNamespace: TModelClass | string,
    key?: string
  ): Container<TModelClass> => {
    const modelClassContext = nyaxContext.getModelClassContext(
      modelClassOrNamespace
    );
    const modelClass = modelClassContext.modelClass;

    if (key === undefined && modelClass.isDynamic) {
      throw new Error("Key is required for dynamic model.");
    }

    if (key !== undefined && !modelClass.isDynamic) {
      throw new Error("Key is not available for static model.");
    }

    let container = modelClassContext.containerByKey.get(key);
    if (!container) {
      container = new ContainerImpl(nyaxContext, modelClass, key);
      modelClassContext.containerByKey.set(key, container);
    }

    return container as Container<TModelClass>;
  };
}

export interface SubContainer<
  /* eslint-disable @typescript-eslint/ban-types */
  TState = {},
  TGetters = {},
  TActionHelpers = {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;
}

export function createSubContainer<
  TContainer extends SubContainer<any, any, any>,
  TSubKey extends string
>(
  container: TContainer,
  subKey: TSubKey
): SubContainer<
  TContainer["state"][TSubKey],
  TContainer["getters"][TSubKey],
  TContainer["actions"][TSubKey]
> {
  return {
    get state(): TContainer["state"][TSubKey] {
      return container.state?.[subKey];
    },
    get getters(): TContainer["getters"][TSubKey] {
      return container.getters?.[subKey];
    },
    get actions(): TContainer["actions"][TSubKey] {
      return container.actions?.[subKey];
    },
  };
}
