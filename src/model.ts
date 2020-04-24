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

export interface Model<
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

export interface ModelConstructor<
  TDependencies = any,
  TDefaultArgs = any,
  TInitialState = any,
  TSelectors = any,
  TReducers = any,
  TEffects = any,
  TEpics = any
> {
  isDynamic?: boolean;
  isLazy?: boolean;

  new (): Model<
    TDependencies,
    TDefaultArgs,
    TInitialState,
    TSelectors,
    TReducers,
    TEffects,
    TEpics
  >;
}

export interface ModelConstructors {
  [key: string]: ModelConstructor | ModelConstructors;
}

export type ExtractDefaultArgsFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["defaultArgs"]>;

export type ExtractInitialStateFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["initialState"]>;

export type ExtractSelectorsFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["selectors"]>;

export type ExtractReducersFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["reducers"]>;

export type ExtractEffectsFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["effects"]>;

export type ExtractEpicsFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = ReturnType<InstanceType<TModelConstructor>["epics"]>;

export type ExtractDependenciesFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = InstanceType<TModelConstructor>["dependencies"];

export type ExtractArgsFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = InstanceType<TModelConstructor>["args"];

export type ExtractStateFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = InstanceType<TModelConstructor>["state"];

export type ExtractGettersFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = InstanceType<TModelConstructor>["getters"];

export type ExtractActionHelpersFromModelConstructor<
  TModelConstructor extends ModelConstructor
> = InstanceType<TModelConstructor>["actions"];

export type MergeDependenciesFromModelConstructors<
  TModelConstructors extends ModelConstructor[]
> = UnionToIntersection<
  {
    [K in Extract<
      keyof TModelConstructors,
      number
    >]: ExtractDependenciesFromModelConstructor<TModelConstructors[K]>;
  }[number]
>;

export type MergeDependenciesFromSubModelConstructors<
  TSubModelConstructors extends Record<string, ModelConstructor>
> = UnionToIntersection<
  {
    [K in keyof TSubModelConstructors]: ExtractDependenciesFromModelConstructor<
      TSubModelConstructors[K]
    >;
  }[keyof TSubModelConstructors]
>;

export type ModelPropKey =
  | "defaultArgs"
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "epics";

export type MergeModelPropFromModelConstructors<
  TModelConstructors extends ModelConstructor[],
  TPropKey extends ModelPropKey
> = UnionToIntersection<
  {
    [K in Extract<keyof TModelConstructors, number>]: ReturnType<
      InstanceType<TModelConstructors[K]>[TPropKey]
    >;
  }[number]
>;

export type MergeSubModelPropFromSubModelConstructors<
  TSubModelConstructors extends Record<string, ModelConstructor>,
  TPropKey extends ModelPropKey
> = {
  [K in keyof TSubModelConstructors]: ReturnType<
    InstanceType<TSubModelConstructors[K]>[TPropKey]
  > &
    (TPropKey extends "defaultArgs" ? { [NYAX_DEFAULT_ARGS_KEY]: true } : {});
};

export class ModelBase<TDependencies = any>
  implements Model<TDependencies, {}, {}, {}, {}, {}, {}> {
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
      return this._getContainerProp(this._container.modelArgs);
    }
    throw new Error("Args is only available in `initialState()`");
  }
  public get state(): any {
    if (this._container.modelState !== NYAX_NOTHING) {
      return this._getContainerProp(this._container.modelState);
    }
    return this._getContainerProp(this._container.state);
  }
  public get getters(): any {
    return this._getContainerProp(this._container.getters);
  }
  public get actions(): any {
    return this._getContainerProp(this._container.actions);
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

  private _getContainerProp(prop: any): any {
    return this._subKey !== undefined ? prop[this._subKey] : prop;
  }
}

export function mergeModels<
  TModelConstructors extends ModelConstructor[] | [ModelConstructor]
>(
  ...modelConstructors: TModelConstructors
): ModelConstructor<
  MergeDependenciesFromModelConstructors<TModelConstructors>,
  MergeModelPropFromModelConstructors<TModelConstructors, "defaultArgs">,
  MergeModelPropFromModelConstructors<TModelConstructors, "initialState">,
  MergeModelPropFromModelConstructors<TModelConstructors, "selectors">,
  MergeModelPropFromModelConstructors<TModelConstructors, "reducers">,
  MergeModelPropFromModelConstructors<TModelConstructors, "effects">,
  MergeModelPropFromModelConstructors<TModelConstructors, "epics">
> {
  return class extends ModelBase {
    private readonly _models: Model[] = modelConstructors.map((ctor) => {
      const model = new ctor() as ModelBase;
      defineGetter(model, "_nyaxContext", () => this._nyaxContext);
      defineGetter(model, "_container", () => this._container);
      return model;
    });

    public defaultArgs(): any {
      return this._mergeModelProp("defaultArgs");
    }

    public initialState(): any {
      return this._mergeModelProp("initialState");
    }

    public selectors(): any {
      return this._mergeModelProp("selectors");
    }

    public reducers(): any {
      return this._mergeModelProp("reducers");
    }

    public effects(): any {
      return this._mergeModelProp("effects");
    }

    public epics(): any {
      return this._mergeModelProp("epics");
    }

    private _mergeModelProp<TPropKey extends ModelPropKey>(
      propKey: TPropKey
    ): ReturnType<Model[TPropKey]> {
      const result = {} as ReturnType<Model[TPropKey]>;

      this._models
        .map((model) => model[propKey]())
        .forEach((prop) => {
          mergeObjects(result, prop);
        });

      return result;
    }
  };
}

export function mergeSubModels<
  TSubModelConstructors extends Record<string, ModelConstructor>
>(
  subModelConstructors: TSubModelConstructors
): ModelConstructor<
  MergeDependenciesFromSubModelConstructors<TSubModelConstructors>,
  MergeSubModelPropFromSubModelConstructors<
    TSubModelConstructors,
    "defaultArgs"
  >,
  MergeSubModelPropFromSubModelConstructors<
    TSubModelConstructors,
    "initialState"
  >,
  MergeSubModelPropFromSubModelConstructors<TSubModelConstructors, "selectors">,
  MergeSubModelPropFromSubModelConstructors<TSubModelConstructors, "reducers">,
  MergeSubModelPropFromSubModelConstructors<TSubModelConstructors, "effects">,
  MergeSubModelPropFromSubModelConstructors<TSubModelConstructors, "epics">
> {
  return class extends ModelBase {
    private readonly _subModels: Record<string, Model> = Object.keys(
      subModelConstructors
    ).reduce<Record<string, Model>>((obj, key) => {
      const model = new subModelConstructors[key]() as ModelBase;
      defineGetter(model, "_nyaxContext", () => this._nyaxContext);
      defineGetter(model, "_container", () => this._container);
      model._subKey = key;
      obj[key] = model;
      return obj;
    }, {});

    public defaultArgs(): any {
      return this._mergeSubModelProp("defaultArgs");
    }

    public initialState(): any {
      return this._mergeSubModelProp("initialState");
    }

    public selectors(): any {
      return this._mergeSubModelProp("selectors");
    }

    public reducers(): any {
      return this._mergeSubModelProp("reducers");
    }

    public effects(): any {
      return this._mergeSubModelProp("effects");
    }

    public epics(): any {
      return this._mergeSubModelProp("epics");
    }

    private _mergeSubModelProp<TPropKey extends ModelPropKey>(
      propKey: TPropKey
    ): Record<string, ReturnType<Model[TPropKey]>> {
      const result: Record<string, ReturnType<Model[TPropKey]>> = {};
      Object.keys(this._subModels).forEach((key) => {
        result[key] = this._subModels[key][propKey]();
        if (propKey === "defaultArgs") {
          result[key][NYAX_DEFAULT_ARGS_KEY] = true;
        }
      });
      return result;
    }
  };
}

export function createModelBase<TDependencies>(): ModelConstructor<
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
  TModelConstructor extends ModelConstructor<
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
>(
  modelConstructor: TModelConstructor,
  modelOptions?: TModelOptions
): TModelConstructor & TModelOptions {
  if (modelOptions) {
    modelConstructor.isDynamic = modelOptions.isDynamic;
    modelConstructor.isLazy = modelOptions.isLazy;
  }

  return modelConstructor as TModelConstructor & TModelOptions;
}

export function registerModel<TModelConstructor extends ModelConstructor>(
  nyaxContext: NyaxContext,
  modelNamespace: string,
  modelConstructor: TModelConstructor
): void {
  if (nyaxContext.modelContextByModelConstructor.has(modelConstructor)) {
    throw new Error("Model is already registered");
  }

  if (nyaxContext.modelConstructorByModelNamespace.has(modelNamespace)) {
    throw new Error("Model namespace is already bound");
  }

  nyaxContext.modelContextByModelConstructor.set(modelConstructor, {
    modelNamespace,
    modelPath: convertNamespaceToPath(modelNamespace),

    containerByContainerKey: new Map(),
  });

  nyaxContext.modelConstructorByModelNamespace.set(
    modelNamespace,
    modelConstructor
  );
}

export function registerModels(
  nyaxContext: NyaxContext,
  modelConstructors: ModelConstructors
): RegisterActionPayload[] {
  const registerActionPayloads: RegisterActionPayload[] = [];

  traverseObject(modelConstructors, (item, key, parent, paths) => {
    const modelNamespace = paths.join("/");
    const modelConstructor = item as Exclude<typeof item, ModelConstructors>;

    registerModel(nyaxContext, modelNamespace, modelConstructor);
    if (!modelConstructor.isDynamic && !modelConstructor.isLazy) {
      registerActionPayloads.push({
        modelNamespace,
      });
    }
  });

  return registerActionPayloads;
}

export function flattenModels(
  modelConstructors: ModelConstructors
): Record<string, ModelConstructor> {
  return flattenObject(modelConstructors, "/") as Record<
    string,
    ModelConstructor
  >;
}
