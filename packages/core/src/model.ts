import {
  ConvertActionHelpers,
  createActionHelpers,
  registerActionHelper,
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
  mergeObjects,
  Spread,
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

  getModel: GetModel;
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

export interface ModelDefinitionClass<
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
  TModelDefinitionConstructor extends ModelDefinitionConstructor,
  TPropertyKey extends ModelDefinitionPropertyKey
> = InstanceType<TModelDefinitionConstructor>[TPropertyKey];

export type MergeModelDefinitionsProperty<
  TModelDefinitionConstructors extends ModelDefinitionConstructor[],
  TPropertyKey extends ModelDefinitionPropertyKey
> = UnionToIntersection<
  {
    [K in keyof TModelDefinitionConstructors & number]: InstanceType<
      TModelDefinitionConstructors[K]
    >[TPropertyKey];
  }[number]
>;

export type MergeSubModelDefinitionsProperty<
  TSubModelDefinitionConstructors extends Record<
    string,
    ModelDefinitionConstructor
  >,
  TPropertyKey extends ModelDefinitionPropertyKey
> = Spread<
  {
    [K in keyof TSubModelDefinitionConstructors]: InstanceType<
      TSubModelDefinitionConstructors[K]
    >[TPropertyKey];
  }
>;

export type MergeModelDefinitionsDependencies<
  TModelDefinitionConstructors extends ModelDefinitionConstructor[]
> = MergeModelDefinitionsProperty<TModelDefinitionConstructors, "dependencies">;

export type MergeSubModelDefinitionsDependencies<
  TSubModelDefinitionConstructors extends Record<
    string,
    ModelDefinitionConstructor
  >
> = UnionToIntersection<
  MergeSubModelDefinitionsProperty<
    TSubModelDefinitionConstructors,
    "dependencies"
  >[keyof TSubModelDefinitionConstructors]
>;

export class ModelDefinitionBase<TDependencies = unknown>
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
  public __nyax_model!: Model;

  public initialState: any = {};
  public selectors: any = {};
  public reducers: any = {};
  public effects: any = {};
  public subscriptions: any = {};

  public get dependencies(): any {
    return this.__nyax_nyaxContext.dependencies;
  }
  public get state(): any {
    return this.__nyax_model.state;
  }
  public get getters(): any {
    return this.__nyax_model.getters;
  }
  public get actions(): any {
    return this.__nyax_model.actions;
  }

  public get namespace(): any {
    return this.__nyax_model.namespace;
  }
  public get key(): any {
    return this.__nyax_model.key;
  }

  public get getModel(): any {
    return this.__nyax_nyaxContext.nyax.getModel;
  }
  public get nyax(): any {
    return this.__nyax_nyaxContext.nyax;
  }
}

export function mergeModelDefinitionClasses<
  TModelDefinitionConstructors extends
    | ModelDefinitionConstructor[]
    | [ModelDefinitionConstructor]
>(
  ...modelDefinitionClasses: TModelDefinitionConstructors
): ModelDefinitionConstructor<
  MergeModelDefinitionsDependencies<TModelDefinitionConstructors>,
  MergeModelDefinitionsProperty<TModelDefinitionConstructors, "initialState">,
  MergeModelDefinitionsProperty<TModelDefinitionConstructors, "selectors">,
  MergeModelDefinitionsProperty<TModelDefinitionConstructors, "reducers">,
  MergeModelDefinitionsProperty<TModelDefinitionConstructors, "effects">,
  MergeModelDefinitionsProperty<TModelDefinitionConstructors, "subscriptions">
> {
  return class extends ModelDefinitionBase {
    private readonly __nyax_modelDefinitions = modelDefinitionClasses.map(
      (modelDefinitionClass) => {
        const modelDefinition = new modelDefinitionClass() as ModelDefinitionBase;
        defineGetter(
          modelDefinition,
          "__nyax_nyaxContext",
          () => this.__nyax_nyaxContext
        );
        defineGetter(modelDefinition, "__nyax_model", () => this.__nyax_model);
        return modelDefinition;
      }
    );

    public initialState: any = this._mergeProperty("initialState");
    public selectors: any = this._mergeProperty("selectors");
    public reducers: any = this._mergeProperty("reducers");
    public effects: any = this._mergeProperty("effects");
    public subscriptions: any = this._mergeProperty("subscriptions");

    private _mergeProperty(propertyKey: ModelDefinitionPropertyKey): any {
      const result: Record<string, unknown> = {};

      this.__nyax_modelDefinitions
        .map((modelDefinition) => modelDefinition[propertyKey])
        .forEach((property) => {
          mergeObjects(result, property);
        });

      return result;
    }
  };
}

export function mergeSubModelDefinitionClasses<
  TSubModelDefinitionConstructors extends Record<
    string,
    ModelDefinitionConstructor
  >
>(
  subModelDefinitionClasses: TSubModelDefinitionConstructors
): ModelDefinitionConstructor<
  MergeSubModelDefinitionsDependencies<TSubModelDefinitionConstructors>,
  MergeSubModelDefinitionsProperty<
    TSubModelDefinitionConstructors,
    "initialState"
  >,
  MergeSubModelDefinitionsProperty<
    TSubModelDefinitionConstructors,
    "selectors"
  >,
  MergeSubModelDefinitionsProperty<TSubModelDefinitionConstructors, "reducers">,
  MergeSubModelDefinitionsProperty<TSubModelDefinitionConstructors, "effects">,
  MergeSubModelDefinitionsProperty<
    TSubModelDefinitionConstructors,
    "subscriptions"
  >
> {
  return class extends ModelDefinitionBase {
    private readonly __nyax_subModelDefinitions = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      const subModelDefinitions: Record<string, ModelDefinitionBase> = {};
      Object.keys(subModelDefinitionClasses).forEach((key) => {
        const subModelDefinitionClass = subModelDefinitionClasses[key];
        if (subModelDefinitionClass) {
          const subModelDefinition = new subModelDefinitionClass() as ModelDefinitionBase;

          defineGetter(
            subModelDefinition,
            "__nyax_nyaxContext",
            () => self.__nyax_nyaxContext
          );

          const subModel: Model = {
            get state(): any {
              return (self.__nyax_model.state as
                | Record<string, unknown>
                | undefined)?.[key];
            },
            get getters(): any {
              return (self.__nyax_model.getters as
                | Record<string, unknown>
                | undefined)?.[key];
            },
            get actions(): any {
              return (self.__nyax_model.actions as
                | Record<string, unknown>
                | undefined)?.[key];
            },

            get modelDefinitionClass(): any {
              return subModelDefinitionClass;
            },

            get namespace(): any {
              return self.__nyax_model.namespace;
            },
            get key(): any {
              return self.__nyax_model.key;
            },

            get isRegistered(): any {
              return self.__nyax_model.isRegistered;
            },

            register() {
              throw new Error("NotSupported");
            },
            unregister() {
              throw new Error("NotSupported");
            },
          };
          defineGetter(subModelDefinition, "__nyax_model", () => subModel);

          subModelDefinitions[key] = subModelDefinition;
        }
      });

      return subModelDefinitions;
    })();

    public initialState: any = this._mergeSubProperty("initialState");
    public selectors: any = this._mergeSubProperty("selectors");
    public reducers: any = this._mergeSubProperty("reducers");
    public effects: any = this._mergeSubProperty("effects");
    public subscriptions: any = this._mergeSubProperty("subscriptions");

    private _mergeSubProperty(propertyKey: ModelDefinitionPropertyKey): any {
      const result: Record<string, any> = {};

      Object.keys(this.__nyax_subModelDefinitions).forEach((key) => {
        result[key] = this.__nyax_subModelDefinitions[key]?.[propertyKey];
      });

      return result;
    }
  };
}

export function createModelDefinitionBaseClass<
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

export function defineModelDefinition<
  TDependencies,
  TInitialState extends InitialState,
  TSelectors extends Selectors,
  TReducers extends Reducers,
  TEffects extends Effects,
  TSubscriptions extends Subscriptions,
  TDynamic extends boolean = false
>(
  namespace: string,
  modelDefinitionClass: ModelDefinitionConstructor<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >,
  dynamic?: TDynamic
): ModelDefinitionClass<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions,
  TDynamic
> {
  return class extends modelDefinitionClass {
    public static namespace = namespace;
    public static dynamic = (dynamic ?? false) as TDynamic;
  };
}

export interface Model<
  TModelDefinitionClass extends ModelDefinitionConstructor = ModelDefinitionConstructor
> {
  state: ExtractModelDefinitionProperty<TModelDefinitionClass, "state">;
  getters: ExtractModelDefinitionProperty<TModelDefinitionClass, "getters">;
  actions: ExtractModelDefinitionProperty<TModelDefinitionClass, "actions">;

  modelDefinitionClass: TModelDefinitionClass;

  namespace: string;
  key: string | undefined;

  isRegistered: boolean;

  register(): void;
  unregister(): void;
}

export class ModelImpl<
  TModelDefinitionClass extends ModelDefinitionClass = ModelDefinitionClass
> implements Model<TModelDefinitionClass> {
  public readonly modelDefinitionClass: TModelDefinitionClass;

  public readonly namespace: string;
  public readonly key: string | undefined;

  private readonly _modelDefinition: InstanceType<TModelDefinitionClass>;

  private readonly _getters: ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "getters"
  >;
  private readonly _actions: ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "actions"
  >;

  constructor(
    private readonly _nyaxContext: NyaxContext,
    modelDefinitionClass: TModelDefinitionClass,
    key: string | undefined
  ) {
    this.modelDefinitionClass = modelDefinitionClass;

    this.namespace = modelDefinitionClass.namespace;
    this.key = key;

    const modelDefinitionBase = new modelDefinitionClass() as ModelDefinitionBase;
    modelDefinitionBase.__nyax_nyaxContext = this._nyaxContext;
    modelDefinitionBase.__nyax_model = this;

    this._modelDefinition = modelDefinitionBase as InstanceType<TModelDefinitionClass>;

    this._getters = createGetters(this._nyaxContext, this._modelDefinition);
    this._actions = createActionHelpers(
      this._nyaxContext,
      this._modelDefinition
    );
  }

  public get isRegistered(): boolean {
    return this._getState() !== undefined;
  }

  public get state(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "state"
  > {
    const state = this._getState();
    return state !== undefined ? state : this._modelDefinition.initialState;
  }

  public get getters(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "getters"
  > {
    return this._getters;
  }

  public get actions(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
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
    if (!this.isRegistered) {
      return;
    }

    this._nyaxContext.store.dispatch(
      unregisterActionHelper.create([
        {
          namespace: this.namespace,
          key: this.key,
        },
      ])
    );
  }

  private _getState():
    | ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
    | undefined {
    let state = this._nyaxContext.store.getState();
    state = (state as Record<string, unknown> | undefined)?.[this.namespace];
    if (this.key !== undefined) {
      state = (state as Record<string, unknown> | undefined)?.[this.key];
    }
    return state as
      | ExtractModelDefinitionProperty<TModelDefinitionClass, "state">
      | undefined;
  }
}

export interface GetModel {
  <TModelDefinitionClass extends ModelDefinitionClass>(
    modelDefinitionClassOrNamespace: TModelDefinitionClass | string
  ): TModelDefinitionClass extends ModelDefinitionClass<
    any,
    any,
    any,
    any,
    any,
    any,
    true
  >
    ? never
    : Model<TModelDefinitionClass>;
  <TModelDefinitionClass extends ModelDefinitionClass>(
    modelDefinitionClassOrNamespace: TModelDefinitionClass | string,
    key: string
  ): TModelDefinitionClass extends ModelDefinitionClass<
    any,
    any,
    any,
    any,
    any,
    any,
    false
  >
    ? never
    : Model<TModelDefinitionClass>;
}

export function createGetModel(nyaxContext: NyaxContext): GetModel {
  return <TModelDefinitionClass extends ModelDefinitionClass>(
    modelDefinitionClassOrNamespace: TModelDefinitionClass | string,
    key?: string
  ): Model<TModelDefinitionClass> => {
    const namespace =
      typeof modelDefinitionClassOrNamespace === "string"
        ? modelDefinitionClassOrNamespace
        : modelDefinitionClassOrNamespace.namespace;

    let modelContext = nyaxContext.modelContextByNamespace.get(namespace);
    if (!modelContext) {
      if (typeof modelDefinitionClassOrNamespace !== "string") {
        modelContext = {
          modelDefinitionClass: modelDefinitionClassOrNamespace,
          modelByKey: new Map(),
        };
        nyaxContext.modelContextByNamespace.set(namespace, modelContext);
      } else {
        throw new Error("Model definition is not found.");
      }
    }

    const modelDefinitionClass = modelContext.modelDefinitionClass;

    if (key === undefined && modelDefinitionClass.dynamic) {
      throw new Error("Key is required for dynamic model.");
    }

    if (key !== undefined && !modelDefinitionClass.dynamic) {
      throw new Error("Key is not available for static model.");
    }

    let model = modelContext.modelByKey.get(key);
    if (!model) {
      model = new ModelImpl(nyaxContext, modelDefinitionClass, key);
      modelContext.modelByKey.set(key, model);
    }

    return model as Model<TModelDefinitionClass>;
  };
}
