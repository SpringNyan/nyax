import {
  createActionHelpers,
  registerActionHelper,
  unregisterActionHelper,
} from "./action";
import { NYAX_NOTHING } from "./common";
import { ModelContext, NyaxContext } from "./context";
import { ModelEffect } from "./effect";
import {
  ExtractModelActionHelpers,
  ExtractModelEffects,
  ExtractModelEpics,
  ExtractModelGetters,
  ExtractModelReducers,
  ExtractModelSelectors,
  ExtractModelState,
  ModelBase,
  ModelInstanceConstructor,
  StaticModel,
} from "./model";
import { ModelReducer } from "./reducer";
import { createGetters } from "./selector";
import { createState, getSubState } from "./state";
import { concatLastString, flattenObject } from "./util";

export interface ContainerBase<
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

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ContainerCore<TModel extends StaticModel = StaticModel>
  extends ContainerBase<
    ExtractModelState<TModel>,
    ExtractModelGetters<TModel>,
    ExtractModelActionHelpers<TModel>
  > {}

export interface Container<TModel extends StaticModel = StaticModel>
  extends ContainerCore<TModel> {
  modelNamespace: string;
  containerKey: string | undefined;

  isRegistered: boolean;
  canRegister: boolean;

  register(): void;
  unregister(): void;
}

export class ContainerImpl<TModel extends StaticModel = StaticModel>
  implements Container<TModel> {
  public readonly modelContext: ModelContext;

  public readonly modelNamespace: string;
  public readonly namespace: string;

  public readonly modelInstance: InstanceType<TModel>;

  public readonly selectors: ExtractModelSelectors<TModel>;
  public readonly reducers: ExtractModelReducers<TModel>;
  public readonly effects: ExtractModelEffects<TModel>;
  public readonly epics: ExtractModelEpics<TModel>;

  public readonly reducerByPath: Record<string, ModelReducer>;
  public readonly effectByPath: Record<string, ModelEffect>;

  public draftState:
    | ExtractModelState<TModel>
    | typeof NYAX_NOTHING = NYAX_NOTHING;

  private _lastRootState: unknown;
  private _lastState: unknown;

  private _initialStateCache: unknown;
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
    this.namespace = concatLastString(this.modelNamespace, this.containerKey);

    this.modelInstance = this._createModelInstance();

    this.selectors = this.modelInstance.selectors() as ExtractModelSelectors<TModel>;
    this.reducers = this.modelInstance.reducers() as ExtractModelReducers<TModel>;
    this.effects = this.modelInstance.effects() as ExtractModelEffects<TModel>;
    this.epics = this.modelInstance.epics() as ExtractModelEpics<TModel>;

    this.reducerByPath = flattenObject<ModelReducer>(this.reducers);
    this.effectByPath = flattenObject<ModelEffect>(this.effects);
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
        this._initialStateCache = createState(this);
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

  public register(): void {
    if (!this.canRegister) {
      throw new Error("Namespace is already bound");
    }

    this._nyaxContext.store.dispatch(
      registerActionHelper.create([
        {
          namespace: this.modelNamespace,
          key: this.containerKey,
        },
      ])
    );
  }

  public unregister(): void {
    if (this.isRegistered) {
      this._nyaxContext.store.dispatch(
        unregisterActionHelper.create([
          {
            namespace: this.modelNamespace,
            key: this.containerKey,
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
    modelInstance.__nyax_nyaxContext = this._nyaxContext;
    modelInstance.__nyax_container = this;
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
  <TModel extends StaticModel>(
    modelOrModelNamespace: TModel | string,
    containerKey?: string
  ): ContainerImpl<TModel>;
}

export function createGetContainer(
  nyaxContext: NyaxContext
): GetContainerInternal {
  return <TModel extends StaticModel>(
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
