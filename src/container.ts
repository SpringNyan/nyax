import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
} from "./action";
import { ConvertArgsParam } from "./arg";
import { ModelContext, NyaxContext } from "./context";
import { ModelConstructor } from "./model";
import { joinLastString } from "./util";

export interface ContainerBase<
  TState = any,
  TGetters = any,
  TActionHelpers = any
> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;
}

export interface Container<
  TModelConstructor extends ModelConstructor = ModelConstructor
>
  extends ContainerBase<
    InstanceType<TModelConstructor>["state"],
    InstanceType<TModelConstructor>["getters"],
    InstanceType<TModelConstructor>["actions"]
  > {
  modelNamespace: string;
  containerKey?: string;

  isRegistered: boolean;
  canRegister: boolean;

  register(
    args?: ConvertArgsParam<
      ReturnType<InstanceType<TModelConstructor>["defaultArgs"]>
    >
  ): void;
  unregister(): void;
}

export class ContainerImpl<
  TModelConstructor extends ModelConstructor = ModelConstructor
> implements Container<TModelConstructor> {
  public readonly modelNamespace: string;

  public readonly modelContext: ModelContext;
  public readonly namespace: string;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly modelConstructor: TModelConstructor,
    public readonly containerKey?: string
  ) {
    const modelContext = this._nyaxContext.modelContextByModelConstructor.get(
      this.modelConstructor
    );
    if (!modelContext) {
      throw new Error("Model is not registered");
    }
    this.modelContext = modelContext;

    this.modelNamespace = this.modelContext.modelNamespace;
    this.namespace = joinLastString(this.modelNamespace, this.containerKey);
  }

  public get currentModel(): InstanceType<TModelConstructor> {
    let model = this.modelContext.modelByContainerKey.get(this.containerKey);
    if (!model) {
      model = new this.modelConstructor();
      // TODO
      this.modelContext.modelByContainerKey.set(this.containerKey, model);
    }
    return model as InstanceType<TModelConstructor>;
  }

  public get state(): InstanceType<TModelConstructor>["state"] {
    return this.currentModel.state;
  }

  public get getters(): InstanceType<TModelConstructor>["getters"] {
    return this.currentModel.getters;
  }

  public get actions(): InstanceType<TModelConstructor>["actions"] {
    return this.currentModel.actions;
  }

  public get isRegistered(): boolean {
    const container = this._nyaxContext.containerByNamespace.get(
      this.namespace
    );
    return container?.modelConstructor === this.modelConstructor;
  }

  public get canRegister(): boolean {
    return !this._nyaxContext.containerByNamespace.has(this.namespace);
  }

  public register(
    args?: ConvertArgsParam<
      ReturnType<InstanceType<TModelConstructor>["defaultArgs"]>
    >
  ): void {
    if (!this.canRegister) {
      throw new Error("Namespace is already used");
    }

    this._nyaxContext.store.dispatch(
      batchRegisterActionHelper.create([
        {
          modelNamespace: this.modelNamespace,
          containerKey: this.containerKey,
          args,
        },
      ])
    );
  }

  public unregister(): void {
    if (this.isRegistered) {
      this._nyaxContext.store.dispatch(
        batchUnregisterActionHelper.create([
          {
            modelNamespace: this.modelNamespace,
            containerKey: this.containerKey,
          },
        ])
      );
    }

    this.modelContext.modelByContainerKey.delete(this.containerKey);
    this.modelContext.containerByContainerKey.delete(this.containerKey);
  }
}

export interface GetContainer {
  <TModelConstructor extends ModelConstructor>(
    modelConstructorOrNamespace: TModelConstructor | string
  ): Container<TModelConstructor>;
  <TModelConstructor extends ModelConstructor>(
    modelConstructorOrNamespace: TModelConstructor | string,
    containerKey: string
  ): Container<TModelConstructor>;
}

export function createGetContainer(nyaxContext: NyaxContext): GetContainer {
  return (
    modelConstructorOrNamespace: ModelConstructor | string,
    containerKey?: string
  ): Container<ModelConstructor> => {
    if (typeof modelConstructorOrNamespace === "string") {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      modelConstructorOrNamespace = nyaxContext.modelConstructorByModelNamespace.get(
        modelConstructorOrNamespace
      )!;
      if (modelConstructorOrNamespace == null) {
        throw new Error("Model is not found by namespace");
      }
    }

    const modelContext = nyaxContext.modelContextByModelConstructor.get(
      modelConstructorOrNamespace
    );
    if (modelContext == null) {
      throw new Error("Model is not registered");
    }

    if (containerKey === undefined && modelContext.isDynamic) {
      throw new Error("Container key is required for dynamic model");
    }

    if (containerKey !== undefined && !modelContext.isDynamic) {
      throw new Error("Container key is not available for static model");
    }

    let container = modelContext.containerByContainerKey.get(containerKey);
    if (container == null) {
      container = new ContainerImpl(
        nyaxContext,
        modelConstructorOrNamespace,
        containerKey
      );
      modelContext.containerByContainerKey.set(containerKey, container);
    }

    return container;
  };
}

export function createSubContainer<
  TContainer extends ContainerBase,
  TSubKey extends string
>(
  container: TContainer,
  subKey: TSubKey
): ContainerBase<
  TContainer["state"],
  TContainer["getters"],
  TContainer["actions"]
> {
  return {
    get state(): TContainer["state"] {
      return container.state[subKey];
    },
    get getters(): TContainer["getters"] {
      return container.getters[subKey];
    },
    get actions(): TContainer["actions"] {
      return container.actions[subKey];
    },
  };
}
