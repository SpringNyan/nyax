import { ActionsObservable, StateObservable } from "redux-observable";
import {
  AnyAction,
  ConvertActionHelpers,
  registerActionHelper,
  RegisterActionPayload,
} from "./action";
import {
  ConvertArgs,
  ModelDefaultArgs,
  ModelInnerDefaultArgs,
  NYAX_DEFAULT_ARGS,
} from "./arg";
import { NYAX_NOTHING } from "./common";
import { ContainerImpl, GetContainer } from "./container";
import { ModelContext, NyaxContext } from "./context";
import { ModelEffects } from "./effect";
import { ModelEpics } from "./epic";
import { ModelReducers } from "./reducer";
import { ConvertGetters, ModelSelectors } from "./selector";
import { ConvertState, ModelInitialState } from "./state";
import { Nyax } from "./store";
import {
  convertNamespaceToPath,
  defineGetter,
  flattenObject,
  mergeObjects,
  Spread,
  traverseObject,
  UnionToIntersection,
} from "./util";

export interface ModelInstance<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TDefaultArgs = {},
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TEpics = {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  defaultArgs(): TDefaultArgs;
  initialState(): TInitialState;
  selectors(): TSelectors;
  reducers(): TReducers;
  effects(): TEffects;
  epics(): TEpics;

  dependencies: TDependencies;
  args: ConvertArgs<ReturnType<this["defaultArgs"]>>;
  state: ConvertState<ReturnType<this["initialState"]>>;
  getters: ConvertGetters<ReturnType<this["selectors"]>>;
  actions: ConvertActionHelpers<
    ReturnType<this["reducers"]>,
    ReturnType<this["effects"]>
  >;

  rootAction$: ActionsObservable<AnyAction>;
  rootState$: StateObservable<unknown>;

  modelNamespace: string;
  containerKey: string | undefined;

  nyax: Nyax;
  getContainer: GetContainer;
}

export type ModelInstanceConstructor<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TDefaultArgs = {},
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TEpics = {}
  /* eslint-enable @typescript-eslint/ban-types */
> = new () => ModelInstance<
  TDependencies,
  TDefaultArgs,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TEpics
>;

export interface ModelOptions {
  namespace?: string;

  isDynamic?: boolean;
  isOnDemand?: boolean;

  /** @deprecated Use `isOnDemand` */
  isLazy?: boolean;
}

export interface Model<
  /* eslint-disable @typescript-eslint/ban-types */
  TDependencies = unknown,
  TDefaultArgs = {},
  TInitialState = {},
  TSelectors = {},
  TReducers = {},
  TEffects = {},
  TEpics = {}
  /* eslint-enable @typescript-eslint/ban-types */
>
  extends ModelInstanceConstructor<
      TDependencies,
      TDefaultArgs,
      TInitialState,
      TSelectors,
      TReducers,
      TEffects,
      TEpics
    >,
    ModelOptions {}

export type ModelArray = Model[];

export type ModelObject = {
  [key: string]: Model | ModelObject;
};

export type Models = ModelArray | ModelObject;

export type ExtractModelDefaultArgs<TModel extends Model> = ReturnType<
  InstanceType<TModel>["defaultArgs"]
>;

export type ExtractModelInitialState<TModel extends Model> = ReturnType<
  InstanceType<TModel>["initialState"]
>;

export type ExtractModelSelectors<TModel extends Model> = ReturnType<
  InstanceType<TModel>["selectors"]
>;

export type ExtractModelReducers<TModel extends Model> = ReturnType<
  InstanceType<TModel>["reducers"]
>;

export type ExtractModelEffects<TModel extends Model> = ReturnType<
  InstanceType<TModel>["effects"]
>;

export type ExtractModelEpics<TModel extends Model> = ReturnType<
  InstanceType<TModel>["epics"]
>;

export type ExtractModelDependencies<TModel extends Model> = InstanceType<
  TModel
>["dependencies"];

export type ExtractModelArgs<TModel extends Model> = InstanceType<
  TModel
>["args"];

export type ExtractModelState<TModel extends Model> = InstanceType<
  TModel
>["state"];

export type ExtractModelGetters<TModel extends Model> = InstanceType<
  TModel
>["getters"];

export type ExtractModelActionHelpers<TModel extends Model> = InstanceType<
  TModel
>["actions"];

export type MergeModelsDependencies<
  TModels extends Model[]
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ExtractModelDependencies<TModels[K]>;
  }[number]
>;

export type MergeSubModelsDependencies<
  TSubModels extends Record<string, Model>
> = UnionToIntersection<
  {
    [K in keyof TSubModels]: ExtractModelDependencies<TSubModels[K]>;
  }[keyof TSubModels]
>;

export type ModelPropertyKey =
  | "defaultArgs"
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "epics";

export type MergeModelsDefaultArgs<
  TModels extends Model[]
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ExtractModelDefaultArgs<TModels[K]>;
  }[number]
>;

export type MergeSubModelsDefaultArgs<
  TSubModels extends Record<string, Model>
> = Spread<
  {
    [K in keyof TSubModels]: ModelInnerDefaultArgs<
      ExtractModelDefaultArgs<TSubModels[K]>
    >;
  }
>;

export type MergeModelsProperty<
  TModels extends Model[],
  TPropertyKey extends Exclude<ModelPropertyKey, "defaultArgs">
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ReturnType<
      InstanceType<TModels[K]>[TPropertyKey]
    >;
  }[number]
>;

export type MergeSubModelsProperty<
  TSubModels extends Record<string, Model>,
  TPropertyKey extends Exclude<ModelPropertyKey, "defaultArgs">
> = Spread<
  {
    [K in keyof TSubModels]: ReturnType<
      InstanceType<TSubModels[K]>[TPropertyKey]
    >;
  }
>;

export class ModelBase<TDependencies = unknown>
  implements
    ModelInstance<
      /* eslint-disable @typescript-eslint/ban-types */
      TDependencies,
      {},
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
    | "args"
    | "draftState"
    | "state"
    | "getters"
    | "actions"
    | "modelNamespace"
    | "containerKey"
  >;

  public defaultArgs(): any {
    return {};
  }
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
  public get args(): any {
    const args = this.__nyax_container.args;
    if (args !== NYAX_NOTHING) {
      return args;
    }
    throw new Error("Args is only available in `initialState()`");
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

export function mergeModels<TModels extends Model[] | [Model]>(
  ...models: TModels
): ModelInstanceConstructor<
  MergeModelsDependencies<TModels>,
  MergeModelsDefaultArgs<TModels>,
  MergeModelsProperty<TModels, "initialState">,
  MergeModelsProperty<TModels, "selectors">,
  MergeModelsProperty<TModels, "reducers">,
  MergeModelsProperty<TModels, "effects">,
  MergeModelsProperty<TModels, "epics">
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

    public defaultArgs(): any {
      return this._mergeProperty("defaultArgs");
    }

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

    private _mergeProperty<TPropertyKey extends ModelPropertyKey>(
      propertyKey: TPropertyKey
    ): ReturnType<ModelInstance[TPropertyKey]> {
      const result = {} as ReturnType<ModelInstance[TPropertyKey]>;

      this.__nyax_modelInstances
        .map((modelInstance) => modelInstance[propertyKey]())
        .forEach((property) => {
          mergeObjects(result, property);
        });

      return result;
    }
  };
}

export function mergeSubModels<TSubModels extends Record<string, Model>>(
  subModels: TSubModels
): ModelInstanceConstructor<
  MergeSubModelsDependencies<TSubModels>,
  MergeSubModelsDefaultArgs<TSubModels>,
  MergeSubModelsProperty<TSubModels, "initialState">,
  MergeSubModelsProperty<TSubModels, "selectors">,
  MergeSubModelsProperty<TSubModels, "reducers">,
  MergeSubModelsProperty<TSubModels, "effects">,
  MergeSubModelsProperty<TSubModels, "epics">
> {
  return class extends ModelBase {
    private readonly __nyax_subModelInstances = (() => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return Object.keys(subModels).reduce<Record<string, ModelBase>>(
        (obj, key) => {
          const modelInstance = new subModels[key]() as ModelBase;

          defineGetter(
            modelInstance,
            "__nyax_nyaxContext",
            () => self.__nyax_nyaxContext
          );

          const container = {
            get args(): any {
              const args = self.__nyax_container.args;
              return args !== NYAX_NOTHING ? args[key] : NYAX_NOTHING;
            },
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

    public defaultArgs(): any {
      return this._mergeSubProperty("defaultArgs");
    }

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

    private _mergeSubProperty<TPropertyKey extends ModelPropertyKey>(
      propertyKey: TPropertyKey
    ): Record<string, ReturnType<ModelInstance[TPropertyKey]>> {
      const result: Record<string, any> = {};
      Object.keys(this.__nyax_subModelInstances).forEach((key) => {
        result[key] = this.__nyax_subModelInstances[key][propertyKey]();
        if (propertyKey === "defaultArgs") {
          result[key][NYAX_DEFAULT_ARGS] = true;
        }
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
  {},
  {}
  /* eslint-enable @typescript-eslint/ban-types */
> {
  return class extends ModelBase<TDependencies> {};
}

export function createModel<
  TDependencies,
  TDefaultArgs extends ModelDefaultArgs,
  TInitialState extends ModelInitialState,
  TSelectors extends ModelSelectors,
  TReducers extends ModelReducers,
  TEffects extends ModelEffects,
  TEpics extends ModelEpics,
  TOptions extends ModelOptions | undefined
>(
  model: Model<
    TDependencies,
    TDefaultArgs,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TEpics
  >,
  options?: TOptions
): ModelInstanceConstructor<
  TDependencies,
  TDefaultArgs,
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

    public defaultArgs(): any {
      return this.__nyax_modelInstance.defaultArgs();
    }

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
  } as Model;

  if (options) {
    Model.namespace = options.namespace;

    Model.isDynamic = options.isDynamic;
    Model.isOnDemand = options.isOnDemand;

    Model.isLazy = options.isLazy;
  }
  return Model as ModelInstanceConstructor<
    TDependencies,
    TDefaultArgs,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TEpics
  > &
    Spread<Pick<TOptions, Extract<keyof TOptions, keyof ModelOptions>>>;
}

export function registerModel<TModel extends Model>(
  nyaxContext: NyaxContext,
  modelNamespace: string,
  model: TModel
): void {
  if (nyaxContext.modelContextByModel.has(model)) {
    throw new Error("Model is already registered");
  }

  if (nyaxContext.modelContextByModelNamespace.has(modelNamespace)) {
    throw new Error("Model namespace is already bound");
  }

  const modelContext: ModelContext = {
    model,
    modelNamespace,
    modelPath: convertNamespaceToPath(modelNamespace),

    containerByContainerKey: new Map(),
    stopEpicEmitterByContainerKey: new Map(),
  };

  nyaxContext.modelContextByModel.set(model, modelContext);
  nyaxContext.modelContextByModelNamespace.set(modelNamespace, modelContext);
}

export function registerModels(nyaxContext: NyaxContext, models: Models): void {
  const registerActionPayloads: RegisterActionPayload[] = [];

  function register(modelNamespace: string, model: Model) {
    registerModel(nyaxContext, modelNamespace, model);
    if (!model.isDynamic && !model.isOnDemand && !model.isLazy) {
      registerActionPayloads.push({ modelNamespace });
    }
  }

  if (Array.isArray(models)) {
    models.forEach((model) => {
      if (!model.namespace) {
        throw new Error("Model namespace is missing");
      }
      register(model.namespace, model);
    });
  } else {
    traverseObject(models, (item, key, parent, paths) => {
      const modelNamespace = paths.join("/");
      const model = item as Model;
      register(modelNamespace, model);
    });
  }

  nyaxContext.batchDispatch(
    registerActionPayloads.map((payload) =>
      registerActionHelper.create(payload)
    )
  );
}

export function flattenModels(models: Models): Record<string, Model> {
  if (Array.isArray(models)) {
    return models.reduce<Record<string, Model>>((obj, model) => {
      if (!model.namespace) {
        throw new Error("Model namespace is missing");
      }
      obj[model.namespace] = model;
      return obj;
    }, {});
  } else {
    return flattenObject(models, "/") as Record<string, Model>;
  }
}

export type LazyModelUninitialized<TModel extends Model> = {
  _status: -1;
  _result: () => Promise<{ default: TModel }>;
};

export type LazyModelPending<TModel extends Model> = {
  _status: 0;
  _result: Promise<{ default: TModel }>;
};

export type LazyModelResolved<TModel extends Model> = {
  _status: 1;
  _result: TModel;
};

export type LazyModelRejected = {
  _status: 2;
  _result: unknown;
};

export type LazyModel<TModel extends Model = Model> =
  | LazyModelUninitialized<TModel>
  | LazyModelPending<TModel>
  | LazyModelResolved<TModel>
  | LazyModelRejected;

export function createLazyModel<TModel extends Model>(
  factory: () => Promise<{ default: TModel }>
): LazyModel<TModel> {
  return {
    _status: -1,
    _result: factory,
  };
}

export function updateLazyModel<TModel extends Model>(
  target: LazyModel<TModel>,
  value: LazyModel<TModel>
): LazyModel<TModel> {
  target._status = value._status;
  target._result = value._result;
  return target;
}

export function resolveModel<TModel extends Model>(
  modelOrLazyModel: TModel | LazyModel<TModel>
): TModel {
  if (typeof modelOrLazyModel === "function") {
    return modelOrLazyModel;
  }

  const lazyModel = modelOrLazyModel;
  if (lazyModel._status === -1) {
    const promise = lazyModel._result();

    updateLazyModel(lazyModel, {
      _status: 0,
      _result: promise,
    });

    promise.then(
      (moduleObject) => {
        updateLazyModel(lazyModel, {
          _status: 1,
          _result: moduleObject.default,
        });
      },
      (reason) => {
        updateLazyModel(lazyModel, {
          _status: 2,
          _result: reason,
        });
      }
    );
  }

  if (lazyModel._status === 1) {
    return lazyModel._result;
  } else {
    throw lazyModel._result;
  }
}
