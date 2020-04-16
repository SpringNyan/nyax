import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  createActionHelpers,
} from "./action";
import { ConvertArgs, ConvertArgsParam, createArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { ModelContext, NyaxContext } from "./context";
import { ModelConstructor } from "./model";
import { createGetters } from "./selector";
import { getSubState } from "./state";
import { is, joinLastString } from "./util";

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
  public readonly model: InstanceType<TModelConstructor>;
  public readonly namespace: string;

  public readonly selectors: ReturnType<
    InstanceType<TModelConstructor>["selectors"]
  > = this.model.selectors();

  public readonly reducers: ReturnType<
    InstanceType<TModelConstructor>["reducers"]
  > = this.model.reducers();

  public readonly effects: ReturnType<
    InstanceType<TModelConstructor>["effects"]
  > = this.model.effects();

  public readonly epics: ReturnType<
    InstanceType<TModelConstructor>["epics"]
  > = this.model.epics();

  private _initialStateCache: any;

  private _lastRootState: any;
  private _lastState: any;

  private _gettersCache: any;

  private _actionsCache: any;

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

    this.model = new this.modelConstructor() as InstanceType<TModelConstructor>;
    // TODO

    this.modelNamespace = this.modelContext.modelNamespace;
    this.namespace = joinLastString(this.modelNamespace, this.containerKey);
  }

  public args:
    | ConvertArgs<ReturnType<InstanceType<TModelConstructor>["defaultArgs"]>>
    | undefined;

  public get rootState(): any {
    return this._nyaxContext.cachedRootState !== NYAX_NOTHING
      ? this._nyaxContext.cachedRootState
      : this._nyaxContext.store.getState();
  }

  public get state(): InstanceType<TModelConstructor>["state"] {
    const container = this._currentContainer;
    if (container !== this) {
      return container.state;
    }

    if (this.isRegistered) {
      const rootState = this.rootState;
      if (is(this._lastRootState, rootState)) {
        return this._lastState;
      }

      const state = getSubState(
        rootState,
        this.modelContext.modelPath,
        this.containerKey
      );

      this._lastRootState = rootState;
      this._lastState = state;

      return state;
    }

    if (this.canRegister) {
      if (this._initialStateCache === undefined) {
        this.args = createArgs(
          this.model.defaultArgs(),
          undefined,
          true
        ) as ConvertArgs<
          ReturnType<InstanceType<TModelConstructor>["defaultArgs"]>
        >;
        this._initialStateCache = this.model.initialState();
        this.args = undefined;
      }

      return this._initialStateCache;
    }

    throw new Error("Namespace is already used by other container");
  }

  public get getters(): InstanceType<TModelConstructor>["getters"] {
    const container = this._currentContainer;
    if (container !== this) {
      return container.getters;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._gettersCache === undefined) {
        this._gettersCache = createGetters(this);
      }

      return this._gettersCache;
    }

    throw new Error("Namespace is already used by other container");
  }

  public get actions(): InstanceType<TModelConstructor>["actions"] {
    const container = this._currentContainer;
    if (container !== this) {
      return container.actions;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._actionsCache === undefined) {
        this._actionsCache = createActionHelpers(this._nyaxContext, this);
      }

      return this._actionsCache;
    }

    throw new Error("Namespace is already used by other container");
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

    this.modelContext.containerByContainerKey.delete(this.containerKey);
  }

  private get _currentContainer(): this {
    return this._nyaxContext.getContainer(
      this.modelConstructor,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.containerKey!
    ) as this;
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
