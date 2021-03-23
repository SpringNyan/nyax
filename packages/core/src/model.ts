import { ConvertActionHelpers, RegisterActionPayload } from "./action";
import { NYAX_NOTHING } from "./common";
import { ContainerImpl } from "./container";
import { NyaxContext } from "./context";
import { ModelEffect, ModelEffects } from "./effect";
import { ModelReducer, ModelReducers } from "./reducer";
import { ConvertGetters, ModelSelectors } from "./selector";
import { ConvertState, ModelInitialState } from "./state";
import { Nyax } from "./store";
import {
  convertNamespaceToPath,
  defineGetter,
  flattenObject,
  joinLastString,
  mergeObjects,
  Spread,
  traverseObject,
  UnionToIntersection,
} from "./util";

export interface ModelDefinition<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  initialState(): TInitialState;
  selectors(): TSelectors;
  reducers(): TReducers;
  effects(): TEffects;
  subscriptions(): TSubscriptions;

  dependencies: TDependencies;
  state: ConvertState<ReturnType<this["initialState"]>>;
  getters: ConvertGetters<ReturnType<this["selectors"]>>;
  actions: ConvertActionHelpers<
    ReturnType<this["reducers"]>,
    ReturnType<this["effects"]>
  >;

  namespace: string;
  key: string | undefined;

  nyax: Nyax;
}

export type ModelDefinitionConstructor<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
  /* eslint-enable @typescript-eslint/ban-types */
> = new () => ModelDefinition<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions
>;

export interface ModelOptions {
  autoRegister: boolean;
}

export interface ModelDefinitionStatic<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
  /* eslint-enable @typescript-eslint/ban-types */
> extends ModelDefinitionConstructor<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  > {
  namespace: string;
  options: ModelOptions;
}

export type ExtractModelInitialState<
  TModel extends ModelDefinitionConstructor
> = ReturnType<InstanceType<TModel>["initialState"]>;

export type ExtractModelSelectors<
  TModel extends ModelDefinitionConstructor
> = ReturnType<InstanceType<TModel>["selectors"]>;

export type ExtractModelReducers<
  TModel extends ModelDefinitionConstructor
> = ReturnType<InstanceType<TModel>["reducers"]>;

export type ExtractModelEffects<
  TModel extends ModelDefinitionConstructor
> = ReturnType<InstanceType<TModel>["effects"]>;

export type ExtractModelSubscriptions<
  TModel extends ModelDefinitionConstructor
> = ReturnType<InstanceType<TModel>["subscriptions"]>;

export type ExtractModelDependencies<
  TModel extends ModelDefinitionConstructor
> = InstanceType<TModel>["dependencies"];

export type ExtractModelState<
  TModel extends ModelDefinitionConstructor
> = InstanceType<TModel>["state"];

export type ExtractModelGetters<
  TModel extends ModelDefinitionConstructor
> = InstanceType<TModel>["getters"];

export type ExtractModelActionHelpers<
  TModel extends ModelDefinitionConstructor
> = InstanceType<TModel>["actions"];

export type MergeModelsDependencies<
  TModels extends ModelDefinitionConstructor[]
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ExtractModelDependencies<TModels[K]>;
  }[number]
>;

export type MergeSubModelsDependencies<
  TSubModels extends Record<string, ModelDefinitionConstructor>
> = UnionToIntersection<
  {
    [K in keyof TSubModels]: ExtractModelDependencies<TSubModels[K]>;
  }[keyof TSubModels]
>;

export type ModelDefinitionKey =
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "subscriptions";

export type MergeModelsDefinitions<
  TModels extends ModelDefinitionConstructor[],
  TDefinitionKey extends ModelDefinitionKey
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ReturnType<
      InstanceType<TModels[K]>[TDefinitionKey]
    >;
  }[number]
>;

export type MergeSubModelsDefinitions<
  TSubModels extends Record<string, ModelDefinitionConstructor>,
  TDefinitionKey extends ModelDefinitionKey
> = Spread<
  {
    [K in keyof TSubModels]: ReturnType<
      InstanceType<TSubModels[K]>[TDefinitionKey]
    >;
  }
>;

export interface ModelInstance<
  TModel extends ModelDefinitionConstructor = ModelDefinitionConstructor
> {
  state: ExtractModelState<TModel>;
  getters: ExtractModelGetters<TModel>;
  actions: ExtractModelActionHelpers<TModel>;

  namespace: string;
  key: string | undefined;
  fullNamespace: string;

  isRegistered: boolean;

  register(): void;
  unregister(): void;
}

export class ModelInstanceImpl<
  TModel extends ModelDefinitionConstructor = ModelDefinitionConstructor
> implements ModelInstance<TModel> {
  public readonly namespace: string;
  public readonly key: string | undefined;
  public readonly fullNamespace: string;

  public readonly initialState: ExtractModelInitialState<TModel>;
  public readonly selectors: ExtractModelSelectors<TModel>;
  public readonly reducers: ExtractModelReducers<TModel>;
  public readonly effects: ExtractModelEffects<TModel>;
  public readonly subscriptions: ExtractModelSubscriptions<TModel>;

  public readonly flattenedReducers: Record<string, ModelReducer>;
  public readonly flattenedEffects: Record<string, ModelEffect>;

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
    modelDefinitionCtor: TModel & { namespace: string },
    key: string | undefined
  ) {
    this.namespace = modelDefinitionCtor.namespace;
    this.key = key;
    this.fullNamespace = joinLastString(this.namespace, this.key);

    const modelDefinition = new modelDefinitionCtor();
    // TODO

    this.initialState = modelDefinition.initialState() as ExtractModelInitialState<TModel>;
    this.selectors = modelDefinition.selectors() as ExtractModelSelectors<TModel>;
    this.reducers = modelDefinition.reducers() as ExtractModelReducers<TModel>;
    this.effects = modelDefinition.effects() as ExtractModelEffects<TModel>;
    this.subscriptions = modelDefinition.subscriptions() as ExtractModelSubscriptions<TModel>;

    this.flattenedReducers = flattenObject<ModelReducer>(this.reducers);
    this.flattenedEffects = flattenObject<ModelEffect>(this.effects);
  }

  //  ok

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
    return container?.model === this.modelDefinition;
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
      this.modelDefinition,
      this.containerKey
    ) as this;
  }

  private _createModelInstance(): InstanceType<TModel> {
    const modelInstance = new this.modelDefinition() as ModelBase;
    modelInstance.__nyax_nyaxContext = this._nyaxContext;
    modelInstance.__nyax_container = this;
    return modelInstance as InstanceType<TModel>;
  }
}

export class ModelBase<TDependencies = unknown>
  implements
    ModelDefinition<
      /* eslint-disable @typescript-eslint/ban-types */
      TDependencies,
      {},
      {},
      {},
      {},
      {}
      /* eslint-enable @typescript-eslint/ban-types */
    > {
  public __nyax_nyaxContext!: NyaxContext;
  public __nyax_container!: Pick<
    ContainerImpl<any>,
    | "draftState"
    | "state"
    | "getters"
    | "actions"
    | "modelNamespace"
    | "containerKey"
  >;

  public initialState(): any {
    return {};
  }
  public selectors(): any {
    return {};
  }
  public reducers(): any {
    return {};
  }
  public effects(): any {
    return {};
  }
  public epics(): any {
    return {};
  }

  public get dependencies(): any {
    return this.__nyax_nyaxContext.dependencies;
  }
  public get state(): any {
    const draftState = this.__nyax_container.draftState;
    return draftState !== NYAX_NOTHING
      ? draftState
      : this.__nyax_container.state;
  }
  public get getters(): any {
    return this.__nyax_container.getters;
  }
  public get actions(): any {
    return this.__nyax_container.actions;
  }

  public get rootAction$(): any {
    return this.__nyax_nyaxContext.rootAction$;
  }
  public get rootState$(): any {
    return this.__nyax_nyaxContext.rootState$;
  }

  public get modelNamespace(): any {
    return this.__nyax_container.modelNamespace;
  }
  public get containerKey(): any {
    return this.__nyax_container.containerKey;
  }

  public get nyax(): any {
    return this.__nyax_nyaxContext.nyax;
  }
  public get getContainer(): any {
    return this.__nyax_nyaxContext.getContainer;
  }
}

export function mergeModels<TModels extends StaticModel[] | [StaticModel]>(
  ...models: TModels
): ModelInstanceConstructor<
  MergeModelsDependencies<TModels>,
  MergeModelsDefinitions<TModels, "initialState">,
  MergeModelsDefinitions<TModels, "selectors">,
  MergeModelsDefinitions<TModels, "reducers">,
  MergeModelsDefinitions<TModels, "effects">,
  MergeModelsDefinitions<TModels, "epics">
> {
  return class extends ModelBase {
    private readonly __nyax_modelInstances = models.map((model) => {
      const modelInstance = new model() as ModelBase;
      defineGetter(
        modelInstance,
        "__nyax_nyaxContext",
        () => this.__nyax_nyaxContext
      );
      defineGetter(
        modelInstance,
        "__nyax_container",
        () => this.__nyax_container
      );
      return modelInstance;
    });

    public initialState(): any {
      return this._mergeProperty("initialState");
    }

    public selectors(): any {
      return this._mergeProperty("selectors");
    }

    public reducers(): any {
      return this._mergeProperty("reducers");
    }

    public effects(): any {
      return this._mergeProperty("effects");
    }

    public epics(): any {
      return this._mergeProperty("epics");
    }

    private _mergeProperty<TPropertyKey extends ModelDefinitionKey>(
      propertyKey: TPropertyKey
    ): ReturnType<ModelDefinition[TPropertyKey]> {
      const result = {} as ReturnType<ModelDefinition[TPropertyKey]>;

      this.__nyax_modelInstances
        .map((modelInstance) => modelInstance[propertyKey]())
        .forEach((property) => {
          mergeObjects(result, property);
        });

      return result;
    }
  };
}

export function mergeSubModels<TSubModels extends Record<string, StaticModel>>(
  subModels: TSubModels
): ModelInstanceConstructor<
  MergeSubModelsDependencies<TSubModels>,
  MergeSubModelsDefinitions<TSubModels, "initialState">,
  MergeSubModelsDefinitions<TSubModels, "selectors">,
  MergeSubModelsDefinitions<TSubModels, "reducers">,
  MergeSubModelsDefinitions<TSubModels, "effects">,
  MergeSubModelsDefinitions<TSubModels, "epics">
> {
  return class extends ModelBase {
    private readonly __nyax_subModelInstances = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return Object.keys(subModels).reduce<Record<string, ModelBase>>(
        (obj, key) => {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const modelInstance = new subModels[key]!() as ModelBase;

          defineGetter(
            modelInstance,
            "__nyax_nyaxContext",
            () => self.__nyax_nyaxContext
          );

          const container = {
            get draftState(): any {
              const draftState = self.__nyax_container.draftState;
              return draftState !== NYAX_NOTHING
                ? draftState[key]
                : NYAX_NOTHING;
            },
            get state(): any {
              return self.__nyax_container.state[key];
            },
            get getters(): any {
              return self.__nyax_container.getters[key];
            },
            get actions(): any {
              return self.__nyax_container.actions[key];
            },
            get modelNamespace(): any {
              return self.__nyax_container.modelNamespace;
            },
            get containerKey(): any {
              return self.__nyax_container.containerKey;
            },
          };
          defineGetter(modelInstance, "__nyax_container", () => container);

          obj[key] = modelInstance;
          return obj;
        },
        {}
      );
    })();

    public initialState(): any {
      return this._mergeSubProperty("initialState");
    }

    public selectors(): any {
      return this._mergeSubProperty("selectors");
    }

    public reducers(): any {
      return this._mergeSubProperty("reducers");
    }

    public effects(): any {
      return this._mergeSubProperty("effects");
    }

    public epics(): any {
      return this._mergeSubProperty("epics");
    }

    private _mergeSubProperty<TPropertyKey extends ModelDefinitionKey>(
      propertyKey: TPropertyKey
    ): Record<string, ReturnType<ModelDefinition[TPropertyKey]>> {
      const result: Record<string, any> = {};
      Object.keys(this.__nyax_subModelInstances).forEach((key) => {
        result[key] = this.__nyax_subModelInstances[key]?.[propertyKey]();
      });
      return result;
    }
  };
}

export function createModelBase<TDependencies>(): ModelInstanceConstructor<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies,
  {},
  {},
  {},
  {},
  {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  return class extends ModelBase<TDependencies> {};
}

export function createModel<
  TDependencies,
  TInitialState extends ModelInitialState,
  TSelectors extends ModelSelectors,
  TReducers extends ModelReducers,
  TEffects extends ModelEffects,
  TEpics extends ModelEpics,
  // eslint-disable-next-line @typescript-eslint/ban-types
  TOptions extends ModelOptions = {}
>(
  model: StaticModel<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TEpics
  >,
  options?: TOptions
): ModelInstanceConstructor<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TEpics
> &
  Spread<Pick<TOptions, Extract<keyof TOptions, keyof ModelOptions>>> {
  const Model = class extends ModelBase {
    private readonly __nyax_modelInstance = (() => {
      const modelInstance = new model() as ModelBase;
      defineGetter(
        modelInstance,
        "__nyax_nyaxContext",
        () => this.__nyax_nyaxContext
      );
      defineGetter(
        modelInstance,
        "__nyax_container",
        () => this.__nyax_container
      );
      return modelInstance;
    })();

    public initialState(): any {
      return this.__nyax_modelInstance.initialState();
    }

    public selectors(): any {
      return this.__nyax_modelInstance.selectors();
    }

    public reducers(): any {
      return this.__nyax_modelInstance.reducers();
    }

    public effects(): any {
      return this.__nyax_modelInstance.effects();
    }

    public epics(): any {
      return this.__nyax_modelInstance.epics();
    }
  } as StaticModel;

  if (options) {
    Model.isDynamic = options.isDynamic;
    Model.isLazy = options.isLazy;
  }
  return Model as ModelInstanceConstructor<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TEpics
  > &
    Spread<Pick<TOptions, Extract<keyof TOptions, keyof ModelOptions>>>;
}

export function registerModel<TModel extends StaticModel>(
  nyaxContext: NyaxContext,
  modelNamespace: string,
  model: TModel
): void {
  if (nyaxContext.modelContextByModel.has(model)) {
    throw new Error("Model is already registered");
  }

  if (nyaxContext.modelByModelNamespace.has(modelNamespace)) {
    throw new Error("Model namespace is already bound");
  }

  nyaxContext.modelContextByModel.set(model, {
    modelNamespace,
    modelPath: convertNamespaceToPath(modelNamespace),

    containerByContainerKey: new Map(),
  });

  nyaxContext.modelByModelNamespace.set(modelNamespace, model);
}

export function registerModels(
  nyaxContext: NyaxContext,
  models: Models
): RegisterActionPayload[] {
  const registerActionPayloads: RegisterActionPayload[] = [];

  traverseObject(models, (item, key, parent, paths) => {
    const modelNamespace = paths.join("/");
    const model = item as Exclude<typeof item, Models>;

    registerModel(nyaxContext, modelNamespace, model);
    if (!model.isDynamic && !model.isLazy) {
      registerActionPayloads.push({
        namespace: modelNamespace,
      });
    }
  });

  return registerActionPayloads;
}

export function flattenModels(models: Models): Record<string, StaticModel> {
  return flattenObject(models, "/") as Record<string, StaticModel>;
}
