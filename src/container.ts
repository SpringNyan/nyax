import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  createActionHelpers,
} from "./action";
import { ConvertArgsParam, createArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { ModelContext, NyaxContext } from "./context";
import { ModelEffect } from "./effect";
import {
  ExtractActionHelpersFromModelConstructor,
  ExtractArgsFromModelConstructor,
  ExtractDefaultArgsFromModelConstructor,
  ExtractEffectsFromModelConstructor,
  ExtractEpicsFromModelConstructor,
  ExtractGettersFromModelConstructor,
  ExtractReducersFromModelConstructor,
  ExtractSelectorsFromModelConstructor,
  ExtractStateFromModelConstructor,
  ModelBase,
  ModelConstructor,
} from "./model";
import { ModelReducer } from "./reducer";
import { createGetters } from "./selector";
import { createState, getSubState } from "./state";
import { flattenObject, joinLastString } from "./util";

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
    ExtractStateFromModelConstructor<TModelConstructor>,
    ExtractGettersFromModelConstructor<TModelConstructor>,
    ExtractActionHelpersFromModelConstructor<TModelConstructor>
  > {
  modelNamespace: string;
  containerKey: string | undefined;

  isRegistered: boolean;
  canRegister: boolean;

  register(
    args?: ConvertArgsParam<
      ExtractDefaultArgsFromModelConstructor<TModelConstructor>
    >
  ): void;
  unregister(): void;
}

export class ContainerImpl<
  TModelConstructor extends ModelConstructor = ModelConstructor
> implements Container<TModelConstructor> {
  public readonly modelContext: ModelContext;

  public readonly modelNamespace: string;
  public readonly namespace: string;

  public readonly model: InstanceType<TModelConstructor>;

  public readonly selectors: ExtractSelectorsFromModelConstructor<
    TModelConstructor
  >;
  public readonly reducers: ExtractReducersFromModelConstructor<
    TModelConstructor
  >;
  public readonly effects: ExtractEffectsFromModelConstructor<
    TModelConstructor
  >;
  public readonly epics: ExtractEpicsFromModelConstructor<TModelConstructor>;

  public readonly reducerByPath: Record<string, ModelReducer>;
  public readonly effectByPath: Record<string, ModelEffect>;

  public modelArgs:
    | ExtractArgsFromModelConstructor<TModelConstructor>
    | typeof NYAX_NOTHING = NYAX_NOTHING;
  public modelState:
    | ExtractStateFromModelConstructor<TModelConstructor>
    | typeof NYAX_NOTHING = NYAX_NOTHING;

  private _initialStateCache: any;

  private _lastRootState: any;
  private _lastState: any;

  private _gettersCache: any;

  private _actionsCache: any;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly modelConstructor: TModelConstructor,
    public readonly containerKey: string | undefined
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

    this.model = this._initializeModel();

    this.selectors = this.model.selectors();
    this.reducers = this.model.reducers();
    this.effects = this.model.effects();
    this.epics = this.model.epics();
    this.reducerByPath = flattenObject(this.reducers);
    this.effectByPath = flattenObject(this.effects);
  }

  public get state(): ExtractStateFromModelConstructor<TModelConstructor> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.state;
    }

    if (this.isRegistered) {
      const rootState = this._nyaxContext.getRootState();
      if (this._lastRootState === rootState) {
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
        this._initialStateCache = createState(
          this,
          createArgs(this, undefined, true)
        );
      }
      return this._initialStateCache;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get getters(): ExtractGettersFromModelConstructor<TModelConstructor> {
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

    throw new Error("Namespace is already bound by other container");
  }

  public get actions(): ExtractActionHelpersFromModelConstructor<
    TModelConstructor
  > {
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

    throw new Error("Namespace is already bound by other container");
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
      ExtractDefaultArgsFromModelConstructor<TModelConstructor>
    >
  ): void {
    if (!this.canRegister) {
      throw new Error("Namespace is already bound");
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
      this.containerKey
    ) as this;
  }

  private _initializeModel(): InstanceType<TModelConstructor> {
    const model = new this.modelConstructor() as ModelBase;
    model._nyaxContext = this._nyaxContext;
    model._container = this;
    return model as InstanceType<TModelConstructor>;
  }
}

export interface GetContainer<TDependencies = any> {
  <TModelConstructor extends ModelConstructor<TDependencies>>(
    modelConstructorOrModelNamespace: TModelConstructor | string
  ): TModelConstructor["isDynamic"] extends true
    ? never
    : Container<TModelConstructor>;
  <TModelConstructor extends ModelConstructor<TDependencies>>(
    modelConstructorOrModelNamespace: TModelConstructor | string,
    containerKey: string
  ): TModelConstructor["isDynamic"] extends true
    ? Container<TModelConstructor>
    : never;
}

export interface GetContainerInternal<TDependencies = any> {
  <TModelConstructor extends ModelConstructor<TDependencies>>(
    modelConstructorOrModelNamespace: TModelConstructor | string,
    containerKey?: string
  ): ContainerImpl<TModelConstructor>;
}

export function createGetContainer(
  nyaxContext: NyaxContext
): GetContainerInternal {
  return <TModelConstructor extends ModelConstructor>(
    modelConstructorOrModelNamespace: TModelConstructor | string,
    containerKey?: string
  ): ContainerImpl<TModelConstructor> => {
    let modelConstructor: TModelConstructor;
    if (typeof modelConstructorOrModelNamespace === "string") {
      modelConstructor = nyaxContext.modelConstructorByModelNamespace.get(
        modelConstructorOrModelNamespace
      ) as TModelConstructor;
      if (!modelConstructor) {
        throw new Error("Model namespace is not bound");
      }
    } else {
      modelConstructor = modelConstructorOrModelNamespace;
    }

    const modelContext = nyaxContext.modelContextByModelConstructor.get(
      modelConstructor
    );
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

    if (containerKey === undefined && modelConstructor.isDynamic) {
      throw new Error("Container key is required for dynamic model");
    }

    if (containerKey !== undefined && !modelConstructor.isDynamic) {
      throw new Error("Container key is not available for static model");
    }

    let container = modelContext.containerByContainerKey.get(
      containerKey
    ) as ContainerImpl<TModelConstructor>;
    if (!container) {
      container = new ContainerImpl(
        nyaxContext,
        modelConstructor,
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
  TContainer["state"][TSubKey],
  TContainer["getters"][TSubKey],
  TContainer["actions"][TSubKey]
> {
  return {
    get state(): TContainer["state"][TSubKey] {
      return container.state[subKey];
    },
    get getters(): TContainer["getters"][TSubKey] {
      return container.getters[subKey];
    },
    get actions(): TContainer["actions"][TSubKey] {
      return container.actions[subKey];
    },
  };
}
