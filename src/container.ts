import {
  batchRegisterActionHelper,
  batchUnregisterActionHelper,
  createActionHelpers,
} from "./action";
import { ConvertRegisterArgs, createArgs } from "./arg";
import { NYAX_NOTHING } from "./common";
import { ModelContext, NyaxContext } from "./context";
import { ModelEffect } from "./effect";
import {
  ExtractModelActionHelpers,
  ExtractModelArgs,
  ExtractModelDefaultArgs,
  ExtractModelEffects,
  ExtractModelEpics,
  ExtractModelGetters,
  ExtractModelReducers,
  ExtractModelSelectors,
  ExtractModelState,
  Model,
  ModelBase,
  ModelInstanceConstructor,
} from "./model";
import { ModelReducer } from "./reducer";
import { createGetters } from "./selector";
import { createState, getSubState } from "./state";
import { flattenObject, joinLastString } from "./util";

export interface ContainerBase<TState, TGetters, TActionHelpers> {
  state: TState;
  getters: TGetters;
  actions: TActionHelpers;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ContainerCore<TModel extends Model>
  extends ContainerBase<
    ExtractModelState<TModel>,
    ExtractModelGetters<TModel>,
    ExtractModelActionHelpers<TModel>
  > {}

export interface Container<TModel extends Model> extends ContainerCore<TModel> {
  modelNamespace: string;
  containerKey: string | undefined;

  isRegistered: boolean;
  canRegister: boolean;

  register(args?: ConvertRegisterArgs<ExtractModelDefaultArgs<TModel>>): void;
  unregister(): void;
}

export class ContainerImpl<TModel extends Model> implements Container<TModel> {
  public readonly modelContext: ModelContext;

  public readonly modelNamespace: string;
  public readonly namespace: string;

  public readonly modelInstance: InstanceType<TModel>;

  public readonly selectors: ExtractModelSelectors<TModel>;
  public readonly reducers: ExtractModelReducers<TModel>;
  public readonly effects: ExtractModelEffects<TModel>;
  public readonly epics: ExtractModelEpics<TModel>;

  public readonly reducerByPath: Record<string, ModelReducer<unknown>>;
  public readonly effectByPath: Record<string, ModelEffect<unknown, unknown>>;

  public args: ExtractModelArgs<TModel> | typeof NYAX_NOTHING = NYAX_NOTHING;
  public draftState:
    | ExtractModelState<TModel>
    | typeof NYAX_NOTHING = NYAX_NOTHING;

  private _initialStateCache: unknown;

  private _lastRootState: unknown;
  private _lastState: unknown;

  private _gettersCache: unknown;

  private _actionsCache: unknown;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly model: TModel,
    public readonly containerKey: string | undefined
  ) {
    const modelContext = this._nyaxContext.modelContextByModel.get(this.model);
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

    this.modelContext = modelContext;

    this.modelNamespace = this.modelContext.modelNamespace;
    this.namespace = joinLastString(this.modelNamespace, this.containerKey);

    this.modelInstance = this._createModelInstance();

    this.selectors = this.modelInstance.selectors();
    this.reducers = this.modelInstance.reducers();
    this.effects = this.modelInstance.effects();
    this.epics = this.modelInstance.epics();
    this.reducerByPath = flattenObject(this.reducers);
    this.effectByPath = flattenObject(this.effects);
  }

  public get state(): ExtractModelState<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.state;
    }

    if (this.isRegistered) {
      const rootState = this._nyaxContext.getRootState();
      if (this._lastRootState === rootState) {
        return this._lastState as ExtractModelState<TModel>;
      }

      const state = getSubState(
        rootState,
        this.modelContext.modelPath,
        this.containerKey
      );

      this._lastRootState = rootState;
      this._lastState = state;

      return state as ExtractModelState<TModel>;
    }

    if (this.canRegister) {
      if (this._initialStateCache === undefined) {
        this._initialStateCache = createState(
          this,
          createArgs(this, undefined, true)
        );
      }
      return this._initialStateCache as ExtractModelState<TModel>;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get getters(): ExtractModelGetters<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.getters;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._gettersCache === undefined) {
        this._gettersCache = createGetters(this);
      }

      return this._gettersCache as ExtractModelGetters<TModel>;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get actions(): ExtractModelActionHelpers<TModel> {
    const container = this._currentContainer;
    if (container !== this) {
      return container.actions;
    }

    if (this.isRegistered || this.canRegister) {
      if (this._actionsCache === undefined) {
        this._actionsCache = createActionHelpers(this._nyaxContext, this);
      }

      return this._actionsCache as ExtractModelActionHelpers<TModel>;
    }

    throw new Error("Namespace is already bound by other container");
  }

  public get isRegistered(): boolean {
    const container = this._nyaxContext.containerByNamespace.get(
      this.namespace
    );
    return container?.model === this.model;
  }

  public get canRegister(): boolean {
    return !this._nyaxContext.containerByNamespace.has(this.namespace);
  }

  public register(
    args?: ConvertRegisterArgs<ExtractModelDefaultArgs<TModel>>
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
      this.model,
      this.containerKey
    ) as this;
  }

  private _createModelInstance(): InstanceType<TModel> {
    const modelInstance = new this.model() as ModelBase;
    modelInstance.__nyaxContext = this._nyaxContext;
    modelInstance.__container = this;
    return modelInstance as InstanceType<TModel>;
  }
}

export interface GetContainer {
  <TModel extends ModelInstanceConstructor & { isDynamic?: false }>(
    modelOrModelNamespace: TModel | string
  ): Container<TModel>;
  <TModel extends ModelInstanceConstructor & { isDynamic: true }>(
    modelOrModelNamespace: TModel | string,
    containerKey: string
  ): Container<TModel>;
}

export interface GetContainerInternal {
  <TModel extends Model>(
    modelOrModelNamespace: TModel | string,
    containerKey?: string
  ): ContainerImpl<TModel>;
}

export function createGetContainer(
  nyaxContext: NyaxContext
): GetContainerInternal {
  return <TModel extends Model>(
    modelOrModelNamespace: TModel | string,
    containerKey?: string
  ): ContainerImpl<TModel> => {
    let model: TModel;
    if (typeof modelOrModelNamespace === "string") {
      model = nyaxContext.modelByModelNamespace.get(
        modelOrModelNamespace
      ) as TModel;
      if (!model) {
        throw new Error("Model namespace is not bound");
      }
    } else {
      model = modelOrModelNamespace;
    }

    const modelContext = nyaxContext.modelContextByModel.get(model);
    if (!modelContext) {
      throw new Error("Model is not registered");
    }

    if (containerKey === undefined && model.isDynamic) {
      throw new Error("Container key is required for dynamic model");
    }

    if (containerKey !== undefined && !model.isDynamic) {
      throw new Error("Container key is not available for static model");
    }

    let container = modelContext.containerByContainerKey.get(
      containerKey
    ) as ContainerImpl<TModel>;
    if (!container) {
      container = new ContainerImpl(nyaxContext, model, containerKey);
      modelContext.containerByContainerKey.set(containerKey, container);
    }

    return container;
  };
}

export function createSubContainer<
  TContainer extends ContainerBase<any, any, any>,
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
