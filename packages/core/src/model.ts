import {
  ConvertActionHelpers,
  createActionHelpers,
  registerActionHelper,
  RegisterActionPayload,
  unregisterActionHelper,
} from "./action";
import { NyaxContext } from "./context";
import { Effects } from "./effect";
import { Reducers } from "./reducer";
import { ConvertGetters, createGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";
import { Nyax } from "./store";
import { Subscriptions } from "./subscription";
import {
  defineGetter,
  flattenObject,
  mergeObjects,
  Spread,
  traverseObject,
  UnionToIntersection,
} from "./util";

export interface ModelDefinitionInstance<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  initialState: TInitialState;
  selectors: TSelectors;
  reducers: TReducers;
  effects: TEffects;
  subscriptions: TSubscriptions;

  dependencies: TDependencies;
  state: ConvertState<this["initialState"]>;
  getters: ConvertGetters<this["selectors"]>;
  actions: ConvertActionHelpers<this["reducers"], this["effects"]>;

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
> = new () => ModelDefinitionInstance<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions
>;

export interface ModelDefinition<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {},
  TDynamic = boolean
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
  dynamic: TDynamic;
}

export type ModelDefinitionPropertyKey =
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "subscriptions"
  | "dependencies"
  | "state"
  | "getters"
  | "actions";

export type ExtractModelDefinitionProperty<
  TModelDefinition extends ModelDefinitionConstructor,
  TPropertyKey extends ModelDefinitionPropertyKey
> = InstanceType<TModelDefinition>[TPropertyKey];

export type MergeModelDefinitionsProperty<
  TModelDefinitions extends ModelDefinitionConstructor[],
  TPropertyKey extends ModelDefinitionPropertyKey
> = UnionToIntersection<
  {
    [K in keyof TModelDefinitions & number]: InstanceType<
      TModelDefinitions[K]
    >[TPropertyKey];
  }[number]
>;

export type MergeSubModelDefinitionsProperty<
  TSubModelDefinitions extends Record<string, ModelDefinitionConstructor>,
  TPropertyKey extends ModelDefinitionPropertyKey
> = Spread<
  {
    [K in keyof TSubModelDefinitions]: InstanceType<
      TSubModelDefinitions[K]
    >[TPropertyKey];
  }
>;

export type MergeModelDefinitionsDependencies<
  TModelDefinitions extends ModelDefinitionConstructor[]
> = MergeModelDefinitionsProperty<TModelDefinitions, "dependencies">;

export type MergeSubModelDefinitionsDependencies<
  TSubModelDefinitions extends Record<string, ModelDefinitionConstructor>
> = UnionToIntersection<
  MergeSubModelDefinitionsProperty<
    TSubModelDefinitions,
    "dependencies"
  >[keyof TSubModelDefinitions]
>;

export interface ModelInstance<
  TModelDefinition extends ModelDefinitionConstructor = ModelDefinitionConstructor
> {
  state: ExtractModelDefinitionProperty<TModelDefinition, "state">;
  getters: ExtractModelDefinitionProperty<TModelDefinition, "getters">;
  actions: ExtractModelDefinitionProperty<TModelDefinition, "actions">;

  modelDefinition: TModelDefinition;

  namespace: string;
  key: string | undefined;

  isRegistered: boolean;

  register(): void;
  unregister(): void;
}

export class ModelInstanceImpl<
  TModelDefinition extends ModelDefinition = ModelDefinition
> implements ModelInstance<TModelDefinition> {
  public readonly modelDefinition: TModelDefinition;

  public readonly namespace: string;
  public readonly key: string | undefined;

  private readonly _modelDefinitionInstance: InstanceType<TModelDefinition>;
  private readonly _getters: ExtractModelDefinitionProperty<
    TModelDefinition,
    "getters"
  >;
  private readonly _actions: ExtractModelDefinitionProperty<
    TModelDefinition,
    "actions"
  >;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    modelDefinition: TModelDefinition,
    key: string | undefined
  ) {
    this.modelDefinition = modelDefinition;

    this.namespace = modelDefinition.namespace;
    this.key = key;

    this._modelDefinitionInstance = new modelDefinition() as InstanceType<TModelDefinition>;
    this._getters = createGetters(
      this._nyaxContext,
      this._modelDefinitionInstance
    );
    this._actions = createActionHelpers(
      this._nyaxContext,
      this._modelDefinitionInstance
    );
  }

  public get isRegistered(): boolean {
    return this._getState() != null;
  }

  public get state(): ExtractModelDefinitionProperty<
    TModelDefinition,
    "state"
  > {
    const state = this._getState();
    return state != null ? state : this._modelDefinitionInstance.initialState;
  }

  public get getters(): ExtractModelDefinitionProperty<
    TModelDefinition,
    "getters"
  > {
    return this._getters;
  }

  public get actions(): ExtractModelDefinitionProperty<
    TModelDefinition,
    "actions"
  > {
    return this._actions;
  }

  public register(): void {
    if (this.isRegistered) {
      throw new Error("Model is already registered.");
    }

    this._nyaxContext.store.dispatch(
      registerActionHelper.create([
        {
          namespace: this.namespace,
          key: this.key,
        },
      ])
    );
  }

  public unregister(): void {
    if (this.isRegistered) {
      this._nyaxContext.store.dispatch(
        unregisterActionHelper.create([
          {
            namespace: this.namespace,
            key: this.key,
          },
        ])
      );
    }
  }

  private _getState():
    | ExtractModelDefinitionProperty<TModelDefinition, "state">
    | undefined {
    let state = this._nyaxContext.store.getState();
    state = (state as Record<string, unknown> | undefined)?.[this.namespace];
    if (this.key != null) {
      state = (state as Record<string, unknown> | undefined)?.[this.key];
    }
    return state as
      | ExtractModelDefinitionProperty<TModelDefinition, "state">
      | undefined;
  }
}

export class ModelDefinitionBase<TDependencies = unknown>
  implements
    ModelDefinitionInstance<
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
  public __nyax_modelInstance!: ModelInstance;

  public initialState: any = {};
  public selectors: any = {};
  public reducers: any = {};
  public effects: any = {};
  public subscriptions: any = {};

  public get dependencies(): any {
    return this.__nyax_nyaxContext.dependencies;
  }
  public get state(): any {
    return this.__nyax_modelInstance.state;
  }
  public get getters(): any {
    return this.__nyax_modelInstance.getters;
  }
  public get actions(): any {
    return this.__nyax_modelInstance.actions;
  }

  public get namespace(): any {
    return this.__nyax_modelInstance.namespace;
  }
  public get key(): any {
    return this.__nyax_modelInstance.key;
  }

  public get nyax(): any {
    return this.__nyax_nyaxContext.nyax;
  }
}

export function mergeModelDefinitions<
  TModelDefinitions extends
    | ModelDefinitionConstructor[]
    | [ModelDefinitionConstructor]
>(
  ...models: TModelDefinitions
): ModelDefinitionConstructor<
  MergeModelDefinitionsDependencies<TModelDefinitions>,
  MergeModelDefinitionsProperty<TModelDefinitions, "initialState">,
  MergeModelDefinitionsProperty<TModelDefinitions, "selectors">,
  MergeModelDefinitionsProperty<TModelDefinitions, "reducers">,
  MergeModelDefinitionsProperty<TModelDefinitions, "effects">,
  MergeModelDefinitionsProperty<TModelDefinitions, "subscriptions">
> {
  return class extends ModelDefinitionBase {
    private readonly __nyax_modelDefinitionInstances = models.map((model) => {
      const modelDefinitionInstance = new model() as ModelDefinitionBase;
      defineGetter(
        modelDefinitionInstance,
        "__nyax_nyaxContext",
        () => this.__nyax_nyaxContext
      );
      defineGetter(
        modelDefinitionInstance,
        "__nyax_modelInstance",
        () => this.__nyax_modelInstance
      );
      return modelDefinitionInstance;
    });

    public initialState: any = this._mergeProperty("initialState");
    public selectors: any = this._mergeProperty("selectors");
    public reducers: any = this._mergeProperty("reducers");
    public effects: any = this._mergeProperty("effects");
    public subscriptions: any = this._mergeProperty("subscriptions");

    private _mergeProperty<TPropertyKey extends ModelDefinitionPropertyKey>(
      propertyKey: TPropertyKey
    ): any {
      const result: Record<string, unknown> = {};

      this.__nyax_modelDefinitionInstances
        .map((modelDefinitionInstance) => modelDefinitionInstance[propertyKey])
        .forEach((property) => {
          mergeObjects(result, property);
        });

      return result;
    }
  };
}

export function mergeSubModelDefinitions<
  TSubModelDefinitions extends Record<string, ModelDefinitionConstructor>
>(
  subModelDefinitions: TSubModelDefinitions
): ModelDefinitionConstructor<
  MergeSubModelDefinitionsDependencies<TSubModelDefinitions>,
  MergeSubModelDefinitionsProperty<TSubModelDefinitions, "initialState">,
  MergeSubModelDefinitionsProperty<TSubModelDefinitions, "selectors">,
  MergeSubModelDefinitionsProperty<TSubModelDefinitions, "reducers">,
  MergeSubModelDefinitionsProperty<TSubModelDefinitions, "effects">,
  MergeSubModelDefinitionsProperty<TSubModelDefinitions, "subscriptions">
> {
  return class extends ModelDefinitionBase {
    private readonly __nyax_subModelDefinitionInstances = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      const subModelDefinitionInstances: Record<
        string,
        ModelDefinitionBase
      > = {};
      Object.keys(subModelDefinitions).forEach((key) => {
        const subModelDefinition = subModelDefinitions[key];
        if (subModelDefinition) {
          const subModelDefinitionInstance = new subModelDefinition() as ModelDefinitionBase;

          defineGetter(
            subModelDefinitionInstance,
            "__nyax_nyaxContext",
            () => self.__nyax_nyaxContext
          );

          const subModelInstance: ModelInstance = {
            get state(): any {
              return (self.__nyax_modelInstance.state as
                | Record<string, unknown>
                | undefined)?.[key];
            },
            get getters(): any {
              return (self.__nyax_modelInstance.getters as
                | Record<string, unknown>
                | undefined)?.[key];
            },
            get actions(): any {
              return (self.__nyax_modelInstance.actions as
                | Record<string, unknown>
                | undefined)?.[key];
            },

            get modelDefinition(): any {
              return subModelDefinition;
            },

            get namespace(): any {
              return self.__nyax_modelInstance.namespace;
            },
            get key(): any {
              return self.__nyax_modelInstance.key;
            },

            get isRegistered(): any {
              return self.__nyax_modelInstance.isRegistered;
            },

            register() {
              throw new Error("Unsupported");
            },
            unregister() {
              throw new Error("Unsupported");
            },
          };
          defineGetter(
            subModelDefinitionInstance,
            "__nyax_modelInstance",
            () => subModelInstance
          );

          subModelDefinitionInstances[key] = subModelDefinitionInstance;
        }
      });

      return subModelDefinitionInstances;
    })();

    public initialState: any = this._mergeSubProperty("initialState");
    public selectors: any = this._mergeSubProperty("selectors");
    public reducers: any = this._mergeSubProperty("reducers");
    public effects: any = this._mergeSubProperty("effects");
    public subscriptions: any = this._mergeSubProperty("subscriptions");

    private _mergeSubProperty<TPropertyKey extends ModelDefinitionPropertyKey>(
      propertyKey: TPropertyKey
    ): Record<string, ModelDefinitionInstance[TPropertyKey]> {
      const result: Record<string, any> = {};

      Object.keys(this.__nyax_subModelDefinitionInstances).forEach((key) => {
        result[key] = this.__nyax_subModelDefinitionInstances[key]?.[
          propertyKey
        ];
      });

      return result;
    }
  };
}

export function createModelDefinitionBase<
  TDependencies
>(): ModelDefinitionConstructor<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies,
  {},
  {},
  {},
  {},
  {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  return class extends ModelDefinitionBase<TDependencies> {};
}

export function createModelDefinition<
  TDependencies,
  TInitialState extends InitialState,
  TSelectors extends Selectors,
  TReducers extends Reducers,
  TEffects extends Effects,
  TSubscriptions extends Subscriptions,
  TDynamic extends boolean = false
  // eslint-disable-next-line @typescript-eslint/ban-types
>(
  namespace: string,
  model: ModelDefinitionConstructor<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >,
  dynamic?: TDynamic
): ModelDefinition<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions,
  TDynamic
> {
  return class extends model {
    public static namespace = namespace;
    public static dynamic = (dynamic ?? false) as TDynamic;
  };
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
