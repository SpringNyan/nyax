import { ConvertActionHelpers } from "./action";
import { ConvertArgs, DefaultArgs, NYAX_DEFAULT_ARGS_KEY } from "./arg";
import { Effects } from "./effect";
import { Epics } from "./epic";
import { Reducers } from "./reducer";
import { ConvertGetters, Selectors } from "./selector";
import { ConvertState, InitialState } from "./state";
import { defineGetter, UnionToIntersection } from "./util";

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

export class ModelBase<TDependencies> implements Model<TDependencies> {
  public defaultArgs(): DefaultArgs {
    return {};
  }
  public initialState(): InitialState {
    return {};
  }
  public selectors(): Selectors {
    return {};
  }
  public reducers(): Reducers {
    return {};
  }
  public effects(): Effects {
    return {};
  }
  public epics(): Epics {
    return {};
  }

  public dependencies!: TDependencies;
  public args!: ConvertArgs<ReturnType<this["defaultArgs"]>>;
  public state!: ConvertState<ReturnType<this["initialState"]>>;
  public getters!: ConvertGetters<ReturnType<this["selectors"]>>;
  public actions!: ConvertActionHelpers<
    ReturnType<this["reducers"]>,
    ReturnType<this["effects"]>
  >;
}

export type MergeModelDependencies<
  TModelConstructors extends ModelConstructor[]
> = UnionToIntersection<
  {
    [K in Extract<keyof TModelConstructors, number>]: InstanceType<
      TModelConstructors[K]
    >["dependencies"];
  }[number]
>;

export type MergeSubModelDependencies<
  TSubModelConstructors extends Record<string, ModelConstructor>
> = UnionToIntersection<
  {
    [K in keyof TSubModelConstructors]: InstanceType<
      TSubModelConstructors[K]
    >["dependencies"];
  }[keyof TSubModelConstructors]
>;

export type ModelPropKey =
  | "defaultArgs"
  | "initialState"
  | "selectors"
  | "reducers"
  | "effects"
  | "epics";

export type MergeModelProp<
  TModelConstructors extends ModelConstructor[],
  TPropKey extends ModelPropKey
> = UnionToIntersection<
  {
    [K in Extract<keyof TModelConstructors, number>]: ReturnType<
      InstanceType<TModelConstructors[K]>[TPropKey]
    >;
  }[number]
>;

export type MergeSubModelProp<
  TSubModelConstructors extends Record<string, ModelConstructor>,
  TPropKey extends ModelPropKey
> = {
  [K in keyof TSubModelConstructors]: ReturnType<
    InstanceType<TSubModelConstructors[K]>[TPropKey]
  > &
    (TPropKey extends "defaultArgs" ? { [NYAX_DEFAULT_ARGS_KEY]: true } : {});
};

export function mergeModelConstructors<
  TModelConstructors extends ModelConstructor[] | [ModelConstructor]
>(
  ...modelConstructors: TModelConstructors
): ModelConstructor<
  MergeModelDependencies<TModelConstructors>,
  MergeModelProp<TModelConstructors, "defaultArgs">,
  MergeModelProp<TModelConstructors, "initialState">,
  MergeModelProp<TModelConstructors, "selectors">,
  MergeModelProp<TModelConstructors, "reducers">,
  MergeModelProp<TModelConstructors, "effects">,
  MergeModelProp<TModelConstructors, "epics">
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
      return Object.assign(
        {},
        ...this._models.map((model) => model[propKey]())
      );
    }

    public dependencies!: any;
    public args!: any;
    public state!: any;
    public getters!: any;
    public actions!: any;
  };
}

export function mergeSubModelConstructors<
  TSubModelConstructors extends Record<string, ModelConstructor>
>(
  subModelConstructors: TSubModelConstructors
): ModelConstructor<
  MergeSubModelDependencies<TSubModelConstructors>,
  MergeSubModelProp<TSubModelConstructors, "defaultArgs">,
  MergeSubModelProp<TSubModelConstructors, "initialState">,
  MergeSubModelProp<TSubModelConstructors, "selectors">,
  MergeSubModelProp<TSubModelConstructors, "reducers">,
  MergeSubModelProp<TSubModelConstructors, "effects">,
  MergeSubModelProp<TSubModelConstructors, "epics">
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
  };
}
