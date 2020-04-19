import { ActionsObservable, StateObservable } from "redux-observable";
import {
  AnyAction,
  ConvertActionHelpers,
  RegisterActionPayload,
} from "./action";
import { ConvertArgs, ModelDefaultArgs, NYAX_DEFAULT_ARGS_KEY } from "./arg";
import { GetContainer } from "./container";
import { NyaxContext } from "./context";
import { ModelEffects } from "./effect";
import { ModelEpics } from "./epic";
import { ModelReducers } from "./reducer";
import { ConvertGetters, ModelSelectors } from "./selector";
import { ConvertState, ModelInitialState } from "./state";
import {
  convertNamespaceToPath,
  defineGetter,
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

export type ModelConstructor<
  TDependencies = any,
  TDefaultArgs = any,
  TInitialState = any,
  TSelectors = any,
  TReducers = any,
  TEffects = any,
  TEpics = any
> = new () => Model<
  TDependencies,
  TDefaultArgs,
  TInitialState,
  TSelectors,
  TReducers,
  TEffects,
  TEpics
>;

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

export interface ModelConstructors<TDependencies = any> {
  [key: string]:
    | ModelConstructor<TDependencies>
    | [ModelConstructor<TDependencies>]
    | [boolean, ModelConstructor<TDependencies>]
    | ModelConstructors<TDependencies>;
}

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
  return class {
    private readonly _models: Model[];

    constructor() {
      this._models = modelConstructors.map((ctor) => {
        const model = new ctor();

        defineGetter(model, "dependencies", () => this.dependencies);
        defineGetter(model, "args", () => this.args);
        defineGetter(model, "state", () => this.state);
        defineGetter(model, "getters", () => this.getters);
        defineGetter(model, "actions", () => this.actions);

        defineGetter(model, "rootAction$", () => this.rootAction$);
        defineGetter(model, "rootState$", () => this.rootState$);

        defineGetter(model, "modelNamespace", () => this.modelNamespace);
        defineGetter(model, "containerKey", () => this.containerKey);

        defineGetter(model, "getContainer", () => this.getContainer);

        return model;
      });
    }

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

    public dependencies!: any;
    public args!: any;
    public state!: any;
    public getters!: any;
    public actions!: any;

    public rootAction$!: any;
    public rootState$!: any;

    public modelNamespace!: any;
    public containerKey!: any;

    public getContainer!: any;
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
  return class {
    private readonly _subModels: Record<string, Model>;

    constructor() {
      this._subModels = {};
      Object.keys(subModelConstructors).forEach((key) => {
        const model = new subModelConstructors[key]();

        defineGetter(model, "dependencies", () => this.dependencies);
        defineGetter(model, "args", () => this.args[key]);
        defineGetter(model, "state", () => this.state[key]);
        defineGetter(model, "getters", () => this.getters[key]);
        defineGetter(model, "actions", () => this.actions[key]);

        defineGetter(model, "rootAction$", () => this.rootAction$);
        defineGetter(model, "rootState$", () => this.rootState$);

        defineGetter(model, "modelNamespace", () => this.modelNamespace);
        defineGetter(model, "containerKey", () => this.containerKey);

        defineGetter(model, "getContainer", () => this.getContainer);

        this._subModels[key] = model;
      });
    }

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

    public dependencies!: any;
    public args!: any;
    public state!: any;
    public getters!: any;
    public actions!: any;

    public rootAction$!: any;
    public rootState$!: any;

    public modelNamespace!: any;
    public containerKey!: any;

    public getContainer!: any;
  };
}

export function createModelBase<TDependencies>(): ModelConstructor<
  TDependencies,
  ModelDefaultArgs,
  ModelInitialState,
  ModelSelectors,
  ModelReducers,
  ModelEffects,
  ModelEpics
> {
  return class {
    public defaultArgs(): ModelDefaultArgs {
      return {};
    }
    public initialState(): ModelInitialState {
      return {};
    }
    public selectors(): ModelSelectors {
      return {};
    }
    public reducers(): ModelReducers {
      return {};
    }
    public effects(): ModelEffects {
      return {};
    }
    public epics(): ModelEpics {
      return {};
    }

    public dependencies!: any;
    public args!: any;
    public state!: any;
    public getters!: any;
    public actions!: any;

    public rootAction$!: any;
    public rootState$!: any;

    public modelNamespace!: any;
    public containerKey!: any;

    public getContainer!: any;
  };
}

export function registerModel<TModelConstructor extends ModelConstructor>(
  nyaxContext: NyaxContext,
  modelNamespace: string,
  modelConstructorInput:
    | TModelConstructor
    | [TModelConstructor]
    | [boolean, TModelConstructor]
): RegisterActionPayload[] {
  const modelConstructor = (Array.isArray(modelConstructorInput)
    ? modelConstructorInput[modelConstructorInput.length - 1]
    : modelConstructorInput) as TModelConstructor;

  if (nyaxContext.modelContextByModelConstructor.has(modelConstructor)) {
    throw new Error("Model is already registered");
  }

  if (nyaxContext.modelConstructorByModelNamespace.has(modelNamespace)) {
    throw new Error("Model namespace is already bound");
  }

  const isDynamic = Array.isArray(modelConstructorInput);
  const autoRegister =
    Array.isArray(modelConstructorInput) && modelConstructorInput[0] === true;

  nyaxContext.modelContextByModelConstructor.set(modelConstructor, {
    modelNamespace,
    modelPath: convertNamespaceToPath(modelNamespace),

    isDynamic,
    autoRegister,

    containerByContainerKey: new Map(),
  });

  nyaxContext.modelConstructorByModelNamespace.set(
    modelNamespace,
    modelConstructor
  );

  return !isDynamic
    ? [
        {
          modelNamespace,
        },
      ]
    : [];
}

export function registerModels(
  nyaxContext: NyaxContext,
  modelConstructors: ModelConstructors
): RegisterActionPayload[] {
  const registerActionPayloads: RegisterActionPayload[] = [];

  traverseObject(modelConstructors, (item, key, parent, paths) => {
    const modelNamespace = paths.join("/");
    registerActionPayloads.push(
      ...registerModel(
        nyaxContext,
        modelNamespace,
        item as Exclude<typeof item, ModelConstructors>
      )
    );
  });

  return registerActionPayloads;
}

export function flattenModels(
  modelConstructors: ModelConstructors
): Record<string, ModelConstructor> {
  const result: Record<string, ModelConstructor> = {};

  traverseObject(modelConstructors, (item, key, parent, paths) => {
    const modelNamespace = paths.join("/");
    result[modelNamespace] = (Array.isArray(item)
      ? item[item.length - 1]
      : item) as ModelConstructor;
  });

  return result;
}
