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
  ModelConstructor,
} from "./model";
import { ModelReducer } from "./reducer";
import { createGetters } from "./selector";
import { createState, getSubState } from "./state";
import { defineGetter, flattenObject, joinLastString } from "./util";

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
  public readonly modelNamespace: string;

  public readonly modelContext: ModelContext;
  public readonly namespace: string;

  public readonly model: InstanceType<TModelConstructor>;

  public readonly selectors: ExtractSelectorsFromModelConstructor<
    TModelConstructor
  > = this.model.selectors();

  public readonly reducers: ExtractReducersFromModelConstructor<
    TModelConstructor
  > = this.model.reducers();

  public readonly effects: ExtractEffectsFromModelConstructor<
    TModelConstructor
  > = this.model.effects();

  public readonly epics: ExtractEpicsFromModelConstructor<
    TModelConstructor
  > = this.model.epics();

  public readonly reducerByPath: Record<string, ModelReducer> = flattenObject(
    this.reducers
  );

  public readonly effectByPath: Record<string, ModelEffect> = flattenObject(
    this.effects
  );

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

    const model = new this.modelConstructor() as InstanceType<
      TModelConstructor
    >;

    defineGetter(model, "dependencies", () => this._nyaxContext.dependencies);
    defineGetter(model, "args", () => {
      if (this.modelArgs !== NYAX_NOTHING) {
        return this.modelArgs;
      }
      throw new Error("Args is only available in `initialState()`");
    });
    defineGetter(model, "state", () => {
      if (this.modelState !== NYAX_NOTHING) {
        return this.modelState;
      }
      return this.state;
    });
    defineGetter(model, "getters", () => this.getters);
    defineGetter(model, "actions", () => this.actions);

    defineGetter(model, "rootAction$", () => this._nyaxContext.rootAction$);
    defineGetter(model, "rootState$", () => this._nyaxContext.rootState$);

    defineGetter(model, "modelNamespace", () => this.modelNamespace);
    defineGetter(model, "containerKey", () => this.containerKey);

    defineGetter(model, "getContainer", () => this._nyaxContext.getContainer);

    this.model = model;
  }

  public get rootState(): any {
    return this._nyaxContext.cachedRootState !== NYAX_NOTHING
      ? this._nyaxContext.cachedRootState
      : this._nyaxContext.store.getState();
  }

  public get state(): ExtractStateFromModelConstructor<TModelConstructor> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.state;
    }

    if (this.isRegistered) {
      const rootState = this.rootState;
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
}

export interface GetContainer {
  <TModelConstructor extends ModelConstructor>(
    modelConstructorOrModelNamespace: TModelConstructor | string
  ): Container<TModelConstructor>;
  <TModelConstructor extends ModelConstructor>(
    modelConstructorOrModelNamespace: TModelConstructor | string,
    containerKey: string
  ): Container<TModelConstructor>;
}

export interface GetContainerInternal {
  <TModelConstructor extends ModelConstructor>(
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

    if (containerKey === undefined && modelContext.isDynamic) {
      throw new Error("Container key is required for dynamic model");
    }

    if (containerKey !== undefined && !modelContext.isDynamic) {
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