import {
  ConvertActionHelpers,
  registerActionHelper,
  unregisterActionHelper,
} from "./action";
import { NyaxContext } from "./context";
import { Effects } from "./effect";
import { Reducers } from "./reducer";
import { ConvertGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";
import { Nyax } from "./store";
import { Subscriptions } from "./subscription";
import { mergeObjects, Spread, UnionToIntersection } from "./util";

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
> = new (...args: any[]) => ModelDefinition<
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
  isDynamic: TDynamic;
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
  public initialState: any = {};
  public selectors: any = {};
  public reducers: any = {};
  public effects: any = {};
  public subscriptions: any = {};

  constructor(
    protected readonly __nyax_context: {
      nyax: Nyax;

      namespace: string;
      key: string | undefined;

      state: any;
      getters: any;
      actions: any;
    }
  ) {}

  public get state(): any {
    return this.__nyax_context.state;
  }
  public get getters(): any {
    return this.__nyax_context.getters;
  }
  public get actions(): any {
    return this.__nyax_context.actions;
  }

  public get dependencies(): any {
    return this.__nyax_context.nyax.dependencies;
  }

  public get namespace(): any {
    return this.__nyax_context.namespace;
  }
  public get key(): any {
    return this.__nyax_context.key;
  }

  public get getModel(): any {
    return this.__nyax_context.nyax.getModel;
  }
  public get nyax(): any {
    return this.__nyax_context.nyax;
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
    private readonly __nyax_modelDefinitions = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return modelDefinitionClasses.map((modelDefinitionClass) => {
        const modelDefinition = new (modelDefinitionClass as typeof ModelDefinitionBase)(
          {
            get nyax() {
              return self.__nyax_context.nyax;
            },

            get namespace() {
              return self.__nyax_context.namespace;
            },
            get key() {
              return self.__nyax_context.key;
            },

            get state() {
              return self.__nyax_context.state;
            },
            get getters() {
              return self.__nyax_context.getters;
            },
            get actions() {
              return self.__nyax_context.actions;
            },
          }
        );
        return modelDefinition;
      });
    })();

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
          const subModelDefinition = new (subModelDefinitionClass as typeof ModelDefinitionBase)(
            {
              get nyax() {
                return self.__nyax_context.nyax;
              },

              get namespace() {
                return self.__nyax_context.namespace;
              },
              get key() {
                return self.__nyax_context.key;
              },

              get state() {
                return self.__nyax_context.state?.[key];
              },
              get getters() {
                return self.__nyax_context.getters?.[key];
              },
              get actions() {
                return self.__nyax_context.actions?.[key];
              },
            }
          );
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
  isDynamic?: TDynamic
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
    public static isDynamic = (isDynamic ?? false) as TDynamic;
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
  public readonly namespace: string;

  private get _modelDefinition() {
    const modelDefinition = this._nyaxContext.getModelDefinition(
      this.namespace,
      this.key
    );
    if (!modelDefinition) {
      throw new Error("Model definition is not registered.");
    }
    return modelDefinition as InstanceType<TModelDefinitionClass>;
  }

  constructor(
    private readonly _nyaxContext: NyaxContext,
    public readonly modelDefinitionClass: TModelDefinitionClass,
    public readonly key: string | undefined
  ) {
    this.namespace = modelDefinitionClass.namespace;
  }

  public get isRegistered(): boolean {
    return (
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this._nyaxContext.nyax.getState(this.namespace, this.key!) !== undefined
    );
  }

  public get state(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "state"
  > {
    return this._modelDefinition.state;
  }

  public get getters(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "getters"
  > {
    return this._modelDefinition.getters;
  }

  public get actions(): ExtractModelDefinitionProperty<
    TModelDefinitionClass,
    "actions"
  > {
    return this._modelDefinition.actions;
  }

  public register(): void {
    if (this.isRegistered) {
      throw new Error("Model is already registered.");
    }

    this._nyaxContext.nyax.store.dispatch(
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
      this._nyaxContext.nyax.store.dispatch(
        unregisterActionHelper.create([
          {
            namespace: this.namespace,
            key: this.key,
          },
        ])
      );
    }

    this._nyaxContext.modelContextByNamespace
      .get(this.namespace)
      ?.modelByKey.delete(this.key);
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
    const modelContext = nyaxContext.getModelContext(
      modelDefinitionClassOrNamespace
    );
    const modelDefinitionClass = modelContext.modelDefinitionClass;

    if (key === undefined && modelDefinitionClass.isDynamic) {
      throw new Error("Key is required for dynamic model.");
    }

    if (key !== undefined && !modelDefinitionClass.isDynamic) {
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

export type RegisterModelDefinitionClasses = (
  ...modelDefinitionClasses: ModelDefinitionClass[]
) => void;

export function createRegisterModelDefinitionClasses(
  nyaxContext: NyaxContext
): RegisterModelDefinitionClasses {
  return (...modelDefinitionClasses) => {
    const toRegisterNamespaces: string[] = [];

    modelDefinitionClasses.forEach((modelDefinitionClass) => {
      // initialize context
      nyaxContext.getModelContext(modelDefinitionClass);

      if (!modelDefinitionClass.isDynamic) {
        const model = nyaxContext.nyax.getModel(modelDefinitionClass);
        if (!model.isRegistered) {
          toRegisterNamespaces.push(model.namespace);
        }
      }
    });

    if (toRegisterNamespaces.length > 0) {
      nyaxContext.nyax.store.dispatch(
        registerActionHelper.create(
          toRegisterNamespaces.map((namespace) => ({ namespace }))
        )
      );
    }
  };
}
