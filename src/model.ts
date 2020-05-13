import { ActionsObservable, StateObservable } from "redux-observable";
import {
  AnyAction,
  ConvertActionHelpers,
  RegisterActionPayload,
} from "./action";
import { ConvertArgs, ModelDefaultArgs, NYAX_DEFAULT_ARGS_KEY } from "./arg";
import { NYAX_NOTHING } from "./common";
import { ContainerImpl, GetContainer } from "./container";
import { NyaxContext } from "./context";
import { ModelEffects } from "./effect";
import { ModelEpics } from "./epic";
import { ModelReducers } from "./reducer";
import { ConvertGetters, ModelSelectors } from "./selector";
import { ConvertState, GetState, ModelInitialState } from "./state";
import {
  convertNamespaceToPath,
  defineGetter,
  flattenObject,
  mergeObjects,
  traverseObject,
  UnionToIntersection,
} from "./util";

export interface ModelInstance<
  TDependencies = any,
  TDefaultArgs = any,
  TInitialState = any,
  TSelectors = any,
  TReducers = any,
  TEffects = any,
  TEpics = any
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
  rootState$: StateObservable<any>;

  modelNamespace: string;
  containerKey: string | undefined;

  getContainer: GetContainer;
  getState: GetState<this["state"]>;
}

export type ModelInstanceConstructor<
  TDependencies = any,
  TDefaultArgs = any,
  TInitialState = any,
  TSelectors = any,
  TReducers = any,
  TEffects = any,
  TEpics = any
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
  isDynamic?: boolean;
  isLazy?: boolean;
}

export interface Model<
  TDependencies = any,
  TDefaultArgs = any,
  TInitialState = any,
  TSelectors = any,
  TReducers = any,
  TEffects = any,
  TEpics = any
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

export interface Models {
  [key: string]: Model | Models;
}

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

export type MergeModelsProperty<
  TModels extends Model[],
  TPropertyKey extends ModelPropertyKey
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ReturnType<
      InstanceType<TModels[K]>[TPropertyKey]
    >;
  }[number]
>;

export type MergeSubModelsProperty<
  TSubModels extends Record<string, Model>,
  TPropertyKey extends ModelPropertyKey
> = {
  [K in keyof TSubModels]: ReturnType<
    InstanceType<TSubModels[K]>[TPropertyKey]
  > &
    (TPropertyKey extends "defaultArgs"
      ? { [NYAX_DEFAULT_ARGS_KEY]: true }
      : {});
};

export class ModelBase<TDependencies = any>
  implements ModelInstance<TDependencies, {}, {}, {}, {}, {}, {}> {
  public __nyaxContext!: NyaxContext;
  public __container!: Pick<
    ContainerImpl,
    | "args"
    | "draftState"
    | "state"
    | "getters"
    | "actions"
    | "modelNamespace"
    | "containerKey"
  >;

  private __getStateCache: any;

  public defaultArgs(): {} {
    return {};
  }
  public initialState(): {} {
    return {};
  }
  public selectors(): {} {
    return {};
  }
  public reducers(): {} {
    return {};
  }
  public effects(): {} {
    return {};
  }
  public epics(): {} {
    return {};
  }

  public get dependencies(): TDependencies {
    return this.__nyaxContext.dependencies;
  }
  public get args(): any {
    const args = this.__container.args;
    if (args !== NYAX_NOTHING) {
      return args;
    }
    throw new Error("Args is only available in `initialState()`");
  }
  public get state(): any {
    const draftState = this.__container.draftState;
    return draftState !== NYAX_NOTHING ? draftState : this.__container.state;
  }
  public get getters(): any {
    return this.__container.getters;
  }
  public get actions(): any {
    return this.__container.actions;
  }

  public get rootAction$(): any {
    return this.__nyaxContext.rootAction$;
  }
  public get rootState$(): any {
    return this.__nyaxContext.rootState$;
  }

  public get modelNamespace(): any {
    return this.__container.modelNamespace;
  }
  public get containerKey(): any {
    return this.__container.containerKey;
  }

  public get getContainer(): any {
    return this.__nyaxContext.getContainer;
  }
  public get getState(): any {
    if (!this.__getStateCache) {
      this.__getStateCache = (...args: any[]): any => {
        if (args[0] === undefined) {
          return this.__nyaxContext.getContainer(
            this.modelNamespace,
            this.containerKey
          ).isRegistered
            ? this.state
            : undefined;
        }

        return (this.__nyaxContext.getState as any)(...args);
      };
    }

    return this.__getStateCache;
  }
}

export function mergeModels<TModels extends Model[] | [Model]>(
  ...models: TModels
): ModelInstanceConstructor<
  MergeModelsDependencies<TModels>,
  MergeModelsProperty<TModels, "defaultArgs">,
  MergeModelsProperty<TModels, "initialState">,
  MergeModelsProperty<TModels, "selectors">,
  MergeModelsProperty<TModels, "reducers">,
  MergeModelsProperty<TModels, "effects">,
  MergeModelsProperty<TModels, "epics">
> {
  return class extends ModelBase {
    private readonly __modelInstances: ModelInstance[] = models.map((model) => {
      const modelInstance = new model() as ModelBase;
      defineGetter(modelInstance, "__nyaxContext", () => this.__nyaxContext);
      defineGetter(modelInstance, "__container", () => this.__container);
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

      this.__modelInstances
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
  MergeSubModelsProperty<TSubModels, "defaultArgs">,
  MergeSubModelsProperty<TSubModels, "initialState">,
  MergeSubModelsProperty<TSubModels, "selectors">,
  MergeSubModelsProperty<TSubModels, "reducers">,
  MergeSubModelsProperty<TSubModels, "effects">,
  MergeSubModelsProperty<TSubModels, "epics">
> {
  return class extends ModelBase {
    private readonly __subModelInstances = ((): Record<
      string,
      ModelInstance
    > => {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const self = this;

      return Object.keys(subModels).reduce<Record<string, ModelInstance>>(
        (obj, key) => {
          const modelInstance = new subModels[key]() as ModelBase;

          defineGetter(
            modelInstance,
            "__nyaxContext",
            () => self.__nyaxContext
          );

          const container = {
            get args(): any {
              const args = self.__container.args;
              return args !== NYAX_NOTHING ? args[key] : NYAX_NOTHING;
            },
            get draftState(): any {
              const draftState = self.__container.draftState;
              return draftState !== NYAX_NOTHING
                ? draftState[key]
                : NYAX_NOTHING;
            },
            get state(): any {
              return self.__container.state[key];
            },
            get getters(): any {
              return self.__container.getters[key];
            },
            get actions(): any {
              return self.__container.actions[key];
            },
            get modelNamespace(): any {
              return self.__container.modelNamespace;
            },
            get containerKey(): any {
              return self.__container.containerKey;
            },
          };
          defineGetter(modelInstance, "__container", () => container);

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
      const result: Record<
        string,
        ReturnType<ModelInstance[TPropertyKey]>
      > = {};
      Object.keys(this.__subModelInstances).forEach((key) => {
        result[key] = this.__subModelInstances[key][propertyKey]();
        if (propertyKey === "defaultArgs") {
          result[key][NYAX_DEFAULT_ARGS_KEY] = true;
        }
      });
      return result;
    }
  };
}

export function createModelBase<TDependencies>(): ModelInstanceConstructor<
  TDependencies,
  {},
  {},
  {},
  {},
  {},
  {}
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
  TOptions extends ModelOptions = {}
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
  Pick<TOptions, Extract<keyof TOptions, keyof ModelOptions>> {
  const Model = class extends ModelBase {
    private readonly __modelInstance = ((): ModelInstance => {
      const modelInstance = new (model as Model)() as ModelBase;
      defineGetter(modelInstance, "__nyaxContext", () => this.__nyaxContext);
      defineGetter(modelInstance, "__container", () => this.__container);
      return modelInstance;
    })();

    public defaultArgs(): any {
      return this.__modelInstance.defaultArgs();
    }

    public initialState(): any {
      return this.__modelInstance.initialState();
    }

    public selectors(): any {
      return this.__modelInstance.selectors();
    }

    public reducers(): any {
      return this.__modelInstance.reducers();
    }

    public effects(): any {
      return this.__modelInstance.effects();
    }

    public epics(): any {
      return this.__modelInstance.epics();
    }
  } as Model;

  if (options) {
    Model.isDynamic = options.isDynamic;
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
    Pick<TOptions, Extract<keyof TOptions, keyof ModelOptions>>;
}

export function registerModel<TModel extends Model>(
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
        modelNamespace,
      });
    }
  });

  return registerActionPayloads;
}

export function flattenModels(models: Models): Record<string, Model> {
  return flattenObject(models, "/") as Record<string, Model>;
}
