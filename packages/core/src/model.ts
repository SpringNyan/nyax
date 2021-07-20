import { ConvertActionHelpers, registerActionType } from "./action";
import { GetContainer } from "./container";
import { NyaxContext } from "./context";
import { Effects } from "./effect";
import { Reducers } from "./reducer";
import { ConvertGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";
import { Nyax } from "./store";
import { Subscriptions } from "./subscription";
import { mergeObjects, Resolved, UnionToIntersection } from "./util";

export interface Model<
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

  getContainer: GetContainer;
  nyax: Nyax;
}

export type ModelClass<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {}
  /* eslint-enable @typescript-eslint/ban-types */
> = new (...args: any[]) => Model<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions
>;

export interface NamespacedModelClass<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TSubscriptions = {},
  TDynamic = boolean
  /* eslint-enable @typescript-eslint/ban-types */
> extends ModelClass<
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

export type ModelPropertyKey =
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "subscriptions";

export type ExtractModelProperty<
  TModelClass extends ModelClass,
  TPropertyKey extends ModelPropertyKey
> = ReturnType<InstanceType<TModelClass>[TPropertyKey]>;

export type ExtractModelDependencies<TModelClass extends ModelClass> =
  InstanceType<TModelClass>["dependencies"];

export type MergeModelsProperty<
  TModelClasses extends ModelClass[],
  TPropertyKey extends ModelPropertyKey
> = Resolved<
  UnionToIntersection<
    {
      [K in keyof TModelClasses & number]: ExtractModelProperty<
        TModelClasses[K],
        TPropertyKey
      >;
    }[number]
  >
>;

export type MergeSubModelsProperty<
  TSubModelClasses extends Record<string, ModelClass>,
  TPropertyKey extends ModelPropertyKey
> = Resolved<
  {
    [K in keyof TSubModelClasses]: ExtractModelProperty<
      TSubModelClasses[K],
      TPropertyKey
    >;
  }
>;

export type MergeModelsDependencies<TModelClasses extends ModelClass[]> =
  UnionToIntersection<
    {
      [K in keyof TModelClasses & number]: InstanceType<
        TModelClasses[K]
      >["dependencies"];
    }[number]
  >;

export type MergeSubModelsDependencies<
  TSubModelClasses extends Record<string, ModelClass>
> = UnionToIntersection<
  {
    [K in keyof TSubModelClasses]: InstanceType<
      TSubModelClasses[K]
    >["dependencies"];
  }[keyof TSubModelClasses]
>;

export class ModelBase<TDependencies = unknown>
  implements
    Model<
      /* eslint-disable @typescript-eslint/ban-types */
      TDependencies,
      {},
      {},
      {},
      {},
      {}
      /* eslint-enable @typescript-eslint/ban-types */
    >
{
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
  public subscriptions(): any {
    return {};
  }

  constructor(
    protected readonly __nyax_container: {
      nyax: Nyax;

      namespace: string;
      key: string | undefined;

      state: any;
      getters: any;
      actions: any;
    }
  ) {}

  public get state(): any {
    return this.__nyax_container.state;
  }
  public get getters(): any {
    return this.__nyax_container.getters;
  }
  public get actions(): any {
    return this.__nyax_container.actions;
  }

  public get dependencies(): any {
    return this.__nyax_container.nyax.dependencies;
  }

  public get namespace(): any {
    return this.__nyax_container.namespace;
  }
  public get key(): any {
    return this.__nyax_container.key;
  }

  public get getContainer(): any {
    return this.__nyax_container.nyax.getContainer;
  }
  public get nyax(): any {
    return this.__nyax_container.nyax;
  }
}

export function mergeModelClasses<
  TModelClasses extends ModelClass[] | [ModelClass]
>(
  ...modelClasses: TModelClasses
): ModelClass<
  MergeModelsDependencies<TModelClasses>,
  MergeModelsProperty<TModelClasses, "initialState">,
  MergeModelsProperty<TModelClasses, "selectors">,
  MergeModelsProperty<TModelClasses, "reducers">,
  MergeModelsProperty<TModelClasses, "effects">,
  MergeModelsProperty<TModelClasses, "subscriptions">
> {
  return class extends ModelBase {
    private readonly __nyax_models = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return modelClasses.map((modelClass) => {
        const model = new (modelClass as typeof ModelBase)({
          get nyax() {
            return self.__nyax_container.nyax;
          },

          get namespace() {
            return self.__nyax_container.namespace;
          },
          get key() {
            return self.__nyax_container.key;
          },

          get state() {
            return self.__nyax_container.state;
          },
          get getters() {
            return self.__nyax_container.getters;
          },
          get actions() {
            return self.__nyax_container.actions;
          },
        });
        return model;
      });
    })();

    public override initialState(): any {
      return this._mergeProperty("initialState");
    }
    public override selectors(): any {
      return this._mergeProperty("selectors");
    }
    public override reducers(): any {
      return this._mergeProperty("reducers");
    }
    public override effects(): any {
      return this._mergeProperty("effects");
    }
    public override subscriptions(): any {
      return this._mergeProperty("subscriptions");
    }

    private _mergeProperty(propertyKey: ModelPropertyKey): any {
      const result: Record<string, unknown> = {};

      this.__nyax_models.forEach((model) => {
        mergeObjects(result, model[propertyKey]());
      });

      return result;
    }
  };
}

export function mergeSubModelClasses<
  TSubModelClasses extends Record<string, ModelClass>
>(
  subModelClasses: TSubModelClasses
): ModelClass<
  MergeSubModelsDependencies<TSubModelClasses>,
  MergeSubModelsProperty<TSubModelClasses, "initialState">,
  MergeSubModelsProperty<TSubModelClasses, "selectors">,
  MergeSubModelsProperty<TSubModelClasses, "reducers">,
  MergeSubModelsProperty<TSubModelClasses, "effects">,
  MergeSubModelsProperty<TSubModelClasses, "subscriptions">
> {
  return class extends ModelBase {
    private readonly __nyax_subModels = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      const subModels: Record<string, ModelBase> = {};
      Object.keys(subModelClasses).forEach((key) => {
        const subModelClass = subModelClasses[key];
        if (subModelClass) {
          const subModel = new (subModelClass as typeof ModelBase)({
            get nyax() {
              return self.__nyax_container.nyax;
            },

            get namespace() {
              return self.__nyax_container.namespace;
            },
            get key() {
              return self.__nyax_container.key;
            },

            get state() {
              return self.__nyax_container.state?.[key];
            },
            get getters() {
              return self.__nyax_container.getters?.[key];
            },
            get actions() {
              return self.__nyax_container.actions?.[key];
            },
          });
          subModels[key] = subModel;
        }
      });

      return subModels;
    })();

    public override initialState(): any {
      return this._mergeSubProperty("initialState");
    }
    public override selectors(): any {
      return this._mergeSubProperty("selectors");
    }
    public override reducers(): any {
      return this._mergeSubProperty("reducers");
    }
    public override effects(): any {
      return this._mergeSubProperty("effects");
    }
    public override subscriptions(): any {
      return this._mergeSubProperty("subscriptions");
    }

    private _mergeSubProperty(propertyKey: ModelPropertyKey): any {
      const result: Record<string, unknown> = {};

      Object.keys(this.__nyax_subModels).forEach((key) => {
        result[key] = this.__nyax_subModels[key]?.[propertyKey]();
      });

      return result;
    }
  };
}

export function createBaseModelClass<TDependencies>(): ModelClass<
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

export function defineModel<
  TDependencies,
  TInitialState extends InitialState,
  TSelectors extends Selectors,
  TReducers extends Reducers,
  TEffects extends Effects,
  TSubscriptions extends Subscriptions,
  TDynamic extends boolean = false
>(
  namespace: string,
  modelClass: ModelClass<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions
  >,
  isDynamic?: TDynamic
): NamespacedModelClass<
  TDependencies,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TSubscriptions,
  TDynamic
> {
  return class extends modelClass {
    public static namespace = namespace;
    public static isDynamic = (isDynamic ?? false) as TDynamic;

    private __nyax_initialState: any;
    private __nyax_selectors: any;
    private __nyax_reducers: any;
    private __nyax_effects: any;
    private __nyax_subscriptions: any;

    public override initialState(): any {
      if (this.__nyax_initialState === undefined) {
        this.__nyax_initialState = super.initialState();
      }
      return this.__nyax_initialState;
    }
    public override selectors(): any {
      if (this.__nyax_selectors === undefined) {
        this.__nyax_selectors = super.selectors();
      }
      return this.__nyax_selectors;
    }
    public override reducers(): any {
      if (this.__nyax_reducers === undefined) {
        this.__nyax_reducers = super.reducers();
      }
      return this.__nyax_reducers;
    }
    public override effects(): any {
      if (this.__nyax_effects === undefined) {
        this.__nyax_effects = super.effects();
      }
      return this.__nyax_effects;
    }
    public override subscriptions(): any {
      if (this.__nyax_subscriptions === undefined) {
        this.__nyax_subscriptions = super.subscriptions();
      }
      return this.__nyax_subscriptions;
    }
  } as ModelClass as NamespacedModelClass<
    TDependencies,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TSubscriptions,
    TDynamic
  >;
}

export type RegisterModelClasses = (
  ...modelClasses: NamespacedModelClass[]
) => void;

export function createRegisterModelClasses(
  nyaxContext: NyaxContext
): RegisterModelClasses {
  return (...modelClasses) => {
    const toRegisterNamespaces: string[] = [];

    modelClasses.forEach((modelClass) => {
      // initialize context
      nyaxContext.getModelClassContext(modelClass);

      if (!modelClass.isDynamic) {
        const container = nyaxContext.nyax.getContainer(modelClass);
        if (!container.isRegistered) {
          toRegisterNamespaces.push(container.namespace);
        }
      }
    });

    if (toRegisterNamespaces.length > 0) {
      nyaxContext.nyax.store.dispatch({
        type: registerActionType,
        payload: toRegisterNamespaces.map((namespace) => ({ namespace })),
      });
    }
  };
}
