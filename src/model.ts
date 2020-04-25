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
import { ConvertState, ModelInitialState } from "./state";
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

export type MergeDependenciesFromModels<
  TModels extends Model[]
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ExtractModelDependencies<TModels[K]>;
  }[number]
>;

export type MergeDependenciesFromSubModels<
  TSubModels extends Record<string, Model>
> = UnionToIntersection<
  {
    [K in keyof TSubModels]: ExtractModelDependencies<TSubModels[K]>;
  }[keyof TSubModels]
>;

export type ModelInstancePropertyKey =
  | "defaultArgs"
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "epics";

export type MergeModelPropertyFromModels<
  TModels extends Model[],
  TPropertyKey extends ModelInstancePropertyKey
> = UnionToIntersection<
  {
    [K in Extract<keyof TModels, number>]: ReturnType<
      InstanceType<TModels[K]>[TPropertyKey]
    >;
  }[number]
>;

export type MergeSubModelPropertyFromSubModels<
  TSubModels extends Record<string, Model>,
  TPropertyKey extends ModelInstancePropertyKey
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
  public _nyaxContext!: NyaxContext;
  public _container!: ContainerImpl;
  public _subKey!: string | undefined;

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
    return this._nyaxContext.dependencies;
  }
  public get args(): any {
    if (this._container.modelArgs !== NYAX_NOTHING) {
      return this._getContainerProperty(this._container.modelArgs);
    }
    throw new Error("Args is only available in `initialState()`");
  }
  public get state(): any {
    if (this._container.modelState !== NYAX_NOTHING) {
      return this._getContainerProperty(this._container.modelState);
    }
    return this._getContainerProperty(this._container.state);
  }
  public get getters(): any {
    return this._getContainerProperty(this._container.getters);
  }
  public get actions(): any {
    return this._getContainerProperty(this._container.actions);
  }

  public get rootAction$(): any {
    return this._nyaxContext.rootAction$;
  }
  public get rootState$(): any {
    return this._nyaxContext.rootState$;
  }

  public get modelNamespace(): any {
    return this._container.modelNamespace;
  }
  public get containerKey(): any {
    return this._container.containerKey;
  }

  public get getContainer(): any {
    return this._nyaxContext.getContainer;
  }

  private _getContainerProperty(property: any): any {
    return this._subKey !== undefined ? property[this._subKey] : property;
  }
}

export function mergeModels<TModels extends Model[] | [Model]>(
  ...models: TModels
): Model<
  MergeDependenciesFromModels<TModels>,
  MergeModelPropertyFromModels<TModels, "defaultArgs">,
  MergeModelPropertyFromModels<TModels, "initialState">,
  MergeModelPropertyFromModels<TModels, "selectors">,
  MergeModelPropertyFromModels<TModels, "reducers">,
  MergeModelPropertyFromModels<TModels, "effects">,
  MergeModelPropertyFromModels<TModels, "epics">
> {
  return class extends ModelBase {
    private readonly _modelInstances: ModelInstance[] = models.map((model) => {
      const modelInstance = new model() as ModelBase;
      defineGetter(modelInstance, "_nyaxContext", () => this._nyaxContext);
      defineGetter(modelInstance, "_container", () => this._container);
      return modelInstance;
    });

    public defaultArgs(): any {
      return this._mergeModelInstanceProperty("defaultArgs");
    }

    public initialState(): any {
      return this._mergeModelInstanceProperty("initialState");
    }

    public selectors(): any {
      return this._mergeModelInstanceProperty("selectors");
    }

    public reducers(): any {
      return this._mergeModelInstanceProperty("reducers");
    }

    public effects(): any {
      return this._mergeModelInstanceProperty("effects");
    }

    public epics(): any {
      return this._mergeModelInstanceProperty("epics");
    }

    private _mergeModelInstanceProperty<
      TPropertyKey extends ModelInstancePropertyKey
    >(propertyKey: TPropertyKey): ReturnType<ModelInstance[TPropertyKey]> {
      const result = {} as ReturnType<ModelInstance[TPropertyKey]>;

      this._modelInstances
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
): Model<
  MergeDependenciesFromSubModels<TSubModels>,
  MergeSubModelPropertyFromSubModels<TSubModels, "defaultArgs">,
  MergeSubModelPropertyFromSubModels<TSubModels, "initialState">,
  MergeSubModelPropertyFromSubModels<TSubModels, "selectors">,
  MergeSubModelPropertyFromSubModels<TSubModels, "reducers">,
  MergeSubModelPropertyFromSubModels<TSubModels, "effects">,
  MergeSubModelPropertyFromSubModels<TSubModels, "epics">
> {
  return class extends ModelBase {
    private readonly _subModelInstances: Record<
      string,
      ModelInstance
    > = Object.keys(subModels).reduce<Record<string, ModelInstance>>(
      (obj, key) => {
        const modelInstance = new subModels[key]() as ModelBase;
        defineGetter(modelInstance, "_nyaxContext", () => this._nyaxContext);
        defineGetter(modelInstance, "_container", () => this._container);
        modelInstance._subKey = key;
        obj[key] = modelInstance;
        return obj;
      },
      {}
    );

    public defaultArgs(): any {
      return this._mergeSubModelInstanceProperty("defaultArgs");
    }

    public initialState(): any {
      return this._mergeSubModelInstanceProperty("initialState");
    }

    public selectors(): any {
      return this._mergeSubModelInstanceProperty("selectors");
    }

    public reducers(): any {
      return this._mergeSubModelInstanceProperty("reducers");
    }

    public effects(): any {
      return this._mergeSubModelInstanceProperty("effects");
    }

    public epics(): any {
      return this._mergeSubModelInstanceProperty("epics");
    }

    private _mergeSubModelInstanceProperty<
      TPropertyKey extends ModelInstancePropertyKey
    >(
      propertyKey: TPropertyKey
    ): Record<string, ReturnType<ModelInstance[TPropertyKey]>> {
      const result: Record<
        string,
        ReturnType<ModelInstance[TPropertyKey]>
      > = {};
      Object.keys(this._subModelInstances).forEach((key) => {
        result[key] = this._subModelInstances[key][propertyKey]();
        if (propertyKey === "defaultArgs") {
          result[key][NYAX_DEFAULT_ARGS_KEY] = true;
        }
      });
      return result;
    }
  };
}

export function createModelBase<TDependencies>(): Model<
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
  TModel extends Model<
    any,
    ModelDefaultArgs,
    ModelInitialState,
    ModelSelectors,
    ModelReducers,
    ModelEffects,
    ModelEpics
  >,
  TModelOptions extends {
    isDynamic?: boolean;
    isLazy?: boolean;
  }
>(model: TModel, modelOptions?: TModelOptions): TModel & TModelOptions {
  if (modelOptions) {
    model.isDynamic = modelOptions.isDynamic;
    model.isLazy = modelOptions.isLazy;
  }

  return model as TModel & TModelOptions;
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
